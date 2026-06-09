"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  FileUp,
  Loader2,
  Mail,
  Phone,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type JobOpening = {
  id: string;
  code?: string | null;
  title: string;
  department?: string | null;
  position_title?: string | null;
  employment_type?: string | null;
  location?: string | null;
  status?: string | null;
  min_salary?: number | null;
  max_salary?: number | null;
  requirements?: string | null;
  benefits?: string | null;
};

type SubmitState = "idle" | "sending" | "success" | "error";

const initialForm = {
  job_opening_id: "",
  full_name: "",
  phone: "",
  email: "",
  city: "",
  address: "",
  desired_position: "",
  current_position: "",
  years_experience: "0",
  expected_salary: "",
  availability: "",
  schedule: "",
  education_level: "",
  skills: "",
  portfolio_url: "",
  cv_url: "",
  reference_name: "",
  reference_phone: "",
  notes: "",
  website: "",
};

const CITY_OPTIONS = [
  "La Romana",
  "Santo Domingo",
  "Santo Domingo Este",
  "Santo Domingo Norte",
  "Santo Domingo Oeste",
  "Distrito Nacional",
  "San Pedro de Macoris",
  "Higuey",
  "Bavaro / Punta Cana",
  "El Seibo",
  "Hato Mayor",
  "Boca Chica",
  "Juan Dolio",
  "San Cristobal",
  "Santiago",
  "Otra ciudad",
];

const EXPERIENCE_OPTIONS = [
  { value: "0", label: "Sin experiencia / aprendiz" },
  { value: "1", label: "1 ano" },
  { value: "2", label: "2 anos" },
  { value: "3", label: "3 anos" },
  { value: "4", label: "4 anos" },
  { value: "5", label: "5 anos" },
  { value: "6", label: "6 anos" },
  { value: "7", label: "7 anos" },
  { value: "8", label: "8 anos" },
  { value: "9", label: "9 anos" },
  { value: "10", label: "10 anos o mas" },
  { value: "15", label: "15 anos o mas" },
  { value: "20", label: "20 anos o mas" },
];

const POSITION_OPTIONS = [
  "Ayudante general / aprendiz",
  "Instalador de muebles",
  "Canteador",
  "Operador CNC",
  "Carpintero / ebanista",
  "Ensamblador",
  "Terminador / pintor",
  "Disenador / renderista",
  "Medidor / levantamiento",
  "Cotizador",
  "Vendedor",
  "Almacen / inventario",
  "Compras",
  "Logistica / chofer",
  "Servicio al cliente / postventa",
  "Supervisor de produccion",
  "Administracion / contabilidad",
  "Recursos humanos",
];

function money(value?: number | null) {
  if (!value) return "";
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function jobPositionLabel(job: JobOpening) {
  return (job.position_title || job.title || "").trim();
}

export default function TrabajaConNosotrosPage() {
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [form, setForm] = useState(initialForm);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadJobs() {
      try {
        setLoadingJobs(true);
        const res = await fetch("/api/hr/candidate-intake", { cache: "no-store" });
        const payload = await res.json();
        if (!payload.ok) throw new Error(payload.error || "No se pudieron cargar las vacantes.");
        setJobs(payload.jobs || []);
      } catch (error: any) {
        setMessage(error?.message || "No se pudieron cargar las vacantes.");
      } finally {
        setLoadingJobs(false);
      }
    }

    loadJobs();
  }, []);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === form.job_opening_id) || null, [jobs, form.job_opening_id]);
  const desiredPositionOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];

    function add(value?: string | null, label?: string) {
      const cleanValue = String(value || "").trim();
      if (!cleanValue) return;
      const key = cleanValue.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push({ value: cleanValue, label: label || cleanValue });
    }

    POSITION_OPTIONS.forEach((position) => add(position));
    jobs.forEach((job) => {
      const position = jobPositionLabel(job);
      const detail = [job.department, job.location].filter(Boolean).join(" - ");
      add(position, detail ? `${position} (${detail})` : position);
    });

    return options;
  }, [jobs]);

  function update(key: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateJobOpening(value: string) {
    const job = jobs.find((item) => item.id === value);
    setForm((current) => ({
      ...current,
      job_opening_id: value,
      desired_position: job ? jobPositionLabel(job) : current.desired_position,
    }));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitState("sending");
    setMessage("");

    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      if (cvFile) payload.append("cv_file", cvFile);

      const res = await fetch("/api/hr/candidate-intake", {
        method: "POST",
        body: payload,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo enviar la solicitud.");

      setSubmitState("success");
      setMessage(data.message || "Solicitud recibida. RRHH revisara tu perfil.");
      setForm(initialForm);
      setCvFile(null);
    } catch (error: any) {
      setSubmitState("error");
      setMessage(error?.message || "No se pudo enviar la solicitud.");
    }
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <section className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[0.9fr_1.25fr] lg:px-8">
        <aside className="flex flex-col justify-between rounded-[28px] border border-cyan-400/20 bg-[#0b1830] p-6 shadow-2xl shadow-black/40">
          <div>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-200">
              <ShieldCheck size={15} />
              Captacion RRHH
            </div>

            <h1 className="text-4xl font-black leading-tight lg:text-6xl">Trabaja con RD Wood System</h1>
            <p className="mt-4 max-w-xl text-base font-semibold text-slate-300">
              Completa tu perfil laboral para entrar al banco de talentos. RRHH revisa cada solicitud y te contacta cuando haya una oportunidad compatible.
            </p>

            <div className="mt-8 grid gap-3">
              <Info icon={<BriefcaseBusiness size={18} />} title="Vacantes activas" value={loadingJobs ? "Cargando" : String(jobs.length)} />
              <Info icon={<UserRound size={18} />} title="Perfil completo" value="Datos, experiencia y CV" />
              <Info icon={<Phone size={18} />} title="Contacto" value="Telefono o correo requerido" />
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
            Tu informacion se usa solo para procesos de seleccion y contacto laboral.
          </div>
        </aside>

        <form onSubmit={submit} className="rounded-[28px] border border-white/10 bg-[#0f172a] p-5 shadow-2xl shadow-black/35 lg:p-6">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Solicitud de colaborador</p>
              <h2 className="mt-2 text-2xl font-black">Registro de candidato</h2>
            </div>
            {submitState === "success" && (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-200">
                <CheckCircle2 size={17} />
                Recibido
              </span>
            )}
          </div>

          {message && (
            <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold ${submitState === "error" ? "border-red-400/30 bg-red-500/10 text-red-100" : "border-cyan-400/25 bg-cyan-500/10 text-cyan-100"}`}>
              {message}
            </div>
          )}

          <div className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Select label="Vacante de interes" value={form.job_opening_id} onChange={updateJobOpening}>
                <option value="">Banco de talentos general</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.code ? `${job.code} - ` : ""}{job.title}
                  </option>
                ))}
              </Select>
              <Select required label="Puesto deseado" value={form.desired_position} onChange={(value) => update("desired_position", value)}>
                <option value="">Selecciona el puesto que buscas...</option>
                {desiredPositionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            {selectedJob && (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                <p className="font-black text-cyan-100">{selectedJob.title}</p>
                <p className="mt-1 text-xs font-bold text-slate-300">
                  {selectedJob.department || "Area"} · {selectedJob.location || "Ubicacion por confirmar"} · {money(selectedJob.min_salary)} {selectedJob.max_salary ? `a ${money(selectedJob.max_salary)}` : ""}
                </p>
                {selectedJob.requirements && <p className="mt-2 text-sm text-slate-300">{selectedJob.requirements}</p>}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <Input required label="Nombre completo" value={form.full_name} onChange={(value) => update("full_name", value)} />
              <Select required label="Ciudad" value={form.city} onChange={(value) => update("city", value)}>
                <option value="">Selecciona tu ciudad...</option>
                {CITY_OPTIONS.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
              <Input label="Telefono / WhatsApp" value={form.phone} onChange={(value) => update("phone", value)} icon={<Phone size={16} />} />
              <Input label="Correo" type="email" value={form.email} onChange={(value) => update("email", value)} icon={<Mail size={16} />} />
              <Input label="Cargo actual o ultimo" value={form.current_position} onChange={(value) => update("current_position", value)} />
              <Select label="Anios de experiencia" value={form.years_experience} onChange={(value) => update("years_experience", value)}>
                {EXPERIENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input label="Salario esperado" type="number" value={form.expected_salary} onChange={(value) => update("expected_salary", value)} />
              <Input label="Disponibilidad" value={form.availability} onChange={(value) => update("availability", value)} placeholder="Inmediata, 15 dias..." />
              <Input label="Direccion" value={form.address} onChange={(value) => update("address", value)} />
              <Input label="Horario disponible" value={form.schedule} onChange={(value) => update("schedule", value)} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TextArea label="Nivel academico / certificaciones" value={form.education_level} onChange={(value) => update("education_level", value)} />
              <TextArea label="Habilidades principales" value={form.skills} onChange={(value) => update("skills", value)} placeholder="CNC, canteo, melamina, ventas, instalacion..." />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Input label="Portafolio / LinkedIn" value={form.portfolio_url} onChange={(value) => update("portfolio_url", value)} />
              <Input label="Link CV externo" value={form.cv_url} onChange={(value) => update("cv_url", value)} />
            </div>

            <label className="rounded-2xl border border-dashed border-slate-600 bg-[#07111f] p-4">
              <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                <FileUp size={16} />
                Subir CV PDF o imagen
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(event) => setCvFile(event.target.files?.[0] || null)}
                className="w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:font-black file:text-slate-950"
              />
              {cvFile && <p className="mt-2 text-xs font-bold text-emerald-200">{cvFile.name}</p>}
            </label>

            <div className="grid gap-4 lg:grid-cols-2">
              <Input label="Referencia laboral" value={form.reference_name} onChange={(value) => update("reference_name", value)} />
              <Input label="Telefono referencia" value={form.reference_phone} onChange={(value) => update("reference_phone", value)} />
            </div>

            <TextArea label="Cuéntanos por qué quieres trabajar con nosotros" value={form.notes} onChange={(value) => update("notes", value)} />

            <input className="hidden" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update("website", event.target.value)} />

            <button
              type="submit"
              disabled={submitState === "sending"}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-4 text-base font-black text-slate-950 shadow-lg shadow-cyan-950/40 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-60"
            >
              {submitState === "sending" ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              Enviar solicitud
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Info({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-200">{icon}</div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-1 font-black text-white">{value}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
        {icon}
        {label}
      </span>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-700 bg-[#07111f] px-4 py-3 font-bold text-white outline-none transition focus:border-cyan-400"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-[#07111f] px-4 py-3 font-bold text-white outline-none transition focus:border-cyan-400"
      >
        {children}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-[112px] w-full resize-y rounded-2xl border border-slate-700 bg-[#07111f] px-4 py-3 font-bold text-white outline-none transition focus:border-cyan-400"
      />
    </label>
  );
}
