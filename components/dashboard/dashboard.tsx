import MainLayout from "../layout/MainLayout";

import Indicadores from "./Indicadores";
import AcoesRapidas from "./AcoesRapidas";
import UltimasMovimentacoes from "./UltimasMovimentacoes";
import PagamentosPendentes from "./PagamentosPendentes";
import TopPadarias from "./TopPadarias";

export default function Dashboard() {
  return (
    <MainLayout>
      <div className="space-y-8">

        {/* Saudação */}
        <section className="rounded-2xl bg-gradient-to-r from-green-700 to-green-600 p-8 text-white shadow-lg">

          <h1 className="text-3xl font-bold">
            Bom dia, João Pedro 👋
          </h1>

          <p className="mt-2 text-green-100">
            Hoje você possui 18 movimentações registradas,
            6 pagamentos pendentes e previsão de
            R$ 2.350,00 para receber.
          </p>

        </section>

        <Indicadores />

        <div className="grid grid-cols-12 gap-6">

          <div className="col-span-4">

            <AcoesRapidas />

          </div>

          <div className="col-span-8">

            <UltimasMovimentacoes />

          </div>

        </div>

        <div className="grid grid-cols-12 gap-6">

          <div className="col-span-5">

            <PagamentosPendentes />

          </div>

          <div className="col-span-7">

            <TopPadarias />

          </div>

        </div>

      </div>
    </MainLayout>
  );
}