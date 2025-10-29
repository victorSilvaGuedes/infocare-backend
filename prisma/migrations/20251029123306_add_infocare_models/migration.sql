/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "StatusAssociacao" AS ENUM ('pendente', 'aprovada', 'rejeitada');

-- CreateEnum
CREATE TYPE "StatusInternacao" AS ENUM ('ATIVA', 'ALTA');

-- CreateEnum
CREATE TYPE "TipoProfissional" AS ENUM ('MEDICO', 'ENFERMEIRO', 'OUTRO');

-- DropTable
DROP TABLE "public"."User";

-- CreateTable
CREATE TABLE "Pacientes" (
    "id_paciente" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "cpf" VARCHAR(14) NOT NULL,
    "telefone" VARCHAR(20),
    "data_nascimento" DATE NOT NULL,
    "tipo_sanguineo" VARCHAR(5),

    CONSTRAINT "Pacientes_pkey" PRIMARY KEY ("id_paciente")
);

-- CreateTable
CREATE TABLE "Familiares" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "cpf" VARCHAR(14) NOT NULL,
    "telefone" VARCHAR(20),

    CONSTRAINT "Familiares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfissionaisSaude" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "cpf" VARCHAR(14) NOT NULL,
    "telefone" VARCHAR(20),
    "crm" VARCHAR(20),
    "coren" VARCHAR(20),
    "especialidade" VARCHAR(100),
    "tipo" "TipoProfissional" NOT NULL DEFAULT 'OUTRO',

    CONSTRAINT "ProfissionaisSaude_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Internacoes" (
    "id_internacao" SERIAL NOT NULL,
    "id_paciente" INTEGER NOT NULL,
    "id_familiar" UUID,
    "data_inicio" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alta" TIMESTAMP,
    "diagnostico" TEXT,
    "observacoes" TEXT,
    "status" "StatusInternacao" NOT NULL DEFAULT 'ATIVA',

    CONSTRAINT "Internacoes_pkey" PRIMARY KEY ("id_internacao")
);

-- CreateTable
CREATE TABLE "Evolucoes" (
    "id_evolucao" SERIAL NOT NULL,
    "id_internacao" INTEGER NOT NULL,
    "id_profissional" UUID,
    "data_evolucao" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horario" TIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "Evolucoes_pkey" PRIMARY KEY ("id_evolucao")
);

-- CreateTable
CREATE TABLE "Associacoes" (
    "id_associacao" SERIAL NOT NULL,
    "id_familiar" UUID NOT NULL,
    "id_internacao" INTEGER NOT NULL,
    "data_solicitacao" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatusAssociacao" NOT NULL DEFAULT 'pendente',

    CONSTRAINT "Associacoes_pkey" PRIMARY KEY ("id_associacao")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pacientes_cpf_key" ON "Pacientes"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Familiares_cpf_key" ON "Familiares"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "ProfissionaisSaude_cpf_key" ON "ProfissionaisSaude"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "ProfissionaisSaude_crm_key" ON "ProfissionaisSaude"("crm");

-- CreateIndex
CREATE UNIQUE INDEX "ProfissionaisSaude_coren_key" ON "ProfissionaisSaude"("coren");

-- AddForeignKey
ALTER TABLE "Internacoes" ADD CONSTRAINT "Internacoes_id_paciente_fkey" FOREIGN KEY ("id_paciente") REFERENCES "Pacientes"("id_paciente") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Internacoes" ADD CONSTRAINT "Internacoes_id_familiar_fkey" FOREIGN KEY ("id_familiar") REFERENCES "Familiares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evolucoes" ADD CONSTRAINT "Evolucoes_id_internacao_fkey" FOREIGN KEY ("id_internacao") REFERENCES "Internacoes"("id_internacao") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evolucoes" ADD CONSTRAINT "Evolucoes_id_profissional_fkey" FOREIGN KEY ("id_profissional") REFERENCES "ProfissionaisSaude"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Associacoes" ADD CONSTRAINT "Associacoes_id_familiar_fkey" FOREIGN KEY ("id_familiar") REFERENCES "Familiares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Associacoes" ADD CONSTRAINT "Associacoes_id_internacao_fkey" FOREIGN KEY ("id_internacao") REFERENCES "Internacoes"("id_internacao") ON DELETE CASCADE ON UPDATE CASCADE;
