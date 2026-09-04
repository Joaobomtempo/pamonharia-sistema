import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const devolucoes = await prisma.devolucao.findMany({
    include: {
      entrega: {
        include: {
          padaria: true,
        },
      },
      itens: {
        include: {
          itemEntrega: {
            include: {
              produto: true,
            },
          },
        },
      },
      registradaPor: true,
    },
    orderBy: {
      dataDevolucao: "desc",
    },
  });

  return NextResponse.json(devolucoes);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const entregaId = Number(body.entregaId);

    if (!entregaId || !Array.isArray(body.itens) || body.itens.length === 0) {
      return NextResponse.json(
        {
          erro: "Informe a entrega e pelo menos um produto devolvido.",
        },
        {
          status: 400,
        }
      );
    }

    const usuario = await prisma.usuario.findFirst();

    if (!usuario) {
      return NextResponse.json(
        {
          erro: "Nenhum usuário cadastrado.",
        },
        {
          status: 400,
        }
      );
    }

    const entrega = await prisma.entrega.findUnique({
      where: {
        id: entregaId,
      },
      include: {
        itens: {
          include: {
            itensDevolucao: true,
          },
        },
      },
    });

    if (!entrega) {
      return NextResponse.json(
        {
          erro: "Entrega não encontrada.",
        },
        {
          status: 404,
        }
      );
    }

    for (const itemRecebido of body.itens) {
      const itemEntregaId = Number(itemRecebido.itemEntregaId);
      const quantidadeDevolvida = Number(
        itemRecebido.quantidadeDevolvida
      );

      const itemEntrega = entrega.itens.find(
        (item) => item.id === itemEntregaId
      );

      if (!itemEntrega) {
        return NextResponse.json(
          {
            erro: "Um dos produtos não pertence a esta entrega.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !Number.isInteger(quantidadeDevolvida) ||
        quantidadeDevolvida <= 0
      ) {
        return NextResponse.json(
          {
            erro: "A quantidade devolvida deve ser maior que zero.",
          },
          {
            status: 400,
          }
        );
      }

      const totalJaDevolvido = itemEntrega.itensDevolucao.reduce(
        (total, devolucao) =>
          total + devolucao.quantidadeDevolvida,
        0
      );

      const quantidadeDisponivel =
        itemEntrega.quantidadeEntregue - totalJaDevolvido;

      if (quantidadeDevolvida > quantidadeDisponivel) {
        return NextResponse.json(
          {
            erro: `Não é possível devolver ${quantidadeDevolvida} unidade(s). Restam apenas ${quantidadeDisponivel} unidade(s) disponíveis para devolução.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    const devolucao = await prisma.$transaction(async (tx) => {
      const novaDevolucao = await tx.devolucao.create({
        data: {
          entregaId,
          registradaPorId: usuario.id,
          observacoes: body.observacoes || null,

          itens: {
            create: body.itens.map(
              (itemRecebido: {
                itemEntregaId: number;
                quantidadeDevolvida: number;
              }) => {
                const itemEntrega = entrega.itens.find(
                  (item) =>
                    item.id === Number(itemRecebido.itemEntregaId)
                );

                if (!itemEntrega) {
                  throw new Error("Item da entrega não encontrado.");
                }

                return {
                  itemEntregaId: Number(itemRecebido.itemEntregaId),
                  quantidadeDevolvida: Number(
                    itemRecebido.quantidadeDevolvida
                  ),
                  precoUnitario: itemEntrega.precoUnitario,
                };
              }
            ),
          },
        },
        include: {
          itens: {
            include: {
              itemEntrega: {
                include: {
                  produto: true,
                },
              },
            },
          },
        },
      });

      await tx.entrega.update({
        where: {
          id: entregaId,
        },
        data: {
          status: "COM_DEVOLUCAO",
        },
      });

      return novaDevolucao;
    });

    return NextResponse.json(devolucao, {
      status: 201,
    });
  } catch (erro) {
    console.error("Erro ao registrar devolução:", erro);

    return NextResponse.json(
      {
        erro: "Erro interno ao registrar devolução.",
      },
      {
        status: 500,
      }
    );
  }
}