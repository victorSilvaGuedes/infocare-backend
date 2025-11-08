// Salve este arquivo como: src/routes/associacao.routes.ts
// (Versão ATUALIZADA - Com nome do Paciente nos e-mails)

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma, StatusAssociacao } from '@prisma/client'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middlewares/authMiddleware'
import { sendEmail } from '../services/email.service' // Importa o serviço de e-mail

// --- SCHEMAS ZOD ---

const createAssociacaoSchema = z.object({
	idInternacao: z
		.number()
		.int()
		.positive({ message: 'ID da Internação é obrigatório.' }),
})

const getAssociacoesSchema = z.object({
	status: z.nativeEnum(StatusAssociacao).optional(),
})

const getAssociacaoByIdSchema = z.object({
	id: z.coerce.number().int().positive(),
})

// --- CRIAÇÃO DO ROTEADOR ---
const associacaoRouter = Router()

// --- ROTAS ---

/**
 * Rota: POST /
 * Descrição: Familiar (logado) solicita associação com uma internação.
 */
associacaoRouter.post(
	'/',
	authMiddleware,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (req.usuario?.tipo !== 'familiar') {
				const error = new Error('Acesso negado: Rota apenas para familiares.')
				;(error as any).statusCode = 403
				return next(error)
			}

			const idFamiliarLogado = req.usuario.sub
			const { idInternacao } = createAssociacaoSchema.parse(req.body)

			const jaExiste = await prisma.associacao.findFirst({
				where: {
					idFamiliar: idFamiliarLogado,
					idInternacao: idInternacao,
				},
			})

			if (jaExiste) {
				return next(
					new Error(
						`Você já enviou uma solicitação para esta internação (Status: ${jaExiste.status}).`
					)
				)
			}

			const novaAssociacao = await prisma.associacao.create({
				data: {
					idFamiliar: idFamiliarLogado,
					idInternacao: idInternacao,
					status: 'pendente',
				},
			})

			// Resposta imediata para o usuário
			res.status(201).json(novaAssociacao)

			// (NOVO) Enviar e-mail (com nome do paciente)
			try {
				const familiar = await prisma.familiar.findUnique({
					where: { id: idFamiliarLogado },
					select: { email: true, nome: true },
				})

				// (NOVO) Busca a internação para pegar o nome do paciente
				const internacao = await prisma.internacao.findUnique({
					where: { id: idInternacao },
					include: { paciente: { select: { nome: true } } },
				})

				const nomePaciente = internacao?.paciente?.nome || 'paciente'

				if (familiar && familiar.email) {
					sendEmail({
						to: familiar.email,
						subject: `[InfoCare] Solicitação de acesso para ${nomePaciente}`,
						html: `Olá, ${familiar.nome}.<br>Sua solicitação de acesso à internação do paciente <b>${nomePaciente}</b> foi registrada e está <b>pendente</b> de aprovação.`,
					})
				}
			} catch (emailError: any) {
				console.error(
					'[Email] Falha ao enviar e-mail de solicitação:',
					emailError.message
				)
			}
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2003') {
					return next(
						new Error('Internação não encontrada com o ID fornecido.')
					)
				}
			}
			return next(error)
		}
	}
)

/**
 * Rota: GET /
 * Descrição: Lista todas as solicitações de associação (Apenas Profissionais).
 */
associacaoRouter.get(
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

			const { status } = getAssociacoesSchema.parse(req.query)

			const associacoes = await prisma.associacao.findMany({
				where: {
					status: status,
				},
				include: {
					familiar: {
						select: { id: true, nome: true, email: true },
					},
					internacao: {
						select: {
							id: true,
							paciente: { select: { nome: true } },
						},
					},
				},
				orderBy: {
					dataSolicitacao: 'asc',
				},
			})

			return res.status(200).json(associacoes)
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * Rota: PUT /:id/aprovar
 * Descrição: Profissional (logado) APROVA uma solicitação.
 */
associacaoRouter.put(
	'/:id/aprovar',
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

			const { id } = getAssociacaoByIdSchema.parse(req.params)

			const associacaoAprovada = await prisma.associacao.update({
				where: { id: id },
				data: {
					status: 'aprovada',
				},
			})

			// Resposta imediata
			res.status(200).json(associacaoAprovada)

			// (NOVO) Enviar e-mail (com nome do paciente)
			try {
				const associacao = await prisma.associacao.findUnique({
					where: { id: id },
					include: {
						familiar: { select: { email: true, nome: true } },
						internacao: {
							// (NOVO) Inclui a internação
							include: {
								paciente: { select: { nome: true } }, // (NOVO) Inclui o paciente
							},
						},
					},
				})

				const nomePaciente =
					associacao?.internacao?.paciente?.nome || 'paciente'

				if (associacao?.familiar && associacao.familiar.email) {
					sendEmail({
						to: associacao.familiar.email,
						subject: `[InfoCare] Acesso APROVADO para ${nomePaciente}`,
						html: `Olá, ${associacao.familiar.nome}.<br>Boas notícias! Sua solicitação de acesso ao paciente <b>${nomePaciente}</b> foi <b>aprovada</b>. Você já pode visualizar os dados no aplicativo.`,
					})
				}
			} catch (emailError: any) {
				console.error(
					'[Email] Falha ao enviar e-mail de aprovação:',
					emailError.message
				)
			}
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					return next(new Error('Solicitação de associação não encontrada.'))
				}
			}
			return next(error)
		}
	}
)

/**
 * Rota: PUT /:id/rejeitar
 * Descrição: Profissional (logado) REJEITA uma solicitação.
 */
associacaoRouter.put(
	'/:id/rejeitar',
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

			const { id } = getAssociacaoByIdSchema.parse(req.params)

			const associacaoRejeitada = await prisma.associacao.update({
				where: { id: id },
				data: {
					status: 'rejeitada',
				},
			})

			// Resposta imediata
			res.status(200).json(associacaoRejeitada)

			// (NOVO) Enviar e-mail (com nome do paciente)
			try {
				const associacao = await prisma.associacao.findUnique({
					where: { id: id },
					include: {
						familiar: { select: { email: true, nome: true } },
						internacao: {
							// (NOVO) Inclui a internação
							include: {
								paciente: { select: { nome: true } }, // (NOVO) Inclui o paciente
							},
						},
					},
				})

				const nomePaciente =
					associacao?.internacao?.paciente?.nome || 'paciente'

				if (associacao?.familiar && associacao.familiar.email) {
					sendEmail({
						to: associacao.familiar.email,
						subject: `[InfoCare] Acesso REJEITADO para ${nomePaciente}`,
						html: `Olá, ${associacao.familiar.nome}.<br>Sua solicitação de acesso ao paciente <b>${nomePaciente}</b> foi <b>rejeitada</b>. Entre em contato com a administração do hospital para mais detalhes.`,
					})
				}
			} catch (emailError: any) {
				console.error(
					'[Email] Falha ao enviar e-mail de rejeição:',
					emailError.message
				)
			}
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					return next(new Error('Solicitação de associação não encontrada.'))
				}
			}
			return next(error)
		}
	}
)

/**
 * Rota: DELETE /:id
 * Descrição: Profissional (logado) APAGA uma Solicitação.
 */
associacaoRouter.delete(
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

			const { id } = getAssociacaoByIdSchema.parse(req.params)

			await prisma.associacao.delete({
				where: { id: id },
			})

			return res.status(200).json({
				status: 'sucesso',
				message: 'Solicitação de associação apagada.',
			})
		} catch (error: any) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2025'
			) {
				return next(new Error('Solicitação de associação não encontrada.'))
			}
			return next(error)
		}
	}
)

export default associacaoRouter
