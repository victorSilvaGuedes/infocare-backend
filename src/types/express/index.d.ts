// src/types/express/index.d.ts

// 1. O CONSERTO: Renomeamos de 'JwtPayload' para 'UsuarioPayload'
export interface UsuarioPayload {
	sub: number // O ID do usuário (Familiar ou Profissional)
	tipo: 'familiar' | 'profissional' // O tipo de usuário
}

// Agora, aumentamos o namespace 'global'
declare global {
	namespace Express {
		// 2. O CONSERTO: Usamos o nosso novo nome de interface aqui
		export interface Request {
			usuario?: UsuarioPayload
		}
	}
}
