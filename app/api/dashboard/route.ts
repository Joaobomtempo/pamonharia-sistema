import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dataBrasil = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());

    const inicioDia = new Date(`${dataBrasil}T03:00:00.000Z`);
    const fimDia = new Date(inicioDia.getTime() + 86400000);

    const [
      movimentacoesHoje,
      ultimasEntregas,
      quantidadePendente,
      pagamentosPendentes,
      todosPagamentosPendentes,
      totalPadarias,
      totalProdutos,
      entregasParaRanking,
    ] = await Promise.all([
      prisma.entrega.count({
        where: {
          canceladoEm: null,
          dataEntrega: { gte: inicioDia, lt: fimDia },
        },
      }),
      prisma.entrega.findMany({
        where: { canceladoEm: null },
        take: 8,
        orderBy: [{ dataEntrega: "desc" }, { id: "desc" }],
        include: {
          padaria: { select: { id: true, nome: true } },
          itens: { select: { quantidadeEntregue: true, precoUnitario: true } },
        },
      }),
      prisma.pagamento.count({ where: { status: "PENDENTE" } }),
      prisma.pagamento.findMany({
        where: { status: "PENDENTE" },
        take: 8,
        orderBy: { criadoEm: "desc" },
        include: { padaria: { select: { id: true, nome: true } } },
      }),
      prisma.pagamento.aggregate({
        where: { status: "PENDENTE" },
        _sum: { valorDevido: true },
      }),
      prisma.padaria.count(),
      prisma.produto.count(),
      prisma.entrega.findMany({
        where: { canceladoEm: null },
        select: {
          padariaId: true,
          padaria: { select: { nome: true } },
          itens: { select: { quantidadeEntregue: true, precoUnitario: true } },
        },
      }),
    ]);

    const ultimasMovimentacoes = ultimasEntregas.map((entrega) => {
      const valorTotalEntregue = entrega.itens.reduce(
        (total, item) => total + item.quantidadeEntregue * Number(item.precoUnitario), 0
      );
      return {
        id: entrega.id,
        codigo: entrega.codigo,
        dataEntrega: entrega.dataEntrega,
        status: entrega.status,
        padaria: entrega.padaria,
        valorTotalEntregue: Number(valorTotalEntregue.toFixed(2)),
      };
    });

    const mapaPadarias = new Map<number, {
      id: number;
      nome: string;
      valorEntregue: number;
      totalEntregas: number;
    }>();

    for (const entrega of entregasParaRanking) {
      const valorEntrega = entrega.itens.reduce(
        (total, item) => total + item.quantidadeEntregue * Number(item.precoUnitario), 0
      );
      const anterior = mapaPadarias.get(entrega.padariaId);
      mapaPadarias.set(entrega.padariaId, {
        id: entrega.padariaId,
        nome: entrega.padaria.nome,
        valorEntregue: (anterior?.valorEntregue ?? 0) + valorEntrega,
        totalEntregas: (anterior?.totalEntregas ?? 0) + 1,
      });
    }

    const rankingPadarias = Array.from(mapaPadarias.values())
      .sort((a, b) => b.valorEntregue - a.valorEntregue)
      .slice(0, 5)
      .map((item) => ({ ...item, valorEntregue: Number(item.valorEntregue.toFixed(2)) }));

    return NextResponse.json({
      indicadores: {
        movimentacoesHoje,
        valorReceber: Number(todosPagamentosPendentes._sum.valorDevido ?? 0),
        pagamentosPendentes: quantidadePendente,
        totalPadarias,
        totalProdutos,
      },
      ultimasMovimentacoes,
      pagamentosPendentes: pagamentosPendentes.map((pagamento) => ({
        id: pagamento.id,
        padaria: pagamento.padaria,
        valorDevido: Number(pagamento.valorDevido),
        dataInicio: pagamento.dataInicio,
        dataFim: pagamento.dataFim,
        status: pagamento.status,
      })),
      rankingPadarias,
    });
  } catch (error) {
    console.error("Erro no Dashboard:", error);
    return NextResponse.json({ erro: "Não foi possível carregar o Dashboard." }, { status: 500 });
  }
}
