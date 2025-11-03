/*
  Warnings:

  - You are about to drop the column `data_evolucao` on the `Evolucoes` table. All the data in the column will be lost.
  - You are about to drop the column `horario` on the `Evolucoes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Evolucoes" DROP COLUMN "data_evolucao",
DROP COLUMN "horario",
ADD COLUMN     "data_hora" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
