"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  BarChart3,
  DollarSign,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Truck,
  Wrench,
} from "lucide-react";

type ProjectProfit = {
  project_id: string;
  project_name: string;
  client_name: string;
  project_income: number;
  sales_income: number;
  approved_quote_income: number;
  production_cost: number;
  cutting_cost: number;
  edging_cost: number;
  transport_cost: number;
  installation_cost: number;
  warranty_cost: number;
  other_cost: number;
  total_cost: number;
  real_profit: number;
  real_margin_percent: number;
  profitability_status: string;
  created_at: string;
};

type Kpis = {
  total_projects: number;
  total_income: number;
  total_cost: number;
  total_production_cost: number;
  total_warranty_cost: number;
  total_transport_cost: number;
  total_installation_cost: number;
  total_real_profit: number;
  avg_real_margin: number;
  profitable_projects: number;
  risk_projects: number;
  critical_projects: number;
  no_income_projects: number;
};

const emptyKpis: Kpis = {
  total_projects: 0,
  total_income: 0,
  total_cost: 0,
  total_production_cost: 0,
  total_warranty_cost: 0,
  total_transport_cost: 0,
  total_installation_cost: 0,
  total_real_profit: 0,
  avg_real_margin: 0,
  profitable_projects: 0,
  risk_projects: 0,
  critical_projects: 0,
  no_income_projects: 0,
};

export default function CEORentabilidadRealAutomaticaPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectProfit[]>([]);
  const [kpis, setKpis] = useState<Kpis>(emptyKpis);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ProjectProfit | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [projectsRes, kpiRes] = await Promise.all([
      supabase
        .from("v_project_real_profitability_auto")
        .select("*")
        .order("real_profit", { ascending: false }),
      supabase
        .from("v_project_real_profitability_auto_kpis")
        .select("*")
        .maybeSingle(),
    ]);

    if (projectsRes.error) alert(projectsRes.error.message);
    if (kpiRes.error) alert(kpiRes.error.message);

    if (projectsRes.data) setProjects(projectsRes.data as ProjectProfit[]);
    if (kpiRes.data) setKpis(kpiRes.data as Kpis);

    setLoading(false);
  }

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;

    return projects.filter((p) =>
      [p.project_name, p.client_name, p.profitability_status]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [projects, query]);

  const executiveSummary = useMemo(() => {
    if (kpis.critical_projects > 0) {
      return `Atención CEO: existen ${kpis.critical_projects} proyecto(s) críticos con margen real menor a 10%. Revisar consumos, garantías y costos por departamento.`;
    }

    if (kpis.risk_projects > 0) {
      return `Hay ${kpis.risk_projects} proyecto(s) en riesgo. El sistema recomienda auditar producción, instalación y postventa antes de cierre financiero.`;
    }

    if (kpis.no_income_projects > 0) {
      return `Hay ${kpis.no_income_projects} proyecto(s) sin ingreso conectado. Deben vincularse a venta o cotización aprobada.`;
    }

    if (kpis.total_projects === 0) {
      return "No hay proyectos disponibles para calcular rentabilidad real automática.";
    }

    return "Rentabilidad bajo control. El ingreso y los costos por proyecto se están calculando automáticamente desde el flujo operativo.";
  }, [kpis]);

  return (
    <div className="min-h-screen bg-[#020817] text-white p-6">
      <div className="max-w-[1500px] mx-auto space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-cyan-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 shadow-2xl">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute -bottom-28 left-20 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-cyan-300 text-xs font-black tracking-[0.35em] uppercase">
                <BarChart3 className="w-4 h-4" />
                Fase 43.4.9.1 · Automática
              </div>

              <h1 className="mt-6 text-4xl lg:text-6xl font-black tracking-tight">
                Rentabilidad Real Automática PRO
              </h1>

              <p className="mt-4 max-w-4xl text-slate-300 text-lg">
                Ingreso desde cotización/venta y egresos acumulados por producción,
                corte, canteo, transporte, instalación y garantías.
              </p>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="rounded-2xl bg-white text-slate-950 px-7 py-4 font-black flex items-center justify-center gap-3 hover:bg-cyan-100 disabled:opacity-60"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
              ACTUALIZAR
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-cyan-500/30 bg-cyan-500/10 p-6">
          <h2 className="text-2xl font-black mb-2">Resumen Ejecutivo IA</h2>
          <p className="text-slate-200 text-lg">{executiveSummary}</p>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <Kpi icon={<DollarSign />} label="Ingresos" value={money(kpis.total_income)} />
          <Kpi icon={<Package />} label="Costo total" value={money(kpis.total_cost)} tone="warning" />
          <Kpi icon={<Wrench />} label="Producción" value={money(kpis.total_production_cost)} />
          <Kpi icon={<Truck />} label="Transporte" value={money(kpis.total_transport_cost)} />
          <Kpi icon={<AlertTriangle />} label="Garantías" value={money(kpis.total_warranty_cost)} tone="danger" />
          <Kpi icon={<ShieldCheck />} label="Utilidad real" value={money(kpis.total_real_profit)} tone="success" />
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard title="Margen promedio" value={`${format(kpis.avg_real_margin)}%`} text="Promedio real después de costos." />
          <SummaryCard title="Rentables" value={kpis.profitable_projects} text="Margen real igual o mayor a 20%." tone="success" />
          <SummaryCard title="En riesgo" value={kpis.risk_projects} text="Margen real entre 10% y 20%." tone="warning" />
          <SummaryCard title="Críticos" value={kpis.critical_projects} text="Margen real menor a 10%." tone="danger" />
        </section>

        <section className="grid xl:grid-cols-[1.3fr_0.7fr] gap-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
              <div>
                <h2 className="text-2xl font-black">Proyectos calculados automáticamente</h2>
                <p className="text-slate-400">
                  El formulario manual fue eliminado. Todo se calcula desde módulos operativos.
                </p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar proyecto..."
                  className="w-full md:w-80 rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-11 pr-4 outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-[0.25em] text-[10px]">
                  <tr>
                    <th className="text-left p-4">Proyecto</th>
                    <th className="text-left p-4">Ingreso</th>
                    <th className="text-left p-4">Costo total</th>
                    <th className="text-left p-4">Garantía</th>
                    <th className="text-left p-4">Utilidad</th>
                    <th className="text-left p-4">Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No hay proyectos conectados todavía.
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((p) => (
                      <tr
                        key={p.project_id}
                        onClick={() => setSelected(p)}
                        className="border-t border-slate-800 hover:bg-cyan-400/5 cursor-pointer"
                      >
                        <td className="p-4">
                          <div className="font-black">{p.project_name}</div>
                          <div className="text-xs text-slate-500">{p.client_name}</div>
                        </td>
                        <td className="p-4 text-slate-300">{money(p.project_income)}</td>
                        <td className="p-4 text-amber-300">{money(p.total_cost)}</td>
                        <td className="p-4 text-red-300">{money(p.warranty_cost)}</td>
                        <td className="p-4 font-black text-emerald-300">
                          {money(p.real_profit)}
                          <div className="text-xs text-slate-500">{format(p.real_margin_percent)}%</div>
                        </td>
                        <td className="p-4">
                          <StatusPill value={p.profitability_status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-2xl font-black mb-5">Detalle financiero</h2>

            {!selected ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                Selecciona un proyecto.
              </div>
            ) : (
              <div className="space-y-3">
                <Detail label="Proyecto" value={selected.project_name} />
                <Detail label="Cliente" value={selected.client_name} />
                <Detail label="Ingreso venta/cotización" value={money(selected.project_income)} />
                <Detail label="Producción" value={money(selected.production_cost)} />
                <Detail label="Corte" value={money(selected.cutting_cost)} />
                <Detail label="Canteo" value={money(selected.edging_cost)} />
                <Detail label="Transporte" value={money(selected.transport_cost)} />
                <Detail label="Instalación" value={money(selected.installation_cost)} />
                <Detail label="Garantía/Postventa" value={money(selected.warranty_cost)} />
                <Detail label="Costo total" value={money(selected.total_cost)} />
                <Detail label="Utilidad real" value={money(selected.real_profit)} />
                <Detail label="Margen real" value={`${format(selected.real_margin_percent)}%`} />
              </div>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const cls =
    tone === "danger"
      ? "border-red-400/30 text-red-300"
      : tone === "warning"
      ? "border-amber-400/30 text-amber-300"
      : tone === "success"
      ? "border-emerald-400/30 text-emerald-300"
      : "border-cyan-400/20 text-cyan-300";

  return (
    <div className={`rounded-3xl border bg-slate-900/70 p-5 ${cls}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-black">{label}</div>
        <div className="w-5 h-5">{icon}</div>
      </div>
      <div className="mt-4 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  text,
  tone = "default",
}: {
  title: string;
  value: React.ReactNode;
  text: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "border-red-400/30 bg-red-500/10"
      : tone === "warning"
      ? "border-amber-400/30 bg-amber-500/10"
      : tone === "success"
      ? "border-emerald-400/30 bg-emerald-500/10"
      : "border-cyan-400/30 bg-cyan-500/10";

  return (
    <div className={`rounded-3xl border p-6 ${cls}`}>
      <div className="text-3xl font-black text-white">{value}</div>
      <div className="mt-2 text-xl font-black">{title}</div>
      <p className="mt-2 text-slate-300 text-sm">{text}</p>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const v = value || "sin_ingreso";

  const cls =
    v === "critico"
      ? "bg-red-500/15 text-red-300 border-red-400/30"
      : v === "riesgo"
      ? "bg-amber-500/15 text-amber-300 border-amber-400/30"
      : v === "sin_ingreso"
      ? "bg-slate-500/15 text-slate-300 border-slate-400/30"
      : "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";

  const label =
    v === "critico" ? "Crítico" : v === "riesgo" ? "En riesgo" : v === "sin_ingreso" ? "Sin ingreso" : "Rentable";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${cls}`}>
      {label}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-black">{label}</div>
      <div className="mt-1 font-bold text-white">{value}</div>
    </div>
  );
}

function money(value: number | string | null | undefined) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function format(value: number | string | null | undefined) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(2).replace(".00", "");
}
