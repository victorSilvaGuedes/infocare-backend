// Salve este arquivo como: src/routes/profissional.routes.ts
// (Versão ATUALIZADA - Sem 'especialidade')

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { hash, compare } from 'bcrypt'
import jwt from 'jsonwebtoken'
import { authMiddleware } from '../middlewares/authMiddleware'

// --- Schemas Zod ---

const createProfissionalSchema = z.object({
	nome: z.string().min(3),
	cpf: z.string().length(14),
	email: z.string().email(),
	senha: z.string().min(6),

	tipo: z.enum([
		'MEDICO',
		'ENFERMEIRO',
		'TECNICO_ENFERMAGEM',
		'FISIOTERAPEUTA',
		'NUTRICIONISTA',
		'PSICOLOGO',
		'OUTRO',
	]),

	crm: z.string().optional(),
	coren: z.string().optional(),
	// O campo 'especialidade' foi REMOVIDO daqui
})

const loginProfissionalSchema = z.object({
	email: z.string().email(),
	senha: z.string(),
})

const updateProfissionalSchema = z.object({
	nome: z.string().min(3).optional(),
	email: z.email().optional(),
	telefone: z.string().optional().or(z.literal('')),
	// O campo 'especialidade' foi REMOVIDO daqui
})

// --- Select (para não expor a senha) ---
const profissionalSelect = {
	id: true,
	nome: true,
	cpf: true,
	email: true,
	telefone: true,
	crm: true,
	coren: true,
	tipo: true,
	// O campo 'especialidade' foi REMOVIDO daqui
}

// --- Roteador ---
const profissionalRouter = Router()

/**
 * Rota: POST /
 * Descrição: Regista um novo profissional.
 */
profissionalRouter.post(
	'/',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const validatedData = createProfissionalSchema.parse(req.body)
			const senhaHash = await hash(validatedData.senha, 10)
			const profissional = await prisma.profissionalSaude.create({
				data: {
					...validatedData,
					senha: senhaHash,
				},
				select: profissionalSelect,
			})
			return res.status(201).json(profissional)
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2002') {
					return next(
						new Error(
							'Já existe um usuário com este CPF, E-mail, CRM ou Coren.'
						)
					)
				}
			}
			return next(error)
		}
	}
)

/**
 * Rota: POST /login
 * Descrição: Autentica um profissional.
 */
profissionalRouter.post(
	'/login',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { email, senha } = loginProfissionalSchema.parse(req.body)
			const profissional = await prisma.profissionalSaude.findUnique({
				where: { email },
			})

			if (!profissional) {
				throw new Error('Credenciais inválidas.')
			}

			const senhaValida = await compare(senha, profissional.senha)
			if (!senhaValida) {
				throw new Error('Credenciais inválidas.')
			}

			const token = jwt.sign(
				{ sub: profissional.id, tipo: 'profissional' },
				process.env.JWT_SECRET as string,
				{ expiresIn: '7d' }
			)

			return res.status(200).json({
				message: 'Login bem-sucedido!',
				token: token,
				usuario: {
					id: profissional.id,
					nome: profissional.nome,
					email: profissional.email,
					tipo: 'profissional',
				},
			})
		} catch (error: any) {
			error.statusCode = 401
			return next(error)
		}
	}
)

/**
 * Rota: GET /me
 * Descrição: Retorna o perfil do profissional logado.
 */
profissionalRouter.get(
	'/me',
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

			const profissionalId = req.usuario.sub
			const profissional = await prisma.profissionalSaude.findUnique({
				where: { id: profissionalId },
				select: profissionalSelect,
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

/**
 * Rota: PUT /me
 * Descrição: Profissional (logado) atualiza os seus PRÓPRIOS dados.
 */
profissionalRouter.put(
	'/me',
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
			const idProfissionalLogado = req.usuario.sub
			const validatedData = updateProfissionalSchema.parse(req.body)

			if (Object.keys(validatedData).length === 0) {
				return res.status(400).json({
					status: 'error',
					message: 'Nenhum dado fornecido para atualização.',
				})
			}

			const profissionalAtualizado = await prisma.profissionalSaude.update({
				where: { id: idProfissionalLogado },
				data: validatedData,
				select: profissionalSelect,
			})

			return res.status(200).json(profissionalAtualizado)
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * Rota: DELETE /me
 * Descrição: Profissional (logado) APAGA a sua própria conta.
 */
profissionalRouter.delete(
	'/me',
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
			const idProfissionalLogado = req.usuario.sub

			await prisma.profissionalSaude.delete({
				where: { id: idProfissionalLogado },
			})

			return res.status(200).json({
				status: 'sucesso',
				message: 'Conta de profissional apagada.',
			})
		} catch (error: any) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2025'
			) {
				return next(new Error('Conta de profissional não encontrada.'))
			}
			return next(error)
		}
	}
)

export default profissionalRouter
