"use client";

import { FormEvent, useState } from "react";
import { Headset, Mail, Copy, CircleHelp, AlertCircle } from "lucide-react";

type Tipo = "Erro no sistema" | "Dúvida" | "Sugestão";
const EMAIL_SUPORTE = process.env.NEXT_PUBLIC_SUPORTE_EMAIL?.trim() ?? "";

export default function SuportePage() {
  const [tipo, setTipo] = useState<Tipo>("Erro no sistema");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [pagina, setPagina] = useState("");
  const [copiado, setCopiado] = useState(false);

  function montarMensagem() {
    return [
      "Suporte — ERP Pamonharia Rocinha",
      `Tipo: ${tipo}`,
      `Assunto: ${assunto.trim()}`,
      `Página afetada: ${pagina.trim() || "Não informada"}`,
      `Data: ${new Date().toLocaleString("pt-BR")}`,
      "",
      "Descrição:",
      descricao.trim(),
    ].join("\n");
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!assunto.trim() || !descricao.trim()) return;
    const destino = EMAIL_SUPORTE;
    const titulo = encodeURIComponent(`[Pamonharia Rocinha] ${tipo}: ${assunto.trim()}`);
    const corpo = encodeURIComponent(montarMensagem());
    window.location.href = `mailto:${destino}?subject=${titulo}&body=${corpo}`;
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(montarMensagem());
      setCopiado(true);
    } catch {
      alert("Não foi possível copiar automaticamente. Selecione e copie o texto do formulário.");
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><Headset size={28}/></div>
          <div><h2 className="text-2xl font-bold text-slate-900">Central de Suporte</h2><p className="mt-1 text-slate-600">Relate um erro, envie uma sugestão ou peça ajuda ao desenvolvedor.</p></div>
        </div>
      </div>
      <form onSubmit={enviar} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-slate-700">Tipo de solicitação
            <select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900">
              <option>Erro no sistema</option><option>Dúvida</option><option>Sugestão</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-700">Página onde aconteceu
            <input value={pagina} onChange={(e) => setPagina(e.target.value)} placeholder="Ex.: /pagamentos" className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal text-slate-900"/>
          </label>
        </div>
        <label className="block space-y-2 text-sm font-semibold text-slate-700">Assunto
          <input required maxLength={120} value={assunto} onChange={(e) => { setAssunto(e.target.value); setCopiado(false); }} placeholder="Ex.: Não consigo registrar um pagamento" className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal text-slate-900"/>
        </label>
        <label className="block space-y-2 text-sm font-semibold text-slate-700">Descreva o problema
          <textarea required minLength={10} rows={6} maxLength={4000} value={descricao} onChange={(e) => { setDescricao(e.target.value); setCopiado(false); }} placeholder="Explique o que aconteceu, qual mensagem apareceu e o que você estava tentando fazer." className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 font-normal text-slate-900"/>
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800"><Mail size={18}/>Abrir e-mail de suporte</button>
          <button type="button" onClick={copiar} disabled={!assunto.trim() || !descricao.trim()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"><Copy size={18}/>{copiado ? "Relato copiado" : "Copiar relato"}</button>
        </div>
        <div className="flex gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-950"><AlertCircle size={19} className="shrink-0"/><p>O botão abre seu aplicativo de e-mail com a mensagem pronta. Você precisa clicar em <strong>Enviar</strong> no aplicativo. O ERP ainda não envia e-mails diretamente.</p></div>
        {!EMAIL_SUPORTE && <div className="flex gap-2 rounded-xl bg-slate-100 p-4 text-sm text-slate-700"><CircleHelp size={19} className="shrink-0"/><p>Endereço do desenvolvedor ainda não configurado. Informe o destinatário no aplicativo de e-mail ou configure <code>NEXT_PUBLIC_SUPORTE_EMAIL</code> no arquivo <code>.env</code> e reinicie o servidor.</p></div>}
      </form>
    </main>
  );
}
