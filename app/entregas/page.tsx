"use client";

import { useEffect, useState } from "react";

type Padaria = {
  id: number;
  nome: string;
};

type Produto = {
  id: number;
  nome: string;
  precoCadastrado: string;
};

type ItemEntregaForm = {
  produtoId: number;
  quantidadeEntregue: number;
  precoUnitario: number;
};

type Entrega = {
  id: number;
  codigo: string;
  dataEntrega: string;
  status: string;
  padaria: {
    nome: string;
  };
  itens: {
    id: number;
    quantidadeEntregue: number;
    precoUnitario: string;
    produto: {
      nome: string;
    };
  }[];
};

export default function EntregasPage() {
  const [padarias, setPadarias] = useState<Padaria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);

  const [padariaId, setPadariaId] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");

  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [precoUnitario, setPrecoUnitario] = useState("");

  const [itens, setItens] = useState<ItemEntregaForm[]>([]);

  async function carregarDados() {
    const [resPadarias, resProdutos, resEntregas] = await Promise.all([
      fetch("/api/padarias"),
      fetch("/api/produtos"),
      fetch("/api/entregas"),
    ]);

    const dadosPadarias = await resPadarias.json();
    const dadosProdutos = await resProdutos.json();
    const dadosEntregas = await resEntregas.json();

    setPadarias(dadosPadarias);
    setProdutos(dadosProdutos);
    setEntregas(dadosEntregas);
  }

  function adicionarItem() {
    if (!produtoId || !quantidade || !precoUnitario) {
      alert("Preencha produto, quantidade e preço.");
      return;
    }

    const novoItem = {
      produtoId: Number(produtoId),
      quantidadeEntregue: Number(quantidade),
      precoUnitario: Number(precoUnitario),
    };

    setItens([...itens, novoItem]);

    setProdutoId("");
    setQuantidade("");
    setPrecoUnitario("");
  }

  async function cadastrarEntrega(event: React.FormEvent) {
    event.preventDefault();

    if (!padariaId || !dataEntrega || itens.length === 0) {
      alert("Preencha os dados da entrega e adicione pelo menos um item.");
      return;
    }

    const resposta = await fetch("/api/entregas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        padariaId,
        dataEntrega,
        itens,
      }),
    });

    if (!resposta.ok) {
      const erro = await resposta.json();

      alert(erro.erro || "Erro ao cadastrar entrega.");
      return;
    }

    alert("Entrega cadastrada com sucesso!");

    setPadariaId("");
    setDataEntrega("");
    setItens([]);

    await carregarDados();
  }

  useEffect(() => {
    carregarDados();
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-8 text-3xl font-bold">
          Gerenciamento de Entregas
        </h1>

        <form
          onSubmit={cadastrarEntrega}
          className="rounded-lg bg-white p-6 shadow"
        >
          <h2 className="mb-6 text-xl font-semibold">
            Nova Entrega
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <select
              value={padariaId}
              onChange={(event) => setPadariaId(event.target.value)}
              required
              className="rounded border p-3"
            >
              <option value="">
                Selecione a padaria
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

            <input
              type="date"
              value={dataEntrega}
              onChange={(event) => setDataEntrega(event.target.value)}
              required
              className="rounded border p-3"
            />
          </div>

          <div className="mt-8 border-t pt-6">
            <h2 className="mb-4 text-xl font-semibold">
              Produtos da Entrega
            </h2>

            <div className="grid gap-4 md:grid-cols-4">
              <select
                value={produtoId}
                onChange={(event) => {
                  const id = event.target.value;

                  setProdutoId(id);

                  const produto = produtos.find(
                    (produto) =>
                      produto.id === Number(id)
                  );

                  if (produto) {
                    setPrecoUnitario(
                      Number(
                        produto.precoCadastrado
                      ).toFixed(2)
                    );
                  }
                }}
                className="rounded border p-3"
              >
                <option value="">
                  Produto
                </option>

                {produtos.map((produto) => (
                  <option
                    key={produto.id}
                    value={produto.id}
                  >
                    {produto.nome}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                placeholder="Quantidade"
                value={quantidade}
                onChange={(event) =>
                  setQuantidade(event.target.value)
                }
                className="rounded border p-3"
              />

              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Preço unitário"
                value={precoUnitario}
                onChange={(event) =>
                  setPrecoUnitario(event.target.value)
                }
                className="rounded border p-3"
              />

              <button
                type="button"
                onClick={adicionarItem}
                className="rounded bg-gray-800 p-3 text-white"
              >
                Adicionar produto
              </button>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold">
              Itens adicionados
            </h2>

            {itens.length === 0 ? (
              <p className="text-gray-500">
                Nenhum produto adicionado.
              </p>
            ) : (
              <div className="space-y-3">
                {itens.map((item, index) => {
                  const produto = produtos.find(
                    (produto) =>
                      produto.id === item.produtoId
                  );

                  const total =
                    item.quantidadeEntregue *
                    item.precoUnitario;

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded border p-4"
                    >
                      <div>
                        <p className="font-semibold">
                          {produto?.nome}
                        </p>

                        <p>
                          {item.quantidadeEntregue} unidades × R${" "}
                          {item.precoUnitario.toFixed(2)}
                        </p>

                        <p>
                          Total do item: R${" "}
                          {total.toFixed(2)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setItens(
                            itens.filter(
                              (_, itemIndex) =>
                                itemIndex !== index
                            )
                          )
                        }
                        className="rounded border px-3 py-2"
                      >
                        Remover
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {itens.length > 0 && (
            <div className="mt-6 rounded bg-gray-100 p-4">
              <p className="text-lg font-semibold">
                Total da nova entrega: R${" "}
                {itens
                  .reduce(
                    (total, item) =>
                      total +
                      item.quantidadeEntregue *
                        item.precoUnitario,
                    0
                  )
                  .toFixed(2)}
              </p>
            </div>
          )}

          <button
            type="submit"
            className="mt-8 w-full rounded bg-black p-3 text-white"
          >
            Cadastrar Entrega
          </button>
        </form>

        <div className="mt-10 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-6 text-xl font-semibold">
            Entregas Cadastradas
          </h2>

          {entregas.length === 0 ? (
            <p className="text-gray-500">
              Nenhuma entrega cadastrada.
            </p>
          ) : (
            <div className="space-y-4">
              {entregas.map((entrega) => {
                const totalEntrega =
                  entrega.itens.reduce(
                    (total, item) =>
                      total +
                      item.quantidadeEntregue *
                        Number(item.precoUnitario),
                    0
                  );

                return (
                  <div
                    key={entrega.id}
                    className="rounded border p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold">
                          {entrega.codigo}
                        </p>

                        <p>
                          Padaria:{" "}
                          {entrega.padaria.nome}
                        </p>

                        <p>
                          Data:{" "}
                          {new Date(
                            entrega.dataEntrega
                          ).toLocaleDateString(
                            "pt-BR"
                          )}
                        </p>

                        <p>
                          Status: {entrega.status}
                        </p>
                      </div>

                      <div className="rounded bg-gray-100 px-4 py-3">
                        <p className="text-sm text-gray-600">
                          Total da entrega
                        </p>

                        <p className="text-xl font-bold">
                          R${" "}
                          {totalEntrega.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t pt-4">
                      <p className="mb-2 font-medium">
                        Produtos:
                      </p>

                      <div className="space-y-2">
                        {entrega.itens.map((item) => {
                          const totalItem =
                            item.quantidadeEntregue *
                            Number(
                              item.precoUnitario
                            );

                          return (
                            <div
                              key={item.id}
                              className="rounded bg-gray-50 p-3"
                            >
                              <p className="font-medium">
                                {item.produto.nome}
                              </p>

                              <p>
                                Quantidade:{" "}
                                {
                                  item.quantidadeEntregue
                                }
                              </p>

                              <p>
                                Preço unitário: R${" "}
                                {Number(
                                  item.precoUnitario
                                ).toFixed(2)}
                              </p>

                              <p>
                                Total do item: R${" "}
                                {totalItem.toFixed(2)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}