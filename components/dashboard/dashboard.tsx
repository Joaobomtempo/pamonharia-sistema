
"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";

import Indicadores from "./Indicadores";
import UltimasMovimentacoes from "./UltimasMovimentacoes";
import PendingPayments from "./PendingPayments";
import TopPadarias from "./TopPadarias";
import AcoesRapidas from "./AcoesRapidas";

type DashboardData = {
  indicadores: {
    movimentacoesHoje: number;
    valorReceber: number;
    pagamentosPendentes: number;
    totalPadarias: number;
    totalProdutos: number;
  };
  ultimasMovimentacoes: {
    id: number;
    codigo: string;
    dataEntrega: string;
    status: string;
    padaria: {
      id: number;
      nome: string;
    };
    valorTotalEntregue: number;
  }[];
  pagamentosPendentes: {
    id: number;
    valorDevido: number;
    dataInicio: string;
    dataFim: string;
    padaria: {
      id: number;
      nome: string;
    };
  }[];
  rankingPadarias: {
    id: number;
    nome: string;
    valorEntregue: number;
    totalEntregas: number;
  }[];
};

export default function Dashboard() {
  const [dados, setDados] = useState<DashboardData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregarDashboard = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");

      const resposta = await fetch("/api/dashboard", {
        cache: "no-store",
      });

      if (!resposta.ok) {
        throw new Error("Não foi possível consultar o Dashboard.");
      }

      const resultado: DashboardData = await resposta.json();
      setDados(resultado);
    } catch (error) {
      console.error(error);
      setErro("Não foi possível carregar os dados do Dashboard.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarDashboard();
  }, [carregarDashboard]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Visão geral da Pamonharia Rocinha
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays className="size-4" />
              {new Date().toLocaleDateString("pt-BR")}
            </span>

            <button
              type="button"
              onClick={() => void carregarDashboard()}
              disabled={carregando}
              aria-label="Atualizar Dashboard"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw
                className={`size-4 ${
                  carregando ? "animate-spin" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {erro && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {erro}
          </div>
        )}

        {carregando && !dados ? (
          <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
            Carregando indicadores...
          </div>
        ) : dados ? (
          <>
            <Indicadores indicadores={dados.indicadores} />

            <div className="grid gap-6 xl:grid-cols-2">
              <UltimasMovimentacoes
                entregas={dados.ultimasMovimentacoes}
              />
              <PendingPayments
                pagamentos={dados.pagamentosPendentes}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <TopPadarias
                padarias={dados.rankingPadarias}
              />
              <AcoesRapidas />
            </div>
          </>
        ) : (
          <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
            Nenhum dado disponível.
          </div>
        )}
      </div>
    </main>
  );
}
