// Salve este arquivo como: src/routes/familiar.routes.ts
// (Versão COMPLETA E ATUALIZADA)

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
// 1. (ATUALIZADO) Importar 'Prisma' e 'StatusAssociacao'
import { Prisma, StatusAssociacao } from '@prisma/client'
import prisma from '../lib/prisma'
import { hash, compare } from 'bcrypt'
import jwt from 'jsonwebtoken'
import { authMiddleware } from '../middlewares/authMiddleware'
import { sendEmail } from '../services/email.service'

// --- Schemas Zod ---
const createFamiliarSchema = z.object({
	nome: z.string().min(3),
	cpf: z.string().length(14),
	email: z.string().email(),
	senha: z.string().min(6),
	telefone: z.string().optional(),
})

const loginFamiliarSchema = z.object({
	email: z.string().email(),
	senha: z.string(),
})

const updateFamiliarSchema = z.object({
	nome: z.string().min(3).optional(),
	email: z.string().email().optional(),
	telefone: z.string().optional().or(z.literal('')),
})

const getFamiliarByIdSchema = z.object({
	id: z.coerce.number().int().positive(),
})

// 2. (NOVO) Schema para o filtro de status (usando o enum importado)
const getMinhasAssociacoesSchema = z.object({
	status: z.nativeEnum(StatusAssociacao).optional(), // <-- Corrigido
})

// 3. (NOVO) Schema para a nova rota de detalhes
const getAssociacaoByIdSchema = z.object({
	id: z.coerce.number().int().positive(),
})

// --- Select (para não expor a senha) ---
const familiarSelect = {
	id: true,
	nome: true,
	cpf: true,
	email: true,
	telefone: true,
}

// --- Roteador ---
const familiarRouter = Router()

/**
 * Rota: POST /
 * Descrição: Regista um novo familiar.
 */
// (código da rota POST /... sem alteração)
familiarRouter.post(
	'/',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const validatedData = createFamiliarSchema.parse(req.body)
			const senhaHash = await hash(validatedData.senha, 10)

			const familiar = await prisma.familiar.create({
				data: {
					...validatedData,
					senha: senhaHash,
				},
				select: familiarSelect,
			})

			try {
				await sendEmail({
					to: familiar.email,
					subject: '[InfoCare] Bem-vindo(a) à InfoCare!',
					html: `Olá, ${familiar.nome}.<br><br>Sua conta foi criada com sucesso no aplicativo InfoCare.<br><br>O próximo passo é fazer login no aplicativo e solicitar a associação a uma internação para começar a receber as atualizações.`,
				})
			} catch (emailError: any) {
				console.error(
					`[Email] Falha ao enviar e-mail de boas-vindas para ${familiar.email}:`,
					emailError.message
				)
			}

			return res.status(201).json(familiar)
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2002') {
					return next(new Error('Já existe um usuário com este CPF ou E-mail.'))
				}
			}
			return next(error)
		}
	}
)

/**
 * Rota: POST /login
 * Descrição: Autentica um familiar.
 */
// (código da rota POST /login... sem alteração)
familiarRouter.post(
	'/login',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { email, senha } = loginFamiliarSchema.parse(req.body)
			const familiar = await prisma.familiar.findUnique({
				where: { email },
			})

			if (!familiar) {
				throw new Error('Credenciais inválidas.')
			}

			const senhaValida = await compare(senha, familiar.senha)
			if (!senhaValida) {
				throw new Error('Credenciais inválidas.')
			}

			const token = jwt.sign(
				{ sub: familiar.id, tipo: 'familiar' },
				process.env.JWT_SECRET as string,
				{ expiresIn: '7d' }
			)

			return res.status(200).json({
				message: 'Login bem-sucedido!',
				token: token,
				usuario: {
					id: familiar.id,
					nome: familiar.nome,
					email: familiar.email,
					tipo: 'familiar',
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
 * Descrição: Retorna o perfil do familiar logado.
 */
// (código da rota GET /me... sem alteração)
familiarRouter.get(
	'/me',
	authMiddleware,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (req.usuario?.tipo !== 'familiar') {
				const error = new Error('Acesso negado: Rota apenas para familiares.')
				;(error as any).statusCode = 403
				return next(error)
			}

			const familiarId = req.usuario.sub
			const familiar = await prisma.familiar.findUnique({
				where: { id: familiarId },
				select: familiarSelect,
			})

			if (!familiar) {
				const error = new Error('Familiar não encontrado.')
				;(error as any).statusCode = 404
				return next(error)
			}
			return res.status(200).json(familiar)
		} catch (error: any) {
			return next(error)
		}
	}
)

// ==========================================================
// --- (INÍCIO DAS NOVAS ROTAS / ROTAS ATUALIZADAS) ---
// ==========================================================

/**
 * Rota: GET /me/associacoes
 * Descrição: Retorna todas as associações (solicitações) do familiar logado.
 * (ATUALIZADA para incluir o status da internação)
 */
familiarRouter.get(
	'/me/associacoes',
	authMiddleware,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (req.usuario?.tipo !== 'familiar') {
				const error = new Error('Acesso negado: Rota apenas para familiares.')
				;(error as any).statusCode = 403
				return next(error)
			}

			const idFamiliarLogado = req.usuario.sub
			const { status } = getMinhasAssociacoesSchema.parse(req.query)

			const where: Prisma.AssociacaoWhereInput = {
				idFamiliar: idFamiliarLogado,
			}
			if (status) {
				where.status = status
			}

			const associacoes = await prisma.associacao.findMany({
				where: where,
				include: {
					internacao: {
						select: {
							id: true,
							diagnostico: true,
							dataInicio: true,
							status: true, // <-- (ATUALIZADO) Adicionado para a badge
							paciente: { select: { nome: true } },
						},
					},
				},
				orderBy: {
					dataSolicitacao: 'desc',
				},
			})

			return res.status(200).json(associacoes)
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * Rota: GET /me/associacoes/:id
 * Descrição: Retorna UMA associação (e os detalhes da internação)
 * (NOVA ROTA)
 */
familiarRouter.get(
	'/me/associacoes/:id',
	authMiddleware,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (req.usuario?.tipo !== 'familiar') {
				const error = new Error('Acesso negado: Rota apenas para familiares.')
				;(error as any).statusCode = 403
				return next(error)
			}
			const idFamiliarLogado = req.usuario.sub
			const { id } = getAssociacaoByIdSchema.parse(req.params)

			const associacao = await prisma.associacao.findUnique({
				where: {
					id: id,
					idFamiliar: idFamiliarLogado, // Garante que o familiar só veja a sua
				},
				include: {
					internacao: {
						include: {
							paciente: true,
							profissionalResponsavel: { select: { nome: true } },
							// Inclui as evoluções para a página de detalhes
							evolucoes: {
								orderBy: { dataHora: 'desc' },
								include: {
									profissional: { select: { nome: true } },
								},
							},
						},
					},
				},
			})

			if (!associacao) {
				const error = new Error('Associação não encontrada.')
				;(error as any).statusCode = 404
				return next(error)
			}

			// Regra de Segurança: O familiar só pode ver os detalhes
			// de uma associação que foi APROVADA.
			if (associacao.status !== 'aprovada') {
				const error = new Error(
					'Acesso negado. A associação não está aprovada.'
				)
				;(error as any).statusCode = 403
				return next(error)
			}

			return res.status(200).json(associacao)
		} catch (error: any) {
			return next(error)
		}
	}
)

// ==========================================================
// --- (FIM DAS NOVAS ROTAS / ROTAS ATUALIZADAS) ---
// ==========================================================

/**
 * Rota: PUT /me
 * Descrição: Familiar (logado) atualiza os seus PRÓPRIOS dados.
 */
// (código da rota PUT /me... sem alteração)
familiarRouter.put(
	'/me',
	authMiddleware,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (req.usuario?.tipo !== 'familiar') {
				const error = new Error('Acesso negado: Rota apenas para familiares.')
				;(error as any).statusCode = 403
				return next(error)
			}
			const idFamiliarLogado = req.usuario.sub
			const validatedData = updateFamiliarSchema.parse(req.body)

			if (Object.keys(validatedData).length === 0) {
				return res.status(400).json({
					status: 'error',
					message: 'Nenhum dado fornecido para atualização.',
				})
			}

			const familiarAtualizado = await prisma.familiar.update({
				where: { id: idFamiliarLogado },
				data: validatedData,
				select: familiarSelect,
			})

			return res.status(200).json(familiarAtualizado)
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * Rota: DELETE /me
 * Descrição: Familiar (logado) APAGA a sua própria conta.
 */
// (código da rota DELETE /me... sem alteração)
familiarRouter.delete(
	'/me',
	authMiddleware,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (req.usuario?.tipo !== 'familiar') {
				const error = new Error('Acesso negado: Rota apenas para familiares.')
				;(error as any).statusCode = 403
				return next(error)
			}
			const idFamiliarLogado = req.usuario.sub

			await prisma.familiar.delete({
				where: { id: idFamiliarLogado },
			})

			return res.status(200).json({
				status: 'sucesso',
				message: 'Conta de familiar apagada.',
			})
		} catch (error: any) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2025'
			) {
				return next(new Error('Conta de familiar não encontrada.'))
			}
			return next(error)
		}
	}
)

/**
 * Rota: GET /
 * Descrição: Lista todos os familiares (Apenas para Profissionais).
 */
// (código da rota GET /... sem alteração)
familiarRouter.get(
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
 * Descrição: Busca um familiar específico (Apenas para Profissionais).
 */
// (código da rota GET /:id... sem alteração)
familiarRouter.get(
	'/:id',
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

			const { id } = getFamiliarByIdSchema.parse(req.params)
			const familiar = await prisma.familiar.findUnique({
				where: { id },
				select: familiarSelect,
			})

			if (!familiar) {
				const error = new Error('Familiar não encontrado.')
				;(error as any).statusCode = 404
				return next(error)
			}
			return res.status(200).json(familiar)
		} catch (error: any) {
			return next(error)
		}
	}
)

export default familiarRouter
