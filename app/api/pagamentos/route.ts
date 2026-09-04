import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

/*
  GET
  Lista o histórico de pagamentos.
*/
export async function GET() {
  try {
    const pagamentos = await prisma.pagamento.findMany({
      include: {
        padaria: true,

        itens: {
          include: {
            itemEntrega: {
              include: {
                produto: true,
                entrega: true,
              },
            },
          },
        },
      },

      orderBy: {
        criadoEm: "desc",
      },
    });

    return NextResponse.json(pagamentos);
  } catch (erro) {
    console.error("Erro ao buscar pagamentos:", erro);

    return NextResponse.json(
      {
        erro: "Erro ao buscar pagamentos.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
  POST
  Cria um NOVO fechamento financeiro.

  Importante:
  O pagamento nasce como PENDENTE.

  O recebimento será registrado depois
  através do PATCH.
*/
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const padariaId = Number(body.padariaId);

    const dataInicio = new Date(
      `${body.dataInicio}T00:00:00`
    );

    const dataFim = new Date(
      `${body.dataFim}T23:59:59.999`
    );

    if (
      !padariaId ||
      Number.isNaN(dataInicio.getTime()) ||
      Number.isNaN(dataFim.getTime())
    ) {
      return NextResponse.json(
        {
          erro: "Informe a padaria e um período válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (dataInicio > dataFim) {
      return NextResponse.json(
        {
          erro:
            "A data inicial não pode ser posterior à data final.",
        },
        {
          status: 400,
        }
      );
    }

    const padaria = await prisma.padaria.findUnique({
      where: {
        id: padariaId,
      },
    });

    if (!padaria) {
      return NextResponse.json(
        {
          erro: "Padaria não encontrada.",
        },
        {
          status: 404,
        }
      );
    }

    /*
      Busca todas as entregas da padaria
      dentro do período.
    */
    const entregas = await prisma.entrega.findMany({
      where: {
        padariaId,

        dataEntrega: {
          gte: dataInicio,
          lte: dataFim,
        },
      },

      include: {
        itens: {
          include: {
            itensDevolucao: true,

            pagamentosItens: {
              select: {
                id: true,
                pagamentoId: true,
              },
            },
          },
        },
      },

      orderBy: {
        dataEntrega: "asc",
      },
    });

    if (entregas.length === 0) {
      return NextResponse.json(
        {
          erro:
            "Nenhuma entrega encontrada para essa padaria nesse período.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      Seleciona apenas entregas em que TODOS
      os itens ainda não pertencem a pagamento.
    */
    const entregasDisponiveis = entregas.filter(
      (entrega) =>
        entrega.itens.length > 0 &&
        entrega.itens.every(
          (item) =>
            item.pagamentosItens.length === 0
        )
    );

    if (entregasDisponiveis.length === 0) {
      return NextResponse.json(
        {
          erro:
            "Todas as entregas desse período já estão vinculadas a um pagamento.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      Segurança extra:

      Se houver uma mistura de entregas já pagas
      e entregas livres, somente as livres entram
      neste novo fechamento.
    */
    const itensPagamento =
      entregasDisponiveis.flatMap((entrega) =>
        entrega.itens.map((item) => {
          const quantidadeDevolvida =
            item.itensDevolucao.reduce(
              (total, devolucao) =>
                total +
                devolucao.quantidadeDevolvida,
              0
            );

          const quantidadeVendida =
            item.quantidadeEntregue -
            quantidadeDevolvida;

          const precoUnitario =
            Number(item.precoUnitario);

          const valorBruto =
            item.quantidadeEntregue *
            precoUnitario;

          const valorDevolvido =
            quantidadeDevolvida *
            precoUnitario;

          const valorLiquido =
            quantidadeVendida *
            precoUnitario;

          return {
            itemEntregaId: item.id,
            quantidadeVendida,
            valorVendido: valorBruto,
            valorDevolvido,
            valorLiquido,
          };
        })
      );

    if (itensPagamento.length === 0) {
      return NextResponse.json(
        {
          erro:
            "Nenhum item disponível para pagamento.",
        },
        {
          status: 400,
        }
      );
    }

    /*
      Segunda verificação diretamente na tabela
      PagamentoItem.

      Isso reduz muito o risco de duplicidade.
    */
    const idsItens = itensPagamento.map(
      (item) => item.itemEntregaId
    );

    const itensJaPagos =
      await prisma.pagamentoItem.findMany({
        where: {
          itemEntregaId: {
            in: idsItens,
          },
        },

        select: {
          itemEntregaId: true,
        },
      });

    if (itensJaPagos.length > 0) {
      return NextResponse.json(
        {
          erro:
            "Uma ou mais entregas já estão vinculadas a outro pagamento.",
        },
        {
          status: 409,
        }
      );
    }

    const valorDevido = itensPagamento.reduce(
      (total, item) =>
        total + item.valorLiquido,
      0
    );

    /*
      O pagamento nasce sempre PENDENTE.

      Não recebemos dinheiro neste POST.
    */
    const pagamento =
      await prisma.pagamento.create({
        data: {
          padariaId,

          dataInicio,
          dataFim,

          valorDevido,

          valorRecebido: null,

          status: "PENDENTE",

          divergencia: false,

          dataPagamento: null,

          registradoPorId: null,

          itens: {
            create: itensPagamento,
          },
        },

        include: {
          padaria: true,

          itens: {
            include: {
              itemEntrega: {
                include: {
                  produto: true,
                  entrega: true,
                },
              },
            },
          },
        },
      });

    return NextResponse.json(
      pagamento,
      {
        status: 201,
      }
    );
  } catch (erro) {
    console.error(
      "Erro ao criar pagamento:",
      erro
    );

    return NextResponse.json(
      {
        erro:
          "Erro interno ao criar pagamento.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
  PATCH
  Registra o recebimento de um pagamento
  que JÁ EXISTE.

  PENDENTE → PAGO
*/
export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const pagamentoId = Number(
      body.pagamentoId
    );

    const valorRecebido = Number(
      body.valorRecebido
    );

    if (!pagamentoId) {
      return NextResponse.json(
        {
          erro: "Informe o pagamento.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(valorRecebido) ||
      valorRecebido < 0
    ) {
      return NextResponse.json(
        {
          erro:
            "Informe um valor recebido válido.",
        },
        {
          status: 400,
        }
      );
    }

    const pagamento =
      await prisma.pagamento.findUnique({
        where: {
          id: pagamentoId,
        },

        include: {
          padaria: true,
          itens: true,
        },
      });

    if (!pagamento) {
      return NextResponse.json(
        {
          erro: "Pagamento não encontrado.",
        },
        {
          status: 404,
        }
      );
    }

    if (pagamento.status === "PAGO") {
      return NextResponse.json(
        {
          erro:
            "Este pagamento já foi recebido.",
        },
        {
          status: 400,
        }
      );
    }

    const usuario =
      await prisma.usuario.findFirst();

    if (!usuario) {
      return NextResponse.json(
        {
          erro:
            "Nenhum usuário cadastrado.",
        },
        {
          status: 400,
        }
      );
    }

    const valorDevido =
      Number(pagamento.valorDevido);

    const divergencia =
      Math.abs(
        valorRecebido - valorDevido
      ) > 0.009;

    const pagamentoAtualizado =
      await prisma.pagamento.update({
        where: {
          id: pagamentoId,
        },

        data: {
          valorRecebido,

          status: "PAGO",

          divergencia,

          dataPagamento: new Date(),

          registradoPorId:
            usuario.id,
        },

        include: {
          padaria: true,

          itens: {
            include: {
              itemEntrega: {
                include: {
                  produto: true,
                  entrega: true,
                },
              },
            },
          },
        },
      });

    return NextResponse.json(
      pagamentoAtualizado
    );
  } catch (erro) {
    console.error(
      "Erro ao receber pagamento:",
      erro
    );

    return NextResponse.json(
      {
        erro:
          "Erro interno ao registrar recebimento.",
      },
      {
        status: 500,
      }
    );
  }
}