"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Usuario = {
  id: number;
  nomeCompleto: string;
  usuario: string;
  tipo: "DONO" | "FUNCIONARIO" | "DESENVOLVEDOR";
  status: "ATIVO" | "INATIVO";
  dataCadastro: string;
};

async function requisicao<T>(metodo: "GET" | "POST" | "PATCH", body?: object): Promise<T> {
  const resposta = await fetch("/api/usuarios", {
    method: metodo,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || `Erro HTTP ${resposta.status}`);
  return dados as T;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [tipo, setTipo] = useState<"DONO" | "FUNCIONARIO" | "DESENVOLVEDOR">("FUNCIONARIO");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await requisicao<Usuario[]>("GET");
      setUsuarios(dados);
      setErro("");
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao carregar usuários."); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function cadastrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(""); setSucesso(""); setSalvando(true);
    try {
      await requisicao<Usuario>("POST", { nomeCompleto, usuario, senha, tipo });
      setNomeCompleto(""); setUsuario(""); setSenha(""); setTipo("FUNCIONARIO");
      setSucesso("Usuário cadastrado com sucesso.");
      await carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao cadastrar."); }
    finally { setSalvando(false); }
  }

  async function alterarStatus(u: Usuario) {
    const novo = u.status === "ATIVO" ? "INATIVO" : "ATIVO";
    if (!window.confirm(`${novo === "INATIVO" ? "Desativar" : "Ativar"} o usuário ${u.usuario}?`)) return;
    await alterar({ id: u.id, acao: "status", status: novo }, "Status atualizado.");
  }

  async function redefinirSenha(u: Usuario) {
    const nova = window.prompt(`Digite a nova senha para ${u.usuario} (mínimo 12 caracteres):`);
    if (nova === null) return;
    if (nova.length < 12) { setErro("A senha deve ter pelo menos 12 caracteres."); return; }
    if (!window.confirm(`Confirma a redefinição de senha de ${u.usuario}?`)) return;
    await alterar({ id: u.id, acao: "senha", senha: nova }, "Senha redefinida com sucesso.");
  }

  async function alterarPerfil(u: Usuario) {
    const novo = window.prompt(`Novo perfil de ${u.usuario}: DONO, FUNCIONARIO ou DESENVOLVEDOR`, u.tipo)?.toUpperCase();
    if (!novo) return;
    if (novo !== "DONO" && novo !== "FUNCIONARIO" && novo !== "DESENVOLVEDOR") { setErro("Perfil inválido."); return; }
    if (!window.confirm(`Alterar o perfil de ${u.usuario} para ${novo}?`)) return;
    await alterar({ id: u.id, acao: "perfil", tipo: novo }, "Perfil atualizado.");
  }

  async function alterar(body: object, mensagem: string) {
    setErro(""); setSucesso(""); setSalvando(true);
    try { await requisicao<Usuario>("PATCH", body); setSucesso(mensagem); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Falha ao alterar usuário."); }
    finally { setSalvando(false); }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Usuários e permissões</h1>
          <p className="mt-1 text-sm text-slate-500">Somente o proprietário pode gerenciar contas.</p>
        </header>
        {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</p>}
        {sucesso && <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{sucesso}</p>}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-emerald-700 px-6 py-4 text-white"><h2 className="text-lg font-semibold">Cadastrar usuário</h2></div>
          <form onSubmit={cadastrar} className="grid gap-4 p-6 sm:grid-cols-2">
            <label className="text-sm font-medium">Nome completo
              <input required minLength={3} maxLength={120} value={nomeCompleto} onChange={e => setNomeCompleto(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 p-3" />
            </label>
            <label className="text-sm font-medium">Nome de usuário
              <input required minLength={3} maxLength={40} value={usuario} onChange={e => setUsuario(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 p-3" placeholder="ex.: funcionario1" />
            </label>
            <label className="text-sm font-medium">Senha inicial (mínimo 12 caracteres)
              <input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 p-3" />
            </label>
            <label className="text-sm font-medium">Perfil
              <select value={tipo} onChange={e => setTipo(e.target.value as "DONO" | "FUNCIONARIO" | "DESENVOLVEDOR")} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3">
                <option value="FUNCIONARIO">Funcionário — entregas e devoluções</option>
                <option value="DONO">Dono — acesso administrativo</option>
                <option value="DESENVOLVEDOR">Desenvolvedor — manutenção restrita</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={salvando} className="rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white disabled:opacity-50">{salvando ? "Salvando..." : "Cadastrar usuário"}</button>
            </div>
          </form>
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <h2 className="text-lg font-semibold">Contas cadastradas</h2>
            <button onClick={() => void carregar()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Atualizar</button>
          </div>
          {carregando ? <p className="p-6 text-slate-500">Carregando...</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3">Usuário</th><th className="px-5 py-3">Perfil</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Ações</th></tr></thead>
              <tbody>{usuarios.map(u => <tr key={u.id} className="border-t border-slate-100">
                <td className="px-5 py-4"><div className="font-semibold">{u.nomeCompleto}</div><div className="text-slate-500">{u.usuario}</div></td>
                <td className="px-5 py-4">{u.tipo === "DONO" ? "Dono" : u.tipo === "FUNCIONARIO" ? "Funcionário" : "Desenvolvedor"}</td>
                <td className="px-5 py-4">{u.status === "ATIVO" ? "Ativo" : "Inativo"}</td>
                <td className="space-x-2 px-5 py-4">
                  <button disabled={salvando} onClick={() => void redefinirSenha(u)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50">Redefinir senha</button>
                  <button disabled={salvando} onClick={() => void alterarStatus(u)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50">{u.status === "ATIVO" ? "Desativar" : "Ativar"}</button>
                  <button disabled={salvando} onClick={() => void alterarPerfil(u)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50">Alterar perfil</button>
                </td>
              </tr>)}</tbody>
            </table></div>
          )}
        </section>
        <p className="text-xs text-slate-500">Atenção: desativar uma conta impede novos logins, mas a revogação imediata de sessões existentes exige uma proteção adicional nas rotas.</p>
      </div>
    </main>
  );
}
