/*
  Warnings:

  - The `id_profissional` column on the `Evolucoes` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Familiares` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Familiares` table. All the data in the column will be lost.
  - The `id_familiar` column on the `Internacoes` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `ProfissionaisSaude` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `ProfissionaisSaude` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `Familiares` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `ProfissionaisSaude` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `id_familiar` on the `Associacoes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `email` to the `Familiares` table without a default value. This is not possible if the table is not empty.
  - Added the required column `senha` to the `Familiares` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `ProfissionaisSaude` table without a default value. This is not possible if the table is not empty.
  - Added the required column `senha` to the `ProfissionaisSaude` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Associacoes" DROP CONSTRAINT "Associacoes_id_familiar_fkey";

-- DropForeignKey
ALTER TABLE "public"."Evolucoes" DROP CONSTRAINT "Evolucoes_id_profissional_fkey";

-- DropForeignKey
ALTER TABLE "public"."Internacoes" DROP CONSTRAINT "Internacoes_id_familiar_fkey";

-- AlterTable
ALTER TABLE "Associacoes" DROP COLUMN "id_familiar",
ADD COLUMN     "id_familiar" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Evolucoes" DROP COLUMN "id_profissional",
ADD COLUMN     "id_profissional" INTEGER;

-- AlterTable
ALTER TABLE "Familiares" DROP CONSTRAINT "Familiares_pkey",
DROP COLUMN "id",
ADD COLUMN     "email" VARCHAR(255) NOT NULL,
ADD COLUMN     "id_familiar" SERIAL NOT NULL,
ADD COLUMN     "senha" VARCHAR(255) NOT NULL,
ADD CONSTRAINT "Familiares_pkey" PRIMARY KEY ("id_familiar");

-- AlterTable
ALTER TABLE "Internacoes" DROP COLUMN "id_familiar",
ADD COLUMN     "id_familiar" INTEGER;

-- AlterTable
ALTER TABLE "ProfissionaisSaude" DROP CONSTRAINT "ProfissionaisSaude_pkey",
DROP COLUMN "id",
ADD COLUMN     "email" VARCHAR(255) NOT NULL,
ADD COLUMN     "id_profissional" SERIAL NOT NULL,
ADD COLUMN     "senha" VARCHAR(255) NOT NULL,
ADD CONSTRAINT "ProfissionaisSaude_pkey" PRIMARY KEY ("id_profissional");

-- CreateIndex
CREATE UNIQUE INDEX "Familiares_email_key" ON "Familiares"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ProfissionaisSaude_email_key" ON "ProfissionaisSaude"("email");

-- AddForeignKey
ALTER TABLE "Internacoes" ADD CONSTRAINT "Internacoes_id_familiar_fkey" FOREIGN KEY ("id_familiar") REFERENCES "Familiares"("id_familiar") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evolucoes" ADD CONSTRAINT "Evolucoes_id_profissional_fkey" FOREIGN KEY ("id_profissional") REFERENCES "ProfissionaisSaude"("id_profissional") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Associacoes" ADD CONSTRAINT "Associacoes_id_familiar_fkey" FOREIGN KEY ("id_familiar") REFERENCES "Familiares"("id_familiar") ON DELETE CASCADE ON UPDATE CASCADE;
