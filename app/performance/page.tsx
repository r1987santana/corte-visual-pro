"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Medal,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Tab = "dashboard" | "ranking" | "okrs" | "kpis" | "reviews" | "bonos";

type Dashboard = {
  active_cycles: number;
  active_okrs: number;
  kpi_results: number;
  reviews: number;
  avg_score: number;
  top_performers: number;
  risk_count: number;
  suggested_bonus_total: number;
};

type Ranking = {
  employee_id: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  kpi_score: number;
  okr_score: number;
  review_score: number;
  final_score: number;
  rating: string;
};

type Okr = {
  id: string;
  cycle_code: string;
  cycle_name: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  objective: string;
  key_result: string;
  target_value: number;
  current_value: number;
  progress_percent: number;
  weight: number;
  status: string;
};

type KpiResult = {
  id: string;
  cycle_code: string;
  cycle_name: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  kpi_code: string;
  kpi_name: string;
  actual_value: number;
  target_value: number;
  score: number;
  comments: string | null;
};

type Review = {
  id: string;
  cycle_code: string;
  cycle_name: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  reviewer_name: string;
  review_type: string;
  productivity_score: number;
  quality_score: number;
  teamwork_score: number;
  leadership_score: number;
  attendance_score: number;
  final_score: number;
  rating: string | null;
  strengths: string | null;
  improvement_areas: string | null;
  action_plan: string | null;
};

type Bonus = {
  id: string;
  cycle_id: string;
  employee_id: string;
  base_salary: number;
  performance_score: number;
  bonus_percent: number;
  bonus_amount: number;
  status: string;
  notes: string | null;
};

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(n || 0));

function ratingClass(score: number) {
  if (score >= 90) return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
  if (score >= 80) return "border-blue-400/30 bg-blue-500/15 text-blue-300";
  if (score >= 70) return "border-amber-400/30 bg-amber-500/15 text-amber-300";
  return "border-red-400/30 bg-red-500/15 text-red-300";
}

export default function PerformanceManagementPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard>({
    active_cycles: 0,
    active_okrs: 0,
    kpi_results: 0,
    reviews: 0,
    avg_score: 0,
    top_performers: 0,
    risk_count: 0,
    suggested_bonus_total: 0,
  });

  const [ranking, setRanking] = useState<Ranking[]>([]);
  const [okrs, setOkrs] = useState<Okr[]>([]);
  const [kpis, setKpis] = useState<KpiResult[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      const [dashRes, rankingRes, okrsRes, kpisRes, reviewsRes, bonusRes] = await Promise.all([
        supabase.from("v_hr_performance_dashboard").select("*").maybeSingle(),
        supabase.from("v_hr_performance_ranking").select("*").order("final_score", { ascending: false }),
        supabase.from("v_hr_okrs_detail").select("*").order("progress_percent", { ascending: false }),
        supabase.from("v_hr_kpi_results_detail").select("*").order("score", { ascending: false }),
        supabase.from("v_hr_performance_reviews_detail").select("*").order("final_score", { ascending: false }),
        supabase.from("hr_performance_bonus").select("*").order("bonus_amount", { ascending: false }),
      ]);

      if (dashRes.error) throw dashRes.error;
      if (rankingRes.error) throw rankingRes.error;
      if (okrsRes.error) throw okrsRes.error;
      if (kpisRes.error) throw kpisRes.error;
      if (reviewsRes.error) throw reviewsRes.error;
      if (bonusRes.error) throw bonusRes.error;

      if (dashRes.data) setDashboard(dashRes.data as Dashboard);
      setRanking((rankingRes.data || []) as Ranking[]);
      setOkrs((okrsRes.data || []) as Okr[]);
      setKpis((kpisRes.data || []) as KpiResult[]);
      setReviews((reviewsRes.data || []) as Review[]);
      setBonuses((bonusRes.data || []) as Bonus[]);
    } catch (error: any) {
      setMessage(error.message || "Error cargando Performance Management.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredRanking = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ranking;
    return ranking.filter((r) =>
      [r.employee_code, r.employee_name, r.department, r.position, r.rating]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [ranking, search]);

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "ranking", label: "Ranking", icon: Trophy },
    { id: "okrs", label: "OKRs", icon: Target },
    { id: "kpis", label: "KPIs", icon: Zap },
    { id: "reviews", label: "Reviews 360", icon: ClipboardCheck },
    { id: "bonos", label: "Bonos", icon: DollarSign },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">RD Wood System</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-5xl">
                Performance Management Pro
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Fase 19: KPIs, OKRs, evaluaciones 90/180/360, ranking y bonos automáticos.
              </p>
            </div>

            <button
              onClick={loadData}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-500"
            >
              <RefreshCw size={18} />
              Actualizar
            </button>
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

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-8">
          <Kpi title="Ciclos activos" value={dashboard.active_cycles} icon={<BarChart3 size={20} />} />
          <Kpi title="OKRs activos" value={dashboard.active_okrs} icon={<Target size={20} />} />
          <Kpi title="KPIs" value={dashboard.kpi_results} icon={<Zap size={20} />} />
          <Kpi title="Reviews" value={dashboard.reviews} icon={<ClipboardCheck size={20} />} />
          <Kpi title="Score prom." value={Number(dashboard.avg_score || 0).toFixed(1)} icon={<Star size={20} />} />
          <Kpi title="Top performers" value={dashboard.top_performers} icon={<Trophy size={20} />} />
          <Kpi title="Riesgo" value={dashboard.risk_count} icon={<Users size={20} />} />
          <Kpi title="Bonos" value={money(dashboard.suggested_bonus_total)} icon={<DollarSign size={20} />} />
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

        {tab === "ranking" && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empleado, departamento, rating..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>
        )}

        {tab === "dashboard" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="Top desempeño" icon={<Trophy size={20} />}>
              <div className="space-y-3">
                {ranking.slice(0, 8).map((r, index) => (
                  <RankingCard key={r.employee_id} item={r} index={index} />
                ))}
                {!ranking.length && <p className="text-sm text-slate-400">No hay ranking todavía.</p>}
              </div>
            </Panel>

            <Panel title="Últimas evaluaciones" icon={<ClipboardCheck size={20} />}>
              <div className="space-y-3">
                {reviews.slice(0, 8).map((r) => (
                  <ReviewCard key={r.id} item={r} />
                ))}
                {!reviews.length && <p className="text-sm text-slate-400">No hay evaluaciones.</p>}
              </div>
            </Panel>
          </section>
        )}

        {tab === "ranking" && (
          <Panel title="Ranking de desempeño" icon={<Trophy size={20} />}>
            <div className="space-y-3">
              {filteredRanking.map((r, index) => (
                <RankingCard key={r.employee_id} item={r} index={index} />
              ))}
              {!filteredRanking.length && <p className="text-sm text-slate-400">No hay resultados.</p>}
            </div>
          </Panel>
        )}

        {tab === "okrs" && (
          <Panel title="OKRs por empleado" icon={<Target size={20} />}>
            <div className="space-y-3">
              {okrs.map((o) => (
                <div key={o.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <p className="font-black">{o.employee_code} · {o.employee_name}</p>
                      <p className="text-xs text-slate-400">{o.department} · {o.position} · {o.cycle_name}</p>
                      <p className="mt-2 text-sm text-white">{o.objective}</p>
                      <p className="mt-1 text-xs text-slate-400">{o.key_result}</p>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${Number(o.progress_percent || 0)}%` }} />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-blue-300">{Number(o.progress_percent || 0).toFixed(0)}%</p>
                  </div>
                </div>
              ))}
              {!okrs.length && <p className="text-sm text-slate-400">No hay OKRs.</p>}
            </div>
          </Panel>
        )}

        {tab === "kpis" && (
          <Panel title="Resultados KPI" icon={<Zap size={20} />}>
            <div className="space-y-3">
              {kpis.map((k) => (
                <div key={k.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{k.employee_code} · {k.employee_name}</p>
                      <p className="text-xs text-slate-400">{k.kpi_code} · {k.kpi_name}</p>
                      <p className="mt-2 text-sm text-slate-300">{k.comments}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${ratingClass(Number(k.score || 0))}`}>
                      Score {Number(k.score || 0).toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
              {!kpis.length && <p className="text-sm text-slate-400">No hay KPIs.</p>}
            </div>
          </Panel>
        )}

        {tab === "reviews" && (
          <Panel title="Evaluaciones 90/180/360" icon={<ClipboardCheck size={20} />}>
            <div className="space-y-3">
              {reviews.map((r) => (
                <ReviewCard key={r.id} item={r} />
              ))}
              {!reviews.length && <p className="text-sm text-slate-400">No hay reviews.</p>}
            </div>
          </Panel>
        )}

        {tab === "bonos" && (
          <Panel title="Bonos sugeridos por desempeño" icon={<DollarSign size={20} />}>
            <div className="space-y-3">
              {bonuses.map((b) => (
                <div key={b.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">Empleado ID: {b.employee_id}</p>
                      <p className="text-xs text-slate-400">Base: {money(b.base_salary)} · Score {Number(b.performance_score || 0).toFixed(1)}</p>
                      <p className="mt-2 text-sm text-slate-300">{b.notes}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-emerald-300">{money(b.bonus_amount)}</p>
                      <p className="text-xs text-slate-400">{Number(b.bonus_percent || 0).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              ))}
              {!bonuses.length && <p className="text-sm text-slate-400">No hay bonos sugeridos.</p>}
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function RankingCard({ item, index }: { item: Ranking; index: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-black">
            #{index + 1} · {item.employee_code} · {item.employee_name}
          </p>
          <p className="text-xs text-slate-400">{item.department} · {item.position}</p>
          <p className="mt-2 text-xs text-slate-400">
            KPI {Number(item.kpi_score || 0).toFixed(1)} · OKR {Number(item.okr_score || 0).toFixed(1)} · Review {Number(item.review_score || 0).toFixed(1)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-emerald-300">{Number(item.final_score || 0).toFixed(1)}</p>
          <span className={`inline-block rounded-full border px-3 py-1 text-xs font-black ${ratingClass(Number(item.final_score || 0))}`}>
            {item.rating}
          </span>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ item }: { item: Review }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-black">{item.employee_code} · {item.employee_name}</p>
          <p className="text-xs text-slate-400">{item.review_type} · {item.reviewer_name} · {item.cycle_name}</p>
          <p className="mt-2 text-sm text-slate-300">{item.strengths}</p>
          <p className="mt-1 text-xs text-slate-400">Plan: {item.action_plan}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${ratingClass(Number(item.final_score || 0))}`}>
          {Number(item.final_score || 0).toFixed(0)} · {item.rating}
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
