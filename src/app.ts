import express, { Express, Request, Response } from 'express'
import cors from 'cors'
import { errorHandler } from './middlewares/errorHandler'
const app: Express = express()
import pacienteRouter from './routes/paciente.routes'
import familiarRouter from './routes/familiar.routes'
import profissionalRouter from './routes/profissional.routes'

// --- Middlewares Globais ---
app.use(cors())
app.use(express.json())

// --- Rotas ---

// Rota "Health Check"
app.get('/', (req: Request, res: Response) => {
	res.status(200).json({
		message: 'InfoCare API está online!',
		timestamp: new Date().toISOString(),
	})
})

// Rotas da Aplicação
app.use('/pacientes', pacienteRouter)
app.use('/familiares', familiarRouter)
app.use('/profissionais', profissionalRouter)

// (Adicione outras rotas aqui, ex: app.use('/api/v1/familiares', ...))

// --- Tratamento de Erros (NOVO) ---
//
// ESTE DEVE SER O ÚLTIMO 'app.use()'
// O Express sabe que ele é um errorHandler por causa dos 4 argumentos
//
app.use(errorHandler)

// Exporta o 'app' para ser usado pelo 'server.ts'
export { app }
