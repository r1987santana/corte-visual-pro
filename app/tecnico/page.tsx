"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Visit = {
  id: string;
  visit_code: string;
  ticket_id: string;
  ticket_code?: string | null;
  issue_title?: string | null;
  issue_description?: string | null;
  priority?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  project_name?: string | null;
  resolved_client_name?: string | null;
  technician_name?: string | null;
  scheduled_at?: string | null;
  route_address?: string | null;
  visit_status?: string | null;
  client_confirmed?: boolean | null;
  before_count?: number | null;
  after_count?: number | null;
};

type Dash = {
  total: number;
  pendientes: number;
  en_ruta: number;
  en_sitio: number;
  completadas: number;
  hoy: number;
};

const defaultDash: Dash = {
  total: 0,
  pendientes: 0,
  en_ruta: 0,
  en_sitio: 0,
  completadas: 0,
  hoy: 0,
};

function fmtDate(date?: string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleString("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function TecnicoMobileAppPage() {
  const [dash, setDash] = useState<Dash>(defaultDash);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
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

    const d = await supabase.from("v_technician_mobile_dashboard").select("*").maybeSingle();
    if (d.data) setDash(d.data as Dash);

    const v = await supabase
      .from("v_technician_mobile_visits")
      .select("*")
      .order("scheduled_at", { ascending: true })
      .limit(100);

    setVisits((v.data || []) as Visit[]);
    setLoading(false);
  }

  function mapsLink(address?: string | null) {
    const q = encodeURIComponent(address || "RD Wood Design La Romana");
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  function phoneLink(phone?: string | null) {
    const p = String(phone || "+18096905636").replace(/[^0-9+]/g, "");
    return `tel:${p}`;
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="mx-auto max-w-xl px-4 py-5">
        <div className="rounded-[34px] border border-cyan-400/20 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 p-6 shadow-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">
            <Sparkles size={14} />
            Fase 43.4 · Técnico
          </div>
          <h1 className="mt-5 text-4xl font-black leading-tight">App Móvil del Técnico PRO</h1>
          <p className="mt-3 text-sm font-semibold text-slate-300">
            Visitas, GPS, fotos antes/después, solución y cierre desde el celular.
          </p>

          <button
            onClick={loadData}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-black uppercase text-slate-950"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric title="Hoy" value={dash.hoy} icon={<Clock />} />
          <Metric title="Pendientes" value={dash.pendientes} icon={<CalendarClock />} />
          <Metric title="En sitio" value={dash.en_sitio} icon={<MapPin />} />
          <Metric title="Completadas" value={dash.completadas} icon={<CheckCircle2 />} />
        </div>

        <div className="sticky top-0 z-10 mt-5 bg-[#050816]/90 py-3 backdrop-blur">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar visita, cliente o ticket..."
              className="w-full rounded-2xl border border-white/10 bg-slate-950 py-4 pl-11 pr-4 text-sm font-semibold outline-none focus:border-cyan-300"
            />
          </div>
        </div>

        <div className="mt-3 space-y-4">
          {filtered.length === 0 ? (
            <div className="rounded-[30px] border border-dashed border-white/15 bg-white/[0.04] p-10 text-center text-slate-400">
              <UserRound className="mx-auto mb-3" />
              No hay visitas asignadas.
            </div>
          ) : (
            filtered.map((v) => (
              <div key={v.id} className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">{v.visit_code}</div>
                    <h2 className="mt-2 text-2xl font-black">{v.issue_title}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-400">{v.ticket_code}</p>
                  </div>
                  <Badge status={v.visit_status || "programada"} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Info label="Cliente" value={v.resolved_client_name || v.client_name || "-"} />
                  <Info label="Proyecto" value={v.project_name || "-"} />
                  <Info label="Fecha" value={fmtDate(v.scheduled_at)} />
                  <Info label="Prioridad" value={v.priority || "media"} />
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-1 text-amber-300" size={18} />
                    <p className="text-sm font-semibold leading-6 text-slate-300">
                      {v.issue_description || "Sin descripción del problema."}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <a href={phoneLink(v.client_phone)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-3 text-xs font-black uppercase">
                    <Phone size={15} />
                    Llamar
                  </a>

                  <a href={mapsLink(v.route_address)} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-3 py-3 text-xs font-black uppercase text-slate-950">
                    <Navigation size={15} />
                    Ruta
                  </a>

                  <a href={`/tecnico/visita/${v.id}`} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-3 py-3 text-xs font-black uppercase text-slate-950">
                    <Wrench size={15} />
                    Abrir
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value, icon }: { title: string; value: any; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between text-cyan-200">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">{title}</p>
        <div className="opacity-80">{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-black">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 break-words text-xs font-black">{value}</div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls = s.includes("completada")
    ? "bg-emerald-400/15 text-emerald-200 border-emerald-300/20"
    : s.includes("sitio")
    ? "bg-amber-400/15 text-amber-200 border-amber-300/20"
    : "bg-cyan-400/15 text-cyan-200 border-cyan-300/20";

  return <div className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${cls}`}>{status.replace("_", " ")}</div>;
}
