// src/middlewares/authMiddleware.ts

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

// 3. O CONSERTO: Importamos o nosso tipo renomeado
import { UsuarioPayload } from '../types/express'

export const authMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const jwtSecret = process.env.JWT_SECRET

	if (!jwtSecret) {
		return next(new Error('Segredo JWT não configurado no servidor.'))
	}

	try {
		const authHeader = req.headers.authorization

		if (!authHeader) {
			throw new Error('Token de autenticação não fornecido.')
		}

		const parts = authHeader.split(' ')
		if (parts.length !== 2 || parts[0] !== 'Bearer') {
			throw new Error('Token mal formatado.')
		}

		const token = parts[1]

		// 4. O CONSERTO (TS2352):
		// O erro pedia para converter para 'unknown' primeiro.
		// Isto diz ao TypeScript: "Eu sei o que estou a fazer."
		// Verificamos o token e forçamos (assert) que o seu
		// conteúdo (payload) tem o formato da *nossa* interface.
		const payload = jwt.verify(token, jwtSecret) as unknown as UsuarioPayload

		// 5. ANEXAR o payload (info do usuário) ao objeto 'req'
		req.usuario = payload

		// 6. Deixar a requisição continuar
		return next()
	} catch (error: any) {
		// 7. Se jwt.verify() falhar
		;(error as any).statusCode = 401
		return next(error)
	}
}
