import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

// Schema para CRIAR um paciente (POST /)
const createPacienteSchema = z.object({
	nome: z
		.string()
		// Apenas customizamos o refinamento .min(), que sabemos que funciona
		.min(3, { message: 'Nome deve ter no mínimo 3 caracteres.' }),

	cpf: z
		.string()
		.length(14, { message: 'CPF deve estar no formato xxx.xxx.xxx-xx' }),

	telefone: z.string().optional(),

	dataNascimento: z.coerce.date(), // Deixamos a mensagem padrão

	tipoSanguineo: z.string().optional(),
})

// Schema para BUSCAR um paciente por ID (GET /:id)
const getPacienteByIdSchema = z.object({
	// Deixamos a mensagem padrão
	id: z.coerce
		.number()
		.int({ message: 'ID deve ser um número inteiro.' })
		.positive({ message: 'ID deve ser um número positivo.' }),
})

// --- CRIAÇÃO DO ROTEADOR ---
const pacienteRouter = Router()

// --- ROTAS ---

/**
 * Rota: POST /
 * Descrição: Cadastra um novo paciente.
 */
pacienteRouter.post(
	'/',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 1. Validar o body
			const validatedData = createPacienteSchema.parse(req.body)

			// 2. Lógica de Banco (Criar)
			const paciente = await prisma.paciente.create({
				data: {
					...validatedData,
				},
			})

			// 3. Resposta
			return res.status(201).json(paciente)
		} catch (error: any) {
			// 4. Tratamento de Erro (CPF duplicado)
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
			// Envia outros erros (Zod, etc.) para o errorHandler
			return next(error)
		}
	}
)

/**
 * Rota: GET /
 * Descrição: Lista todos os pacientes cadastrados.
 */
pacienteRouter.get(
	'/',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 1. Lógica de Banco (Buscar Todos)
			const pacientes = await prisma.paciente.findMany()

			// 2. Resposta
			return res.status(200).json(pacientes)
		} catch (error: any) {
			// 3. Tratamento de Erro
			return next(error)
		}
	}
)

/**
 * Rota: GET /:id
 * Descrição: Busca um paciente específico pelo seu ID.
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
	}
)

export default pacienteRouter
