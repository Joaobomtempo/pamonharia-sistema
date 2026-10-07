"use client";

import { FormEvent, useEffect, useState } from "react";

type Produto = {
  id: number;
  nome: string;
  precoCadastrado: string | number;
  status: "ATIVO" | "INATIVO";
};

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const [nome, setNome] = useState("");
  const [precoCadastrado, setPrecoCadastrado] = useState("");

  const [carregando, setCarregando] = useState(false);
  const [carregandoLista, setCarregandoLista] = useState(true);

  async function carregarProdutos() {
    try {
      setCarregandoLista(true);

      const resposta = await fetch("/api/produtos");

      if (!resposta.ok) {
        throw new Error("Erro ao carregar produtos.");
      }

      const dados = await resposta.json();

      setProdutos(dados);
    } catch (erro) {
      console.error(erro);
      alert("Não foi possível carregar os produtos.");
    } finally {
      setCarregandoLista(false);
    }
  }

  useEffect(() => {
    carregarProdutos();
  }, []);

  async function cadastrarProduto(evento: FormEvent) {
    evento.preventDefault();

    if (!nome.trim()) {
      alert("Informe o nome do produto.");
      return;
    }

    const preco = Number(precoCadastrado.replace(",", "."));

    if (!Number.isFinite(preco) || preco <= 0) {
      alert("Informe um preço válido.");
      return;
    }

    try {
      setCarregando(true);

      const resposta = await fetch("/api/produtos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: nome.trim(),
          precoCadastrado: preco,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(dados.erro || "Não foi possível cadastrar o produto.");
        return;
      }

      setNome("");
      setPrecoCadastrado("");

      await carregarProdutos();

      alert("Produto cadastrado com sucesso.");
    } catch (erro) {
      console.error(erro);
      alert("Erro ao cadastrar produto.");
    } finally {
      setCarregando(false);
    }
  }

  function formatarDinheiro(valor: string | number) {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function estiloStatus(status: Produto["status"]) {
    if (status === "ATIVO") {
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    }

    return "bg-red-100 text-red-700 border-red-200";
  }

  const produtosAtivos = produtos.filter(
    (produto) => produto.status === "ATIVO"
  ).length;

  const produtosInativos = produtos.filter(
    (produto) => produto.status === "INATIVO"
  ).length;

  const precoMedio =
    produtos.length > 0
      ? produtos.reduce(
          (total, produto) => total + Number(produto.precoCadastrado),
          0
        ) / produtos.length
      : 0;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Cabeçalho */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-2xl text-white shadow-sm">
              🌽
            </div>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Produtos
              </h1>

              <p className="mt-1 text-slate-600">
                Cadastre e consulte os produtos vendidos pela Pamonharia
                Rocinha.
              </p>
            </div>
          </div>
        </div>

        {/* Indicadores */}
        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-violet-700">
              Total de produtos
            </p>

            <p className="mt-2 text-3xl font-bold text-violet-900">
              {produtos.length}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">
              Produtos ativos
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-900">
              {produtosAtivos}
            </p>
          </div>

          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-red-700">
              Produtos inativos
            </p>

            <p className="mt-2 text-3xl font-bold text-red-900">
              {produtosInativos}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-700">
              Preço médio
            </p>

            <p className="mt-2 text-2xl font-bold text-amber-900">
              {formatarDinheiro(precoMedio)}
            </p>
          </div>
        </section>

        {/* Cadastro */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-5">
            <h2 className="text-xl font-semibold text-white">
              Cadastrar novo produto
            </h2>

            <p className="mt-1 text-sm text-violet-100">
              Informe o nome e o preço padrão do produto.
            </p>
          </div>

          <form
            onSubmit={cadastrarProduto}
            className="grid gap-5 p-6 md:grid-cols-2"
          >
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Nome do produto
              </label>

              <input
                type="text"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                placeholder="Ex.: Pamonha Doce"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Preço padrão
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={precoCadastrado}
                onChange={(evento) =>
                  setPrecoCadastrado(evento.target.value)
                }
                placeholder="Ex.: 9.00"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={carregando}
                className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {carregando
                  ? "Cadastrando..."
                  : "Cadastrar produto"}
              </button>
            </div>
          </form>
        </section>

        {/* Lista */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-semibold text-slate-900">
              Produtos cadastrados
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Produtos disponíveis no cadastro do sistema.
            </p>
          </div>

          {carregandoLista ? (
            <div className="p-10 text-center text-slate-500">
              Carregando produtos...
            </div>
          ) : produtos.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mb-3 text-4xl">🌽</div>

              <p className="font-medium text-slate-700">
                Nenhum produto cadastrado.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Utilize o formulário acima para cadastrar o primeiro produto.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 p-6 md:grid-cols-2">
              {produtos.map((produto) => (
                <article
                  key={produto.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-2xl">
                        🌽
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900">
                            {produto.nome}
                          </h3>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${estiloStatus(
                              produto.status
                            )}`}
                          >
                            {produto.status}
                          </span>
                        </div>

                        <p className="mt-3 text-sm text-slate-500">
                          Preço cadastrado
                        </p>

                        <p className="mt-1 text-2xl font-bold text-violet-700">
                          {formatarDinheiro(produto.precoCadastrado)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                      ID #{produto.id}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}