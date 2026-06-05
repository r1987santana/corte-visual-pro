"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  FileText,
  Gift,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Tab = "dashboard" | "vacantes" | "candidatos" | "pipeline" | "entrevistas" | "ofertas";

type Dashboard = {
  open_jobs: number;
  active_candidates: number;
  active_applications: number;
  scheduled_interviews: number;
  open_offers: number;
  hired_count: number;
  avg_candidate_score: number;
};

type Job = {
  id: string;
  code: string;
  title: string;
  department: string | null;
  position_title: string | null;
  employment_type: string | null;
  priority: string | null;
  status: string | null;
  min_salary: number | null;
  max_salary: number | null;
  requirements: string | null;
  responsibilities: string | null;
  benefits: string | null;
};

type Application = {
  id: string;
  job_code: string;
  job_title: string;
  job_department: string | null;
  position_title: string | null;
  job_priority: string | null;
  job_status: string | null;
  candidate_code: string;
  candidate_name: string;
  candidate_email: string | null;
  candidate_phone: string | null;
  source: string | null;
  years_experience: number | null;
  expected_salary: number | null;
  ai_score: number | null;
  stage: string;
  status: string;
  match_score: number;
  final_score: number;
  salary_fit_score: number;
  experience_score: number;
  culture_score: number;
  interviews_count: number;
  evaluations_count: number;
  notes: string | null;
};

type Candidate = {
  id: string;
  candidate_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  current_position: string | null;
  years_experience: number | null;
  expected_salary: number | null;
  city: string | null;
  status: string | null;
  ai_score: number | null;
  notes: string | null;
};

type Interview = {
  id: string;
  job_code: string;
  job_title: string;
  candidate_code: string;
  candidate_name: string;
  interview_type: string | null;
  scheduled_at: string | null;
  interviewer: string | null;
  location: string | null;
  status: string | null;
  score: number | null;
  feedback: string | null;
};

type Offer = {
  id: string;
  offer_code: string;
  job_code: string;
  job_title: string;
  department: string | null;
  position_title: string | null;
  candidate_code: string;
  candidate_name: string;
  offered_salary: number | null;
  benefits: string | null;
  start_date: string | null;
  status: string | null;
};

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

function badgeClass(value?: string | null) {
  if (["abierta", "activo", "hired", "contratado", "aceptada"].includes(value || "")) return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
  if (["alta", "critica", "offer", "enviada"].includes(value || "")) return "border-blue-400/30 bg-blue-500/15 text-blue-300";
  if (["rejected", "rechazado", "cancelada", "cerrada"].includes(value || "")) return "border-red-400/30 bg-red-500/15 text-red-300";
  return "border-slate-500/30 bg-slate-500/15 text-slate-300";
}

export default function RecruitmentPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard>({
    open_jobs: 0,
    active_candidates: 0,
    active_applications: 0,
    scheduled_interviews: 0,
    open_offers: 0,
    hired_count: 0,
    avg_candidate_score: 0,
  });

  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      const [dashRes, jobRes, candRes, appRes, interviewRes, offerRes] = await Promise.all([
        supabase.from("v_hr_ats_dashboard").select("*").maybeSingle(),
        supabase.from("hr_job_openings").select("*").order("created_at", { ascending: false }),
        supabase.from("hr_candidates").select("*").order("created_at", { ascending: false }),
        supabase.from("v_hr_applications_detail").select("*").order("match_score", { ascending: false }),
        supabase.from("v_hr_interviews_detail").select("*").order("scheduled_at", { ascending: true }),
        supabase.from("v_hr_offers_detail").select("*").order("created_at", { ascending: false }),
      ]);

      if (dashRes.error) throw dashRes.error;
      if (jobRes.error) throw jobRes.error;
      if (candRes.error) throw candRes.error;
      if (appRes.error) throw appRes.error;
      if (interviewRes.error) throw interviewRes.error;
      if (offerRes.error) throw offerRes.error;

      if (dashRes.data) setDashboard(dashRes.data as Dashboard);
      setJobs((jobRes.data || []) as Job[]);
      setCandidates((candRes.data || []) as Candidate[]);
      setApplications((appRes.data || []) as Application[]);
      setInterviews((interviewRes.data || []) as Interview[]);
      setOffers((offerRes.data || []) as Offer[]);
    } catch (error: any) {
      setMessage(error.message || "Error cargando ATS.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredApplications = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return applications;
    return applications.filter((a) =>
      [a.job_code, a.job_title, a.candidate_code, a.candidate_name, a.stage, a.job_department, a.position_title]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [applications, search]);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      [c.candidate_code, c.full_name, c.email, c.phone, c.source, c.current_position, c.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [candidates, search]);

  async function hire(applicationId: string) {
    try {
      setLoading(true);
      const { error } = await supabase.rpc("hr_ats_hire_candidate", {
        p_application_id: applicationId,
      });
      if (error) throw error;
      setMessage("Candidato contratado y creado en employees.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo contratar.");
    } finally {
      setLoading(false);
    }
  }

  async function recalc(applicationId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("hr_ats_recalculate_application_score", {
        p_application_id: applicationId,
      });
      if (error) throw error;
      setMessage(`Score recalculado: ${Number(data || 0).toFixed(2)}`);
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo recalcular.");
    } finally {
      setLoading(false);
    }
  }

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "vacantes", label: "Vacantes", icon: Briefcase },
    { id: "candidatos", label: "Candidatos", icon: Users },
    { id: "pipeline", label: "Pipeline", icon: Sparkles },
    { id: "entrevistas", label: "Entrevistas", icon: CalendarClock },
    { id: "ofertas", label: "Ofertas", icon: Gift },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">RD Wood System</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-5xl">
                Recruitment ATS Pro
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Fase 18: vacantes, candidatos, pipeline, entrevistas, ofertas y contratación automática.
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

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-7">
          <Kpi title="Vacantes abiertas" value={dashboard.open_jobs} icon={<Briefcase size={20} />} />
          <Kpi title="Candidatos activos" value={dashboard.active_candidates} icon={<Users size={20} />} />
          <Kpi title="Aplicaciones" value={dashboard.active_applications} icon={<FileText size={20} />} />
          <Kpi title="Entrevistas" value={dashboard.scheduled_interviews} icon={<CalendarClock size={20} />} />
          <Kpi title="Ofertas" value={dashboard.open_offers} icon={<Gift size={20} />} />
          <Kpi title="Contratados" value={dashboard.hired_count} icon={<UserCheck size={20} />} />
          <Kpi title="Score prom." value={Number(dashboard.avg_candidate_score || 0).toFixed(1)} icon={<Star size={20} />} />
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

        {(tab === "pipeline" || tab === "candidatos") && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar candidato, vacante, etapa, departamento..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>
        )}

        {tab === "dashboard" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="Top candidatos por score" icon={<Award size={20} />}>
              <div className="space-y-3">
                {applications.slice(0, 8).map((a) => (
                  <ApplicationCard key={a.id} item={a} onHire={hire} onRecalc={recalc} />
                ))}
                {!applications.length && <p className="text-sm text-slate-400">No hay aplicaciones.</p>}
              </div>
            </Panel>

            <Panel title="Entrevistas próximas" icon={<CalendarClock size={20} />}>
              <div className="space-y-3">
                {interviews.slice(0, 8).map((i) => (
                  <InterviewCard key={i.id} item={i} />
                ))}
                {!interviews.length && <p className="text-sm text-slate-400">No hay entrevistas programadas.</p>}
              </div>
            </Panel>
          </section>
        )}

        {tab === "vacantes" && (
          <Panel title="Vacantes" icon={<Briefcase size={20} />}>
            <div className="grid gap-3 lg:grid-cols-2">
              {jobs.map((j) => (
                <div key={j.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{j.code} · {j.title}</p>
                      <p className="text-xs text-slate-400">{j.department} · {j.position_title} · {money(j.min_salary)} - {money(j.max_salary)}</p>
                      <p className="mt-2 text-sm text-slate-300">{j.requirements}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(j.status)}`}>{j.status}</span>
                  </div>
                </div>
              ))}
              {!jobs.length && <p className="text-sm text-slate-400">No hay vacantes.</p>}
            </div>
          </Panel>
        )}

        {tab === "candidatos" && (
          <Panel title="Candidatos" icon={<Users size={20} />}>
            <div className="grid gap-3 lg:grid-cols-2">
              {filteredCandidates.map((c) => (
                <div key={c.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{c.candidate_code} · {c.full_name}</p>
                      <p className="text-xs text-slate-400">{c.current_position} · {c.years_experience} años · {money(c.expected_salary)}</p>
                      <p className="mt-2 text-sm text-slate-300">{c.email} · {c.phone}</p>
                      <p className="mt-1 text-xs text-slate-500">{c.notes}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-emerald-300">{Number(c.ai_score || 0).toFixed(0)}</p>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(c.status)}`}>{c.status}</span>
                    </div>
                  </div>
                </div>
              ))}
              {!filteredCandidates.length && <p className="text-sm text-slate-400">No hay candidatos.</p>}
            </div>
          </Panel>
        )}

        {tab === "pipeline" && (
          <Panel title="Pipeline de aplicaciones" icon={<Sparkles size={20} />}>
            <div className="space-y-3">
              {filteredApplications.map((a) => (
                <ApplicationCard key={a.id} item={a} onHire={hire} onRecalc={recalc} />
              ))}
              {!filteredApplications.length && <p className="text-sm text-slate-400">No hay aplicaciones.</p>}
            </div>
          </Panel>
        )}

        {tab === "entrevistas" && (
          <Panel title="Entrevistas" icon={<CalendarClock size={20} />}>
            <div className="space-y-3">
              {interviews.map((i) => (
                <InterviewCard key={i.id} item={i} />
              ))}
              {!interviews.length && <p className="text-sm text-slate-400">No hay entrevistas.</p>}
            </div>
          </Panel>
        )}

        {tab === "ofertas" && (
          <Panel title="Ofertas laborales" icon={<Gift size={20} />}>
            <div className="space-y-3">
              {offers.map((o) => (
                <div key={o.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{o.offer_code} · {o.candidate_name}</p>
                      <p className="text-xs text-slate-400">{o.job_code} · {o.job_title} · inicio {o.start_date || "N/A"}</p>
                      <p className="mt-2 text-sm text-white">Oferta: {money(o.offered_salary)}</p>
                      <p className="mt-1 text-xs text-slate-400">{o.benefits}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(o.status)}`}>{o.status}</span>
                  </div>
                </div>
              ))}
              {!offers.length && <p className="text-sm text-slate-400">No hay ofertas.</p>}
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function ApplicationCard({
  item,
  onHire,
  onRecalc,
}: {
  item: Application;
  onHire: (id: string) => void;
  onRecalc: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <p className="font-black">{item.candidate_code} · {item.candidate_name}</p>
          <p className="text-xs text-slate-400">{item.job_code} · {item.job_title}</p>
          <p className="mt-2 text-sm text-white">
            {item.stage} · Match {Number(item.match_score || 0).toFixed(0)} · Final {Number(item.final_score || 0).toFixed(0)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Exp. {item.years_experience || 0} años · Esperado {money(item.expected_salary)}
          </p>
        </div>
        <div className="text-right">
          <span className={`inline-block rounded-full border px-3 py-1 text-xs font-black ${badgeClass(item.stage)}`}>{item.stage}</span>
          <div className="mt-3 flex flex-col gap-2">
            <button onClick={() => onRecalc(item.id)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500">
              Recalcular
            </button>
            {item.stage !== "hired" && (
              <button onClick={() => onHire(item.id)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-500">
                Contratar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InterviewCard({ item }: { item: Interview }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-black">{item.candidate_code} · {item.candidate_name}</p>
          <p className="text-xs text-slate-400">{item.job_code} · {item.job_title}</p>
          <p className="mt-2 text-sm text-white">{item.interview_type} · {item.interviewer}</p>
          <p className="mt-1 text-xs text-slate-400">{item.scheduled_at || "Sin fecha"} · {item.location}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(item.status)}`}>{item.status}</span>
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
