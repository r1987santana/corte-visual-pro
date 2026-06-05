"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BarChart3, Briefcase, CheckCircle2, Crown, GitBranch,
  RefreshCw, Search, ShieldAlert, Sparkles, Star, Target
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Tab = "dashboard" | "ninebox" | "criticos" | "sucesores" | "carrera";

type Dashboard = {
  critical_positions: number;
  successors: number;
  high_potentials: number;
  ready_now: number;
  positions_without_successor: number;
  active_career_paths: number;
};

type TalentReview = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  performance_score: number;
  potential_score: number;
  risk_of_loss: string | null;
  impact_of_loss: string | null;
  nine_box: string | null;
  talent_label: string | null;
  hipo: boolean | null;
  readiness_level: string | null;
  strengths: string | null;
  development_needs: string | null;
  recommended_action: string | null;
};

type CriticalPosition = {
  id: string;
  code: string;
  position_title: string;
  department: string | null;
  business_impact: string | null;
  vacancy_risk: string | null;
  required_successors: number | null;
  notes: string | null;
};

type Successor = {
  id: string;
  position_code: string;
  position_title: string;
  position_department: string | null;
  business_impact: string | null;
  vacancy_risk: string | null;
  current_employee_name: string | null;
  successor_code: string | null;
  successor_name: string;
  successor_department: string | null;
  successor_position: string | null;
  readiness_level: string | null;
  fit_score: number | null;
  development_plan: string | null;
  risk_notes: string | null;
};

type CareerPath = {
  id: string;
  employee_id: string;
  current_position: string | null;
  target_position: string;
  target_department: string | null;
  path_status: string | null;
  estimated_ready_date: string | null;
  required_training: string | null;
  required_experience: string | null;
  notes: string | null;
};

const readinessLabel: Record<string, string> = {
  ready_now: "Ready Now",
  "1_2_years": "1–2 años",
  "3_plus_years": "3+ años",
  desarrollar: "Desarrollar",
};

function scoreLevel(score: number) {
  if (score >= 80) return "Alto";
  if (score >= 60) return "Medio";
  return "Bajo";
}

function boxStyle(label?: string | null) {
  if (label === "Future Leader") return "border-emerald-400/50 bg-emerald-500/15 text-emerald-200";
  if (label === "High Potential") return "border-blue-400/50 bg-blue-500/15 text-blue-200";
  if (label === "Strong Performer") return "border-cyan-400/50 bg-cyan-500/15 text-cyan-200";
  if (label === "Core Talent") return "border-violet-400/50 bg-violet-500/15 text-violet-200";
  if (label === "Experto") return "border-amber-400/50 bg-amber-500/15 text-amber-200";
  if (label === "Riesgo") return "border-red-400/50 bg-red-500/15 text-red-200";
  return "border-slate-600 bg-slate-900 text-slate-200";
}

export default function SuccessionPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard>({
    critical_positions: 0, successors: 0, high_potentials: 0, ready_now: 0, positions_without_successor: 0, active_career_paths: 0,
  });
  const [talent, setTalent] = useState<TalentReview[]>([]);
  const [critical, setCritical] = useState<CriticalPosition[]>([]);
  const [successors, setSuccessors] = useState<Successor[]>([]);
  const [career, setCareer] = useState<CareerPath[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");
      const [dashRes, talentRes, criticalRes, successorRes, careerRes] = await Promise.all([
        supabase.from("v_hr_succession_dashboard").select("*").maybeSingle(),
        supabase.from("v_hr_talent_reviews_detail").select("*").order("performance_score", { ascending: false }),
        supabase.from("hr_critical_positions").select("*").order("position_title"),
        supabase.from("v_hr_successors_detail").select("*").order("fit_score", { ascending: false }),
        supabase.from("hr_career_paths").select("*").order("created_at", { ascending: false }),
      ]);
      if (dashRes.error) throw dashRes.error;
      if (talentRes.error) throw talentRes.error;
      if (criticalRes.error) throw criticalRes.error;
      if (successorRes.error) throw successorRes.error;
      if (careerRes.error) throw careerRes.error;
      if (dashRes.data) setDashboard(dashRes.data as Dashboard);
      setTalent((talentRes.data || []) as TalentReview[]);
      setCritical((criticalRes.data || []) as CriticalPosition[]);
      setSuccessors((successorRes.data || []) as Successor[]);
      setCareer((careerRes.data || []) as CareerPath[]);
    } catch (error: any) {
      setMessage(error.message || "Error cargando sucesión.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filteredTalent = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return talent;
    return talent.filter((t) =>
      [t.employee_code, t.employee_name, t.department, t.position, t.nine_box, t.talent_label]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [talent, search]);

  const matrix = useMemo(() => {
    const cells: Record<string, TalentReview[]> = {};
    for (const pot of ["Alto", "Medio", "Bajo"]) for (const perf of ["Bajo", "Medio", "Alto"]) cells[`${pot}-${perf}`] = [];
    for (const t of talent) cells[`${scoreLevel(t.potential_score)}-${scoreLevel(t.performance_score)}`]?.push(t);
    return cells;
  }, [talent]);

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "ninebox", label: "9-Box", icon: Sparkles },
    { id: "criticos", label: "Puestos críticos", icon: ShieldAlert },
    { id: "sucesores", label: "Sucesores", icon: GitBranch },
    { id: "carrera", label: "Planes de carrera", icon: Target },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">RD Wood System</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-5xl">Succession Planning & 9-Box Pro</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">Fase 16: sucesión, puestos críticos, high potentials, career paths y matriz 9-box.</p>
            </div>
            <button onClick={loadData} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-500">
              <RefreshCw size={18} /> Actualizar
            </button>
          </div>
        </section>

        {message && <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{message}</div>}
        {loading && <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">Cargando...</div>}

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Kpi title="Puestos críticos" value={dashboard.critical_positions} icon={<Briefcase size={20} />} />
          <Kpi title="Sucesores" value={dashboard.successors} icon={<GitBranch size={20} />} />
          <Kpi title="High Potentials" value={dashboard.high_potentials} icon={<Star size={20} />} />
          <Kpi title="Ready Now" value={dashboard.ready_now} icon={<CheckCircle2 size={20} />} />
          <Kpi title="Sin sucesor" value={dashboard.positions_without_successor} icon={<AlertTriangle size={20} />} />
          <Kpi title="Carreras activas" value={dashboard.active_career_paths} icon={<Target size={20} />} />
        </section>

        <section className="mb-6 flex gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-white/5 p-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button key={item.id} onClick={() => setTab(item.id as Tab)} className={`flex min-w-max items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10"}`}>
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </section>

        {(tab === "dashboard" || tab === "ninebox") && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
            <Search size={18} className="text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar talento, departamento, puesto o 9-box..." className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" />
          </div>
        )}

        {tab === "dashboard" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="Top Talent / High Potentials" icon={<Crown size={20} />}>
              <div className="space-y-3">
                {filteredTalent.slice(0, 8).map((t) => <TalentCard key={t.id} item={t} />)}
                {!filteredTalent.length && <p className="text-sm text-slate-400">No hay revisiones de talento.</p>}
              </div>
            </Panel>
            <Panel title="Cobertura de sucesión" icon={<GitBranch size={20} />}>
              <div className="space-y-3">
                {successors.slice(0, 8).map((s) => <SuccessorCard key={s.id} item={s} />)}
                {!successors.length && <p className="text-sm text-slate-400">No hay sucesores asignados.</p>}
              </div>
            </Panel>
          </section>
        )}

        {tab === "ninebox" && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200"><Sparkles size={20} /></div>
              <div><h2 className="text-xl font-black">Nine Box Matrix</h2><p className="text-xs text-slate-400">Potencial vertical × desempeño horizontal</p></div>
            </div>
            <div className="grid gap-3">
              {["Alto", "Medio", "Bajo"].map((pot) => (
                <div key={pot} className="grid gap-3 lg:grid-cols-[100px_1fr_1fr_1fr]">
                  <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-slate-900 p-3 text-sm font-black text-blue-200">Pot. {pot}</div>
                  {["Bajo", "Medio", "Alto"].map((perf) => (
                    <div key={`${pot}-${perf}`} className="min-h-44 rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                      <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Desempeño {perf}</p>
                      <div className="space-y-2">
                        {(matrix[`${pot}-${perf}`] || []).map((t) => (
                          <div key={t.id} className={`rounded-xl border px-3 py-2 text-xs ${boxStyle(t.nine_box)}`}>
                            <p className="font-black">{t.employee_name}</p><p>{t.nine_box}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "criticos" && (
          <Panel title="Puestos críticos" icon={<ShieldAlert size={20} />}>
            <div className="space-y-3">
              {critical.map((c) => (
                <div key={c.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div><p className="font-black">{c.code} · {c.position_title}</p><p className="text-xs text-slate-400">{c.department} · impacto {c.business_impact} · riesgo {c.vacancy_risk}</p><p className="mt-2 text-sm text-slate-300">{c.notes || "Sin notas"}</p></div>
                    <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-black text-blue-300">Requiere {c.required_successors || 1} sucesor(es)</span>
                  </div>
                </div>
              ))}
              {!critical.length && <p className="text-sm text-slate-400">No hay puestos críticos.</p>}
            </div>
          </Panel>
        )}

        {tab === "sucesores" && (
          <Panel title="Replacement Planning" icon={<GitBranch size={20} />}>
            <div className="space-y-3">
              {successors.map((s) => <SuccessorCard key={s.id} item={s} />)}
              {!successors.length && <p className="text-sm text-slate-400">No hay sucesores.</p>}
            </div>
          </Panel>
        )}

        {tab === "carrera" && (
          <Panel title="Planes de carrera" icon={<Target size={20} />}>
            <div className="space-y-3">
              {career.map((c) => (
                <div key={c.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div><p className="font-black">{c.current_position || "Actual"} → {c.target_position}</p><p className="text-xs text-slate-400">{c.target_department} · listo aprox: {c.estimated_ready_date || "No definido"}</p><p className="mt-2 text-sm text-slate-300">{c.required_training || "Sin entrenamiento requerido"}</p><p className="mt-1 text-xs text-slate-400">{c.notes}</p></div>
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300">{c.path_status}</span>
                  </div>
                </div>
              ))}
              {!career.length && <p className="text-sm text-slate-400">No hay planes de carrera.</p>}
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function TalentCard({ item }: { item: TalentReview }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-900 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="font-black">{item.employee_code} · {item.employee_name}</p><p className="text-xs text-slate-400">{item.department} · {item.position}</p><p className="mt-2 text-sm text-slate-300">{item.recommended_action || "Sin recomendación"}</p></div><div className="text-right"><span className={`inline-block rounded-full border px-3 py-1 text-xs font-black ${boxStyle(item.nine_box)}`}>{item.nine_box}</span><p className="mt-2 text-xs text-slate-400">Perf. {Number(item.performance_score || 0).toFixed(0)} · Pot. {Number(item.potential_score || 0).toFixed(0)}</p><p className="text-xs text-blue-200">{readinessLabel[item.readiness_level || ""] || item.readiness_level}</p></div></div></div>;
}

function SuccessorCard({ item }: { item: Successor }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-900 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="font-black">{item.position_code} · {item.position_title}</p><p className="text-xs text-slate-400">Actual: {item.current_employee_name || "No asignado"}</p><p className="mt-2 text-sm text-white">Sucesor: {item.successor_code} · {item.successor_name}</p><p className="mt-1 text-xs text-slate-400">{item.development_plan}</p></div><div className="text-right"><p className="text-2xl font-black text-emerald-300">{Number(item.fit_score || 0).toFixed(0)}</p><p className="text-xs text-blue-200">{readinessLabel[item.readiness_level || ""] || item.readiness_level}</p></div></div></div>;
}

function Kpi({ title, value, icon }: { title: string; value: any; icon: React.ReactNode }) {
  return <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">{icon}</div><p className="text-xs uppercase tracking-widest text-slate-400">{title}</p><p className="mt-1 text-xl font-black">{value}</p></div>;
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl"><div className="mb-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">{icon}</div><h2 className="text-lg font-black">{title}</h2></div>{children}</section>;
}
