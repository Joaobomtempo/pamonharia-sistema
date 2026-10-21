
import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardList,
  WalletCards,
  Store,
  Package,
  Zap,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const acoes = [
  {
    titulo: "Nova movimentação",
    descricao: "Registrar entrega e devolução",
    href: "/entregas",
    icon: ClipboardList,
  },
  {
    titulo: "Pagamentos",
    descricao: "Consultar e registrar recebimentos",
    href: "/pagamentos",
    icon: WalletCards,
  },
  {
    titulo: "Padarias",
    descricao: "Gerenciar estabelecimentos",
    href: "/padarias",
    icon: Store,
  },
  {
    titulo: "Produtos",
    descricao: "Gerenciar catálogo",
    href: "/produtos",
    icon: Package,
  },
];

export default function AcoesRapidas() {
  return (
    <Card className="min-w-0 border-slate-200 bg-white shadow-sm">
      <CardHeader className="px-3 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="size-5 text-amber-600" />
          Ações rápidas
        </CardTitle>
      </CardHeader>

      <CardContent className="px-3 sm:px-6">
        <div className="pr-acoes-grid grid grid-cols-2 gap-3">
          {acoes.map((acao) => {
            const Icon = acao.icon;

            return (
              <Link
                key={acao.href}
                href={acao.href}
                className="group flex min-h-36 min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-green-300 hover:bg-green-50 sm:p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="rounded-lg bg-white p-2 text-green-700">
                    <Icon className="size-5" />
                  </div>

                  <ArrowUpRight className="size-4 shrink-0 text-slate-400 transition group-hover:text-green-700" />
                </div>

                <p className="break-words text-sm font-semibold leading-snug text-slate-800">
                  {acao.titulo}
                </p>

                <p className="mt-1 break-words text-xs leading-snug text-slate-500">
                  {acao.descricao}
                </p>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
