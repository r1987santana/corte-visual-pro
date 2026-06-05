"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <section className="max-w-xl rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-blue-950 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-500/20 text-blue-200">
          <WifiOff size={34} />
        </div>

        <p className="text-xs uppercase tracking-[0.35em] text-blue-300">RD Wood System</p>
        <h1 className="mt-3 text-4xl font-black">Sin conexión</h1>
        <p className="mt-3 text-slate-300">
          Estás offline. Algunas pantallas guardadas seguirán disponibles. Cuando vuelva el internet,
          el sistema sincronizará las acciones pendientes.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-2xl bg-blue-600 px-5 py-3 font-black hover:bg-blue-500"
        >
          Reintentar
        </button>
      </section>
    </main>
  );
}
