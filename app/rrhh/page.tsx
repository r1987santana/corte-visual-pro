"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Gauge,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Timer,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  employee_code?: string | null;
  full_name: string;
  identification?: string | null;
  phone?: string | null;
  email?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  department?: string | null;
  position?: string | null;
  status?: string | null;
  salary?: number | null;
  photo_url?: string | null;
};

type EmployeeDocument = {
  employee_id: string;
};

type FaceProfile = {
  employee_id: string;
  status?: string | null;
};

type OperationalTeam = {
  id: string;
  status?: string | null;
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

type DashboardTab =
  | "resumen"
  | "empleados"
  | "asistencia"
  | "nomina"
  | "vacaciones"
  | "desempeno"
  | "reclutamiento"
  | "ia"
  | "alertas";

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
const DEFAULT_END_TIME = "17:00";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

function minutesToText(minutes: number) {
  const safe = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m}m`;
}

function dateTimeFor(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function currency(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function eventLabel(type: string) {
  const labels: Record<string, string> = {
    check_in: "Entrada",
    lunch_out: "Salida almuerzo",
    lunch_in: "Regreso almuerzo",
    check_out: "Salida",
    entrada: "Entrada",
    salida: "Salida",
    entrada_almuerzo: "Regreso almuerzo",
    salida_almuerzo: "Salida almuerzo",
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

function calcWorkedMinutes(
  checkIn?: AttendanceEvent,
  lunchOut?: AttendanceEvent,
  lunchIn?: AttendanceEvent,
  checkOut?: AttendanceEvent
) {
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

function calcExtraMinutes(workedMinutes: number) {
  const standard = 8 * 60;
  return Math.max(0, workedMinutes - standard);
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

export default function DashboardRRHHMaestroAsistenciaRealPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("resumen");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [entryTime, setEntryTime] = useState(DEFAULT_ENTRY_TIME);
  const [search, setSearch] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [faceProfiles, setFaceProfiles] = useState<FaceProfile[]>([]);
  const [teams, setTeams] = useState<OperationalTeam[]>([]);
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

      const [empRes, eventRes, docRes, faceRes, teamRes] = await Promise.all([
        supabase.from("employees").select("*").order("full_name", { ascending: true }),
        supabase
          .from("employee_attendance_events")
          .select("*, employees(*)")
          .gte("created_at", start)
          .lt("created_at", end)
          .order("created_at", { ascending: true }),
        supabase.from("employee_documents").select("employee_id"),
        supabase.from("employee_face_profiles").select("employee_id,status"),
        supabase.from("v_operational_teams_detail").select("id,status"),
      ]);

      if (empRes.error) throw empRes.error;
      if (eventRes.error) throw eventRes.error;

      setEmployees((empRes.data || []) as Employee[]);
      setEvents((eventRes.data || []) as AttendanceEvent[]);
      setDocuments(docRes.error ? [] : ((docRes.data || []) as EmployeeDocument[]));
      setFaceProfiles(faceRes.error ? [] : ((faceRes.data || []) as FaceProfile[]));
      setTeams(teamRes.error ? [] : ((teamRes.data || []) as OperationalTeam[]));
      setMessage("Dashboard RRHH actualizado con expediente, asistencia y equipos.");
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "Error cargando Dashboard RRHH.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => !String(employee.status || "activo").toLowerCase().includes("inactivo")),
    [employees]
  );

  const rows = useMemo(
    () => buildRows(activeEmployees, events, selectedDate, entryTime),
    [activeEmployees, events, selectedDate, entryTime]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (!q) return true;
      return [
        row.employee.full_name,
        row.employee.employee_code,
        row.employee.department,
        row.employee.position,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const presentRows = rows.filter((r) => r.status !== "ausente");
    const absentRows = rows.filter((r) => r.status === "ausente");
    const lateRows = rows.filter((r) => r.lateMinutes > 0);
    const completedRows = rows.filter((r) => r.status === "completo");

    const workedMinutes = rows.reduce((sum, r) => sum + r.workedMinutes, 0);
    const extraMinutes = rows.reduce((sum, r) => sum + calcExtraMinutes(r.workedMinutes), 0);
    const avgConfidenceRows = rows.filter((r) => r.avgConfidence > 0);
    const avgConfidence =
      avgConfidenceRows.length > 0
        ? avgConfidenceRows.reduce((sum, r) => sum + r.avgConfidence, 0) / avgConfidenceRows.length
        : 0;

    const activePayroll = activeEmployees.reduce((sum, e) => sum + Number(e.salary || 0), 0);
    const inactive = employees.length - activeEmployees.length;
    const docsByEmployee = new Set(documents.map((doc) => doc.employee_id).filter(Boolean));
    const faceByEmployee = new Set(
      faceProfiles
        .filter((profile) => !String(profile.status || "activo").toLowerCase().includes("inactivo"))
        .map((profile) => profile.employee_id)
        .filter(Boolean)
    );
    const activeTeams = teams.filter((team) => String(team.status || "activo").toLowerCase() === "activo").length;
    const missingMatrixRows = activeEmployees.filter((employee) => {
      const hasIdentity = Boolean(employee.identification && (employee.phone || employee.email));
      const hasLabor = Boolean(employee.department && employee.position);
      const hasPayroll = Number(employee.salary || 0) > 0 && Boolean(employee.bank_name && employee.bank_account);
      const hasDocs = docsByEmployee.has(employee.id);
      return !(hasIdentity && hasLabor && hasPayroll && hasDocs);
    });
    const missingFaceRows = activeEmployees.filter((employee) => !faceByEmployee.has(employee.id));
    const matrixReady = activeEmployees.length - missingMatrixRows.length;
    const matrixRate = activeEmployees.length > 0 ? Math.round((matrixReady / activeEmployees.length) * 100) : 0;
    const faceRate =
      activeEmployees.length > 0 ? Math.round(((activeEmployees.length - missingFaceRows.length) / activeEmployees.length) * 100) : 0;
    const presenceRate = total > 0 ? Math.round((presentRows.length / total) * 100) : 0;
    const healthScore = Math.max(
      0,
      Math.min(100, Math.round(35 + presenceRate * 0.25 + matrixRate * 0.25 + faceRate * 0.15 - lateRows.length * 2 - absentRows.length))
    );
    const risk =
      absentRows.length +
      lateRows.length +
      missingMatrixRows.length +
      missingFaceRows.length +
      rows.filter((r) => r.avgConfidence > 0 && r.avgConfidence < 60).length;

    return {
      total,
      active: activeEmployees.length,
      inactive,
      present: presentRows.length,
      absent: absentRows.length,
      late: lateRows.length,
      completed: completedRows.length,
      workedMinutes,
      extraMinutes,
      avgConfidence,
      activePayroll,
      activeTeams,
      docsEmployees: docsByEmployee.size,
      faceProfiles: faceByEmployee.size,
      matrixReady,
      matrixRate,
      faceRate,
      missingMatrixRows,
      missingFaceRows,
      presenceRate,
      healthScore,
      risk,
      presentRows,
      absentRows,
      lateRows,
    };
  }, [rows, employees, activeEmployees, documents, faceProfiles, teams]);

  const alerts = useMemo(() => {
    const items: Array<{ tone: "red" | "amber" | "green" | "cyan"; title: string; text: string }> = [];

    if (stats.absent > 0) {
      items.push({
        tone: "red",
        title: "Ausencias hoy",
        text: `${stats.absent} empleado(s) sin asistencia registrada.`,
      });
    }

    if (stats.late > 0) {
      items.push({
        tone: "amber",
        title: "Tardanzas detectadas",
        text: `${stats.late} empleado(s) llegaron luego de la hora configurada.`,
      });
    }

    if (stats.avgConfidence > 0 && stats.avgConfidence < 65) {
      items.push({
        tone: "amber",
        title: "Confianza facial baja",
        text: `Promedio IA ${stats.avgConfidence.toFixed(1)}%. Recomendar mejor iluminación.`,
      });
    }

    if (stats.missingMatrixRows.length > 0) {
      items.push({
        tone: "amber",
        title: "Expedientes incompletos",
        text: `${stats.missingMatrixRows.length} colaborador(es) sin matriz completa: identidad, cargo, nomina o documentos.`,
      });
    }

    if (stats.missingFaceRows.length > 0) {
      items.push({
        tone: "amber",
        title: "Rostro pendiente",
        text: `${stats.missingFaceRows.length} colaborador(es) sin perfil facial activo para ponche.`,
      });
    }

    if (stats.activeTeams === 0 && stats.active > 0) {
      items.push({
        tone: "red",
        title: "Equipos no configurados",
        text: "El expediente ya existe, pero faltan equipos operativos activos para produccion/campo.",
      });
    }

    if (!items.length) {
      items.push({
        tone: "green",
        title: "RRHH estable",
        text: "No hay alertas críticas activas.",
      });
    }

    return items;
  }, [stats]);

  const tabs: Array<{ id: DashboardTab; label: string; icon: React.ReactNode }> = [
    { id: "resumen", label: "Resumen", icon: <Gauge size={16} /> },
    { id: "empleados", label: "Empleados", icon: <Users size={16} /> },
    { id: "asistencia", label: "Asistencia", icon: <Clock size={16} /> },
    { id: "nomina", label: "Nómina", icon: <Wallet size={16} /> },
    { id: "vacaciones", label: "Vacaciones", icon: <CalendarDays size={16} /> },
    { id: "desempeno", label: "Desempeño", icon: <TrendingUp size={16} /> },
    { id: "reclutamiento", label: "Reclutamiento", icon: <BriefcaseBusiness size={16} /> },
    { id: "ia", label: "IA RRHH", icon: <ShieldCheck size={16} /> },
    { id: "alertas", label: "Alertas", icon: <AlertTriangle size={16} /> },
  ];

  return (
    <main className="min-h-screen bg-[#020817] p-4 text-white md:p-6">
      <div className="mx-auto w-full max-w-[1760px] space-y-5">
        <section className="rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-[#081421] via-[#0b1830] to-[#111b3f] p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 md:flex">
                <Users size={34} />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.30em] text-cyan-300">
                  <BadgeCheck size={14} /> FASE 8.2.5
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                  Dashboard RRHH Maestro
                </h1>
                <p className="mt-2 max-w-4xl text-sm text-slate-300">
                  Centro de mando humano conectado a ponche facial real: asistencia, ausencias, tardanzas, horas y alertas.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-black text-white">
                <CalendarDays size={16} className="text-cyan-300" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-white outline-none"
                />
              </div>

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

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi title="Health Score RRHH" value={`${stats.healthScore}%`} subtitle="Salud del personal" icon={<ShieldCheck />} tone={stats.healthScore >= 80 ? "green" : "amber"} />
          <Kpi title="Matriz colaboradores" value={`${stats.matrixRate}%`} subtitle={`${stats.matrixReady}/${stats.active} expedientes completos`} icon={<Users />} tone={stats.matrixRate >= 90 ? "green" : "amber"} />
          <Kpi title="Asistencia hoy" value={`${stats.present}/${stats.total}`} subtitle={`${stats.absent} ausentes · ${stats.late} tarde`} icon={<Clock />} tone={stats.present > 0 ? "green" : "red"} />
          <Kpi title="Nomina actual" value={currency(stats.activePayroll)} subtitle={`${stats.inactive} inactivos · ${stats.activeTeams} equipos`} icon={<Wallet />} tone="green" />
          <Kpi title="Riesgo IA alto" value={stats.risk} subtitle={`${stats.avgConfidence.toFixed(1)}% confianza promedio`} icon={<AlertTriangle />} tone={stats.risk > 0 ? "amber" : "green"} />
        </section>

        <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-3 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cx(
                  "inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black transition",
                  activeTab === tab.id
                    ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/30"
                    : "text-slate-300 hover:bg-slate-900/80"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {activeTab === "resumen" ? (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Panel title="Resumen ejecutivo RRHH" subtitle="Indicadores principales del capital humano." icon={<TrendingUp className="text-cyan-300" />}>
              <Metric title="Presencia" value={`${stats.present}/${stats.total}`} subtitle="Empleados presentes hoy" icon={<UserCheck />} tone="green" />
              <Metric title="Horas acumuladas hoy" value={minutesToText(stats.workedMinutes)} subtitle="Tiempo trabajado real" icon={<Timer />} tone="purple" />
              <Metric title="Rostro facial" value={`${stats.faceRate}%`} subtitle={`${stats.faceProfiles}/${stats.active} perfiles activos`} icon={<Gauge />} tone={stats.faceRate >= 90 ? "green" : "amber"} />
            </Panel>

            <Panel title="Operacion RRHH" subtitle="Nomina, equipos y expediente maestro." icon={<BriefcaseBusiness className="text-cyan-300" />}>
              <Metric title="Expedientes completos" value={`${stats.matrixReady}/${stats.active}`} subtitle={`${stats.missingMatrixRows.length} pendientes de completar`} icon={<FileText />} tone={stats.missingMatrixRows.length ? "amber" : "green"} />
              <Metric title="Equipos operativos" value={stats.activeTeams} subtitle="Cargados desde empleados" icon={<BriefcaseBusiness />} tone={stats.activeTeams ? "green" : "red"} />
              <Metric title="Nomina base" value={currency(stats.activePayroll)} subtitle="Salario mensual activo" icon={<Wallet />} tone="green" />
            </Panel>

            <Panel title="Alertas rápidas" subtitle="Puntos que requieren atención." icon={<AlertTriangle className="text-cyan-300" />}>
              <div className="space-y-3">
                {alerts.map((alert, index) => (
                  <AlertCard key={index} tone={alert.tone} title={alert.title} text={alert.text} />
                ))}
              </div>
            </Panel>
          </section>
        ) : null}

        {activeTab === "asistencia" ? (
          <section className="space-y-5">
            <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_1fr]">
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Hora entrada</span>
                  <input
                    type="time"
                    value={entryTime}
                    onChange={(e) => setEntryTime(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Buscar</span>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Empleado, código, cargo..."
                      className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] pl-11 pr-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                    />
                  </div>
                </label>
              </div>
            </div>

            <AttendanceTable rows={filteredRows} setPreviewPhoto={setPreviewPhoto} />
          </section>
        ) : null}

        {activeTab === "empleados" ? (
          <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
            <h2 className="mb-4 text-2xl font-black">Empleados activos</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {employees.map((emp) => (
                <div key={emp.id} className="rounded-2xl border border-slate-800 bg-[#030817] p-4">
                  <div className="flex items-center gap-3">
                    <Avatar employee={emp} />
                    <div>
                      <p className="font-black">{emp.full_name}</p>
                      <p className="text-xs text-slate-400">{emp.employee_code || "Sin código"} · {emp.position || "Sin cargo"}</p>
                      <p className="text-xs text-slate-500">{emp.department || "Sin departamento"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "nomina" ? (
          <HubSection
            title="Nomina y documentos"
            subtitle="La nomina nace del expediente del colaborador: salario, banco, cuenta, estado y recibos firmados."
            cards={[
              { title: "Nomina activa", value: currency(stats.activePayroll), text: `${stats.active} colaboradores activos en matriz.`, href: "/rrhh/nomina", action: "Abrir nomina" },
              { title: "Recibos pendientes", value: "Firmas", text: "Genera y valida recibos desde el expediente RRHH.", href: "/rrhh/recibos-nomina", action: "Ver recibos" },
              { title: "Auditoria RRHH", value: "Control", text: "Revisa cambios, pagos, altas y bajas del personal.", href: "/rrhh/auditoria", action: "Auditar" },
            ]}
          />
        ) : null}

        {activeTab === "vacaciones" ? (
          <HubSection
            title="Vacaciones, permisos y ausencias"
            subtitle="Controla solicitudes del empleado, ausencias de hoy y trazabilidad de aprobaciones."
            cards={[
              { title: "Ausentes hoy", value: stats.absent, text: "Colaboradores sin ponche registrado en la fecha seleccionada.", href: "/rrhh/asistencia", action: "Ver asistencia" },
              { title: "Tardanzas", value: stats.late, text: "Llegadas posteriores a la hora de entrada configurada.", href: "/rrhh/asistencia", action: "Analizar" },
              { title: "Portal empleado", value: "Autoservicio", text: "El empleado consulta solicitudes, documentos, recibos y cursos.", href: "/portal-empleado", action: "Abrir portal" },
            ]}
          />
        ) : null}

        {activeTab === "desempeno" ? (
          <HubSection
            title="Desempeno y gamificacion"
            subtitle="La evaluacion se alimenta de asistencia, cumplimiento, capacitacion y resultados operativos."
            cards={[
              { title: "Score facial", value: `${stats.avgConfidence.toFixed(1)}%`, text: "Promedio de confianza IA de los ponches registrados.", href: "/rrhh/registro-facial", action: "Ver rostros" },
              { title: "Gamificacion", value: "Ranking", text: "Conecta puntos, retos y desempeno por colaborador.", href: "/gamificacion", action: "Abrir" },
              { title: "Cursos LMS", value: "Formacion", text: "Capacitacion por area y certificados del expediente.", href: "/portal-empleado", action: "Ver cursos" },
            ]}
          />
        ) : null}

        {activeTab === "reclutamiento" ? (
          <HubSection
            title="Reclutamiento a desvinculacion"
            subtitle="El flujo correcto es candidato, alta en expediente, rostro facial, equipo operativo, desempeno y salida documentada."
            cards={[
              { title: "Candidatos", value: "ATS", text: "Pipeline de reclutamiento conectado al alta de empleados.", href: "/recruitment", action: "Abrir ATS" },
              { title: "Alta de empleado", value: "Matriz", text: "El expediente es la fuente para equipos, nomina, portal y gamificacion.", href: "/rrhh/empleados", action: "Crear ficha" },
              { title: "Equipos", value: stats.activeTeams, text: "Los equipos operativos se cargan desde colaboradores activos.", href: "/rrhh/equipos", action: "Asignar" },
            ]}
          />
        ) : null}

        {activeTab === "ia" ? (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Panel title="IA RRHH operativa" subtitle="Recomendaciones reales con base en expediente, asistencia y equipos." icon={<ShieldCheck className="text-cyan-300" />}>
              {alerts.map((alert, index) => (
                <AlertCard key={index} tone={alert.tone} title={alert.title} text={alert.text} />
              ))}
            </Panel>
            <Panel title="Acciones recomendadas" subtitle="Prioridad para que RRHH quede listo para operar." icon={<BadgeCheck className="text-cyan-300" />}>
              <ActionLink href="/rrhh/empleados" title="Completar expedientes" text="Cedula, telefono, cargo, salario, banco y documentos." />
              <ActionLink href="/rrhh/registro-facial" title="Activar rostro facial" text="Necesario para ponche, asistencia y confianza IA." />
              <ActionLink href="/rrhh/equipos" title="Configurar equipos" text="La matriz de empleados alimenta produccion, transporte, instalacion y QA." />
            </Panel>
            <Panel title="Estado de datos" subtitle="Calidad de informacion para decisiones." icon={<Gauge className="text-cyan-300" />}>
              <Metric title="Matriz" value={`${stats.matrixRate}%`} subtitle={`${stats.missingMatrixRows.length} incompletos`} icon={<FileText />} tone={stats.matrixRate >= 90 ? "green" : "amber"} />
              <Metric title="Rostros" value={`${stats.faceRate}%`} subtitle={`${stats.missingFaceRows.length} pendientes`} icon={<UserCheck />} tone={stats.faceRate >= 90 ? "green" : "amber"} />
            </Panel>
          </section>
        ) : null}

        {activeTab === "alertas" ? (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
            <Panel title="Alertas RRHH" subtitle="Lo que puede bloquear operacion, nomina o equipos." icon={<AlertTriangle className="text-cyan-300" />}>
              {alerts.map((alert, index) => (
                <AlertCard key={index} tone={alert.tone} title={alert.title} text={alert.text} />
              ))}
            </Panel>
            <Panel title="Pendientes de expediente" subtitle="Colaboradores que deben completarse para que RRHH sea la matriz del sistema." icon={<FileText className="text-cyan-300" />}>
              <EmployeeMiniList employees={stats.missingMatrixRows.slice(0, 8)} emptyText="Todos los expedientes activos estan completos." />
              <ActionLink href="/rrhh/empleados" title="Abrir matriz de empleados" text="Completar datos laborales, documentos y nomina." />
            </Panel>
          </section>
        ) : null}
      </div>

      {previewPhoto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5" onClick={() => setPreviewPhoto(null)}>
          <div className="max-w-4xl rounded-3xl border border-cyan-400/30 bg-[#020817] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={previewPhoto} className="max-h-[80vh] w-full rounded-2xl object-contain" />
            <button onClick={() => setPreviewPhoto(null)} className="mt-4 w-full rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white">
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Avatar({ employee }: { employee: Employee }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/25 bg-cyan-500/10 text-cyan-300">
      {employee.photo_url ? <img src={employee.photo_url} className="h-full w-full object-cover" /> : <UserRound size={20} />}
    </div>
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
        <div className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", tones[tone])}>{icon}</div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
      <div className="mb-5 flex items-start gap-3">
        <div>{icon}</div>
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Metric({ title, value, subtitle, icon, tone = "cyan" }: { title: string; value: string | number; subtitle?: string; icon: React.ReactNode; tone?: "cyan" | "green" | "red" | "amber" | "purple" }) {
  const tones: Record<string, string> = {
    cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-300",
    green: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
    red: "border-red-400/25 bg-red-500/10 text-red-300",
    amber: "border-amber-400/25 bg-amber-500/10 text-amber-300",
    purple: "border-purple-400/25 bg-purple-500/10 text-purple-300",
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-[#030817] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{title}</p>
          <p className="mt-3 text-2xl font-black text-white">{value}</p>
          {subtitle ? <p className="mt-2 text-xs text-slate-400">{subtitle}</p> : null}
        </div>
        <div className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", tones[tone])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function AlertCard({ tone, title, text }: { tone: "red" | "amber" | "green" | "cyan"; title: string; text: string }) {
  const tones: Record<string, string> = {
    red: "border-red-400/35 bg-red-500/10 text-red-100",
    amber: "border-amber-400/35 bg-amber-500/10 text-amber-100",
    green: "border-emerald-400/35 bg-emerald-500/10 text-emerald-100",
    cyan: "border-cyan-400/35 bg-cyan-500/10 text-cyan-100",
  };

  return (
    <div className={cx("rounded-2xl border p-4", tones[tone])}>
      <p className="font-black">{title}</p>
      <p className="mt-1 text-xs opacity-90">{text}</p>
    </div>
  );
}

function HubSection({
  title,
  subtitle,
  cards,
}: {
  title: string;
  subtitle: string;
  cards: Array<{ title: string; value: string | number; text: string; href: string; action: string }>;
}) {
  return (
    <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] via-[#07111f] to-[#030817] p-5 shadow-2xl shadow-black/30">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Centro RRHH</p>
          <h2 className="mt-2 text-3xl font-black">{title}</h2>
          <p className="mt-2 max-w-4xl text-sm text-slate-400">{subtitle}</p>
        </div>
        <ShieldCheck className="text-cyan-300" size={34} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={`${card.href}-${card.title}`}
            href={card.href}
            className="group rounded-3xl border border-slate-800 bg-[#030817] p-5 transition hover:border-cyan-400/45 hover:bg-cyan-500/10"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{card.title}</p>
            <p className="mt-3 text-3xl font-black text-white">{card.value}</p>
            <p className="mt-3 min-h-10 text-sm text-slate-400">{card.text}</p>
            <span className="mt-5 inline-flex rounded-2xl bg-cyan-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-200 group-hover:bg-cyan-500/25">
              {card.action}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ActionLink({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="block rounded-2xl border border-slate-800 bg-[#030817] p-4 transition hover:border-cyan-400/40 hover:bg-cyan-500/10">
      <p className="font-black text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{text}</p>
    </Link>
  );
}

function EmployeeMiniList({ employees, emptyText }: { employees: Employee[]; emptyText: string }) {
  if (!employees.length) {
    return <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">{emptyText}</div>;
  }

  return (
    <div className="space-y-3">
      {employees.map((employee) => (
        <Link
          key={employee.id}
          href="/rrhh/empleados"
          className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-[#030817] p-3 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
        >
          <Avatar employee={employee} />
          <div>
            <p className="font-black text-white">{employee.full_name}</p>
            <p className="text-xs text-slate-400">
              {employee.department || "Sin departamento"} · {employee.position || "Sin cargo"}
            </p>
          </div>
        </Link>
      ))}
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

  return <span className={cx("inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase", map[status])}>{label[status]}</span>;
}

function AttendanceTable({ rows, setPreviewPhoto }: { rows: AttendanceRow[]; setPreviewPhoto: (url: string | null) => void }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] shadow-2xl shadow-black/30">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div>
          <h2 className="text-2xl font-black">Asistencia real de hoy</h2>
          <p className="text-sm text-slate-400">{rows.length} empleados</p>
        </div>
        <BarChart3 className="text-cyan-300" />
      </div>

      <div className="overflow-auto">
        <table className="min-w-[1180px] w-full text-left text-sm">
          <thead className="bg-[#030817] text-xs uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="px-5 py-4">Empleado</th>
              <th className="px-5 py-4">Estado</th>
              <th className="px-5 py-4">Entrada</th>
              <th className="px-5 py-4">Salida almuerzo</th>
              <th className="px-5 py-4">Regreso</th>
              <th className="px-5 py-4">Salida</th>
              <th className="px-5 py-4">Horas</th>
              <th className="px-5 py-4">Tarde</th>
              <th className="px-5 py-4">Confianza</th>
              <th className="px-5 py-4">Foto</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr key={row.employee.id} className="hover:bg-cyan-500/5">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar employee={row.employee} />
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
                  {row.events.find((e) => e.photo_url)?.photo_url ? (
                    <button
                      onClick={() => setPreviewPhoto(row.events.find((e) => e.photo_url)?.photo_url || null)}
                      className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-200 hover:bg-cyan-500/20"
                    >
                      Ver foto
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">Sin foto</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
