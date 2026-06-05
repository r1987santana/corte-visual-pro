"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Technician = {
  id: string;
  full_name: string;
  phone?: string | null;
  specialty?: string | null;
};

type OpenTicket = {
  id: string;
  ticket_code: string;
  issue_title: string;
  priority?: string | null;
  status?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  project_name?: string | null;
  resolved_client_name?: string | null;
  available_for_schedule?: boolean;
};

type Visit = {
  id: string;
  visit_code: string;
  ticket_id: string;
  ticket_code?: string | null;
  issue_title?: string | null;
  priority?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  project_name?: string | null;
  resolved_client_name?: string | null;
  technician_name?: string | null;
  technician_id?: string | null;
  scheduled_at?: string | null;
  estimated_duration_minutes?: number | null;
  route_address?: string | null;
  visit_status?: string | null;
  findings?: string | null;
  solution_applied?: string | null;
  client_confirmed?: boolean | null;
  photo_count?: number | null;
  before_count?: number | null;
  after_count?: number | null;
};

type Dash = {
  total_visitas: number;
  programadas: number;
  confirmadas: number;
  en_ruta: number;
  en_sitio: number;
  completadas: number;
  canceladas: number;
  hoy: number;
};

const defaultDash: Dash = {
  total_visitas: 0,
  programadas: 0,
  confirmadas: 0,
  en_ruta: 0,
  en_sitio: 0,
  completadas: 0,
  canceladas: 0,
  hoy: 0,
};

function fmtDate(date?: string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleString("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function tomorrowAt(hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function AgendaVisitasTecnicasProPage() {
  const [dash, setDash] = useState<Dash>(defaultDash);
  const [tickets, setTickets] = useState<OpenTicket[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<OpenTicket | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [technicianId, setTechnicianId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(tomorrowAt(9));
  const [routeAddress, setRouteAddress] = useState("");
  const [duration, setDuration] = useState(90);

  const filteredVisits = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return visits;

    return visits.filter((v) =>
      [
        v.visit_code,
        v.ticket_code,
        v.issue_title,
        v.client_name,
        v.resolved_client_name,
        v.project_name,
        v.technician_name,
        v.visit_status,
      ]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q))
    );
  }, [visits, query]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const d = await supabase.from("v_after_sales_agenda_dashboard").select("*").maybeSingle();
    if (d.data) setDash(d.data as Dash);

    const t = await supabase
      .from("v_after_sales_open_tickets_for_agenda")
      .select("*")
      .eq("available_for_schedule", true)
      .order("opened_at", { ascending: false })
      .limit(50);

    setTickets((t.data || []) as OpenTicket[]);
    if (!selectedTicket && t.data?.[0]) setSelectedTicket(t.data[0] as OpenTicket);

    const v = await supabase
      .from("v_after_sales_agenda_full")
      .select("*")
      .order("scheduled_at", { ascending: true })
      .limit(100);

    setVisits((v.data || []) as Visit[]);
    if (!selectedVisit && v.data?.[0]) setSelectedVisit(v.data[0] as Visit);

    const tech = await supabase
      .from("after_sales_technicians")
      .select("*")
      .eq("is_active", true)
      .order("full_name");

    setTechnicians((tech.data || []) as Technician[]);
    if (!technicianId && tech.data?.[0]) setTechnicianId(tech.data[0].id);

    setLoading(false);
  }

  async function scheduleVisit() {
    if (!selectedTicket) {
      alert("Selecciona un ticket.");
      return;
    }

    const tech = technicians.find((x) => x.id === technicianId);

    const { error } = await supabase.from("after_sales_service_visits").insert({
      ticket_id: selectedTicket.id,
      technician_id: technicianId || null,
      technician_name: tech?.full_name || "Técnico RD Wood",
      scheduled_at: new Date(scheduledAt).toISOString(),
      estimated_duration_minutes: duration,
      route_address: routeAddress,
      visit_status: "programada",
      confirmation_channel: "whatsapp",
      confirmation_sent_at: new Date().toISOString(),
      findings: "Visita programada desde Agenda Inteligente PRO",
    });

    if (error) {
      alert("Error programando visita: " + error.message);
      return;
    }

    alert("✅ Visita técnica programada.");
    setRouteAddress("");
    setScheduledAt(tomorrowAt(9));
    await loadData();
  }

  async function updateVisitStatus(status: string) {
    if (!selectedVisit) return;

    const patch: any = { visit_status: status };

    if (status === "confirmada") patch.client_confirmed = true;
    if (status === "en_sitio") patch.arrival_at = new Date().toISOString();
    if (status === "en_proceso") patch.started_at = new Date().toISOString();
    if (status === "completada") patch.completed_at = new Date().toISOString();

    const { error } = await supabase
      .from("after_sales_service_visits")
      .update(patch)
      .eq("id", selectedVisit.id);

    if (error) {
      alert("Error actualizando visita: " + error.message);
      return;
    }

    await loadData();
    setSelectedVisit({ ...selectedVisit, visit_status: status });
  }

  function whatsappLink(v?: Visit | null) {
    const phone = (v?.client_phone || "18096905636").replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(
      `Hola, le confirmamos visita técnica RD Wood para su ticket ${v?.ticket_code || ""}. Fecha: ${fmtDate(v?.scheduled_at)}. Técnico: ${v?.technician_name || "RD Wood"}.`
    );
    return `https://wa.me/${phone}?text=${msg}`;
  }

  function mapsLink(address?: string | null) {
    const q = encodeURIComponent(address || "RD Wood Design La Romana");
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-[34px] border border-cyan-400/20 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 p-8 shadow-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-cyan-200">
                <Sparkles size={16} />
                Fase 43.3 · Agenda IA
              </div>
              <h1 className="mt-5 text-5xl font-black">Agenda Inteligente de Visitas Técnicas PRO</h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold text-slate-300">
                Programa visitas desde tickets de garantía, asigna técnicos, confirma por WhatsApp, abre ruta y controla evidencia antes/después.
              </p>
            </div>

            <button onClick={loadData} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white px-5 py-4 text-sm font-black uppercase text-slate-950">
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4 lg:grid-cols-8">
          <Metric title="Visitas" value={dash.total_visitas} icon={<CalendarClock />} />
          <Metric title="Hoy" value={dash.hoy} icon={<Clock />} />
          <Metric title="Programadas" value={dash.programadas} icon={<CalendarClock />} />
          <Metric title="Confirmadas" value={dash.confirmadas} icon={<ShieldCheck />} />
          <Metric title="En ruta" value={dash.en_ruta} icon={<Route />} />
          <Metric title="En sitio" value={dash.en_sitio} icon={<MapPin />} />
          <Metric title="Completadas" value={dash.completadas} icon={<CheckCircle2 />} />
          <Metric title="Canceladas" value={dash.canceladas} icon={<XCircle />} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[380px_1fr_390px]">
          <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-2xl font-black">Programar visita</h2>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              Selecciona un ticket abierto y asigna técnico.
            </p>

            <div className="mt-5 space-y-3">
              <select
                value={selectedTicket?.id || ""}
                onChange={(e) => setSelectedTicket(tickets.find((x) => x.id === e.target.value) || null)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-300"
              >
                <option value="">Seleccionar ticket</option>
                {tickets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.ticket_code} · {t.issue_title}
                  </option>
                ))}
              </select>

              <select
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-300"
              >
                <option value="">Seleccionar técnico</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} · {t.specialty || "general"}
                  </option>
                ))}
              </select>

              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-300"
              />

              <input
                value={routeAddress}
                onChange={(e) => setRouteAddress(e.target.value)}
                placeholder="Dirección / referencia de ruta"
                className="w-full rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-300"
              />

              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value || 90))}
                placeholder="Duración minutos"
                className="w-full rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-300"
              />

              {selectedTicket && (
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                  <div className="font-black text-cyan-100">{selectedTicket.ticket_code}</div>
                  <div className="mt-1 text-sm font-semibold">{selectedTicket.issue_title}</div>
                  <div className="mt-2 text-xs text-slate-300">{selectedTicket.resolved_client_name || selectedTicket.client_name}</div>
                </div>
              )}

              <button onClick={scheduleVisit} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-4 text-sm font-black uppercase text-slate-950">
                <CalendarClock size={18} />
                Programar visita
              </button>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black">Agenda de visitas</h2>
                <p className="text-sm font-semibold text-slate-400">Seguimiento operativo de postventa.</p>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar visita..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-cyan-300 md:w-72"
                />
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
              <div className="grid grid-cols-[1fr_140px_130px_120px] bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-[0.25em] text-slate-500">
                <div>Visita</div>
                <div>Técnico</div>
                <div>Fecha</div>
                <div>Estado</div>
              </div>

              <div className="max-h-[640px] overflow-auto">
                {filteredVisits.length === 0 ? (
                  <div className="p-10 text-center text-slate-500">Sin visitas programadas.</div>
                ) : (
                  filteredVisits.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVisit(v)}
                      className={[
                        "grid w-full grid-cols-[1fr_140px_130px_120px] items-center border-t border-white/5 px-4 py-4 text-left transition hover:bg-cyan-400/5",
                        selectedVisit?.id === v.id ? "bg-cyan-400/10" : "",
                      ].join(" ")}
                    >
                      <div>
                        <div className="font-black text-cyan-200">{v.visit_code}</div>
                        <div className="mt-1 text-sm font-bold">{v.ticket_code} · {v.issue_title}</div>
                        <div className="mt-1 text-xs text-slate-500">{v.resolved_client_name || v.client_name}</div>
                      </div>
                      <div className="text-sm font-bold">{v.technician_name || "-"}</div>
                      <div className="text-xs font-semibold text-slate-300">{fmtDate(v.scheduled_at)}</div>
                      <Badge tone={v.visit_status === "completada" ? "green" : v.visit_status === "cancelada" ? "red" : "cyan"}>
                        {v.visit_status || "programada"}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
            {selectedVisit ? (
              <>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200">Visita seleccionada</p>
                <h2 className="mt-2 text-3xl font-black">{selectedVisit.visit_code}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">{selectedVisit.issue_title}</p>

                <div className="mt-5 space-y-3">
                  <Info label="Ticket" value={selectedVisit.ticket_code || "-"} />
                  <Info label="Cliente" value={selectedVisit.resolved_client_name || selectedVisit.client_name || "-"} />
                  <Info label="Proyecto" value={selectedVisit.project_name || "-"} />
                  <Info label="Técnico" value={selectedVisit.technician_name || "-"} />
                  <Info label="Programada" value={fmtDate(selectedVisit.scheduled_at)} />
                  <Info label="Dirección" value={selectedVisit.route_address || "-"} />
                  <Info label="Fotos antes" value={String(selectedVisit.before_count || 0)} />
                  <Info label="Fotos después" value={String(selectedVisit.after_count || 0)} />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {["programada", "confirmada", "en_ruta", "en_sitio", "completada", "cancelada"].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateVisitStatus(s)}
                      className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-xs font-black uppercase hover:border-cyan-300"
                    >
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <a href={whatsappLink(selectedVisit)} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-400 px-4 py-3 text-xs font-black uppercase text-slate-950">
                    <MessageCircle size={16} />
                    Confirmar
                  </a>

                  <a href={mapsLink(selectedVisit.route_address)} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-xs font-black uppercase text-slate-950">
                    <Navigation size={16} />
                    Ruta
                  </a>

                  <a href={`/postventa/tickets/${selectedVisit.ticket_id}`} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-xs font-black uppercase">
                    <Wrench size={16} />
                    Abrir ejecución técnica
                  </a>
                </div>
              </>
            ) : (
              <div className="flex min-h-[560px] flex-col items-center justify-center text-center text-slate-500">
                <UserRound size={52} />
                <h3 className="mt-4 text-2xl font-black text-white">Selecciona una visita</h3>
                <p className="mt-2 text-sm">Verás técnico, ruta, confirmación y estados.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value, icon }: { title: string; value: any; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center justify-between text-cyan-200">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">{title}</p>
        <div className="opacity-80">{icon}</div>
      </div>
      <div className="mt-4 text-3xl font-black">{value}</div>
    </div>
  );
}

function Badge({ children, tone = "cyan" }: { children: React.ReactNode; tone?: "cyan" | "green" | "red" }) {
  const cls =
    tone === "green"
      ? "bg-emerald-400/15 text-emerald-200 border-emerald-300/20"
      : tone === "red"
      ? "bg-red-400/15 text-red-200 border-red-300/20"
      : "bg-cyan-400/15 text-cyan-200 border-cyan-300/20";

  return <div className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${cls}`}>{children}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-black">{value}</div>
    </div>
  );
}
