// Salve este arquivo como: src/routes/familiar.routes.ts
// (Versão completa com Registo, Login, GETs, e a rota /me)

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { authMiddleware } from '../middlewares/authMiddleware' // Importamos o middleware

// --- SCHEMAS ZOD ---

// Schema para CRIAR um familiar (POST /)
const createFamiliarSchema = z.object({
	nome: z.string().min(3, { message: 'Nome deve ter no mínimo 3 caracteres.' }),
	cpf: z
		.string()
		.length(14, { message: 'CPF deve estar no formato xxx.xxx.xxx-xx' }),
	email: z.email({ message: 'Formato de email inválido.' }),
	senha: z
		.string()
		.min(8, { message: 'A senha deve ter no mínimo 8 caracteres.' }),
	// Validação para o formato E.164 (Twilio)
	telefone: z
		.string()
		.regex(/^\+\d{1,3}\d{10,14}$/, {
			message:
				'Telefone deve estar no formato internacional (E.164), ex: +5516999998888',
		})
		.optional(),
})

// Schema para BUSCAR um familiar por ID (GET /:id)
const getFamiliarByIdSchema = z.object({
	id: z.coerce
		.number()
		.int()
		.positive({ message: 'ID deve ser um número positivo.' }),
})

// Schema para LOGIN
const loginSchema = z.object({
	email: z.email({ message: 'Email inválido.' }),
	senha: z.string().min(1, { message: 'Senha é obrigatória.' }),
})

// Objeto de 'select' reutilizável para NUNCA retornar a senha
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
			const validatedData = createFamiliarSchema.parse(req.body)
			const senhaHash = await bcrypt.hash(validatedData.senha, 10)
			const familiar = await prisma.familiar.create({
				data: {
					...validatedData,
					senha: senhaHash,
				},
				select: familiarSelect,
			})
			return res.status(201).json(familiar)
		} catch (error: any) {
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
 * Rota: POST /login
 * Descrição: Autentica (loga) um familiar.
 */
familiarRouter.post(
	'/login',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { email, senha } = loginSchema.parse(req.body)
			const familiar = await prisma.familiar.findUnique({
				where: { email: email },
			})

			if (!familiar) {
				throw new Error('Credenciais inválidas.')
			}
			const senhaCorreta = await bcrypt.compare(senha, familiar.senha)
			if (!senhaCorreta) {
				throw new Error('Credenciais inválidas.')
			}
			const jwtSecret = process.env.JWT_SECRET
			if (!jwtSecret) {
				throw new Error('Segredo JWT não configurado no servidor.')
			}
			const token = jwt.sign(
				{
					sub: familiar.id,
					tipo: 'familiar',
				},
				jwtSecret,
				{
					expiresIn: '1d',
				}
			)
			return res.status(200).json({
				message: 'Login bem-sucedido!',
				token: token,
				usuario: {
					id: familiar.id,
					nome: familiar.nome,
					email: familiar.email,
				},
			})
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * (ROTA PROTEGIDA)
 * Rota: GET /me
 * Descrição: Busca os dados do familiar LOGADO (para validar o token/sessão).
 */
familiarRouter.get(
	'/me', // <-- Rota renomeada de /perfil para /me
	authMiddleware, // O middleware de autenticação
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// Graças ao authMiddleware, 'req.usuario' existe
			if (!req.usuario) {
				throw new Error('Usuário não autenticado.')
			}
			const idDoFamiliarLogado = req.usuario.sub

			// Verificamos se o tipo de usuário no token é 'familiar'
			if (req.usuario.tipo !== 'familiar') {
				const error = new Error('Acesso negado: Rota apenas para familiares.')
				;(error as any).statusCode = 403 // 403 Forbidden
				return next(error)
			}

			// Lógica de Banco (Buscar o perfil)
			const familiar = await prisma.familiar.findUnique({
				where: { id: idDoFamiliarLogado },
				select: familiarSelect, // Usamos o select seguro (sem senha)
			})

			if (!familiar) {
				const error = new Error('Familiar não encontrado.')
				;(error as any).statusCode = 404
				return next(error)
			}

			// Resposta de Sucesso
			return res.status(200).json(familiar)
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * Rota: GET /
 * Descrição: Lista todos os familiares.
 */
familiarRouter.get(
	'/',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const familiares = await prisma.familiar.findMany({
				select: familiarSelect,
			})
			return res.status(200).json(familiares)
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * Rota: GET /:id
 * Descrição: Busca um familiar específico pelo seu ID.
 */
familiarRouter.get(
	'/:id',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { id } = getFamiliarByIdSchema.parse(req.params)
			const familiar = await prisma.familiar.findUnique({
				where: { id: id },
				select: familiarSelect,
			})

			if (!familiar) {
				const notFoundError = new Error('Familiar não encontrado.')
				;(notFoundError as any).statusCode = 404
				return next(notFoundError)
			}
			return res.status(200).json(familiar)
		} catch (error: any) {
			return next(error)
		}
	}
)

export default familiarRouter
