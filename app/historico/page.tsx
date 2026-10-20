"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, CalendarDays, ClipboardList, RefreshCw, Search } from "lucide-react";

type Padaria = { id: number; nome: string };
type ItemEntrega = {
  id: number;
  quantidadeEntregue: number;
  precoUnitario: string | number;
  produto: { id: number; nome: string };
  itensDevolucao?: { quantidadeDevolvida: number }[];
};
type Entrega = {
  id: number;
  codigo: string;
  dataEntrega: string;
  status: string;
  padaria: Padaria;
  itens: ItemEntrega[];
};

const dinheiro = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function dataBR(data: string) {
  const d = new Date(data);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function dataISO(data: string) {
  const d = new Date(data);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default function HistoricoPage() {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [padarias, setPadarias] = useState<Padaria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [padariaId, setPadariaId] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [pagina, setPagina] = useState(1);
  const porPagina = 15;

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const [resEntregas, resPadarias] = await Promise.all([
        fetch("/api/entregas", { cache: "no-store" }),
        fetch("/api/padarias", { cache: "no-store" }),
      ]);
      if (!resEntregas.ok || !resPadarias.ok) throw new Error("Não foi possível consultar o histórico.");
      const [dadosEntregas, dadosPadarias] = await Promise.all([resEntregas.json(), resPadarias.json()]);
      if (!Array.isArray(dadosEntregas) || !Array.isArray(dadosPadarias)) throw new Error("Formato inesperado dos dados.");
      setEntregas(dadosEntregas);
      setPadarias(dadosPadarias);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar os registros.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { setPagina(1); }, [busca, padariaId, inicio, fim]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return entregas.filter((entrega) => {
      if (padariaId && entrega.padaria?.id !== Number(padariaId)) return false;
      const dia = dataISO(entrega.dataEntrega);
      if (inicio && dia < inicio) return false;
      if (fim && dia > fim) return false;
      if (!termo) return true;
      return [entrega.codigo, String(entrega.id), entrega.padaria?.nome ?? ""]
        .some((valor) => valor.toLocaleLowerCase("pt-BR").includes(termo));
    }).sort((a, b) => new Date(b.dataEntrega).getTime() - new Date(a.dataEntrega).getTime() || b.id - a.id);
  }, [entregas, busca, padariaId, inicio, fim]);

  const paginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const exibidas = filtradas.slice((pagina - 1) * porPagina, pagina * porPagina);
  const brutoFiltrado = filtradas.reduce((total, entrega) => total + (entrega.itens ?? []).reduce(
    (soma, item) => soma + item.quantidadeEntregue * Number(item.precoUnitario), 0
  ), 0);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white"><ClipboardList size={25} /></span>
            <div><h1 className="text-2xl font-bold text-slate-900">Histórico de movimentações</h1>
              <p className="text-sm text-slate-500">Consulte entregas anteriores e baixe novamente seus comprovantes.</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void carregar()} disabled={carregando}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">
              <RefreshCw size={16} /> Atualizar
            </button>
            <Link href="/entregas" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">Nova movimentação</Link>
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0">
              <label htmlFor="busca-historico" className="block text-sm font-medium text-slate-700">Código ou padaria</label>
              <div className="relative mt-2 min-w-0">
                <Search aria-hidden="true" size={17} className="pointer-events-none absolute left-6 top-1/2 z-10 -translate-y-1/2 text-slate-400" />
                <input id="busca-historico" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar movimentação"
                  className="block h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white !pl-11 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100" style={{ paddingLeft: "20px" }} />
              </div>
            </div>
            <label className="block text-sm font-medium text-slate-700">Padaria
              <select value={padariaId} onChange={(e) => setPadariaId(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900">
                <option value="">Todas as padarias</option>
                {padarias.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">Data inicial
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Data final
              <input type="date" min={inicio || undefined} value={fim} onChange={(e) => setFim(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900" />
            </label>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-sm text-slate-500"><CalendarDays size={16}/> Movimentações encontradas</div><p className="mt-2 text-2xl font-bold text-slate-900">{filtradas.length}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Valor bruto entregue (não é valor do acerto)</p><p className="mt-2 text-2xl font-bold text-slate-900">{dinheiro(brutoFiltrado)}</p></div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5"><h2 className="font-semibold text-slate-900">Entregas registradas</h2><p className="text-xs text-slate-500">Os PDFs estão disponíveis para entregas com acerto financeiro registrado.</p></div>
          {erro ? <div role="alert" className="p-6 text-red-700">{erro}</div> : carregando ? <div className="p-10 text-center text-slate-500">Carregando histórico...</div> : filtradas.length === 0 ? <div className="p-10 text-center text-slate-500">Nenhuma movimentação encontrada.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600"><tr><th className="p-4">Data</th><th className="p-4">Código</th><th className="p-4">Padaria</th><th className="p-4">Produtos</th><th className="p-4">Valor bruto</th><th className="p-4">Situação</th><th className="p-4">Comprovante</th></tr></thead>
                <tbody>
                  {exibidas.map((entrega) => {
                    const bruto = (entrega.itens ?? []).reduce((soma, item) => soma + item.quantidadeEntregue * Number(item.precoUnitario), 0);
                    const quantidade = (entrega.itens ?? []).reduce((soma, item) => soma + item.quantidadeEntregue, 0);
                    return <tr key={entrega.id} className="border-t border-slate-100 text-slate-700">
                      <td className="p-4 whitespace-nowrap">{dataBR(entrega.dataEntrega)}</td>
                      <td className="p-4 font-mono text-xs">{entrega.codigo}</td>
                      <td className="p-4 font-medium">{entrega.padaria?.nome ?? "—"}</td>
                      <td className="p-4">{quantidade} un. · {(entrega.itens ?? []).map(item => item.produto?.nome ?? "Produto").join(", ")}</td>
                      <td className="p-4 whitespace-nowrap">{dinheiro(bruto)}</td>
                      <td className="p-4">{entrega.status.replaceAll("_", " ")}</td>
                      <td className="p-4"><a href={`/api/comprovantes/${entrega.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-800 hover:bg-emerald-100"><ArrowDownToLine size={16}/> PDF</a></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
          {filtradas.length > porPagina && <div className="flex items-center justify-between gap-4 border-t border-slate-200 p-4 text-sm">
            <span className="text-slate-500">Página {pagina} de {paginas}</span>
            <div className="flex gap-2"><button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p-1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><button type="button" disabled={pagina >= paginas} onClick={() => setPagina((p) => p+1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Próxima</button></div>
          </div>}
        </section>
      </div>
    </div>
  );
}
