"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Tab = "dashboard" | "matriz" | "documentos" | "alertas" | "auditorias" | "requisitos";

type Dashboard = {
  active_requirements: number;
  employee_documents: number;
  compliant_documents: number;
  pending_documents: number;
  expired_documents: number;
  open_alerts: number;
  critical_alerts: number;
  open_audits: number;
  avg_compliance_score: number;
};

type Matrix = {
  employee_id: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  requirements_total: number;
  compliant_count: number;
  pending_count: number;
  expired_count: number;
  compliance_score: number;
  compliance_status: string;
};

type DocumentRow = {
  id: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  requirement_code: string;
  requirement_name: string;
  requirement_type: string;
  risk_level: string;
  document_code: string | null;
  document_name: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  status: string;
  verified_by: string | null;
  course_code: string | null;
  course_title: string | null;
  notes: string | null;
};

type AlertRow = {
  id: string;
  employee_code: string | null;
  employee_name: string | null;
  department: string | null;
  position: string | null;
  requirement_code: string | null;
  requirement_name: string | null;
  alert_type: string;
  severity: string;
  title: string;
  message: string | null;
  due_date: string | null;
  status: string;
};

type Audit = {
  id: string;
  code: string;
  title: string;
  audit_type: string;
  department: string | null;
  auditor: string;
  audit_date: string;
  status: string;
  score: number;
  findings_count: number;
  notes: string | null;
  items_total: number;
  items_ok: number;
  items_fail: number;
};

type Requirement = {
  id: string;
  code: string;
  name: string;
  requirement_type: string;
  department: string | null;
  position_title: string | null;
  validity_months: number;
  is_mandatory: boolean;
  risk_level: string;
  description: string | null;
  status: string;
};

function statusClass(value?: string | null) {
  if (["cumple", "vigente", "cerrada", "activo", "baja"].includes(value || "")) return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
  if (["riesgo", "pendiente", "abierta", "media"].includes(value || "")) return "border-amber-400/30 bg-amber-500/15 text-amber-300";
  if (["critico", "vencido", "alta", "critica"].includes(value || "")) return "border-red-400/30 bg-red-500/15 text-red-300";
  return "border-slate-500/30 bg-slate-500/15 text-slate-300";
}

export default function CompliancePage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard>({
    active_requirements: 0,
    employee_documents: 0,
    compliant_documents: 0,
    pending_documents: 0,
    expired_documents: 0,
    open_alerts: 0,
    critical_alerts: 0,
    open_audits: 0,
    avg_compliance_score: 0,
  });

  const [matrix, setMatrix] = useState<Matrix[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      const [dashRes, matrixRes, docsRes, alertsRes, auditsRes, reqRes] = await Promise.all([
        supabase.from("v_hr_compliance_dashboard").select("*").maybeSingle(),
        supabase.from("v_hr_compliance_matrix").select("*").order("compliance_score", { ascending: true }),
        supabase.from("v_hr_compliance_documents_detail").select("*").order("employee_name"),
        supabase.from("v_hr_compliance_alerts_detail").select("*").order("created_at", { ascending: false }),
        supabase.from("v_hr_compliance_audits_detail").select("*").order("created_at", { ascending: false }),
        supabase.from("hr_compliance_requirements").select("*").order("risk_level"),
      ]);

      if (dashRes.error) throw dashRes.error;
      if (matrixRes.error) throw matrixRes.error;
      if (docsRes.error) throw docsRes.error;
      if (alertsRes.error) throw alertsRes.error;
      if (auditsRes.error) throw auditsRes.error;
      if (reqRes.error) throw reqRes.error;

      if (dashRes.data) setDashboard(dashRes.data as Dashboard);
      setMatrix((matrixRes.data || []) as Matrix[]);
      setDocuments((docsRes.data || []) as DocumentRow[]);
      setAlerts((alertsRes.data || []) as AlertRow[]);
      setAudits((auditsRes.data || []) as Audit[]);
      setRequirements((reqRes.data || []) as Requirement[]);
    } catch (error: any) {
      setMessage(error.message || "Error cargando Compliance.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) =>
      [d.employee_code, d.employee_name, d.department, d.position, d.requirement_code, d.requirement_name, d.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [documents, search]);

  async function generateAlerts() {
    try {
      setLoading(true);
      const { error } = await supabase.rpc("hr_generate_compliance_alerts");
      if (error) throw error;
      setMessage("Alertas y matriz de cumplimiento actualizadas.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudieron generar alertas.");
    } finally {
      setLoading(false);
    }
  }

  async function createAudit() {
    try {
      setLoading(true);
      const { error } = await supabase.rpc("hr_create_compliance_audit", {
        p_title: `Auditoría Compliance ${new Date().toLocaleDateString("es-DO")}`,
        p_department: null,
      });
      if (error) throw error;
      setMessage("Auditoría creada.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo crear auditoría.");
    } finally {
      setLoading(false);
    }
  }

  async function closeAlert(id: string) {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("hr_compliance_alerts")
        .update({ status: "cerrada", closed_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      setMessage("Alerta cerrada.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo cerrar alerta.");
    } finally {
      setLoading(false);
    }
  }

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "matriz", label: "Matriz", icon: Target },
    { id: "documentos", label: "Documentos", icon: FileText },
    { id: "alertas", label: "Alertas", icon: AlertTriangle },
    { id: "auditorias", label: "Auditorías", icon: ClipboardCheck },
    { id: "requisitos", label: "Requisitos", icon: ShieldCheck },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">RD Wood System</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-5xl">
                Compliance & Certification Pro
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Fase 24: cumplimiento, certificaciones obligatorias, documentos, vencimientos, auditorías y alertas.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={generateAlerts}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-500"
              >
                <Sparkles size={18} />
                Generar alertas
              </button>
              <button
                onClick={createAudit}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-indigo-500"
              >
                <ClipboardCheck size={18} />
                Nueva auditoría
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
          <Kpi title="Requisitos" value={dashboard.active_requirements} icon={<ShieldCheck size={20} />} />
          <Kpi title="Docs empleado" value={dashboard.employee_documents} icon={<FileText size={20} />} />
          <Kpi title="Vigentes" value={dashboard.compliant_documents} icon={<CheckCircle2 size={20} />} />
          <Kpi title="Pendientes" value={dashboard.pending_documents} icon={<FileCheck2 size={20} />} />
          <Kpi title="Vencidos" value={dashboard.expired_documents} icon={<ShieldAlert size={20} />} />
          <Kpi title="Alertas" value={dashboard.open_alerts} icon={<AlertTriangle size={20} />} />
          <Kpi title="Críticas" value={dashboard.critical_alerts} icon={<ShieldAlert size={20} />} />
          <Kpi title="Auditorías" value={dashboard.open_audits} icon={<ClipboardCheck size={20} />} />
          <Kpi title="Score" value={`${Number(dashboard.avg_compliance_score || 0).toFixed(1)}%`} icon={<BarChart3 size={20} />} />
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

        {tab === "documentos" && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empleado, documento, requisito..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>
        )}

        {tab === "dashboard" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="Riesgo por empleado" icon={<Users size={20} />}>
              <div className="space-y-3">
                {matrix.slice(0, 8).map((m) => <MatrixCard key={m.employee_id} item={m} />)}
                {!matrix.length && <p className="text-sm text-slate-400">No hay matriz de cumplimiento.</p>}
              </div>
            </Panel>

            <Panel title="Alertas abiertas" icon={<AlertTriangle size={20} />}>
              <div className="space-y-3">
                {alerts.slice(0, 8).map((a) => <AlertCard key={a.id} item={a} onClose={closeAlert} />)}
                {!alerts.length && <p className="text-sm text-slate-400">No hay alertas.</p>}
              </div>
            </Panel>
          </section>
        )}

        {tab === "matriz" && (
          <Panel title="Matriz de cumplimiento por empleado" icon={<Target size={20} />}>
            <div className="space-y-3">
              {matrix.map((m) => <MatrixCard key={m.employee_id} item={m} />)}
            </div>
          </Panel>
        )}

        {tab === "documentos" && (
          <Panel title="Documentos y certificaciones" icon={<FileText size={20} />}>
            <div className="space-y-3">
              {filteredDocs.map((d) => (
                <div key={d.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{d.employee_code} · {d.employee_name}</p>
                      <p className="text-xs text-slate-400">{d.department} · {d.position}</p>
                      <p className="mt-2 text-sm text-white">{d.requirement_code} · {d.requirement_name}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Tipo {d.requirement_type} · Riesgo {d.risk_level} · vence {d.expiration_date || "N/A"}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">{d.notes}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(d.status)}`}>
                      {d.status}
                    </span>
                  </div>
                </div>
              ))}
              {!filteredDocs.length && <p className="text-sm text-slate-400">No hay documentos.</p>}
            </div>
          </Panel>
        )}

        {tab === "alertas" && (
          <Panel title="Alertas de cumplimiento" icon={<AlertTriangle size={20} />}>
            <div className="space-y-3">
              {alerts.map((a) => <AlertCard key={a.id} item={a} onClose={closeAlert} />)}
              {!alerts.length && <p className="text-sm text-slate-400">No hay alertas.</p>}
            </div>
          </Panel>
        )}

        {tab === "auditorias" && (
          <Panel title="Auditorías internas" icon={<ClipboardCheck size={20} />}>
            <div className="space-y-3">
              {audits.map((a) => (
                <div key={a.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{a.code} · {a.title}</p>
                      <p className="text-xs text-slate-400">{a.audit_type} · {a.department || "General"} · {a.audit_date}</p>
                      <p className="mt-2 text-sm text-slate-300">{a.notes}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Items {a.items_total} · Cumple {a.items_ok} · No cumple {a.items_fail}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(a.status)}`}>
                      {a.status}
                    </span>
                  </div>
                </div>
              ))}
              {!audits.length && <p className="text-sm text-slate-400">No hay auditorías.</p>}
            </div>
          </Panel>
        )}

        {tab === "requisitos" && (
          <Panel title="Requisitos obligatorios" icon={<ShieldCheck size={20} />}>
            <div className="grid gap-3 lg:grid-cols-2">
              {requirements.map((r) => (
                <div key={r.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{r.code} · {r.name}</p>
                      <p className="text-xs text-slate-400">{r.requirement_type} · {r.department || "General"} · {r.position_title || "Todos"}</p>
                      <p className="mt-2 text-sm text-slate-300">{r.description}</p>
                      <p className="mt-1 text-xs text-slate-500">Validez {r.validity_months} meses · obligatorio {r.is_mandatory ? "sí" : "no"}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(r.risk_level)}`}>
                      {r.risk_level}
                    </span>
                  </div>
                </div>
              ))}
              {!requirements.length && <p className="text-sm text-slate-400">No hay requisitos.</p>}
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function MatrixCard({ item }: { item: Matrix }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <p className="font-black">{item.employee_code} · {item.employee_name}</p>
          <p className="text-xs text-slate-400">{item.department} · {item.position}</p>
          <p className="mt-2 text-sm text-slate-300">
            Total {item.requirements_total} · Vigentes {item.compliant_count} · Pendientes {item.pending_count} · Vencidos {item.expired_count}
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${Number(item.compliance_score || 0)}%` }} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-emerald-300">{Number(item.compliance_score || 0).toFixed(0)}%</p>
          <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.compliance_status)}`}>
            {item.compliance_status}
          </span>
        </div>
      </div>
    </div>
  );
}

function AlertCard({ item, onClose }: { item: AlertRow; onClose: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-black">{item.title}</p>
          <p className="text-xs text-slate-400">{item.employee_code || "N/A"} · {item.employee_name || "General"} · {item.department || ""}</p>
          <p className="mt-2 text-sm text-slate-300">{item.message}</p>
          <p className="mt-1 text-xs text-slate-500">Vence: {item.due_date || "N/A"} · {item.alert_type}</p>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.severity)}`}>
            {item.severity}
          </span>
          {item.status !== "cerrada" && (
            <button
              onClick={() => onClose(item.id)}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-500"
            >
              Cerrar
            </button>
          )}
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
