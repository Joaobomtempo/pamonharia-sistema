"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, RefreshCw, Wallet, Package, RotateCcw, Store } from "lucide-react";

type Padaria = { id: number; nome: string };
type Detalhe = { id: number; codigo: string; data: string; padaria: string; entregue: number; devolvido: number; cobrado: number; bruto: number; devolucoes: number; devido: number; pagamentoId: number | null; status: string };
type Relatorio = {
  totais: { movimentacoes: number; unidadesEntregues: number; unidadesDevolvidas: number; bruto: number; devolucoes: number; devido: number; semFechamento: number; emFechamentosPendentes: number };
  financeiro: { fechamentos: number; pendentes: number; pagos: number; divergencias: number; recebido: number; pendente: number };
  ranking: { padariaId: number; nome: string; movimentacoes: number; devido: number; devolucoes: number }[];
  detalhes: Detalhe[];
  observacao: string;
};

const dinheiro = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (data: string) => data.split("-").reverse().join("/");

export default function RelatoriosPage() {
  const [padarias, setPadarias] = useState<Padaria[]>([]);
  const [padariaId, setPadariaId] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const busca = useMemo(() => {
    const p = new URLSearchParams();
    if (padariaId) p.set("padariaId", padariaId);
    if (inicio) p.set("inicio", inicio);
    if (fim) p.set("fim", fim);
    return p.toString();
  }, [padariaId, inicio, fim]);

  async function carregar(query: string) {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await fetch(`/api/relatorios${query ? `?${query}` : ""}`, { cache: "no-store" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Falha ao carregar relatórios.");
      setRelatorio(dados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
      setRelatorio(null);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    fetch("/api/padarias", { cache: "no-store" }).then((r) => r.json()).then((data) => { if (Array.isArray(data)) setPadarias(data); }).catch(() => {});
  }, []);
  useEffect(() => { void carregar(busca); }, [busca]);

  const maior = Math.max(...(relatorio?.ranking.map((p) => p.devido) ?? [0]), 1);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold"><BarChart3 className="text-emerald-700" /> Relatórios</h1>
            <p className="mt-1 text-sm text-slate-500">Movimentações, valores e fechamentos da Pamonharia Rocinha.</p>
          </div>
          <button type="button" onClick={() => void carregar(busca)} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"><RefreshCw size={16} /> Atualizar</button>
        </header>

        <section className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-4">
          <label className="space-y-1 text-sm font-semibold">Padaria
            <select className="w-full rounded-lg border px-3 py-2 font-normal" value={padariaId} onChange={(e) => setPadariaId(e.target.value)}><option value="">Todas as padarias</option>{padarias.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
          </label>
          <label className="space-y-1 text-sm font-semibold">Data inicial<input type="date" className="w-full rounded-lg border px-3 py-2 font-normal" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
          <label className="space-y-1 text-sm font-semibold">Data final<input type="date" className="w-full rounded-lg border px-3 py-2 font-normal" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
          <div className="flex items-end"><a className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800" href={`/api/relatorios?${busca ? `${busca}&` : ""}formato=csv`}><Download size={16} /> Exportar Excel (CSV)</a></div>
        </section>

        {erro && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{erro}</p>}
        {carregando && <p className="rounded-xl border bg-white p-6 text-slate-500">Carregando relatório...</p>}

        {relatorio && !carregando && <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Movimentações", valor: String(relatorio.totais.movimentacoes), Icon: Package },
              { label: "Valor devido nos acertos", valor: dinheiro(relatorio.totais.devido), Icon: Wallet },
              { label: "Devoluções", valor: dinheiro(relatorio.totais.devolucoes), Icon: RotateCcw },
              { label: "Total recebido", valor: dinheiro(relatorio.financeiro.recebido), Icon: Store },
            ].map(({ label, valor, Icon }) => <article key={label} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between text-sm text-slate-500">{label}<Icon size={20} className="text-emerald-700" /></div><p className="mt-3 text-2xl font-bold">{valor}</p></article>)}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">Resumo operacional</h2>
              <dl className="space-y-3 text-sm">{[
                ["Unidades entregues", relatorio.totais.unidadesEntregues],
                ["Unidades devolvidas", relatorio.totais.unidadesDevolvidas],
                ["Valor bruto", dinheiro(relatorio.totais.bruto)],
                ["Acertos sem fechamento", dinheiro(relatorio.totais.semFechamento)],
                ["Acertos em fechamentos pendentes", dinheiro(relatorio.totais.emFechamentosPendentes)],
              ].map(([label, valor]) => <div key={label} className="flex justify-between gap-4 border-b pb-2"><dt className="text-slate-500">{label}</dt><dd className="font-semibold">{valor}</dd></div>)}</dl>
            </article>
            <article className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">Resumo dos fechamentos</h2>
              <dl className="space-y-3 text-sm">{[
                ["Fechamentos", relatorio.financeiro.fechamentos],
                ["Pendentes", relatorio.financeiro.pendentes],
                ["Pagos", relatorio.financeiro.pagos],
                ["Com divergência", relatorio.financeiro.divergencias],
                ["Valor pendente", dinheiro(relatorio.financeiro.pendente)],
              ].map(([label, valor]) => <div key={label} className="flex justify-between gap-4 border-b pb-2"><dt className="text-slate-500">{label}</dt><dd className="font-semibold">{valor}</dd></div>)}</dl>
              <p className="mt-3 text-xs text-slate-500">Valores financeiros apurados por fechamentos cujo período cruza o filtro informado.</p>
            </article>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="mb-5 text-lg font-bold">Ranking por padaria — valor devido</h2>
            {relatorio.ranking.length === 0 ? <p className="text-sm text-slate-500">Nenhuma movimentação com acerto neste filtro.</p> : <div className="space-y-5">{relatorio.ranking.map((p) => <div key={p.padariaId}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-medium">{p.nome} <span className="text-slate-500">({p.movimentacoes} movimentações)</span></span><strong>{dinheiro(p.devido)}</strong></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(0, p.devido / maior * 100)}%` }} /></div></div>)}</div>}
          </section>

          <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-lg font-bold">Detalhamento das movimentações</h2><p className="mt-1 text-xs text-slate-500">{relatorio.observacao}</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{["Data", "Padaria", "Código", "Entregue", "Devolvido", "Bruto", "Devoluções", "Devido", "Situação"].map((t) => <th key={t} className="px-4 py-3 font-semibold">{t}</th>)}</tr></thead><tbody>{relatorio.detalhes.map((d) => <tr key={d.id} className="border-t"><td className="px-4 py-3">{dataBR(d.data)}</td><td className="px-4 py-3">{d.padaria}</td><td className="px-4 py-3 text-xs">{d.codigo}</td><td className="px-4 py-3">{d.entregue}</td><td className="px-4 py-3">{d.devolvido}</td><td className="px-4 py-3">{dinheiro(d.bruto)}</td><td className="px-4 py-3">{dinheiro(d.devolucoes)}</td><td className="px-4 py-3 font-semibold text-emerald-700">{dinheiro(d.devido)}</td><td className="px-4 py-3">{d.status === "SEM_FECHAMENTO" ? "Sem fechamento" : d.status === "PENDENTE" ? "Pendente" : "Pago"}</td></tr>)}{relatorio.detalhes.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={9}>Nenhum acerto encontrado.</td></tr>}</tbody></table></div>
          </section>
        </>}
      </div>
    </main>
  );
}

