"use client";

import {
  Package,
  DollarSign,
  Store,
  ShoppingBasket,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface IndicadoresProps {
  indicadores: {
    movimentacoesHoje: number;
    valorReceber: number;
    pagamentosPendentes: number;
    totalPadarias: number;
    totalProdutos: number;
  };
}

export default function Indicadores({
  indicadores,
}: IndicadoresProps) {
  const cards = [
    {
      titulo: "Movimentações Hoje",
      valor: indicadores.movimentacoesHoje,
      descricao: "Entregas registradas hoje",
      icone: Package,
      cor: "bg-amber-100 text-amber-700",
    },
    {
      titulo: "Valor a Receber",
      valor: `R$ ${indicadores.valorReceber.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
      })}`,
      descricao: `${indicadores.pagamentosPendentes} pagamentos pendentes`,
      icone: DollarSign,
      cor: "bg-green-100 text-green-700",
    },
    {
      titulo: "Padarias",
      valor: indicadores.totalPadarias,
      descricao: "Padarias cadastradas",
      icone: Store,
      cor: "bg-blue-100 text-blue-700",
    },
    {
      titulo: "Produtos",
      valor: indicadores.totalProdutos,
      descricao: "Produtos cadastrados",
      icone: ShoppingBasket,
      cor: "bg-violet-100 text-violet-700",
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icone;

        return (
          <Card
            key={card.titulo}
            className="
              rounded-2xl
              border-0
              shadow-md
              hover:shadow-xl
              transition-all
              duration-300
              hover:-translate-y-1
            "
          >
            <CardContent className="flex justify-between items-center p-6">

              <div>

                <p className="text-sm text-muted-foreground">
                  {card.titulo}
                </p>

                <h2 className="text-3xl font-bold mt-2">
                  {card.valor}
                </h2>

                <p className="text-xs text-muted-foreground mt-2">
                  {card.descricao}
                </p>

              </div>

              <div
                className={`
                  w-14
                  h-14
                  rounded-full
                  flex
                  items-center
                  justify-center
                  ${card.cor}
                `}
              >
                <Icon size={28} />
              </div>

            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}