// Salve como: src/routes/util.routes.ts

import { Router, Request, Response, NextFunction } from 'express'
import { authMiddleware } from '../middlewares/authMiddleware'
import { upload } from '../middlewares/uploadMiddleware'
import { transcribeAudio } from '../services/gemini.service'

const utilRouter = Router()

/**
 * Rota: POST /transcrever
 * Descrição: Rota genérica para transcrição de áudio.
 * (PROTEGIDA: Apenas para Profissionais)
 */
utilRouter.post(
	'/transcrever',
	authMiddleware,
	upload.single('audio'), // O multer captura o áudio
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			// 1. Apenas profissionais podem transcrever
			if (req.usuario?.tipo !== 'profissional') {
				const error = new Error(
					'Acesso negado: Rota apenas para profissionais.'
				)
				;(error as any).statusCode = 403
				return next(error)
			}

			// 2. Verifica se o ficheiro existe
			if (!req.file) {
				return next(new Error('Nenhum ficheiro de áudio enviado.'))
			}

			// 3. Chama o serviço
			const transcricao = await transcribeAudio(
				req.file.buffer,
				req.file.mimetype
			)

			// 4. Retorna a resposta
			return res.status(200).json({
				transcricao: transcricao,
			})
		} catch (error: any) {
			console.error(
				'[UtilRoute] Erro ao chamar transcribeAudio:',
				error.message
			)
			return next(new Error('Falha ao processar a transcrição de áudio.'))
		}
	}
)

export default utilRouter
