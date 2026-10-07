"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Padaria = {
  id: number;
  nome: string;
};

type Produto = {
  id: number;
  nome: string;
};

type ItemDevolucao = {
  id: number;
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
  padaria: Padaria;
  itens: ItemEntrega[];
};

type ItemFormularioDevolucao = {
  itemEntregaId: number;
  quantidadeDevolvida: string;
};

export default function DevolucoesPage() {
  const [entregas, setEntregas] = useState<Entrega[]>([]);

  const [entregaId, setEntregaId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [itensFormulario, setItensFormulario] = useState<
    ItemFormularioDevolucao[]
  >([]);

  const [carregando, setCarregando] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);

  async function carregarEntregas() {
    try {
      setCarregandoDados(true);

      const resposta = await fetch("/api/entregas");

      if (!resposta.ok) {
        throw new Error("Erro ao carregar entregas.");
      }

      const dados = await resposta.json();

      setEntregas(dados);
    } catch (erro) {
      console.error(erro);
      alert("Não foi possível carregar as entregas.");
    } finally {
      setCarregandoDados(false);
    }
  }

  useEffect(() => {
    carregarEntregas();
  }, []);

  const entregaSelecionada = useMemo(() => {
    return entregas.find(
      (entrega) => entrega.id === Number(entregaId)
    );
  }, [entregas, entregaId]);

  useEffect(() => {
    if (!entregaSelecionada) {
      setItensFormulario([]);
      return;
    }

    setItensFormulario(
      entregaSelecionada.itens.map((item) => ({
        itemEntregaId: item.id,
        quantidadeDevolvida: "",
      }))
    );
  }, [entregaSelecionada]);

  function formatarDinheiro(valor: string | number) {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarData(data: string) {
    return new Date(data).toLocaleDateString("pt-BR");
  }

  function quantidadeJaDevolvida(item: ItemEntrega) {
    return item.itensDevolucao.reduce(
      (total, devolucao) =>
        total + devolucao.quantidadeDevolvida,
      0
    );
  }

  function quantidadeDisponivel(item: ItemEntrega) {
    return (
      item.quantidadeEntregue -
      quantidadeJaDevolvida(item)
    );
  }

  function alterarQuantidade(
    itemEntregaId: number,
    valor: string
  ) {
    setItensFormulario((estadoAnterior) =>
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

  const resumo = useMemo(() => {
    if (!entregaSelecionada) {
      return {
        valorBruto: 0,
        valorJaDevolvido: 0,
        valorNovaDevolucao: 0,
        valorLiquido: 0,
        unidadesEntregues: 0,
        unidadesJaDevolvidas: 0,
        unidadesNovaDevolucao: 0,
      };
    }

    let valorBruto = 0;
    let valorJaDevolvido = 0;
    let valorNovaDevolucao = 0;

    let unidadesEntregues = 0;
    let unidadesJaDevolvidas = 0;
    let unidadesNovaDevolucao = 0;

    for (const item of entregaSelecionada.itens) {
      const preco = Number(item.precoUnitario);

      const jaDevolvido =
        quantidadeJaDevolvida(item);

      const itemFormulario = itensFormulario.find(
        (itemFormularioAtual) =>
          itemFormularioAtual.itemEntregaId === item.id
      );

      const novaQuantidade = Number(
        itemFormulario?.quantidadeDevolvida || 0
      );

      valorBruto +=
        item.quantidadeEntregue * preco;

      valorJaDevolvido +=
        jaDevolvido * preco;

      valorNovaDevolucao +=
        (Number.isFinite(novaQuantidade)
          ? novaQuantidade
          : 0) * preco;

      unidadesEntregues +=
        item.quantidadeEntregue;

      unidadesJaDevolvidas +=
        jaDevolvido;

      unidadesNovaDevolucao +=
        Number.isFinite(novaQuantidade)
          ? novaQuantidade
          : 0;
    }

    return {
      valorBruto,
      valorJaDevolvido,
      valorNovaDevolucao,
      valorLiquido:
        valorBruto -
        valorJaDevolvido -
        valorNovaDevolucao,
      unidadesEntregues,
      unidadesJaDevolvidas,
      unidadesNovaDevolucao,
    };
  }, [entregaSelecionada, itensFormulario]);

  async function registrarDevolucao(evento: FormEvent) {
    evento.preventDefault();

    if (!entregaSelecionada) {
      alert("Selecione uma entrega.");
      return;
    }

    const itensComDevolucao = itensFormulario.filter(
      (itemFormulario) =>
        Number(itemFormulario.quantidadeDevolvida) > 0
    );

    if (itensComDevolucao.length === 0) {
      alert(
        "Informe pelo menos uma quantidade para devolução."
      );
      return;
    }

    for (const itemFormulario of itensComDevolucao) {
      const itemEntrega =
        entregaSelecionada.itens.find(
          (item) =>
            item.id === itemFormulario.itemEntregaId
        );

      if (!itemEntrega) {
        alert("Item da entrega não encontrado.");
        return;
      }

      const quantidade = Number(
        itemFormulario.quantidadeDevolvida
      );

      const disponivel =
        quantidadeDisponivel(itemEntrega);

      if (
        !Number.isInteger(quantidade) ||
        quantidade <= 0
      ) {
        alert(
          "A quantidade devolvida deve ser um número inteiro maior que zero."
        );
        return;
      }

      if (quantidade > disponivel) {
        alert(
          `A devolução de ${itemEntrega.produto.nome} não pode ultrapassar ${disponivel} unidade(s).`
        );
        return;
      }
    }

    try {
      setCarregando(true);

      const resposta = await fetch("/api/devolucoes", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          entregaId: entregaSelecionada.id,
          observacoes:
            observacoes.trim() || null,
          itens: itensComDevolucao.map(
            (itemFormulario) => ({
              itemEntregaId:
                itemFormulario.itemEntregaId,
              quantidadeDevolvida: Number(
                itemFormulario.quantidadeDevolvida
              ),
            })
          ),
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(
          dados.erro ||
            "Não foi possível registrar a devolução."
        );
        return;
      }

      setEntregaId("");
      setObservacoes("");
      setItensFormulario([]);

      await carregarEntregas();

      alert("Devolução registrada com sucesso.");
    } catch (erro) {
      console.error(erro);
      alert("Erro ao registrar devolução.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Cabeçalho */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-600 text-2xl text-white shadow-sm">
              ↩️
            </div>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Devoluções
              </h1>

              <p className="mt-1 text-slate-600">
                Registre os produtos devolvidos pelas padarias
                e acompanhe o impacto no valor da entrega.
              </p>
            </div>
          </div>
        </div>

        {/* Indicadores gerais */}
        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-700">
              Entregas disponíveis
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-900">
              {entregas.length}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-orange-700">
              Entrega selecionada
            </p>

            <p className="mt-2 text-xl font-bold text-orange-900">
              {entregaSelecionada
                ? entregaSelecionada.padaria.nome
                : "Nenhuma"}
            </p>
          </div>

          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-red-700">
              Nova devolução
            </p>

            <p className="mt-2 text-3xl font-bold text-red-900">
              {resumo.unidadesNovaDevolucao}
            </p>
          </div>
        </section>

        {/* Formulário */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-5">
            <h2 className="text-xl font-semibold text-white">
              Registrar devolução
            </h2>

            <p className="mt-1 text-sm text-amber-100">
              Selecione a entrega e informe as quantidades
              devolvidas.
            </p>
          </div>

          <form
            onSubmit={registrarDevolucao}
            className="p-6"
          >
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Entrega
              </label>

              <select
                value={entregaId}
                onChange={(evento) =>
                  setEntregaId(evento.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
              >
                <option value="">
                  Selecione uma entrega
                </option>

                {entregas.map((entrega) => (
                  <option
                    key={entrega.id}
                    value={entrega.id}
                  >
                    {entrega.codigo} —{" "}
                    {entrega.padaria.nome} —{" "}
                    {formatarData(entrega.dataEntrega)}
                  </option>
                ))}
              </select>
            </div>

            {!entregaSelecionada ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <div className="mb-3 text-4xl">
                  ↩️
                </div>

                <p className="font-semibold text-slate-700">
                  Selecione uma entrega
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Os produtos disponíveis para devolução
                  aparecerão aqui.
                </p>
              </div>
            ) : (
              <>
                {/* Informações da entrega */}
                <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-5">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                      <p className="text-sm font-semibold text-amber-700">
                        Padaria
                      </p>

                      <p className="mt-1 text-xl font-bold text-amber-950">
                        {entregaSelecionada.padaria.nome}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-amber-800">
                        <span>
                          Código:{" "}
                          <strong>
                            {entregaSelecionada.codigo}
                          </strong>
                        </span>

                        <span>
                          Data:{" "}
                          <strong>
                            {formatarData(
                              entregaSelecionada.dataEntrega
                            )}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white px-5 py-3 shadow-sm">
                      <p className="text-sm text-slate-500">
                        Valor bruto
                      </p>

                      <p className="mt-1 text-2xl font-bold text-amber-700">
                        {formatarDinheiro(
                          resumo.valorBruto
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Produtos */}
                <div className="mt-6">
                  <h3 className="text-lg font-bold text-slate-900">
                    Produtos da entrega
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Informe apenas as quantidades que estão
                    sendo devolvidas agora.
                  </p>

                  <div className="mt-4 space-y-4">
                    {entregaSelecionada.itens.map(
                      (item) => {
                        const jaDevolvido =
                          quantidadeJaDevolvida(item);

                        const disponivel =
                          quantidadeDisponivel(item);

                        const itemFormulario =
                          itensFormulario.find(
                            (itemFormularioAtual) =>
                              itemFormularioAtual.itemEntregaId ===
                              item.id
                          );

                        const novaDevolucao = Number(
                          itemFormulario?.quantidadeDevolvida ||
                            0
                        );

                        const vendidosDepois =
                          disponivel -
                          (Number.isFinite(
                            novaDevolucao
                          )
                            ? novaDevolucao
                            : 0);

                        const valorReceber =
                          vendidosDepois *
                          Number(item.precoUnitario);

                        return (
                          <article
                            key={item.id}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                          >
                            <div className="flex flex-col justify-between gap-4 bg-slate-50 p-5 md:flex-row md:items-center">
                              <div className="flex items-center gap-4">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-xl">
                                  🌽
                                </div>

                                <div>
                                  <h4 className="font-bold text-slate-900">
                                    {item.produto.nome}
                                  </h4>

                                  <p className="mt-1 text-sm text-slate-500">
                                    {formatarDinheiro(
                                      item.precoUnitario
                                    )}{" "}
                                    por unidade
                                  </p>
                                </div>
                              </div>

                              <div className="rounded-xl bg-white px-4 py-2 text-right shadow-sm">
                                <p className="text-xs text-slate-500">
                                  Disponível para devolução
                                </p>

                                <p className="text-xl font-bold text-amber-700">
                                  {disponivel}
                                </p>
                              </div>
                            </div>

                            <div className="grid gap-3 p-5 sm:grid-cols-4">
                              <div className="rounded-xl bg-blue-50 p-4">
                                <p className="text-xs font-semibold uppercase text-blue-600">
                                  Entregue
                                </p>

                                <p className="mt-1 text-xl font-bold text-blue-900">
                                  {item.quantidadeEntregue}
                                </p>
                              </div>

                              <div className="rounded-xl bg-orange-50 p-4">
                                <p className="text-xs font-semibold uppercase text-orange-600">
                                  Já devolvido
                                </p>

                                <p className="mt-1 text-xl font-bold text-orange-900">
                                  {jaDevolvido}
                                </p>
                              </div>

                              <div className="rounded-xl bg-amber-50 p-4">
                                <p className="text-xs font-semibold uppercase text-amber-600">
                                  Disponível
                                </p>

                                <p className="mt-1 text-xl font-bold text-amber-900">
                                  {disponivel}
                                </p>
                              </div>

                              <div className="rounded-xl bg-emerald-50 p-4">
                                <p className="text-xs font-semibold uppercase text-emerald-600">
                                  Vendido após devolução
                                </p>

                                <p className="mt-1 text-xl font-bold text-emerald-900">
                                  {Math.max(
                                    0,
                                    vendidosDepois
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="border-t border-slate-200 p-5">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                                    Quantidade devolvida agora
                                  </label>

                                  <input
                                    type="number"
                                    min="0"
                                    max={disponivel}
                                    step="1"
                                    value={
                                      itemFormulario?.quantidadeDevolvida ||
                                      ""
                                    }
                                    onChange={(evento) =>
                                      alterarQuantidade(
                                        item.id,
                                        evento.target.value
                                      )
                                    }
                                    placeholder="Ex.: 2"
                                    disabled={disponivel <= 0}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                  />

                                  {disponivel <= 0 && (
                                    <p className="mt-2 text-sm font-medium text-red-600">
                                      Não existem mais unidades
                                      disponíveis para devolução.
                                    </p>
                                  )}
                                </div>

                                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                                  <p className="text-sm font-medium text-emerald-700">
                                    Valor a receber após esta
                                    devolução
                                  </p>

                                  <p className="mt-2 text-2xl font-bold text-emerald-900">
                                    {formatarDinheiro(
                                      Math.max(
                                        0,
                                        valorReceber
                                      )
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Resumo financeiro */}
                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="bg-slate-900 px-5 py-4">
                    <h3 className="font-bold text-white">
                      Resumo da devolução
                    </h3>
                  </div>

                  <div className="grid gap-4 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-sm text-slate-500">
                        Valor bruto
                      </p>

                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {formatarDinheiro(
                          resumo.valorBruto
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-orange-600">
                        Já devolvido
                      </p>

                      <p className="mt-1 text-xl font-bold text-orange-700">
                        -
                        {formatarDinheiro(
                          resumo.valorJaDevolvido
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-red-600">
                        Nova devolução
                      </p>

                      <p className="mt-1 text-xl font-bold text-red-700">
                        -
                        {formatarDinheiro(
                          resumo.valorNovaDevolucao
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-emerald-600">
                        Valor líquido
                      </p>

                      <p className="mt-1 text-2xl font-bold text-emerald-700">
                        {formatarDinheiro(
                          Math.max(
                            0,
                            resumo.valorLiquido
                          )
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Observações */}
                <div className="mt-6">
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
                    placeholder="Motivo ou observações sobre a devolução..."
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={carregando}
                  className="mt-6 rounded-xl bg-amber-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {carregando
                    ? "Registrando..."
                    : "Registrar devolução"}
                </button>
              </>
            )}
          </form>
        </section>

        {/* Explicação */}
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex gap-4">
            <div className="text-2xl">
              ⚠️
            </div>

            <div>
              <h3 className="font-bold text-amber-900">
                Regra de devolução
              </h3>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                O sistema não permite devolver uma quantidade
                maior que a quantidade ainda disponível da
                entrega. Também não permite registrar novas
                devoluções quando a entrega já estiver vinculada
                a um fechamento financeiro.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}