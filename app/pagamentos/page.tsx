"use client";

import { FormEvent, useEffect, useState } from "react";

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
  dataInicio: string;
  dataFim: string;
  valorDevido: string | number;
  valorRecebido: string | number | null;
  status: "PENDENTE" | "PAGO";
  divergencia: boolean;
  dataPagamento: string | null;

  padaria: {
    id: number;
    nome: string;
  };

  itens: PagamentoItem[];
};

export default function PagamentosPage() {
  const [padarias, setPadarias] = useState<Padaria[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);

  const [padariaId, setPadariaId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [valoresRecebidos, setValoresRecebidos] = useState<
    Record<number, string>
  >({});

  const [carregando, setCarregando] = useState(false);
  const [recebendoPagamentoId, setRecebendoPagamentoId] =
    useState<number | null>(null);

  async function carregarPadarias() {
    try {
      const resposta = await fetch("/api/padarias");

      if (!resposta.ok) {
        throw new Error("Erro ao buscar padarias.");
      }

      const dados = await resposta.json();

      setPadarias(dados);
    } catch (erro) {
      console.error(erro);
    }
  }

  async function carregarPagamentos() {
    try {
      const resposta = await fetch("/api/pagamentos");

      if (!resposta.ok) {
        throw new Error("Erro ao buscar pagamentos.");
      }

      const dados = await resposta.json();

      setPagamentos(dados);
    } catch (erro) {
      console.error(erro);
    }
  }

  useEffect(() => {
    carregarPadarias();
    carregarPagamentos();
  }, []);

  function formatarDinheiro(valor: string | number | null) {
    if (valor === null) {
      return "Não informado";
    }

    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarData(data: string) {
    return new Date(data).toLocaleDateString("pt-BR");
  }

  function formatarDataHora(data: string | null) {
    if (!data) {
      return "-";
    }

    return new Date(data).toLocaleString("pt-BR");
  }

  async function criarFechamento(evento: FormEvent) {
    evento.preventDefault();

    if (!padariaId || !dataInicio || !dataFim) {
      alert("Informe a padaria e o período.");
      return;
    }

    if (dataInicio > dataFim) {
      alert("A data inicial não pode ser posterior à data final.");
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
          dataInicio,
          dataFim,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(dados.erro || "Não foi possível criar o fechamento.");
        return;
      }

      alert(
        `Fechamento criado com sucesso!\n\nValor devido: ${formatarDinheiro(
          dados.valorDevido
        )}\nStatus: PENDENTE`
      );

      setPadariaId("");
      setDataInicio("");
      setDataFim("");

      await carregarPagamentos();
    } catch (erro) {
      console.error(erro);

      alert("Erro ao criar fechamento.");
    } finally {
      setCarregando(false);
    }
  }

  async function registrarRecebimento(pagamento: Pagamento) {
    const valorDigitado = valoresRecebidos[pagamento.id];

    if (
      valorDigitado === undefined ||
      valorDigitado === "" ||
      Number.isNaN(Number(valorDigitado))
    ) {
      alert("Informe o valor recebido.");
      return;
    }

    const valorRecebido = Number(valorDigitado);

    if (valorRecebido < 0) {
      alert("O valor recebido não pode ser negativo.");
      return;
    }

    const valorDevido = Number(pagamento.valorDevido);

    const mensagemConfirmacao =
      Math.abs(valorRecebido - valorDevido) > 0.009
        ? `O valor recebido é diferente do valor devido.\n\nValor devido: ${formatarDinheiro(
            valorDevido
          )}\nValor recebido: ${formatarDinheiro(
            valorRecebido
          )}\n\nDeseja registrar mesmo assim?`
        : `Confirmar recebimento de ${formatarDinheiro(valorRecebido)}?`;

    const confirmou = window.confirm(mensagemConfirmacao);

    if (!confirmou) {
      return;
    }

    try {
      setRecebendoPagamentoId(pagamento.id);

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
        alert(dados.erro || "Não foi possível registrar o recebimento.");
        return;
      }

      if (dados.divergencia) {
        alert(
          `Recebimento registrado com divergência.\n\nValor devido: ${formatarDinheiro(
            dados.valorDevido
          )}\nValor recebido: ${formatarDinheiro(dados.valorRecebido)}`
        );
      } else {
        alert("Recebimento registrado com sucesso.");
      }

      setValoresRecebidos((estadoAnterior) => {
        const novoEstado = { ...estadoAnterior };

        delete novoEstado[pagamento.id];

        return novoEstado;
      });

      await carregarPagamentos();
    } catch (erro) {
      console.error(erro);

      alert("Erro ao registrar recebimento.");
    } finally {
      setRecebendoPagamentoId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Pagamentos
          </h1>

          <p className="mt-2 text-gray-600">
            Faça o fechamento das entregas e registre os recebimentos das
            padarias.
          </p>
        </div>

        <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Novo fechamento
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Escolha a padaria e o período das entregas que serão incluídas no
              fechamento.
            </p>
          </div>

          <form
            onSubmit={criarFechamento}
            className="grid gap-5 md:grid-cols-3"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Padaria
              </label>

              <select
                value={padariaId}
                onChange={(evento) => setPadariaId(evento.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-black"
              >
                <option value="">Selecione uma padaria</option>

                {padarias.map((padaria) => (
                  <option key={padaria.id} value={padaria.id}>
                    {padaria.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Data inicial
              </label>

              <input
                type="date"
                value={dataInicio}
                onChange={(evento) => setDataInicio(evento.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Data final
              </label>

              <input
                type="date"
                value={dataFim}
                onChange={(evento) => setDataFim(evento.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-black"
              />
            </div>

            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={carregando}
                className="rounded-lg bg-black px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {carregando
                  ? "Criando fechamento..."
                  : "Criar fechamento"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Histórico de pagamentos
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Pagamentos pendentes aguardam o registro do valor recebido.
            </p>
          </div>

          {pagamentos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
              Nenhum fechamento registrado.
            </div>
          ) : (
            <div className="space-y-5">
              {pagamentos.map((pagamento) => (
                <article
                  key={pagamento.id}
                  className="rounded-xl border border-gray-200 p-5"
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {pagamento.padaria.nome}
                        </h3>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            pagamento.status === "PAGO"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {pagamento.status}
                        </span>

                        {pagamento.divergencia && (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                            Divergência
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-gray-500">
                        Período: {formatarData(pagamento.dataInicio)} até{" "}
                        {formatarData(pagamento.dataFim)}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Pagamento #{pagamento.id}
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="text-sm text-gray-500">
                        Valor devido
                      </p>

                      <p className="text-2xl font-bold text-gray-900">
                        {formatarDinheiro(pagamento.valorDevido)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 rounded-lg bg-gray-50 p-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium uppercase text-gray-500">
                        Valor recebido
                      </p>

                      <p className="mt-1 font-semibold text-gray-900">
                        {formatarDinheiro(pagamento.valorRecebido)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase text-gray-500">
                        Data do recebimento
                      </p>

                      <p className="mt-1 font-semibold text-gray-900">
                        {formatarDataHora(pagamento.dataPagamento)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase text-gray-500">
                        Quantidade de itens
                      </p>

                      <p className="mt-1 font-semibold text-gray-900">
                        {pagamento.itens.length}
                      </p>
                    </div>
                  </div>

                  {pagamento.itens.length > 0 && (
                    <div className="mt-5 overflow-x-auto">
                      <table className="w-full min-w-[700px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-500">
                            <th className="pb-3 pr-4 font-medium">
                              Entrega
                            </th>

                            <th className="pb-3 pr-4 font-medium">
                              Produto
                            </th>

                            <th className="pb-3 pr-4 font-medium">
                              Vendido
                            </th>

                            <th className="pb-3 pr-4 font-medium">
                              Bruto
                            </th>

                            <th className="pb-3 pr-4 font-medium">
                              Devolvido
                            </th>

                            <th className="pb-3 font-medium">
                              Líquido
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {pagamento.itens.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b border-gray-100"
                            >
                              <td className="py-3 pr-4 text-gray-700">
                                {item.itemEntrega.entrega.codigo}
                              </td>

                              <td className="py-3 pr-4 text-gray-700">
                                {item.itemEntrega.produto.nome}
                              </td>

                              <td className="py-3 pr-4 text-gray-700">
                                {item.quantidadeVendida}
                              </td>

                              <td className="py-3 pr-4 text-gray-700">
                                {formatarDinheiro(item.valorVendido)}
                              </td>

                              <td className="py-3 pr-4 text-gray-700">
                                {formatarDinheiro(item.valorDevolvido)}
                              </td>

                              <td className="py-3 font-semibold text-gray-900">
                                {formatarDinheiro(item.valorLiquido)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {pagamento.status === "PENDENTE" && (
                    <div className="mt-6 border-t border-gray-200 pt-5">
                      <h4 className="font-semibold text-gray-900">
                        Registrar recebimento
                      </h4>

                      <p className="mt-1 text-sm text-gray-500">
                        Informe quanto a padaria realmente pagou.
                      </p>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Valor recebido"
                          value={valoresRecebidos[pagamento.id] ?? ""}
                          onChange={(evento) =>
                            setValoresRecebidos((estadoAnterior) => ({
                              ...estadoAnterior,
                              [pagamento.id]: evento.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-black sm:max-w-xs"
                        />

                        <button
                          type="button"
                          disabled={
                            recebendoPagamentoId === pagamento.id
                          }
                          onClick={() =>
                            registrarRecebimento(pagamento)
                          }
                          className="rounded-lg bg-green-600 px-5 py-2 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {recebendoPagamentoId === pagamento.id
                            ? "Registrando..."
                            : "Registrar recebimento"}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}