"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  CheckSquare,
  Clock3,
  ClipboardCheck,
  DollarSign,
  ExternalLink,
  Eye,
  ListTodo,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/saas/auth-client";

type Decision = {
  id: string;
  module: string;
  actionType: string;
  title: string;
  summary: string;
  risk: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "executed" | "cancelled";
  payload?: Record<string, any>;
  route?: string | null;
  requiresApproval?: boolean;
  createdAt?: string;
};

type MonitorEvent = {
  id: string;
  module: string;
  eventType: string;
  title: string;
  summary: string;
  severity: "info" | "warning" | "danger" | "critical";
  riskScore: number;
  status: string;
  payload?: Record<string, any>;
  createdAt?: string;
};

type MonitorSummary = {
  inventory: number;
  quotes: number;
  orders: number;
  payments: number;
  purchaseOrders: number;
  requisitions: number;
  sales: number;
};

type AITask = {
  id: string;
  decisionId?: string | null;
  module: string;
  title: string;
  summary: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "critical";
  payload?: Record<string, any>;
  route?: string | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function riskTone(risk?: string) {
  if (risk === "critical") return "border-red-400/40 bg-red-500/15 text-red-100";
  if (risk === "high") return "border-amber-400/40 bg-amber-500/15 text-amber-100";
  if (risk === "medium") return "border-cyan-400/35 bg-cyan-500/10 text-cyan-100";
  return "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
}

function severityTone(severity?: string) {
  if (severity === "critical" || severity === "danger") return "border-red-400/35 bg-red-500/10 text-red-100";
  if (severity === "warning") return "border-amber-400/35 bg-amber-500/10 text-amber-100";
  return "border-cyan-400/35 bg-cyan-500/10 text-cyan-100";
}

function priorityTone(priority?: string) {
  if (priority === "critical") return "border-red-400/35 bg-red-500/10 text-red-100";
  if (priority === "high") return "border-amber-400/35 bg-amber-500/10 text-amber-100";
  if (priority === "low") return "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
  return "border-cyan-400/35 bg-cyan-500/10 text-cyan-100";
}

function statusTone(status?: string) {
  if (status === "done") return "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
  if (status === "in_progress") return "border-cyan-400/35 bg-cyan-500/10 text-cyan-100";
  if (status === "cancelled") return "border-red-400/35 bg-red-500/10 text-red-100";
  return "border-slate-500/35 bg-slate-500/10 text-slate-100";
}

function statusLabel(status?: string) {
  if (status === "in_progress") return "en progreso";
  if (status === "done") return "completada";
  if (status === "cancelled") return "cancelada";
  return "abierta";
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-DO");
}

function formatMoney(value?: number) {
  const n = Number(value || 0);
  return `RD$${Math.round(n).toLocaleString("en-US")}`;
}

function normalizeModule(value: string) {
  return String(value || "global").replace(/_/g, " ");
}

export default function AIDecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [summary, setSummary] = useState<MonitorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [setupNotice, setSetupNotice] = useState("");
  const [applyingPrice, setApplyingPrice] = useState<string | null>(null);

  const stats = useMemo(() => {
    const criticalEvents = events.filter((event) => event.severity === "critical" || event.severity === "danger").length;
    const highDecisions = decisions.filter((decision) => decision.risk === "critical" || decision.risk === "high").length;
    const avgRisk = events.length
      ? Math.round(events.reduce((sum, event) => sum + Number(event.riskScore || 0), 0) / events.length)
      : 0;

    return {
      pending: decisions.length,
      criticalEvents,
      highDecisions,
      avgRisk,
      activeTasks: tasks.length,
    };
  }, [decisions, events, tasks]);

  async function loadData() {
    setLoading(true);
    setError("");
    setSetupNotice("");
    try {
      const [decisionRes, eventRes, taskRes] = await Promise.all([
        apiFetch("/api/ai/decisions?status=pending"),
        apiFetch("/api/ai/monitor?status=open"),
        apiFetch("/api/ai/tasks"),
      ]);

      const decisionJson = await decisionRes.json();
      const eventJson = await eventRes.json();
      const taskJson = await taskRes.json();

      if (!decisionRes.ok || !decisionJson.ok) throw new Error(decisionJson.message || decisionJson.error || "No se pudieron cargar decisiones.");
      if (!eventRes.ok || !eventJson.ok) throw new Error(eventJson.message || eventJson.error || "No se pudieron cargar eventos.");

      setDecisions(decisionJson.decisions || []);
      setEvents(eventJson.events || []);

      if (taskRes.ok && taskJson.ok) {
        setTasks(taskJson.tasks || []);
        if (taskJson.setupRequired) setSetupNotice(taskJson.message || "La tabla de tareas IA esta pendiente en Supabase.");
      } else {
        setTasks([]);
        setSetupNotice(taskJson.message || taskJson.error || "No se pudieron cargar tareas IA.");
      }
    } catch (err: any) {
      setError(err?.message || "Error cargando IA.");
    } finally {
      setLoading(false);
    }
  }

  async function runMonitor() {
    setScanning(true);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch("/api/ai/monitor", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || payload.error || "No se pudo ejecutar el monitor.");

      setSummary(payload.summary || null);
      setMessage(`Monitor ejecutado: ${payload.detected} riesgo(s) detectado(s). Health IA: ${payload.healthScore}%.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Error ejecutando monitor.");
    } finally {
      setScanning(false);
    }
  }

  async function updateDecision(decision: Decision, status: Decision["status"]) {
    setMessage("");
    setError("");
    try {
      const response = await apiFetch("/api/ai/decisions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: decision.id, status }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || payload.error || "No se pudo actualizar la decision.");

      if (status === "executed") {
        const task = payload.execution?.task as AITask | undefined;
        if (payload.execution?.setupRequired) {
          setMessage(`${payload.execution.message} Ejecuta el SQL actualizado y vuelve a probar.`);
        } else if (task) {
          setMessage(`Tarea IA creada: ${task.title}`);
        } else {
          setMessage(`Decision ejecutada: ${decision.title}`);
        }
      } else {
        setMessage(`Decision ${status}: ${decision.title}`);
      }
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Error actualizando decision.");
    }
  }

  async function updateTask(task: AITask, status: AITask["status"]) {
    setMessage("");
    setError("");
    try {
      const response = await apiFetch("/api/ai/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || payload.error || "No se pudo actualizar la tarea.");

      setMessage(`Tarea ${statusLabel(status)}: ${task.title}`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Error actualizando tarea.");
    }
  }

  function canApplyPricing(task: AITask) {
    const pricing = task.payload?.pricing;
    return Boolean(task.payload?.inventoryId && pricing?.suggestedCost && pricing?.suggestedPrice && task.status !== "done");
  }

  async function applyTaskPricing(task: AITask) {
    setApplyingPrice(task.id);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch("/api/ai/pricing/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || payload.error || "No se pudo aplicar el precio.");

      const applied = payload.applied || {};
      setMessage(
        `Precio aplicado: costo ${formatMoney(applied.previousCost)} -> ${formatMoney(applied.approvedCost)}, venta ${formatMoney(applied.previousPrice)} -> ${formatMoney(applied.approvedPrice)}.`
      );
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Error aplicando precio IA.");
    } finally {
      setApplyingPrice(null);
    }
  }

  async function updateEvent(event: MonitorEvent, status: "acknowledged" | "resolved" | "dismissed") {
    setMessage("");
    setError("");
    try {
      const response = await apiFetch("/api/ai/monitor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: event.id, status }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || payload.error || "No se pudo actualizar el evento.");

      setMessage(`Evento ${status}: ${event.title}`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Error actualizando evento.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-slate-900 via-[#061426] to-indigo-950 p-6 shadow-2xl shadow-cyan-950/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200">
                <Brain size={14} />
                IA Maestra Nivel 5
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Decisiones IA</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
                Cola central para monitoreo, riesgos y acciones aprobadas antes de ejecutar cambios operativos.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/ia-precios"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-100 hover:bg-white/[0.08]"
              >
                <DollarSign size={18} />
                Alimentar precios
              </Link>
              <button
                type="button"
                onClick={loadData}
                disabled={loading || scanning}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                Actualizar
              </button>
              <button
                type="button"
                onClick={runMonitor}
                disabled={scanning}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {scanning ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                Escanear ahora
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-5">
          <Kpi title="Pendientes" value={stats.pending} icon={<ClipboardCheck size={19} />} tone="cyan" />
          <Kpi title="Eventos criticos" value={stats.criticalEvents} icon={<ShieldAlert size={19} />} tone="red" />
          <Kpi title="Alta prioridad" value={stats.highDecisions} icon={<AlertTriangle size={19} />} tone="amber" />
          <Kpi title="Tareas IA" value={stats.activeTasks} icon={<ListTodo size={19} />} tone="cyan" />
          <Kpi title="Riesgo promedio" value={`${stats.avgRisk}%`} icon={<Brain size={19} />} tone="purple" />
        </section>

        {summary ? (
          <section className="mt-5 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs font-bold text-slate-300 sm:grid-cols-4 lg:grid-cols-7">
            <Mini label="Inventario" value={summary.inventory} />
            <Mini label="Cotizaciones" value={summary.quotes} />
            <Mini label="Ordenes" value={summary.orders} />
            <Mini label="Pagos" value={summary.payments} />
            <Mini label="OC" value={summary.purchaseOrders} />
            <Mini label="Requisiciones" value={summary.requisitions} />
            <Mini label="Ventas" value={summary.sales} />
          </section>
        ) : null}

        {message ? (
          <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
            {error}
          </div>
        ) : null}

        {setupNotice ? (
          <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100">
            {setupNotice}
          </div>
        ) : null}

        <section className="mt-6">
          <SectionTitle icon={<ListTodo size={20} />} title="Tareas IA activas" subtitle="Decisiones ejecutadas convertidas en trabajo operativo." />

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {loading ? <LoadingBlock /> : null}
            {!loading && tasks.length === 0 ? <EmptyBlock text="No hay tareas IA activas." /> : null}

            {tasks.map((task) => (
              <article key={task.id} className="rounded-[22px] border border-white/10 bg-slate-950/80 p-4 shadow-xl shadow-black/20">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cx("rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]", priorityTone(task.priority))}>
                        {task.priority}
                      </span>
                      <span className={cx("rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]", statusTone(task.status))}>
                        {statusLabel(task.status)}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">
                        {normalizeModule(task.module)}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-black text-white">{task.title}</h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{task.summary}</p>
                    <ActionPlan payload={task.payload} />
                    <p className="mt-3 text-xs font-bold text-slate-500">{formatDate(task.createdAt)}</p>
                  </div>

                  <div className="grid min-w-max grid-cols-2 gap-2">
                    {canApplyPricing(task) ? (
                      <button
                        type="button"
                        onClick={() => applyTaskPricing(task)}
                        disabled={applyingPrice === task.id}
                        className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
                      >
                        {applyingPrice === task.id ? <Loader2 size={15} className="animate-spin" /> : <DollarSign size={15} />}
                        Aplicar precio
                      </button>
                    ) : null}
                    {task.status === "open" ? (
                      <button
                        type="button"
                        onClick={() => updateTask(task, "in_progress")}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-500/20"
                      >
                        <Clock3 size={15} />
                        Iniciar
                      </button>
                    ) : null}
                    {task.status !== "done" ? (
                      <button
                        type="button"
                        onClick={() => updateTask(task, "done")}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-500/20"
                      >
                        <CheckSquare size={15} />
                        Completar
                      </button>
                    ) : null}
                    {task.route ? (
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = task.route || "/";
                        }}
                        className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-100 hover:bg-white/[0.08]"
                      >
                        <ExternalLink size={15} />
                        Abrir modulo
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <div>
            <SectionTitle icon={<ClipboardCheck size={20} />} title="Decisiones pendientes" subtitle="Acciones preparadas por la IA esperando criterio humano." />

            <div className="mt-3 grid gap-3">
              {loading ? <LoadingBlock /> : null}
              {!loading && decisions.length === 0 ? <EmptyBlock text="No hay decisiones pendientes." /> : null}

              {decisions.map((decision) => (
                <article key={decision.id} className="rounded-[22px] border border-white/10 bg-slate-950/80 p-4 shadow-xl shadow-black/20">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cx("rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]", riskTone(decision.risk))}>
                          {decision.risk}
                        </span>
                        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">
                          {normalizeModule(decision.module)}
                        </span>
                      </div>
                      <h2 className="mt-3 text-lg font-black text-white">{decision.title}</h2>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{decision.summary}</p>
                      <ActionPlan payload={decision.payload} />
                      <p className="mt-3 text-xs font-bold text-slate-500">{decision.actionType} - {formatDate(decision.createdAt)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:min-w-max sm:flex-wrap sm:justify-end">
                      <button
                        type="button"
                        onClick={() => updateDecision(decision, "approved")}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-500/20"
                      >
                        <CheckCircle2 size={15} />
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDecision(decision, "rejected")}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100 hover:bg-red-500/20"
                      >
                        <XCircle size={15} />
                        Rechazar
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDecision(decision, "executed")}
                        className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-500/20 sm:col-span-1"
                      >
                        <Play size={15} />
                        Ejecutar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle icon={<ShieldAlert size={20} />} title="Eventos del monitor" subtitle="Riesgos abiertos detectados en el ultimo escaneo." />

            <div className="mt-3 grid gap-3">
              {loading ? <LoadingBlock /> : null}
              {!loading && events.length === 0 ? <EmptyBlock text="No hay eventos abiertos." /> : null}

              {events.map((event) => (
                <article key={event.id} className="rounded-[22px] border border-white/10 bg-slate-950/80 p-4 shadow-xl shadow-black/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cx("rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]", severityTone(event.severity))}>
                          {event.severity}
                        </span>
                        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-black text-slate-300">
                          {event.riskScore}% riesgo
                        </span>
                      </div>
                      <h2 className="mt-3 text-base font-black text-white">{event.title}</h2>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{event.summary}</p>
                      <ActionPlan payload={event.payload} compact />
                      <p className="mt-3 text-xs font-bold text-slate-500">{normalizeModule(event.module)} - {formatDate(event.createdAt)}</p>
                    </div>
                    <Eye className="mt-1 shrink-0 text-cyan-300" size={18} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateEvent(event, "acknowledged")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-500/20"
                    >
                      Revisado
                    </button>
                    <button
                      type="button"
                      onClick={() => updateEvent(event, "resolved")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-500/20"
                    >
                      Resolver
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ActionPlan({ payload, compact = false }: { payload?: Record<string, any>; compact?: boolean }) {
  const pricing = payload?.pricing;
  if (!pricing) return null;

  const steps = Array.isArray(pricing.nextSteps) ? pricing.nextSteps.slice(0, compact ? 2 : 4) : [];
  const evidence = Array.isArray(pricing.evidence) ? pricing.evidence.slice(0, compact ? 1 : 3) : [];

  return (
    <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.07] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">Accion IA propuesta</p>
      <p className="mt-2 text-sm font-black leading-6 text-white">{pricing.actionSummary}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniMetric label="Costo actual" value={formatMoney(pricing.currentCost)} tone="slate" />
        <MiniMetric label="Costo sugerido" value={formatMoney(pricing.suggestedCost)} tone="amber" />
        <MiniMetric label="Venta sugerida" value={formatMoney(pricing.suggestedPrice)} tone="emerald" />
      </div>

      {!compact && pricing.basis ? (
        <p className="mt-3 text-xs font-semibold leading-5 text-slate-300">{pricing.basis}</p>
      ) : null}

      {evidence.length ? (
        <div className="mt-3 grid gap-2">
          {evidence.map((item: any, index: number) => (
            <div key={`${item.source}-${index}`} className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs font-bold leading-5 text-slate-200">
              <span className="text-cyan-200">{item.source}</span>
              <span className="text-slate-500"> - </span>
              <span>{item.observations || 1} dato(s)</span>
              <span className="text-slate-500"> - </span>
              <span>confianza {Math.round(Number(item.confidence || 0) * 100)}%</span>
            </div>
          ))}
        </div>
      ) : null}

      {steps.length ? (
        <div className="mt-3 grid gap-2">
          {steps.map((step: string, index: number) => (
            <div key={`${step}-${index}`} className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs font-bold leading-5 text-slate-200">
              {index + 1}. {step}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: "slate" | "amber" | "emerald" }) {
  const color =
    tone === "amber"
      ? "border-amber-400/25 bg-amber-500/10 text-amber-100"
      : tone === "emerald"
        ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
        : "border-slate-500/25 bg-slate-500/10 text-slate-100";

  return (
    <div className={cx("rounded-xl border px-3 py-2", color)}>
      <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function Kpi({ title, value, icon, tone }: { title: string; value: string | number; icon: React.ReactNode; tone: "cyan" | "red" | "amber" | "purple" }) {
  const color =
    tone === "red"
      ? "border-red-400/25 bg-red-500/10 text-red-200"
      : tone === "amber"
        ? "border-amber-400/25 bg-amber-500/10 text-amber-200"
        : tone === "purple"
          ? "border-purple-400/25 bg-purple-500/10 text-purple-200"
          : "border-cyan-400/25 bg-cyan-500/10 text-cyan-200";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/75 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
        </div>
        <div className={cx("rounded-2xl border p-3", color)}>{icon}</div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-3 text-cyan-200">{icon}</div>
      <div>
        <h2 className="text-xl font-black text-white">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center gap-3 rounded-[22px] border border-white/10 bg-slate-950/70 p-8 text-sm font-bold text-slate-300">
      <Loader2 className="animate-spin text-cyan-300" size={20} />
      Cargando IA...
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-[22px] border border-emerald-400/25 bg-emerald-500/10 p-6 text-sm font-bold text-emerald-100">
      {text}
    </div>
  );
}
