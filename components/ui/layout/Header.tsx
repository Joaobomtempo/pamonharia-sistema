"use client";

import { usePathname } from "next/navigation";
import {
  Bell,
  Search,
  UserCircle2,
} from "lucide-react";

const paginas: Record<
  string,
  {
    titulo: string;
    descricao: string;
  }
> = {
  "/": {
    titulo: "Dashboard",
    descricao:
      "Visão geral do sistema e indicadores.",
  },

  "/movimentacoes": {
    titulo: "Movimentações",
    descricao:
      "Registro de entregas e devoluções.",
  },

  "/pagamentos": {
    titulo: "Pagamentos",
    descricao:
      "Controle financeiro das padarias.",
  },

  "/relatorios": {
    titulo: "Relatórios",
    descricao:
      "Análises e indicadores do sistema.",
  },

  "/padarias": {
    titulo: "Padarias",
    descricao:
      "Cadastro e gerenciamento das padarias.",
  },

  "/produtos": {
    titulo: "Produtos",
    descricao:
      "Cadastro dos produtos vendidos.",
  },

  "/usuarios": {
    titulo: "Usuários",
    descricao:
      "Controle de acesso ao sistema.",
  },

  "/configuracoes": {
    titulo: "Configurações",
    descricao:
      "Preferências do sistema.",
  },
};

export default function Header() {
  const pathname = usePathname();

  const pagina =
    paginas[pathname] || {
      titulo: "Pamonharia Rocinha",
      descricao: "",
    };

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-10 py-6">

      <div>

        <h1 className="text-3xl font-bold text-slate-800">
          {pagina.titulo}
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {pagina.descricao}
        </p>

      </div>

      <div className="flex items-center gap-4">

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">

          <Search
            size={18}
            className="text-slate-400"
          />

          <input
            type="text"
            placeholder="Pesquisar..."
            className="w-60 bg-transparent text-sm outline-none"
          />

        </div>

        <button className="rounded-xl border border-slate-200 bg-white p-3 transition hover:bg-slate-100">

          <Bell
            size={20}
            className="text-slate-600"
          />

        </button>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2">

          <UserCircle2
            size={34}
            className="text-green-700"
          />

          <div>

            <p className="text-sm font-semibold text-slate-800">
              Administrador
            </p>

            <p className="text-xs text-slate-500">
              Pamonharia Rocinha
            </p>

          </div>

        </div>

      </div>

    </header>
  );
}