import { PrismaClient } from '@prisma/client'

// Declaramos 'prisma' no escopo global
// Isso é necessário para evitar que o hot-reloading do Node.js (em desenvolvimento)
// crie múltiplas instâncias do PrismaClient.
declare global {
	// eslint-disable-next-line no-var
	var prisma: PrismaClient | undefined
}

// Criamos a instância 'prisma'
// Em produção, 'globalThis.prisma' será 'undefined' na primeira vez, então criamos uma nova instância.
// Em desenvolvimento, 'globalThis.prisma' manterá a instância entre recargas,
// evitando novas conexões a cada mudança de código.
export const prisma =
	globalThis.prisma ||
	new PrismaClient({
		// Opcional: Ativa o log de todas as queries executadas pelo Prisma
		// Útil para depuração em desenvolvimento.
		log:
			process.env.NODE_ENV === 'development'
				? ['query', 'info', 'warn', 'error']
				: ['error'],
	})

// Se estivermos em desenvolvimento, atribuímos a instância ao globalThis
if (process.env.NODE_ENV !== 'production') {
	globalThis.prisma = prisma
}

// Exportamos a instância única
export default prisma
