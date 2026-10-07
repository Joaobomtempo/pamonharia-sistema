"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Padaria = {
  id: number;
  nome: string;
};

type Produto = {
  id: number;
  nome: string;
  precoCadastrado: string | number;
};

type ItemDevolucao = {
  id?: number;
  quantidadeDevolvida: number;
};

type ItemEntrega = {
  id: number;
  quantidadeEntregue: number;
  precoUnitario: string | number;
  produto: Produto;
  itensDevolucao: ItemDevolucao[];
};

type Entrega = {
  id: number;
  codigo: string;
  dataEntrega: string;
  status:
    | "PENDENTE"
    | "CONFIRMADA"
    | "COM_DEVOLUCAO"
    | "FINALIZADA";
  observacoes: string | null;
  padaria: Padaria;
  itens: ItemEntrega[];
};

type ItemNovaEntrega = {
  produtoId: string;
  quantidadeEntregue: string;
  precoUnitario: string;
};

type ItemNovaDevolucao = {
  itemEntregaId: number;
  produtoId: number;
  quantidadeDevolvida: string;
};

const itemInicial: ItemNovaEntrega = {
  produtoId: "",
  quantidadeEntregue: "",
  precoUnitario: "",
};

export default function EntregasPage() {
  const [padarias, setPadarias] = useState<Padaria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);

  const [padariaId, setPadariaId] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [itensEntrega, setItensEntrega] = useState<
    ItemNovaEntrega[]
  >([{ ...itemInicial }]);

  const [itensDevolucao, setItensDevolucao] = useState<
    ItemNovaDevolucao[]
  >([]);

  const [carregando, setCarregando] = useState(false);
  const [carregandoDados, setCarregandoDados] =
    useState(true);

  async function carregarDados() {
    try {
      setCarregandoDados(true);

      const [
        respostaPadarias,
        respostaProdutos,
        respostaEntregas,
      ] = await Promise.all([
        fetch("/api/padarias"),
        fetch("/api/produtos"),
        fetch("/api/entregas"),
      ]);

      if (
        !respostaPadarias.ok ||
        !respostaProdutos.ok ||
        !respostaEntregas.ok
      ) {
        throw new Error("Erro ao carregar os dados.");
      }

      const [
        dadosPadarias,
        dadosProdutos,
        dadosEntregas,
      ] = await Promise.all([
        respostaPadarias.json(),
        respostaProdutos.json(),
        respostaEntregas.json(),
      ]);

      setPadarias(dadosPadarias);
      setProdutos(dadosProdutos);
      setEntregas(dadosEntregas);
    } catch (erro) {
      console.error(erro);
      alert("Não foi possível carregar os dados.");
    } finally {
      setCarregandoDados(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  function formatarDinheiro(valor: number | string) {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarData(data: string) {
    return new Date(data).toLocaleDateString("pt-BR", {
      timeZone: "UTC",
    });
  }

  /*
   * Procura automaticamente a entrega anterior mais recente
   * da padaria selecionada.
   */
  const entregaAnterior = useMemo(() => {
    if (!padariaId || !dataEntrega) {
      return null;
    }

    const dataAtual = new Date(
      `${dataEntrega}T12:00:00`
    ).getTime();

    const candidatas = entregas
      .filter((entrega) => {
        if (entrega.padaria.id !== Number(padariaId)) {
          return false;
        }

        const data = new Date(
          entrega.dataEntrega
        ).getTime();

        return data < dataAtual;
      })
      .sort(
        (a, b) =>
          new Date(b.dataEntrega).getTime() -
          new Date(a.dataEntrega).getTime()
      );

    return candidatas[0] || null;
  }, [entregas, padariaId, dataEntrega]);

  /*
   * Sempre que mudar a entrega anterior,
   * prepara os campos de devolução.
   */
  useEffect(() => {
    if (!entregaAnterior) {
      setItensDevolucao([]);
      return;
    }

    setItensDevolucao(
      entregaAnterior.itens.map((item) => ({
        itemEntregaId: item.id,
        produtoId: item.produto.id,
        quantidadeDevolvida: "",
      }))
    );
  }, [entregaAnterior]);

  function quantidadeJaDevolvida(
    item: ItemEntrega
  ) {
    return item.itensDevolucao.reduce(
      (total, devolucao) =>
        total + devolucao.quantidadeDevolvida,
      0
    );
  }

  function quantidadeDisponivel(
    item: ItemEntrega
  ) {
    return (
      item.quantidadeEntregue -
      quantidadeJaDevolvida(item)
    );
  }

  function alterarItemEntrega(
    indice: number,
    campo: keyof ItemNovaEntrega,
    valor: string
  ) {
    setItensEntrega((estadoAnterior) =>
      estadoAnterior.map((item, index) => {
        if (index !== indice) {
          return item;
        }

        const novoItem = {
          ...item,
          [campo]: valor,
        };

        if (campo === "produtoId") {
          const produto = produtos.find(
            (produtoAtual) =>
              produtoAtual.id === Number(valor)
          );

          novoItem.precoUnitario = produto
            ? String(produto.precoCadastrado)
            : "";
        }

        return novoItem;
      })
    );
  }

  function alterarDevolucao(
    itemEntregaId: number,
    valor: string
  ) {
    setItensDevolucao((estadoAnterior) =>
      estadoAnterior.map((item) =>
        item.itemEntregaId === itemEntregaId
          ? {
              ...item,
              quantidadeDevolvida: valor,
            }
          : item
      )
    );
  }

  function adicionarProduto() {
    setItensEntrega((estadoAnterior) => [
      ...estadoAnterior,
      { ...itemInicial },
    ]);
  }

  function removerProduto(indice: number) {
    if (itensEntrega.length === 1) {
      alert(
        "A nova entrega deve possuir pelo menos um produto."
      );
      return;
    }

    setItensEntrega((estadoAnterior) =>
      estadoAnterior.filter(
        (_, index) => index !== indice
      )
    );
  }

  /*
   * Retorna a quantidade que está sendo devolvida
   * hoje de determinado produto.
   */
  function devolucaoDoProduto(produtoId: number) {
    return itensDevolucao
      .filter(
        (item) => item.produtoId === produtoId
      )
      .reduce(
        (total, item) =>
          total +
          Number(item.quantidadeDevolvida || 0),
        0
      );
  }

  /*
   * Resumo financeiro da visita.
   *
   * REGRA DO CLIENTE:
   *
   * entregue hoje - devolvido hoje = quantidade cobrada
   */
  const resumoMovimentacao = useMemo(() => {
    let unidadesEntregues = 0;
    let unidadesDevolvidas = 0;
    let unidadesCobradas = 0;

    let valorBruto = 0;
    let valorDevolvido = 0;
    let valorDevido = 0;

    const produtosResumo = itensEntrega
      .filter((item) => item.produtoId)
      .map((item) => {
        const produtoId = Number(item.produtoId);

        const produto = produtos.find(
          (produtoAtual) =>
            produtoAtual.id === produtoId
        );

        const quantidadeEntregue = Number(
          item.quantidadeEntregue || 0
        );

        const precoUnitario = Number(
          String(item.precoUnitario || 0).replace(
            ",",
            "."
          )
        );

        const quantidadeDevolvida =
          devolucaoDoProduto(produtoId);

        const quantidadeCobrada =
          quantidadeEntregue -
          quantidadeDevolvida;

        const bruto =
          quantidadeEntregue * precoUnitario;

        const devolvido =
          quantidadeDevolvida * precoUnitario;

        const devido =
          quantidadeCobrada * precoUnitario;

        unidadesEntregues += quantidadeEntregue;
        unidadesDevolvidas += quantidadeDevolvida;
        unidadesCobradas += quantidadeCobrada;

        valorBruto += bruto;
        valorDevolvido += devolvido;
        valorDevido += devido;

        return {
          produtoId,
          nome: produto?.nome || "Produto",
          quantidadeEntregue,
          quantidadeDevolvida,
          quantidadeCobrada,
          precoUnitario,
          bruto,
          devolvido,
          devido,
        };
      });

    return {
      produtosResumo,
      unidadesEntregues,
      unidadesDevolvidas,
      unidadesCobradas,
      valorBruto,
      valorDevolvido,
      valorDevido,
    };
  }, [
    itensEntrega,
    itensDevolucao,
    produtos,
  ]);

  async function registrarMovimentacao(
    evento: FormEvent
  ) {
    evento.preventDefault();

    if (!padariaId) {
      alert("Selecione uma padaria.");
      return;
    }

    if (!dataEntrega) {
      alert("Informe a data da movimentação.");
      return;
    }

    /*
     * Validação dos produtos da nova entrega.
     */
    for (const item of itensEntrega) {
      if (!item.produtoId) {
        alert(
          "Selecione todos os produtos da nova entrega."
        );
        return;
      }

      const quantidade = Number(
        item.quantidadeEntregue
      );

      const preco = Number(
        String(item.precoUnitario).replace(",", ".")
      );

      if (
        !Number.isInteger(quantidade) ||
        quantidade <= 0
      ) {
        alert(
          "A quantidade entregue deve ser um número inteiro maior que zero."
        );
        return;
      }

      if (
        !Number.isFinite(preco) ||
        preco <= 0
      ) {
        alert(
          "Informe um preço válido para todos os produtos."
        );
        return;
      }
    }

    /*
     * Evita produto duplicado na nova entrega.
     */
    const idsProdutos =
      itensEntrega.map(
        (item) => item.produtoId
      );

    if (
      new Set(idsProdutos).size !==
      idsProdutos.length
    ) {
      alert(
        "O mesmo produto não pode aparecer duas vezes na nova entrega."
      );
      return;
    }

    /*
     * Valida as devoluções contra a entrega anterior.
     */
    if (entregaAnterior) {
      for (const itemFormulario of itensDevolucao) {
        const quantidade = Number(
          itemFormulario.quantidadeDevolvida ||
            0
        );

        if (quantidade === 0) {
          continue;
        }

        if (
          !Number.isInteger(quantidade) ||
          quantidade < 0
        ) {
          alert(
            "A quantidade devolvida deve ser um número inteiro."
          );
          return;
        }

        const itemAnterior =
          entregaAnterior.itens.find(
            (item) =>
              item.id ===
              itemFormulario.itemEntregaId
          );

        if (!itemAnterior) {
          continue;
        }

        const disponivel =
          quantidadeDisponivel(itemAnterior);

        if (quantidade > disponivel) {
          alert(
            `${itemAnterior.produto.nome}: só existem ${disponivel} unidade(s) disponíveis para devolução.`
          );
          return;
        }

        /*
         * A devolução usada no acerto não pode gerar
         * quantidade negativa no movimento de hoje.
         */
        const itemHoje =
          itensEntrega.find(
            (item) =>
              Number(item.produtoId) ===
              itemAnterior.produto.id
          );

        if (quantidade > 0 && !itemHoje) {
          alert(
            `${itemAnterior.produto.nome}: existe devolução informada, mas esse produto não está sendo entregue hoje.`
          );
          return;
        }

        if (itemHoje) {
          const quantidadeHoje = Number(
            itemHoje.quantidadeEntregue
          );

          if (quantidade > quantidadeHoje) {
            alert(
              `${itemAnterior.produto.nome}: a devolução (${quantidade}) não pode ser maior que a quantidade entregue hoje (${quantidadeHoje}).`
            );
            return;
          }
        }
      }
    }

    const confirmar = window.confirm(
      `Confirmar movimentação?\n\n` +
        `Entregue hoje: ${resumoMovimentacao.unidadesEntregues} unidade(s)\n` +
        `Devolvido hoje: ${resumoMovimentacao.unidadesDevolvidas} unidade(s)\n` +
        `Quantidade cobrada: ${resumoMovimentacao.unidadesCobradas} unidade(s)\n` +
        `Valor do acerto: ${formatarDinheiro(
          resumoMovimentacao.valorDevido
        )}`
    );

    if (!confirmar) {
      return;
    }

    try {
      setCarregando(true);

      /*
       * ETAPA 1
       * Registra a devolução da entrega anterior,
       * caso exista alguma quantidade devolvida.
       */
      const devolucoesValidas =
        itensDevolucao.filter(
          (item) =>
            Number(
              item.quantidadeDevolvida
            ) > 0
        );

      if (
        entregaAnterior &&
        devolucoesValidas.length > 0
      ) {
        const respostaDevolucao =
          await fetch("/api/devolucoes", {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              entregaId: entregaAnterior.id,

              observacoes:
                `Devolução registrada junto à movimentação de ${dataEntrega}.`,

              itens: devolucoesValidas.map(
                (item) => ({
                  itemEntregaId:
                    item.itemEntregaId,

                  quantidadeDevolvida:
                    Number(
                      item.quantidadeDevolvida
                    ),
                })
              ),
            }),
          });

        const dadosDevolucao =
          await respostaDevolucao.json();

        if (!respostaDevolucao.ok) {
          alert(
            dadosDevolucao.erro ||
              "Não foi possível registrar a devolução."
          );

          return;
        }
      }

      /*
       * ETAPA 2
       * Registra a nova entrega de hoje.
       */
      const respostaEntrega =
        await fetch("/api/entregas", {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            padariaId: Number(padariaId),
            dataEntrega,

            observacoes:
              observacoes.trim() || null,

            itens: itensEntrega.map(
              (item) => ({
                produtoId: Number(
                  item.produtoId
                ),

                quantidadeEntregue:
                  Number(
                    item.quantidadeEntregue
                  ),

                precoUnitario: Number(
                  String(
                    item.precoUnitario
                  ).replace(",", ".")
                ),
              })
            ),
          }),
        });

      const dadosEntrega =
        await respostaEntrega.json();

      if (!respostaEntrega.ok) {
        alert(
          dadosEntrega.erro ||
            "A devolução foi registrada, mas ocorreu um erro ao registrar a nova entrega. Não tente repetir a devolução antes de verificar os dados."
        );

        return;
      }

      alert(
        `Movimentação registrada com sucesso!\n\nValor do acerto: ${formatarDinheiro(
          resumoMovimentacao.valorDevido
        )}`
      );

      setPadariaId("");
      setDataEntrega("");
      setObservacoes("");
      setItensEntrega([
        { ...itemInicial },
      ]);
      setItensDevolucao([]);

      await carregarDados();
    } catch (erro) {
      console.error(erro);

      alert(
        "Ocorreu um erro ao registrar a movimentação."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        {/* CABEÇALHO */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-2xl text-white shadow-sm">
              🚚
            </div>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Movimentação da Padaria
              </h1>

              <p className="mt-1 text-slate-600">
                Registre a devolução da entrega
                anterior e a nova entrega do dia em
                uma única operação.
              </p>
            </div>
          </div>
        </div>

        {carregandoDados ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
            <p className="text-slate-500">
              Carregando dados...
            </p>
          </div>
        ) : (
          <form
            onSubmit={registrarMovimentacao}
          >
            {/* DADOS DA VISITA */}
            <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-5">
                <h2 className="text-xl font-bold text-white">
                  Dados da movimentação
                </h2>

                <p className="mt-1 text-sm text-orange-100">
                  Primeiro selecione a padaria e a
                  data da visita.
                </p>
              </div>

              <div className="grid gap-5 p-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Padaria
                  </label>

                  <select
                    value={padariaId}
                    onChange={(evento) =>
                      setPadariaId(
                        evento.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  >
                    <option value="">
                      Selecione a padaria
                    </option>

                    {padarias.map(
                      (padaria) => (
                        <option
                          key={padaria.id}
                          value={padaria.id}
                        >
                          {padaria.nome}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Data da visita
                  </label>

                  <input
                    type="date"
                    value={dataEntrega}
                    onChange={(evento) =>
                      setDataEntrega(
                        evento.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  />
                </div>
              </div>
            </section>

            {/* DEVOLUÇÃO */}
            <section className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    ↩️
                  </span>

                  <div>
                    <h2 className="text-xl font-bold text-white">
                      1. Devolução anterior
                    </h2>

                    <p className="text-sm text-amber-100">
                      Informe o que voltou da
                      entrega anterior.
                    </p>
                  </div>
                </div>
              </div>

              {!padariaId || !dataEntrega ? (
                <div className="p-8 text-center text-slate-500">
                  Selecione a padaria e a data
                  primeiro.
                </div>
              ) : !entregaAnterior ? (
                <div className="p-8 text-center">
                  <p className="font-semibold text-slate-700">
                    Nenhuma entrega anterior
                    encontrada.
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    A movimentação poderá ser
                    registrada somente com a nova
                    entrega.
                  </p>
                </div>
              ) : (
                <div className="p-6">
                  <div className="mb-5 rounded-xl bg-amber-50 p-4">
                    <p className="text-sm text-amber-700">
                      Entrega anterior encontrada
                    </p>

                    <p className="mt-1 font-bold text-amber-950">
                      {
                        entregaAnterior.padaria
                          .nome
                      }{" "}
                      •{" "}
                      {formatarData(
                        entregaAnterior.dataEntrega
                      )}{" "}
                      •{" "}
                      {entregaAnterior.codigo}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {entregaAnterior.itens.map(
                      (item) => {
                        const jaDevolvido =
                          quantidadeJaDevolvida(
                            item
                          );

                        const disponivel =
                          quantidadeDisponivel(
                            item
                          );

                        const formulario =
                          itensDevolucao.find(
                            (devolucao) =>
                              devolucao.itemEntregaId ===
                              item.id
                          );

                        return (
                          <div
                            key={item.id}
                            className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-5 md:items-end"
                          >
                            <div>
                              <p className="text-xs font-semibold uppercase text-slate-500">
                                Produto
                              </p>

                              <p className="mt-1 font-bold text-slate-900">
                                {
                                  item.produto
                                    .nome
                                }
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-semibold uppercase text-blue-600">
                                Entregue
                              </p>

                              <p className="mt-1 text-xl font-bold text-blue-900">
                                {
                                  item.quantidadeEntregue
                                }
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-semibold uppercase text-orange-600">
                                Já devolvido
                              </p>

                              <p className="mt-1 text-xl font-bold text-orange-900">
                                {jaDevolvido}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-semibold uppercase text-emerald-600">
                                Disponível
                              </p>

                              <p className="mt-1 text-xl font-bold text-emerald-900">
                                {disponivel}
                              </p>
                            </div>

                            <div>
                              <label className="mb-2 block text-xs font-semibold uppercase text-red-600">
                                Devolvendo hoje
                              </label>

                              <input
                                type="number"
                                min="0"
                                max={
                                  disponivel
                                }
                                step="1"
                                disabled={
                                  disponivel ===
                                  0
                                }
                                value={
                                  formulario?.quantidadeDevolvida ||
                                  ""
                                }
                                onChange={(
                                  evento
                                ) =>
                                  alterarDevolucao(
                                    item.id,
                                    evento
                                      .target
                                      .value
                                  )
                                }
                                placeholder="0"
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-900 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 disabled:bg-slate-100"
                              />
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* NOVA ENTREGA */}
            <section className="mb-6 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      2. Nova entrega de hoje
                    </h2>

                    <p className="mt-1 text-sm text-blue-100">
                      Informe os produtos que
                      estão sendo deixados na
                      padaria.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={adicionarProduto}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50"
                  >
                    + Adicionar produto
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-6">
                {itensEntrega.map(
                  (item, indice) => {
                    const quantidade =
                      Number(
                        item.quantidadeEntregue ||
                          0
                      );

                    const preco = Number(
                      String(
                        item.precoUnitario ||
                          0
                      ).replace(",", ".")
                    );

                    return (
                      <div
                        key={indice}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="font-bold text-slate-800">
                            Produto{" "}
                            {indice + 1}
                          </h3>

                          {itensEntrega.length >
                            1 && (
                            <button
                              type="button"
                              onClick={() =>
                                removerProduto(
                                  indice
                                )
                              }
                              className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                            >
                              Remover
                            </button>
                          )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                              Produto
                            </label>

                            <select
                              value={
                                item.produtoId
                              }
                              onChange={(
                                evento
                              ) =>
                                alterarItemEntrega(
                                  indice,
                                  "produtoId",
                                  evento
                                    .target
                                    .value
                                )
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            >
                              <option value="">
                                Selecione
                              </option>

                              {produtos.map(
                                (
                                  produto
                                ) => (
                                  <option
                                    key={
                                      produto.id
                                    }
                                    value={
                                      produto.id
                                    }
                                  >
                                    {
                                      produto.nome
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                              Quantidade
                            </label>

                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={
                                item.quantidadeEntregue
                              }
                              onChange={(
                                evento
                              ) =>
                                alterarItemEntrega(
                                  indice,
                                  "quantidadeEntregue",
                                  evento
                                    .target
                                    .value
                                )
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                              Preço
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                item.precoUnitario
                              }
                              onChange={(
                                evento
                              ) =>
                                alterarItemEntrega(
                                  indice,
                                  "precoUnitario",
                                  evento
                                    .target
                                    .value
                                )
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                          </div>
                        </div>

                        <div className="mt-4 text-right">
                          <span className="text-sm text-slate-500">
                            Valor bruto:{" "}
                          </span>

                          <strong className="text-lg text-blue-700">
                            {formatarDinheiro(
                              quantidade *
                                preco
                            )}
                          </strong>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </section>

            {/* ACERTO */}
            <section className="mb-6 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
              <div className="bg-gradient-to-r from-emerald-600 to-green-700 px-6 py-5">
                <h2 className="text-xl font-bold text-white">
                  3. Acerto da movimentação
                </h2>

                <p className="mt-1 text-sm text-emerald-100">
                  Entrega de hoje menos a
                  devolução recebida hoje.
                </p>
              </div>

              <div className="p-6">
                {resumoMovimentacao
                  .produtosResumo.length >
                  0 && (
                  <div className="mb-6 overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="pb-3">
                            Produto
                          </th>

                          <th className="pb-3">
                            Entregue hoje
                          </th>

                          <th className="pb-3">
                            Devolvido
                          </th>

                          <th className="pb-3">
                            Cobrado
                          </th>

                          <th className="pb-3">
                            Preço
                          </th>

                          <th className="pb-3">
                            Valor devido
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {resumoMovimentacao.produtosResumo.map(
                          (item) => (
                            <tr
                              key={
                                item.produtoId
                              }
                              className="border-b border-slate-100"
                            >
                              <td className="py-4 font-semibold text-slate-900">
                                {item.nome}
                              </td>

                              <td className="py-4 text-blue-700">
                                {
                                  item.quantidadeEntregue
                                }
                              </td>

                              <td className="py-4 text-red-600">
                                -
                                {
                                  item.quantidadeDevolvida
                                }
                              </td>

                              <td className="py-4 font-bold text-emerald-700">
                                {
                                  item.quantidadeCobrada
                                }
                              </td>

                              <td className="py-4 text-slate-600">
                                {formatarDinheiro(
                                  item.precoUnitario
                                )}
                              </td>

                              <td className="py-4 font-bold text-emerald-700">
                                {formatarDinheiro(
                                  item.devido
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-blue-50 p-4">
                    <p className="text-xs font-semibold uppercase text-blue-600">
                      Entregue hoje
                    </p>

                    <p className="mt-1 text-2xl font-bold text-blue-900">
                      {
                        resumoMovimentacao.unidadesEntregues
                      }
                    </p>
                  </div>

                  <div className="rounded-xl bg-red-50 p-4">
                    <p className="text-xs font-semibold uppercase text-red-600">
                      Devolvido hoje
                    </p>

                    <p className="mt-1 text-2xl font-bold text-red-900">
                      {
                        resumoMovimentacao.unidadesDevolvidas
                      }
                    </p>
                  </div>

                  <div className="rounded-xl bg-amber-50 p-4">
                    <p className="text-xs font-semibold uppercase text-amber-600">
                      Quantidade cobrada
                    </p>

                    <p className="mt-1 text-2xl font-bold text-amber-900">
                      {
                        resumoMovimentacao.unidadesCobradas
                      }
                    </p>
                  </div>

                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase text-emerald-600">
                      Valor a pagar
                    </p>

                    <p className="mt-1 text-2xl font-bold text-emerald-900">
                      {formatarDinheiro(
                        resumoMovimentacao.valorDevido
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* OBSERVAÇÕES */}
            <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Observações
              </label>

              <textarea
                value={observacoes}
                onChange={(evento) =>
                  setObservacoes(
                    evento.target.value
                  )
                }
                rows={3}
                placeholder="Observações sobre a movimentação..."
                className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
              />
            </section>

            <div className="mb-10 flex justify-end">
              <button
                type="submit"
                disabled={carregando}
                className="rounded-xl bg-slate-900 px-8 py-4 text-lg font-bold text-white shadow-md transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {carregando
                  ? "Registrando movimentação..."
                  : "✓ Registrar movimentação"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}