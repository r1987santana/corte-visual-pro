"use client";

// ============================================================================
// components/ai/AIAlertPanel.tsx
// RD WOOD SYSTEM - AI LIVE COMMAND CENTER
// FASE 37 · Operational Intelligence UI
// ============================================================================

import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Info,
  Layers3,
  Radar,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  AINotification,
  getAINotifications,
  markAINotificationAsRead,
} from "@/lib/ai/notification-center";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function severityStyles(severity: string) {
  switch (severity) {
    case "success":
      return {
        border: "border-emerald-400/30",
        bg: "bg-emerald-400/10",
        glow: "shadow-emerald-950/30",
        text: "text-emerald-300",
        dot: "bg-emerald-300",
        icon: CheckCircle2,
      };
    case "warning":
      return {
        border: "border-amber-400/30",
        bg: "bg-amber-400/10",
        glow: "shadow-amber-950/30",
        text: "text-amber-300",
        dot: "bg-amber-300",
        icon: AlertTriangle,
      };
    case "danger":
      return {
        border: "border-red-400/35",
        bg: "bg-red-400/10",
        glow: "shadow-red-950/30",
        text: "text-red-300",
        dot: "bg-red-300",
        icon: ShieldAlert,
      };
    default:
      return {
        border: "border-cyan-400/30",
        bg: "bg-cyan-400/10",
        glow: "shadow-cyan-950/30",
        text: "text-cyan-300",
        dot: "bg-cyan-300",
        icon: Info,
      };
  }
}

function priorityLabel(priority: string) {
  if (priority === "critical") return "CRÍTICA";
  if (priority === "high") return "ALTA";
  if (priority === "medium") return "MEDIA";
  return "BAJA";
}

function timeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const diff = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;

  return date.toLocaleDateString("es-DO");
}

function notificationStats(data: AINotification[]) {
  const active = data.filter((n) => !n.read);
  return {
    total: data.length,
    unread: active.length,
    critical: data.filter((n) => n.priority === "critical").length,
    high: data.filter((n) => n.priority === "high").length,
    riskScore: active.length
      ? Math.round(active.reduce((sum, n) => sum + Number(n.riskScore || 0), 0) / active.length)
      : 0,
  };
}

function decisionSummary(data: AINotification[]) {
  const active = data.filter((n) => !n.read);
  if (!active.length) {
    return {
      title: "Operación estable",
      message: "No hay alertas activas pendientes.",
      nextAction: "Continuar monitoreo.",
    };
  }

  const highest = [...active].sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0))[0];
  return {
    title: highest.title,
    message: highest.description || highest.recommendedAction || "Revisar alerta.",
    nextAction: highest.recommendedAction || "Abrir módulo relacionado.",
  };
}

function isDemoNotification(notification: AINotification) {
  const text = `${notification.title} ${notification.description || ""} ${JSON.stringify(notification.metadata || {})}`.toLowerCase();
  return (
    text.includes("mdf rh 18mm") ||
    text.includes("op-demo-001") ||
    text.includes("proyecto muestra") ||
    text.includes("orden lista para optimización") ||
    text.includes("orden lista para optimizacion")
  );
}

function RiskRing({ score }: { score: number }) {
  const value = Math.max(0, Math.min(100, score));
  const color =
    value >= 80 ? "#f87171" :
    value >= 60 ? "#f59e0b" :
    value >= 35 ? "#22d3ee" :
    "#10b981";

  return (
    <div
      className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${color} ${value * 3.6}deg, rgba(15,23,42,0.96) 0deg)`,
      }}
    >
      <div className="flex h-[74px] w-[74px] flex-col items-center justify-center rounded-full border border-white/10 bg-[#020617]">
        <span className="text-2xl font-black text-white">{value}</span>
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
          Riesgo
        </span>
      </div>
    </div>
  );
}

export default function AIAlertPanel() {
  const [notifications, setNotifications] = useState<AINotification[]>([]);
  const [filter, setFilter] = useState<"all" | "critical" | "unread">("all");

  useEffect(() => {
    const load = () => {
      const data =
        filter === "critical"
          ? getAINotifications({ priority: "critical", limit: 40 })
          : filter === "unread"
            ? getAINotifications({ unreadOnly: true, limit: 40 })
            : getAINotifications({ limit: 40 });

      setNotifications(data.filter((notification) => !isDemoNotification(notification)));
    };

    load();

    const interval = setInterval(load, 1800);

    return () => clearInterval(interval);
  }, [filter]);

  const stats = useMemo(() => notificationStats(notifications), [notifications]);
  const decision = useMemo(() => decisionSummary(notifications), [notifications]);

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-cyan-400/20 bg-[#020617]/95 p-5 text-white shadow-[0_0_70px_rgba(8,145,178,0.18)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_92%_10%,rgba(124,58,237,0.14),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />

      <div className="relative">
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-xl shadow-cyan-950/40">
              <BrainIcon />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.34em] text-cyan-300">
                AI Live Command
              </p>
              <h2 className="mt-1 truncate text-xl font-black text-white">
                Centro Inteligente
              </h2>
              <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                Feed operacional · decisiones · riesgos
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-right">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
              IA
            </p>
            <p className="text-xs font-black text-cyan-200">ONLINE</p>
          </div>
        </header>

        <div className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-center gap-4">
            <RiskRing score={stats.riskScore} />

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                <Radar size={13} className="text-cyan-300" />
                Decisión IA
              </div>

              <h3 className="text-sm font-black text-white">{decision.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-slate-400">
                {decision.message}
              </p>

              <div className="mt-3 rounded-2xl border border-cyan-400/15 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100">
                {decision.nextAction}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <MiniStat label="Total" value={stats.total} icon={<Bell size={13} />} />
          <MiniStat label="Nuevas" value={stats.unread} icon={<Zap size={13} />} />
          <MiniStat label="Críticas" value={stats.critical} danger icon={<ShieldAlert size={13} />} />
          <MiniStat label="Altas" value={stats.high} icon={<AlertTriangle size={13} />} />
        </div>

        <div className="mt-4 flex gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1">
          {[
            ["all", "Todas"],
            ["critical", "Críticas"],
            ["unread", "Nuevas"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key as any)}
              className={cx(
                "flex-1 rounded-xl px-3 py-2 text-xs font-black transition",
                filter === key
                  ? "bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-400/25"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {notifications.length <= 0 ? (
            <div className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-8 text-center">
              <CheckCircle2 className="mx-auto text-emerald-300" size={42} />
              <p className="mt-3 text-sm font-black text-emerald-200">
                Operación estable
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                No existen alertas activas para este filtro.
              </p>
            </div>
          ) : (
            notifications.map((notification) => {
              const styles = severityStyles(notification.severity);
              const Icon = styles.icon;

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    markAINotificationAsRead(notification.id);

                    if (notification.actionRoute) {
                      window.location.href = notification.actionRoute;
                    }
                  }}
                  className={cx(
                    "group relative w-full overflow-hidden rounded-[26px] border p-4 text-left shadow-xl transition-all hover:-translate-y-0.5 hover:scale-[1.005]",
                    styles.border,
                    styles.bg,
                    styles.glow
                  )}
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-white/5 via-current to-white/5 opacity-50" />

                  <div className="flex items-start gap-3">
                    <div className={cx("relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", styles.border, styles.bg, styles.text)}>
                      <Icon size={20} />
                      {!notification.read ? (
                        <span className={cx("absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-4 ring-[#020617]", styles.dot)} />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className={cx("rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]", styles.border, styles.text)}>
                              {priorityLabel(notification.priority)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                              {notification.category}
                            </span>
                          </div>

                          <h3 className="truncate text-sm font-black text-white">
                            {notification.title}
                          </h3>
                        </div>

                        <ChevronRight
                          size={16}
                          className="mt-1 shrink-0 text-slate-600 transition group-hover:text-cyan-300"
                        />
                      </div>

                      <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-slate-400">
                        {notification.description}
                      </p>

                      {notification.recommendedAction ? (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-[11px] font-bold leading-relaxed text-slate-300">
                          <span className="text-cyan-300">Acción:</span>{" "}
                          {notification.recommendedAction}
                        </div>
                      ) : null}

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2 text-[10px] font-bold text-slate-500">
                          <Activity size={12} />
                          <span className="truncate">{notification.source || "IA Industrial"}</span>
                          <span>•</span>
                          <span>{timeAgo(notification.createdAt)}</span>
                        </div>

                        <div className={cx("rounded-full px-2 py-1 text-[10px] font-black", styles.bg, styles.text)}>
                          {notification.riskScore}%
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function MiniStat({
  label,
  value,
  icon,
  danger = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border bg-white/[0.035] p-3",
        danger ? "border-red-400/20" : "border-white/10"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={danger ? "text-red-300" : "text-cyan-300"}>{icon}</span>
        <span className={cx("text-lg font-black", danger ? "text-red-300" : "text-white")}>
          {value}
        </span>
      </div>
      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">
        {label}
      </p>
    </div>
  );
}

function BrainIcon() {
  return (
    <div className="relative">
      <Cpu size={24} />
      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.8)]" />
    </div>
  );
}
