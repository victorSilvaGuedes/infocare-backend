// Salve este arquivo como: src/routes/evolucao.routes.ts
// (Versão REFAORADA - Sem lógica de transcrição)

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middlewares/authMiddleware'
import { sendEmail } from '../services/email.service' // Importa o serviço de e-mail

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
				const internacao = await prisma.internacao.findUnique({
					where: { id: idInternacao },
					include: {
						paciente: { select: { nome: true } },
						associacoes: {
							where: { status: 'aprovada' },
							include: {
								familiar: { select: { email: true, nome: true } },
							},
						},
					},
				})

				if (internacao && internacao.associacoes.length > 0) {
					const nomePaciente = internacao.paciente.nome

					for (const assoc of internacao.associacoes) {
						if (assoc.familiar && assoc.familiar.email) {
							try {
								await sendEmail({
									to: assoc.familiar.email,
									subject: `[InfoCare] Nova atualização para ${nomePaciente}`,
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

// (A ROTA POST /transcrever FOI MOVIDA PARA util.routes.ts)

export default evolucaoRouter
