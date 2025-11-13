// Salve este arquivo como: src/routes/internacao.routes.ts
// (Versão ATUALIZADA - Sem idFamiliar)

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma, StatusInternacao } from '@prisma/client'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middlewares/authMiddleware'
import { sendEmail } from '../services/email.service'

// --- Schemas Zod ---

const createInternacaoSchema = z.object({
	idPaciente: z.number().int().positive(),
	idProfissionalResponsavel: z.number().int().positive().optional().nullable(),
	diagnostico: z.string().optional().nullable(),
	observacoes: z.string().optional().nullable(),
	quarto: z.string().optional().nullable(),
	leito: z.string().optional().nullable(),
})

const getInternacoesSchema = z.object({
	status: z.nativeEnum(StatusInternacao).optional(),
})

const getInternacaoByIdSchema = z.object({
	id: z.coerce.number().int().positive(),
})

const updateInternacaoSchema = z.object({
	// idFamiliar REMOVIDO daqui

	idProfissionalResponsavel: z.number().int().positive().optional().nullable(),
	diagnostico: z.string().optional().nullable(),
	observacoes: z.string().optional().nullable(),
	quarto: z.string().optional().nullable(),
	leito: z.string().optional().nullable(),
})

// --- Roteador ---
const internacaoRouter = Router()

/**
 * Rota: POST /
 * Descrição: Cria uma nova internação (Apenas Profissionais).
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

			const novaInternacao = await prisma.internacao.create({
				data: {
					...validatedData,
					status: 'ATIVA',
				},
			})
			return res.status(201).json(novaInternacao)
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2003') {
					return next(new Error('ID de Paciente ou Profissional inválido.'))
				}
			}
			return next(error)
		}
	}
)

/**
 * Rota: PUT /:id/alta
 * Descrição: Finaliza (dá alta) a uma internação (Apenas Profissionais).
 */
internacaoRouter.put(
	'/:id/alta',
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

			const { id } = getInternacaoByIdSchema.parse(req.params)

			const internacaoFinalizada = await prisma.internacao.update({
				where: { id: id },
				data: {
					status: 'ALTA',
					dataAlta: new Date(),
				},
			})

			// Resposta imediata
			res.status(200).json(internacaoFinalizada)

			// --- (NOVO) GATILHO DE E-MAIL DE ALTA ---
			try {
				const internacao = await prisma.internacao.findUnique({
					where: { id: id },
					include: {
						paciente: { select: { nome: true } },
						associacoes: {
							// Busca todos os familiares aprovados
							where: { status: 'aprovada' },
							include: {
								familiar: { select: { email: true, nome: true } },
							},
						},
					},
				})

				if (internacao && internacao.associacoes.length > 0) {
					const nomePaciente = internacao.paciente.nome

					for (const assoc of internacao.associacoes) {
						if (assoc.familiar && assoc.familiar.email) {
							try {
								await sendEmail({
									to: assoc.familiar.email,
									subject: `[InfoCare] O paciente ${nomePaciente} recebeu alta`,
									html: `Olá, ${assoc.familiar.nome}.<br><br>O paciente <b>${nomePaciente}</b> recebeu alta hospitalar.<br><br>As evoluções diárias não serão mais atualizadas para esta internação.`,
								})
							} catch (loopError: any) {
								console.error(
									`[Email] Falha ao enviar e-mail de alta (loop):`,
									loopError.message
								)
							}
						}
					}
				}
			} catch (emailError: any) {
				console.error(
					'[Email] Falha ao buscar associados para e-mail de alta:',
					emailError.message
				)
			}
			// --- FIM DO NOVO BLOCO ---
		} catch (error: any) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2025'
			) {
				return next(new Error('Internação não encontrada.'))
			}
			return next(error)
		}
	}
)

/**
 * Rota: GET /
 * Descrição: Lista todas as internações (Pública).
 */
internacaoRouter.get(
	'/',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { status } = getInternacoesSchema.parse(req.query)
			const internacoes = await prisma.internacao.findMany({
				where: {
					status: status,
				},
				include: {
					paciente: {
						select: { nome: true, dataNascimento: true },
					},
					// 'familiar: true' REMOVIDO daqui
					profissionalResponsavel: {
						select: { nome: true },
					},
				},
				orderBy: { dataInicio: 'desc' },
			})
			return res.status(200).json(internacoes)
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * Rota: GET /:id
 * Descrição: Busca uma internação específica (Protegida, Lógica de Permissão).
 */
internacaoRouter.get(
	'/:id',
	authMiddleware,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { id: idInternacao } = getInternacaoByIdSchema.parse(req.params)
			const usuarioLogado = req.usuario

			if (!usuarioLogado) {
				return next(new Error('Usuário não autenticado.'))
			}

			// Lógica de Permissão
			if (usuarioLogado.tipo === 'profissional') {
				// Acesso de Profissional (continua)
			} else if (usuarioLogado.tipo === 'familiar') {
				// Lógica de verificação na tabela Associacoes (continua a mesma)
				const idFamiliarLogado = usuarioLogado.sub
				const associacao = await prisma.associacao.findFirst({
					where: {
						idFamiliar: idFamiliarLogado,
						idInternacao: idInternacao,
						status: 'aprovada',
					},
				})

				if (!associacao) {
					const error = new Error(
						'Acesso negado: Você não tem permissão para ver esta internação.'
					)
					;(error as any).statusCode = 403
					return next(error)
				}
			} else {
				return next(new Error('Tipo de usuário desconhecido.'))
			}

			// Lógica de Busca (Se passou nas permissões)
			const internacao = await prisma.internacao.findUnique({
				where: { id: idInternacao },
				include: {
					paciente: true,
					profissionalResponsavel: true,
					evolucoes: {
						orderBy: { dataHora: 'desc' },
						include: {
							profissional: {
								select: { nome: true },
							},
						},
					},
				},
			})

			if (!internacao) {
				const notFoundError = new Error('Internação não encontrada.')
				;(notFoundError as any).statusCode = 404
				return next(notFoundError)
			}
			return res.status(200).json(internacao)
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * Rota: PUT /:id
 * Descrição: Profissional (logado) atualiza os dados de uma Internação.
 */
internacaoRouter.put(
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

			const { id } = getInternacaoByIdSchema.parse(req.params)
			const validatedData = updateInternacaoSchema.parse(req.body) // Zod já está atualizado

			if (Object.keys(validatedData).length === 0) {
				return res.status(400).json({
					status: 'error',
					message: 'Nenhum dado fornecido para atualização.',
				})
			}

			const internacaoAtualizada = await prisma.internacao.update({
				where: { id: id },
				data: validatedData,
			})

			return res.status(200).json(internacaoAtualizada)
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					return next(new Error('Internação não encontrada.'))
				}
				if (error.code === 'P2003') {
					return next(new Error('ID de Profissional inválido.'))
				}
			}
			return next(error)
		}
	}
)

/**
 * Rota: DELETE /:id
 * Descrição: Profissional (logado) APAGA uma Internação.
 */
internacaoRouter.delete(
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

			const { id } = getInternacaoByIdSchema.parse(req.params)

			await prisma.internacao.delete({
				where: { id: id },
			})

			return res.status(200).json({
				status: 'sucesso',
				message: 'Internação (e suas evoluções/associações) foi apagada.',
			})
		} catch (error: any) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2025'
			) {
				return next(new Error('Internação não encontrada.'))
			}
			return next(error)
		}
	}
)

export default internacaoRouter
