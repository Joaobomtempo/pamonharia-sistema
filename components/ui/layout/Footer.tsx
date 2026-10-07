export default function Footer() {
  const ano = new Date().getFullYear();

  return (
    <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-8 py-4">

      <div>
        <p className="text-sm font-medium text-slate-700">
          ERP Pamonharia Rocinha
        </p>

        <p className="text-xs text-slate-500">
          Sistema Administrativo
        </p>
      </div>

      <div className="text-right">
        <p className="text-sm text-slate-600">
          Versão 1.0.0
        </p>

        <p className="text-xs text-slate-400">
          © {ano} Pamonharia Rocinha
        </p>
      </div>

    </footer>
  );
}