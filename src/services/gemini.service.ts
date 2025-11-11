// Salve este arquivo como: src/services/gemini.service.ts

import {
	GoogleGenerativeAI,
	HarmCategory,
	HarmBlockThreshold,
} from '@google/generative-ai'
import 'dotenv/config' // Garante que a GEMINI_API_KEY seja lida

// --- 1. Configuração Centralizada (Fora da função) ---
// (Isso é executado apenas uma vez quando o servidor inicia)

// Verificação da Chave de API
if (!process.env.GEMINI_API_KEY) {
	console.error(
		'[GeminiService] GEMINI_API_KEY não encontrada no .env. O serviço de transcrição não funcionará.'
	)
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// (Estou usando o modelo que você descobriu que funciona)
const model = genAI.getGenerativeModel({
	model: 'gemini-2.5-flash',
})

const generationConfig = {
	temperature: 0.4,
	topK: 32,
	topP: 1,
	maxOutputTokens: 8192,
}

const safetySettings = [
	{
		category: HarmCategory.HARM_CATEGORY_HARASSMENT,
		threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
		threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
		threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
		threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
	},
]

/**
 * --- 2. A Função Reutilizável ---
 * Transcreve um buffer de áudio usando a API do Gemini.
 *
 * @param audioBuffer O buffer de dados brutos do áudio (ex: req.file.buffer)
 * @param mimeType O tipo do áudio (ex: 'audio/webm' ou req.file.mimetype)
 * @returns Uma string com o texto transcrito.
 */
export const transcribeAudio = async (
	audioBuffer: Buffer,
	mimeType: string
): Promise<string> => {
	if (!process.env.GEMINI_API_KEY) {
		throw new Error('Chave da API do Gemini não configurada.')
	}

	try {
		console.log(
			`[GeminiService] Processando áudio de ${mimeType}, tamanho: ${audioBuffer.length} bytes.`
		)

		// 5. Preparar o áudio (Buffer -> Base64)
		const audioBase64 = audioBuffer.toString('base64')

		const parts = [
			{
				text: 'Transcreva este áudio. O áudio é de um profissional de saúde ditando uma evolução de um paciente. Foque apenas na transcrição médica, ignorando ruídos de fundo ou pausas. O áudio está no formato webm/opus.',
			},
			{
				inlineData: {
					mimeType: mimeType,
					data: audioBase64,
				},
			},
		]

		// 6. Chamar a API
		const result = await model.generateContent({
			contents: [{ role: 'user', parts }],
			generationConfig,
			safetySettings,
		})

		// 7. Processar e retornar a resposta
		const response = result.response
		const transcricao = response.text()

		console.log('[GeminiService] Transcrição concluída.')
		return transcricao
	} catch (error: any) {
		console.error('[GeminiService] Falha ao transcrever áudio:', error.message)
		// Lança o erro para que a rota que o chamou possa tratá-lo (com 'next(error)')
		throw new Error('Falha no serviço de transcrição.')
	}
}
