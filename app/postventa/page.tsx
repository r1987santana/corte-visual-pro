"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Ticket = {
  id: string;
  ticket_code?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  resolved_client_name?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  issue_title?: string | null;
  issue_description?: string | null;
  issue_category?: string | null;
  priority?: string | null;
  status?: string | null;
  warranty_related?: boolean | null;
  ai_classification?: string | null;
  ai_risk_score?: number | null;
  assigned_to?: string | null;
  opened_at?: string | null;
  warranty_code?: string | null;
  warranty_status?: string | null;
  evidence_count?: number | null;
  visit_count?: number | null;
};

type Dashboard = {
  total_tickets: number;
  abiertos: number;
  en_proceso: number;
  programados: number;
  cerrados: number;
  en_garantia: number;
  prioridad_alta: number;
  riesgo_promedio: number;
};

const defaultDash: Dashboard = {
  total_tickets: 0,
  abiertos: 0,
  en_proceso: 0,
  programados: 0,
  cerrados: 0,
  en_garantia: 0,
  prioridad_alta: 0,
  riesgo_promedio: 0,
};

const statusOptions = [
  { value: "abierto", label: "Abierto" },
  { value: "en_revision", label: "En revision" },
  { value: "en_proceso", label: "En proceso" },
  { value: "programado", label: "Programado" },
  { value: "cerrado", label: "Cerrado" },
];

function classifyIssue(text: string) {
  const s = text.toLowerCase();

  if (s.includes("agua") || s.includes("humedad") || s.includes("hinchado") || s.includes("mojado")) {
    return { category: "humedad", priority: "alta", ai: "Riesgo por humedad", score: 90 };
  }

  if (s.includes("roto") || s.includes("urgente") || s.includes("danado") || s.includes("dañado")) {
    return { category: "critico", priority: "alta", ai: "Caso critico", score: 88 };
  }

  if (s.includes("bisagra") || s.includes("puerta") || s.includes("corredera") || s.includes("herraje")) {
    return { category: "herrajes", priority: "media", ai: "Ajuste de herrajes", score: 62 };
  }

  if (s.includes("rayado") || s.includes("golpe") || s.includes("mancha") || s.includes("terminacion")) {
    return { category: "acabado", priority: "media", ai: "Acabado / terminacion", score: 55 };
  }

  return { category: "general", priority: "media", ai: "Postventa general", score: 50 };
}

function fmtDate(date?: string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" });
}

function phoneDigits(phone?: string | null) {
  return (phone || "").replace(/[^0-9]/g, "");
}

function computeDash(tickets: Ticket[]): Dashboard {
  const isStatus = (t: Ticket, statuses: string[]) => statuses.includes(String(t.status || "").toLowerCase());
  const risks = tickets.map((t) => Number(t.ai_risk_score || 0)).filter((n) => n > 0);

  return {
    total_tickets: tickets.length,
    abiertos: tickets.filter((t) => isStatus(t, ["abierto", "open", "recibido"])).length,
    en_proceso: tickets.filter((t) => isStatus(t, ["en_revision", "en_proceso", "in_progress"])).length,
    programados: tickets.filter((t) => isStatus(t, ["programado", "scheduled"])).length,
    cerrados: tickets.filter((t) => isStatus(t, ["cerrado", "closed", "resuelto"])).length,
    en_garantia: tickets.filter((t) => Boolean(t.warranty_related || t.warranty_code)).length,
    prioridad_alta: tickets.filter((t) => String(t.priority || "").toLowerCase() === "alta").length,
    riesgo_promedio: risks.length ? Math.round(risks.reduce((sum, n) => sum + n, 0) / risks.length) : 0,
  };
}

export default function PostventaPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard>(defaultDash);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("Tecnico RD Wood");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return tickets;

    return tickets.filter((t) =>
      [
        t.ticket_code,
        t.project_name,
        t.resolved_client_name,
        t.client_name,
        t.client_phone,
        t.issue_title,
        t.issue_category,
        t.status,
        t.priority,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [tickets, query]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setNotice(null);

    const ticketRes = await supabase
      .from("v_after_sales_tickets_full")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(100);

    if (ticketRes.error) {
      setNotice({ tone: "error", text: `Error cargando postventa: ${ticketRes.error.message}` });
      setLoading(false);
      return;
    }

    const nextTickets = (ticketRes.data || []) as Ticket[];
    setTickets(nextTickets);
    setSelected((current) => {
      if (!nextTickets.length) return null;
      return nextTickets.find((ticket) => ticket.id === current?.id) || nextTickets[0];
    });

    const dashRes = await supabase.from("v_after_sales_dashboard").select("*").maybeSingle();
    setDashboard(dashRes.data ? (dashRes.data as Dashboard) : computeDash(nextTickets));
    setLoading(false);
  }

  async function createTicket() {
    if (!issueTitle.trim()) {
      setNotice({ tone: "error", text: "Escribe el problema del cliente antes de crear el ticket." });
      return;
    }

    const ai = classifyIssue(`${issueTitle} ${issueDescription}`);
    setLoading(true);

    const { error } = await supabase.from("after_sales_tickets").insert({
      client_name: clientName.trim() || "Cliente general",
      client_phone: clientPhone.trim() || null,
      issue_title: issueTitle.trim(),
      issue_description: issueDescription.trim() || null,
      issue_category: ai.category,
      priority: ai.priority,
      status: "abierto",
      warranty_related: true,
      ai_classification: ai.ai,
      ai_risk_score: ai.score,
      assigned_to: assignedTo.trim() || "Tecnico RD Wood",
      due_at: ai.priority === "alta" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
    });

    setLoading(false);

    if (error) {
      setNotice({ tone: "error", text: `Error creando ticket: ${error.message}` });
      return;
    }

    setClientName("");
    setClientPhone("");
    setIssueTitle("");
    setIssueDescription("");
    setNotice({ tone: "success", text: "Ticket creado y clasificado por IA operativa." });
    await loadData();
  }

  async function updateStatus(status: string) {
    if (!selected) return;

    setLoading(true);
    const { error } = await supabase
      .from("after_sales_tickets")
      .update({
        status,
        closed_at: status === "cerrado" ? new Date().toISOString() : null,
      })
      .eq("id", selected.id);
    setLoading(false);

    if (error) {
      setNotice({ tone: "error", text: `Error actualizando estado: ${error.message}` });
      return;
    }

    setNotice({ tone: "success", text: `Ticket actualizado a ${status.replace("_", " ")}.` });
    await loadData();
  }

  async function scheduleVisit() {
    if (!selected) return;

    setLoading(true);
    const { error } = await supabase.from("after_sales_service_visits").insert({
      ticket_id: selected.id,
      technician_name: selected.assigned_to || "Tecnico RD Wood",
      scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      visit_status: "programada",
      findings: "Visita programada desde Postventa PRO",
    });

    if (!error) {
      await supabase.from("after_sales_tickets").update({ status: "programado" }).eq("id", selected.id);
    }
    setLoading(false);

    if (error) {
      setNotice({ tone: "error", text: `Error programando visita: ${error.message}` });
      return;
    }

    setNotice({ tone: "success", text: "Visita tecnica programada para el proximo dia laboral." });
    await loadData();
  }

  const selectedPhone = phoneDigits(selected?.client_phone);
  const selectedRisk = Number(selected?.ai_risk_score || 0);
  const selectedStatus = String(selected?.status || "abierto").toLowerCase();

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="mx-auto max-w-[1540px] px-6 py-8">
        <div className="rounded-[28px] border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,47,73,.88),rgba(15,23,42,.96)_45%,rgba(30,41,59,.88))] p-8 shadow-2xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.32em] text-cyan-100">
                <ShieldCheck size={16} />
                Postventa operativa
              </div>
              <h1 className="mt-5 max-w-5xl text-5xl font-black leading-tight">Postventa y Garantias PRO</h1>
              <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-300">
                Centro unico para reclamos, garantia activa, visitas tecnicas, evidencias, costos y cierre de casos.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a href="/postventa/agenda" className="btn-secondary">
                <CalendarClock size={18} />
                Agenda
              </a>
              <a href="/postventa/costos-garantia" className="btn-secondary">
                <Wrench size={18} />
                Costos
              </a>
              <button onClick={loadData} className="btn-primary">
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                Actualizar
              </button>
            </div>
          </div>
        </div>

        {notice && (
          <div
            className={[
              "mt-5 rounded-2xl border px-5 py-4 text-sm font-black",
              notice.tone === "success"
                ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                : "border-red-300/30 bg-red-400/10 text-red-100",
            ].join(" ")}
          >
            {notice.text}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <Metric title="Tickets" value={dashboard.total_tickets} icon={<FileText />} />
          <Metric title="Abiertos" value={dashboard.abiertos} icon={<AlertTriangle />} tone="amber" />
          <Metric title="Proceso" value={dashboard.en_proceso} icon={<Wrench />} />
          <Metric title="Agenda" value={dashboard.programados} icon={<CalendarClock />} />
          <Metric title="Cerrados" value={dashboard.cerrados} icon={<CheckCircle2 />} tone="green" />
          <Metric title="Garantia" value={dashboard.en_garantia} icon={<ShieldCheck />} />
          <Metric title="Alta" value={dashboard.prioridad_alta} icon={<AlertTriangle />} tone="red" />
          <Metric title="Riesgo IA" value={`${dashboard.riesgo_promedio || 0}%`} icon={<Sparkles />} />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)_420px]">
          <section className="panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Entrada controlada</p>
                <h2 className="mt-2 text-2xl font-black">Nuevo ticket</h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">IA clasifica prioridad y riesgo inicial.</p>
              </div>
              <Sparkles className="text-cyan-200" />
            </div>

            <div className="mt-5 space-y-3">
              <Input value={clientName} onChange={setClientName} placeholder="Cliente" />
              <Input value={clientPhone} onChange={setClientPhone} placeholder="Telefono / WhatsApp" />
              <Input value={issueTitle} onChange={setIssueTitle} placeholder="Titulo del problema" />
              <Textarea value={issueDescription} onChange={setIssueDescription} placeholder="Descripcion del problema, evidencia o contexto..." />
              <Input value={assignedTo} onChange={setAssignedTo} placeholder="Asignado a" />
              <button onClick={createTicket} className="btn-primary w-full">
                <Plus size={18} />
                Crear ticket
              </button>
            </div>
          </section>

          <section className="panel min-w-0">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="eyebrow">Bandeja real</p>
                <h2 className="mt-2 text-2xl font-black">Tickets de postventa</h2>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar ticket, cliente, telefono..."
                  className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950 pl-11 pr-4 text-sm font-semibold outline-none focus:border-cyan-300 lg:w-80"
                />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {!filtered.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-10 text-center text-sm font-semibold text-slate-500">
                  No hay tickets registrados.
                </div>
              ) : (
                filtered.map((ticket) => {
                  const active = selected?.id === ticket.id;
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => setSelected(ticket)}
                      className={[
                        "w-full rounded-2xl border p-4 text-left transition",
                        active ? "border-cyan-300/70 bg-cyan-400/10" : "border-white/10 bg-slate-950/50 hover:border-cyan-300/30",
                      ].join(" ")}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">{ticket.ticket_code || "SAT"}</p>
                          <h3 className="mt-2 text-lg font-black text-white">{ticket.issue_title || "Incidencia sin titulo"}</h3>
                          <p className="mt-1 text-sm font-semibold text-slate-400">
                            {ticket.resolved_client_name || ticket.client_name || "Cliente"} · {ticket.project_name || "Sin proyecto"}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Badge tone={ticket.priority === "alta" ? "red" : "cyan"}>{ticket.priority || "media"}</Badge>
                          <Badge tone={String(ticket.status || "").toLowerCase() === "cerrado" ? "green" : "blue"}>{ticket.status || "abierto"}</Badge>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="panel">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">Detalle ejecutivo</p>
                    <h2 className="mt-2 text-3xl font-black">{selected.ticket_code || "SAT"}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-400">{selected.issue_title || "Incidencia"}</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Riesgo</p>
                    <p className="mt-1 text-2xl font-black">{selectedRisk}%</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Info label="Cliente" value={selected.resolved_client_name || selected.client_name || "-"} />
                  <Info label="Telefono" value={selected.client_phone || "-"} />
                  <Info label="Proyecto" value={selected.project_name || "-"} />
                  <Info label="Asignado" value={selected.assigned_to || "-"} />
                  <Info label="Garantia" value={selected.warranty_code || (selected.warranty_related ? "Relacionada" : "-")} />
                  <Info label="Abierto" value={fmtDate(selected.opened_at)} />
                  <Info label="Evidencias" value={String(selected.evidence_count || 0)} />
                  <Info label="Visitas" value={String(selected.visit_count || 0)} />
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <p className="eyebrow">Lectura IA</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                    {selected.ai_classification || selected.issue_category || "Clasificacion pendiente"}.{" "}
                    {selectedRisk >= 80
                      ? "Atender en menos de 24 horas y documentar evidencia."
                      : selectedStatus === "cerrado"
                      ? "Caso cerrado. Verifica que tenga evidencia y costo si aplico garantia."
                      : "Mantener seguimiento hasta visita tecnica o cierre confirmado."}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {statusOptions.map((status) => (
                    <button key={status.value} onClick={() => updateStatus(status.value)} className="btn-dark">
                      {status.label}
                    </button>
                  ))}
                  <button onClick={scheduleVisit} className="btn-primary">
                    <CalendarClock size={16} />
                    Agendar visita
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <a
                    href={selectedPhone ? `https://wa.me/${selectedPhone}` : "#"}
                    target={selectedPhone ? "_blank" : undefined}
                    className="btn-success"
                  >
                    <MessageCircle size={16} />
                    WhatsApp
                  </a>
                  <a href="/postventa/agenda" className="btn-secondary">
                    <Clock3 size={16} />
                    Agenda
                  </a>
                  <a href={`/postventa/tickets/${selected.id}`} className="btn-secondary">
                    <Wrench size={16} />
                    Tecnico
                  </a>
                  <a href="/postventa/costos-garantia" className="btn-secondary">
                    <ShieldCheck size={16} />
                    Costo garantia
                  </a>
                </div>
              </>
            ) : (
              <div className="flex min-h-[560px] flex-col items-center justify-center text-center text-slate-500">
                <UserRound size={52} />
                <h3 className="mt-4 text-2xl font-black text-white">Selecciona un ticket</h3>
                <p className="mt-2 text-sm">Veras garantia, riesgo, evidencias, visitas y acciones.</p>
              </div>
            )}
          </section>
        </div>
      </section>

      <style jsx>{`
        .panel {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 28px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.82), rgba(2, 6, 23, 0.72));
          padding: 20px;
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.22);
        }
        .eyebrow {
          color: rgb(103, 232, 249);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.26em;
          text-transform: uppercase;
        }
        .btn-primary,
        .btn-secondary,
        .btn-success,
        .btn-dark {
          display: inline-flex;
          min-height: 48px;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 16px;
          padding: 12px 16px;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .btn-primary {
          background: linear-gradient(135deg, #22d3ee, #2dd4bf);
          color: #020617;
        }
        .btn-secondary {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.86);
          color: #e2e8f0;
        }
        .btn-success {
          background: linear-gradient(135deg, #34d399, #10b981);
          color: #020617;
        }
        .btn-dark {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(2, 6, 23, 0.75);
          color: #e2e8f0;
        }
      `}</style>
    </main>
  );
}

function Metric({
  title,
  value,
  icon,
  tone = "cyan",
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: "cyan" | "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-300/20 text-emerald-200"
      : tone === "amber"
      ? "border-amber-300/20 text-amber-200"
      : tone === "red"
      ? "border-red-300/20 text-red-200"
      : "border-cyan-300/20 text-cyan-200";

  return (
    <div className={`rounded-3xl border bg-slate-950/55 p-5 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">{title}</p>
        <div className="rounded-2xl bg-white/5 p-3">{icon}</div>
      </div>
      <div className="mt-4 truncate text-3xl font-black text-white">{value}</div>
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-13 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
    />
  );
}

function Textarea({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
    />
  );
}

function Badge({ children, tone = "cyan" }: { children: React.ReactNode; tone?: "cyan" | "green" | "red" | "blue" }) {
  const cls =
    tone === "green"
      ? "border-emerald-300/20 bg-emerald-400/15 text-emerald-200"
      : tone === "red"
      ? "border-red-300/20 bg-red-400/15 text-red-200"
      : tone === "blue"
      ? "border-blue-300/20 bg-blue-400/15 text-blue-200"
      : "border-cyan-300/20 bg-cyan-400/15 text-cyan-200";

  return <div className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${cls}`}>{children}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{label}</div>
      <div className="mt-2 break-words text-sm font-black text-white">{value}</div>
    </div>
  );
}
