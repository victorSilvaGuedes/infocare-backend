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

/**
 * (NOVA ROTA)
 * Rota: PUT /:id
 * Descrição: Profissional (logado) atualiza os dados de um Paciente.
 * (PROTEGIDA: Apenas para Profissionais)
 */
pacienteRouter.put(
	'/:id',
	authMiddleware, // 1. Protegemos a rota
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

			// 3. Validamos o ID do Paciente (da URL)
			const { id } = getPacienteByIdSchema.parse(req.params)

			// 4. Validamos os dados do body
			const validatedData = updatePacienteSchema.parse(req.body)

			// 5. Garantimos que não enviou um body vazio
			if (Object.keys(validatedData).length === 0) {
				return res.status(400).json({
					status: 'error',
					message: 'Nenhum dado fornecido para atualização.',
				})
			}

			// 6. Lógica de Banco (Atualizar)
			const pacienteAtualizado = await prisma.paciente.update({
				where: { id: id },
				data: validatedData,
			})

			// 7. Resposta
			return res.status(200).json(pacienteAtualizado)
		} catch (error: any) {
			// P2025: Paciente não encontrado com o ID
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2025'
			) {
				return next(new Error('Paciente não encontrado.'))
			}
			// P2002: CPF duplicado
			return next(error)
		}
	}
)

/**
 * (NOVA ROTA)
 * Rota: DELETE /:id
 * Descrição: Profissional (logado) APAGA um Paciente.
 * (PROTEGIDA: Apenas para Profissionais)
 * (PERIGO: Esta ação é EM CASCATA)
 */
pacienteRouter.delete(
	'/:id',
	authMiddleware, // 1. Protegemos a rota
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

			// 3. Validamos o ID do Paciente (da URL)
			const { id } = getPacienteByIdSchema.parse(req.params)

			// 4. Lógica de Banco (Apagar)
			await prisma.paciente.delete({
				where: { id: id },
			})

			// 5. Resposta (200 OK é comum, 204 No Content também)
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
