-- AlterTable
ALTER TABLE "Devolucao" ADD COLUMN     "canceladoEm" TIMESTAMP(3),
ADD COLUMN     "canceladoPorId" INTEGER,
ADD COLUMN     "motivoCancelamento" TEXT;

-- AlterTable
ALTER TABLE "Entrega" ADD COLUMN     "canceladoEm" TIMESTAMP(3),
ADD COLUMN     "canceladoPorId" INTEGER,
ADD COLUMN     "motivoCancelamento" TEXT;
