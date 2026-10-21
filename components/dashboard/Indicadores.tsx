
"use client";

import {
  Package,
  DollarSign,
  Store,
  ShoppingBasket,
} from "lucide-react";

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
      valor: String(indicadores.movimentacoesHoje),
      descricao: "Entregas registradas hoje",
      icone: Package,
      cor: "laranja",
    },
    {
      titulo: "Valor a Receber",
      valor: `R$ ${indicadores.valorReceber.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      descricao: `${indicadores.pagamentosPendentes} pagamentos pendentes`,
      icone: DollarSign,
      cor: "verde",
    },
    {
      titulo: "Padarias",
      valor: String(indicadores.totalPadarias),
      descricao: "Padarias cadastradas",
      icone: Store,
      cor: "azul",
    },
    {
      titulo: "Produtos",
      valor: String(indicadores.totalProdutos),
      descricao: "Produtos cadastrados",
      icone: ShoppingBasket,
      cor: "roxo",
    },
  ];

  return (
    <section className="pr-dashboard-indicadores">
      {cards.map((card) => {
        const Icone = card.icone;

        return (
          <div className="pr-indicador-card" key={card.titulo}>
            <div className="pr-indicador-topo">
              <span
                className={`pr-indicador-icone pr-indicador-${card.cor}`}
              >
                <Icone size={21} aria-hidden="true" />
              </span>
            </div>

            <p className="pr-indicador-titulo">{card.titulo}</p>

            <strong className="pr-indicador-valor">
              {card.valor}
            </strong>

            <p className="pr-indicador-descricao">
              {card.descricao}
            </p>
          </div>
        );
      })}
    </section>
  );
}
