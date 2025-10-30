// Salve este arquivo como: src/middlewares/errorHandler.ts

import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export const errorHandler = (
	// O tipo de 'error' agora aceita uma propriedade opcional 'statusCode'
	error: Error & { statusCode?: number },
	req: Request,
	res: Response,
	next: NextFunction
) => {
	// Logamos o erro no console do servidor (para depuração)
	console.error('[ERRO GLOBAL]:', error.message)

	// --- Tratamento de Erros Específicos ---

	// 1. Erro de validação do Zod (HTTP 400 - Bad Request)
	if (error instanceof ZodError) {
		return res.status(400).json({
			status: 'error',
			message: 'Erro de validação nos dados enviados.',
			// Usamos 'issues' para listar os campos que falharam
			errors: error.issues.map((issue) => ({
				campo: issue.path.join('.'),
				mensagem: issue.message,
			})),
		})
	}

	// 2. Erro de Autenticação ou Login (HTTP 401 - Unauthorized)
	// (Captura "Credenciais inválidas." E erros do authMiddleware)
	if (
		error.message.includes('Credenciais inválidas') ||
		error.statusCode === 401
	) {
		return res.status(401).json({
			status: 'error',
			message: error.message,
		})
	}

	// 3. Erro de Autorização (HTTP 403 - Forbidden)
	// (Captura o erro "Acesso negado..." da rota /me)
	if (error.message.includes('Acesso negado') || error.statusCode === 403) {
		return res.status(403).json({
			status: 'error',
			message: error.message,
		})
	}

	// 4. Erro de Conflito (HTTP 409 - Conflict)
	// (Captura "Já existe um...")
	if (error.message.includes('Já existe um')) {
		return res.status(409).json({
			status: 'error',
			message: error.message,
		})
	}

	// 5. Erro de "Não Encontrado" (HTTP 404 - Not Found)
	// (Captura "não encontrado")
	if (error.message.includes('não encontrado') || error.statusCode === 404) {
		return res.status(404).json({
			status: 'error',
			message: error.message,
		})
	}

	// 6. Erros conhecidos do Prisma (códigos Pxxxx)
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		return res.status(500).json({
			status: 'error',
			message: `Erro no banco de dados (Prisma): ${error.code}`,
		})
	}

	// --- Fallback (Para-raios) ---
	// 7. Qualquer outro erro (HTTP 500 - Internal Server Error)
	return res.status(500).json({
		status: 'error',
		message: `Erro interno inesperado do servidor: ${error.message}`,
	})
}
