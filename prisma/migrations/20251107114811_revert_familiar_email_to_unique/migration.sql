/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `Familiares` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Familiares_email_key" ON "Familiares"("email");
