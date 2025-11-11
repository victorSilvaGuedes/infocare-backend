// Salve este arquivo como: src/routes/paciente.routes.ts
// (Versão ATUALIZADA com 'include' na rota GET /:id)

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middlewares/authMiddleware'

// --- SCHEMAS ZOD (Existentes - Sem alteração) ---

const createPacienteSchema = z.object({
	nome: z.string().min(3, { message: 'Nome deve ter no mínimo 3 caracteres.' }),
	cpf: z
		.string()
		.length(14, { message: 'CPF deve estar no formato xxx.xxx.xxx-xx' }),
	telefone: z.string().optional(),
	dataNascimento: z.coerce.date(),
	tipoSanguineo: z.string().optional(),
})

const updatePacienteSchema = createPacienteSchema.partial()

const getPacienteByIdSchema = z.object({
	id: z.coerce
		.number()
		.int()
		.positive({ message: 'ID deve ser um número positivo.' }),
})

// --- CRIAÇÃO DO ROTEADOR ---
const pacienteRouter = Router()

// --- ROTAS ---

/**
 * Rota: POST /
 * (Sem alteração)
 */
pacienteRouter.post(
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

			const validatedData = createPacienteSchema.parse(req.body)

			const paciente = await prisma.paciente.create({
				data: {
					...validatedData,
				},
			})

			return res.status(201).json(paciente)
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (
					error.code === 'P2002' &&
					error.meta?.target === 'Pacientes_cpf_key'
				) {
					const cpfDuplicadoError = new Error(
						'Já existe um paciente cadastrado com este CPF.'
					)
					return next(cpfDuplicadoError)
				}
			}
			return next(error)
		}
	}
)

/**
 * Rota: GET /
 * (Sem alteração)
 */
pacienteRouter.get(
	'/',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const pacientes = await prisma.paciente.findMany()
			return res.status(200).json(pacientes)
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * Rota: GET /:id
 * Descrição: Busca um paciente específico E O SEU HISTÓRICO DE INTERNAÇÕES.
 * (CORRIGIDA)
 */
pacienteRouter.get(
	'/:id',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 1. Validar os parâmetros da URL (req.params)
			const { id } = getPacienteByIdSchema.parse(req.params)

			// 2. Lógica de Banco (Buscar Um)
			const paciente = await prisma.paciente.findUnique({
				where: {
					id: id,
				},
				// ==========================================================
				// (A CORREÇÃO ESTÁ AQUI)
				// Isto "junta" todas as internações associadas a este paciente.
				include: {
					internacoes: {
						// (Opcional) Ordenar as internações pela mais recente
						orderBy: {
							dataInicio: 'desc',
						},
					},
				},
				// ==========================================================
			})

			// 3. Tratamento de "Não Encontrado"
			if (!paciente) {
				const notFoundError = new Error('Paciente não encontrado.')
				;(notFoundError as any).statusCode = 404
				return next(notFoundError)
			}

			// 4. Resposta (agora inclui o array 'internacoes')
			return res.status(200).json(paciente)
		} catch (error: any) {
			// 5. Tratamento de Erro (ID inválido do Zod, etc.)
			return next(error)
		}
	}
)

/**
 * Rota: PUT /:id
 * (Sem alteração)
 */
pacienteRouter.put(
	'/:id',
	authMiddleware,
	async (req: Request, res: Response, next: NextFunction) => {
		// ... (código existente sem alteração)
		try {
			if (req.usuario?.tipo !== 'profissional') {
				const error = new Error(
					'Acesso negado: Rota apenas para profissionais.'
				)
				;(error as any).statusCode = 403
				return next(error)
			}
			const { id } = getPacienteByIdSchema.parse(req.params)
			const validatedData = updatePacienteSchema.parse(req.body)
			if (Object.keys(validatedData).length === 0) {
				return res.status(400).json({
					status: 'error',
					message: 'Nenhum dado fornecido para atualização.',
				})
			}
			const pacienteAtualizado = await prisma.paciente.update({
				where: { id: id },
				data: validatedData,
			})
			return res.status(200).json(pacienteAtualizado)
		} catch (error: any) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2025'
			) {
				return next(new Error('Paciente não encontrado.'))
			}
			return next(error)
		}
	}
)

/**
 * Rota: DELETE /:id
 * (Sem alteração)
 */
pacienteRouter.delete(
	'/:id',
	authMiddleware,
	async (req: Request, res: Response, next: NextFunction) => {
		// ... (código existente sem alteração)
		try {
			if (req.usuario?.tipo !== 'profissional') {
				const error = new Error(
					'Acesso negado: Rota apenas para profissionais.'
				)
				;(error as any).statusCode = 403
				return next(error)
			}
			const { id } = getPacienteByIdSchema.parse(req.params)
			await prisma.paciente.delete({
				where: { id: id },
			})
			return res.status(200).json({
				status: 'sucesso',
				message:
					'Paciente e todo o seu histórico (internações, evoluções) foram apagados.',
			})
		} catch (error: any) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2025'
			) {
				return next(new Error('Paciente não encontrado.'))
			}
			return next(error)
		}
	}
)

export default pacienteRouter
