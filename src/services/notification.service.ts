// Crie esta nova pasta e ficheiro: src/services/notification.service.ts

import 'dotenv/config' // Garante que as variáveis de ambiente sejam lidas
import twilio from 'twilio'

// 1. Pega as credenciais do .env
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioFromNumber = process.env.TWILIO_WHATSAPP_FROM

// 2. Verifica se as variáveis estão carregadas
if (!accountSid || !authToken || !twilioFromNumber) {
	console.error(
		'[Serviço de Notificação] Erro: Credenciais da Twilio não configuradas no .env. As notificações estarão DESATIVADAS.'
	)
}

// 3. Inicializa o cliente Twilio (apenas se as chaves existirem)
// Se as chaves não existirem, o 'twilioClient' será 'null'
const twilioClient =
	accountSid && authToken ? twilio(accountSid, authToken) : null

/**
 * Envia uma notificação via WhatsApp usando a Twilio.
 * * @param to Telefone do destinatário (Familiar)
 * Formato E.164 (ex: "+5516999998888")
 * @param body A mensagem a ser enviada
 */
export const sendWhatsAppNotification = async (to: string, body: string) => {
	// Se o cliente não foi inicializado (faltam chaves no .env), paramos aqui.
	if (!twilioClient) {
		console.error(
			'[Serviço de Notificação] Cliente Twilio não inicializado. Mensagem não enviada.'
		)
		return
	}

	// 4. Formata os números de telefone para o padrão do Twilio
	// O 'to' (para) precisa do prefixo 'whatsapp:'
	// O 'from' (de) já deve ter o prefixo (definido no .env)
	const formattedTo = `whatsapp:${to}`

	try {
		console.log(
			`[Serviço de Notificação] Enviando WhatsApp de: ${twilioFromNumber} para: ${formattedTo}`
		)

		// 5. Envia a mensagem
		const message = await twilioClient.messages.create({
			from: twilioFromNumber,
			to: formattedTo,
			body: body,
		})

		console.log(
			`[Serviço de Notificação] Mensagem enviada com sucesso. SID: ${message.sid}`
		)
		return message
	} catch (error: any) {
		// 6. Tratamento de erro da Twilio
		// (Ex: o número 'to' não está autorizado no sandbox)
		console.error(
			`[Serviço de Notificação] Falha ao enviar WhatsApp para ${formattedTo}:`,
			error.message
		)
	}
}
