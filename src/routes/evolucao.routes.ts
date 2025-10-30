// Salve este arquivo como: src/routes/evolucao.routes.ts
// (Versão ATUALIZADA - Sem Twilio)

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middlewares/authMiddleware'

// 1. IMPORTAÇÃO DO SERVIÇO DE NOTIFICAÇÃO (COMENTADA/REMOVIDA)
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

// --- CRIAÇÃO DO ROTEADOR ---
const evolucaoRouter = Router()

// --- ROTAS ---

/**
 * Rota: POST /
 * Descrição: Cria uma nova evolução (Sem notificação).
 * (PROTEGIDA: Apenas para Profissionais)
 */
evolucaoRouter.post(
	'/',
	authMiddleware, // Protegemos a rota
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 1. Verificamos a Autorização
			if (req.usuario?.tipo !== 'profissional') {
				const error = new Error(
					'Acesso negado: Rota apenas para profissionais.'
				)
				;(error as any).statusCode = 403
				return next(error)
			}

			// 2. Pegamos o ID do Profissional que está logado (do token)
			const idProfissionalLogado = req.usuario.sub

			// 3. Validamos o body
			const { idInternacao, descricao } = createEvolucaoSchema.parse(req.body)

			// 4. Lógica de Banco (Criar a Evolução)
			const novaEvolucao = await prisma.evolucao.create({
				data: {
					idInternacao: idInternacao,
					descricao: descricao,
					idProfissional: idProfissionalLogado,
				},
			})

			// 5. LÓGICA DE NOTIFICAÇÃO (TWILIO) - (REMOVIDA)
			// O bloco 'try/catch' que chamava o sendWhatsAppNotification
			// foi completamente removido.

			// 6. Resposta de Sucesso
			return res.status(201).json(novaEvolucao)
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2003') {
					// Foreign key constraint failed
					return next(
						new Error('Internação não encontrada com o ID fornecido.')
					)
				}
			}
			return next(error)
		}
	}
)

export default evolucaoRouter
