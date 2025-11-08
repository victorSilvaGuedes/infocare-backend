// Crie este novo ficheiro: src/middlewares/uploadMiddleware.ts

import multer from 'multer'

// Vamos configurar o multer para armazenar o ficheiro na memória.
// É mais rápido para processamento imediato (como enviar para outra API)
// pois evita ter de salvar o ficheiro em disco.
const storage = multer.memoryStorage()

// Vamos limitar o tamanho do áudio para 5MB (mais do que suficiente)
const upload = multer({
	storage: storage,
	limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
})

export { upload }
