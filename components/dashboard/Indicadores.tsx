import {
  Boxes,
  WalletCards,
  TriangleAlert,
  TrendingUp,
} from "lucide-react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

const indicadores = [
  {
    titulo: "Movimentações Hoje",
    valor: "18",
    descricao: "Entregas registradas hoje",
    icon: Boxes,
    cor: "bg-green-100 text-green-700",
  },

  {
    titulo: "Valor a Receber",
    valor: "R$ 2.350",
    descricao: "Total previsto para hoje",
    icon: WalletCards,
    cor: "bg-blue-100 text-blue-700",
  },

  {
    titulo: "Pagamentos Pendentes",
    valor: "6",
    descricao: "Padarias aguardando pagamento",
    icon: TriangleAlert,
    cor: "bg-orange-100 text-orange-700",
  },

  {
    titulo: "Taxa de Devolução",
    valor: "4,8%",
    descricao: "Percentual do dia",
    icon: TrendingUp,
    cor: "bg-yellow-100 text-yellow-700",
  },
];

export default function StatsCards() {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">

      {indicadores.map((item) => {

        const Icon = item.icon;

        return (

          <Card
            key={item.titulo}
            className="border-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >

            <CardContent className="flex items-center justify-between p-6">

              <div>

                <p className="text-sm font-medium text-slate-500">
                  {item.titulo}
                </p>

                <h2 className="mt-3 text-3xl font-bold text-slate-800">
                  {item.valor}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  {item.descricao}
                </p>

              </div>

              <div
                className={`rounded-2xl p-4 ${item.cor}`}
              >
                <Icon size={30} />
              </div>

            </CardContent>

          </Card>

        );
      })}

    </section>
  );
}