// Salve este arquivo como: src/routes/evolucao.routes.ts
// (Versão ATUALIZADA - Com verificação de status)

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middlewares/authMiddleware'

// (Sem Twilio)
// import { sendWhatsAppNotification } from '../services/notification.service';

// --- SCHEMAS ZOD ---
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

			// 4. (NOVA VERIFICAÇÃO)
			// Buscamos a internação para verificar seu status
			const internacaoAlvo = await prisma.internacao.findUnique({
				where: { id: idInternacao },
				select: { status: true }, // Só precisamos do status
			})

			// 4a. Se a internação não existir
			if (!internacaoAlvo) {
				return next(new Error('Internação não encontrada com o ID fornecido.'))
			}

			// 4b. (A SUA REGRA) Se a internação estiver com ALTA
			if (internacaoAlvo.status === 'ALTA') {
				const error = new Error(
					'Ação bloqueada: Não é possível adicionar evoluções a uma internação que já recebeu alta.'
				)
				;(error as any).statusCode = 400 // 400 Bad Request
				return next(error)
			}

			// 5. Lógica de Banco (Se passou, cria a Evolução)
			const novaEvolucao = await prisma.evolucao.create({
				data: {
					idInternacao: idInternacao,
					descricao: descricao,
					idProfissional: idProfissionalLogado,
					// dataHora é @default(now())
				},
			})

			// 6. Lógica de Notificação (Removida)

			// 7. Resposta de Sucesso
			return res.status(201).json(novaEvolucao)
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
			// 2. Verificamos se é um Profissional
			if (req.usuario?.tipo !== 'profissional') {
				const error = new Error(
					'Acesso negado: Rota apenas para profissionais.'
				)
				;(error as any).statusCode = 403
				return next(error)
			}

			// 3. Validamos o ID da Evolução (da URL)
			const { id } = getEvolucaoByIdSchema.parse(req.params)

			// 4. Lógica de Banco (Apagar)
			await prisma.evolucao.delete({
				where: { id: id },
			})

			// 5. Resposta
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

export default evolucaoRouter
