// Atualize este arquivo: src/routes/paciente.routes.ts

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middlewares/authMiddleware' // 1. IMPORTAMOS O MIDDLEWARE

// --- SCHEMAS ZOD (Existentes) ---

const createPacienteSchema = z.object({
	nome: z.string().min(3, { message: 'Nome deve ter no mínimo 3 caracteres.' }),
	cpf: z
		.string()
		.length(14, { message: 'CPF deve estar no formato xxx.xxx.xxx-xx' }),
	telefone: z.string().optional(),
	dataNascimento: z.coerce.date(),
	tipoSanguineo: z.string().optional(),
})

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
 * Descrição: Cadastra um novo paciente.
 * (AGORA PROTEGIDA: Apenas para Profissionais)
 */
pacienteRouter.post(
	'/',
	authMiddleware, // 2. ADICIONAMOS O MIDDLEWARE
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 3. Verificamos a Autorização (Permissão)
			if (req.usuario?.tipo !== 'profissional') {
				const error = new Error(
					'Acesso negado: Rota apenas para profissionais.'
				)
				;(error as any).statusCode = 403
				return next(error)
			}

			// 4. Se passou, o resto da lógica continua igual
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
 * Descrição: Lista todos os pacientes cadastrados.
 * (Continua pública por enquanto)
 */
pacienteRouter.get(
	'/',
	async (req: Request, res: Response, next: NextFunction) => {
		// --- CÓDIGO QUE FALTAVA ---
		try {
			// 1. Lógica de Banco (Buscar Todos)
			const pacientes = await prisma.paciente.findMany()

			// 2. Resposta
			return res.status(200).json(pacientes)
		} catch (error: any) {
			// 3. Tratamento de Erro
			return next(error)
		}
		// --- FIM DO CÓDIGO ---
	}
)

/**
 * Rota: GET /:id
 * Descrição: Busca um paciente específico pelo seu ID.
 * (Continua pública por enquanto)
 */
pacienteRouter.get(
	'/:id',
	async (req: Request, res: Response, next: NextFunction) => {
		// --- CÓDIGO QUE FALTAVA ---
		try {
			// 1. Validar os parâmetros da URL (req.params)
			const { id } = getPacienteByIdSchema.parse(req.params)

			// 2. Lógica de Banco (Buscar Um)
			const paciente = await prisma.paciente.findUnique({
				where: {
					id: id,
				},
			})

			// 3. Tratamento de "Não Encontrado"
			if (!paciente) {
				const notFoundError = new Error('Paciente não encontrado.')
				;(notFoundError as any).statusCode = 404
				return next(notFoundError)
			}

			// 4. Resposta
			return res.status(200).json(paciente)
		} catch (error: any) {
			// 5. Tratamento de Erro (ID inválido do Zod, etc.)
			return next(error)
		}
		// --- FIM DO CÓDIGO ---
	}
)

export default pacienteRouter
