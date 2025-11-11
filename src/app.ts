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
import utilRouter from './routes/utils.routes'

const app: Express = express()

app.use(cors())
app.use(express.json())

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

app.get('/', (req: Request, res: Response) => {
	res.status(200).json({
		message: 'InfoCare API está online! Documentação em /api-docs',
		timestamp: new Date().toISOString(),
	})
})

app.use('/pacientes', pacienteRouter)
app.use('/familiares', familiarRouter)
app.use('/profissionais', profissionalRouter)
app.use('/internacoes', internacaoRouter)
app.use('/evolucoes', evolucaoRouter)
app.use('/associacoes', associacaoRouter)
app.use('/util', utilRouter)

app.use(errorHandler)

export { app }
