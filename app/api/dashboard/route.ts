import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const hoje = new Date();

    hoje.setHours(0, 0, 0, 0);

    const [
      entregasHoje,
      pagamentosPendentes,
      padarias,
      produtos,
    ] = await Promise.all([
      prisma.entrega.findMany({
        where: {
          dataEntrega: {
            gte: hoje,
          },
        },
        include: {
          itens: true,
        },
      }),

      prisma.pagamento.findMany({
        where: {
          status: "PENDENTE",
        },
      }),

      prisma.padaria.findMany(),

      prisma.produto.findMany(),
    ]);

    let valorReceber = 0;

    let quantidadeEntregas = 0;

    for (const entrega of entregasHoje) {
      quantidadeEntregas++;

      for (const item of entrega.itens) {
        valorReceber +=
          item.quantidadeEntregue *
          Number(item.precoUnitario);
      }
    }

    return NextResponse.json({
      indicadores: {
        movimentacoesHoje: quantidadeEntregas,

        valorReceber,

        pagamentosPendentes:
          pagamentosPendentes.length,

        totalPadarias: padarias.length,

        totalProdutos: produtos.length,
      },

      entregasHoje,

      pagamentosPendentes,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        erro:
          "Erro ao carregar dashboard.",
      },
      {
        status: 500,
      }
    );
  }
}