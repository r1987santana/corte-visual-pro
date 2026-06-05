"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Timer,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { compensationLabel } from "@/lib/rrhh/operational-compensation";

type Employee = {
  id: string;
  employee_code?: string | null;
  full_name: string;
  department?: string | null;
  position?: string | null;
  status?: string | null;
  salary?: number | null;
  salary_type?: string | null;
  hourly_rate?: number | null;
  bank_name?: string | null;
  bank_account?: string | null;
  photo_url?: string | null;
};

type AttendanceEvent = {
  id: string;
  employee_id: string;
  event_type: "check_in" | "lunch_out" | "lunch_in" | "check_out";
  confidence_score?: number | null;
  photo_url?: string | null;
  created_at: string;
};

type OperationalCompensationEvent = {
  id: string;
  employee_id?: string | null;
  employee_name?: string | null;
  department?: string | null;
  position?: string | null;
  role_key?: string | null;
  stage?: string | null;
  unit_type?: string | null;
  quantity?: number | null;
  base_rate?: number | null;
  stage_percent?: number | null;
  role_percent?: number | null;
  amount?: number | null;
  order_code?: string | null;
  module_name?: string | null;
  status?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
};

type PayrollRow = {
  employee: Employee;
  workedMinutes: number;
  lateMinutes: number;
  extraMinutes: number;
  workedDays: number;
  grossSalary: number;
  overtimePay: number;
  operationalCompensation: number;
  operationalCompensationLines: OperationalCompensationEvent[];
  lateDeduction: number;
  afp: number;
  sfs: number;
  isr: number;
  otherDeductions: number;
  netPay: number;
  status: "pendiente" | "aprobado" | "pagado";
};

const AFP_RATE = 0.0287;
const SFS_RATE = 0.0304;
const ISR_RATE = 0;
const STANDARD_DAILY_MINUTES = 8 * 60;
const DEFAULT_ENTRY_TIME = "08:00";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function currency(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
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

function pickEvent(events: AttendanceEvent[], type: AttendanceEvent["event_type"], mode: "first" | "last" = "first") {
  const filtered = events
    .filter((e) => e.event_type === type)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (!filtered.length) return undefined;
  return mode === "first" ? filtered[0] : filtered[filtered.length - 1];
}

function calcWorkedMinutes(events: AttendanceEvent[]) {
  const checkIn = pickEvent(events, "check_in", "first");
  const lunchOut = pickEvent(events, "lunch_out", "first");
  const lunchIn = pickEvent(events, "lunch_in", "last");
  const checkOut = pickEvent(events, "check_out", "last");

  if (!checkIn) return 0;

  const start = new Date(checkIn.created_at).getTime();
  const end = checkOut ? new Date(checkOut.created_at).getTime() : Date.now();

  let lunch = 0;
  if (lunchOut && lunchIn) {
    lunch = new Date(lunchIn.created_at).getTime() - new Date(lunchOut.created_at).getTime();
  }

  return Math.max(0, Math.round((end - start - Math.max(0, lunch)) / 60000));
}

function calcLateMinutes(date: string, events: AttendanceEvent[], entryTime = DEFAULT_ENTRY_TIME) {
  const checkIn = pickEvent(events, "check_in", "first");
  if (!checkIn) return 0;

  const entryLimit = dateTimeFor(date, entryTime).getTime();
  const actual = new Date(checkIn.created_at).getTime();

  return Math.max(0, Math.round((actual - entryLimit) / 60000));
}

function datePart(value: string) {
  return String(value).slice(0, 10);
}

function normalizePersonName(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPayrollRows(
  employees: Employee[],
  events: AttendanceEvent[],
  compensationEvents: OperationalCompensationEvent[],
  startDate: string,
  endDate: string,
  entryTime: string,
  overtimeMultiplier: number,
  applyLateDeduction: boolean
): PayrollRow[] {
  const eventMap = new Map<string, AttendanceEvent[]>();
  const compensationMap = new Map<string, OperationalCompensationEvent[]>();
  const employeeNameToId = new Map<string, string>();

  for (const employee of employees) {
    employeeNameToId.set(normalizePersonName(employee.full_name), employee.id);
  }

  for (const event of compensationEvents) {
    const employeeId = event.employee_id || employeeNameToId.get(normalizePersonName(event.employee_name));
    if (!employeeId) continue;
    const current = compensationMap.get(employeeId) || [];
    current.push(event);
    compensationMap.set(employeeId, current);
  }

  for (const event of events) {
    const key = `${event.employee_id}|${datePart(event.created_at)}`;
    const current = eventMap.get(key) || [];
    current.push(event);
    eventMap.set(key, current);
  }

  const days: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }

  return employees.map((employee) => {
    let workedMinutes = 0;
    let lateMinutes = 0;
    let workedDays = 0;

    for (const day of days) {
      const dayEvents = eventMap.get(`${employee.id}|${day}`) || [];
      const dayWorked = calcWorkedMinutes(dayEvents);
      const dayLate = calcLateMinutes(day, dayEvents, entryTime);

      if (dayEvents.some((e) => e.event_type === "check_in")) {
        workedDays += 1;
      }

      workedMinutes += dayWorked;
      lateMinutes += dayLate;
    }

    const monthlySalary = Number(employee.salary || 0);
    const hourlyRate =
      Number(employee.hourly_rate || 0) > 0
        ? Number(employee.hourly_rate || 0)
        : monthlySalary > 0
        ? monthlySalary / 23.83 / 8
        : 0;

    const expectedMinutes = workedDays * STANDARD_DAILY_MINUTES;
    const extraMinutes = Math.max(0, workedMinutes - expectedMinutes);

    const grossSalary = monthlySalary;
    const overtimePay = (extraMinutes / 60) * hourlyRate * overtimeMultiplier;
    const operationalCompensationLines = compensationMap.get(employee.id) || [];
    const operationalCompensation = operationalCompensationLines.reduce(
      (sum, event) => sum + Number(event.amount || 0),
      0
    );
    const lateDeduction = applyLateDeduction ? (lateMinutes / 60) * hourlyRate : 0;

    const taxableBase = Math.max(0, grossSalary + overtimePay + operationalCompensation - lateDeduction);
    const afp = taxableBase * AFP_RATE;
    const sfs = taxableBase * SFS_RATE;
    const isr = taxableBase * ISR_RATE;
    const otherDeductions = 0;

    const netPay = Math.max(0, taxableBase - afp - sfs - isr - otherDeductions);

    return {
      employee,
      workedMinutes,
      lateMinutes,
      extraMinutes,
      workedDays,
      grossSalary,
      overtimePay,
      operationalCompensation,
      operationalCompensationLines,
      lateDeduction,
      afp,
      sfs,
      isr,
      otherDeductions,
      netPay,
      status: "pendiente",
    };
  });
}

function exportPayrollCsv(rows: PayrollRow[], startDate: string, endDate: string) {
  const headers = [
    "Periodo Inicio",
    "Periodo Fin",
    "Codigo",
    "Empleado",
    "Departamento",
    "Cargo",
    "Salario Bruto",
    "Dias Trabajados",
    "Horas Trabajadas",
    "Horas Extra",
    "Pago Extra",
    "Compensacion Operacional",
    "Tardanza",
    "Descuento Tardanza",
    "AFP",
    "SFS",
    "ISR",
    "Otros Descuentos",
    "Neto a Pagar",
    "Banco",
    "Cuenta",
    "Estado",
  ];

  const csvRows = rows.map((r) => [
    startDate,
    endDate,
    r.employee.employee_code || "",
    r.employee.full_name || "",
    r.employee.department || "",
    r.employee.position || "",
    r.grossSalary.toFixed(2),
    String(r.workedDays),
    minutesToText(r.workedMinutes),
    minutesToText(r.extraMinutes),
    r.overtimePay.toFixed(2),
    r.operationalCompensation.toFixed(2),
    minutesToText(r.lateMinutes),
    r.lateDeduction.toFixed(2),
    r.afp.toFixed(2),
    r.sfs.toFixed(2),
    r.isr.toFixed(2),
    r.otherDeductions.toFixed(2),
    r.netPay.toFixed(2),
    r.employee.bank_name || "",
    r.employee.bank_account || "",
    r.status,
  ]);

  const csv = [headers, ...csvRows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nomina-rdwood-${startDate}-${endDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function NominaAutomaticaProPage() {
  const [startDate, setStartDate] = useState(firstDayMonthISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [entryTime, setEntryTime] = useState(DEFAULT_ENTRY_TIME);
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.35);
  const [applyLateDeduction, setApplyLateDeduction] = useState(true);
  const [search, setSearch] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [compensationEvents, setCompensationEvents] = useState<OperationalCompensationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingPayroll, setSavingPayroll] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const start = `${startDate}T00:00:00`;
      const endNext = new Date(`${endDate}T00:00:00`);
      endNext.setDate(endNext.getDate() + 1);

      const [empRes, eventRes, compRes] = await Promise.all([
        supabase.from("employees").select("*").order("full_name", { ascending: true }),
        supabase
          .from("employee_attendance_events")
          .select("*")
          .gte("created_at", start)
          .lt("created_at", endNext.toISOString())
          .order("created_at", { ascending: true }),
        supabase
          .from("operational_compensation_events")
          .select("*")
          .eq("status", "approved")
          .gte("approved_at", start)
          .lt("approved_at", endNext.toISOString())
          .order("approved_at", { ascending: true }),
      ]);

      if (empRes.error) throw empRes.error;
      if (eventRes.error) throw eventRes.error;
      if (compRes.error && !String(compRes.error.message || "").includes("operational_compensation_events")) {
        throw compRes.error;
      }

      setEmployees(((empRes.data || []) as Employee[]).filter((e) => (e.status || "activo") !== "inactivo"));
      setEvents((eventRes.data || []) as AttendanceEvent[]);
      setCompensationEvents((compRes.data || []) as OperationalCompensationEvent[]);
      setMessage("Nómina calculada con asistencia real.");
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "Error cargando nómina.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const rows = useMemo(
    () =>
      buildPayrollRows(
        employees,
        events,
        compensationEvents,
        startDate,
        endDate,
        entryTime,
        Number(overtimeMultiplier || 1),
        applyLateDeduction
      ),
    [employees, events, compensationEvents, startDate, endDate, entryTime, overtimeMultiplier, applyLateDeduction]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) =>
      [
        r.employee.full_name,
        r.employee.employee_code,
        r.employee.department,
        r.employee.position,
        r.employee.bank_name,
        r.employee.bank_account,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.gross += r.grossSalary;
        acc.overtime += r.overtimePay;
        acc.operationalCompensation += r.operationalCompensation;
        acc.lateDeduction += r.lateDeduction;
        acc.afp += r.afp;
        acc.sfs += r.sfs;
        acc.isr += r.isr;
        acc.other += r.otherDeductions;
        acc.net += r.netPay;
        acc.workedMinutes += r.workedMinutes;
        acc.extraMinutes += r.extraMinutes;
        acc.lateMinutes += r.lateMinutes;
        return acc;
      },
      {
        gross: 0,
        overtime: 0,
        operationalCompensation: 0,
        lateDeduction: 0,
        afp: 0,
        sfs: 0,
        isr: 0,
        other: 0,
        net: 0,
        workedMinutes: 0,
        extraMinutes: 0,
        lateMinutes: 0,
      }
    );
  }, [rows]);

  async function savePayrollRun() {
    setSavingPayroll(true);
    setMessage("");

    try {
      const payload = {
        period_start: startDate,
        period_end: endDate,
        employees_count: rows.length,
        gross_total: totals.gross,
        overtime_total: totals.overtime,
        operational_compensation_total: totals.operationalCompensation,
        deductions_total: totals.afp + totals.sfs + totals.isr + totals.other + totals.lateDeduction,
        net_total: totals.net,
        status: "calculada",
        metadata: {
          entry_time: entryTime,
          overtime_multiplier: overtimeMultiplier,
          apply_late_deduction: applyLateDeduction,
          operational_compensation_model: {
            pie_lineal: 700,
            pie_cuadrado: 500,
            distribucion: "Canteo 12%, Ensamble/Limpieza 30%, Transporte 10%, Instalacion 40%, Verificacion 8%",
            equipo: "Maestro 70%, Ayudante 30%",
          },
        },
      };

      const { data: run, error: runError } = await supabase
        .from("payroll_runs")
        .insert(payload)
        .select()
        .single();

      if (runError) throw runError;

      const items = rows.map((r) => ({
        payroll_run_id: run.id,
        employee_id: r.employee.id,
        employee_code: r.employee.employee_code,
        employee_name: r.employee.full_name,
        department: r.employee.department,
        position: r.employee.position,
        gross_salary: r.grossSalary,
        worked_minutes: r.workedMinutes,
        extra_minutes: r.extraMinutes,
        late_minutes: r.lateMinutes,
        overtime_pay: r.overtimePay,
        operational_compensation: r.operationalCompensation,
        operational_compensation_detail: r.operationalCompensationLines.map((line) => ({
          id: line.id,
          role_key: line.role_key,
          role_label: compensationLabel(line.role_key),
          stage: line.stage,
          unit_type: line.unit_type,
          quantity: line.quantity,
          base_rate: line.base_rate,
          stage_percent: line.stage_percent,
          role_percent: line.role_percent,
          amount: line.amount,
          order_code: line.order_code,
          module_name: line.module_name,
        })),
        late_deduction: r.lateDeduction,
        afp_amount: r.afp,
        sfs_amount: r.sfs,
        isr_amount: r.isr,
        other_deductions: r.otherDeductions,
        net_pay: r.netPay,
        bank_name: r.employee.bank_name,
        bank_account: r.employee.bank_account,
        status: "pendiente",
      }));

      if (items.length) {
        const { error: itemError } = await supabase.from("payroll_run_items").insert(items);
        if (itemError) throw itemError;
      }

      const compensationIds = rows.flatMap((r) => r.operationalCompensationLines.map((line) => line.id));
      if (compensationIds.length) {
        await supabase
          .from("operational_compensation_events")
          .update({
            status: "included_in_payroll",
            payroll_run_id: run.id,
            included_at: new Date().toISOString(),
          })
          .in("id", compensationIds);
      }

      setMessage(`Nómina guardada correctamente. Código: ${run.id}`);
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "No se pudo guardar la nómina.");
      alert(error?.message || "No se pudo guardar la nómina.");
    } finally {
      setSavingPayroll(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020817] p-4 text-white md:p-6">
      <div className="mx-auto w-full max-w-[1780px] space-y-5">
        <section className="rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-[#081421] via-[#0b1830] to-[#111b3f] p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-16 w-16 items-center justify-center rounded-3xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 md:flex">
                <Wallet size={34} />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.30em] text-cyan-300">
                  <BadgeCheck size={14} /> FASE 8.2.6
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                  Nómina Automática PRO
                </h1>
                <p className="mt-2 max-w-4xl text-sm text-slate-300">
                  Cálculo de nómina conectado a asistencia facial: salario, horas extra, tardanzas, AFP, SFS, ISR y neto a pagar.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => exportPayrollCsv(filteredRows, startDate, endDate)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-5 text-sm font-black text-emerald-100 hover:bg-emerald-500/20"
              >
                <FileSpreadsheet size={18} />
                Exportar CSV
              </button>

              <button
                onClick={savePayrollRun}
                disabled={savingPayroll || !rows.length}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {savingPayroll ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                Guardar Nómina
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
              message.includes("Error") || message.includes("No se")
                ? "border-red-400/30 bg-red-500/10 text-red-100"
                : "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
            )}
          >
            {loading ? <Loader2 className="mr-2 inline animate-spin" size={16} /> : null}
            {message}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Kpi title="Empleados" value={rows.length} subtitle="En nómina" icon={<Users />} tone="cyan" />
          <Kpi title="Bruto" value={currency(totals.gross)} subtitle="Salario base" icon={<Banknote />} tone="green" />
          <Kpi title="Comp. operativa" value={currency(totals.operationalCompensation)} subtitle="Pies producidos/instalados" icon={<BadgeCheck />} tone="cyan" />
          <Kpi title="Horas extra" value={currency(totals.overtime)} subtitle={minutesToText(totals.extraMinutes)} icon={<Timer />} tone="purple" />
          <Kpi title="Deducciones" value={currency(totals.afp + totals.sfs + totals.isr + totals.other + totals.lateDeduction)} subtitle="AFP + SFS + ISR + tardanzas" icon={<AlertTriangle />} tone="amber" />
          <Kpi title="Neto a pagar" value={currency(totals.net)} subtitle="Transferencia estimada" icon={<Wallet />} tone="green" />
          <Kpi title="Tardanzas" value={minutesToText(totals.lateMinutes)} subtitle="Acumulado periodo" icon={<Clock />} tone={totals.lateMinutes > 0 ? "amber" : "green"} />
        </section>

        <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[180px_180px_150px_150px_170px_1fr]">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                <CalendarDays size={14} /> Inicio
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                <CalendarDays size={14} /> Fin
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
                <Timer size={14} /> Extra x
              </span>
              <input
                type="number"
                step="0.05"
                value={overtimeMultiplier}
                onChange={(e) => setOvertimeMultiplier(Number(e.target.value))}
                className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              />
            </label>

            <label className="flex items-end">
              <button
                type="button"
                onClick={() => setApplyLateDeduction(!applyLateDeduction)}
                className={cx(
                  "h-12 w-full rounded-2xl border px-4 text-sm font-black",
                  applyLateDeduction
                    ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
                    : "border-slate-700 bg-[#030817] text-slate-300"
                )}
              >
                {applyLateDeduction ? "Descontar tarde" : "Sin descuento"}
              </button>
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                <Search size={14} /> Buscar
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Empleado, código, banco..."
                className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              />
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-2xl font-black">Detalle de Nómina</h2>
              <p className="text-sm text-slate-400">
                Periodo {startDate} al {endDate} · {filteredRows.length} empleados
              </p>
            </div>
            <FileText className="text-cyan-300" />
          </div>

          <div className="overflow-auto">
            <table className="min-w-[1780px] w-full text-left text-sm">
              <thead className="bg-[#030817] text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-5 py-4">Empleado</th>
                  <th className="px-5 py-4">Banco</th>
                  <th className="px-5 py-4">Bruto</th>
                  <th className="px-5 py-4">Días</th>
                  <th className="px-5 py-4">Horas</th>
                  <th className="px-5 py-4">Extra</th>
                  <th className="px-5 py-4">Pago Extra</th>
                  <th className="px-5 py-4">Comp. Operativa</th>
                  <th className="px-5 py-4">Tarde</th>
                  <th className="px-5 py-4">Desc. Tarde</th>
                  <th className="px-5 py-4">AFP</th>
                  <th className="px-5 py-4">SFS</th>
                  <th className="px-5 py-4">ISR</th>
                  <th className="px-5 py-4">Neto</th>
                  <th className="px-5 py-4">Estado</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {filteredRows.map((row) => (
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
                      <p className="font-bold text-slate-200">{row.employee.bank_name || "Sin banco"}</p>
                      <p className="text-xs text-slate-500">{row.employee.bank_account || "Sin cuenta"}</p>
                    </td>

                    <td className="px-5 py-4 font-black text-white">{currency(row.grossSalary)}</td>
                    <td className="px-5 py-4 font-black text-cyan-200">{row.workedDays}</td>
                    <td className="px-5 py-4 font-black text-cyan-200">{minutesToText(row.workedMinutes)}</td>
                    <td className="px-5 py-4 font-black text-purple-300">{minutesToText(row.extraMinutes)}</td>
                    <td className="px-5 py-4 font-black text-purple-300">{currency(row.overtimePay)}</td>
                    <td className="px-5 py-4">
                      <p className="font-black text-cyan-200">{currency(row.operationalCompensation)}</p>
                      {row.operationalCompensationLines.length ? (
                        <p className="text-xs text-slate-500">
                          {row.operationalCompensationLines.length} evento(s) auditables
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 font-black text-amber-300">{minutesToText(row.lateMinutes)}</td>
                    <td className="px-5 py-4 font-black text-red-300">{currency(row.lateDeduction)}</td>
                    <td className="px-5 py-4 font-black text-amber-200">{currency(row.afp)}</td>
                    <td className="px-5 py-4 font-black text-amber-200">{currency(row.sfs)}</td>
                    <td className="px-5 py-4 font-black text-amber-200">{currency(row.isr)}</td>
                    <td className="px-5 py-4 font-black text-emerald-300">{currency(row.netPay)}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-black uppercase text-amber-300">
                        Pendiente
                      </span>
                    </td>
                  </tr>
                ))}

                {!filteredRows.length ? (
                  <tr>
                    <td colSpan={15} className="px-5 py-12 text-center text-sm font-bold text-slate-500">
                      No hay empleados para calcular nómina.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Panel title="Resumen legal base" icon={<ShieldCheck className="text-cyan-300" />}>
            <Line label="AFP empleado" value={`${(AFP_RATE * 100).toFixed(2)}%`} />
            <Line label="SFS empleado" value={`${(SFS_RATE * 100).toFixed(2)}%`} />
            <Line label="ISR" value="Configurable / 0% base" />
            <Line label="Hora extra" value={`x${overtimeMultiplier}`} />
          </Panel>

          <Panel title="Totales del periodo" icon={<Wallet className="text-emerald-300" />}>
            <Line label="Salario bruto" value={currency(totals.gross)} />
            <Line label="Pago extra" value={currency(totals.overtime)} />
            <Line label="Compensacion operacional" value={currency(totals.operationalCompensation)} />
            <Line label="Deducciones total" value={currency(totals.afp + totals.sfs + totals.isr + totals.lateDeduction)} />
            <Line label="Neto total" value={currency(totals.net)} strong />
          </Panel>

          <Panel title="Acciones recomendadas" icon={<AlertTriangle className="text-amber-300" />}>
            <p className="text-sm text-slate-400">
              Revisa empleados sin banco, sueldos en cero, tardanzas y horas extra antes de aprobar la nómina.
            </p>
            <button
              onClick={() => exportPayrollCsv(filteredRows, startDate, endDate)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100"
            >
              <Download size={16} />
              Descargar archivo bancario base
            </button>
          </Panel>
        </section>
      </div>
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
          <h3 className="mt-3 text-xl font-black text-white xl:text-2xl">{value}</h3>
          {subtitle ? <p className="mt-2 text-xs text-slate-400">{subtitle}</p> : null}
        </div>
        <div className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", tones[tone])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
      <div className="mb-4 flex items-center gap-3">
        {icon}
        <h3 className="text-xl font-black">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[#030817] px-4 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={cx("text-sm font-black", strong ? "text-emerald-300" : "text-white")}>{value}</span>
    </div>
  );
}
