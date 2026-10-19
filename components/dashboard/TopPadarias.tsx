
import Link from "next/link";
import { ArrowUpRight, Store } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PadariaRanking = {
  id: number;
  nome: string;
  valorEntregue: number;
  totalEntregas: number;
};

type Props = {
  padarias: PadariaRanking[];
};

export default function TopPadarias({ padarias }: Props) {
  const moeda = (valor: number) =>
    valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const maiorValor = Math.max(
    ...padarias.map((item) => item.valorEntregue),
    1
  );

  return (
    <Card className="h-full border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="size-5 text-amber-600" />
          Ranking de padarias
        </CardTitle>

        <Link
          href="/padarias"
          className="flex items-center gap-1 text-sm font-medium text-green-700 hover:underline"
        >
          Ver padarias
          <ArrowUpRight className="size-4" />
        </Link>
      </CardHeader>

      <CardContent>
        {padarias.length === 0 ? (
          <div className="py-10 text-center">
            <Store className="mx-auto mb-3 size-10 text-slate-300" />
            <p className="font-medium text-slate-700">
              Nenhuma entrega registrada
            </p>
            <p className="mt-1 text-sm text-slate-500">
              O ranking aparecerá após as primeiras entregas.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {padarias.map((padaria, indice) => (
              <div key={padaria.id}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {indice + 1}. {padaria.nome}
                    </p>
                    <p className="text-xs text-slate-500">
                      {padaria.totalEntregas} entrega(s)
                    </p>
                  </div>

                  <span className="shrink-0 text-sm font-bold text-green-700">
                    {moeda(padaria.valorEntregue)}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-green-700"
                    style={{
                      width: `${
                        (padaria.valorEntregue / maiorValor) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}

            <p className="border-t pt-3 text-xs text-slate-500">
              Classificação por valor bruto entregue,
              antes das devoluções.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
