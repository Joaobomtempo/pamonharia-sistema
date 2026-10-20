"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Truck, ReceiptText, ChartNoAxesCombined,
  Store, Package, Users, Wrench, Headset, LogOut, ClipboardList,
  Menu, X, ChevronRight, Leaf, RotateCcw,
} from "lucide-react";

type Perfil = "DONO" | "FUNCIONARIO" | "DESENVOLVEDOR";
type UsuarioAtual = { id: number; usuario: string; nome: string; tipo: Perfil };
type ItemMenu = { label: string; href: string; icon: typeof LayoutDashboard; perfis: Perfil[] };

const itens: ItemMenu[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, perfis: ["DONO"] },
  { label: "Movimentações", href: "/entregas", icon: Truck, perfis: ["DONO", "FUNCIONARIO"] },
  { label: "Devoluções", href: "/devolucoes", icon: RotateCcw, perfis: ["DONO", "FUNCIONARIO"] },
  { label: "Histórico", href: "/historico", icon: ClipboardList, perfis: ["DONO", "FUNCIONARIO"] },
  { label: "Pagamentos", href: "/pagamentos", icon: ReceiptText, perfis: ["DONO"] },
  { label: "Relatórios", href: "/relatorios", icon: ChartNoAxesCombined, perfis: ["DONO"] },
  { label: "Padarias", href: "/padarias", icon: Store, perfis: ["DONO"] },
  { label: "Produtos", href: "/produtos", icon: Package, perfis: ["DONO"] },
  { label: "Usuários", href: "/usuarios", icon: Users, perfis: ["DONO"] },
  { label: "Manutenção", href: "/manutencao", icon: Wrench, perfis: ["DESENVOLVEDOR"] },
  { label: "Suporte", href: "/suporte", icon: Headset, perfis: ["DONO", "FUNCIONARIO", "DESENVOLVEDOR"] },
];

const nomes: Record<Perfil, string> = {
  DONO: "Administrador", FUNCIONARIO: "Funcionário", DESENVOLVEDOR: "Desenvolvedor",
};

export default function SistemaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioAtual | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const login = pathname === "/login";

  useEffect(() => {
    if (login) { setUsuario(null); setCarregando(false); return; }
    let ativo = true;
    setCarregando(true);
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error("Sessão inválida"); return r.json() as Promise<UsuarioAtual>; })
      .then((u) => { if (ativo) setUsuario(u); })
      .catch(() => { if (ativo) { setUsuario(null); router.replace("/login"); } })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [pathname, router, login]);

  useEffect(() => { setAberto(false); }, [pathname]);
  useEffect(() => {
    if (!aberto) return;
    const fecharEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("keydown", fecharEsc);
    return () => document.removeEventListener("keydown", fecharEsc);
  }, [aberto]);

  async function sair() {
    if (saindo) return;
    setSaindo(true);
    try {
      const r = await fetch("/api/auth/logout", { method: "POST" });
      if (!r.ok) throw new Error("Falha ao sair");
      setAberto(false);
      setUsuario(null);
      router.replace("/login");
      router.refresh();
    } catch { alert("Não foi possível sair. Tente novamente."); }
    finally { setSaindo(false); }
  }

  if (login) return <>{children}</>;
  if (carregando || !usuario) return <div className="erp-loading">Carregando sistema...</div>;

  const permitidos = itens.filter((item) => item.perfis.includes(usuario.tipo));
  const atual = permitidos.find((item) => item.href === pathname)?.label ?? "Sistema de Gestão";
  const inicio = usuario.tipo === "DONO" ? "/" : usuario.tipo === "DESENVOLVEDOR" ? "/manutencao" : "/entregas";

  return (
    <div className="erp-shell">
      <style>{`
        .erp-shell { --erp-nav-width: 268px; min-height: 100vh; background: #f7f9fc; font-family: var(--font-geist-sans), Arial, sans-serif; }
        .erp-shell *, .erp-shell *::before, .erp-shell *::after { box-sizing: border-box; }
        .erp-sidebar { position: fixed; top: 0; bottom: 0; left: 0; width: var(--erp-nav-width); z-index: 60; display: flex; flex-direction: column; background: #0f172a; color: #f8fafc; border-right: 1px solid #243047; transition: transform .22s ease; }
        .erp-brand { display: flex; align-items: center; gap: 11px; padding: 20px 16px; border-bottom: 1px solid #293548; min-height: 86px; text-decoration: none; color: white; }
        .erp-brand-icon { flex-shrink: 0; display: grid; place-items: center; width: 43px; height: 43px; border-radius: 13px; background: #059669; }
        .erp-brand-name { margin: 0; font-size: 15px; font-weight: 750; line-height: 1.3; }
        .erp-brand-sub { margin: 3px 0 0; font-size: 11px; color: #94a3b8; }
        .erp-close { display: none; margin-left: auto; background: #26354c; border: 0; padding: 9px; color: #fff; border-radius: 9px; cursor: pointer; }
        .erp-nav-label { padding: 24px 20px 9px; font-size: 11px; letter-spacing: .11em; font-weight: 700; color: #94a3b8; }
        .erp-nav { display: flex; flex-direction: column; gap: 3px; flex: 1; min-height: 0; overflow-y: auto; padding: 0 10px 14px; }
        .erp-nav-link { display: flex; align-items: center; gap: 12px; min-height: 43px; flex-shrink: 0; padding: 10px 12px; border-radius: 10px; color: #cbd5e1; text-decoration: none; font-size: 13px; font-weight: 550; transition: background .15s, color .15s; }
        .erp-nav-link:hover { background: #26354c; color: #fff; }
        .erp-nav-link.active { background: #059669; color: #fff; }
        .erp-nav-link span { flex: 1; }
        .erp-account { padding: 14px 12px 16px; border-top: 1px solid #293548; }
        .erp-account-info { padding: 10px 12px; border-radius: 10px; background: #1e293b; }
        .erp-account-info strong { display: block; font-size: 12px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .erp-account-info small { color: #94a3b8; font-size: 11px; }
        .erp-logout { display: flex; align-items: center; gap: 10px; width: 100%; margin-top: 8px; padding: 12px; border: 0; background: transparent; color: #fecaca; border-radius: 10px; text-align: left; cursor: pointer; font-size: 13px; font-weight: 600; }
        .erp-logout:hover { background: #3d2634; }
        .erp-logout:disabled { opacity: .5; cursor: wait; }
        .erp-body { margin-left: var(--erp-nav-width); min-width: 0; min-height: 100vh; }
        .erp-header { position: sticky; top: 0; z-index: 30; display: flex; gap: 14px; align-items: center; min-height: 72px; padding: 12px 26px; background: #fff; border-bottom: 1px solid #e2e8f0; }
        .erp-header-info { flex: 1; min-width: 0; }
        .erp-header-info small { display: block; color: #047857; font-size: 11px; font-weight: 750; letter-spacing: .07em; }
        .erp-header-info h1 { font-size: 19px; margin: 3px 0 0; color: #0f172a; font-weight: 750; }
        .erp-header-user { text-align: right; }
        .erp-header-user strong { display: block; font-size: 12px; color: #0f172a; }
        .erp-header-user small { font-size: 11px; color: #64748b; }
        .erp-open { display: none; width: 40px; height: 40px; flex-shrink: 0; border: 1px solid #cbd5e1; border-radius: 10px; background: white; color: #0f172a; align-items: center; justify-content: center; cursor: pointer; }
        .erp-content { min-width: 0; }
        .erp-footer { padding: 16px 20px; color: #64748b; border-top: 1px solid #e2e8f0; font-size: 11px; text-align: center; background: #fff; }
        .erp-overlay { display: none; }
        .erp-loading { min-height: 100vh; display: grid; place-items: center; color: #64748b; }
        @media(max-width: 1023px) {
          .erp-sidebar { width: min(290px, 85vw); transform: translateX(-105%); z-index: 100; }
          .erp-sidebar.is-open { transform: translateX(0); }
          .erp-close, .erp-open { display: inline-flex; align-items: center; justify-content: center; }
          .erp-overlay.is-open { display: block; position: fixed; inset: 0; background: rgba(15,23,42,.65); z-index: 90; }
          .erp-body { margin-left: 0; }
          .erp-header { padding: 12px 16px; }
        }
        @media(max-width: 560px) { .erp-header-user { display: none; } .erp-header-info h1 { font-size: 17px; } }
      `}</style>
      <div className={`erp-overlay${aberto ? " is-open" : ""}`} onClick={() => setAberto(false)} aria-hidden="true" />
      <aside className={`erp-sidebar${aberto ? " is-open" : ""}`} aria-label="Menu principal" id="erp-menu">
        <div className="erp-brand">
          <span className="erp-brand-icon"><Leaf size={23}/></span>
          <Link href={inicio} onClick={() => setAberto(false)} style={{ textDecoration: "none", color: "inherit", minWidth: 0, flex: 1 }}>
            <p className="erp-brand-name">Pamonharia Rocinha</p>
            <p className="erp-brand-sub">Sistema de Gestão</p>
          </Link>
          <button type="button" className="erp-close" onClick={() => setAberto(false)} aria-label="Fechar menu"><X size={20}/></button>
        </div>
        <div className="erp-nav-label">NAVEGAÇÃO</div>
        <nav className="erp-nav">
          {permitidos.map((item) => {
            const Icone = item.icon;
            const ativo = pathname === item.href;
            return <Link key={item.href} href={item.href} className={`erp-nav-link${ativo ? " active" : ""}`} aria-current={ativo ? "page" : undefined} onClick={() => setAberto(false)}>
              <Icone size={19} aria-hidden="true"/><span>{item.label}</span>{ativo && <ChevronRight size={16} aria-hidden="true"/>}
            </Link>;
          })}
        </nav>
        <div className="erp-account">
          <div className="erp-account-info"><strong>{usuario.nome}</strong><small>{nomes[usuario.tipo]} · @{usuario.usuario}</small></div>
          <button type="button" className="erp-logout" onClick={sair} disabled={saindo}><LogOut size={18}/>{saindo ? "Saindo..." : "Sair da conta"}</button>
        </div>
      </aside>
      <div className="erp-body">
        <header className="erp-header">
          <button type="button" className="erp-open" aria-label="Abrir menu" aria-expanded={aberto} aria-controls="erp-menu" onClick={() => setAberto(true)}><Menu size={21}/></button>
          <div className="erp-header-info"><small>PAMONHARIA ROCINHA</small><h1>{atual}</h1></div>
          <div className="erp-header-user"><strong>{usuario.nome}</strong><small>{nomes[usuario.tipo]}</small></div>
        </header>
        <main className="erp-content">{children}</main>
        <footer className="erp-footer">Pamonharia Rocinha · Sistema Administrativo</footer>
      </div>
    </div>
  );
}
