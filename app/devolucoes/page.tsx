"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type DevolucaoRegistrada = {
  id: number;
  registradaEm: string;
  entregaAnterior: { id: number; codigo: string; dataEntrega: string; padaria: { nome: string } };
  entregaAtual: { codigo: string; dataEntrega: string } | null;
  podeCancelar: boolean;
  motivoBloqueio: string | null;
  itens: { produto: string; quantidade: number }[];
};

type Produto = { id: number; nome: string };
type ItemEntrega = {
  id: number;
  quantidadeEntregue: number;
  precoUnitario: number | string;
  produto: Produto;
  itensDevolucao: { quantidadeDevolvida: number }[];
};
type Entrega = {
  id: number;
  codigo: string;
  dataEntrega: string;
  padaria: { id: number; nome: string };
  itens: ItemEntrega[];
};

const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const diaISO = (valor: string) => valor.slice(0, 10);
const diaBR = (valor: string) => {
  const partes = diaISO(valor).split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : valor;
};
const proximoDia = (valor: string) => {
  const data = new Date(`${diaISO(valor)}T00:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() + 1);
  return data.toISOString().slice(0, 10);
};

export default function DevolucoesPage() {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [devolucoes, setDevolucoes] = useState<DevolucaoRegistrada[]>([]);
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);
  const [anteriorId, setAnteriorId] = useState("");
  const [atualId, setAtualId] = useState("");
  const [quantidades, setQuantidades] = useState<Record<number, string>>({});
  const [observacoes, setObservacoes] = useState("");
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const carregar = useCallback(async () => {
    setCarregandoDados(true);
    setErro("");
    try {
      const resposta = await fetch("/api/entregas", { cache: "no-store" });
      const dados: unknown = await resposta.json();
      if (!resposta.ok || !Array.isArray(dados)) throw new Error("Não foi possível carregar as entregas.");
      setEntregas(dados as Entrega[]);
      const resDevolucoes = await fetch("/api/devolucoes/cancelaveis", { cache: "no-store" });
      const lista: unknown = await resDevolucoes.json();
      if (!resDevolucoes.ok || !Array.isArray(lista)) throw new Error("Não foi possível carregar a lista de devoluções.");
      setDevolucoes(lista as DevolucaoRegistrada[]);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Erro ao consultar movimentações.");
    } finally {
      setCarregandoDados(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);
  const anterior = useMemo(() => entregas.find(e => e.id === Number(anteriorId)), [entregas, anteriorId]);
  const atuais = useMemo(() => anterior ? entregas.filter(e =>
    e.id !== anterior.id && e.padaria.id === anterior.padaria.id &&
    diaISO(e.dataEntrega) === proximoDia(anterior.dataEntrega)) : [], [anterior, entregas]);
  const atual = useMemo(() => atuais.find(e => e.id === Number(atualId)), [atuais, atualId]);

  const linhas = useMemo(() => (anterior?.itens ?? []).map(item => {
    const jaDevolvidas = (item.itensDevolucao ?? []).reduce((n, d) => n + d.quantidadeDevolvida, 0);
    const disponivel = Math.max(0, item.quantidadeEntregue - jaDevolvidas);
    const itemHoje = atual?.itens.find(i => i.produto.id === item.produto.id);
    const quantidade = quantidades[item.id] === "" || quantidades[item.id] == null ? 0 : Number(quantidades[item.id]);
    const precoHoje = itemHoje ? Number(itemHoje.precoUnitario) : null;
    return { item, jaDevolvidas, disponivel, precoHoje, quantidade, desconto: precoHoje == null ? 0 : quantidade * precoHoje };
  }), [anterior, atual, quantidades]);

  const unidades = linhas.reduce((s, linha) => s + (Number.isFinite(linha.quantidade) ? linha.quantidade : 0), 0);
  const desconto = linhas.reduce((s, linha) => s + linha.desconto, 0);
  const selecionados = linhas.filter(l => l.quantidade > 0);

  async function registrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro("");
    setSucesso("");
    if (!anterior || !atual) return setErro("Selecione a entrega anterior e a movimentação do dia seguinte.");
    if (!selecionados.length) return setErro("Informe pelo menos uma quantidade devolvida.");
    for (const linha of linhas) {
      if (!Number.isSafeInteger(linha.quantidade) || linha.quantidade < 0 || linha.quantidade > linha.disponivel) {
        return setErro(`Quantidade inválida para ${linha.item.produto.nome}. Disponível: ${linha.disponivel}.`);
      }
      if (linha.quantidade > 0 && (linha.precoHoje == null || !Number.isFinite(linha.precoHoje))) {
        return setErro(`O produto ${linha.item.produto.nome} não consta na movimentação atual.`);
      }
    }
    if (!window.confirm(`Confirmar ${unidades} unidade(s) devolvida(s), com desconto estimado de ${moeda(desconto)} no acerto de ${atual.codigo}?`)) return;
    setSalvando(true);
    try {
      const resposta = await fetch("/api/devolucoes/complementar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entregaAnteriorId: anterior.id,
          entregaAtualId: atual.id,
          observacoes: observacoes.trim() || null,
          itens: selecionados.map(l => ({ itemEntregaId: l.item.id, quantidadeDevolvida: l.quantidade })),
        }),
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado?.erro || "Não foi possível registrar a devolução.");
      setSucesso(`Devolução registrada! Desconto: ${moeda(Number(resultado.desconto))}. Novo valor devido: ${moeda(Number(resultado.valorDevidoAtualizado))}.`);
      setAnteriorId("");
      setAtualId("");
      setQuantidades({});
      setObservacoes("");
      await carregar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Erro inesperado ao registrar devolução.");
    } finally {
      setSalvando(false);
    }
  }

  async function cancelarDevolucao(devolucao: DevolucaoRegistrada) {
    if (!devolucao.podeCancelar || cancelandoId !== null) return;
    const motivo = window.prompt(`Informe o motivo para cancelar a devolução nº ${devolucao.id} (10 a 500 caracteres):`);
    if (motivo === null) return;
    if (motivo.trim().length < 10 || motivo.trim().length > 500) {
      setErro("O motivo precisa ter entre 10 e 500 caracteres.");
      return;
    }
    if (!window.confirm(`Cancelar a devolução nº ${devolucao.id}? O desconto será estornado do acerto aberto. Esta ação ficará registrada na Auditoria.`)) return;
    setCancelandoId(devolucao.id);
    setErro("");
    setSucesso("");
    try {
      const resposta = await fetch(`/api/devolucoes/${devolucao.id}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado?.erro ?? "Falha ao cancelar a devolução.");
      setSucesso(`Devolução nº ${devolucao.id} cancelada. Desconto estornado: ${moeda(Number(resultado.estorno))}. Novo valor devido: ${moeda(Number(resultado.valorDevidoAtualizado))}.`);
      await carregar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível cancelar a devolução.");
    } finally {
      setCancelandoId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-600 text-2xl text-white">↩</div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Devoluções</h1>
              <p className="text-slate-600">Registre uma devolução esquecida e desconte no acerto da movimentação seguinte.</p>
            </div>
          </div>
          <button type="button" onClick={() => void carregar()} disabled={carregandoDados || salvando}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 disabled:opacity-50">Atualizar entregas</button>
        </header>

        {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{erro}</div>}
        {sucesso && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{sucesso}</div>}

        <form onSubmit={registrar} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-5 text-white">
            <h2 className="text-xl font-bold">Registrar devolução complementar</h2>
            <p className="mt-1 text-sm text-amber-100">Selecione a entrega de origem e a nova movimentação do dia seguinte da mesma padaria.</p>
          </div>
          <div className="space-y-6 p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">1. Entrega anterior (produtos que voltaram)
                <select value={anteriorId} disabled={carregandoDados || salvando} onChange={e => {
                  setAnteriorId(e.target.value); setAtualId(""); setQuantidades({}); setErro(""); setSucesso("");
                }} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900">
                  <option value="">Selecione a entrega anterior</option>
                  {entregas.map(e => <option key={e.id} value={e.id}>{e.codigo} — {e.padaria.nome} — {diaBR(e.dataEntrega)}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">2. Movimentação atual (receberá o desconto)
                <select value={atualId} disabled={!anterior || carregandoDados || salvando} onChange={e => {
                  setAtualId(e.target.value); setQuantidades({}); setErro("");
                }} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 disabled:bg-slate-100">
                  <option value="">Selecione a movimentação do dia seguinte</option>
                  {atuais.map(e => <option key={e.id} value={e.id}>{e.codigo} — {diaBR(e.dataEntrega)}</option>)}
                </select>
              </label>
            </div>
            {anterior && atuais.length === 0 && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Ainda não há uma movimentação da mesma padaria no dia seguinte ({diaBR(proximoDia(anterior.dataEntrega))}). Registre essa movimentação primeiro.</p>}
            {anterior && atual && <>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <strong>Padaria: {anterior.padaria.nome}.</strong> O desconto usa o preço da movimentação atual ({atual.codigo}), não o preço da entrega anterior.
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Produtos devolvidos</h3>
                {linhas.map(l => <section key={l.item.id} className="grid gap-4 rounded-2xl border border-slate-200 p-5 md:grid-cols-[1fr_180px_200px] md:items-center">
                  <div>
                    <p className="font-bold text-slate-900">{l.item.produto.nome}</p>
                    <p className="mt-1 text-sm text-slate-600">Entregue: {l.item.quantidadeEntregue} · Já devolvido: {l.jaDevolvidas} · Disponível: {l.disponivel}</p>
                    <p className="mt-1 text-sm text-slate-600">Preço de hoje: {l.precoHoje == null ? "Produto não entregue hoje" : moeda(l.precoHoje)}</p>
                  </div>
                  <label className="text-sm font-medium text-slate-700">Quantidade devolvida
                    <input type="number" min={0} max={l.disponivel} step={1} value={quantidades[l.item.id] ?? ""}
                      disabled={salvando || l.disponivel === 0 || l.precoHoje == null}
                      onChange={e => setQuantidades(q => ({ ...q, [l.item.id]: e.target.value }))}
                      placeholder="0" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-100" />
                  </label>
                  <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
                    <p>Desconto neste acerto</p><strong className="mt-1 block text-xl">{moeda(l.desconto)}</strong>
                  </div>
                </section>)}
              </div>
              <div className="grid gap-4 rounded-xl bg-slate-900 p-5 text-white sm:grid-cols-2">
                <div><p className="text-sm text-slate-300">Unidades devolvidas agora</p><p className="text-2xl font-bold">{unidades}</p></div>
                <div><p className="text-sm text-slate-300">Desconto estimado no acerto atual</p><p className="text-2xl font-bold text-emerald-300">{moeda(desconto)}</p></div>
              </div>
              <label className="block text-sm font-semibold text-slate-700">Observações
                <textarea rows={3} maxLength={500} value={observacoes} disabled={salvando} onChange={e => setObservacoes(e.target.value)}
                  placeholder="Ex.: Devolução não lançada durante a movimentação." className="mt-2 w-full rounded-xl border border-slate-300 p-3" />
              </label>
              <button type="submit" disabled={salvando || selecionados.length === 0}
                className="rounded-xl bg-amber-600 px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {salvando ? "Registrando..." : "Registrar devolução complementar"}
              </button>
            </>}
            {!anterior && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">Selecione a entrega anterior para começar.</div>}
          </div>
        </form>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-bold text-slate-900">Devoluções registradas</h2>
            <p className="mt-1 text-sm text-slate-600">Cancelamentos exigem motivo e só são permitidos antes do fechamento financeiro.</p>
          </div>
          <div className="space-y-3 p-5">
            {devolucoes.length === 0 && <p className="text-sm text-slate-500">Nenhuma devolução vinculada a um acerto encontrada.</p>}
            {devolucoes.map(d => <article key={d.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
              <div className="space-y-1 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Devolução #{d.id} — {d.entregaAnterior.padaria.nome}</p>
                <p>Origem: {d.entregaAnterior.codigo} · Acerto: {d.entregaAtual?.codigo ?? "Não associado"}</p>
                <p>{d.itens.map(i => `${i.produto}: ${i.quantidade} un.`).join(" · ")}</p>
                <p className="text-xs text-slate-500">Registrada em {diaBR(d.registradaEm)}</p>
                {d.motivoBloqueio && <p className="text-amber-700">{d.motivoBloqueio}</p>}
              </div>
              <button type="button" disabled={!d.podeCancelar || cancelandoId !== null || salvando}
                onClick={() => void cancelarDevolucao(d)}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">
                {cancelandoId === d.id ? "Cancelando..." : "Cancelar devolução"}
              </button>
            </article>)}
          </div>
        </section>
        <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <strong>Regras de segurança:</strong> só é possível descontar na movimentação do dia seguinte, da mesma padaria, sem fechamento financeiro, sem finalização e sem outra devolução vinculada. O servidor confere novamente todos esses requisitos ao salvar. Esta versão admite apenas uma devolução por acerto.
        </aside>
      </div>
    </main>
  );
}
