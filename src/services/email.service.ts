// Atualize este arquivo: src/services/email.service.ts

import nodemailer from 'nodemailer'
import 'dotenv/config'

// 1. Configura o "Transportador" (Nodemailer vai ler o .env)
const transporter = nodemailer.createTransport({
	host: process.env.EMAIL_HOST,
	port: parseInt(process.env.EMAIL_PORT || '587'),
	secure: false, // false para 587
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS,
	},
})

interface EmailOptions {
	to: string
	subject: string
	html: string
}

/**
 * Envia um e-mail.
 */
export const sendEmail = async (options: EmailOptions) => {
	if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
		console.error(
			'[EmailService] Credenciais de e-mail não configuradas no .env. E-mail não enviado.'
		)
		return
	}

	try {
		const mailOptions = {
			// IMPORTANTE: O 'from' DEVE ser o mesmo e-mail do EMAIL_USER
			from: `"InfoCare" <${process.env.EMAIL_USER}>`,
			to: options.to,
			subject: options.subject,
			html: options.html,
		}

		const info = await transporter.sendMail(mailOptions)

		console.log(`[EmailService] E-mail enviado com sucesso: ${info.messageId}`)

		// (A MUDANÇA ESTÁ AQUI)
		// O código do Ethereal (getTestMessageUrl) foi REMOVIDO.
	} catch (error: any) {
		console.error(
			`[EmailService] Falha ao enviar e-mail para ${options.to}:`,
			error.message
		)
	}
}
