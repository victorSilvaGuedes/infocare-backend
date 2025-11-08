/*
  Warnings:

  - You are about to drop the column `especialidade` on the `ProfissionaisSaude` table. All the data in the column will be lost.
  - You are about to drop the `Evolucoes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Evolucoes" DROP CONSTRAINT "Evolucoes_id_internacao_fkey";

-- DropForeignKey
ALTER TABLE "public"."Evolucoes" DROP CONSTRAINT "Evolucoes_id_profissional_fkey";

-- AlterTable
ALTER TABLE "ProfissionaisSaude" DROP COLUMN "especialidade";

-- DropTable
DROP TABLE "public"."Evolucoes";

-- CreateTable
CREATE TABLE "Evoluco_es" (
    "id_evolucao" SERIAL NOT NULL,
    "id_internacao" INTEGER NOT NULL,
    "id_profissional" INTEGER,
    "data_hora" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "Evoluco_es_pkey" PRIMARY KEY ("id_evolucao")
);

-- AddForeignKey
ALTER TABLE "Evoluco_es" ADD CONSTRAINT "Evoluco_es_id_internacao_fkey" FOREIGN KEY ("id_internacao") REFERENCES "Internacoes"("id_internacao") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evoluco_es" ADD CONSTRAINT "Evoluco_es_id_profissional_fkey" FOREIGN KEY ("id_profissional") REFERENCES "ProfissionaisSaude"("id_profissional") ON DELETE SET NULL ON UPDATE CASCADE;
