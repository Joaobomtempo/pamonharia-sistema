"use client";

import { FormEvent, useEffect, useState } from "react";

type Padaria = {
  id: number;
  nome: string;
  contato: string | null;
  endereco: string | null;
  status: "ATIVA" | "INATIVA" | "ARQUIVADA";
};

export default function PadariasPage() {
  const [padarias, setPadarias] = useState<Padaria[]>([]);

  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [endereco, setEndereco] = useState("");

  const [carregando, setCarregando] = useState(false);
  const [carregandoLista, setCarregandoLista] = useState(true);

  async function carregarPadarias() {
    try {
      setCarregandoLista(true);

      const resposta = await fetch("/api/padarias");

      if (!resposta.ok) {
        throw new Error("Erro ao carregar padarias.");
      }

      const dados = await resposta.json();

      setPadarias(dados);
    } catch (erro) {
      console.error(erro);

      alert("Não foi possível carregar as padarias.");
    } finally {
      setCarregandoLista(false);
    }
  }

  useEffect(() => {
    carregarPadarias();
  }, []);

  async function cadastrarPadaria(evento: FormEvent) {
    evento.preventDefault();

    if (!nome.trim()) {
      alert("Informe o nome da padaria.");
      return;
    }

    try {
      setCarregando(true);

      const resposta = await fetch("/api/padarias", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          nome: nome.trim(),
          contato: contato.trim(),
          endereco: endereco.trim(),
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(dados.erro || "Não foi possível cadastrar a padaria.");
        return;
      }

      setNome("");
      setContato("");
      setEndereco("");

      await carregarPadarias();

      alert("Padaria cadastrada com sucesso.");
    } catch (erro) {
      console.error(erro);

      alert("Erro ao cadastrar padaria.");
    } finally {
      setCarregando(false);
    }
  }

  function estiloStatus(status: Padaria["status"]) {
    if (status === "ATIVA") {
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    }

    if (status === "INATIVA") {
      return "bg-amber-100 text-amber-700 border-amber-200";
    }

    return "bg-red-100 text-red-700 border-red-200";
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Cabeçalho */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-2xl text-white shadow-sm">
              🏪
            </div>

            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Padarias
              </h1>

              <p className="mt-1 text-slate-600">
                Cadastre e consulte as padarias parceiras da Pamonharia
                Rocinha.
              </p>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-blue-700">
              Total de padarias
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-900">
              {padarias.length}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">
              Padarias ativas
            </p>

            <p className="mt-2 text-3xl font-bold text-emerald-900">
              {
                padarias.filter(
                  (padaria) => padaria.status === "ATIVA"
                ).length
              }
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-700">
              Inativas / arquivadas
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-900">
              {
                padarias.filter(
                  (padaria) => padaria.status !== "ATIVA"
                ).length
              }
            </p>
          </div>
        </section>

        {/* Cadastro */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
            <h2 className="text-xl font-semibold text-white">
              Cadastrar nova padaria
            </h2>

            <p className="mt-1 text-sm text-blue-100">
              Informe os dados do estabelecimento parceiro.
            </p>
          </div>

          <form
            onSubmit={cadastrarPadaria}
            className="grid gap-5 p-6 md:grid-cols-2"
          >
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Nome da padaria
              </label>

              <input
                type="text"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                placeholder="Ex.: Padaria Central"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Contato
              </label>

              <input
                type="text"
                value={contato}
                onChange={(evento) =>
                  setContato(evento.target.value)
                }
                placeholder="Telefone ou responsável"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Endereço
              </label>

              <input
                type="text"
                value={endereco}
                onChange={(evento) =>
                  setEndereco(evento.target.value)
                }
                placeholder="Endereço da padaria"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={carregando}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {carregando
                  ? "Cadastrando..."
                  : "Cadastrar padaria"}
              </button>
            </div>
          </form>
        </section>

        {/* Lista */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-semibold text-slate-900">
              Padarias cadastradas
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Estabelecimentos registrados no sistema.
            </p>
          </div>

          {carregandoLista ? (
            <div className="p-10 text-center text-slate-500">
              Carregando padarias...
            </div>
          ) : padarias.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mb-3 text-4xl">🏪</div>

              <p className="font-medium text-slate-700">
                Nenhuma padaria cadastrada.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Utilize o formulário acima para cadastrar a primeira.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {padarias.map((padaria) => (
                <article
                  key={padaria.id}
                  className="p-6 transition hover:bg-slate-50"
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xl">
                        🏪
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900">
                            {padaria.nome}
                          </h3>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${estiloStatus(
                              padaria.status
                            )}`}
                          >
                            {padaria.status}
                          </span>
                        </div>

                        <div className="mt-3 space-y-1 text-sm text-slate-600">
                          <p>
                            <span className="font-semibold text-slate-700">
                              Contato:
                            </span>{" "}
                            {padaria.contato || "Não informado"}
                          </p>

                          <p>
                            <span className="font-semibold text-slate-700">
                              Endereço:
                            </span>{" "}
                            {padaria.endereco || "Não informado"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
                      ID #{padaria.id}
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