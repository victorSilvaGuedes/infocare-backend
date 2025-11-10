// 1. Carrega as variáveis de ambiente (do .env)
// Deve ser a PRIMEIRA linha de código a ser executada
import 'dotenv/config'

import { app } from './app'

// 2. O Render define process.env.PORT. Se não existir (no dev local), usamos 3333.
const PORT = process.env.PORT || 3333

// 3. Iniciamos o servidor na porta correta.
// O Node.js automaticamente escuta em '0.0.0.0' por padrão
// quando executado em ambientes como o Render, o que é o correto.
app.listen(Number(PORT), () => {
	// 4. Corrigimos a mensagem de log
	console.log(`InfoCare API rodando na porta ${PORT} 🏥🖥️`)

	// (O link da documentação ainda será útil localmente)
	console.log(`Documentação (local): http://localhost:${PORT}/api-docs`)
})
