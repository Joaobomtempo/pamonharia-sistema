"use client";

import { useEffect, useState } from "react";

type Padaria = {
  id: number;
  nome: string;
  contato: string | null;
  endereco: string | null;
  status: string;
};

export default function PadariasPage() {
  const [padarias, setPadarias] = useState<Padaria[]>([]);
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [endereco, setEndereco] = useState("");

  async function carregarPadarias() {
    const resposta = await fetch("/api/padarias");
    const dados = await resposta.json();

    setPadarias(dados);
  }

  async function cadastrarPadaria(event: React.FormEvent) {
    event.preventDefault();

    await fetch("/api/padarias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nome,
        contato,
        endereco,
      }),
    });

    setNome("");
    setContato("");
    setEndereco("");

    await carregarPadarias();
  }

  useEffect(() => {
    carregarPadarias();
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold">
          Gerenciamento de Padarias
        </h1>

        <form
          onSubmit={cadastrarPadaria}
          className="mb-8 rounded-lg bg-white p-6 shadow"
        >
          <h2 className="mb-4 text-xl font-semibold">
            Nova Padaria
          </h2>

          <div className="grid gap-4">
            <input
              type="text"
              placeholder="Nome da padaria"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              required
              className="rounded border p-3"
            />

            <input
              type="text"
              placeholder="Contato"
              value={contato}
              onChange={(event) => setContato(event.target.value)}
              className="rounded border p-3"
            />

            <input
              type="text"
              placeholder="Endereço"
              value={endereco}
              onChange={(event) => setEndereco(event.target.value)}
              className="rounded border p-3"
            />

            <button
              type="submit"
              className="rounded bg-black p-3 text-white"
            >
              Cadastrar Padaria
            </button>
          </div>
        </form>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">
            Padarias Cadastradas
          </h2>

          <div className="space-y-3">
            {padarias.map((padaria) => (
              <div
                key={padaria.id}
                className="rounded border p-4"
              >
                <p className="font-semibold">
                  {padaria.nome}
                </p>

                <p>
                  Contato: {padaria.contato || "Não informado"}
                </p>

                <p>
                  Endereço: {padaria.endereco || "Não informado"}
                </p>

                <p>
                  Status: {padaria.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}