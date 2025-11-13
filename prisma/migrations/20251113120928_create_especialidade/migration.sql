/*
  Warnings:

  - The `tipo` column on the `ProfissionaisSaude` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Especialidade" AS ENUM ('MEDICO', 'ENFERMEIRO', 'TECNICO_ENFERMAGEM', 'FISIOTERAPEUTA', 'NUTRICIONISTA', 'PSICOLOGO', 'OUTRO');

-- AlterTable
ALTER TABLE "ProfissionaisSaude" ADD COLUMN     "especialidade" "Especialidade" NOT NULL DEFAULT 'OUTRO',
DROP COLUMN "tipo",
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'profissional';

-- DropEnum
DROP TYPE "public"."TipoProfissional";
