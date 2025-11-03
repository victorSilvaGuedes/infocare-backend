import express, { Express, Request, Response } from 'express'
import cors from 'cors'
import { errorHandler } from './middlewares/errorHandler'

import pacienteRouter from './routes/paciente.routes'
import familiarRouter from './routes/familiar.routes'
import profissionalRouter from './routes/profissional.routes'
import internacaoRouter from './routes/internacao.routes'
import evolucaoRouter from './routes/evolucao.routes'
import associacaoRouter from './routes/associacao.routes'

import swaggerUi from 'swagger-ui-express'
import * as swaggerDocument from '../swagger.json'

const app: Express = express()

// --- Middlewares Globais ---
app.use(cors())
app.use(express.json())

// --- Rotas ---
// 3. ROTA DE DOCUMENTAÇÃO (Swagger)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// Rota "Health Check"
app.get('/', (req: Request, res: Response) => {
	res.status(200).json({
		message: 'InfoCare API está online! Documentação em /api-docs',
		timestamp: new Date().toISOString(),
	})
})

// Rotas da Aplicação
app.use('/pacientes', pacienteRouter)
app.use('/familiares', familiarRouter)
app.use('/profissionais', profissionalRouter)
app.use('/internacoes', internacaoRouter)
app.use('/evolucoes', evolucaoRouter)
app.use('/associacoes', associacaoRouter)

// --- Tratamento de Erros (NOVO) ---
//
// ESTE DEVE SER O ÚLTIMO 'app.use()'
// O Express sabe que ele é um errorHandler por causa dos 4 argumentos
//
app.use(errorHandler)

// Exporta o 'app' para ser usado pelo 'server.ts'
export { app }
