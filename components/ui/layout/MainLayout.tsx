import { ReactNode } from "react";

import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({
  children,
}: MainLayoutProps) {
  return (
    <div className="flex min-h-screen bg-slate-100">

      {/* Menu lateral */}
      <Sidebar />

      {/* Conteúdo */}
      <div className="flex flex-1 flex-col">

        {/* Cabeçalho */}
        <Header />

        {/* Conteúdo principal */}
        <main className="flex-1 overflow-y-auto p-8">

          <div className="mx-auto max-w-7xl">
            {children}
          </div>

        </main>

        {/* Rodapé */}
        <Footer />

      </div>

    </div>
  );
}