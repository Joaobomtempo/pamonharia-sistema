"use client";

import { useEffect, useMemo, useState } from "react";

type ItemEntrega = {
  id: number;
  quantidadeEntregue: number;
  precoUnitario: string;
  produto: {
    nome: string;
  };
  itensDevolucao?: {
    quantidadeDevolvida: number;
  }[];
};

type Entrega = {
  id: number;
  codigo: string;
  dataEntrega: string;
  status: string;
  padaria: {
    nome: string;
  };
  itens: ItemEntrega[];
};

type ItemDevolucaoForm = {
  itemEntregaId: number;
  quantidadeDevolvida: number;
};

export default function DevolucoesPage() {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [entregaId, setEntregaId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itensDevolucao, setItensDevolucao] = useState<
    ItemDevolucaoForm[]
  >([]);

  async function carregarEntregas() {
    const resposta = await fetch("/api/entregas");

    if (!resposta.ok) {
      alert("Erro ao carregar entregas.");
      return;
    }

    const dados = await resposta.json();

    setEntregas(dados);
  }

  useEffect(() => {
    carregarEntregas();
  }, []);

  const entregaSelecionada = useMemo(() => {
    return entregas.find(
      (entrega) => entrega.id === Number(entregaId)
    );
  }, [entregas, entregaId]);

  function totalJaDevolvido(item: ItemEntrega) {
    return (
      item.itensDevolucao?.reduce(
        (total, devolucao) =>
          total + devolucao.quantidadeDevolvida,
        0
      ) ?? 0
    );
  }

  function alterarQuantidade(
    itemEntregaId: number,
    quantidade: string
  ) {
    const valor = Number(quantidade);

    setItensDevolucao((itensAtuais) => {
      const existe = itensAtuais.find(
        (item) => item.itemEntregaId === itemEntregaId
      );

      if (existe) {
        if (!quantidade || valor <= 0) {
          return itensAtuais.filter(
            (item) => item.itemEntregaId !== itemEntregaId
          );
        }

        return itensAtuais.map((item) =>
          item.itemEntregaId === itemEntregaId
            ? {
                ...item,
                quantidadeDevolvida: valor,
              }
            : item
        );
      }

      if (!quantidade || valor <= 0) {
        return itensAtuais;
      }

      return [
        ...itensAtuais,
        {
          itemEntregaId,
          quantidadeDevolvida: valor,
        },
      ];
    });
  }

  async function registrarDevolucao(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!entregaId) {
      alert("Selecione uma entrega.");
      return;
    }

    if (itensDevolucao.length === 0) {
      alert(
        "Informe a quantidade devolvida de pelo menos um produto."
      );
      return;
    }

    const resposta = await fetch("/api/devolucoes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entregaId,
        observacoes,
        itens: itensDevolucao,
      }),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      alert(
        dados.erro || "Erro ao registrar devolução."
      );
      return;
    }

    alert("Devolução registrada com sucesso!");

    setEntregaId("");
    setObservacoes("");
    setItensDevolucao([]);

    await carregarEntregas();
  }

  const resumo = entregaSelecionada?.itens.reduce(
    (resultado, item) => {
      const jaDevolvido = totalJaDevolvido(item);

      const devolucaoAtual =
        itensDevolucao.find(
          (itemDevolucao) =>
            itemDevolucao.itemEntregaId === item.id
        )?.quantidadeDevolvida ?? 0;

      const devolvidoTotal =
        jaDevolvido + devolucaoAtual;

      const vendido =
        item.quantidadeEntregue - devolvidoTotal;

      const preco = Number(item.precoUnitario);

      resultado.totalBruto +=
        item.quantidadeEntregue * preco;

      resultado.totalDevolvido +=
        devolvidoTotal * preco;

      resultado.totalLiquido +=
        vendido * preco;

      return resultado;
    },
    {
      totalBruto: 0,
      totalDevolvido: 0,
      totalLiquido: 0,
    }
  );

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-8 text-3xl font-bold">
          Gerenciamento de Devoluções
        </h1>

        <form
          onSubmit={registrarDevolucao}
          className="rounded-lg bg-white p-6 shadow"
        >
          <h2 className="mb-6 text-xl font-semibold">
            Nova Devolução
          </h2>

          <select
            value={entregaId}
            onChange={(event) => {
              setEntregaId(event.target.value);
              setItensDevolucao([]);
            }}
            required
            className="w-full rounded border p-3"
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
                {new Date(
                  entrega.dataEntrega
                ).toLocaleDateString("pt-BR")}
              </option>
            ))}
          </select>

          {entregaSelecionada && (
            <>
              <div className="mt-8">
                <h2 className="mb-4 text-xl font-semibold">
                  Produtos da Entrega
                </h2>

                <div className="space-y-4">
                  {entregaSelecionada.itens.map(
                    (item) => {
                      const devolvidoAnterior =
                        totalJaDevolvido(item);

                      const disponivel =
                        item.quantidadeEntregue -
                        devolvidoAnterior;

                      const devolucaoAtual =
                        itensDevolucao.find(
                          (itemDevolucao) =>
                            itemDevolucao.itemEntregaId ===
                            item.id
                        )?.quantidadeDevolvida ?? 0;

                      const vendidoDepois =
                        disponivel -
                        devolucaoAtual;

                      return (
                        <div
                          key={item.id}
                          className="rounded border p-4"
                        >
                          <p className="text-lg font-semibold">
                            {item.produto.nome}
                          </p>

                          <div className="mt-3 grid gap-3 md:grid-cols-4">
                            <div>
                              <p className="text-sm text-gray-500">
                                Entregue
                              </p>
                              <p className="font-semibold">
                                {
                                  item.quantidadeEntregue
                                }
                              </p>
                            </div>

                            <div>
                              <p className="text-sm text-gray-500">
                                Já devolvido
                              </p>
                              <p className="font-semibold">
                                {devolvidoAnterior}
                              </p>
                            </div>

                            <div>
                              <p className="text-sm text-gray-500">
                                Disponível
                              </p>
                              <p className="font-semibold">
                                {disponivel}
                              </p>
                            </div>

                            <div>
                              <p className="text-sm text-gray-500">
                                Preço
                              </p>
                              <p className="font-semibold">
                                R${" "}
                                {Number(
                                  item.precoUnitario
                                ).toFixed(2)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4">
                            <label className="mb-2 block font-medium">
                              Quantidade devolvida agora
                            </label>

                            <input
                              type="number"
                              min="0"
                              max={disponivel}
                              value={
                                devolucaoAtual || ""
                              }
                              onChange={(event) =>
                                alterarQuantidade(
                                  item.id,
                                  event.target.value
                                )
                              }
                              className="w-full rounded border p-3"
                            />
                          </div>

                          <div className="mt-4 rounded bg-gray-50 p-3">
                            <p>
                              Vendido após esta devolução:{" "}
                              <strong>
                                {vendidoDepois}
                              </strong>
                            </p>

                            <p>
                              Valor a receber deste
                              produto:{" "}
                              <strong>
                                R${" "}
                                {(
                                  vendidoDepois *
                                  Number(
                                    item.precoUnitario
                                  )
                                ).toFixed(2)}
                              </strong>
                            </p>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {resumo && (
                <div className="mt-8 rounded-lg bg-gray-100 p-5">
                  <h2 className="mb-4 text-xl font-semibold">
                    Resumo da Entrega
                  </h2>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-gray-600">
                        Valor bruto
                      </p>
                      <p className="text-xl font-bold">
                        R${" "}
                        {resumo.totalBruto.toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">
                        Valor devolvido
                      </p>
                      <p className="text-xl font-bold">
                        R${" "}
                        {resumo.totalDevolvido.toFixed(
                          2
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600">
                        Valor a receber
                      </p>
                      <p className="text-xl font-bold">
                        R${" "}
                        {resumo.totalLiquido.toFixed(
                          2
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6">
                <label className="mb-2 block font-medium">
                  Observações
                </label>

                <textarea
                  value={observacoes}
                  onChange={(event) =>
                    setObservacoes(event.target.value)
                  }
                  placeholder="Observações sobre a devolução"
                  className="min-h-24 w-full rounded border p-3"
                />
              </div>

              <button
                type="submit"
                className="mt-8 w-full rounded bg-black p-3 text-white"
              >
                Registrar Devolução
              </button>
            </>
          )}
        </form>
      </div>
    </main>
  );
}