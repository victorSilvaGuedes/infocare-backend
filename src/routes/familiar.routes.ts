// Salve este arquivo como: src/routes/familiar.routes.ts
// (Agora com rotas GET e GET /:id, e segurança de senha)

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import bcrypt from 'bcrypt'

// --- SCHEMAS ZOD ---

// Schema para CRIAR um familiar (POST /)
const createFamiliarSchema = z.object({
	nome: z.string().min(3, { message: 'Nome deve ter no mínimo 3 caracteres.' }),
	cpf: z
		.string()
		.length(14, { message: 'CPF deve estar no formato xxx.xxx.xxx-xx' }),
	telefone: z.string().optional(),
	email: z.email({ message: 'Formato de email inválido.' }),
	senha: z
		.string()
		.min(8, { message: 'A senha deve ter no mínimo 8 caracteres.' }),
})

// (NOVO) Schema para BUSCAR um familiar por ID (GET /:id)
const getFamiliarByIdSchema = z.object({
	id: z.coerce
		.number()
		.int()
		.positive({ message: 'ID deve ser um número positivo.' }),
})

// (NOVO) Objeto de 'select' reutilizável para NUNCA retornar a senha
const familiarSelect = {
	id: true,
	nome: true,
	cpf: true,
	email: true,
	telefone: true,
	// O campo 'senha' é omitido propositalmente
}

// --- CRIAÇÃO DO ROTEADOR ---
const familiarRouter = Router()

// --- ROTAS ---

/**
 * Rota: POST /
 * Descrição: Regista (cadastra) um novo familiar.
 */
familiarRouter.post(
	'/',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 1. Validar o body com Zod
			const validatedData = createFamiliarSchema.parse(req.body)

			// 2. Hashear a senha
			const senhaHash = await bcrypt.hash(validatedData.senha, 10)

			// 3. Lógica de Banco (Criar)
			const familiar = await prisma.familiar.create({
				data: {
					...validatedData,
					senha: senhaHash, // Salvamos o hash
				},
				// 4. Remover a senha da resposta
				select: familiarSelect, // Usamos o 'select'
			})

			// 5. Resposta de Sucesso
			return res.status(201).json(familiar)
		} catch (error: any) {
			// 6. Tratamento de Erro (Email/CPF duplicado)
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2002') {
					if (error.meta?.target === 'Familiares_cpf_key') {
						return next(
							new Error('Já existe um familiar cadastrado com este CPF.')
						)
					}
					if (error.meta?.target === 'Familiares_email_key') {
						return next(
							new Error('Já existe um familiar cadastrado com este Email.')
						)
					}
				}
			}
			return next(error)
		}
	}
)

/**
 * (NOVA ROTA)
 * Rota: GET /
 * Descrição: Lista todos os familiares.
 */
familiarRouter.get(
	'/',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 1. Lógica de Banco (Buscar Todos)
			const familiares = await prisma.familiar.findMany({
				select: familiarSelect, // IMPORTANTE: Usamos o 'select' para excluir senhas
			})

			// 2. Resposta
			return res.status(200).json(familiares)
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * (NOVA ROTA)
 * Rota: GET /:id
 * Descrição: Busca um familiar específico pelo seu ID.
 */
familiarRouter.get(
	'/:id',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 1. Validar os parâmetros da URL (req.params)
			const { id } = getFamiliarByIdSchema.parse(req.params)

			// 2. Lógica de Banco (Buscar Um)
			const familiar = await prisma.familiar.findUnique({
				where: { id: id },
				select: familiarSelect, // IMPORTANTE: Usamos o 'select' para excluir a senha
			})

			// 3. Tratamento de "Não Encontrado"
			if (!familiar) {
				const notFoundError = new Error('Familiar não encontrado.')
				;(notFoundError as any).statusCode = 404
				return next(notFoundError)
			}

			// 4. Resposta
			return res.status(200).json(familiar)
		} catch (error: any) {
			// 5. Tratamento de Erro (ID inválido do Zod, etc.)
			return next(error)
		}
	}
)

export default familiarRouter
