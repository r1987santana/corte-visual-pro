"use client";

import { BarChart3, AlertTriangle, DollarSign, Star } from "lucide-react";

export default function CEOPostventaPage() {
  const cards = [
    { label: "Tickets Totales", value: "1", icon: BarChart3 },
    { label: "Costo Garantías", value: "RD$ 0", icon: DollarSign },
    { label: "Rating Promedio", value: "5.0", icon: Star },
    { label: "Alertas", value: "0", icon: AlertTriangle },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-2xl border border-cyan-500/20 bg-slate-900 p-6">
        <h1 className="text-4xl font-bold text-white">Dashboard CEO Postventa PRO</h1>
        <p className="text-slate-300 mt-2">
          Visión estratégica del impacto financiero y operativo de la postventa.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">{c.label}</span>
                <Icon className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="text-3xl font-bold text-white mt-3">{c.value}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Resumen Ejecutivo IA</h2>
        <p className="text-slate-300">
          Operación bajo control. Mantener monitoreo preventivo y seguimiento a reclamos recurrentes.
        </p>
      </div>
    </div>
  );
}