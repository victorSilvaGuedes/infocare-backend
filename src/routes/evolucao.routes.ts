// Salve este arquivo como: src/routes/evolucao.routes.ts
// (Sem alterações, apenas para confirmação)

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middlewares/authMiddleware'
import { sendEmail } from '../services/email.service' // Importa o serviço de e-mail
import 'dotenv/config'
import {
	GoogleGenerativeAI,
	HarmCategory,
	HarmBlockThreshold,
} from '@google/generative-ai'
import { upload } from '../middlewares/uploadMiddleware'
import { log } from 'console'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const model = genAI.getGenerativeModel({
	model: 'gemini-2.5-flash', // Um modelo capaz de processar áudio
})

const generationConfig = {
	temperature: 0.4,
	topK: 32,
	topP: 1,
	maxOutputTokens: 8192,
}

const safetySettings = [
	{
		category: HarmCategory.HARM_CATEGORY_HARASSMENT,
		threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
		threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
		threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
		threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
	},
]

// --- Schemas Zod ---
const createEvolucaoSchema = z.object({
	idInternacao: z
		.number()
		.int()
		.positive({ message: 'ID da Internação é obrigatório.' }),
	descricao: z
		.string()
		.min(5, { message: 'A descrição deve ter pelo menos 5 caracteres.' }),
})

const getEvolucaoByIdSchema = z.object({
	id: z.coerce.number().int().positive(),
})

// --- CRIAÇÃO DO ROTEADOR ---
const evolucaoRouter = Router()

// --- ROTAS ---

/**
 * Rota: POST /
 * Descrição: Cria uma nova evolução (Verificando se a internação está ATIVA).
 */
evolucaoRouter.post(
	'/',
	authMiddleware,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 1. Verificamos se é um Profissional
			if (req.usuario?.tipo !== 'profissional') {
				const error = new Error(
					'Acesso negado: Rota apenas para profissionais.'
				)
				;(error as any).statusCode = 403
				return next(error)
			}

			// 2. Pegamos o ID do Profissional (do token)
			const idProfissionalLogado = req.usuario.sub

			// 3. Validamos o body
			const { idInternacao, descricao } = createEvolucaoSchema.parse(req.body)

			// 4. (Verificação de Status)
			const internacaoAlvo = await prisma.internacao.findUnique({
				where: { id: idInternacao },
				select: { status: true },
			})

			if (!internacaoAlvo) {
				return next(new Error('Internação não encontrada com o ID fornecido.'))
			}

			if (internacaoAlvo.status === 'ALTA') {
				const error = new Error(
					'Ação bloqueada: Não é possível adicionar evoluções a uma internação que já recebeu alta.'
				)
				;(error as any).statusCode = 400
				return next(error)
			}

			// 5. Lógica de Banco (Cria a Evolução)
			const novaEvolucao = await prisma.evolucao.create({
				data: {
					idInternacao: idInternacao,
					descricao: descricao,
					idProfissional: idProfissionalLogado,
				},
			})

			// 7. Resposta de Sucesso (imediata)
			res.status(201).json(novaEvolucao)

			// 8. Enviar e-mail (em segundo plano)
			try {
				// (A MÁGICA ESTÁ AQUI)
				// Busca a internação E o paciente
				const internacao = await prisma.internacao.findUnique({
					where: { id: idInternacao },
					include: {
						paciente: { select: { nome: true } }, // <-- Buscamos o nome do paciente
						associacoes: {
							where: { status: 'aprovada' },
							include: {
								familiar: { select: { email: true, nome: true } },
							},
						},
					},
				})

				if (internacao && internacao.associacoes.length > 0) {
					// (AQUI) Usamos o nome do paciente
					const nomePaciente = internacao.paciente.nome

					for (const assoc of internacao.associacoes) {
						if (assoc.familiar && assoc.familiar.email) {
							try {
								await sendEmail({
									to: assoc.familiar.email,

									// (AQUI) Usamos no Assunto
									subject: `[InfoCare] Nova atualização para ${nomePaciente}`,

									// (AQUI) Usamos no Corpo
									html: `Olá, ${assoc.familiar.nome}.<br>Uma nova evolução foi registrada no prontuário do paciente <b>${nomePaciente}</b>.`,
								})
							} catch (loopError: any) {
								console.error(
									`[Email] Falha ao enviar e-mail de evolução (loop):`,
									loopError.message
								)
							}
						}
					}
				}
			} catch (emailError: any) {
				console.error(
					'[Email] Falha ao buscar associados para e-mail:',
					emailError.message
				)
			}
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2003') {
					return next(
						new Error('Internação não encontrada com o ID fornecido.')
					)
				}
			}
			return next(error)
		}
	}
)

/**
 * Rota: DELETE /:id
 * Descrição: Profissional (logado) APAGA uma Evolução.
 */
evolucaoRouter.delete(
	'/:id',
	authMiddleware,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (req.usuario?.tipo !== 'profissional') {
				const error = new Error(
					'Acesso negado: Rota apenas para profissionais.'
				)
				;(error as any).statusCode = 403
				return next(error)
			}

			const { id } = getEvolucaoByIdSchema.parse(req.params)

			await prisma.evolucao.delete({
				where: { id: id },
			})

			return res.status(200).json({
				status: 'sucesso',
				message: 'Evolução apagada.',
			})
		} catch (error: any) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2025'
			) {
				return next(new Error('Evolução não encontrada.'))
			}
			return next(error)
		}
	}
)

/**
 * (NOVA ROTA)
 * Rota: POST /transcrever
 * Descrição: Recebe um áudio, envia para o Gemini e retorna a transcrição.
 * (PROTEGIDA: Apenas para Profissionais)
 */
evolucaoRouter.post(
	'/transcrever',
	authMiddleware, // 1. Protegemos a rota
	upload.single('audio'), // 2. Usamos o multer para esperar um ficheiro no campo 'audio'
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 3. Verificamos se é um Profissional
			if (req.usuario?.tipo !== 'profissional') {
				const error = new Error(
					'Acesso negado: Rota apenas para profissionais.'
				)
				;(error as any).statusCode = 403
				return next(error)
			}

			// 4. Verificamos se o ficheiro (áudio) foi enviado
			if (!req.file) {
				return next(new Error('Nenhum ficheiro de áudio enviado.'))
			}

			console.log(
				`[Gemini] Recebido áudio de ${req.file.mimetype}, tamanho: ${req.file.size} bytes.`
			)

			// 5. Preparar o áudio para a API do Gemini
			// O multer nos dá o áudio como um 'buffer' (dados brutos)
			// Nós o convertemos para base64, que é o que a API espera.
			const audioBase64 = req.file.buffer.toString('base64')

			const parts = [
				{
					text: 'Transcreva este áudio. O áudio é de um profissional de saúde ditando uma evolução de um paciente. Foque apenas na transcrição médica, ignorando ruídos de fundo ou pausas. O áudio está no formato webm/opus.',
				},
				{
					inlineData: {
						mimeType: req.file.mimetype, // ex: "audio/webm" ou "audio/mp4"
						data: audioBase64,
					},
				},
			]

			// 6. Chamar a API do Gemini
			const result = await model.generateContent({
				contents: [{ role: 'user', parts }],
				generationConfig,
				safetySettings,
			})

			// 7. Processar e retornar a resposta
			const response = result.response
			const transcricao = response.text()

			return res.status(200).json({
				transcricao: transcricao,
			})
		} catch (error: any) {
			console.error('[Gemini] Erro ao transcrever áudio:', error.message)
			// Passa o erro para o nosso errorHandler global
			return next(new Error('Falha ao processar a transcrição de áudio.'))
		}
	}
)

export default evolucaoRouter
