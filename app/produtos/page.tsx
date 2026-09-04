"use client";

import { useEffect, useState } from "react";

type Produto = {
  id: number;
  nome: string;
  precoCadastrado: string;
  status: string;
};

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");

  async function carregarProdutos() {
    const resposta = await fetch("/api/produtos");
    const dados = await resposta.json();

    setProdutos(dados);
  }

  async function cadastrarProduto(event: React.FormEvent) {
    event.preventDefault();

    await fetch("/api/produtos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nome,
        precoCadastrado: preco,
      }),
    });

    setNome("");
    setPreco("");

    await carregarProdutos();
  }

  useEffect(() => {
    carregarProdutos();
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold">
          Gerenciamento de Produtos
        </h1>

        <form
          onSubmit={cadastrarProduto}
          className="mb-8 rounded-lg bg-white p-6 shadow"
        >
          <h2 className="mb-4 text-xl font-semibold">
            Novo Produto
          </h2>

          <div className="grid gap-4">
            <input
              type="text"
              placeholder="Nome do produto"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              required
              className="rounded border p-3"
            />

            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Preço"
              value={preco}
              onChange={(event) => setPreco(event.target.value)}
              required
              className="rounded border p-3"
            />

            <button
              type="submit"
              className="rounded bg-black p-3 text-white"
            >
              Cadastrar Produto
            </button>
          </div>
        </form>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">
            Produtos Cadastrados
          </h2>

          <div className="space-y-3">
            {produtos.map((produto) => (
              <div
                key={produto.id}
                className="rounded border p-4"
              >
                <p className="font-semibold">
                  {produto.nome}
                </p>

                <p>
                  Preço: R$ {Number(produto.precoCadastrado).toFixed(2)}
                </p>

                <p>
                  Status: {produto.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}