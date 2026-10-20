-- Preserva fechamentos cancelados e seus dados para auditoria.
ALTER TYPE "StatusPagamento" ADD VALUE IF NOT EXISTS 'CANCELADO';

ALTER TABLE "Pagamento"
  ADD COLUMN "canceladoEm" TIMESTAMP(3),
  ADD COLUMN "canceladoPorId" INTEGER,
  ADD COLUMN "motivoCancelamento" TEXT;
