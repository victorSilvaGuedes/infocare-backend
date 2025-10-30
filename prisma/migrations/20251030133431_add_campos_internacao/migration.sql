-- AlterTable
ALTER TABLE "Internacoes" ADD COLUMN     "id_profissional_responsavel" INTEGER,
ADD COLUMN     "leito" VARCHAR(50),
ADD COLUMN     "quarto" VARCHAR(50);

-- AddForeignKey
ALTER TABLE "Internacoes" ADD CONSTRAINT "Internacoes_id_profissional_responsavel_fkey" FOREIGN KEY ("id_profissional_responsavel") REFERENCES "ProfissionaisSaude"("id_profissional") ON DELETE SET NULL ON UPDATE CASCADE;
