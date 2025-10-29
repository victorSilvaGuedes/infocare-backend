import express, { Express, Request, Response } from 'express'
import cors from 'cors'

// Cria a instância do aplicativo Express
const app: Express = express()

// --- Middlewares Globais ---

// 1. Habilita o CORS (Cross-Origin Resource Sharing)
// Permite que seu frontend (em outro domínio) faça requisições para esta API
app.use(cors())

// 2. Parser de JSON
// Habilita a API a entender requisições com body no formato JSON
app.use(express.json())

// --- Rotas ---

// Rota "Health Check" (Verificação de Saúde)
// Uma rota simples para verificar se a API está online
app.get('/', (req: Request, res: Response) => {
	res.status(200).json({
		message: 'InfoCare API está online!',
		timestamp: new Date().toISOString(),
	})
})

// (Aqui é onde vamos plugar nossos roteadores, ex: app.use('/pacientes', ...))

// --- Tratamento de Erros ---
// (Adicionaremos nosso middleware de erro global aqui)

// Exporta o 'app' para ser usado pelo 'server.ts'
export { app }
