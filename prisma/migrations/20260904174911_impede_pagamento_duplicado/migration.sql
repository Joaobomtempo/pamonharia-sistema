/*
  Warnings:

  - A unique constraint covering the columns `[itemEntregaId]` on the table `PagamentoItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "PagamentoItem_pagamentoId_itemEntregaId_key";

-- CreateIndex
CREATE UNIQUE INDEX "PagamentoItem_itemEntregaId_key" ON "PagamentoItem"("itemEntregaId");
