"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Users,
  UserPlus,
  CalendarClock,
  Trophy,
  Search,
  RefreshCw,
  Plus,
  Save,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Star,
  ClipboardList,
  UserCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Tab = "dashboard" | "vacantes" | "candidatos" | "pipeline" | "entrevistas" | "evaluaciones";

type JobOpening = {
  id: string;
  code: string | null;
  title: string;
  department: string | null;
  position_title: string | null;
  location: string | null;
  employment_type: string | null;
  min_salary: number | null;
  max_salary: number | null;
  responsibilities: string | null;
  requirements: string | null;
  benefits: string | null;
  status: string | null;
  openings_count: number | null;
  created_at: string;
};

type Candidate = {
  id: string;
  candidate_code: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  current_position: string | null;
  years_experience: number | null;
  expected_salary: number | null;
  city: string | null;
  cv_url: string | null;
  portfolio_url: string | null;
  notes: string | null;
  status: string | null;
};

type Application = {
  id: string;
  job_opening_id: string;
  candidate_id: string;
  stage: string;
  fit_score: number | null;
  technical_score: number | null;
  culture_score: number | null;
  final_score: number | null;
  expected_salary: number | null;
  availability_date: string | null;
  rejection_reason: string | null;
  hired_employee_id: string | null;
  applied_at: string;
  job_code: string | null;
  job_title: string;
  job_department: string | null;
  candidate_code: string | null;
  candidate_name: string;
  candidate_phone: string | null;
  candidate_email: string | null;
  years_experience: number | null;
  candidate_expected_salary: number | null;
  cv_url: string | null;
  portfolio_url: string | null;
  interviews_count: number | null;
  evaluations_count: number | null;
};

type Interview = {
  id: string;
  application_id: string;
  interview_date: string;
  interviewer: string | null;
  interview_type: string | null;
  status: string | null;
  notes: string | null;
  score: number | null;
};

type Dashboard = {
  open_jobs: number;
  active_candidates: number;
  active_applications: number;
  scheduled_interviews: number;
  hired_count: number;
  avg_candidate_score: number;
};

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const stages = [
  { id: "nuevo", label: "Nuevo" },
  { id: "preseleccion", label: "Preselección" },
  { id: "entrevista", label: "Entrevista" },
  { id: "prueba", label: "Prueba" },
  { id: "oferta", label: "Oferta" },
  { id: "contratado", label: "Contratado" },
  { id: "rechazado", label: "Rechazado" },
];

function buildRecordCode(prefix: string) {
  const day = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${day}-${suffix}`;
}

export default function RRHHATSRecruitmentPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [jobForm, setJobForm] = useState({
    title: "",
    department: "",
    position: "",
    location: "La Romana, RD",
    employment_type: "tiempo_completo",
    salary_min: "",
    salary_max: "",
    description: "",
    requirements: "",
    benefits: "",
    openings_count: "1",
  });

  const [candidateForm, setCandidateForm] = useState({
    full_name: "",
    identification: "",
    phone: "",
    email: "",
    address: "",
    desired_position: "",
    current_company: "",
    years_experience: "0",
    expected_salary: "",
    cv_url: "",
    portfolio_url: "",
    notes: "",
  });

  const [applicationForm, setApplicationForm] = useState({
    job_opening_id: "",
    candidate_id: "",
    fit_score: "0",
    technical_score: "0",
    culture_score: "0",
    expected_salary: "",
    availability_date: "",
  });

  const [interviewForm, setInterviewForm] = useState({
    application_id: "",
    interview_date: "",
    interviewer: "",
    interview_type: "presencial",
    notes: "",
  });

  const [evaluationForm, setEvaluationForm] = useState({
    application_id: "",
    evaluator: "",
    technical_score: "0",
    experience_score: "0",
    attitude_score: "0",
    culture_score: "0",
    communication_score: "0",
    strengths: "",
    weaknesses: "",
    recommendation: "",
  });

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) =>
      [j.code, j.title, j.department, j.position_title, j.status].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [jobs, search]);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      [c.candidate_code, c.full_name, c.phone, c.email, c.current_position, c.source, c.city, c.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [candidates, search]);

  async function loadAll() {
    try {
      setLoading(true);
      setMessage("");

      const [jobsRes, candRes, appRes, intRes, dashRes] = await Promise.all([
        supabase.from("hr_job_openings").select("*").order("created_at", { ascending: false }),
        supabase.from("hr_candidates").select("*").order("created_at", { ascending: false }),
        supabase.from("v_hr_applications_detail").select("*").order("applied_at", { ascending: false }),
        supabase.from("hr_interviews").select("*").order("interview_date", { ascending: true }),
        supabase.from("v_hr_ats_dashboard").select("*").maybeSingle(),
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (candRes.error) throw candRes.error;
      if (appRes.error) throw appRes.error;
      if (intRes.error) throw intRes.error;
      if (dashRes.error) throw dashRes.error;

      setJobs((jobsRes.data || []) as JobOpening[]);
      setCandidates((candRes.data || []) as Candidate[]);
      setApplications((appRes.data || []) as Application[]);
      setInterviews((intRes.data || []) as Interview[]);
      setDashboard(dashRes.data as Dashboard);

      const firstJob = (jobsRes.data || [])[0] as JobOpening | undefined;
      const firstCandidate = (candRes.data || [])[0] as Candidate | undefined;
      const firstApp = (appRes.data || [])[0] as Application | undefined;

      if (firstJob && !applicationForm.job_opening_id) {
        setApplicationForm((f) => ({ ...f, job_opening_id: firstJob.id }));
      }
      if (firstCandidate && !applicationForm.candidate_id) {
        setApplicationForm((f) => ({ ...f, candidate_id: firstCandidate.id }));
      }
      if (firstApp && !interviewForm.application_id) {
        setInterviewForm((f) => ({ ...f, application_id: firstApp.id }));
        setEvaluationForm((f) => ({ ...f, application_id: firstApp.id }));
      }
    } catch (error: any) {
      setMessage(error.message || "Error cargando ATS.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createJob() {
    if (!jobForm.title.trim()) {
      setMessage("Digite el título de la vacante.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.from("hr_job_openings").insert({
        code: buildRecordCode("VAC"),
        title: jobForm.title,
        department: jobForm.department || null,
        position_title: jobForm.position || jobForm.title,
        location: jobForm.location || null,
        employment_type: jobForm.employment_type,
        min_salary: Number(jobForm.salary_min || 0),
        max_salary: Number(jobForm.salary_max || 0),
        responsibilities: jobForm.description || null,
        requirements: jobForm.requirements || null,
        benefits: jobForm.benefits || null,
        openings_count: Number(jobForm.openings_count || 1),
        priority: "media",
        published_at: new Date().toISOString(),
        status: "abierta",
      });

      if (error) throw error;

      setJobForm({
        title: "",
        department: "",
        position: "",
        location: "La Romana, RD",
        employment_type: "tiempo_completo",
        salary_min: "",
        salary_max: "",
        description: "",
        requirements: "",
        benefits: "",
        openings_count: "1",
      });

      setMessage("Vacante creada correctamente.");
      await loadAll();
    } catch (error: any) {
      setMessage(error.message || "Error creando vacante.");
    } finally {
      setLoading(false);
    }
  }

  async function createCandidate() {
    if (!candidateForm.full_name.trim()) {
      setMessage("Digite el nombre del candidato.");
      return;
    }

    try {
      setLoading(true);
      const notes = [
        candidateForm.identification ? `Cedula: ${candidateForm.identification}` : "",
        candidateForm.address ? `Direccion: ${candidateForm.address}` : "",
        candidateForm.current_company ? `Empresa actual: ${candidateForm.current_company}` : "",
        candidateForm.notes,
      ].filter(Boolean).join("\n");

      const { error } = await supabase.from("hr_candidates").insert({
        candidate_code: buildRecordCode("CAND"),
        full_name: candidateForm.full_name,
        phone: candidateForm.phone || null,
        email: candidateForm.email || null,
        source: "manual_rrhh",
        current_position: candidateForm.desired_position || candidateForm.current_company || null,
        years_experience: Number(candidateForm.years_experience || 0),
        expected_salary: Number(candidateForm.expected_salary || 0),
        city: null,
        cv_url: candidateForm.cv_url || null,
        portfolio_url: candidateForm.portfolio_url || null,
        notes: notes || null,
        ai_score: 0,
        status: "activo",
      });

      if (error) throw error;

      setCandidateForm({
        full_name: "",
        identification: "",
        phone: "",
        email: "",
        address: "",
        desired_position: "",
        current_company: "",
        years_experience: "0",
        expected_salary: "",
        cv_url: "",
        portfolio_url: "",
        notes: "",
      });

      setMessage("Candidato creado correctamente.");
      await loadAll();
    } catch (error: any) {
      setMessage(error.message || "Error creando candidato.");
    } finally {
      setLoading(false);
    }
  }

  async function createApplication() {
    if (!applicationForm.job_opening_id || !applicationForm.candidate_id) {
      setMessage("Seleccione vacante y candidato.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("hr_applications")
        .insert({
          job_opening_id: applicationForm.job_opening_id,
          candidate_id: applicationForm.candidate_id,
          match_score: Number(applicationForm.fit_score || 0),
          experience_score: Number(applicationForm.technical_score || 0),
          culture_score: Number(applicationForm.culture_score || 0),
          salary_fit_score: 0,
          final_score: Number(applicationForm.fit_score || 0),
          status: "activo",
          stage: "nuevo",
        })
        .select("id")
        .single();

      if (error) throw error;

      const scoreRes = await supabase.rpc("calculate_application_score", { p_application_id: data.id });
      if (scoreRes.error) {
        await supabase.rpc("hr_ats_recalculate_application_score", { p_application_id: data.id });
      }

      setMessage("Aplicación creada correctamente.");
      await loadAll();
      setTab("pipeline");
    } catch (error: any) {
      setMessage(error.message || "Error creando aplicación.");
    } finally {
      setLoading(false);
    }
  }

  async function moveStage(appId: string, stage: string) {
    const { error } = await supabase.from("hr_applications").update({ stage }).eq("id", appId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Etapa actualizada.");
    await loadAll();
  }

  async function createInterview() {
    if (!interviewForm.application_id || !interviewForm.interview_date) {
      setMessage("Seleccione aplicación y fecha.");
      return;
    }

    const { error } = await supabase.from("hr_interviews").insert({
      application_id: interviewForm.application_id,
      interview_date: interviewForm.interview_date,
      interviewer: interviewForm.interviewer || null,
      interview_type: interviewForm.interview_type,
      notes: interviewForm.notes || null,
      status: "programada",
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setInterviewForm({ ...interviewForm, interview_date: "", notes: "" });
    setMessage("Entrevista programada.");
    await loadAll();
  }

  async function markInterviewDone(id: string) {
    const scoreText = window.prompt("Puntuación de entrevista 0-10:", "8");
    if (scoreText === null) return;

    const { error } = await supabase
      .from("hr_interviews")
      .update({ status: "completada", score: Number(scoreText || 0) })
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Entrevista completada.");
    await loadAll();
  }

  async function createEvaluation() {
    if (!evaluationForm.application_id) {
      setMessage("Seleccione aplicación.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.from("hr_candidate_evaluations").insert({
        application_id: evaluationForm.application_id,
        evaluator: evaluationForm.evaluator || null,
        technical_score: Number(evaluationForm.technical_score || 0),
        experience_score: Number(evaluationForm.experience_score || 0),
        attitude_score: Number(evaluationForm.attitude_score || 0),
        culture_score: Number(evaluationForm.culture_score || 0),
        communication_score: Number(evaluationForm.communication_score || 0),
        strengths: evaluationForm.strengths || null,
        weaknesses: evaluationForm.weaknesses || null,
        recommendation: evaluationForm.recommendation || null,
      });

      if (error) throw error;

      await supabase.rpc("calculate_application_score", {
        p_application_id: evaluationForm.application_id,
      });

      setMessage("Evaluación creada y score recalculado.");
      setEvaluationForm({
        ...evaluationForm,
        technical_score: "0",
        experience_score: "0",
        attitude_score: "0",
        culture_score: "0",
        communication_score: "0",
        strengths: "",
        weaknesses: "",
        recommendation: "",
      });

      await loadAll();
    } catch (error: any) {
      setMessage(error.message || "Error creando evaluación.");
    } finally {
      setLoading(false);
    }
  }

  async function hireCandidate(app: Application) {
    const salary = window.prompt("Salario de contratación:", String(app.expected_salary || app.candidate_expected_salary || 0));
    if (salary === null) return;

    const startDate = window.prompt("Fecha de entrada YYYY-MM-DD:", new Date().toISOString().slice(0, 10));
    if (startDate === null) return;

    try {
      setLoading(true);

      const { error } = await supabase.rpc("hire_candidate_to_employee", {
        p_application_id: app.id,
        p_salary: Number(salary || 0),
        p_start_date: startDate,
        p_pin: null,
      });

      if (error) throw error;

      setMessage("Candidato contratado y convertido en empleado.");
      await loadAll();
    } catch (error: any) {
      setMessage(error.message || "Error contratando candidato.");
    } finally {
      setLoading(false);
    }
  }

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: ClipboardList },
    { id: "vacantes", label: "Vacantes", icon: Briefcase },
    { id: "candidatos", label: "Candidatos", icon: Users },
    { id: "pipeline", label: "Pipeline", icon: ArrowRight },
    { id: "entrevistas", label: "Entrevistas", icon: CalendarClock },
    { id: "evaluaciones", label: "Evaluaciones", icon: Star },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">RD Wood System</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-5xl">
                Reclutamiento ATS Pro
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Fase 12: vacantes, candidatos, pipeline, entrevistas, evaluación y contratación automática.
              </p>
            </div>

            <button
              onClick={loadAll}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-lg hover:bg-blue-100"
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

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Kpi title="Vacantes" value={dashboard?.open_jobs || 0} icon={<Briefcase size={20} />} />
          <Kpi title="Candidatos" value={dashboard?.active_candidates || 0} icon={<Users size={20} />} />
          <Kpi title="Aplicaciones" value={dashboard?.active_applications || 0} icon={<UserPlus size={20} />} />
          <Kpi title="Entrevistas" value={dashboard?.scheduled_interviews || 0} icon={<CalendarClock size={20} />} />
          <Kpi title="Contratados" value={dashboard?.hired_count || 0} icon={<UserCheck size={20} />} />
          <Kpi title="Score Prom." value={Number(dashboard?.avg_candidate_score || 0).toFixed(1)} icon={<Trophy size={20} />} />
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

        {(tab === "vacantes" || tab === "candidatos") && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>
        )}

        {tab === "dashboard" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="Top candidatos por score" icon={<Trophy size={20} />}>
              <div className="space-y-3">
                {applications
                  .slice()
                  .sort((a, b) => Number(b.final_score || 0) - Number(a.final_score || 0))
                  .slice(0, 8)
                  .map((a) => (
                    <AppCard key={a.id} app={a} onMove={moveStage} onHire={hireCandidate} />
                  ))}
                {!applications.length && <p className="text-sm text-slate-400">No hay aplicaciones.</p>}
              </div>
            </Panel>

            <Panel title="Entrevistas próximas" icon={<CalendarClock size={20} />}>
              <div className="space-y-3">
                {interviews
                  .filter((i) => i.status === "programada")
                  .slice(0, 8)
                  .map((i) => {
                    const app = applications.find((a) => a.id === i.application_id);
                    return (
                      <div key={i.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                        <p className="font-black">{app?.candidate_name || "Candidato"}</p>
                        <p className="text-xs text-slate-400">{app?.job_title || "-"} · {i.interview_type}</p>
                        <p className="mt-2 text-sm">{new Date(i.interview_date).toLocaleString("es-DO")}</p>
                        <button
                          onClick={() => markInterviewDone(i.id)}
                          className="mt-3 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold hover:bg-emerald-500"
                        >
                          Completar
                        </button>
                      </div>
                    );
                  })}
                {!interviews.filter((i) => i.status === "programada").length && (
                  <p className="text-sm text-slate-400">No hay entrevistas programadas.</p>
                )}
              </div>
            </Panel>
          </section>
        )}

        {tab === "vacantes" && (
          <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
            <Panel title="Nueva vacante" icon={<Plus size={20} />}>
              <div className="grid gap-3">
                <Input label="Título" value={jobForm.title} onChange={(v) => setJobForm({ ...jobForm, title: v })} />
                <Input label="Departamento" value={jobForm.department} onChange={(v) => setJobForm({ ...jobForm, department: v })} />
                <Input label="Cargo" value={jobForm.position} onChange={(v) => setJobForm({ ...jobForm, position: v })} />
                <Input label="Ubicación" value={jobForm.location} onChange={(v) => setJobForm({ ...jobForm, location: v })} />
                <Select label="Tipo" value={jobForm.employment_type} onChange={(v) => setJobForm({ ...jobForm, employment_type: v })}>
                  <option value="tiempo_completo">Tiempo completo</option>
                  <option value="medio_tiempo">Medio tiempo</option>
                  <option value="contrato">Contrato</option>
                  <option value="temporal">Temporal</option>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Salario min" value={jobForm.salary_min} onChange={(v) => setJobForm({ ...jobForm, salary_min: v })} />
                  <Input label="Salario max" value={jobForm.salary_max} onChange={(v) => setJobForm({ ...jobForm, salary_max: v })} />
                </div>
                <Input label="Plazas" value={jobForm.openings_count} onChange={(v) => setJobForm({ ...jobForm, openings_count: v })} />
                <TextArea label="Descripción" value={jobForm.description} onChange={(v) => setJobForm({ ...jobForm, description: v })} />
                <TextArea label="Requisitos" value={jobForm.requirements} onChange={(v) => setJobForm({ ...jobForm, requirements: v })} />
                <button onClick={createJob} className="rounded-2xl bg-blue-600 px-4 py-3 font-black hover:bg-blue-500">
                  Crear vacante
                </button>
              </div>
            </Panel>

            <Panel title="Vacantes creadas" icon={<Briefcase size={20} />}>
              <div className="grid gap-3">
                {filteredJobs.map((j) => (
                  <div key={j.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-black">{j.code} · {j.title}</p>
                        <p className="text-xs text-slate-400">{j.department} · {j.position_title} · {j.location}</p>
                        <p className="mt-2 text-sm text-emerald-300">{money(j.min_salary)} - {money(j.max_salary)}</p>
                        <p className="mt-2 text-sm text-slate-300">{j.responsibilities || "Sin descripción"}</p>
                      </div>
                      <StatusBadge status={j.status || "abierta"} />
                    </div>
                  </div>
                ))}
                {!filteredJobs.length && <p className="text-sm text-slate-400">No hay vacantes.</p>}
              </div>
            </Panel>
          </section>
        )}

        {tab === "candidatos" && (
          <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
            <Panel title="Nuevo candidato" icon={<UserPlus size={20} />}>
              <div className="grid gap-3">
                <Input label="Nombre completo" value={candidateForm.full_name} onChange={(v) => setCandidateForm({ ...candidateForm, full_name: v })} />
                <Input label="Cédula" value={candidateForm.identification} onChange={(v) => setCandidateForm({ ...candidateForm, identification: v })} />
                <Input label="Teléfono" value={candidateForm.phone} onChange={(v) => setCandidateForm({ ...candidateForm, phone: v })} />
                <Input label="Email" value={candidateForm.email} onChange={(v) => setCandidateForm({ ...candidateForm, email: v })} />
                <Input label="Puesto deseado" value={candidateForm.desired_position} onChange={(v) => setCandidateForm({ ...candidateForm, desired_position: v })} />
                <Input label="Empresa actual" value={candidateForm.current_company} onChange={(v) => setCandidateForm({ ...candidateForm, current_company: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Años exp." value={candidateForm.years_experience} onChange={(v) => setCandidateForm({ ...candidateForm, years_experience: v })} />
                  <Input label="Salario esperado" value={candidateForm.expected_salary} onChange={(v) => setCandidateForm({ ...candidateForm, expected_salary: v })} />
                </div>
                <Input label="CV URL" value={candidateForm.cv_url} onChange={(v) => setCandidateForm({ ...candidateForm, cv_url: v })} />
                <TextArea label="Notas" value={candidateForm.notes} onChange={(v) => setCandidateForm({ ...candidateForm, notes: v })} />
                <button onClick={createCandidate} className="rounded-2xl bg-blue-600 px-4 py-3 font-black hover:bg-blue-500">
                  Crear candidato
                </button>
              </div>
            </Panel>

            <Panel title="Base de candidatos" icon={<Users size={20} />}>
              <div className="grid gap-3">
                {filteredCandidates.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-black">{c.candidate_code} · {c.full_name}</p>
                        <p className="text-xs text-slate-400">{c.phone} · {c.email}</p>
                        <p className="mt-2 text-sm">{c.current_position || "-"} · {c.years_experience || 0} años exp.</p>
                        <p className="text-sm text-emerald-300">Pretensión: {money(c.expected_salary)}</p>
                      </div>
                      <StatusBadge status={c.status || "activo"} />
                    </div>
                  </div>
                ))}
                {!filteredCandidates.length && <p className="text-sm text-slate-400">No hay candidatos.</p>}
              </div>
            </Panel>
          </section>
        )}

        {tab === "pipeline" && (
          <section className="grid gap-4">
            <Panel title="Nueva aplicación" icon={<Plus size={20} />}>
              <div className="grid gap-3 lg:grid-cols-6">
                <Select label="Vacante" value={applicationForm.job_opening_id} onChange={(v) => setApplicationForm({ ...applicationForm, job_opening_id: v })}>
                  <option value="">Seleccionar...</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.code} · {j.title}</option>)}
                </Select>
                <Select label="Candidato" value={applicationForm.candidate_id} onChange={(v) => setApplicationForm({ ...applicationForm, candidate_id: v })}>
                  <option value="">Seleccionar...</option>
                  {candidates.filter((c) => c.status === "activo").map((c) => <option key={c.id} value={c.id}>{c.candidate_code} · {c.full_name}</option>)}
                </Select>
                <Input label="Fit" value={applicationForm.fit_score} onChange={(v) => setApplicationForm({ ...applicationForm, fit_score: v })} />
                <Input label="Técnico" value={applicationForm.technical_score} onChange={(v) => setApplicationForm({ ...applicationForm, technical_score: v })} />
                <Input label="Cultura" value={applicationForm.culture_score} onChange={(v) => setApplicationForm({ ...applicationForm, culture_score: v })} />
                <button onClick={createApplication} className="self-end rounded-2xl bg-blue-600 px-4 py-3 font-black hover:bg-blue-500">
                  Aplicar
                </button>
              </div>
            </Panel>

            <div className="grid gap-4 xl:grid-cols-7">
              {stages.map((stage) => (
                <div key={stage.id} className="rounded-3xl border border-white/10 bg-white/5 p-3">
                  <h3 className="mb-3 text-sm font-black">{stage.label}</h3>
                  <div className="space-y-3">
                    {applications.filter((a) => a.stage === stage.id).map((a) => (
                      <AppCard key={a.id} app={a} onMove={moveStage} onHire={hireCandidate} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "entrevistas" && (
          <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
            <Panel title="Programar entrevista" icon={<CalendarClock size={20} />}>
              <div className="grid gap-3">
                <Select label="Aplicación" value={interviewForm.application_id} onChange={(v) => setInterviewForm({ ...interviewForm, application_id: v })}>
                  <option value="">Seleccionar...</option>
                  {applications.map((a) => <option key={a.id} value={a.id}>{a.candidate_name} · {a.job_title}</option>)}
                </Select>
                <Input label="Fecha y hora" type="datetime-local" value={interviewForm.interview_date} onChange={(v) => setInterviewForm({ ...interviewForm, interview_date: v })} />
                <Input label="Entrevistador" value={interviewForm.interviewer} onChange={(v) => setInterviewForm({ ...interviewForm, interviewer: v })} />
                <Select label="Tipo" value={interviewForm.interview_type} onChange={(v) => setInterviewForm({ ...interviewForm, interview_type: v })}>
                  <option value="presencial">Presencial</option>
                  <option value="telefono">Teléfono</option>
                  <option value="video">Video</option>
                  <option value="prueba_tecnica">Prueba técnica</option>
                  <option value="otro">Otro</option>
                </Select>
                <TextArea label="Notas" value={interviewForm.notes} onChange={(v) => setInterviewForm({ ...interviewForm, notes: v })} />
                <button onClick={createInterview} className="rounded-2xl bg-blue-600 px-4 py-3 font-black hover:bg-blue-500">
                  Programar
                </button>
              </div>
            </Panel>

            <Panel title="Entrevistas" icon={<CalendarClock size={20} />}>
              <div className="space-y-3">
                {interviews.map((i) => {
                  const app = applications.find((a) => a.id === i.application_id);
                  return (
                    <div key={i.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-black">{app?.candidate_name || "Candidato"}</p>
                          <p className="text-xs text-slate-400">{app?.job_title || "-"} · {i.interview_type}</p>
                          <p className="mt-2 text-sm">{new Date(i.interview_date).toLocaleString("es-DO")}</p>
                          <p className="text-sm text-slate-300">{i.interviewer || "-"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge status={i.status || "programada"} />
                          {i.status === "programada" && (
                            <button onClick={() => markInterviewDone(i.id)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold hover:bg-emerald-500">
                              Completar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!interviews.length && <p className="text-sm text-slate-400">No hay entrevistas.</p>}
              </div>
            </Panel>
          </section>
        )}

        {tab === "evaluaciones" && (
          <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
            <Panel title="Evaluar candidato" icon={<Star size={20} />}>
              <div className="grid gap-3">
                <Select label="Aplicación" value={evaluationForm.application_id} onChange={(v) => setEvaluationForm({ ...evaluationForm, application_id: v })}>
                  <option value="">Seleccionar...</option>
                  {applications.map((a) => <option key={a.id} value={a.id}>{a.candidate_name} · {a.job_title}</option>)}
                </Select>
                <Input label="Evaluador" value={evaluationForm.evaluator} onChange={(v) => setEvaluationForm({ ...evaluationForm, evaluator: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Técnico" value={evaluationForm.technical_score} onChange={(v) => setEvaluationForm({ ...evaluationForm, technical_score: v })} />
                  <Input label="Experiencia" value={evaluationForm.experience_score} onChange={(v) => setEvaluationForm({ ...evaluationForm, experience_score: v })} />
                  <Input label="Actitud" value={evaluationForm.attitude_score} onChange={(v) => setEvaluationForm({ ...evaluationForm, attitude_score: v })} />
                  <Input label="Cultura" value={evaluationForm.culture_score} onChange={(v) => setEvaluationForm({ ...evaluationForm, culture_score: v })} />
                  <Input label="Comunicación" value={evaluationForm.communication_score} onChange={(v) => setEvaluationForm({ ...evaluationForm, communication_score: v })} />
                </div>
                <TextArea label="Fortalezas" value={evaluationForm.strengths} onChange={(v) => setEvaluationForm({ ...evaluationForm, strengths: v })} />
                <TextArea label="Debilidades" value={evaluationForm.weaknesses} onChange={(v) => setEvaluationForm({ ...evaluationForm, weaknesses: v })} />
                <TextArea label="Recomendación" value={evaluationForm.recommendation} onChange={(v) => setEvaluationForm({ ...evaluationForm, recommendation: v })} />
                <button onClick={createEvaluation} className="rounded-2xl bg-blue-600 px-4 py-3 font-black hover:bg-blue-500">
                  Guardar evaluación
                </button>
              </div>
            </Panel>

            <Panel title="Aplicaciones evaluadas" icon={<Star size={20} />}>
              <div className="space-y-3">
                {applications
                  .slice()
                  .sort((a, b) => Number(b.final_score || 0) - Number(a.final_score || 0))
                  .map((a) => (
                    <AppCard key={a.id} app={a} onMove={moveStage} onHire={hireCandidate} />
                  ))}
              </div>
            </Panel>
          </section>
        )}
      </div>
    </main>
  );
}

function AppCard({
  app,
  onMove,
  onHire,
}: {
  app: Application;
  onMove: (id: string, stage: string) => void;
  onHire: (app: Application) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <p className="font-black">{app.candidate_name}</p>
      <p className="text-xs text-slate-400">{app.candidate_code} · {app.job_title}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <SmallStat label="Score" value={Number(app.final_score || 0).toFixed(1)} />
        <SmallStat label="Exp." value={`${app.years_experience || 0} años`} />
        <SmallStat label="Pretensión" value={money(app.candidate_expected_salary)} />
        <SmallStat label="Entrev." value={String(app.interviews_count || 0)} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={app.stage}
          onChange={(e) => onMove(app.id, e.target.value)}
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs outline-none"
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        {app.stage !== "contratado" && (
          <button
            onClick={() => onHire(app)}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold hover:bg-emerald-500"
          >
            <CheckCircle2 size={14} />
            Contratar
          </button>
        )}

        {app.stage !== "rechazado" && (
          <button
            onClick={() => onMove(app.id, "rechazado")}
            className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold hover:bg-red-500"
          >
            <XCircle size={14} />
            Rechazar
          </button>
        )}
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

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-400"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-24 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-400"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-400"
      >
        {children}
      </select>
    </label>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <p className="text-slate-400">{label}</p>
      <p className="font-black">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "abierta" || status === "activo" || status === "programada"
      ? "bg-emerald-500/15 text-emerald-300"
      : status === "cerrada" || status === "contratado" || status === "completada"
      ? "bg-blue-500/15 text-blue-300"
      : status === "rechazado" || status === "cancelada" || status === "no_asistio"
      ? "bg-red-500/15 text-red-300"
      : "bg-amber-500/15 text-amber-300";

  return <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>{status}</span>;
}
