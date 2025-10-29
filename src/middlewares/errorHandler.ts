// Salve este arquivo como: src/middlewares/errorHandler.ts

import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export const errorHandler = (
	error: Error & { statusCode?: number },
	req: Request,
	res: Response,
	next: NextFunction
) => {
	console.error('[ERRO GLOBAL]:', error.message)

	// --- Tratamento de Erros Específicos ---

	// 1. Erro de validação do Zod (HTTP 400 - Bad Request)
	if (error instanceof ZodError) {
		return res.status(400).json({
			status: 'error',
			message: 'Erro de validação nos dados enviados.',

			// AQUI ESTÁ A CORREÇÃO:
			// A propriedade correta do Zod é 'issues', não 'errors'
			errors: error.issues.map((issue) => ({
				campo: issue.path.join('.'),
				mensagem: issue.message,
			})),
		})
	}

	// 2. Erro de CPF Duplicado (HTTP 409 - Conflict)
	if (
		error.message.includes('Já existe um paciente cadastrado com este CPF.')
	) {
		return res.status(409).json({
			status: 'error',
			message: error.message,
		})
	}

	// 3. Erro de "Não Encontrado" (HTTP 404 - Not Found)
	if (error.message.includes('não encontrado') || error.statusCode === 404) {
		return res.status(404).json({
			status: 'error',
			message: error.message,
		})
	}

	// 4. Erros conhecidos do Prisma (códigos Pxxxx)
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		return res.status(500).json({
			status: 'error',
			message: `Erro no banco de dados (Prisma): ${error.code}`,
		})
	}

	// --- Fallback (Para-raios) ---
	// 5. Qualquer outro erro (HTTP 500 - Internal Server Error)
	return res.status(500).json({
		status: 'error',
		message: `Erro interno inesperado do servidor: ${error.message}`,
	})
}
