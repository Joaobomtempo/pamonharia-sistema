"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Padaria = { id: number; nome: string };
type Produto = { id: number; nome: string };
type Entrega = {
  id: number;
  codigo: string;
  dataEntrega: string;
  itens?: { id: number; quantidadeEntregue: number; precoUnitario: string | number; produto: Produto }[];
};
type Devolucao = {
  id: number;
  itens: {
    id: number;
    quantidadeDevolvida: number;
    itemEntrega: { produto: Produto };
  }[];
};
type Acerto = {
  id: number;
  quantidadeEntregue: number;
  quantidadeDevolvida: number;
  valorBruto: string | number;
  valorDevolvido: string | number;
  valorDevido: string | number;
  entrega: Entrega;
  devolucao: Devolucao | null;
};
type PagamentoItemLegado = {
  id: number;
  quantidadeVendida: number;
  valorVendido: string | number;
  valorDevolvido: string | number;
  valorLiquido: string | number;
  itemEntrega: {
    id: number;
    produto: Produto;
    entrega: Entrega;
  };
};
type Pagamento = {
  id: number;
  dataInicio: string;
  dataFim: string;
  valorDevido: string | number;
  valorRecebido: string | number | null;
  divergencia: boolean;
  status: "PENDENTE" | "PAGO";
  dataPagamento: string | null;
  criadoEm: string;
  padaria: Padaria;
  acertos: Acerto[];
  itens: PagamentoItemLegado[];
};

const dinheiro = (valor: string | number | null | undefined) =>
  valor == null
    ? "Não informado"
    : Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function dataBR(valor: string | null | undefined) {
  if (!valor) return "Não informado";
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? "Data inválida"
    : data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

async function lerResposta(resposta: Response) {
  const dados: unknown = await resposta.json();
  return dados;
}

function mensagemErro(dados: unknown, padrao: string) {
  if (dados && typeof dados === "object" && "erro" in dados) {
    const mensagem = (dados as { erro?: unknown }).erro;
    if (typeof mensagem === "string") return mensagem;
  }
  return padrao;
}

export default function PagamentosPage() {
  const [padarias, setPadarias] = useState<Padaria[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [padariaId, setPadariaId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [valoresRecebidos, setValoresRecebidos] = useState<Record<number, string>>({});
  const [criando, setCriando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [recebendoId, setRecebendoId] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const [rp, rpg] = await Promise.all([
        fetch("/api/padarias", { cache: "no-store" }),
        fetch("/api/pagamentos", { cache: "no-store" }),
      ]);
      const [dp, dpg] = await Promise.all([lerResposta(rp), lerResposta(rpg)]);
      if (!rp.ok || !rpg.ok || !Array.isArray(dp) || !Array.isArray(dpg)) {
        throw new Error("Não foi possível carregar os dados financeiros.");
      }
      setPadarias(dp as Padaria[]);
      setPagamentos(dpg as Pagamento[]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao buscar pagamentos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  const resumo = useMemo(() => {
    const pendentes = pagamentos.filter((p) => p.status === "PENDENTE");
    const pagos = pagamentos.filter((p) => p.status === "PAGO");
    return {
      pendentes: pendentes.length,
      pagos: pagos.length,
      aReceber: pendentes.reduce((s, p) => s + Number(p.valorDevido), 0),
      recebido: pagos.reduce((s, p) => s + Number(p.valorRecebido ?? 0), 0),
    };
  }, [pagamentos]);

  async function criarPagamento(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!padariaId || !dataInicio || !dataFim) {
      alert("Selecione uma padaria e informe as duas datas.");
      return;
    }
    if (dataInicio > dataFim) {
      alert("A data inicial não pode ser posterior à final.");
      return;
    }
    try {
      setCriando(true);
      const resposta = await fetch("/api/pagamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ padariaId: Number(padariaId), dataInicio, dataFim }),
      });
      const dados = await lerResposta(resposta);
      if (!resposta.ok) {
        alert(mensagemErro(dados, "Não foi possível criar o fechamento."));
        return;
      }
      setPadariaId("");
      setDataInicio("");
      setDataFim("");
      await carregarDados();
      alert("Fechamento financeiro criado com sucesso.");
    } catch (e) {
      console.error(e);
      alert("Falha de conexão ao criar fechamento.");
    } finally {
      setCriando(false);
    }
  }

  async function registrarRecebimento(pagamento: Pagamento) {
    const texto = valoresRecebidos[pagamento.id];
    if (texto == null || texto.trim() === "") {
      alert("Informe o valor recebido.");
      return;
    }
    const valorRecebido = Number(texto.replace(",", "."));
    if (!Number.isFinite(valorRecebido) || valorRecebido < 0 || Math.round(valorRecebido * 100) !== valorRecebido * 100 && Math.abs(Math.round(valorRecebido * 100) - valorRecebido * 100) > 0.00001) {
      alert("Informe um valor válido com no máximo duas casas decimais.");
      return;
    }
    const divergente = Math.round(valorRecebido * 100) !== Math.round(Number(pagamento.valorDevido) * 100);
    let confirmarDivergencia = false;
    if (divergente) {
      confirmarDivergencia = window.confirm(
        `O valor recebido (${dinheiro(valorRecebido)}) difere do valor devido (${dinheiro(pagamento.valorDevido)}). Deseja confirmar e registrar a divergência?`
      );
      if (!confirmarDivergencia) return;
    } else if (!window.confirm(`Confirmar recebimento de ${dinheiro(valorRecebido)}?`)) {
      return;
    }

    try {
      setRecebendoId(pagamento.id);
      const resposta = await fetch("/api/pagamentos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagamentoId: pagamento.id,
          valorRecebido,
          confirmarDivergencia,
        }),
      });
      const dados = await lerResposta(resposta);
      if (!resposta.ok) {
        alert(mensagemErro(dados, "Não foi possível registrar o recebimento."));
        return;
      }
      setValoresRecebidos((anterior) => {
        const proximo = { ...anterior };
        delete proximo[pagamento.id];
        return proximo;
      });
      await carregarDados();
      alert("Recebimento registrado com sucesso.");
    } catch (e) {
      console.error(e);
      alert("Falha de conexão ao registrar recebimento.");
    } finally {
      setRecebendoId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pagamentos</h1>
            <p className="mt-1 text-sm text-slate-600">Fechamentos financeiros e recebimentos das padarias parceiras.</p>
          </div>
          <button type="button" onClick={() => void carregarDados()} disabled={carregando} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50">Atualizar dados</button>
        </header>

        {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</div>}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores financeiros">
          {[
            { titulo: "Fechamentos pendentes", valor: String(resumo.pendentes), classe: "text-amber-800" },
            { titulo: "Fechamentos pagos", valor: String(resumo.pagos), classe: "text-emerald-800" },
            { titulo: "A receber (fechamentos)", valor: dinheiro(resumo.aReceber), classe: "text-blue-800" },
            { titulo: "Total recebido", valor: dinheiro(resumo.recebido), classe: "text-emerald-800" },
          ].map((indicador) => (
            <div key={indicador.titulo} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-600">{indicador.titulo}</p>
              <p className={`mt-2 text-2xl font-bold ${indicador.classe}`}>{indicador.valor}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-emerald-700 to-green-800 px-6 py-5 text-white">
            <h2 className="text-xl font-semibold">Novo fechamento financeiro</h2>
            <p className="mt-1 text-sm text-emerald-100">Inclui somente acertos ainda não vinculados a outro pagamento.</p>
          </div>
          <form onSubmit={criarPagamento} className="grid gap-5 p-6 md:grid-cols-3">
            <div>
              <label htmlFor="pag-padaria" className="mb-2 block text-sm font-semibold">Padaria</label>
              <select id="pag-padaria" required value={padariaId} onChange={(e) => setPadariaId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600">
                <option value="">Selecione uma padaria</option>
                {padarias.map((padaria) => <option key={padaria.id} value={padaria.id}>{padaria.nome}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="pag-inicio" className="mb-2 block text-sm font-semibold">Data inicial</label>
              <input id="pag-inicio" type="date" required value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label htmlFor="pag-fim" className="mb-2 block text-sm font-semibold">Data final</label>
              <input id="pag-fim" type="date" required value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600" />
            </div>
            <div className="md:col-span-3">
              <button type="submit" disabled={criando || carregando} className="rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{criando ? "Criando fechamento..." : "Criar fechamento financeiro"}</button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-semibold">Histórico financeiro</h2>
            <p className="mt-1 text-sm text-slate-500">Fechamentos, acertos vinculados e recebimentos registrados.</p>
          </div>
          {carregando ? (
            <p className="p-10 text-center text-slate-500">Carregando pagamentos...</p>
          ) : pagamentos.length === 0 ? (
            <div className="p-10 text-center"><p className="font-semibold">Nenhum fechamento registrado.</p><p className="mt-1 text-sm text-slate-500">Crie um fechamento usando o formulário acima.</p></div>
          ) : (
            <div className="space-y-5 p-5 sm:p-6">
              {pagamentos.map((pagamento) => {
                const pago = pagamento.status === "PAGO";
                const temDivergencia = pagamento.divergencia === true;
                return (
                  <article key={pagamento.id} className={`overflow-hidden rounded-2xl border ${temDivergencia ? "border-red-200" : pago ? "border-emerald-200" : "border-amber-200"}`}>
                    <div className={`flex flex-wrap items-start justify-between gap-4 p-5 ${temDivergencia ? "bg-red-50" : pago ? "bg-emerald-50" : "bg-amber-50"}`}>
                      <div>
                        <h3 className="text-lg font-bold">{pagamento.padaria.nome}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                          <span>Pagamento #{pagamento.id}</span>
                          <span aria-hidden="true">·</span>
                          <span>{dataBR(pagamento.dataInicio)} até {dataBR(pagamento.dataFim)}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${pago ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{pago ? "PAGO" : "PENDENTE"}</span>
                          {temDivergencia && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">DIVERGÊNCIA</span>}
                        </div>
                      </div>
                      <div className="sm:text-right"><p className="text-sm text-slate-600">Valor devido</p><p className="text-2xl font-bold">{dinheiro(pagamento.valorDevido)}</p></div>
                    </div>

                    <div className="grid gap-3 border-y border-slate-200 p-5 sm:grid-cols-3">
                      <div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-semibold uppercase text-blue-700">Valor devido</p><p className="mt-1 text-xl font-bold text-blue-900">{dinheiro(pagamento.valorDevido)}</p></div>
                      <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase text-emerald-700">Valor recebido</p><p className="mt-1 text-xl font-bold text-emerald-900">{dinheiro(pagamento.valorRecebido)}</p></div>
                      <div className="rounded-xl bg-slate-100 p-4"><p className="text-xs font-semibold uppercase text-slate-600">Data do recebimento</p><p className="mt-1 text-lg font-bold">{dataBR(pagamento.dataPagamento)}</p></div>
                    </div>

                    <div className="overflow-x-auto p-5">
                      <h4 className="mb-3 font-semibold">Acertos incluídos no fechamento</h4>
                      {pagamento.acertos?.length > 0 ? (
                        <table className="w-full min-w-[650px] text-left text-sm">
                          <thead><tr className="border-b border-slate-200 text-slate-500"><th className="pb-3 pr-4">Entrega</th><th className="pb-3 pr-4">Qtd. entregue</th><th className="pb-3 pr-4">Qtd. devolvida</th><th className="pb-3 pr-4">Bruto</th><th className="pb-3 pr-4">Devolvido</th><th className="pb-3">Devido</th></tr></thead>
                          <tbody>{pagamento.acertos.map((acerto) => (
                            <tr key={acerto.id} className="border-b border-slate-100">
                              <td className="py-3 pr-4"><div className="font-semibold">{acerto.entrega.codigo}</div><div className="text-xs text-slate-500">{dataBR(acerto.entrega.dataEntrega)}</div></td>
                              <td className="py-3 pr-4">{acerto.quantidadeEntregue}</td><td className="py-3 pr-4">{acerto.quantidadeDevolvida}</td>
                              <td className="py-3 pr-4">{dinheiro(acerto.valorBruto)}</td><td className="py-3 pr-4 text-red-700">− {dinheiro(acerto.valorDevolvido)}</td><td className="py-3 font-bold text-emerald-700">{dinheiro(acerto.valorDevido)}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      ) : pagamento.itens?.length > 0 ? (
                        <div><p className="mb-3 text-xs text-amber-700">Fechamento criado pelo modelo anterior de pagamentos.</p><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="pb-3">Entrega</th><th className="pb-3">Produto</th><th className="pb-3">Qtd. vendida</th><th className="pb-3">Bruto</th><th className="pb-3">Devolvido</th><th className="pb-3">Líquido</th></tr></thead><tbody>{pagamento.itens.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="py-3">{item.itemEntrega.entrega.codigo}</td><td className="py-3">{item.itemEntrega.produto.nome}</td><td className="py-3">{item.quantidadeVendida}</td><td className="py-3">{dinheiro(item.valorVendido)}</td><td className="py-3">− {dinheiro(item.valorDevolvido)}</td><td className="py-3 font-semibold">{dinheiro(item.valorLiquido)}</td></tr>)}</tbody></table></div>
                      ) : <p className="text-sm text-amber-700">Este fechamento não possui itens vinculados. Verifique os dados antes de registrar o recebimento.</p>}
                    </div>

                    {!pago ? (
                      <div className="border-t border-amber-200 bg-amber-50 p-5">
                        <h4 className="font-semibold text-amber-900">Registrar recebimento</h4>
                        <p className="mt-1 text-sm text-amber-800">Informe o valor pago pela padaria. Divergências exigem confirmação.</p>
                        <div className="mt-4 flex flex-wrap items-end gap-3">
                          <div><label htmlFor={`valor-${pagamento.id}`} className="mb-2 block text-sm font-semibold">Valor recebido (R$)</label><input id={`valor-${pagamento.id}`} type="number" min="0" step="0.01" value={valoresRecebidos[pagamento.id] ?? ""} onChange={(e) => setValoresRecebidos((anterior) => ({ ...anterior, [pagamento.id]: e.target.value }))} placeholder="Ex.: 90.00" className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 outline-none focus:border-amber-500" /></div>
                          <button type="button" onClick={() => void registrarRecebimento(pagamento)} disabled={recebendoId !== null} className="rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{recebendoId === pagamento.id ? "Registrando..." : "Registrar recebimento"}</button>
                        </div>
                      </div>
                    ) : <div className="border-t border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">✓ Recebimento registrado{temDivergencia ? " com divergência confirmada." : "."}</div>}
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <p className="text-xs text-slate-500">Os indicadores consideram fechamentos financeiros cadastrados. Movimentações anteriores à criação dos acertos precisam de regularização para aparecer em novos fechamentos.</p>
      </div>
    </main>
  );
}
