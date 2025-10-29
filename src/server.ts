// 1. Carrega as variáveis de ambiente (do .env)
// Deve ser a PRIMEIRA linha de código a ser executada
import 'dotenv/config'

import { app } from './app'

// 2. Define a porta da API
// Busca a variável 'PORT' no .env ou usa 3001 como padrão
const PORT = process.env.PORT || 3001

// 3. Inicia o servidor
app.listen(PORT, () => {
	console.log(`InfoCare API rodando em: http://localhost:${PORT} 🏥🖥️`)
})
