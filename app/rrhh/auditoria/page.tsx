"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  FileText,
  Fingerprint,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { analyzeRrhhAudit, type RrhhIssue } from "@/lib/rrhh/rrhh-audit";

type LoadState = {
  employees: any[];
  documents: any[];
  attendanceEvents: any[];
  payrollRuns: any[];
  payrollItems: any[];
};

const emptyState: LoadState = {
  employees: [],
  documents: [],
  attendanceEvents: [],
  payrollRuns: [],
  payrollItems: [],
};

async function safeSelect(table: string, limit = 1000) {
  try {
    const { data, error } = await supabase.from(table).select("*").limit(limit);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

function money(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function severityTone(severity: RrhhIssue["severity"]) {
  if (severity === "critical") return "border-red-400/35 bg-red-500/10 text-red-100";
  if (severity === "warning") return "border-amber-400/35 bg-amber-500/10 text-amber-100";
  return "border-cyan-400/35 bg-cyan-500/10 text-cyan-100";
}

export default function RrhhAuditoriaPage() {
  const [state, setState] = useState<LoadState>(emptyState);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  async function loadData() {
    setLoading(true);
    const [employees, documents, attendanceEvents, payrollRuns, payrollItems] = await Promise.all([
      safeSelect("employees"),
      safeSelect("employee_documents"),
      safeSelect("employee_attendance_events"),
      safeSelect("payroll_runs"),
      safeSelect("payroll_run_items"),
    ]);
    setState({ employees, documents, attendanceEvents, payrollRuns, payrollItems });
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const audit = useMemo(() => analyzeRrhhAudit(state), [state]);

  const salaryBase = useMemo(
    () =>
      state.employees
        .filter((employee) => String(employee.status || "activo").toLowerCase() !== "inactivo")
        .reduce((sum, employee) => sum + Number(employee.salary || 0), 0),
    [state.employees],
  );

  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return audit.issues;
    return audit.issues.filter((issue) =>
      `${issue.area} ${issue.title} ${issue.detail} ${issue.action}`.toLowerCase().includes(q),
    );
  }, [audit.issues, search]);

  return (
    <main className="min-h-screen bg-[#020817] p-4 text-white md:p-6">
      <div className="mx-auto w-full max-w-[1760px] space-y-5">
        <section className="rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-[#081421] via-[#0b1830] to-[#111b3f] p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.30em] text-cyan-300">
                <ShieldCheck size={14} /> RRHH AUDIT
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                Auditoria RRHH Blindada
              </h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-300">
                Empleados, expedientes, asistencia facial y nomina revisados contra riesgos operativos.
              </p>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-5 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              Actualizar
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Kpi title="Blindaje RRHH" value={`${audit.score}%`} icon={<ShieldCheck />} tone={audit.score >= 80 ? "green" : "amber"} />
          <Kpi title="Empleados activos" value={audit.metrics.activeEmployees} icon={<Users />} tone="cyan" />
          <Kpi title="Nomina base" value={money(salaryBase)} icon={<Banknote />} tone="green" />
          <Kpi title="Sin banco" value={audit.metrics.missingBank} icon={<AlertTriangle />} tone={audit.metrics.missingBank ? "amber" : "green"} />
          <Kpi title="Sin documentos" value={audit.metrics.missingDocs} icon={<FileText />} tone={audit.metrics.missingDocs ? "amber" : "green"} />
          <Kpi title="Alertas criticas" value={audit.metrics.payrollMismatch + audit.issues.filter((i) => i.severity === "critical").length} icon={<Fingerprint />} tone={audit.issues.some((i) => i.severity === "critical") ? "red" : "green"} />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black">Hallazgos</h2>
                <p className="text-sm text-slate-400">{filteredIssues.length} alerta(s) filtrada(s)</p>
              </div>
              <div className="relative w-full lg:w-[360px]">
                <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar alerta..."
                  className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] pl-11 pr-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="max-h-[720px] space-y-3 overflow-auto pr-1">
              {filteredIssues.map((issue, index) => (
                <div key={`${issue.title}-${index}`} className={`rounded-2xl border p-4 ${severityTone(issue.severity)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="rounded-full border border-current/25 px-3 py-1 text-[11px] font-black uppercase">
                      {issue.severity}
                    </span>
                    <span className="text-xs font-black uppercase tracking-[0.22em] opacity-80">{issue.area}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-black">{issue.title}</h3>
                  <p className="mt-1 text-sm opacity-90">{issue.detail}</p>
                  <p className="mt-3 rounded-xl border border-current/15 bg-black/20 p-3 text-xs font-bold">{issue.action}</p>
                </div>
              ))}

              {!filteredIssues.length ? (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-8 text-center text-emerald-100">
                  <CheckCircle2 className="mx-auto mb-3" size={42} />
                  <p className="font-black">Sin hallazgos para este filtro.</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <Panel title="Controles obligatorios" icon={<ShieldCheck className="text-cyan-300" />}>
              {audit.recommendations.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-800 bg-[#030817] p-4 text-sm font-bold text-slate-200">
                  {item}
                </div>
              ))}
            </Panel>

            <Panel title="Lectura operativa" icon={<Fingerprint className="text-cyan-300" />}>
              <Line label="Eventos asistencia" value={String(audit.metrics.attendanceEvents)} />
              <Line label="Eventos baja confianza" value={String(audit.metrics.lowConfidenceEvents)} />
              <Line label="Corridas nomina" value={String(audit.metrics.payrollRuns)} />
              <Line label="Nominas descuadradas" value={String(audit.metrics.payrollMismatch)} danger={audit.metrics.payrollMismatch > 0} />
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

function Kpi({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  tone: "cyan" | "green" | "amber" | "red";
}) {
  const tones = {
    cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-300",
    green: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-400/25 bg-amber-500/10 text-amber-300",
    red: "border-red-400/25 bg-red-500/10 text-red-300",
  };
  return (
    <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] via-[#07111f] to-[#030817] p-5 shadow-xl shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{title}</p>
          <h3 className="mt-3 text-2xl font-black text-white">{value}</h3>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${tones[tone]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
      <div className="mb-5 flex items-center gap-3">
        {icon}
        <h2 className="text-2xl font-black">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Line({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#030817] p-4 text-sm">
      <span className="font-bold text-slate-400">{label}</span>
      <span className={`font-black ${danger ? "text-red-300" : "text-white"}`}>{value}</span>
    </div>
  );
}
