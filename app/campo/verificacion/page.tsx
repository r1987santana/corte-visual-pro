"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileWarning,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Project = {
  id: string;
  code?: string | null;
  name?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  customer_name?: string | null;
  status?: string | null;
  progress?: number | null;
  created_at?: string | null;
};

type VerificationReport = {
  id: string;
  project_id: string;
  order_code?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  qa_supervisor?: string | null;
  status?: string | null;
  score?: number | null;
  notes?: string | null;
  approved_at?: string | null;
};

type VerificationIssue = {
  id: string;
  report_id?: string | null;
  project_id: string;
  order_code?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  module_code?: string | null;
  module_name?: string | null;
  category: string;
  description: string;
  severity: string;
  assigned_to?: string | null;
  assigned_role?: string | null;
  due_date?: string | null;
  status: string;
  corrective_action?: string | null;
  qa_notes?: string | null;
  created_by?: string | null;
  closed_by?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type IssuePhoto = {
  id: string;
  issue_id: string;
  photo_url: string;
  photo_type?: string | null;
  description?: string | null;
  created_at?: string | null;
};

const CHECKLIST = [
  "Nivelación correcta",
  "Puertas alineadas",
  "Correderas funcionando",
  "Herrajes instalados",
  "Silicón aplicado",
  "Limpieza final",
];

const ISSUE_CATEGORIES = [
  "Nivelación",
  "Puertas",
  "Correderas",
  "Herrajes",
  "Canteo",
  "Terminación",
  "Limpieza",
  "Medidas",
  "Daño material",
  "Otro",
];

const SEVERITIES = ["baja", "media", "alta", "critica"];
const ISSUE_STATUS = ["pendiente", "en_correccion", "corregido", "cerrado", "rechazado"];

function safeText(value: any, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function projectName(p?: Project | null) {
  return safeText(p?.project_name || p?.name, "Proyecto sin nombre");
}

function clientName(p?: Project | null) {
  return safeText(p?.client_name || p?.customer_name, "Cliente general");
}

function projectCode(p?: Project | null) {
  return safeText(p?.code || `PRO-${String(p?.id || "").slice(0, 8)}`, "SIN-CODIGO");
}

function severityClass(severity: string) {
  if (severity === "critica") return "bg-red-500/15 text-red-300 border-red-500/30";
  if (severity === "alta") return "bg-orange-500/15 text-orange-300 border-orange-500/30";
  if (severity === "media") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
}

function statusClass(status: string) {
  if (status === "cerrado") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (status === "corregido") return "bg-blue-500/15 text-blue-300 border-blue-500/30";
  if (status === "en_correccion") return "bg-purple-500/15 text-purple-300 border-purple-500/30";
  if (status === "rechazado") return "bg-red-500/15 text-red-300 border-red-500/30";
  return "bg-amber-500/15 text-amber-300 border-amber-500/30";
}

export default function VerificacionQaProPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [issues, setIssues] = useState<VerificationIssue[]>([]);
  const [issuePhotos, setIssuePhotos] = useState<IssuePhoto[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [qaSupervisor, setQaSupervisor] = useState("Supervisor QA");
  const [qaNotes, setQaNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [issueForm, setIssueForm] = useState({
    module_code: "",
    module_name: "",
    category: "Terminación",
    description: "",
    severity: "media",
    assigned_to: "Equipo de instalación",
    due_date: "",
    corrective_action: "",
  });

  const score = useMemo(() => {
    const baseScore = Math.round((CHECKLIST.filter((item) => checked[item]).length / CHECKLIST.length) * 100);
    const openIssues = issues.filter((i) => i.status !== "cerrado");
    const penalty = openIssues.reduce((acc, issue) => {
      if (issue.severity === "critica") return acc + 25;
      if (issue.severity === "alta") return acc + 15;
      if (issue.severity === "media") return acc + 8;
      return acc + 3;
    }, 0);
    return Math.max(0, baseScore - penalty);
  }, [checked, issues]);

  const openIssues = issues.filter((i) => i.status !== "cerrado");
  const closedIssues = issues.filter((i) => i.status === "cerrado");
  const canApprove = score >= 95 && openIssues.length === 0;

  const filteredProjects = projects.filter((p) => {
    const q = search.toLowerCase();
    return (
      projectName(p).toLowerCase().includes(q) ||
      clientName(p).toLowerCase().includes(q) ||
      projectCode(p).toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      const fallback = await supabase
        .from("furniture_projects")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (fallback.error) {
        setMessage("No pude cargar proyectos: " + fallback.error.message);
      } else {
        setProjects((fallback.data || []) as Project[]);
      }
    } else {
      setProjects((data || []) as Project[]);
    }

    setLoading(false);
  }

  async function selectProject(p: Project) {
    setSelected(p);
    setMessage("");
    setChecked({});
    setQaNotes("");
    await loadOrCreateReport(p);
  }

  async function loadOrCreateReport(p: Project) {
    setLoading(true);

    const existing = await supabase
      .from("verification_reports")
      .select("*")
      .eq("project_id", p.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing.data) {
      const current = existing.data as VerificationReport;
      setReport(current);
      setQaSupervisor(current.qa_supervisor || "Supervisor QA");
      setQaNotes(current.notes || "");
      await loadIssues(current.project_id, current.id);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("verification_reports")
      .insert({
        project_id: p.id,
        order_code: projectCode(p),
        project_name: projectName(p),
        client_name: clientName(p),
        qa_supervisor: qaSupervisor,
        status: "en_revision",
        score: 0,
      })
      .select()
      .single();

    if (error) {
      setMessage("No pude crear reporte QA: " + error.message);
      setLoading(false);
      return;
    }

    setReport(data as VerificationReport);
    await loadIssues(p.id, (data as VerificationReport).id);
    setLoading(false);
  }

  async function loadIssues(projectId: string, reportId?: string) {
    const { data, error } = await supabase
      .from("verification_issues")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("No pude cargar observaciones: " + error.message);
      return;
    }

    setIssues((data || []) as VerificationIssue[]);

    if (reportId) {
      const ids = (data || []).map((x: any) => x.id);
      if (ids.length > 0) {
        const photos = await supabase.from("verification_issue_photos").select("*").in("issue_id", ids);
        if (!photos.error) setIssuePhotos((photos.data || []) as IssuePhoto[]);
      } else {
        setIssuePhotos([]);
      }
    }
  }

  async function saveVerification(statusOverride?: string) {
    if (!selected || !report) {
      setMessage("Selecciona un proyecto primero.");
      return;
    }

    setSaving(true);
    setMessage("");

    const status = statusOverride || (canApprove ? "aprobado" : openIssues.length ? "observado" : "en_revision");

    const { error } = await supabase
      .from("verification_reports")
      .update({
        qa_supervisor: qaSupervisor,
        score,
        notes: qaNotes,
        status,
        approved_at: status === "aprobado" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", report.id);

    if (error) {
      setMessage("Error guardando QA: " + error.message);
      setSaving(false);
      return;
    }

    for (const item of CHECKLIST) {
      await supabase.from("verification_checklist").insert({
        report_id: report.id,
        item_name: item,
        passed: !!checked[item],
        observations: checked[item] ? null : "Pendiente de validar o con observación.",
      });
    }

    if (status === "aprobado") {
      await tryUpdateProjectToDelivery(selected.id);
    }

    await loadOrCreateReport(selected);
    setMessage(status === "aprobado" ? "✅ QA aprobado. Proyecto listo para Entrega Final." : "✅ Verificación QA guardada.");
    setSaving(false);
  }

  async function tryUpdateProjectToDelivery(projectId: string) {
    try {
      await supabase.from("projects").update({ status: "entrega_final", progress: 95 }).eq("id", projectId);
    } catch {}
    try {
      await supabase.from("furniture_projects").update({ status: "entrega_final", progress: 95 }).eq("id", projectId);
    } catch {}
  }

  async function createIssue() {
    if (!selected || !report) {
      setMessage("Selecciona un proyecto primero.");
      return;
    }

    if (!issueForm.description.trim()) {
      setMessage("Describe la observación QA.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("verification_issues").insert({
      report_id: report.id,
      project_id: selected.id,
      order_code: projectCode(selected),
      project_name: projectName(selected),
      client_name: clientName(selected),
      module_code: issueForm.module_code || null,
      module_name: issueForm.module_name || null,
      category: issueForm.category,
      description: issueForm.description,
      severity: issueForm.severity,
      assigned_to: issueForm.assigned_to || "Equipo de instalación",
      assigned_role: "instalacion",
      due_date: issueForm.due_date || null,
      status: "pendiente",
      corrective_action: issueForm.corrective_action || null,
      created_by: qaSupervisor,
      qa_notes: "Creado desde FASE 40.1 QA PRO",
    });

    if (error) {
      setMessage("Error creando observación: " + error.message);
      setSaving(false);
      return;
    }

    setIssueForm({
      module_code: "",
      module_name: "",
      category: "Terminación",
      description: "",
      severity: "media",
      assigned_to: "Equipo de instalación",
      due_date: "",
      corrective_action: "",
    });

    await loadIssues(selected.id, report.id);
    await saveReportAsObserved();
    setMessage("✅ Observación creada y asignada a instalación.");
    setSaving(false);
  }

  async function saveReportAsObserved() {
    if (!report) return;
    await supabase
      .from("verification_reports")
      .update({
        status: "observado",
        score,
        updated_at: new Date().toISOString(),
      })
      .eq("id", report.id);
  }

  async function updateIssueStatus(issue: VerificationIssue, status: string) {
    setSaving(true);
    setMessage("");

    const payload: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "cerrado") {
      payload.closed_by = qaSupervisor;
      payload.closed_at = new Date().toISOString();
    }

    const { error } = await supabase.from("verification_issues").update(payload).eq("id", issue.id);

    if (error) {
      setMessage("Error actualizando observación: " + error.message);
      setSaving(false);
      return;
    }

    if (selected && report) await loadIssues(selected.id, report.id);
    setMessage(`✅ Observación actualizada a ${status}.`);
    setSaving(false);
  }

  async function uploadIssuePhoto(issue: VerificationIssue, file: File) {
    if (!selected || !report) return;

    setSaving(true);
    setMessage("");

    const ext = file.name.split(".").pop() || "jpg";
    const path = `qa-observaciones/${selected.id}/${issue.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("project-files").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (uploadError) {
      setMessage("Error subiendo foto: " + uploadError.message);
      setSaving(false);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("project-files").getPublicUrl(path);

    const { error } = await supabase.from("verification_issue_photos").insert({
      issue_id: issue.id,
      report_id: report.id,
      project_id: selected.id,
      photo_url: publicUrl.publicUrl,
      photo_type: issue.status === "corregido" ? "correccion" : "defecto",
      file_name: file.name,
      description: `Evidencia QA - ${issue.category}`,
      uploaded_by: qaSupervisor,
    });

    if (error) {
      setMessage("Foto subida, pero falló registro: " + error.message);
      setSaving(false);
      return;
    }

    await loadIssues(selected.id, report.id);
    setMessage("✅ Foto de observación subida.");
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-5 text-white md:px-8">
      <div className="mx-auto max-w-[1600px]">
        <section className="rounded-[30px] border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-[#07111f] to-blue-950 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                FASE 40.1 · OBSERVACIONES QA
              </div>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Verificación QA PRO</h1>
              <p className="mt-2 text-sm font-semibold text-slate-300">
                Selecciona proyecto, registra no conformidades y bloquea entrega hasta cerrar observaciones.
              </p>
            </div>

            <button
              onClick={loadProjects}
              className="inline-flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-black uppercase text-slate-950"
            >
              <RefreshCw size={18} />
              Actualizar
            </button>
          </div>
        </section>

        {message && (
          <div className="mt-4 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm font-black text-cyan-100">
            {message}
          </div>
        )}

        <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[430px_1fr_460px]">
          <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5">
            <h2 className="text-2xl font-black">Proyectos a verificar</h2>
            <p className="text-sm text-slate-400">Selecciona el proyecto para QA.</p>

            <div className="relative mt-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar proyecto, cliente..."
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-4 pl-12 pr-4 text-sm font-black outline-none focus:border-cyan-400"
              />
            </div>

            <div className="mt-4 max-h-[760px] space-y-3 overflow-auto pr-2">
              {loading && <div className="p-6 text-center text-slate-400">Cargando...</div>}
              {filteredProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProject(p)}
                  className={[
                    "w-full rounded-2xl border p-4 text-left transition",
                    selected?.id === p.id
                      ? "border-cyan-400 bg-cyan-400/10"
                      : "border-slate-800 bg-slate-950 hover:border-cyan-400/40",
                  ].join(" ")}
                >
                  <div className="text-xs font-black uppercase tracking-widest text-cyan-300">{projectCode(p)}</div>
                  <div className="mt-1 text-lg font-black">{projectName(p)}</div>
                  <div className="mt-1 text-xs text-slate-400">{clientName(p)}</div>
                  <div className="mt-3 flex justify-between text-xs font-black">
                    <span className="text-slate-500">{p.status || "sin estado"}</span>
                    <span className={openIssues.length ? "text-amber-300" : "text-emerald-300"}>
                      {selected?.id === p.id ? `${openIssues.length} abiertas` : "QA"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5">
              {!selected ? (
                <div className="flex min-h-[620px] flex-col items-center justify-center text-center">
                  <ShieldCheck className="text-slate-700" size={90} />
                  <h2 className="mt-5 text-3xl font-black">Selecciona un proyecto</h2>
                  <p className="mt-2 max-w-md text-sm text-slate-400">
                    Verás checklist, score, estado QA y aprobación final.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-cyan-300">{projectCode(selected)}</div>
                      <h2 className="mt-1 text-3xl font-black">{projectName(selected)}</h2>
                      <p className="text-sm text-slate-400">{clientName(selected)}</p>
                    </div>

                    <div className={["rounded-2xl border px-5 py-4 text-center", canApprove ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"].join(" ")}>
                      <div className="text-xs font-black uppercase tracking-widest text-slate-400">Score QA</div>
                      <div className="mt-1 text-4xl font-black">{score}%</div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <MiniStat title="Abiertas" value={openIssues.length} danger={openIssues.length > 0} />
                    <MiniStat title="Cerradas" value={closedIssues.length} />
                    <MiniStat title="Estado" value={report?.status || "en_revision"} />
                  </div>

                  {openIssues.length > 0 && (
                    <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-black text-red-100">
                      <AlertTriangle className="mr-2 inline" size={18} />
                      Entrega final bloqueada: existen {openIssues.length} observación(es) abiertas.
                    </div>
                  )}

                  <div className="mt-6">
                    <h3 className="text-2xl font-black">Checklist QA</h3>
                    <div className="mt-4 space-y-3">
                      {CHECKLIST.map((item) => (
                        <label key={item} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                          <input
                            type="checkbox"
                            checked={!!checked[item]}
                            onChange={(e) => setChecked({ ...checked, [item]: e.target.checked })}
                            className="h-5 w-5"
                          />
                          <span className="font-black">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      value={qaSupervisor}
                      onChange={(e) => setQaSupervisor(e.target.value)}
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-black outline-none focus:border-cyan-400"
                      placeholder="Supervisor QA"
                    />
                    <select
                      value={report?.status || "en_revision"}
                      onChange={(e) => saveVerification(e.target.value)}
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-black outline-none focus:border-cyan-400"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="en_revision">En revisión</option>
                      <option value="observado">Observado</option>
                      <option value="en_correccion">En corrección</option>
                      <option value="corregido">Corregido</option>
                      <option value="aprobado">Aprobado</option>
                    </select>
                  </div>

                  <textarea
                    value={qaNotes}
                    onChange={(e) => setQaNotes(e.target.value)}
                    className="mt-4 h-28 w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-400"
                    placeholder="Notas generales QA..."
                  />

                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button
                      onClick={() => saveVerification()}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-3 rounded-2xl bg-cyan-400 px-5 py-4 text-sm font-black uppercase text-slate-950 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      Guardar QA
                    </button>

                    <button
                      onClick={() => saveVerification("aprobado")}
                      disabled={saving || !canApprove}
                      className="inline-flex items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black uppercase text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <CheckCircle2 size={18} />
                      Aprobar y pasar a entrega
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5">
              <h2 className="text-2xl font-black">Nueva observación</h2>
              <p className="text-sm text-slate-400">No conformidad asignada a instalación.</p>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <input
                  value={issueForm.module_name}
                  onChange={(e) => setIssueForm({ ...issueForm, module_name: e.target.value })}
                  placeholder="Módulo / área"
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-black outline-none focus:border-cyan-400"
                />

                <select
                  value={issueForm.category}
                  onChange={(e) => setIssueForm({ ...issueForm, category: e.target.value })}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-black outline-none focus:border-cyan-400"
                >
                  {ISSUE_CATEGORIES.map((x) => <option key={x}>{x}</option>)}
                </select>

                <select
                  value={issueForm.severity}
                  onChange={(e) => setIssueForm({ ...issueForm, severity: e.target.value })}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-black outline-none focus:border-cyan-400"
                >
                  {SEVERITIES.map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}
                </select>

                <textarea
                  value={issueForm.description}
                  onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                  placeholder="Describe el problema..."
                  className="h-28 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-400"
                />

                <input
                  value={issueForm.assigned_to}
                  onChange={(e) => setIssueForm({ ...issueForm, assigned_to: e.target.value })}
                  placeholder="Responsable"
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-black outline-none focus:border-cyan-400"
                />

                <input
                  type="date"
                  value={issueForm.due_date}
                  onChange={(e) => setIssueForm({ ...issueForm, due_date: e.target.value })}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-black outline-none focus:border-cyan-400"
                />

                <textarea
                  value={issueForm.corrective_action}
                  onChange={(e) => setIssueForm({ ...issueForm, corrective_action: e.target.value })}
                  placeholder="Acción correctiva sugerida..."
                  className="h-24 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-400"
                />
              </div>

              <button
                onClick={createIssue}
                disabled={saving || !selected}
                className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-amber-400 px-5 py-4 text-sm font-black uppercase text-slate-950 disabled:opacity-40"
              >
                <Plus size={18} />
                Crear observación
              </button>
            </div>

            <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5">
              <h2 className="text-2xl font-black">Observaciones QA</h2>
              <p className="text-sm text-slate-400">Abiertas, corrección y cierre.</p>

              <div className="mt-4 max-h-[720px] space-y-4 overflow-auto pr-2">
                {issues.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
                    <ShieldCheck className="mx-auto text-slate-700" size={60} />
                    <h3 className="mt-3 text-xl font-black">Sin observaciones</h3>
                    <p className="mt-1 text-sm text-slate-400">Este proyecto no tiene no conformidades.</p>
                  </div>
                ) : (
                  issues.map((issue) => (
                    <div key={issue.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-white">{issue.category}</div>
                          <div className="mt-1 text-xs text-slate-500">{issue.module_name || "Sin módulo"}</div>
                        </div>
                        <div className="flex flex-col gap-2 text-right">
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${severityClass(issue.severity)}`}>
                            {issue.severity}
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusClass(issue.status)}`}>
                            {issue.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>

                      <p className="mt-3 rounded-xl bg-slate-900 p-3 text-sm font-semibold text-slate-200">
                        {issue.description}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-900 p-3">
                          <div className="font-black uppercase text-slate-500">Responsable</div>
                          <div className="mt-1 font-bold">{issue.assigned_to || "Instalación"}</div>
                        </div>
                        <div className="rounded-xl bg-slate-900 p-3">
                          <div className="font-black uppercase text-slate-500">Compromiso</div>
                          <div className="mt-1 font-bold">{issue.due_date || "Sin fecha"}</div>
                        </div>
                      </div>

                      {issue.corrective_action && (
                        <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs font-semibold text-cyan-100">
                          Acción: {issue.corrective_action}
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <select
                          value={issue.status}
                          onChange={(e) => updateIssueStatus(issue, e.target.value)}
                          className="rounded-xl border border-slate-700 bg-[#020617] px-3 py-3 text-xs font-black outline-none focus:border-cyan-400"
                        >
                          {ISSUE_STATUS.map((s) => (
                            <option key={s} value={s}>{s.replace("_", " ").toUpperCase()}</option>
                          ))}
                        </select>

                        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-3 text-xs font-black text-cyan-100">
                          <Camera size={14} />
                          Foto
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadIssuePhoto(issue, file);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </div>

                      <IssuePhotos issueId={issue.id} photos={issuePhotos} />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MiniStat({ title, value, danger }: { title: string; value: any; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${danger ? "border-red-500/30 bg-red-500/10" : "border-slate-800 bg-slate-950"}`}>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</div>
      <div className="mt-2 truncate text-xl font-black">{value}</div>
    </div>
  );
}

function IssuePhotos({ issueId, photos }: { issueId: string; photos: IssuePhoto[] }) {
  const list = photos.filter((p) => p.issue_id === issueId);
  if (!list.length) return null;

  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {list.map((p) => (
        <a key={p.id} href={p.photo_url} target="_blank" className="overflow-hidden rounded-xl border border-slate-800">
          <img src={p.photo_url} alt="Observación QA" className="h-20 w-full object-cover" />
        </a>
      ))}
    </div>
  );
}
