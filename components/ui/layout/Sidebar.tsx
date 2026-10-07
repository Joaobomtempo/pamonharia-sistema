"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LayoutDashboard,
  Boxes,
  Wallet,
  ChartColumn,
  Store,
  Package,
  Users,
  Settings,
} from "lucide-react";

const menuPrincipal = [
  {
    nome: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    nome: "Movimentações",
    href: "/movimentacoes",
    icon: Boxes,
  },
  {
    nome: "Pagamentos",
    href: "/pagamentos",
    icon: Wallet,
  },
  {
    nome: "Relatórios",
    href: "/relatorios",
    icon: ChartColumn,
  },
];

const menuCadastros = [
  {
    nome: "Padarias",
    href: "/padarias",
    icon: Store,
  },
  {
    nome: "Produtos",
    href: "/produtos",
    icon: Package,
  },
];

const menuSistema = [
  {
    nome: "Usuários",
    href: "/usuarios",
    icon: Users,
  },
  {
    nome: "Configurações",
    href: "/configuracoes",
    icon: Settings,
  },
];

interface ItemMenuProps {
  nome: string;
  href: string;
  icon: any;
}

function ItemMenu({ nome, href, icon: Icon }: ItemMenuProps) {
  const pathname = usePathname();

  const ativo = pathname === href;

  return (
    <Link
      href={href}
      className={`
        flex
        items-center
        gap-3
        rounded-xl
        px-4
        py-3
        transition-all
        duration-200
        ${
          ativo
            ? "bg-green-700 text-white shadow-lg"
            : "text-slate-700 hover:bg-green-50 hover:text-green-700"
        }
      `}
    >
      <Icon size={20} />

      <span className="font-medium">
        {nome}
      </span>
    </Link>
  );
}

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-200 bg-white">

      <div className="border-b border-slate-200 p-8">

        <h1 className="text-2xl font-bold text-green-700">
          Pamonharia
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Rocinha ERP
        </p>

      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">

        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Principal
        </h2>

        <div className="space-y-2">

          {menuPrincipal.map((item) => (
            <ItemMenu
              key={item.href}
              {...item}
            />
          ))}

        </div>

        <div className="my-8 border-t border-slate-200" />

        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Cadastros
        </h2>

        <div className="space-y-2">

          {menuCadastros.map((item) => (
            <ItemMenu
              key={item.href}
              {...item}
            />
          ))}

        </div>

        <div className="my-8 border-t border-slate-200" />

        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Sistema
        </h2>

        <div className="space-y-2">

          {menuSistema.map((item) => (
            <ItemMenu
              key={item.href}
              {...item}
            />
          ))}

        </div>

      </div>

      <div className="border-t border-slate-200 p-6">

        <p className="text-sm font-semibold text-slate-700">
          ERP Pamonharia Rocinha
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Versão 1.0.0
        </p>

      </div>

    </aside>
  );
}