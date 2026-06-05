"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  DollarSign,
  LineChart,
  PieChart,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Tab = "dashboard" | "pl" | "cashflow" | "budget" | "modules" | "profit" | "risks";

type Dashboard = {
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  gross_margin: number;
  total_expenses: number;
  net_cashflow: number;
  procurement_total: number;
  asset_value: number;
  open_risks: number;
  open_tickets: number;
  active_imports: number;
};

type PL = {
  section: string;
  line_name: string;
  amount: number;
  sort_order: number;
};

type Cashflow = {
  period_month: string;
  source_module: string;
  category: string;
  cash_in: number;
  cash_out: number;
  net_cashflow: number;
};

type Budget = {
  period_month: string;
  profit_center_code: string | null;
  profit_center_name: string | null;
  account_type: string;
  category: string;
  budget_amount: number;
  actual_amount: number;
  variance_amount: number;
  achievement_percent: number;
};

type ModuleHealth = {
  module_name: string;
  module_key: string;
  value: number;
  status: string;
  notes: string;
};

type ProfitCenter = {
  id: string;
  code: string;
  name: string;
  center_type: string;
  manager: string | null;
  revenue: number;
  costs: number;
  profit: number;
};

type Risk = {
  id: string;
  alert_code: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string | null;
  source_module: string | null;
  status: string;
  created_at: string;
};

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(n || 0));

function statusClass(value?: string | null) {
  if (["ok", "activo", "baja"].includes(value || "")) return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
  if (["sin_movimiento", "media"].includes(value || "")) return "border-blue-400/30 bg-blue-500/15 text-blue-300";
  if (["riesgo", "alta"].includes(value || "")) return "border-amber-400/30 bg-amber-500/15 text-amber-300";
  if (["critica", "crítico"].includes(value || "")) return "border-red-400/30 bg-red-500/15 text-red-300";
  return "border-slate-500/30 bg-slate-500/15 text-slate-300";
}

export default function BIExecutiveAnalyticsPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard>({
    total_revenue: 0,
    total_cogs: 0,
    gross_profit: 0,
    gross_margin: 0,
    total_expenses: 0,
    net_cashflow: 0,
    procurement_total: 0,
    asset_value: 0,
    open_risks: 0,
    open_tickets: 0,
    active_imports: 0,
  });

  const [pl, setPl] = useState<PL[]>([]);
  const [cashflow, setCashflow] = useState<Cashflow[]>([]);
  const [budget, setBudget] = useState<Budget[]>([]);
  const [modules, setModules] = useState<ModuleHealth[]>([]);
  const [profitCenters, setProfitCenters] = useState<ProfitCenter[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      const [dashRes, plRes, cashRes, budRes, modRes, profitRes, riskRes] = await Promise.all([
        supabase.from("v_bi_executive_dashboard").select("*").maybeSingle(),
        supabase.from("v_bi_profit_loss").select("*").order("sort_order"),
        supabase.from("v_bi_cashflow").select("*").order("period_month", { ascending: false }),
        supabase.from("v_bi_budget_vs_actual").select("*").order("period_month", { ascending: false }),
        supabase.from("v_bi_module_health").select("*"),
        supabase.from("v_bi_top_profit_centers").select("*"),
        supabase.from("v_bi_risk_alerts").select("*"),
      ]);

      if (dashRes.error) throw dashRes.error;
      if (plRes.error) throw plRes.error;
      if (cashRes.error) throw cashRes.error;
      if (budRes.error) throw budRes.error;
      if (modRes.error) throw modRes.error;
      if (profitRes.error) throw profitRes.error;
      if (riskRes.error) throw riskRes.error;

      if (dashRes.data) setDashboard(dashRes.data as Dashboard);
      setPl((plRes.data || []) as PL[]);
      setCashflow((cashRes.data || []) as Cashflow[]);
      setBudget((budRes.data || []) as Budget[]);
      setModules((modRes.data || []) as ModuleHealth[]);
      setProfitCenters((profitRes.data || []) as ProfitCenter[]);
      setRisks((riskRes.data || []) as Risk[]);
    } catch (error: any) {
      setMessage(error.message || "Error cargando BI Executive.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createSnapshot() {
    try {
      setLoading(true);
      const { error } = await supabase.rpc("bi_create_snapshot");
      if (error) throw error;
      setMessage("Snapshot ejecutivo generado.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo generar snapshot.");
    } finally {
      setLoading(false);
    }
  }

  const filteredRisks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return risks;
    return risks.filter((r) =>
      [r.alert_code, r.alert_type, r.severity, r.title, r.message, r.source_module]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [risks, search]);

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "pl", label: "P&L", icon: DollarSign },
    { id: "cashflow", label: "Cashflow", icon: Wallet },
    { id: "budget", label: "Budget vs Real", icon: Target },
    { id: "modules", label: "Salud módulos", icon: Building2 },
    { id: "profit", label: "Profit centers", icon: BriefcaseBusiness },
    { id: "risks", label: "Riesgos", icon: ShieldAlert },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">RD Wood System</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-5xl">
                BI Executive Analytics Pro
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Fase 29: P&L, cashflow, KPIs globales, presupuesto vs real, riesgos y tablero CEO/CFO.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={createSnapshot}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-500"
              >
                <LineChart size={18} />
                Snapshot
              </button>
              <button
                onClick={loadData}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-500"
              >
                <RefreshCw size={18} />
                Actualizar
              </button>
            </div>
          </div>
        </section>

        {message && (
          <div className="mb-4 rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
            {message}
          </div>
        )}

        {loading && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            Procesando...
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-11">
          <Kpi title="Revenue" value={money(dashboard.total_revenue)} icon={<TrendingUp size={20} />} />
          <Kpi title="COGS" value={money(dashboard.total_cogs)} icon={<TrendingDown size={20} />} />
          <Kpi title="Utilidad bruta" value={money(dashboard.gross_profit)} icon={<DollarSign size={20} />} />
          <Kpi title="Margen" value={`${Number(dashboard.gross_margin || 0).toFixed(1)}%`} icon={<PieChart size={20} />} />
          <Kpi title="Gastos" value={money(dashboard.total_expenses)} icon={<ClipboardList size={20} />} />
          <Kpi title="Cashflow" value={money(dashboard.net_cashflow)} icon={<Wallet size={20} />} />
          <Kpi title="Compras" value={money(dashboard.procurement_total)} icon={<BriefcaseBusiness size={20} />} />
          <Kpi title="Activos" value={money(dashboard.asset_value)} icon={<Building2 size={20} />} />
          <Kpi title="Riesgos" value={dashboard.open_risks} icon={<ShieldAlert size={20} />} />
          <Kpi title="Tickets" value={dashboard.open_tickets} icon={<AlertTriangle size={20} />} />
          <Kpi title="Imports" value={dashboard.active_imports} icon={<LineChart size={20} />} />
        </section>

        <section className="mb-6 flex gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-white/5 p-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id as Tab)}
                className={`flex min-w-max items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${
                  active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </section>

        {tab === "risks" && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar riesgo, módulo, severidad..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>
        )}

        {tab === "dashboard" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="Salud global de módulos" icon={<Building2 size={20} />}>
              <div className="space-y-3">
                {modules.map((m) => <ModuleCard key={m.module_key} item={m} />)}
              </div>
            </Panel>

            <Panel title="Alertas ejecutivas" icon={<ShieldAlert size={20} />}>
              <div className="space-y-3">
                {risks.slice(0, 8).map((r) => <RiskCard key={r.id} item={r} />)}
                {!risks.length && <p className="text-sm text-slate-400">No hay riesgos abiertos.</p>}
              </div>
            </Panel>
          </section>
        )}

        {tab === "pl" && (
          <Panel title="Profit & Loss consolidado" icon={<DollarSign size={20} />}>
            <div className="space-y-3">
              {pl.map((p) => (
                <div key={`${p.sort_order}-${p.line_name}`} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-black">{p.line_name}</p>
                      <p className="text-xs text-slate-400">{p.section}</p>
                    </div>
                    <p className={`text-2xl font-black ${Number(p.amount) >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {money(p.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === "cashflow" && (
          <Panel title="Flujo de caja por módulo" icon={<Wallet size={20} />}>
            <div className="space-y-3">
              {cashflow.map((c, idx) => (
                <div key={`${c.period_month}-${c.source_module}-${c.category}-${idx}`} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-black">{c.source_module} · {c.category}</p>
                      <p className="text-xs text-slate-400">{c.period_month}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-300">In {money(c.cash_in)} · Out {money(c.cash_out)}</p>
                      <p className={`text-2xl font-black ${Number(c.net_cashflow) >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                        {money(c.net_cashflow)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === "budget" && (
          <Panel title="Presupuesto vs Real" icon={<Target size={20} />}>
            <div className="space-y-3">
              {budget.map((b, idx) => (
                <div key={`${b.period_month}-${b.category}-${idx}`} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex-1">
                      <p className="font-black">{b.category}</p>
                      <p className="text-xs text-slate-400">{b.profit_center_name || "General"} · {b.account_type}</p>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(Number(b.achievement_percent || 0), 100)}%` }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-300">Budget {money(b.budget_amount)} · Real {money(b.actual_amount)}</p>
                      <p className={`text-2xl font-black ${Number(b.variance_amount) >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                        {Number(b.achievement_percent || 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === "modules" && (
          <Panel title="Health check por módulo" icon={<Building2 size={20} />}>
            <div className="grid gap-3 lg:grid-cols-2">
              {modules.map((m) => <ModuleCard key={m.module_key} item={m} />)}
            </div>
          </Panel>
        )}

        {tab === "profit" && (
          <Panel title="Profit centers" icon={<BriefcaseBusiness size={20} />}>
            <div className="space-y-3">
              {profitCenters.map((p) => (
                <div key={p.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-black">{p.code} · {p.name}</p>
                      <p className="text-xs text-slate-400">{p.center_type} · {p.manager || "Sin manager"}</p>
                      <p className="mt-2 text-sm text-slate-300">Revenue {money(p.revenue)} · Costos {money(p.costs)}</p>
                    </div>
                    <p className={`text-3xl font-black ${Number(p.profit) >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {money(p.profit)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === "risks" && (
          <Panel title="Riesgos ejecutivos" icon={<ShieldAlert size={20} />}>
            <div className="space-y-3">
              {filteredRisks.map((r) => <RiskCard key={r.id} item={r} />)}
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function ModuleCard({ item }: { item: ModuleHealth }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-black">{item.module_name}</p>
          <p className="text-xs text-slate-400">{item.notes}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-emerald-300">{money(item.value)}</p>
          <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>
            {item.status}
          </span>
        </div>
      </div>
    </div>
  );
}

function RiskCard({ item }: { item: Risk }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-black">{item.alert_code} · {item.title}</p>
          <p className="text-xs text-slate-400">{item.alert_type} · {item.source_module || "General"}</p>
          <p className="mt-2 text-sm text-slate-300">{item.message}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.severity)}`}>
          {item.severity}
        </span>
      </div>
    </div>
  );
}

function Kpi({ title, value, icon }: { title: string; value: any; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
        {icon}
      </div>
      <p className="text-xs uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
          {icon}
        </div>
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}
