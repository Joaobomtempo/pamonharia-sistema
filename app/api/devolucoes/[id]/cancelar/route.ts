import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "../../../../generated/prisma/client";
import { autorizarUsuario } from "../../../../../lib/autorizarUsuario";
import { prisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";
const erroResposta = (erro: string, status = 400) => NextResponse.json({ erro }, { status, headers: { "Cache-Control": "no-store" } });

const erros: Record<string, [string, number]> = {
  NAO_ENCONTRADA: ["Devolução não encontrada.", 404],
  JA_CANCELADA: ["Esta devolução já foi cancelada.", 409],
  ORIGEM_CANCELADA: ["A entrega anterior está cancelada.", 409],
  SEM_ACERTO: ["Esta devolução não está associada a um acerto; cancelamento automático indisponível.", 409],
  ACERTO_FECHADO: ["O acerto está vinculado a um fechamento financeiro e não pode ser alterado.", 409],
  ACERTO_FINALIZADO: ["A movimentação está finalizada e não pode ser alterada.", 409],
  MOVIMENTACAO_CANCELADA: ["A movimentação relacionada já está cancelada.", 409],
  INCONSISTENCIA: ["Os valores do acerto não estão consistentes. Nenhuma alteração foi feita; solicite uma conferência administrativa.", 409],
  CONCORRENCIA: ["Os dados foram alterados durante a operação. Atualize e tente novamente.", 409],
};

/** Cancelamento lógico e estorno financeiro em uma única transação. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const acesso = await autorizarUsuario(request, ["DONO", "FUNCIONARIO"]);
    if (!acesso.ok) return erroResposta(acesso.erro, acesso.status);
    const { id: textoId } = await params;
    const id = Number(textoId);
    if (!Number.isSafeInteger(id) || id <= 0) return erroResposta("ID de devolução inválido.");
    const corpo = await request.json().catch(() => null);
    const motivo = typeof corpo?.motivo === "string" ? corpo.motivo.trim() : "";
    if (motivo.length < 10 || motivo.length > 500) return erroResposta("Informe o motivo do cancelamento (10 a 500 caracteres).");

    const resultado = await prisma.$transaction(async tx => {
      const devolucao = await tx.devolucao.findUnique({
        where: { id },
        include: {
          entrega: { select: { id: true, canceladoEm: true, status: true } },
          itens: { include: { itemEntrega: { select: { produtoId: true } } } },
          acerto: {
            include: {
              entrega: { include: { itens: { select: { produtoId: true, precoUnitario: true } } } },
            },
          },
        },
      });
      if (!devolucao) throw new Error("NAO_ENCONTRADA");
      if (devolucao.canceladoEm) throw new Error("JA_CANCELADA");
      if (devolucao.entrega.canceladoEm) throw new Error("ORIGEM_CANCELADA");
      const acerto = devolucao.acerto;
      if (!acerto || acerto.devolucaoId !== id) throw new Error("SEM_ACERTO");
      if (acerto.pagamentoId !== null) throw new Error("ACERTO_FECHADO");
      if (acerto.entrega.canceladoEm) throw new Error("MOVIMENTACAO_CANCELADA");
      if (acerto.entrega.status === "FINALIZADA") throw new Error("ACERTO_FINALIZADO");
      let unidades = 0;
      let centavos = 0;
      for (const item of devolucao.itens) {
        const precoHoje = acerto.entrega.itens.find(i => i.produtoId === item.itemEntrega.produtoId)?.precoUnitario;
        if (precoHoje == null || item.quantidadeDevolvida <= 0) throw new Error("INCONSISTENCIA");
        const subtotal = new Prisma.Decimal(precoHoje).mul(item.quantidadeDevolvida).mul(100);
        if (!subtotal.isInteger() || !subtotal.isFinite()) throw new Error("INCONSISTENCIA");
        unidades += item.quantidadeDevolvida;
        centavos += subtotal.toNumber();
      }
      const bruto = new Prisma.Decimal(acerto.valorBruto).mul(100).toNumber();
      const descontado = new Prisma.Decimal(acerto.valorDevolvido).mul(100).toNumber();
      const devido = new Prisma.Decimal(acerto.valorDevido).mul(100).toNumber();
      const novoDescontado = descontado - centavos;
      const novoDevido = devido + centavos;
      const novasUnidades = acerto.quantidadeDevolvida - unidades;
      if (!devolucao.itens.length || ![unidades, centavos, bruto, descontado, devido, novoDescontado, novoDevido, novasUnidades].every(Number.isSafeInteger)
        || novasUnidades < 0 || novoDescontado < 0 || novoDevido < 0 || novoDevido > bruto
        || devido !== bruto - descontado || novoDevido !== bruto - novoDescontado) throw new Error("INCONSISTENCIA");

      const mudanca = await tx.acertoMovimentacao.updateMany({
        where: { id: acerto.id, devolucaoId: id, pagamentoId: null, entrega: { canceladoEm: null, status: { not: "FINALIZADA" } } },
        data: { devolucaoId: null, quantidadeDevolvida: novasUnidades,
          valorDevolvido: new Prisma.Decimal(novoDescontado).div(100).toFixed(2),
          valorDevido: new Prisma.Decimal(novoDevido).div(100).toFixed(2) },
      });
      if (mudanca.count !== 1) throw new Error("CONCORRENCIA");
      const cancelada = await tx.devolucao.updateMany({
        where: { id, canceladoEm: null },
        data: { canceladoEm: new Date(), canceladoPorId: acesso.usuario.id, motivoCancelamento: motivo },
      });
      if (cancelada.count !== 1) throw new Error("CONCORRENCIA");

      // Volta o status da entrega de origem apenas se não restar nenhuma devolução ativa.
      const outras = await tx.devolucao.count({ where: { entregaId: devolucao.entregaId, canceladoEm: null } });
      if (outras === 0 && devolucao.entrega.status === "COM_DEVOLUCAO") {
        await tx.entrega.updateMany({ where: { id: devolucao.entregaId, status: "COM_DEVOLUCAO", canceladoEm: null }, data: { status: "CONFIRMADA" } });
      }
      await tx.historico.create({ data: {
        tabelaAfetada: "Devolucao", registroId: id, acao: "EXCLUIDO", realizadoPorId: acesso.usuario.id, motivo,
        dadosAnteriores: { entregaAnteriorId: devolucao.entregaId, entregaAtualId: acerto.entregaId,
          acertoId: acerto.id, quantidadeDevolvida: acerto.quantidadeDevolvida,
          valorDevolvido: String(acerto.valorDevolvido), valorDevido: String(acerto.valorDevido) },
        dadosNovos: { cancelado: true, quantidadeDevolvida: novasUnidades,
          valorDevolvido: new Prisma.Decimal(novoDescontado).div(100).toFixed(2),
          valorDevido: new Prisma.Decimal(novoDevido).div(100).toFixed(2), estorno: new Prisma.Decimal(centavos).div(100).toFixed(2) },
      } });
      return { devolucaoId: id, acertoId: acerto.id, estorno: centavos / 100, valorDevidoAtualizado: novoDevido / 100 };
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ sucesso: true, ...resultado }, { headers: { "Cache-Control": "no-store" } });
  } catch (falha) {
    if (falha instanceof Error) {
      if (erros[falha.message]) return erroResposta(...erros[falha.message]);
      if ("code" in falha && falha.code === "P2034") return erroResposta(...erros.CONCORRENCIA);
    }
    console.error("Falha no cancelamento de devolução:", falha);
    return erroResposta("Não foi possível cancelar a devolução.", 500);
  }
}
