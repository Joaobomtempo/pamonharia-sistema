"use client";
import { useState } from "react";
type Estado = { sistema: string; banco: string; verificadoEm: string };
export default function ManutencaoPage() {
 const [estado, setEstado] = useState<Estado | null>(null);
 const [erro, setErro] = useState("");
 const [carregando, setCarregando] = useState(false);
 async function verificar() {
   setCarregando(true); setErro("");
   try {
     const resposta = await fetch("/api/manutencao", { cache: "no-store" });
     const dados = await resposta.json();
     if (!resposta.ok) { setErro(dados.erro || "Serviço indisponível."); return; }
     setEstado(dados);
   } catch { setErro("Falha de conexão."); }
   finally { setCarregando(false); }
 }
 async function sair() { await fetch("/api/auth/logout", {method:"POST"}); window.location.href="/login"; }
 return <main className="min-h-screen bg-slate-50 p-8 text-slate-900"><div className="mx-auto max-w-xl space-y-6 rounded-2xl border bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Manutenção técnica</h1><p className="text-sm text-slate-600">Área restrita. Sem acesso a dados financeiros ou operações comerciais.</p><div className="flex gap-3"><button onClick={verificar} disabled={carregando} className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">{carregando ? "Verificando..." : "Verificar sistema"}</button><button onClick={sair} className="rounded-lg border px-4 py-2">Sair</button></div>{estado && <div className="rounded-lg border bg-slate-50 p-4"><p>Sistema: {estado.sistema}</p><p>Banco de dados: {estado.banco}</p><p>Verificado em: {new Date(estado.verificadoEm).toLocaleString("pt-BR")}</p></div>}{erro && <p role="alert" className="text-red-700">{erro}</p>}</div></main>;
}
