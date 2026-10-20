import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "../../../generated/prisma/client";
import { autorizarUsuario } from "../../../../lib/autorizarUsuario";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

const respostaErro = (erro: string, status = 400) =>
  NextResponse.json({ erro }, { status, headers: { "Cache-Control": "no-store" } });

type ItemRecebido = { itemEntregaId: unknown; quantidadeDevolvida: unknown };

function idValido(valor: unknown): number | null {
  if (typeof valor !== "number" && (typeof valor !== "string" || !/^\d+$/.test(valor))) return null;
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function erroConhecido(codigo: string): [string, number] | null {
  const erros: Record<string, [string, number]> = {
    ENTREGA_ATUAL_INVALIDA: ["Movimentação atual não encontrada.", 404],
    ENTREGA_ANTERIOR_INVALIDA: ["Entrega anterior não encontrada.", 404],
    ENTREGA_CANCELADA: ["Uma das movimentações está cancelada.", 409],
    PADARIA_DIFERENTE: ["As duas entregas precisam ser da mesma padaria.", 409],
    DATA_INCORRETA: ["A entrega devolvida deve ser do dia anterior à movimentação atual.", 409],
    ACERTO_INEXISTENTE: ["A movimentação atual está sem acerto financeiro.", 409],
    ACERTO_FECHADO: ["O acerto já está vinculado a um fechamento financeiro.", 409],
    DEVOLUCAO_EXISTENTE: ["Esta movimentação já contém uma devolução. Devoluções adicionais exigem a próxima atualização do banco.", 409],
    ITEM_INVALIDO: ["Há um item inválido ou que não pertence à entrega anterior.", 400],
    ITEM_DUPLICADO: ["Um mesmo item foi informado mais de uma vez.", 400],
    PRODUTO_NAO_ENTREGUE: ["O produto devolvido não consta da movimentação atual. Não é possível calcular o desconto pelo preço de hoje.", 409],
    QUANTIDADE_EXCEDIDA: ["Quantidade devolvida maior que a quantidade ainda disponível da entrega anterior.", 409],
    VALOR_INVALIDO: ["Não foi possível calcular um desconto válido para esta devolução.", 409],
    MOVIMENTACAO_FINALIZADA: ["Movimentação atual finalizada. Não é possível incluir devoluções.", 409],
    ACERTO_INCONSISTENTE: ["O acerto já possui valores de devolução sem vínculo correspondente. Solicite revisão antes de lançar outra devolução.", 409],
  };
  return erros[codigo] ?? null;
}

/**
 * Registra uma devolução esquecida no acerto da entrega do dia seguinte.
 * Limite da estrutura atual: um registro de devolução por acerto.
 * Todos os dados críticos são validados dentro de transação serializável.
 */
export async function POST(request: NextRequest) {
  try {
    const acesso = await autorizarUsuario(request, ["DONO", "FUNCIONARIO"]);
    if (!acesso.ok) return respostaErro(acesso.erro, acesso.status);

    const corpo = await request.json().catch(() => null);
    const entregaAnteriorId = idValido(corpo?.entregaAnteriorId);
    const entregaAtualId = idValido(corpo?.entregaAtualId);
    const observacoes = typeof corpo?.observacoes === "string" ? corpo.observacoes.trim() : "";
    const itens: ItemRecebido[] = corpo?.itens;

    if (!entregaAnteriorId || !entregaAtualId || entregaAnteriorId === entregaAtualId) {
      return respostaErro("Informe as IDs válidas da entrega anterior e da movimentação atual.");
    }
    if (!Array.isArray(itens) || itens.length === 0 || itens.length > 100) {
      return respostaErro("Informe de 1 a 100 itens para devolução.");
    }
    if (observacoes.length > 500) return respostaErro("Observações podem ter até 500 caracteres.");

    const itensNormalizados: { itemEntregaId: number; quantidadeDevolvida: number }[] = [];
    const idsRecebidos = new Set<number>();
    for (const item of itens) {
      const itemId = idValido(item?.itemEntregaId);
      const quantidade = idValido(item?.quantidadeDevolvida);
      if (!itemId || !quantidade) return respostaErro("Todos os itens e quantidades devem ser números inteiros positivos.");
      if (idsRecebidos.has(itemId)) return respostaErro("Há um item repetido na devolução.");
      idsRecebidos.add(itemId);
      itensNormalizados.push({ itemEntregaId: itemId, quantidadeDevolvida: quantidade });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const [atual, anterior] = await Promise.all([
        tx.entrega.findUnique({
          where: { id: entregaAtualId },
          include: {
            itens: { select: { id: true, produtoId: true, precoUnitario: true } },
            acerto: { select: { id: true, pagamentoId: true, devolucaoId: true, quantidadeDevolvida: true, valorBruto: true, valorDevolvido: true, valorDevido: true } },
          },
        }),
        tx.entrega.findUnique({
          where: { id: entregaAnteriorId },
          include: {
            itens: {
              include: {
                itensDevolucao: { include: { devolucao: { select: { canceladoEm: true } } } },
              },
            },
          },
        }),
      ]);

      if (!atual) throw new Error("ENTREGA_ATUAL_INVALIDA");
      if (!anterior) throw new Error("ENTREGA_ANTERIOR_INVALIDA");
      if (atual.canceladoEm || anterior.canceladoEm) throw new Error("ENTREGA_CANCELADA");
      if (atual.padariaId !== anterior.padariaId) throw new Error("PADARIA_DIFERENTE");
      const dias = Math.round((Date.UTC(atual.dataEntrega.getUTCFullYear(), atual.dataEntrega.getUTCMonth(), atual.dataEntrega.getUTCDate()) - Date.UTC(anterior.dataEntrega.getUTCFullYear(), anterior.dataEntrega.getUTCMonth(), anterior.dataEntrega.getUTCDate())) / 86400000);
      if (dias !== 1) throw new Error("DATA_INCORRETA");
      if (atual.status === "FINALIZADA") throw new Error("MOVIMENTACAO_FINALIZADA");
      if (!atual.acerto) throw new Error("ACERTO_INEXISTENTE");
      if (atual.acerto.pagamentoId !== null) throw new Error("ACERTO_FECHADO");
      if (atual.acerto.devolucaoId !== null) throw new Error("DEVOLUCAO_EXISTENTE");

      let quantidadeTotal = 0;
      let descontoCentavos = 0;
      const itensParaCriar: { itemEntregaId: number; quantidadeDevolvida: number; precoUnitario: Prisma.Decimal }[] = [];

      for (const item of itensNormalizados) {
        const itemAnterior = anterior.itens.find((i) => i.id === item.itemEntregaId);
        if (!itemAnterior) throw new Error("ITEM_INVALIDO");
        const devolvidoAtivo = itemAnterior.itensDevolucao
          .filter((registro) => registro.devolucao.canceladoEm === null)
          .reduce((soma, registro) => soma + registro.quantidadeDevolvida, 0);
        if (item.quantidadeDevolvida > itemAnterior.quantidadeEntregue - devolvidoAtivo) {
          throw new Error("QUANTIDADE_EXCEDIDA");
        }
        const itemAtual = atual.itens.find((i) => i.produtoId === itemAnterior.produtoId);
        if (!itemAtual) throw new Error("PRODUTO_NAO_ENTREGUE");
        // Prisma.Decimal preserva os centavos, evitando erro de ponto flutuante.
        const precoAtual = new Prisma.Decimal(itemAtual.precoUnitario);
        const desconto = precoAtual.mul(item.quantidadeDevolvida).mul(100);
        if (!desconto.isInteger() || !desconto.isFinite()) throw new Error("VALOR_INVALIDO");
        descontoCentavos += desconto.toNumber();
        quantidadeTotal += item.quantidadeDevolvida;
        // O item devolvido mantém seu preço original para histórico; o desconto usa o preço atual.
        itensParaCriar.push({
          itemEntregaId: itemAnterior.id,
          quantidadeDevolvida: item.quantidadeDevolvida,
          precoUnitario: itemAnterior.precoUnitario,
        });
      }

      const valorBrutoCentavos = new Prisma.Decimal(atual.acerto.valorBruto).mul(100).toNumber();
      const descontoAnteriorCentavos = new Prisma.Decimal(atual.acerto.valorDevolvido).mul(100).toNumber();
      const devidoAnteriorCentavos = new Prisma.Decimal(atual.acerto.valorDevido).mul(100).toNumber();
      const novoDesconto = descontoAnteriorCentavos + descontoCentavos;
      const novoDevido = valorBrutoCentavos - novoDesconto;
      if (![valorBrutoCentavos, novoDesconto, novoDevido, quantidadeTotal].every(Number.isSafeInteger) || novoDevido < 0 || devidoAnteriorCentavos !== valorBrutoCentavos - descontoAnteriorCentavos) {
        throw new Error("VALOR_INVALIDO");
      }

      const devolucao = await tx.devolucao.create({
        data: {
          entregaId: anterior.id,
          dataDevolucao: new Date(),
          registradaPorId: acesso.usuario.id,
          observacoes: observacoes || `Devolução complementar no acerto da movimentação ${atual.codigo}.`,
          itens: { create: itensParaCriar },
        },
        select: { id: true },
      });

      // Evita associar a devolução caso outro processo tenha fechado o acerto.
      const atualizado = await tx.acertoMovimentacao.updateMany({
        where: { id: atual.acerto.id, pagamentoId: null, devolucaoId: null, quantidadeDevolvida: 0, valorDevolvido: 0, entrega: { canceladoEm: null, status: { not: "FINALIZADA" } } },
        data: {
          devolucaoId: devolucao.id,
          quantidadeDevolvida: atual.acerto.quantidadeDevolvida + quantidadeTotal,
          valorDevolvido: new Prisma.Decimal(novoDesconto).div(100).toFixed(2),
          valorDevido: new Prisma.Decimal(novoDevido).div(100).toFixed(2),
        },
      });
      if (atualizado.count !== 1) throw new Error("ACERTO_FECHADO");
      await tx.entrega.updateMany({ where: { id: anterior.id, canceladoEm: null }, data: { status: "COM_DEVOLUCAO" } });
      await tx.historico.create({
        data: {
          tabelaAfetada: "Devolucao",
          registroId: devolucao.id,
          acao: "CRIADO",
          realizadoPorId: acesso.usuario.id,
          motivo: "Registro complementar de devolução esquecida",
          dadosNovos: {
            entregaAnteriorId: anterior.id,
            entregaAtualId: atual.id,
            acertoId: atual.acerto.id,
            itens: itensNormalizados,
            valorDescontado: new Prisma.Decimal(descontoCentavos).div(100).toFixed(2),
            valorDevidoAnterior: new Prisma.Decimal(devidoAnteriorCentavos).div(100).toFixed(2),
            valorDevidoAtual: new Prisma.Decimal(novoDevido).div(100).toFixed(2),
          },
        },
      });
      return {
        devolucaoId: devolucao.id,
        entregaAnteriorId: anterior.id,
        entregaAtualId: atual.id,
        acertoId: atual.acerto.id,
        quantidadeDevolvida: quantidadeTotal,
        desconto: Number(new Prisma.Decimal(descontoCentavos).div(100).toFixed(2)),
        valorDevidoAtualizado: Number(new Prisma.Decimal(novoDevido).div(100).toFixed(2)),
      };
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ sucesso: true, ...resultado }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    if (erro instanceof Error) {
      const conhecido = erroConhecido(erro.message);
      if (conhecido) return respostaErro(...conhecido);
      if ("code" in erro && erro.code === "P2034") {
        return respostaErro("Outra operação alterou os dados. Atualize a página e tente novamente.", 409);
      }
    }
    console.error("Erro na devolução complementar:", erro);
    return respostaErro("Não foi possível registrar a devolução complementar.", 500);
  }
}
