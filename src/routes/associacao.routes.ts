// Salve este arquivo como: src/routes/associacao.routes.ts
// (Versão REATORADA - E-mails agora são "bloqueantes")

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma, StatusAssociacao } from '@prisma/client'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middlewares/authMiddleware'
import { sendEmail } from '../services/email.service'

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

			// --- Verifica se a internação existe ---
			const internacaoExiste = await prisma.internacao.findUnique({
				where: { id: idInternacao },
				select: {
					id: true,
					paciente: { select: { nome: true } },
				},
			})

			if (!internacaoExiste) {
				const error = new Error('Internação não encontrada com o ID fornecido.')
				;(error as any).statusCode = 404
				return next(error)
			}

			// --- Verifica se já existe associação ---
			const jaExiste = await prisma.associacao.findFirst({
				where: {
					idFamiliar: idFamiliarLogado,
					idInternacao: idInternacao,
				},
			})
			if (jaExiste) {
				const error = new Error(
					`Você já enviou uma solicitação para esta internação (Status: ${jaExiste.status}).`
				)
				;(error as any).statusCode = 400
				return next(error)
			}

			// --- Cria a nova associação ---
			const novaAssociacao = await prisma.associacao.create({
				data: {
					idFamiliar: idFamiliarLogado,
					idInternacao: idInternacao,
					status: 'pendente',
				},
				include: {
					familiar: { select: { email: true, nome: true } },
					internacao: { include: { paciente: { select: { nome: true } } } },
				},
			})

			// --- Envia o e-mail (sem travar a requisição) ---
			const nomePaciente = internacaoExiste.paciente.nome
			const familiar = novaAssociacao.familiar

			if (familiar && familiar.email) {
				sendEmail({
					to: familiar.email,
					subject: `[InfoCare] Solicitação de acesso para ${nomePaciente}`,
					html: `Olá, ${familiar.nome}.<br>Sua solicitação de acesso à internação do paciente <b>${nomePaciente}</b> foi registrada e está <b>pendente</b> de aprovação.`,
				}).catch(() => {
					// não faz nada — apenas ignora erro silenciosamente
				})
			}

			// --- Retorna sucesso ---
			res.status(201).json(novaAssociacao)
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2003') {
					const customError = new Error(
						'Internação não encontrada com o ID fornecido.'
					)
					;(customError as any).statusCode = 404
					return next(customError)
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
// (Esta rota não foi alterada)
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
				where: { status: status },
				include: {
					familiar: {
						select: { id: true, nome: true, email: true },
					},
					internacao: {
						select: {
							id: true,
							diagnostico: true,
							dataInicio: true,
							paciente: { select: { nome: true } },
						},
					},
				},
				orderBy: { dataSolicitacao: 'asc' },
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

			// ======================================================
			// (A MUDANÇA - PARTE 1)
			// O 'update' agora INCLUI os dados do familiar e paciente.
			// (Não precisamos mais de um segundo 'findUnique')
			// ======================================================
			const associacaoAprovada = await prisma.associacao.update({
				where: { id: id },
				data: {
					status: 'aprovada',
				},
				include: {
					familiar: { select: { email: true, nome: true } },
					internacao: {
						include: {
							paciente: { select: { nome: true } },
						},
					},
				},
			})

			// ======================================================
			// (A MUDANÇA - PARTE 2)
			// Enviamos o e-mail ANTES de responder ao frontend.
			// ======================================================
			const nomePaciente = associacaoAprovada.internacao.paciente.nome
			const familiar = associacaoAprovada.familiar

			if (familiar && familiar.email) {
				await sendEmail({
					to: familiar.email,
					subject: `[InfoCare] Acesso APROVADO para ${nomePaciente}`,
					html: `Olá, ${familiar.nome}.<br>Boas notícias! Sua solicitação de acesso ao paciente <b>${nomePaciente}</b> foi <b>aprovada</b>. Você já pode visualizar os dados no aplicativo.`,
				})
			}

			// 3. Resposta de Sucesso (AGORA é a última coisa)
			res.status(200).json(associacaoAprovada)
		} catch (emailError: any) {
			// Se o envio do e-mail falhar, o frontend agora saberá do erro
			console.error(
				'[Email] Falha ao enviar e-mail de aprovação:',
				emailError.message
			)
			return next(new Error('Falha ao enviar o e-mail de notificação.'))
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

			// ======================================================
			// (A MUDANÇA - PARTE 1)
			// O 'update' agora INCLUI os dados do familiar e paciente.
			// ======================================================
			const associacaoRejeitada = await prisma.associacao.update({
				where: { id: id },
				data: {
					status: 'rejeitada',
				},
				include: {
					familiar: { select: { email: true, nome: true } },
					internacao: {
						include: {
							paciente: { select: { nome: true } },
						},
					},
				},
			})

			// ======================================================
			// (A MUDANÇA - PARTE 2)
			// Enviamos o e-mail ANTES de responder ao frontend.
			// ======================================================
			const nomePaciente = associacaoRejeitada.internacao.paciente.nome
			const familiar = associacaoRejeitada.familiar

			if (familiar && familiar.email) {
				await sendEmail({
					to: familiar.email,
					subject: `[InfoCare] Acesso REJEITADO para ${nomePaciente}`,
					html: `Olá, ${familiar.nome}.<br>Sua solicitação de acesso ao paciente <b>${nomePaciente}</b> foi <b>rejeitada</b>. Entre em contato com a administração do hospital para mais detalhes.`,
				})
			}

			// 3. Resposta de Sucesso (AGORA é a última coisa)
			res.status(200).json(associacaoRejeitada)
		} catch (emailError: any) {
			console.error(
				'[Email] Falha ao enviar e-mail de rejeição:',
				emailError.message
			)
			return next(new Error('Falha ao enviar o e-mail de notificação.'))
		}
	}
)

/**
 * Rota: DELETE /:id
 * Descrição: Profissional (logado) APAGA uma Solicitação.
 */
// (Esta rota não foi alterada)
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
