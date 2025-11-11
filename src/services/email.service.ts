// src/services/email.service.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail({
	to,
	subject,
	html,
}: {
	to: string
	subject: string
	html: string
}) {
	try {
		const response = await resend.emails.send({
			from: 'InfoCare <onboarding@resend.dev>',
			to,
			subject,
			html,
		})

		return response
	} catch (error: any) {
		console.error('❌ Erro ao enviar e-mail:', error.message || error)
		throw new Error('Falha ao enviar e-mail.')
	}
}
