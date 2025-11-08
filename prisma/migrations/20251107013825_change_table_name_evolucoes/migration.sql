/*
  Warnings:

  - You are about to drop the `Evoluco_es` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Evoluco_es" DROP CONSTRAINT "Evoluco_es_id_internacao_fkey";

-- DropForeignKey
ALTER TABLE "public"."Evoluco_es" DROP CONSTRAINT "Evoluco_es_id_profissional_fkey";

-- DropTable
DROP TABLE "public"."Evoluco_es";

-- CreateTable
CREATE TABLE "Evolucoes" (
    "id_evolucao" SERIAL NOT NULL,
    "id_internacao" INTEGER NOT NULL,
    "id_profissional" INTEGER,
    "data_hora" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "Evolucoes_pkey" PRIMARY KEY ("id_evolucao")
);

-- AddForeignKey
ALTER TABLE "Evolucoes" ADD CONSTRAINT "Evolucoes_id_internacao_fkey" FOREIGN KEY ("id_internacao") REFERENCES "Internacoes"("id_internacao") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evolucoes" ADD CONSTRAINT "Evolucoes_id_profissional_fkey" FOREIGN KEY ("id_profissional") REFERENCES "ProfissionaisSaude"("id_profissional") ON DELETE SET NULL ON UPDATE CASCADE;
