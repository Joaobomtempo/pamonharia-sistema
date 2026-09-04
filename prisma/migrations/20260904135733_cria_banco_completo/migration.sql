/*
  Warnings:

  - The `status` column on the `Usuario` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `atualizadoEm` to the `Usuario` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `tipo` on the `Usuario` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('DONO', 'FUNCIONARIO');

-- CreateEnum
CREATE TYPE "StatusUsuario" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "StatusPadaria" AS ENUM ('ATIVA', 'INATIVA', 'ARQUIVADA');

-- CreateEnum
CREATE TYPE "StatusProduto" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "StatusEntrega" AS ENUM ('PENDENTE', 'CONFIRMADA', 'COM_DEVOLUCAO', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'PAGO');

-- CreateEnum
CREATE TYPE "AcaoHistorico" AS ENUM ('CRIADO', 'ALTERADO', 'EXCLUIDO', 'FINALIZADO', 'LOGIN', 'TENTATIVA_SENHA');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL,
DROP COLUMN "tipo",
ADD COLUMN     "tipo" "TipoUsuario" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "StatusUsuario" NOT NULL DEFAULT 'ATIVO';

-- CreateTable
CREATE TABLE "Permissao" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "Permissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioPermissao" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "permissaoId" INTEGER NOT NULL,

    CONSTRAINT "UsuarioPermissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Padaria" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "contato" TEXT,
    "endereco" TEXT,
    "status" "StatusPadaria" NOT NULL DEFAULT 'ATIVA',
    "dataCadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Padaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "precoCadastrado" DECIMAL(10,2) NOT NULL,
    "status" "StatusProduto" NOT NULL DEFAULT 'ATIVO',
    "dataCadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entrega" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "padariaId" INTEGER NOT NULL,
    "dataEntrega" TIMESTAMP(3) NOT NULL,
    "status" "StatusEntrega" NOT NULL DEFAULT 'PENDENTE',
    "observacoes" TEXT,
    "criadoPorId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "finalizadaPorId" INTEGER,
    "dataFinalizacao" TIMESTAMP(3),

    CONSTRAINT "Entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemEntrega" (
    "id" SERIAL NOT NULL,
    "entregaId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "quantidadeEntregue" INTEGER NOT NULL,
    "precoUnitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ItemEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devolucao" (
    "id" SERIAL NOT NULL,
    "entregaId" INTEGER NOT NULL,
    "dataDevolucao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,
    "registradaPorId" INTEGER NOT NULL,
    "registradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Devolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDevolucao" (
    "id" SERIAL NOT NULL,
    "devolucaoId" INTEGER NOT NULL,
    "itemEntregaId" INTEGER NOT NULL,
    "quantidadeDevolvida" INTEGER NOT NULL,
    "precoUnitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ItemDevolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" SERIAL NOT NULL,
    "padariaId" INTEGER NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "valorDevido" DECIMAL(10,2) NOT NULL,
    "valorRecebido" DECIMAL(10,2),
    "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "divergencia" BOOLEAN NOT NULL DEFAULT false,
    "dataPagamento" TIMESTAMP(3),
    "registradoPorId" INTEGER,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagamentoItem" (
    "id" SERIAL NOT NULL,
    "pagamentoId" INTEGER NOT NULL,
    "itemEntregaId" INTEGER NOT NULL,
    "quantidadeVendida" INTEGER NOT NULL,
    "valorVendido" DECIMAL(10,2) NOT NULL,
    "valorDevolvido" DECIMAL(10,2) NOT NULL,
    "valorLiquido" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PagamentoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Historico" (
    "id" SERIAL NOT NULL,
    "tabelaAfetada" TEXT NOT NULL,
    "registroId" INTEGER,
    "acao" "AcaoHistorico" NOT NULL,
    "dadosAnteriores" JSONB,
    "dadosNovos" JSONB,
    "motivo" TEXT,
    "realizadoPorId" INTEGER,
    "realizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcessoSistema" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sucesso" BOOLEAN NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AcessoSistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permissao_nome_key" ON "Permissao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioPermissao_usuarioId_permissaoId_key" ON "UsuarioPermissao"("usuarioId", "permissaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Entrega_codigo_key" ON "Entrega"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ItemEntrega_entregaId_produtoId_key" ON "ItemEntrega"("entregaId", "produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemDevolucao_devolucaoId_itemEntregaId_key" ON "ItemDevolucao"("devolucaoId", "itemEntregaId");

-- CreateIndex
CREATE UNIQUE INDEX "PagamentoItem_pagamentoId_itemEntregaId_key" ON "PagamentoItem"("pagamentoId", "itemEntregaId");

-- AddForeignKey
ALTER TABLE "UsuarioPermissao" ADD CONSTRAINT "UsuarioPermissao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioPermissao" ADD CONSTRAINT "UsuarioPermissao_permissaoId_fkey" FOREIGN KEY ("permissaoId") REFERENCES "Permissao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_padariaId_fkey" FOREIGN KEY ("padariaId") REFERENCES "Padaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_finalizadaPorId_fkey" FOREIGN KEY ("finalizadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEntrega" ADD CONSTRAINT "ItemEntrega_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEntrega" ADD CONSTRAINT "ItemEntrega_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devolucao" ADD CONSTRAINT "Devolucao_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devolucao" ADD CONSTRAINT "Devolucao_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDevolucao" ADD CONSTRAINT "ItemDevolucao_devolucaoId_fkey" FOREIGN KEY ("devolucaoId") REFERENCES "Devolucao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDevolucao" ADD CONSTRAINT "ItemDevolucao_itemEntregaId_fkey" FOREIGN KEY ("itemEntregaId") REFERENCES "ItemEntrega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_padariaId_fkey" FOREIGN KEY ("padariaId") REFERENCES "Padaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoItem" ADD CONSTRAINT "PagamentoItem_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoItem" ADD CONSTRAINT "PagamentoItem_itemEntregaId_fkey" FOREIGN KEY ("itemEntregaId") REFERENCES "ItemEntrega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Historico" ADD CONSTRAINT "Historico_realizadoPorId_fkey" FOREIGN KEY ("realizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoSistema" ADD CONSTRAINT "AcessoSistema_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
