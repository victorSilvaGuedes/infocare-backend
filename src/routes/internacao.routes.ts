// Salve este arquivo como: src/routes/internacao.routes.ts

import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Prisma, StatusInternacao } from '@prisma/client'
import prisma from '../lib/prisma'
import { authMiddleware } from '../middlewares/authMiddleware'

// --- SCHEMAS ZOD ---

// (ATUALIZADO) Schema para CRIAR uma Internacao (POST /)
const createInternacaoSchema = z.object({
	idPaciente: z
		.number()
		.int()
		.positive({ message: 'ID do Paciente é obrigatório.' }),
	idFamiliar: z.number().int().positive().optional(),

	// (NOVO) Aceita o ID do profissional responsável
	idProfissionalResponsavel: z.number().int().positive().optional(),

	diagnostico: z.string().optional(),
	observacoes: z.string().optional(),

	// (NOVOS) Aceita os campos de localização
	quarto: z.string().optional(),
	leito: z.string().optional(),
})

// Schema para ATUALIZAR uma Internação (PUT /:id)
const updateInternacaoSchema = z.object({
	// Permite atualizar para um ID ou remover (null)
	idFamiliar: z.number().int().positive().optional().nullable(),
	idProfissionalResponsavel: z.number().int().positive().optional().nullable(),
	diagnostico: z.string().optional().nullable(),
	observacoes: z.string().optional().nullable(),
	quarto: z.string().optional().nullable(),
	leito: z.string().optional().nullable(),
})

// Schema para FILTRAR Internações (GET /)
const getInternacoesSchema = z.object({
	// Permite filtrar por status, ex: /internacoes?status=ATIVA
	status: z.nativeEnum(StatusInternacao).optional(),
})

// Schema para ID na URL (GET /:id, PUT /:id/alta)
const getInternacaoByIdSchema = z.object({
	id: z.coerce.number().int().positive(),
})

// --- CRIAÇÃO DO ROTEADOR ---
const internacaoRouter = Router()

// --- ROTAS ---

/**
 * Rota: POST /
 * Descrição: Cria uma nova internação.
 * (PROTEGIDA: Apenas para Profissionais)
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

			const internacao = await prisma.internacao.create({
				data: {
					...validatedData,
					// dataInicio e status são definidos por @default no schema
				},
			})

			return res.status(201).json(internacao)
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				// P2025 = "Record to update/create not found."
				// P2003 = "Foreign key constraint failed" (mais específico para criação)
				if (error.code === 'P2025' || error.code === 'P2003') {
					return next(
						new Error(
							'Um dos IDs fornecidos (Paciente, Familiar ou Profissional) não foi encontrado.'
						)
					)
				}
			}
			return next(error)
		}
	}
)

/**
 * (NOVA ROTA)
 * Rota: PUT /:id/alta
 * Descrição: Finaliza uma internação (Dá alta).
 * (PROTEGIDA: Apenas para Profissionais)
 */
internacaoRouter.put(
	'/:id/alta',
	authMiddleware, // 1. Protegemos a rota
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 2. Verificamos a Autorização (Permissão)
			if (req.usuario?.tipo !== 'profissional') {
				const error = new Error(
					'Acesso negado: Rota apenas para profissionais.'
				)
				;(error as any).statusCode = 403
				return next(error)
			}

			// 3. Validamos o ID da URL
			const { id } = getInternacaoByIdSchema.parse(req.params)

			// 4. Lógica de Banco (Atualizar)
			const internacaoAtualizada = await prisma.internacao.update({
				where: { id: id },
				data: {
					status: 'ALTA', // Muda o status
					dataAlta: new Date(), // Define a data/hora de encerramento (agora)
				},
			})

			return res.status(200).json(internacaoAtualizada)
		} catch (error: any) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					// "Record to update not found."
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
 * Descrição: Lista todas as internações.
 * (Pública, com filtro opcional por status)
 */
internacaoRouter.get(
	'/',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 1. Validamos os query params (ex: ?status=ATIVA)
			const { status } = getInternacoesSchema.parse(req.query)

			// 2. Lógica de Banco (Buscar Todos)
			const internacoes = await prisma.internacao.findMany({
				where: {
					// Se 'status' foi fornecido, filtra por ele
					status: status,
				},
				// (ATUALIZADO) Incluímos mais dados na listagem
				include: {
					paciente: {
						select: { nome: true, cpf: true }, // Mais leve
					},
					profissionalResponsavel: {
						// Quem é o médico responsável
						select: { nome: true, especialidade: true },
					},
				},
				orderBy: {
					dataInicio: 'desc', // Mais recentes primeiro
				},
			})

			// 3. Resposta
			return res.status(200).json(internacoes)
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * Rota: GET /:id
 * Descrição: Busca uma internação específica.
 * (AGORA PROTEGIDA: Requer login e permissão)
 */
internacaoRouter.get(
	'/:id',
	authMiddleware, // 1. AGORA EXIGE AUTENTICAÇÃO
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 2. Validar o ID da URL
			const { id: idInternacao } = getInternacaoByIdSchema.parse(req.params)

			// 3. Identificar o usuário logado (do token)
			const usuarioLogado = req.usuario
			if (!usuarioLogado) {
				return next(new Error('Usuário não autenticado.'))
			}

			// 4. LÓGICA DE PERMISSÃO

			// CASO A: O usuário é um Profissional
			if (usuarioLogado.tipo === 'profissional') {
				// Profissionais podem ver qualquer internação.
				// A lógica de busca abaixo (Passo 5) irá apenas prosseguir.
				console.log(
					`[Auth] Acesso de Profissional (ID: ${usuarioLogado.sub}) à internação ${idInternacao}.`
				)

				// CASO B: O usuário é um Familiar
			} else if (usuarioLogado.tipo === 'familiar') {
				// Familiares SÓ podem ver se tiverem associação APROVADA.
				const idFamiliarLogado = usuarioLogado.sub

				const associacao = await prisma.associacao.findFirst({
					where: {
						idFamiliar: idFamiliarLogado,
						idInternacao: idInternacao,
						status: 'aprovada', // A CHAVE!
					},
				})

				// Se NÃO houver associação aprovada, bloqueamos.
				if (!associacao) {
					console.log(
						`[Auth] Acesso NEGADO de Familiar (ID: ${idFamiliarLogado}) à internação ${idInternacao}.`
					)
					const error = new Error(
						'Acesso negado: Você não tem permissão para ver esta internação.'
					)
					;(error as any).statusCode = 403 // 403 Forbidden
					return next(error)
				}

				console.log(
					`[Auth] Acesso de Familiar (ID: ${idFamiliarLogado}) à internação ${idInternacao}.`
				)

				// CASO C: Outro tipo de usuário (nunca deve acontecer)
			} else {
				return next(new Error('Tipo de usuário desconhecido.'))
			}

			// 5. LÓGICA DE BUSCA (Se passou nas permissões acima)
			// (Esta é a mesma busca que tínhamos antes)
			const internacao = await prisma.internacao.findUnique({
				where: { id: idInternacao },
				include: {
					paciente: true,
					familiar: true,
					profissionalResponsavel: true,
					evolucoes: {
						orderBy: { dataHora: 'desc' }, // Usando o campo corrigido
						include: {
							profissional: {
								select: { nome: true, tipo: true },
							},
						},
					},
				},
			})

			// 6. Tratamento de "Não Encontrado"
			if (!internacao) {
				const notFoundError = new Error('Internação não encontrada.')
				;(notFoundError as any).statusCode = 404
				return next(notFoundError)
			}

			// 7. Resposta
			return res.status(200).json(internacao)
		} catch (error: any) {
			return next(error)
		}
	}
)

/**
 * (NOVA ROTA)
 * Rota: PUT /:id
 * Descrição: Profissional (logado) atualiza os dados de uma Internação.
 * (PROTEGIDA: Apenas para Profissionais)
 */
internacaoRouter.put(
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

			// 3. Validamos o ID da Internacao (da URL)
			const { id } = getInternacaoByIdSchema.parse(req.params)

			// 4. Validamos os dados do body
			const validatedData = updateInternacaoSchema.parse(req.body)

			// 5. Garantimos que não enviou um body vazio
			if (Object.keys(validatedData).length === 0) {
				return res.status(400).json({
					status: 'error',
					message: 'Nenhum dado fornecido para atualização.',
				})
			}

			// 6. Lógica de Banco (Atualizar)
			const internacaoAtualizada = await prisma.internacao.update({
				where: { id: id },
				data: validatedData,
			})

			// 7. Resposta
			return res.status(200).json(internacaoAtualizada)
		} catch (error: any) {
			// P2025: Internação não encontrada
			// P2003: idFamiliar ou idProfissional inválido
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					return next(new Error('Internação não encontrada.'))
				}
				if (error.code === 'P2003') {
					return next(new Error('ID de Familiar ou Profissional inválido.'))
				}
			}
			return next(error)
		}
	}
)

/**
 * (NOVA ROTA)
 * Rota: DELETE /:id
 * Descrição: Profissional (logado) APAGA uma Internação.
 * (PROTEGIDA: Apenas para Profissionais)
 * (PERIGO: Esta ação é EM CASCATA - apaga evoluções e associações)
 */
internacaoRouter.delete(
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

			// 3. Validamos o ID da Internacao (da URL)
			const { id } = getInternacaoByIdSchema.parse(req.params)

			// 4. Lógica de Banco (Apagar)
			await prisma.internacao.delete({
				where: { id: id },
			})

			// 5. Resposta
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
