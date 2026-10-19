-- CreateTable
CREATE TABLE "AcertoMovimentacao" (
    "id" SERIAL NOT NULL,
    "entregaId" INTEGER NOT NULL,
    "devolucaoId" INTEGER,
    "quantidadeEntregue" INTEGER NOT NULL,
    "quantidadeDevolvida" INTEGER NOT NULL,
    "valorBruto" DECIMAL(10,2) NOT NULL,
    "valorDevolvido" DECIMAL(10,2) NOT NULL,
    "valorDevido" DECIMAL(10,2) NOT NULL,
    "pagamentoId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcertoMovimentacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcertoMovimentacao_entregaId_key" ON "AcertoMovimentacao"("entregaId");

-- CreateIndex
CREATE UNIQUE INDEX "AcertoMovimentacao_devolucaoId_key" ON "AcertoMovimentacao"("devolucaoId");

-- CreateIndex
CREATE INDEX "AcertoMovimentacao_pagamentoId_idx" ON "AcertoMovimentacao"("pagamentoId");

-- AddForeignKey
ALTER TABLE "AcertoMovimentacao" ADD CONSTRAINT "AcertoMovimentacao_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcertoMovimentacao" ADD CONSTRAINT "AcertoMovimentacao_devolucaoId_fkey" FOREIGN KEY ("devolucaoId") REFERENCES "Devolucao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcertoMovimentacao" ADD CONSTRAINT "AcertoMovimentacao_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
