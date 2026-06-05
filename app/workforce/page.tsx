"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Briefcase,
  Building2,
  ChevronRight,
  DollarSign,
  GitBranch,
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Tab = "dashboard" | "organigrama" | "departamentos" | "plan" | "span" | "escenarios";

type Dashboard = {
  current_headcount: number;
  org_units: number;
  planned_headcount: number;
  headcount_gap: number;
  budgeted_vacancies: number;
  monthly_payroll: number;
  annual_payroll: number;
  avg_span_of_control: number;
  scenarios: number;
};

type OrgNode = {
  employee_id: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  supervisor_id: string | null;
  supervisor_code: string | null;
  supervisor_name: string | null;
  monthly_salary: number;
  org_unit_code: string | null;
  org_unit_name: string | null;
  unit_type: string | null;
};

type DepartmentCost = {
  department: string;
  headcount: number;
  monthly_cost: number;
  annual_cost: number;
  avg_salary: number;
};

type PlanPosition = {
  id: string;
  code: string;
  org_unit_code: string | null;
  org_unit_name: string | null;
  department: string | null;
  position_title: string;
  planned_headcount: number;
  current_headcount: number;
  open_positions: number;
  calculated_gap: number;
  min_salary: number;
  max_salary: number;
  budgeted_salary: number;
  planned_monthly_cost: number;
  planned_annual_cost: number;
  priority: string;
  status: string;
  target_hire_date: string | null;
  business_reason: string | null;
};

type Span = {
  supervisor_id: string;
  supervisor_code: string | null;
  supervisor_name: string;
  department: string | null;
  position: string | null;
  direct_reports: number;
  team_monthly_cost: number;
};

type Scenario = {
  id: string;
  code: string;
  name: string;
  scenario_type: string;
  growth_percent: number;
  planned_new_roles: number;
  projected_monthly_cost: number;
  projected_annual_cost: number;
  notes: string | null;
  status: string;
};

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(n || 0));

function badgeClass(value?: string | null) {
  if (["aprobado", "activo"].includes(value || "")) return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
  if (["alta", "critica", "planificado"].includes(value || "")) return "border-blue-400/30 bg-blue-500/15 text-blue-300";
  if (["congelado", "cerrado"].includes(value || "")) return "border-red-400/30 bg-red-500/15 text-red-300";
  return "border-slate-500/30 bg-slate-500/15 text-slate-300";
}

export default function WorkforcePlanningPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard>({
    current_headcount: 0,
    org_units: 0,
    planned_headcount: 0,
    headcount_gap: 0,
    budgeted_vacancies: 0,
    monthly_payroll: 0,
    annual_payroll: 0,
    avg_span_of_control: 0,
    scenarios: 0,
  });

  const [org, setOrg] = useState<OrgNode[]>([]);
  const [departments, setDepartments] = useState<DepartmentCost[]>([]);
  const [plan, setPlan] = useState<PlanPosition[]>([]);
  const [span, setSpan] = useState<Span[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      const [dashRes, orgRes, deptRes, planRes, spanRes, scnRes] = await Promise.all([
        supabase.from("v_hr_workforce_dashboard").select("*").maybeSingle(),
        supabase.from("v_hr_org_chart").select("*").order("department"),
        supabase.from("v_hr_department_costs").select("*").order("monthly_cost", { ascending: false }),
        supabase.from("v_hr_workforce_plan_detail").select("*").order("department"),
        supabase.from("v_hr_span_of_control").select("*").order("direct_reports", { ascending: false }),
        supabase.from("hr_workforce_scenarios").select("*").order("created_at", { ascending: false }),
      ]);

      if (dashRes.error) throw dashRes.error;
      if (orgRes.error) throw orgRes.error;
      if (deptRes.error) throw deptRes.error;
      if (planRes.error) throw planRes.error;
      if (spanRes.error) throw spanRes.error;
      if (scnRes.error) throw scnRes.error;

      if (dashRes.data) setDashboard(dashRes.data as Dashboard);
      setOrg((orgRes.data || []) as OrgNode[]);
      setDepartments((deptRes.data || []) as DepartmentCost[]);
      setPlan((planRes.data || []) as PlanPosition[]);
      setSpan((spanRes.data || []) as Span[]);
      setScenarios((scnRes.data || []) as Scenario[]);
    } catch (error: any) {
      setMessage(error.message || "Error cargando Workforce Planning.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredOrg = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return org;
    return org.filter((o) =>
      [o.employee_code, o.employee_name, o.department, o.position, o.supervisor_name, o.org_unit_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [org, search]);

  async function createScenario() {
    try {
      setLoading(true);
      const { error } = await supabase.rpc("hr_create_workforce_scenario", {
        p_name: `Escenario crecimiento ${new Date().toLocaleDateString("es-DO")}`,
        p_growth_percent: 20,
      });
      if (error) throw error;
      setMessage("Escenario de crecimiento creado.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo crear el escenario.");
    } finally {
      setLoading(false);
    }
  }

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "organigrama", label: "Organigrama", icon: Network },
    { id: "departamentos", label: "Departamentos", icon: Building2 },
    { id: "plan", label: "Plan headcount", icon: Target },
    { id: "span", label: "Span control", icon: GitBranch },
    { id: "escenarios", label: "Escenarios", icon: TrendingUp },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">RD Wood System</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-5xl">
                Workforce Planning Pro
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Fase 20: organigrama, headcount, vacantes presupuestadas, span of control y escenarios de crecimiento.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={createScenario}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-500"
              >
                <TrendingUp size={18} />
                Crear escenario
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

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-9">
          <Kpi title="Headcount" value={dashboard.current_headcount} icon={<Users size={20} />} />
          <Kpi title="Unidades" value={dashboard.org_units} icon={<Building2 size={20} />} />
          <Kpi title="HC plan" value={dashboard.planned_headcount} icon={<Target size={20} />} />
          <Kpi title="Gap" value={dashboard.headcount_gap} icon={<ShieldAlert size={20} />} />
          <Kpi title="Vacantes" value={dashboard.budgeted_vacancies} icon={<Briefcase size={20} />} />
          <Kpi title="Nómina mes" value={money(dashboard.monthly_payroll)} icon={<DollarSign size={20} />} />
          <Kpi title="Nómina año" value={money(dashboard.annual_payroll)} icon={<DollarSign size={20} />} />
          <Kpi title="Span prom." value={Number(dashboard.avg_span_of_control || 0).toFixed(1)} icon={<GitBranch size={20} />} />
          <Kpi title="Escenarios" value={dashboard.scenarios} icon={<TrendingUp size={20} />} />
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

        {tab === "organigrama" && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empleado, departamento, supervisor..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>
        )}

        {tab === "dashboard" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="Estructura organizacional" icon={<Network size={20} />}>
              <div className="space-y-3">
                {org.slice(0, 8).map((o) => <OrgCard key={o.employee_id} item={o} />)}
                {!org.length && <p className="text-sm text-slate-400">No hay empleados activos.</p>}
              </div>
            </Panel>

            <Panel title="Costo por departamento" icon={<DollarSign size={20} />}>
              <div className="space-y-3">
                {departments.map((d) => <DepartmentCard key={d.department} item={d} />)}
                {!departments.length && <p className="text-sm text-slate-400">No hay costos departamentales.</p>}
              </div>
            </Panel>
          </section>
        )}

        {tab === "organigrama" && (
          <Panel title="Organigrama ejecutivo" icon={<Network size={20} />}>
            <div className="space-y-3">
              {filteredOrg.map((o) => <OrgCard key={o.employee_id} item={o} />)}
            </div>
          </Panel>
        )}

        {tab === "departamentos" && (
          <Panel title="Costos por departamento" icon={<Building2 size={20} />}>
            <div className="space-y-3">
              {departments.map((d) => <DepartmentCard key={d.department} item={d} />)}
            </div>
          </Panel>
        )}

        {tab === "plan" && (
          <Panel title="Plan de headcount y vacantes presupuestadas" icon={<Target size={20} />}>
            <div className="space-y-3">
              {plan.map((p) => (
                <div key={p.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{p.code} · {p.position_title}</p>
                      <p className="text-xs text-slate-400">{p.department} · {p.org_unit_name} · meta {p.target_hire_date || "N/A"}</p>
                      <p className="mt-2 text-sm text-slate-300">{p.business_reason}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Actual {p.current_headcount} · Plan {p.planned_headcount} · Gap {p.calculated_gap}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-emerald-300">{money(p.planned_monthly_cost)}</p>
                      <p className="text-xs text-slate-400">Costo mes planificado</p>
                      <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black ${badgeClass(p.status)}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {!plan.length && <p className="text-sm text-slate-400">No hay plan de headcount.</p>}
            </div>
          </Panel>
        )}

        {tab === "span" && (
          <Panel title="Span of Control" icon={<GitBranch size={20} />}>
            <div className="space-y-3">
              {span.map((s) => (
                <div key={s.supervisor_id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{s.supervisor_code} · {s.supervisor_name}</p>
                      <p className="text-xs text-slate-400">{s.department} · {s.position}</p>
                      <p className="mt-2 text-sm text-slate-300">Reportes directos: {s.direct_reports}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-blue-300">{money(s.team_monthly_cost)}</p>
                      <p className="text-xs text-slate-400">Costo equipo mes</p>
                    </div>
                  </div>
                </div>
              ))}
              {!span.length && <p className="text-sm text-slate-400">No hay supervisores.</p>}
            </div>
          </Panel>
        )}

        {tab === "escenarios" && (
          <Panel title="Escenarios de crecimiento" icon={<TrendingUp size={20} />}>
            <div className="space-y-3">
              {scenarios.map((s) => (
                <div key={s.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{s.code} · {s.name}</p>
                      <p className="text-xs text-slate-400">{s.scenario_type} · crecimiento {Number(s.growth_percent || 0).toFixed(1)}%</p>
                      <p className="mt-2 text-sm text-slate-300">{s.notes}</p>
                      <p className="mt-1 text-xs text-slate-400">Roles nuevos proyectados: {s.planned_new_roles}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-emerald-300">{money(s.projected_monthly_cost)}</p>
                      <p className="text-xs text-slate-400">Costo mensual proyectado</p>
                      <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black ${badgeClass(s.status)}`}>
                        {s.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {!scenarios.length && <p className="text-sm text-slate-400">No hay escenarios.</p>}
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function OrgCard({ item }: { item: OrgNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-black">{item.employee_code} · {item.employee_name}</p>
          <p className="text-xs text-slate-400">{item.department} · {item.position}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-300">
            <ChevronRight size={16} /> Reporta a: {item.supervisor_name || "CEO / Sin supervisor"}
          </p>
          <p className="mt-1 text-xs text-slate-500">{item.org_unit_code} · {item.org_unit_name}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-emerald-300">{money(item.monthly_salary)}</p>
          <p className="text-xs text-slate-400">Salario mes</p>
        </div>
      </div>
    </div>
  );
}

function DepartmentCard({ item }: { item: DepartmentCost }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-black">{item.department}</p>
          <p className="text-xs text-slate-400">Headcount {item.headcount} · Salario promedio {money(item.avg_salary)}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-blue-300">{money(item.monthly_cost)}</p>
          <p className="text-xs text-slate-400">Mes · {money(item.annual_cost)} año</p>
        </div>
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
