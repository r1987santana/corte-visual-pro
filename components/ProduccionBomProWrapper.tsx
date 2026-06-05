"use client";

import dynamic from "next/dynamic";

const ProduccionBomProClient = dynamic(
  () => import("@/components/ProduccionBomProClient"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#020617] p-10 text-white">
        <div className="border border-slate-800/80 bg-[#0b1020] rounded-3xl px-8 py-7">
          <p className="text-xs font-black tracking-[0.45em] text-cyan-400">
            RD WOOD SYSTEM
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Producción PRO
          </h1>

          <p className="mt-2 text-slate-400">
            Cargando módulo...
          </p>
        </div>
      </div>
    ),
  }
);

export default function ProduccionBomProWrapper() {
  return <ProduccionBomProClient />;
}
