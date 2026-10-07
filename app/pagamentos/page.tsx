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

type Entrega = {
  id: number;
  codigo: string;
  dataEntrega: string;
};

type ItemEntrega = {
  id: number;
  produto: Produto;
  entrega: Entrega;
};

type PagamentoItem = {
  id: number;
  quantidadeVendida: number;
  valorVendido: string | number;
  valorDevolvido: string | number;
  valorLiquido: string | number;
  itemEntrega: ItemEntrega;
};

type Pagamento = {
  id: number;
  periodoInicio: string;
  periodoFim: string;
  valorDevido: string | number;
  valorRecebido: string | number | null;
  possuiDivergencia: boolean;
  status: "PENDENTE" | "PAGO";
  dataPagamento: string | null;
  criadoEm?: string;
  padaria: Padaria;
  itens: PagamentoItem[];
};

export default function PagamentosPage() {
  const [padarias, setPadarias] = useState<Padaria[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);

  const [padariaId, setPadariaId] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");

  const [valoresRecebidos, setValoresRecebidos] = useState<
    Record<number, string>
  >({});

  const [carregando, setCarregando] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [pagamentoEmProcessamento, setPagamentoEmProcessamento] =
    useState<number | null>(null);

  async function carregarDados() {
    try {
      setCarregandoDados(true);

      const [respostaPadarias, respostaPagamentos] =
        await Promise.all([
          fetch("/api/padarias"),
          fetch("/api/pagamentos"),
        ]);

      if (!respostaPadarias.ok || !respostaPagamentos.ok) {
        throw new Error("Erro ao carregar dados.");
      }

      const [dadosPadarias, dadosPagamentos] =
        await Promise.all([
          respostaPadarias.json(),
          respostaPagamentos.json(),
        ]);

      setPadarias(dadosPadarias);
      setPagamentos(dadosPagamentos);
    } catch (erro) {
      console.error(erro);
      alert("Não foi possível carregar os pagamentos.");
    } finally {
      setCarregandoDados(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  function formatarDinheiro(valor: string | number | null) {
    if (valor === null || valor === undefined) {
      return "Não informado";
    }

    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarData(data: string | null) {
    if (!data) {
      return "Não informado";
    }

    return new Date(data).toLocaleDateString("pt-BR");
  }

  const pagamentosPendentes = useMemo(() => {
    return pagamentos.filter(
      (pagamento) => pagamento.status === "PENDENTE"
    );
  }, [pagamentos]);

  const pagamentosPagos = useMemo(() => {
    return pagamentos.filter(
      (pagamento) => pagamento.status === "PAGO"
    );
  }, [pagamentos]);

  const totalDevido = useMemo(() => {
    return pagamentos.reduce(
      (total, pagamento) =>
        total + Number(pagamento.valorDevido),
      0
    );
  }, [pagamentos]);

  const totalRecebido = useMemo(() => {
    return pagamentos.reduce(
      (total, pagamento) =>
        total +
        (pagamento.valorRecebido
          ? Number(pagamento.valorRecebido)
          : 0),
      0
    );
  }, [pagamentos]);

  async function criarPagamento(evento: FormEvent) {
    evento.preventDefault();

    if (!padariaId) {
      alert("Selecione uma padaria.");
      return;
    }

    if (!periodoInicio || !periodoFim) {
      alert("Informe o período completo.");
      return;
    }

    if (
      new Date(periodoInicio).getTime() >
      new Date(periodoFim).getTime()
    ) {
      alert(
        "A data inicial não pode ser posterior à data final."
      );
      return;
    }

    try {
      setCarregando(true);

      const resposta = await fetch("/api/pagamentos", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          padariaId: Number(padariaId),
          periodoInicio,
          periodoFim,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(
          dados.erro ||
            "Não foi possível criar o fechamento."
        );
        return;
      }

      setPadariaId("");
      setPeriodoInicio("");
      setPeriodoFim("");

      await carregarDados();

      alert("Fechamento financeiro criado com sucesso.");
    } catch (erro) {
      console.error(erro);
      alert("Erro ao criar fechamento financeiro.");
    } finally {
      setCarregando(false);
    }
  }

  async function registrarRecebimento(
    pagamento: Pagamento
  ) {
    const valorTexto = valoresRecebidos[pagamento.id];

    const valorRecebido = Number(
      String(valorTexto || "").replace(",", ".")
    );

    if (
      !Number.isFinite(valorRecebido) ||
      valorRecebido < 0
    ) {
      alert("Informe um valor recebido válido.");
      return;
    }

    const valorDevido = Number(pagamento.valorDevido);

    if (valorRecebido !== valorDevido) {
      const confirmar = window.confirm(
        `O valor recebido (${formatarDinheiro(
          valorRecebido
        )}) é diferente do valor devido (${formatarDinheiro(
          valorDevido
        )}). Deseja registrar mesmo assim?`
      );

      if (!confirmar) {
        return;
      }
    }

    try {
      setPagamentoEmProcessamento(pagamento.id);

      const resposta = await fetch("/api/pagamentos", {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          pagamentoId: pagamento.id,
          valorRecebido,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(
          dados.erro ||
            "Não foi possível registrar o recebimento."
        );
        return;
      }

      setValoresRecebidos((estadoAnterior) => {
        const copia = { ...estadoAnterior };
        delete copia[pagamento.id];
        return copia;
      });

      await carregarDados();

      alert("Recebimento registrado com sucesso.");
    } catch (erro) {
      console.error(erro);
      alert("Erro ao registrar recebimento.");
    } finally {
      setPagamentoEmProcessamento(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Cabeçalho */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-2xl text-white shadow-sm">
              💰
            </div>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Pagamentos
              </h1>

              <p className="mt-1 text-slate-600">
                Realize fechamentos financeiros e registre os
                valores recebidos das padarias parceiras.
              </p>
            </div>
          </div>
        </div>

        {/* Indicadores */}
        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-700">
              Pendentes
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-900">
              {pagamentosPendentes.length}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">
              Pagos
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-900">
              {pagamentosPagos.length}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-blue-700">
              Total devido
            </p>

            <p className="mt-2 text-2xl font-bold text-blue-900">
              {formatarDinheiro(totalDevido)}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">
              Total recebido
            </p>

            <p className="mt-2 text-2xl font-bold text-emerald-900">
              {formatarDinheiro(totalRecebido)}
            </p>
          </div>
        </section>

        {/* Novo fechamento */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-emerald-600 to-green-700 px-6 py-5">
            <h2 className="text-xl font-semibold text-white">
              Novo fechamento financeiro
            </h2>

            <p className="mt-1 text-sm text-emerald-100">
              Selecione a padaria e o período que será fechado.
            </p>
          </div>

          <form
            onSubmit={criarPagamento}
            className="grid gap-5 p-6 md:grid-cols-3"
          >
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Padaria
              </label>

              <select
                value={padariaId}
                onChange={(evento) =>
                  setPadariaId(evento.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">
                  Selecione uma padaria
                </option>

                {padarias.map((padaria) => (
                  <option
                    key={padaria.id}
                    value={padaria.id}
                  >
                    {padaria.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Data inicial
              </label>

              <input
                type="date"
                value={periodoInicio}
                onChange={(evento) =>
                  setPeriodoInicio(evento.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Data final
              </label>

              <input
                type="date"
                value={periodoFim}
                onChange={(evento) =>
                  setPeriodoFim(evento.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={carregando}
                className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {carregando
                  ? "Criando fechamento..."
                  : "Criar fechamento financeiro"}
              </button>
            </div>
          </form>
        </section>

        {/* Histórico */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-semibold text-slate-900">
              Histórico financeiro
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Fechamentos e recebimentos registrados no sistema.
            </p>
          </div>

          {carregandoDados ? (
            <div className="p-10 text-center text-slate-500">
              Carregando pagamentos...
            </div>
          ) : pagamentos.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mb-3 text-4xl">💰</div>

              <p className="font-semibold text-slate-700">
                Nenhum fechamento financeiro registrado.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Crie o primeiro fechamento utilizando o
                formulário acima.
              </p>
            </div>
          ) : (
            <div className="space-y-5 p-6">
              {pagamentos.map((pagamento) => {
                const pago = pagamento.status === "PAGO";

                return (
                  <article
                    key={pagamento.id}
                    className={`overflow-hidden rounded-2xl border ${
                      pagamento.possuiDivergencia
                        ? "border-red-200"
                        : pago
                        ? "border-emerald-200"
                        : "border-amber-200"
                    }`}
                  >
                    {/* Cabeçalho do pagamento */}
                    <div
                      className={`p-5 ${
                        pagamento.possuiDivergencia
                          ? "bg-red-50"
                          : pago
                          ? "bg-emerald-50"
                          : "bg-amber-50"
                      }`}
                    >
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-bold text-slate-900">
                              {pagamento.padaria.nome}
                            </h3>

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                                pago
                                  ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                  : "border-amber-200 bg-amber-100 text-amber-700"
                              }`}
                            >
                              {pagamento.status}
                            </span>

                            {pagamento.possuiDivergencia && (
                              <span className="rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                                DIVERGÊNCIA
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                            <span>
                              Pagamento #{pagamento.id}
                            </span>

                            <span>
                              Período:{" "}
                              <strong>
                                {formatarData(
                                  pagamento.periodoInicio
                                )}
                              </strong>{" "}
                              até{" "}
                              <strong>
                                {formatarData(
                                  pagamento.periodoFim
                                )}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <div className="text-left md:text-right">
                          <p className="text-sm text-slate-500">
                            Valor devido
                          </p>

                          <p className="text-3xl font-bold text-slate-900">
                            {formatarDinheiro(
                              pagamento.valorDevido
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Resumo */}
                    <div className="grid gap-3 border-y border-slate-200 bg-white p-5 md:grid-cols-3">
                      <div className="rounded-xl bg-blue-50 p-4">
                        <p className="text-xs font-semibold uppercase text-blue-600">
                          Valor devido
                        </p>

                        <p className="mt-1 text-xl font-bold text-blue-900">
                          {formatarDinheiro(
                            pagamento.valorDevido
                          )}
                        </p>
                      </div>

                      <div
                        className={`rounded-xl p-4 ${
                          pagamento.possuiDivergencia
                            ? "bg-red-50"
                            : "bg-emerald-50"
                        }`}
                      >
                        <p
                          className={`text-xs font-semibold uppercase ${
                            pagamento.possuiDivergencia
                              ? "text-red-600"
                              : "text-emerald-600"
                          }`}
                        >
                          Valor recebido
                        </p>

                        <p
                          className={`mt-1 text-xl font-bold ${
                            pagamento.possuiDivergencia
                              ? "text-red-900"
                              : "text-emerald-900"
                          }`}
                        >
                          {formatarDinheiro(
                            pagamento.valorRecebido
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-100 p-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Data do recebimento
                        </p>

                        <p className="mt-1 text-xl font-bold text-slate-800">
                          {formatarData(
                            pagamento.dataPagamento
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Itens */}
                    <div className="overflow-x-auto p-5">
                      <table className="w-full min-w-[850px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="pb-3 pr-4 font-semibold">
                              Entrega
                            </th>

                            <th className="pb-3 pr-4 font-semibold">
                              Produto
                            </th>

                            <th className="pb-3 pr-4 font-semibold">
                              Vendido
                            </th>

                            <th className="pb-3 pr-4 font-semibold">
                              Bruto
                            </th>

                            <th className="pb-3 pr-4 font-semibold">
                              Devolvido
                            </th>

                            <th className="pb-3 font-semibold">
                              Líquido
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {pagamento.itens.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b border-slate-100"
                            >
                              <td className="py-3 pr-4 text-slate-600">
                                {
                                  item.itemEntrega.entrega
                                    .codigo
                                }
                              </td>

                              <td className="py-3 pr-4 font-semibold text-slate-800">
                                {
                                  item.itemEntrega.produto
                                    .nome
                                }
                              </td>

                              <td className="py-3 pr-4 text-slate-600">
                                {item.quantidadeVendida}
                              </td>

                              <td className="py-3 pr-4 text-blue-700">
                                {formatarDinheiro(
                                  item.valorVendido
                                )}
                              </td>

                              <td className="py-3 pr-4 text-red-600">
                                -
                                {formatarDinheiro(
                                  item.valorDevolvido
                                )}
                              </td>

                              <td className="py-3 font-bold text-emerald-700">
                                {formatarDinheiro(
                                  item.valorLiquido
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Recebimento */}
                    {!pago && (
                      <div className="border-t border-amber-200 bg-amber-50 p-5">
                        <h4 className="font-bold text-amber-900">
                          Registrar recebimento
                        </h4>

                        <p className="mt-1 text-sm text-amber-800">
                          Informe o valor efetivamente pago pela
                          padaria.
                        </p>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                          <div className="w-full sm:max-w-xs">
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                              Valor recebido
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                valoresRecebidos[
                                  pagamento.id
                                ] || ""
                              }
                              onChange={(evento) =>
                                setValoresRecebidos(
                                  (estadoAnterior) => ({
                                    ...estadoAnterior,
                                    [pagamento.id]:
                                      evento.target.value,
                                  })
                                )
                              }
                              placeholder="Ex.: 90.00"
                              className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              registrarRecebimento(
                                pagamento
                              )
                            }
                            disabled={
                              pagamentoEmProcessamento ===
                              pagamento.id
                            }
                            className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {pagamentoEmProcessamento ===
                            pagamento.id
                              ? "Registrando..."
                              : "Registrar recebimento"}
                          </button>
                        </div>
                      </div>
                    )}

                    {pago && (
                      <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white">
                            ✓
                          </div>

                          <div>
                            <p className="font-bold text-emerald-900">
                              Pagamento concluído
                            </p>

                            <p className="text-sm text-emerald-700">
                              Este fechamento já possui
                              recebimento registrado.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}