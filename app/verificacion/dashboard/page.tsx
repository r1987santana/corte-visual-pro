"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function QADashboardPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from("v_qa_dashboard").select("*").single();
    setData(data);
  }

  const cards = [
    ["Total Observaciones", data?.total_observaciones ?? 0],
    ["Abiertas", data?.abiertas ?? 0],
    ["En Corrección", data?.en_correccion ?? 0],
    ["Cerradas", data?.cerradas ?? 0],
    ["% Cierre", `${data?.porcentaje_cierre ?? 0}%`],
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-2xl border border-cyan-500/20 bg-slate-950 p-6">
        <h1 className="text-4xl font-bold text-white">Dashboard de Calidad QA PRO</h1>
        <p className="text-slate-400 mt-2">
          KPIs de observaciones y desempeño del proceso QA.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <div className="text-slate-400 text-sm">{label}</div>
            <div className="text-3xl font-bold text-white mt-2">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}