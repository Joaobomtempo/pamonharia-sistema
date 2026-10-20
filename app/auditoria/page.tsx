"use client";

import { useCallback, useEffect, useState } from "react";

type Registro = {
  id: number;
  tabelaAfetada: string;
  registroId: number | null;
  acao: string;
  motivo: string | null;
  realizadoEm: string;
  realizadoPor: { nomeCompleto: string; usuario: string; tipo: string } | null;
  dadosAnteriores: unknown;
  dadosNovos: unknown;
};

function formatarData(data: string) {
  return new Date(data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default function AuditoriaPage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [tabela, setTabela] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const params = new URLSearchParams();
      if (tabela) params.set("tabela", tabela);
      if (inicio) params.set("inicio", inicio);
      if (fim) params.set("fim", fim);
      const resposta = await fetch(`/api/auditoria?${params.toString()}`, { cache: "no-store" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Falha ao buscar a auditoria.");
      if (!Array.isArray(dados)) throw new Error("Resposta inesperada.");
      setRegistros(dados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setCarregando(false);
    }
  }, [tabela, inicio, fim]);

  useEffect(() => { void carregar(); }, [carregar]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Auditoria do sistema</h1>
          <p className="mt-1 text-sm text-slate-500">Ações registradas por usuários. Exibição limitada aos 200 registros mais recentes do filtro.</p>
        </header>
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Módulo
            <select value={tabela} onChange={(e) => setTabela(e.target.value)} className="mt-2 block h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
              <option value="">Todos</option>
              <option value="Entrega">Movimentações</option>
              <option value="Pagamento">Pagamentos</option>
              <option value="Usuario">Usuários</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Início
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="mt-2 block h-11 w-full rounded-lg border border-slate-300 px-3" />
          </label>
          <label className="text-sm font-medium text-slate-700">Fim
            <input type="date" value={fim} min={inicio || undefined} onChange={(e) => setFim(e.target.value)} className="mt-2 block h-11 w-full rounded-lg border border-slate-300 px-3" />
          </label>
          <div className="flex items-end"><button type="button" onClick={() => void carregar()} disabled={carregando} className="h-11 w-full rounded-lg bg-emerald-700 px-4 font-semibold text-white disabled:opacity-50">Atualizar</button></div>
        </section>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {erro ? <p role="alert" className="p-5 text-red-700">{erro}</p> : carregando ? <p className="p-6 text-slate-500">Carregando...</p> : registros.length === 0 ? <p className="p-6 text-slate-500">Nenhuma ação registrada neste filtro.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">Data/hora</th><th className="p-4">Usuário</th><th className="p-4">Módulo</th><th className="p-4">Ação</th><th className="p-4">Registro</th><th className="p-4">Detalhes</th></tr></thead>
                <tbody>{registros.map((item) => <tr key={item.id} className="border-t border-slate-100 align-top text-slate-700">
                  <td className="whitespace-nowrap p-4">{formatarData(item.realizadoEm)}</td>
                  <td className="p-4">{item.realizadoPor?.nomeCompleto ?? "Sistema"}<p className="text-xs text-slate-400">{item.realizadoPor?.usuario ?? "—"}</p></td>
                  <td className="p-4">{item.tabelaAfetada}</td>
                  <td className="p-4 font-semibold">{item.acao}</td>
                  <td className="p-4">{item.registroId ?? "—"}</td>
                  <td className="max-w-md p-4">
                    {item.motivo && <p className="mb-2"><strong>Motivo:</strong> {item.motivo}</p>}
                    {(item.dadosAnteriores != null || item.dadosNovos != null) && <details><summary className="cursor-pointer font-medium text-emerald-700">Ver alterações</summary><pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs whitespace-pre-wrap break-all">{JSON.stringify({ anterior: item.dadosAnteriores, novo: item.dadosNovos }, null, 2)}</pre></details>}
                  </td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
