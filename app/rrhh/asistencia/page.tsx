"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Timer,
  UserCheck,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  employee_code?: string | null;
  full_name: string;
  department?: string | null;
  position?: string | null;
  status?: string | null;
  photo_url?: string | null;
};

type AttendanceEvent = {
  id: string;
  employee_id: string;
  event_type: "check_in" | "lunch_out" | "lunch_in" | "check_out";
  event_label?: string | null;
  confidence_score?: number | null;
  photo_url?: string | null;
  device_name?: string | null;
  location_text?: string | null;
  created_at: string;
  employees?: Employee | null;
};

type AttendanceRow = {
  employee: Employee;
  events: AttendanceEvent[];
  checkIn?: AttendanceEvent;
  lunchOut?: AttendanceEvent;
  lunchIn?: AttendanceEvent;
  checkOut?: AttendanceEvent;
  status: "presente" | "ausente" | "tarde" | "completo";
  workedMinutes: number;
  lateMinutes: number;
  avgConfidence: number;
};

const DEFAULT_ENTRY_TIME = "08:00";
const CURRENCY = new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" });

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleTimeString("es-DO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("es-DO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

function minutesToText(minutes: number) {
  const safe = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m}m`;
}

function dateTimeFor(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function eventLabel(type: string) {
  const labels: Record<string, string> = {
    check_in: "Entrada",
    lunch_out: "Salida almuerzo",
    lunch_in: "Regreso almuerzo",
    check_out: "Salida",
  };
  return labels[type] || type;
}

function pickEvent(events: AttendanceEvent[], type: AttendanceEvent["event_type"], mode: "first" | "last" = "first") {
  const filtered = events
    .filter((e) => e.event_type === type)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (!filtered.length) return undefined;
  return mode === "first" ? filtered[0] : filtered[filtered.length - 1];
}

function calcWorkedMinutes(checkIn?: AttendanceEvent, lunchOut?: AttendanceEvent, lunchIn?: AttendanceEvent, checkOut?: AttendanceEvent) {
  if (!checkIn) return 0;

  const start = new Date(checkIn.created_at).getTime();
  const end = checkOut ? new Date(checkOut.created_at).getTime() : Date.now();

  let lunch = 0;
  if (lunchOut && lunchIn) {
    lunch = new Date(lunchIn.created_at).getTime() - new Date(lunchOut.created_at).getTime();
  }

  return Math.max(0, Math.round((end - start - Math.max(0, lunch)) / 60000));
}

function calcLateMinutes(date: string, checkIn?: AttendanceEvent, entryTime = DEFAULT_ENTRY_TIME) {
  if (!checkIn) return 0;
  const entryLimit = dateTimeFor(date, entryTime).getTime();
  const actual = new Date(checkIn.created_at).getTime();
  return Math.max(0, Math.round((actual - entryLimit) / 60000));
}

function buildRows(employees: Employee[], events: AttendanceEvent[], selectedDate: string, entryTime: string) {
  const byEmployee = new Map<string, AttendanceEvent[]>();

  for (const event of events) {
    const current = byEmployee.get(event.employee_id) || [];
    current.push(event);
    byEmployee.set(event.employee_id, current);
  }

  return employees.map((employee) => {
    const empEvents = (byEmployee.get(employee.id) || []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const checkIn = pickEvent(empEvents, "check_in", "first");
    const lunchOut = pickEvent(empEvents, "lunch_out", "first");
    const lunchIn = pickEvent(empEvents, "lunch_in", "last");
    const checkOut = pickEvent(empEvents, "check_out", "last");

    const workedMinutes = calcWorkedMinutes(checkIn, lunchOut, lunchIn, checkOut);
    const lateMinutes = calcLateMinutes(selectedDate, checkIn, entryTime);
    const avgConfidence =
      empEvents.length > 0
        ? empEvents.reduce((sum, e) => sum + Number(e.confidence_score || 0), 0) / empEvents.length
        : 0;

    let status: AttendanceRow["status"] = "ausente";
    if (checkIn && checkOut) status = "completo";
    else if (checkIn && lateMinutes > 0) status = "tarde";
    else if (checkIn) status = "presente";

    return {
      employee,
      events: empEvents,
      checkIn,
      lunchOut,
      lunchIn,
      checkOut,
      status,
      workedMinutes,
      lateMinutes,
      avgConfidence,
    };
  });
}

function exportCsv(rows: AttendanceRow[], selectedDate: string) {
  const headers = [
    "Fecha",
    "Codigo",
    "Empleado",
    "Departamento",
    "Cargo",
    "Estado",
    "Entrada",
    "Salida Almuerzo",
    "Regreso Almuerzo",
    "Salida",
    "Horas Trabajadas",
    "Minutos Tarde",
    "Confianza Promedio",
  ];

  const csvRows = rows.map((r) => [
    selectedDate,
    r.employee.employee_code || "",
    r.employee.full_name || "",
    r.employee.department || "",
    r.employee.position || "",
    r.status,
    formatTime(r.checkIn?.created_at),
    formatTime(r.lunchOut?.created_at),
    formatTime(r.lunchIn?.created_at),
    formatTime(r.checkOut?.created_at),
    minutesToText(r.workedMinutes),
    String(r.lateMinutes),
    `${r.avgConfidence.toFixed(1)}%`,
  ]);

  const csv = [headers, ...csvRows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `asistencia-rrhh-${selectedDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DashboardAsistenciaRRHHProPage() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [entryTime, setEntryTime] = useState(DEFAULT_ENTRY_TIME);
  const [department, setDepartment] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const start = `${selectedDate}T00:00:00`;
      const endDate = new Date(`${selectedDate}T00:00:00`);
      endDate.setDate(endDate.getDate() + 1);
      const end = endDate.toISOString();

      const [empRes, eventRes] = await Promise.all([
        supabase
          .from("employees")
          .select("*")
          .order("full_name", { ascending: true }),
        supabase
          .from("employee_attendance_events")
          .select("*, employees(*)")
          .gte("created_at", start)
          .lt("created_at", end)
          .order("created_at", { ascending: true }),
      ]);

      if (empRes.error) throw empRes.error;
      if (eventRes.error) throw eventRes.error;

      setEmployees(((empRes.data || []) as Employee[]).filter((e) => (e.status || "activo") !== "inactivo"));
      setEvents((eventRes.data || []) as AttendanceEvent[]);
      setMessage("Reporte actualizado correctamente.");
    } catch (error: any) {
      setMessage(error.message || "Error cargando reporte de asistencia.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const emp of employees) {
      if (emp.department) set.add(emp.department);
    }
    return Array.from(set).sort();
  }, [employees]);

  const rows = useMemo(() => buildRows(employees, events, selectedDate, entryTime), [employees, events, selectedDate, entryTime]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesDepartment = department === "todos" || row.employee.department === department;
      const matchesStatus = statusFilter === "todos" || row.status === statusFilter;
      const matchesSearch =
        !q ||
        [row.employee.full_name, row.employee.employee_code, row.employee.department, row.employee.position]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      return matchesDepartment && matchesStatus && matchesSearch;
    });
  }, [rows, department, statusFilter, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const present = rows.filter((r) => r.status !== "ausente").length;
    const absent = rows.filter((r) => r.status === "ausente").length;
    const late = rows.filter((r) => r.lateMinutes > 0).length;
    const completed = rows.filter((r) => r.status === "completo").length;
    const worked = rows.reduce((sum, r) => sum + r.workedMinutes, 0);
    const avgConfidence =
      rows.filter((r) => r.avgConfidence > 0).length > 0
        ? rows.filter((r) => r.avgConfidence > 0).reduce((sum, r) => sum + r.avgConfidence, 0) /
          rows.filter((r) => r.avgConfidence > 0).length
        : 0;

    return {
      total,
      present,
      absent,
      late,
      completed,
      worked,
      avgConfidence,
      presenceRate: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  }, [rows]);

  return (
    <main className="min-h-screen bg-[#020817] p-4 text-white md:p-6">
      <div className="mx-auto w-full max-w-[1760px] space-y-5">
        <section className="rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-[#081421] via-[#0b1830] to-[#111b3f] p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 md:flex">
                <Clock size={34} />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.30em] text-cyan-300">
                  <BadgeCheck size={14} /> FASE 8.2.4
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                  Dashboard de Asistencia RRHH PRO
                </h1>
                <p className="mt-2 max-w-4xl text-sm text-slate-300">
                  Reporte diario de ponches faciales, asistencia, tardanzas, ausencias, horas trabajadas y evidencias.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => exportCsv(filteredRows, selectedDate)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-5 text-sm font-black text-emerald-100 hover:bg-emerald-500/20"
              >
                <FileSpreadsheet size={18} />
                Exportar CSV
              </button>

              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-5 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                Actualizar
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <div
            className={cx(
              "rounded-2xl border p-4 text-sm font-bold",
              message.includes("Error")
                ? "border-red-400/30 bg-red-500/10 text-red-100"
                : "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
            )}
          >
            {loading ? <Loader2 className="mr-2 inline animate-spin" size={16} /> : null}
            {message}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Kpi title="Asistencia" value={`${stats.present}/${stats.total}`} subtitle={`${stats.presenceRate}% presentes`} icon={<UserCheck />} tone="green" />
          <Kpi title="Ausentes" value={stats.absent} subtitle="Sin entrada registrada" icon={<XCircle />} tone="red" />
          <Kpi title="Tardanzas" value={stats.late} subtitle="Llegadas fuera de hora" icon={<AlertTriangle />} tone="amber" />
          <Kpi title="Completos" value={stats.completed} subtitle="Entrada y salida" icon={<CheckCircle2 />} tone="cyan" />
          <Kpi title="Horas" value={minutesToText(stats.worked)} subtitle="Total del día" icon={<Timer />} tone="purple" />
          <Kpi title="Confianza IA" value={`${stats.avgConfidence.toFixed(1)}%`} subtitle="Promedio facial" icon={<Eye />} tone="cyan" />
        </section>

        <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_160px_220px_220px_1fr]">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                <CalendarDays size={14} /> Fecha
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                <Clock size={14} /> Entrada
              </span>
              <input
                type="time"
                value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                <Filter size={14} /> Departamento
              </span>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              >
                <option value="todos">Todos</option>
                {departments.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                <Filter size={14} /> Estado
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              >
                <option value="todos">Todos</option>
                <option value="presente">Presente</option>
                <option value="tarde">Tarde</option>
                <option value="completo">Completo</option>
                <option value="ausente">Ausente</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                <Search size={14} /> Buscar
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Empleado, código, cargo..."
                className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              />
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-2xl font-black">Reporte diario</h2>
              <p className="text-sm text-slate-400">
                {formatDate(selectedDate)} · {filteredRows.length} empleados filtrados
              </p>
            </div>
            <Download className="text-cyan-300" />
          </div>

          <div className="overflow-auto">
            <table className="min-w-[1280px] w-full text-left text-sm">
              <thead className="bg-[#030817] text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-5 py-4">Empleado</th>
                  <th className="px-5 py-4">Estado</th>
                  <th className="px-5 py-4">Entrada</th>
                  <th className="px-5 py-4">Almuerzo salida</th>
                  <th className="px-5 py-4">Almuerzo regreso</th>
                  <th className="px-5 py-4">Salida</th>
                  <th className="px-5 py-4">Horas</th>
                  <th className="px-5 py-4">Tarde</th>
                  <th className="px-5 py-4">Confianza</th>
                  <th className="px-5 py-4">Fotos</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {filteredRows.map((row) => (
                  <tr key={row.employee.id} className="hover:bg-cyan-500/5">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/25 bg-cyan-500/10 text-cyan-300">
                          {row.employee.photo_url ? (
                            <img src={row.employee.photo_url} className="h-full w-full object-cover" />
                          ) : (
                            <UserRound size={20} />
                          )}
                        </div>
                        <div>
                          <p className="font-black text-white">{row.employee.full_name}</p>
                          <p className="text-xs text-slate-400">
                            {row.employee.employee_code || "Sin código"} · {row.employee.position || "Sin cargo"}
                          </p>
                          <p className="text-xs text-slate-500">{row.employee.department || "Sin departamento"}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <StatusPill status={row.status} />
                    </td>

                    <td className="px-5 py-4 font-black text-emerald-300">{formatTime(row.checkIn?.created_at)}</td>
                    <td className="px-5 py-4 font-black text-amber-300">{formatTime(row.lunchOut?.created_at)}</td>
                    <td className="px-5 py-4 font-black text-cyan-300">{formatTime(row.lunchIn?.created_at)}</td>
                    <td className="px-5 py-4 font-black text-purple-300">{formatTime(row.checkOut?.created_at)}</td>
                    <td className="px-5 py-4 font-black text-white">{minutesToText(row.workedMinutes)}</td>
                    <td className={cx("px-5 py-4 font-black", row.lateMinutes > 0 ? "text-red-300" : "text-emerald-300")}>
                      {row.lateMinutes > 0 ? minutesToText(row.lateMinutes) : "0m"}
                    </td>
                    <td className="px-5 py-4 font-black text-cyan-200">
                      {row.avgConfidence > 0 ? `${row.avgConfidence.toFixed(1)}%` : "-"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {row.events.filter((e) => e.photo_url).map((e) => (
                          <button
                            key={e.id}
                            onClick={() => setPreviewPhoto(e.photo_url || null)}
                            className="inline-flex items-center gap-1 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-200 hover:bg-cyan-500/20"
                          >
                            <ImageIcon size={14} />
                            {eventLabel(e.event_type)}
                          </button>
                        ))}

                        {!row.events.filter((e) => e.photo_url).length ? (
                          <span className="text-xs text-slate-500">Sin foto</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}

                {!filteredRows.length ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-sm font-bold text-slate-500">
                      No hay resultados para los filtros seleccionados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {previewPhoto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5" onClick={() => setPreviewPhoto(null)}>
          <div className="max-w-4xl rounded-3xl border border-cyan-400/30 bg-[#020817] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={previewPhoto} className="max-h-[80vh] w-full rounded-2xl object-contain" />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="mt-4 w-full rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Kpi({
  title,
  value,
  subtitle,
  icon,
  tone = "cyan",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  tone?: "cyan" | "green" | "red" | "amber" | "purple";
}) {
  const tones: Record<string, string> = {
    cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-300",
    green: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    red: "border-red-400/25 bg-red-500/10 text-red-300",
    amber: "border-amber-400/25 bg-amber-500/10 text-amber-300",
    purple: "border-purple-400/25 bg-purple-500/10 text-purple-300",
  };

  return (
    <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] via-[#07111f] to-[#030817] p-5 shadow-xl shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{title}</p>
          <h3 className="mt-3 text-2xl font-black text-white">{value}</h3>
          {subtitle ? <p className="mt-2 text-xs text-slate-400">{subtitle}</p> : null}
        </div>
        <div className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", tones[tone])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: AttendanceRow["status"] }) {
  const map: Record<AttendanceRow["status"], string> = {
    presente: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    completo: "border-cyan-400/30 bg-cyan-500/10 text-cyan-300",
    tarde: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    ausente: "border-red-400/30 bg-red-500/10 text-red-300",
  };

  const label: Record<AttendanceRow["status"], string> = {
    presente: "Presente",
    completo: "Completo",
    tarde: "Tarde",
    ausente: "Ausente",
  };

  return (
    <span className={cx("inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase", map[status])}>
      {label[status]}
    </span>
  );
}
