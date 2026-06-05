export default function PortalClienteHome() {
  return (
    <main className="min-h-screen bg-[#020817] text-white flex items-center justify-center p-8">
      <div className="max-w-6xl w-full grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-cyan-400 text-xs tracking-[0.3em] uppercase mb-4">RD Wood System</p>
          <h1 className="text-5xl font-black leading-tight mb-6">
            Portal del Cliente <span className="text-cyan-400">Ultra Premium</span>
          </h1>
          <p className="text-slate-300 mb-8">
            Seguimiento en tiempo real, documentos, galería, QA, garantía y entrega final.
          </p>
          <a
            href="/login"
            className="inline-flex px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
          >
            Volver al sistema
          </a>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-xl shadow-2xl">
          <h3 className="text-xl font-bold mb-6">Beneficios para el Cliente</h3>
          <ul className="space-y-3 text-slate-300">
            <li>✓ Seguimiento del proyecto</li>
            <li>✓ Render aprobado</li>
            <li>✓ Transporte en tiempo real</li>
            <li>✓ Instalación y QA</li>
            <li>✓ Acta de entrega digital</li>
            <li>✓ Garantía y soporte</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
