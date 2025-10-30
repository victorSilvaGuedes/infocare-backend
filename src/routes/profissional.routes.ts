// Salve este arquivo como: src/routes/profissional.routes.ts

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma, TipoProfissional } from '@prisma/client' // Importamos o Enum
import prisma from '../lib/prisma'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { authMiddleware } from '../middlewares/authMiddleware'

// --- SCHEMAS ZOD ---

// Schema para CRIAR um Profissional (POST /)
const createProfissionalSchema = z.object({
	nome: z.string().min(3, { message: 'Nome deve ter no mínimo 3 caracteres.' }),
	cpf: z
		.string()
		.length(14, { message: 'CPF deve estar no formato xxx.xxx.xxx-xx' }),
	email: z.email({ message: 'Formato de email inválido.' }),
	senha: z
		.string()
		.min(8, { message: 'A senha deve ter no mínimo 8 caracteres.' }),

	// Campos específicos de Profissional
	telefone: z.string().optional(),
	crm: z.string().optional(),
	coren: z.string().optional(),
	especialidade: z.string().optional(),
	tipo: z.nativeEnum(TipoProfissional).default(TipoProfissional.OUTRO), // Valida contra o Enum
})

// Schema para LOGIN (Idêntico ao do Familiar)
const loginSchema = z.object({
	email: z.email({ message: 'Email inválido.' }),
	senha: z.string().min(1, { message: 'Senha é obrigatória.' }),
})

// Select de Segurança (para não retornar a senha)
const profissionalSelect = {
	id: true,
	nome: true,
	cpf: true,
	email: true,
	telefone: true,
	crm: true,
	coren: true,
	especialidade: true,
	tipo: true,
}

// --- CRIAÇÃO DO ROTEADOR ---
const profissionalRouter = Router()

// --- ROTAS ---

/**
 * Rota: POST /
 * Descrição: Regista (cadastra) um novo Profissional de Saúde.
 */
profissionalRouter.post(
	'/',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const validatedData = createProfissionalSchema.parse(req.body)

			// Hashear a senha
			const senhaHash = await bcrypt.hash(validatedData.senha, 10)

			const profissional = await prisma.profissionalSaude.create({
				data: {
					...validatedData,
					senha: senhaHash, // Salva o hash
				},
				select: profissionalSelect, // Não retorna a senha
			})

			return res.status(201).json(profissional)
		} catch (error: any) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002'
			) {
				// Trata erros de campo único (CPF, Email, CRM, Coren)
				return next(
					new Error(
						`Já existe um registo com este valor. (Campos: ${error.meta?.target})`
					)
				)
			}
			return next(error)
		}
	}
)

/**
 * Rota: POST /login
 * Descrição: Autentica (loga) um Profissional de Saúde.
 */
profissionalRouter.post(
	'/login',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { email, senha } = loginSchema.parse(req.body)

			// Busca o profissional no banco
			const profissional = await prisma.profissionalSaude.findUnique({
				where: { email: email },
			})

			// 1. Verifica se existe
			if (!profissional) {
				throw new Error('Credenciais inválidas.')
			}

			// 2. Compara a senha
			const senhaCorreta = await bcrypt.compare(senha, profissional.senha)
			if (!senhaCorreta) {
				throw new Error('Credenciais inválidas.')
			}

			// 3. Gera o Token JWT
			const jwtSecret = process.env.JWT_SECRET
			if (!jwtSecret) {
				throw new Error('Segredo JWT não configurado no servidor.')
			}

			const token = jwt.sign(
				{
					sub: profissional.id,
					tipo: 'profissional', // IMPORTANTE: O tipo agora é 'profissional'
				},
				jwtSecret,
				{
					expiresIn: '1d',
				}
			)

			// 4. Resposta de sucesso
			return res.status(200).json({
				message: 'Login bem-sucedido!',
				token: token,
				usuario: {
					id: profissional.id,
					nome: profissional.nome,
					email: profissional.email,
					tipo: profissional.tipo,
				},
			})
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * Rota: GET /me
 * Descrição: Busca os dados do Profissional LOGADO (para validar o token/sessão).
 */
profissionalRouter.get(
	'/me',
	authMiddleware,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.usuario) {
				throw new Error('Usuário não autenticado.')
			}

			// Verificação de tipo (Autorização)
			if (req.usuario.tipo !== 'profissional') {
				const error = new Error(
					'Acesso negado: Rota apenas para profissionais.'
				)
				;(error as any).statusCode = 403
				return next(error)
			}

			const idDoProfissional = req.usuario.sub

			const profissional = await prisma.profissionalSaude.findUnique({
				where: { id: idDoProfissional },
				select: profissionalSelect, // Usa o select seguro
			})

			if (!profissional) {
				const error = new Error('Profissional não encontrado.')
				;(error as any).statusCode = 404
				return next(error)
			}

			return res.status(200).json(profissional)
		} catch (error: any) {
			return next(error)
		}
	}
)

export default profissionalRouter
