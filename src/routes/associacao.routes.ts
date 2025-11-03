// Salve este arquivo como: src/routes/associacao.routes.ts

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma, StatusAssociacao } from '@prisma/client'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middlewares/authMiddleware'

// --- SCHEMAS ZOD ---

// Schema para o Familiar SOLICITAR uma associação
const createAssociacaoSchema = z.object({
	idInternacao: z
		.number()
		.int()
		.positive({ message: 'ID da Internação é obrigatório.' }),
})

// Schema para o Profissional LISTAR associações
const getAssociacoesSchema = z.object({
	// Permite filtrar por status, ex: /associacoes?status=pendente
	status: z.nativeEnum(StatusAssociacao).optional(),
})

// Schema para ID na URL
const getAssociacaoByIdSchema = z.object({
	id: z.coerce.number().int().positive(),
})

// --- CRIAÇÃO DO ROTEADOR ---
const associacaoRouter = Router()

// --- ROTAS ---

/**
 * Rota: POST /
 * Descrição: Familiar (logado) solicita associação com uma internação.
 * (PROTEGIDA: Apenas para Familiares)
 */
associacaoRouter.post(
	'/',
	authMiddleware, // 1. Rota protegida
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 2. Verificamos se quem está logado é um FAMILIAR
			if (req.usuario?.tipo !== 'familiar') {
				const error = new Error('Acesso negado: Rota apenas para familiares.')
				;(error as any).statusCode = 403
				return next(error)
			}

			// 3. Pegamos o ID do Familiar (do token)
			const idFamiliarLogado = req.usuario.sub

			// 4. Validamos o body (o idInternacao que ele quer ver)
			const { idInternacao } = createAssociacaoSchema.parse(req.body)

			// 5. [Extra] Verificar se ele já não solicitou
			const jaExiste = await prisma.associacao.findFirst({
				where: {
					idFamiliar: idFamiliarLogado,
					idInternacao: idInternacao,
				},
			})

			if (jaExiste) {
				return next(
					new Error(
						`Você já enviou uma solicitação para esta internação (Status: ${jaExiste.status}).`
					)
				)
			}

			// 6. Lógica de Banco (Criar o pedido)
			const novaAssociacao = await prisma.associacao.create({
				data: {
					idFamiliar: idFamiliarLogado, // ID do token
					idInternacao: idInternacao, // ID do body
					status: 'pendente', // Padrão
				},
			})

			// 7. Resposta
			return res.status(201).json(novaAssociacao)
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

/**
 * Rota: GET /
 * Descrição: Lista todas as solicitações de associação.
 * (PROTEGIDA: Apenas para Profissionais - para eles poderem aprovar)
 */
associacaoRouter.get(
	'/',
	authMiddleware, // 1. Rota protegida
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 2. Verificamos se quem está logado é um PROFISSIONAL
			if (req.usuario?.tipo !== 'profissional') {
				const error = new Error(
					'Acesso negado: Rota apenas para profissionais.'
				)
				;(error as any).statusCode = 403
				return next(error)
			}

			// 3. Validamos os query params (ex: ?status=pendente)
			const { status } = getAssociacoesSchema.parse(req.query)

			// 4. Lógica de Banco (Buscar Solicitações)
			const associacoes = await prisma.associacao.findMany({
				where: {
					status: status, // Filtra por status (ex: PENDENTE)
				},
				include: {
					familiar: {
						select: { nome: true, email: true },
					},
					internacao: {
						select: {
							id: true,
							paciente: { select: { nome: true } },
						},
					},
				},
				orderBy: {
					dataSolicitacao: 'asc', // Mais antigas primeiro
				},
			})

			// 5. Resposta
			return res.status(200).json(associacoes)
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * (NOVA ROTA)
 * Rota: PUT /:id/aprovar
 * Descrição: Profissional (logado) APROVA uma solicitação de associação.
 * (PROTEGIDA: Apenas para Profissionais)
 */
associacaoRouter.put(
	'/:id/aprovar',
	authMiddleware, // 1. Rota protegida
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

			// 3. Validamos o ID da associação (da URL)
			const { id } = getAssociacaoByIdSchema.parse(req.params)

			// 4. Lógica de Banco (Atualizar)
			const associacaoAprovada = await prisma.associacao.update({
				where: { id: id },
				data: {
					status: 'aprovada', // MUDAMOS O STATUS
				},
			})

			// 5. Resposta
			return res.status(200).json(associacaoAprovada)
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					// "Record to update not found."
					return next(new Error('Solicitação de associação não encontrada.'))
				}
			}
			return next(error)
		}
	}
)

/**
 * (NOVA ROTA)
 * Rota: PUT /:id/rejeitar
 * Descrição: Profissional (logado) REJEITA uma solicitação de associação.
 * (PROTEGIDA: Apenas para Profissionais)
 */
associacaoRouter.put(
	'/:id/rejeitar',
	authMiddleware, // 1. Rota protegida
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

			// 3. Validamos o ID da associação (da URL)
			const { id } = getAssociacaoByIdSchema.parse(req.params)

			// 4. Lógica de Banco (Atualizar)
			const associacaoRejeitada = await prisma.associacao.update({
				where: { id: id },
				data: {
					status: 'rejeitada', // MUDAMOS O STATUS
				},
			})

			// 5. Resposta
			return res.status(200).json(associacaoRejeitada)
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					return next(new Error('Solicitação de associação não encontrada.'))
				}
			}
			return next(error)
		}
	}
)

/**
 * (NOVA ROTA)
 * Rota: DELETE /:id
 * Descrição: Profissional (logado) APAGA uma Solicitação de Associação.
 * (PROTEGIDA: Apenas para Profissionais)
 */
associacaoRouter.delete(
	'/:id',
	authMiddleware, // 1. Protegemos
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

			// 3. Validamos o ID da Associação (da URL)
			const { id } = getAssociacaoByIdSchema.parse(req.params)

			// 4. Lógica de Banco (Apagar)
			await prisma.associacao.delete({
				where: { id: id },
			})

			// 5. Resposta
			return res.status(200).json({
				status: 'sucesso',
				message: 'Solicitação de associação apagada.',
			})
		} catch (error: any) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2025'
			) {
				return next(new Error('Solicitação de associação não encontrada.'))
			}
			return next(error)
		}
	}
)

export default associacaoRouter
