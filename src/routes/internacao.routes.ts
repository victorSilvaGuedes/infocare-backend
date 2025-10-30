// Salve este arquivo como: src/routes/internacao.routes.ts

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma, StatusInternacao } from '@prisma/client'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middlewares/authMiddleware'

// --- SCHEMAS ZOD ---

// (ATUALIZADO) Schema para CRIAR uma Internacao (POST /)
const createInternacaoSchema = z.object({
	idPaciente: z
		.number()
		.int()
		.positive({ message: 'ID do Paciente é obrigatório.' }),
	idFamiliar: z.number().int().positive().optional(),

	// (NOVO) Aceita o ID do profissional responsável
	idProfissionalResponsavel: z.number().int().positive().optional(),

	diagnostico: z.string().optional(),
	observacoes: z.string().optional(),

	// (NOVOS) Aceita os campos de localização
	quarto: z.string().optional(),
	leito: z.string().optional(),
})

// Schema para FILTRAR Internações (GET /)
const getInternacoesSchema = z.object({
	// Permite filtrar por status, ex: /internacoes?status=ATIVA
	status: z.nativeEnum(StatusInternacao).optional(),
})

// Schema para ID na URL (GET /:id, PUT /:id/alta)
const getInternacaoByIdSchema = z.object({
	id: z.coerce.number().int().positive(),
})

// --- CRIAÇÃO DO ROTEADOR ---
const internacaoRouter = Router()

// --- ROTAS ---

/**
 * Rota: POST /
 * Descrição: Cria uma nova internação.
 * (PROTEGIDA: Apenas para Profissionais)
 */
internacaoRouter.post(
	'/',
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

			const validatedData = createInternacaoSchema.parse(req.body)

			const internacao = await prisma.internacao.create({
				data: {
					...validatedData,
					// dataInicio e status são definidos por @default no schema
				},
			})

			return res.status(201).json(internacao)
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				// P2025 = "Record to update/create not found."
				// P2003 = "Foreign key constraint failed" (mais específico para criação)
				if (error.code === 'P2025' || error.code === 'P2003') {
					return next(
						new Error(
							'Um dos IDs fornecidos (Paciente, Familiar ou Profissional) não foi encontrado.'
						)
					)
				}
			}
			return next(error)
		}
	}
)

/**
 * (NOVA ROTA)
 * Rota: PUT /:id/alta
 * Descrição: Finaliza uma internação (Dá alta).
 * (PROTEGIDA: Apenas para Profissionais)
 */
internacaoRouter.put(
	'/:id/alta',
	authMiddleware, // 1. Protegemos a rota
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 2. Verificamos a Autorização (Permissão)
			if (req.usuario?.tipo !== 'profissional') {
				const error = new Error(
					'Acesso negado: Rota apenas para profissionais.'
				)
				;(error as any).statusCode = 403
				return next(error)
			}

			// 3. Validamos o ID da URL
			const { id } = getInternacaoByIdSchema.parse(req.params)

			// 4. Lógica de Banco (Atualizar)
			const internacaoAtualizada = await prisma.internacao.update({
				where: { id: id },
				data: {
					status: 'ALTA', // Muda o status
					dataAlta: new Date(), // Define a data/hora de encerramento (agora)
				},
			})

			return res.status(200).json(internacaoAtualizada)
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					// "Record to update not found."
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
 * Descrição: Lista todas as internações.
 * (Pública, com filtro opcional por status)
 */
internacaoRouter.get(
	'/',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 1. Validamos os query params (ex: ?status=ATIVA)
			const { status } = getInternacoesSchema.parse(req.query)

			// 2. Lógica de Banco (Buscar Todos)
			const internacoes = await prisma.internacao.findMany({
				where: {
					// Se 'status' foi fornecido, filtra por ele
					status: status,
				},
				// (ATUALIZADO) Incluímos mais dados na listagem
				include: {
					paciente: {
						select: { nome: true, cpf: true }, // Mais leve
					},
					profissionalResponsavel: {
						// Quem é o médico responsável
						select: { nome: true, especialidade: true },
					},
				},
				orderBy: {
					dataInicio: 'desc', // Mais recentes primeiro
				},
			})

			// 3. Resposta
			return res.status(200).json(internacoes)
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * Rota: GET /:id
 * Descrição: Busca uma internação específica.
 * (Pública)
 */
internacaoRouter.get(
	'/:id',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 1. Validar o ID da URL
			const { id } = getInternacaoByIdSchema.parse(req.params)

			// 2. Buscar no Banco
			const internacao = await prisma.internacao.findUnique({
				where: { id: id },
				// (ATUALIZADO) Incluímos todos os dados relacionados
				include: {
					paciente: true,
					familiar: true, // O familiar responsável (se houver)
					profissionalResponsavel: true, // O médico responsável
					evolucoes: {
						// As evoluções desta internação
						orderBy: {
							dataEvolucao: 'desc',
						},
						// (NOVO) Também incluímos quem escreveu a evolução
						include: {
							profissional: {
								select: { nome: true, tipo: true },
							},
						},
					},
				},
			})

			// 3. Tratamento de "Não Encontrado"
			if (!internacao) {
				const notFoundError = new Error('Internação não encontrada.')
				;(notFoundError as any).statusCode = 404
				return next(notFoundError)
			}

			// 4. Resposta
			return res.status(200).json(internacao)
		} catch (error: any) {
			return next(error)
		}
	}
)

export default internacaoRouter
