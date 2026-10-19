
import Link from "next/link";
import { ArrowUpRight, WalletCards } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Pagamento = {
  id: number;
  valorDevido: string | number;
  dataInicio: string;
  dataFim: string;
  padaria?: {
    nome: string;
  };
};

type Props = {
  pagamentos: Pagamento[];
};

export default function PendingPayments({ pagamentos }: Props) {
  const formatarMoeda = (valor: string | number) =>
    Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  return (
    <Card className="h-full border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <WalletCards className="size-5 text-amber-600" />
          Pagamentos pendentes
        </CardTitle>

        <Link
          href="/pagamentos"
          className="flex items-center gap-1 text-sm font-medium text-green-700 hover:underline"
        >
          Ver todos <ArrowUpRight className="size-4" />
        </Link>
      </CardHeader>

      <CardContent>
        {pagamentos.length === 0 ? (
          <div className="py-10 text-center">
            <WalletCards className="mx-auto mb-3 size-10 text-slate-300" />
            <p className="font-medium text-slate-700">
              Nenhum pagamento pendente
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Os pagamentos em aberto aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pagamentos.map((pagamento) => (
              <div
                key={pagamento.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">
                    {pagamento.padaria?.nome ?? "Padaria"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Pagamento #{pagamento.id}
                  </p>
                </div>

                <p className="shrink-0 font-bold text-amber-700">
                  {formatarMoeda(pagamento.valorDevido)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
