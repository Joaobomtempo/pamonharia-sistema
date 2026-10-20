"use client";

import Link from "next/link";
import { Package, Clock3, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Entrega {
  id: number;
  codigo: string;
  dataEntrega: string;
  status: string;
  padaria: { id: number; nome: string };
  valorTotalEntregue: number;
}

interface Props {
  entregas: Entrega[];
}

const statusEntrega: Record<string, string> = {
  PENDENTE: "Pendente",
  CONFIRMADA: "Confirmada",
  COM_DEVOLUCAO: "Com devolução",
  FINALIZADA: "Finalizada",
};

function formatarDinheiro(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string) {
  return new Date(data).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default function UltimasMovimentacoes({ entregas }: Props) {
  return (
    <Card className="h-full rounded-2xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Package size={21} className="text-amber-600" />
          Últimas movimentações
        </CardTitle>
        <Link
          href="/historico"
          className="flex items-center gap-1 text-sm font-medium text-green-700 transition hover:text-green-800 hover:underline"
        >
          Ver todas
          <ArrowRight size={16} />
        </Link>
      </CardHeader>

      <CardContent>
        {entregas.length === 0 ? (
          <div className="py-12 text-center">
            <Package size={48} className="mx-auto text-slate-300" />
            <h3 className="mt-4 text-base font-semibold text-slate-800">
              Nenhuma movimentação registrada
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              As últimas entregas aparecerão aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entregas.map((mov) => (
              <Link
                key={mov.id}
                href={`/historico?busca=${encodeURIComponent(mov.codigo)}`}
                aria-label={`Consultar movimentação ${mov.codigo} no Histórico`}
                className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-green-200 hover:bg-green-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <h4 className="truncate font-semibold text-slate-900">
                    {mov.padaria.nome}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">{mov.codigo}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="bg-amber-50 text-amber-800">
                      {statusEntrega[mov.status] ?? mov.status}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock3 size={14} />
                      {formatarData(mov.dataEntrega)}
                    </span>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-lg font-bold text-slate-900">
                    {formatarDinheiro(mov.valorTotalEntregue)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Valor bruto entregue</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
