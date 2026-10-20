import { NextRequest, NextResponse } from "next/server";
import { autorizarUsuario } from "../../../../lib/autorizarUsuario";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const acesso = await autorizarUsuario(request, ["DONO", "FUNCIONARIO"]);
    if (!acesso.ok) return NextResponse.json({ erro: acesso.erro }, { status: acesso.status });

    const registros = await prisma.devolucao.findMany({
      where: { canceladoEm: null, entrega: { canceladoEm: null }, acerto: { isNot: null } },
      take: 100,
      orderBy: [{ registradaEm: "desc" }, { id: "desc" }],
      select: {
        id: true, registradaEm: true, observacoes: true,
        entrega: { select: { id: true, codigo: true, dataEntrega: true, padaria: { select: { nome: true } } } },
        itens: { select: { quantidadeDevolvida: true, itemEntrega: { select: { produto: { select: { nome: true } } } } } },
        acerto: { select: { id: true, pagamentoId: true, entrega: { select: { codigo: true, dataEntrega: true, canceladoEm: true, status: true } } } },
      },
    });
    return NextResponse.json(registros.map(d => ({
      id: d.id, registradaEm: d.registradaEm, observacoes: d.observacoes,
      entregaAnterior: d.entrega,
      entregaAtual: d.acerto?.entrega,
      acertoId: d.acerto?.id,
      podeCancelar: Boolean(d.acerto && d.acerto.pagamentoId === null &&
        d.acerto.entrega.canceladoEm === null && d.acerto.entrega.status !== "FINALIZADA"),
      motivoBloqueio: d.acerto?.pagamentoId != null ? "Acerto incluído em fechamento financeiro" :
        d.acerto?.entrega.status === "FINALIZADA" ? "Movimentação finalizada" :
        d.acerto?.entrega.canceladoEm != null ? "Movimentação cancelada" : null,
      itens: d.itens.map(i => ({ produto: i.itemEntrega.produto.nome, quantidade: i.quantidadeDevolvida })),
    })), { headers: { "Cache-Control": "private, no-store" } });
  } catch (erro) {
    console.error("Erro ao consultar devoluções para cancelamento:", erro);
    return NextResponse.json({ erro: "Não foi possível consultar as devoluções." }, { status: 500 });
  }
}
