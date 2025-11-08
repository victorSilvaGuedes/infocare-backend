/*
  Warnings:

  - You are about to drop the column `id_familiar` on the `Internacoes` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Internacoes" DROP CONSTRAINT "Internacoes_id_familiar_fkey";

-- AlterTable
ALTER TABLE "Internacoes" DROP COLUMN "id_familiar";
