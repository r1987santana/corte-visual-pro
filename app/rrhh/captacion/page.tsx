"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileText,
  Link2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type JobOpening = {
  id: string;
  code?: string | null;
  title: string;
  department?: string | null;
  position_title?: string | null;
  employment_type?: string | null;
  location?: string | null;
  priority?: string | null;
  status?: string | null;
  min_salary?: number | null;
  max_salary?: number | null;
  created_at?: string | null;
};

type Candidate = {
  id: string;
  candidate_code?: string | null;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  current_position?: string | null;
  years_experience?: number | null;
  expected_salary?: number | null;
  city?: string | null;
  cv_url?: string | null;
  portfolio_url?: string | null;
  status?: string | null;
  ai_score?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

type Application = {
  id: string;
  job_code?: string | null;
  job_title?: string | null;
  candidate_code?: string | null;
  candidate_name?: string | null;
  candidate_phone?: string | null;
  candidate_email?: string | null;
  stage?: string | null;
  status?: string | null;
  final_score?: number | null;
  match_score?: number | null;
  applied_at?: string | null;
};

type Employee = {
  id: string;
  full_name: string;
  identification?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  position?: string | null;
  department?: string | null;
  hire_date?: string | null;
  birth_date?: string | null;
  salary?: number | null;
  salary_type?: string | null;
  hourly_rate?: number | null;
  bank_name?: string | null;
  bank_account?: string | null;
  payment_method?: string | null;
  status?: string | null;
};

type EmployeeDocument = {
  employee_id: string;
};

function money(value?: number | null) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function date(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-DO");
}

function statusTone(value?: string | null) {
  const current = String(value || "").toLowerCase();
  if (current.includes("activo") || current.includes("abierta") || current.includes("nuevo")) {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  }
  if (current.includes("rechaz") || current.includes("cerrada") || current.includes("inactivo")) {
    return "border-red-400/30 bg-red-500/10 text-red-200";
  }
  return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
}

export default function RRHHCaptacionPage() {
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [search, setSearch] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPublicUrl(`${window.location.origin}/trabaja-con-nosotros`);
    }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const [jobsRes, candRes, appRes, empRes, docRes] = await Promise.all([
        supabase.from("hr_job_openings").select("*").order("created_at", { ascending: false }),
        supabase.from("hr_candidates").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("v_hr_applications_detail").select("*").order("applied_at", { ascending: false }).limit(300),
        supabase.from("employees").select("*").order("full_name", { ascending: true }),
        supabase.from("employee_documents").select("employee_id"),
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (candRes.error) throw candRes.error;
      if (appRes.error) throw appRes.error;
      if (empRes.error) throw empRes.error;

      setJobs((jobsRes.data || []) as JobOpening[]);
      setCandidates((candRes.data || []) as Candidate[]);
      setApplications((appRes.data || []) as Application[]);
      setEmployees((empRes.data || []) as Employee[]);
      setDocuments(docRes.error ? [] : ((docRes.data || []) as EmployeeDocument[]));
      setMessage("Captacion RRHH actualizada.");
    } catch (error: any) {
      setMessage(error?.message || "No se pudo cargar captacion RRHH.");
    } finally {
      setLoading(false);
    }
  }

  async function copyPublicUrl() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setMessage("Link publico copiado.");
  }

  async function updateCandidateStatus(candidate: Candidate, status: string) {
    const { error } = await supabase.from("hr_candidates").update({ status }).eq("id", candidate.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`Candidato marcado como ${status}.`);
    await loadData();
  }

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((candidate) =>
      [
        candidate.candidate_code,
        candidate.full_name,
        candidate.email,
        candidate.phone,
        candidate.current_position,
        candidate.source,
        candidate.city,
        candidate.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [candidates, search]);

  const stats = useMemo(() => {
    const openJobs = jobs.filter((job) => String(job.status || "").toLowerCase() === "abierta").length;
    const portalCandidates = candidates.filter((candidate) => candidate.source === "portal_candidatos").length;
    const activeCandidates = candidates.filter((candidate) => !String(candidate.status || "activo").toLowerCase().includes("inactivo")).length;
    const newApplications = applications.filter((application) => String(application.stage || "").toLowerCase().includes("nuevo")).length;
    const docs = new Set(documents.map((doc) => doc.employee_id));

    const activeEmployees = employees.filter((employee) => !String(employee.status || "activo").toLowerCase().includes("inactivo"));
    const employeeReady = activeEmployees.filter((employee) => {
      const identity = Boolean(employee.identification && (employee.phone || employee.email) && employee.address);
      const emergency = Boolean(employee.emergency_contact && employee.emergency_phone);
      const labor = Boolean(employee.department && employee.position && employee.hire_date);
      const payroll = Boolean(Number(employee.salary || employee.hourly_rate || 0) > 0 && (employee.payment_method || employee.bank_name || employee.bank_account));
      return identity && emergency && labor && payroll && docs.has(employee.id);
    }).length;

    return {
      openJobs,
      portalCandidates,
      activeCandidates,
      newApplications,
      employees: activeEmployees.length,
      employeeReady,
      employeeReadyRate: activeEmployees.length ? Math.round((employeeReady / activeEmployees.length) * 100) : 0,
    };
  }, [applications, candidates, documents, employees, jobs]);

  const employeeChecklist = [
    "Identidad: nombre, cedula/documento, telefono, correo y direccion.",
    "Emergencia: contacto y telefono de emergencia.",
    "Laboral: cargo, departamento, fecha de entrada, estado, supervisor en tabla.",
    "Nomina: salario, tipo de salario, tarifa por hora, metodo de pago, banco y cuenta.",
    "Control: QR, PIN, foto, rostro, asistencia, vacaciones, evaluaciones y documentos.",
  ];

  return (
    <main className="min-h-screen bg-[#020817] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-[28px] border border-cyan-400/20 bg-[#0b1830] p-6 shadow-2xl shadow-black/35">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
                <UserPlus size={15} />
                Maestro de captacion
              </div>
              <h1 className="text-4xl font-black lg:text-5xl">Captar colaboradores</h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold text-slate-300">
                Link publico para alimentar candidatos, revisar banco de talentos y validar que el expediente del colaborador este completo.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={copyPublicUrl} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-400">
                <Clipboard size={18} />
                Copiar link
              </button>
              <a href={publicUrl || "/trabaja-con-nosotros"} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-black text-white hover:bg-white/10">
                <ExternalLink size={18} />
                Abrir formulario
              </a>
              <button onClick={loadData} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-black text-white hover:bg-white/10 disabled:opacity-60">
                <RefreshCw className={loading ? "animate-spin" : ""} size={18} />
                Actualizar
              </button>
              <Link href="/rrhh-ats" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-500/20">
                <BriefcaseBusiness size={18} />
                Abrir ATS
              </Link>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-700 bg-[#07111f] px-4 py-3 text-sm font-bold text-cyan-100">
            <Link2 className="mr-2 inline" size={16} />
            {publicUrl || "/trabaja-con-nosotros"}
          </div>
        </section>

        {message && (
          <div className="mb-4 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-100">
            {message}
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Kpi title="Vacantes abiertas" value={stats.openJobs} icon={<BriefcaseBusiness size={20} />} />
          <Kpi title="Candidatos activos" value={stats.activeCandidates} icon={<Users size={20} />} />
          <Kpi title="Desde link" value={stats.portalCandidates} icon={<Link2 size={20} />} />
          <Kpi title="Aplicaciones nuevas" value={stats.newApplications} icon={<FileText size={20} />} />
          <Kpi title="Empleados activos" value={stats.employees} icon={<Users size={20} />} />
          <Kpi title="Expediente listo" value={`${stats.employeeReadyRate}%`} icon={<ShieldCheck size={20} />} />
        </section>

        <section className="mb-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Verificacion del maestro de empleados" icon={<ShieldCheck size={20} />}>
            <div className="space-y-3">
              {employeeChecklist.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-[#07111f] p-3">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={18} />
                  <p className="text-sm font-bold text-slate-200">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
              Recomendacion: mantener documentos, cuenta bancaria, emergencia y rostro/QR completos antes de activar nomina y asistencia.
            </div>
          </Panel>

          <Panel title="Vacantes activas para el link" icon={<BriefcaseBusiness size={20} />}>
            <div className="space-y-3">
              {jobs.filter((job) => String(job.status || "").toLowerCase() === "abierta").slice(0, 8).map((job) => (
                <div key={job.id} className="rounded-2xl border border-white/10 bg-[#07111f] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{job.code || "VAC"} · {job.title}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{job.department || "Area"} · {job.location || "Ubicacion"} · {money(job.min_salary)} {job.max_salary ? `a ${money(job.max_salary)}` : ""}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(job.status)}`}>{job.status || "abierta"}</span>
                  </div>
                </div>
              ))}
              {!jobs.filter((job) => String(job.status || "").toLowerCase() === "abierta").length && (
                <p className="text-sm font-bold text-slate-400">No hay vacantes abiertas. El link queda como banco de talentos general.</p>
              )}
            </div>
          </Panel>
        </section>

        <Panel title="Banco de talentos" icon={<Users size={20} />}>
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#07111f] px-3 py-2">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar candidato, telefono, puesto, fuente..."
              className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {filteredCandidates.map((candidate) => (
              <div key={candidate.id} className="rounded-2xl border border-white/10 bg-[#07111f] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-black">{candidate.candidate_code || "CAND"} · {candidate.full_name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {candidate.current_position || "Puesto no indicado"} · {candidate.years_experience || 0} anos · {candidate.city || "Ciudad N/D"}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-300">{candidate.phone || "-"} · {candidate.email || "-"}</p>
                    <p className="mt-1 text-xs text-slate-500">Fuente: {candidate.source || "manual"} · {date(candidate.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 text-right">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(candidate.status)}`}>{candidate.status || "activo"}</span>
                    {candidate.cv_url && (
                      <a href={candidate.cv_url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-cyan-200 hover:bg-white/10">
                        Ver CV
                      </a>
                    )}
                    <button onClick={() => updateCandidateStatus(candidate, "preseleccion")} className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black text-white hover:bg-cyan-500">
                      Preseleccionar
                    </button>
                    <button onClick={() => updateCandidateStatus(candidate, "descartado")} className="rounded-xl border border-red-400/25 px-3 py-2 text-xs font-black text-red-200 hover:bg-red-500/10">
                      Descartar
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!filteredCandidates.length && <p className="text-sm font-bold text-slate-400">No hay candidatos para mostrar.</p>}
          </div>
        </Panel>
      </div>
    </main>
  );
}

function Kpi({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b1830] p-4 shadow-xl">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-200">{icon}</div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#0b1830] p-5 shadow-2xl shadow-black/25">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-200">{icon}</div>
        <h2 className="text-xl font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}
