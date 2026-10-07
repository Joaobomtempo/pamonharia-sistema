import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

type ItemNovaEntrega = {
  produtoId: number;
  quantidadeEntregue: number;
  precoUnitario: number;
};

type ItemDevolucaoRecebido = {
  itemEntregaId: number;
  quantidadeDevolvida: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const padariaId = Number(body.padariaId);

    const dataEntrega = body.dataEntrega;

    const itensEntrega: ItemNovaEntrega[] =
      Array.isArray(body.itensEntrega)
        ? body.itensEntrega
        : [];

    const devolucao = body.devolucao || null;

    /*
     * VALIDAÇÕES BÁSICAS
     */

    if (!padariaId) {
      return NextResponse.json(
        {
          erro: "Informe a padaria.",
        },
        {
          status: 400,
        }
      );
    }

    if (!dataEntrega) {
      return NextResponse.json(
        {
          erro: "Informe a data da movimentação.",
        },
        {
          status: 400,
        }
      );
    }

    if (itensEntrega.length === 0) {
      return NextResponse.json(
        {
          erro:
            "Informe pelo menos um produto para a nova entrega.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Por enquanto usamos o primeiro usuário,
     * pois o login ainda será implementado.
     */
    const usuario =
      await prisma.usuario.findFirst();

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

    /*
     * Confere se a padaria realmente existe.
     */
    const padaria =
      await prisma.padaria.findUnique({
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
     * VALIDA A NOVA ENTREGA
     */

    const produtosUsados = new Set<number>();

    for (const item of itensEntrega) {
      const produtoId = Number(
        item.produtoId
      );

      const quantidadeEntregue = Number(
        item.quantidadeEntregue
      );

      const precoUnitario = Number(
        item.precoUnitario
      );

      if (!produtoId) {
        return NextResponse.json(
          {
            erro:
              "Todos os itens devem possuir um produto.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !Number.isInteger(
          quantidadeEntregue
        ) ||
        quantidadeEntregue <= 0
      ) {
        return NextResponse.json(
          {
            erro:
              "A quantidade entregue deve ser um número inteiro maior que zero.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !Number.isFinite(precoUnitario) ||
        precoUnitario <= 0
      ) {
        return NextResponse.json(
          {
            erro:
              "O preço unitário deve ser maior que zero.",
          },
          {
            status: 400,
          }
        );
      }

      if (produtosUsados.has(produtoId)) {
        return NextResponse.json(
          {
            erro:
              "O mesmo produto não pode aparecer duas vezes na nova entrega.",
          },
          {
            status: 400,
          }
        );
      }

      produtosUsados.add(produtoId);
    }

    /*
     * Confere se todos os produtos existem.
     */
    const produtos =
      await prisma.produto.findMany({
        where: {
          id: {
            in: Array.from(produtosUsados),
          },
        },
      });

    if (
      produtos.length !==
      produtosUsados.size
    ) {
      return NextResponse.json(
        {
          erro:
            "Um ou mais produtos informados não existem.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * A PARTIR DAQUI COMEÇA A OPERAÇÃO ATÔMICA.
     *
     * Tudo acontece dentro da mesma transaction.
     */
    const resultado =
      await prisma.$transaction(
        async (tx) => {
          let novaDevolucao = null;

          /*
           * ========================================
           * 1. DEVOLUÇÃO DA ENTREGA ANTERIOR
           * ========================================
           */

          if (
            devolucao &&
            Array.isArray(devolucao.itens) &&
            devolucao.itens.length > 0
          ) {
            const entregaAnteriorId =
              Number(
                devolucao.entregaId
              );

            if (!entregaAnteriorId) {
              throw new Error(
                "ENTREGA_ANTERIOR_INVALIDA"
              );
            }

            /*
             * Buscamos novamente dentro da transação.
             *
             * Isso evita depender somente dos dados
             * enviados pelo navegador.
             */
            const entregaAnterior =
              await tx.entrega.findUnique({
                where: {
                  id: entregaAnteriorId,
                },

                include: {
                  itens: {
                    include: {
                      produto: true,

                      itensDevolucao: true,

                      pagamentosItens: true,
                    },
                  },
                },
              });

            if (!entregaAnterior) {
              throw new Error(
                "ENTREGA_ANTERIOR_NAO_ENCONTRADA"
              );
            }

            /*
             * A devolução precisa pertencer
             * à mesma padaria da movimentação.
             */
            if (
              entregaAnterior.padariaId !==
              padariaId
            ) {
              throw new Error(
                "ENTREGA_OUTRA_PADARIA"
              );
            }

            /*
             * A entrega devolvida precisa ser
             * anterior à movimentação atual.
             */
            const dataAnterior =
              new Date(
                entregaAnterior.dataEntrega
              ).getTime();

            const dataAtual =
              new Date(
                dataEntrega
              ).getTime();

            if (
              dataAnterior >= dataAtual
            ) {
              throw new Error(
                "DATA_DEVOLUCAO_INVALIDA"
              );
            }

            /*
             * Mantemos a proteção financeira
             * que já existia no sistema.
             *
             * Depois vamos revisar isso junto
             * com a nova lógica de pagamentos.
             */
            const possuiPagamento =
              entregaAnterior.itens.some(
                (item) =>
                  item.pagamentosItens
                    .length > 0
              );

            if (possuiPagamento) {
              throw new Error(
                "ENTREGA_JA_PAGA"
              );
            }

            const itensDevolucaoValidados: {
            itemEntregaId: number;
            quantidadeDevolvida: number;
            precoUnitario: typeof entregaAnterior.itens[number]["precoUnitario"];
                 }[] = [];

            /*
             * Usado para impedir que o mesmo
             * item seja enviado duas vezes.
             */
            const itensRecebidos =
              new Set<number>();

            for (
              const itemRecebido of
              devolucao.itens as ItemDevolucaoRecebido[]
            ) {
              const itemEntregaId =
                Number(
                  itemRecebido.itemEntregaId
                );

              const quantidadeDevolvida =
                Number(
                  itemRecebido.quantidadeDevolvida
                );

              if (
                itensRecebidos.has(
                  itemEntregaId
                )
              ) {
                throw new Error(
                  "ITEM_DEVOLUCAO_DUPLICADO"
                );
              }

              itensRecebidos.add(
                itemEntregaId
              );

              const itemAnterior =
                entregaAnterior.itens.find(
                  (item) =>
                    item.id ===
                    itemEntregaId
                );

              if (!itemAnterior) {
                throw new Error(
                  "ITEM_NAO_PERTENCE_ENTREGA"
                );
              }

              if (
                !Number.isInteger(
                  quantidadeDevolvida
                ) ||
                quantidadeDevolvida <= 0
              ) {
                throw new Error(
                  "QUANTIDADE_DEVOLVIDA_INVALIDA"
                );
              }

              /*
               * Quantidade já devolvida
               * anteriormente.
               */
              const totalJaDevolvido =
                itemAnterior.itensDevolucao.reduce(
                  (
                    total,
                    itemDevolvido
                  ) =>
                    total +
                    itemDevolvido.quantidadeDevolvida,
                  0
                );

              const disponivel =
                itemAnterior.quantidadeEntregue -
                totalJaDevolvido;

              /*
               * REGRA:
               *
               * nunca pode devolver mais do
               * que restou da entrega original.
               */
              if (
                quantidadeDevolvida >
                disponivel
              ) {
                throw new Error(
                  `DEVOLUCAO_MAIOR_DISPONIVEL:${itemAnterior.produto.nome}:${disponivel}`
                );
              }

              /*
               * Agora localizamos o mesmo produto
               * na entrega realizada hoje.
               */
              const itemHoje =
                itensEntrega.find(
                  (item) =>
                    Number(
                      item.produtoId
                    ) ===
                    itemAnterior.produtoId
                );

              /*
               * Como a regra financeira é:
               *
               * entrega hoje - devolução hoje
               *
               * não permitimos devolução de um
               * produto que não esteja sendo
               * entregue na movimentação atual.
               */
              if (!itemHoje) {
                throw new Error(
                  `PRODUTO_NAO_ENTREGUE_HOJE:${itemAnterior.produto.nome}`
                );
              }

              /*
               * Também impedimos quantidade
               * cobrada negativa.
               */
              if (
                quantidadeDevolvida >
                Number(
                  itemHoje.quantidadeEntregue
                )
              ) {
                throw new Error(
                  `DEVOLUCAO_MAIOR_ENTREGA_HOJE:${itemAnterior.produto.nome}:${itemHoje.quantidadeEntregue}`
                );
              }

              itensDevolucaoValidados.push(
                {
                  itemEntregaId:
                    itemAnterior.id,

                  quantidadeDevolvida,

                  precoUnitario:
                    itemAnterior.precoUnitario,
                }
              );
            }

            /*
             * Cria uma única devolução contendo
             * todos os itens devolvidos.
             */
            novaDevolucao =
              await tx.devolucao.create({
                data: {
                  entregaId:
                    entregaAnterior.id,

                  registradaPorId:
                    usuario.id,

                  observacoes:
                    devolucao.observacoes ||
                    `Registrada junto à movimentação de ${dataEntrega}.`,

                  itens: {
                    create:
                      itensDevolucaoValidados.map(
                        (item) => ({
                          itemEntregaId:
                            item.itemEntregaId,

                          quantidadeDevolvida:
                            item.quantidadeDevolvida,

                          precoUnitario:
                            item.precoUnitario,
                        })
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

            /*
             * Atualiza o status da entrega antiga.
             */
            await tx.entrega.update({
              where: {
                id:
                  entregaAnterior.id,
              },

              data: {
                status:
                  "COM_DEVOLUCAO",
              },
            });
          }

          /*
           * ========================================
           * 2. NOVA ENTREGA DO DIA
           * ========================================
           */

          const novaEntrega =
            await tx.entrega.create({
              data: {
                codigo: `ENT-${Date.now()}`,

                padariaId,

                dataEntrega:
                  new Date(dataEntrega),

                criadoPorId:
                  usuario.id,

                itens: {
                  create:
                    itensEntrega.map(
                      (item) => ({
                        produtoId:
                          Number(
                            item.produtoId
                          ),

                        quantidadeEntregue:
                          Number(
                            item.quantidadeEntregue
                          ),

                        precoUnitario:
                          Number(
                            item.precoUnitario
                          ),
                      })
                    ),
                },
              },

              include: {
                padaria: true,

                itens: {
                  include: {
                    produto: true,

                    itensDevolucao: {
                      select: {
                        quantidadeDevolvida:
                          true,
                      },
                    },
                  },
                },
              },
            });

          /*
           * ========================================
           * 3. CALCULA O ACERTO DA MOVIMENTAÇÃO
           * ========================================
           */

          const devolucoesPorProduto =
            new Map<number, number>();

          if (
            novaDevolucao
          ) {
            for (
              const item of
              novaDevolucao.itens
            ) {
              const produtoId =
                item.itemEntrega
                  .produto.id;

              const atual =
                devolucoesPorProduto.get(
                  produtoId
                ) || 0;

              devolucoesPorProduto.set(
                produtoId,
                atual +
                  item.quantidadeDevolvida
              );
            }
          }

          let quantidadeEntregue = 0;
          let quantidadeDevolvida = 0;
          let quantidadeCobrada = 0;

          let valorBruto = 0;
          let valorDevolvido = 0;
          let valorDevido = 0;

          const resumoProdutos =
            novaEntrega.itens.map(
              (item) => {
                const entregue =
                  item.quantidadeEntregue;

                const devolvido =
                  devolucoesPorProduto.get(
                    item.produtoId
                  ) || 0;

                const cobrado =
                  entregue - devolvido;

                const preco =
                  Number(
                    item.precoUnitario
                  );

                const bruto =
                  entregue * preco;

                const descontoDevolucao =
                  devolvido * preco;

                const devido =
                  cobrado * preco;

                quantidadeEntregue +=
                  entregue;

                quantidadeDevolvida +=
                  devolvido;

                quantidadeCobrada +=
                  cobrado;

                valorBruto += bruto;

                valorDevolvido +=
                  descontoDevolucao;

                valorDevido += devido;

                return {
                  produtoId:
                    item.produtoId,

                  produto:
                    item.produto.nome,

                  quantidadeEntregue:
                    entregue,

                  quantidadeDevolvida:
                    devolvido,

                  quantidadeCobrada:
                    cobrado,

                  precoUnitario:
                    preco,

                  valorBruto:
                    bruto,

                  valorDevolvido:
                    descontoDevolucao,

                  valorDevido:
                    devido,
                };
              }
            );

          /*
           * Tudo será retornado para a tela.
           */
          return {
            entrega: novaEntrega,

            devolucao:
              novaDevolucao,

            resumo: {
              quantidadeEntregue,

              quantidadeDevolvida,

              quantidadeCobrada,

              valorBruto,

              valorDevolvido,

              valorDevido,

              produtos:
                resumoProdutos,
            },
          };
        }
      );

    return NextResponse.json(
      resultado,
      {
        status: 201,
      }
    );
  } catch (erro) {
    console.error(
      "Erro ao registrar movimentação:",
      erro
    );

    /*
     * Traduzimos os erros internos para mensagens
     * compreensíveis para o funcionário.
     */
    if (erro instanceof Error) {
      if (
        erro.message ===
        "ENTREGA_ANTERIOR_INVALIDA"
      ) {
        return NextResponse.json(
          {
            erro:
              "A entrega anterior informada é inválida.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        erro.message ===
        "ENTREGA_ANTERIOR_NAO_ENCONTRADA"
      ) {
        return NextResponse.json(
          {
            erro:
              "A entrega anterior não foi encontrada.",
          },
          {
            status: 404,
          }
        );
      }

      if (
        erro.message ===
        "ENTREGA_OUTRA_PADARIA"
      ) {
        return NextResponse.json(
          {
            erro:
              "A entrega anterior pertence a outra padaria.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        erro.message ===
        "DATA_DEVOLUCAO_INVALIDA"
      ) {
        return NextResponse.json(
          {
            erro:
              "A devolução deve ser referente a uma entrega anterior à movimentação atual.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        erro.message ===
        "ENTREGA_JA_PAGA"
      ) {
        return NextResponse.json(
          {
            erro:
              "Não é possível registrar a devolução porque a entrega anterior já está vinculada a um pagamento.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        erro.message ===
        "ITEM_DEVOLUCAO_DUPLICADO"
      ) {
        return NextResponse.json(
          {
            erro:
              "O mesmo item não pode ser devolvido duas vezes na mesma movimentação.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        erro.message ===
        "ITEM_NAO_PERTENCE_ENTREGA"
      ) {
        return NextResponse.json(
          {
            erro:
              "Um dos produtos devolvidos não pertence à entrega anterior.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        erro.message ===
        "QUANTIDADE_DEVOLVIDA_INVALIDA"
      ) {
        return NextResponse.json(
          {
            erro:
              "A quantidade devolvida deve ser um número inteiro maior que zero.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        erro.message.startsWith(
          "DEVOLUCAO_MAIOR_DISPONIVEL:"
        )
      ) {
        const partes =
          erro.message.split(":");

        const produto =
          partes[1];

        const disponivel =
          partes[2];

        return NextResponse.json(
          {
            erro: `${produto}: existem apenas ${disponivel} unidade(s) disponíveis para devolução.`,
          },
          {
            status: 400,
          }
        );
      }

      if (
        erro.message.startsWith(
          "PRODUTO_NAO_ENTREGUE_HOJE:"
        )
      ) {
        const produto =
          erro.message.split(":")[1];

        return NextResponse.json(
          {
            erro: `${produto}: existe devolução informada, mas esse produto não está sendo entregue hoje.`,
          },
          {
            status: 400,
          }
        );
      }

      if (
        erro.message.startsWith(
          "DEVOLUCAO_MAIOR_ENTREGA_HOJE:"
        )
      ) {
        const partes =
          erro.message.split(":");

        const produto =
          partes[1];

        const quantidadeHoje =
          partes[2];

        return NextResponse.json(
          {
            erro: `${produto}: a devolução não pode ser maior que as ${quantidadeHoje} unidade(s) entregues hoje.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    return NextResponse.json(
      {
        erro:
          "Erro interno ao registrar a movimentação.",
      },
      {
        status: 500,
      }
    );
  }
}