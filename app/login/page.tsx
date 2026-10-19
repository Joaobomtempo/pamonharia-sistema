"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setErro(""); setEnviando(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario, senha }) });
      const result = await response.json();
      if (!response.ok) { setErro(result.erro || "Não foi possível entrar."); return; }
      router.replace(result.usuario?.tipo === "DESENVOLVEDOR" ? "/manutencao" : result.usuario?.tipo === "FUNCIONARIO" ? "/entregas" : "/"); router.refresh();
    } catch { setErro("Não foi possível conectar ao servidor."); }
    finally { setEnviando(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div><h1 className="text-2xl font-bold text-slate-900">Pamonharia Rocinha</h1><p className="mt-1 text-sm text-slate-500">Entre para acessar o ERP</p></div>
        <div className="space-y-1"><label htmlFor="usuario" className="text-sm font-medium">Usuário</label><input id="usuario" autoComplete="username" required value={usuario} onChange={e=>setUsuario(e.target.value)} className="w-full rounded-lg border border-slate-300 p-3 text-slate-900" /></div>
        <div className="space-y-1"><label htmlFor="senha" className="text-sm font-medium">Senha</label><input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={e=>setSenha(e.target.value)} className="w-full rounded-lg border border-slate-300 p-3 text-slate-900" /></div>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        <button disabled={enviando} type="submit" className="w-full rounded-lg bg-emerald-700 p-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{enviando ? "Entrando..." : "Entrar"}</button>
      </form>
    </main>
  );
}
