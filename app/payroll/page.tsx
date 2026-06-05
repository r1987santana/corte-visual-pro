"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Banknote,
  BarChart3,
  Calculator,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Download,
  FileText,
  Gift,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Tab = "dashboard" | "corridas" | "detalle" | "recibos" | "ajustes" | "deducciones";

type Dashboard = {
  payroll_runs: number;
  calculated_runs: number;
  processed_employees: number;
  gross_total: number;
  deduction_total: number;
  net_total: number;
  overtime_total: number;
  bonus_total: number;
  receipts_pending_signature: number;
};

type PayrollRun = {
  id: string;
  code: string;
  name: string;
  payroll_type: string;
  period_start: string;
  period_end: string;
  payment_date: string;
  status: string;
  gross_total: number;
  deduction_total: number;
  net_total: number;
  employees_count: number;
};

type PayrollItem = {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position_title: string | null;
  base_salary: number;
  attendance_days: number;
  worked_hours: number;
  overtime_hours: number;
  overtime_amount: number;
  bonus_amount: number;
  commission_amount: number;
  other_income: number;
  gross_pay: number;
  afp_amount: number;
  sfs_amount: number;
  isr_amount: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  status: string;
  payroll_code: string;
  payroll_name: string;
  period_start: string;
  period_end: string;
  payment_date: string;
};

type ReceiptRow = {
  id: string;
  receipt_code: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position_title: string | null;
  gross_pay: number;
  total_deductions: number;
  item_net_pay: number;
  payroll_code: string;
  payroll_name: string;
  period_start: string;
  period_end: string;
  payment_date: string;
  token: string;
  status: string;
  signed_at: string | null;
};

type Adjustment = {
  id: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  adjustment_date: string;
  code: string;
  name: string;
  adjustment_type: string;
  amount: number;
  status: string;
  notes: string | null;
};

type Deduction = {
  id: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  code: string;
  name: string;
  deduction_type: string;
  amount: number;
  percent_value: number;
  status: string;
  notes: string | null;
};

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(n || 0));

function badgeClass(status?: string | null) {
  if (["calculada", "cerrada", "pagada", "firmado", "aplicado", "activo"].includes(status || "")) {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
  }
  if (["borrador", "generado", "enviado", "pendiente"].includes(status || "")) {
    return "border-amber-400/30 bg-amber-500/15 text-amber-300";
  }
  return "border-slate-500/30 bg-slate-500/15 text-slate-300";
}

export default function PayrollCompensationPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard>({
    payroll_runs: 0,
    calculated_runs: 0,
    processed_employees: 0,
    gross_total: 0,
    deduction_total: 0,
    net_total: 0,
    overtime_total: 0,
    bonus_total: 0,
    receipts_pending_signature: 0,
  });

  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      const [dashRes, runsRes, itemsRes, receiptsRes, adjRes, dedRes] = await Promise.all([
        supabase.from("v_hr_payroll_dashboard").select("*").maybeSingle(),
        supabase.from("hr_payroll_runs").select("*").order("created_at", { ascending: false }),
        supabase.from("v_hr_payroll_detail").select("*").order("employee_name"),
        supabase.from("v_hr_payroll_receipts_detail").select("*").order("employee_name"),
        supabase.from("v_hr_payroll_adjustments_detail").select("*").order("created_at", { ascending: false }),
        supabase.from("v_hr_payroll_deductions_detail").select("*").order("employee_name"),
      ]);

      if (dashRes.error) throw dashRes.error;
      if (runsRes.error) throw runsRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (receiptsRes.error) throw receiptsRes.error;
      if (adjRes.error) throw adjRes.error;
      if (dedRes.error) throw dedRes.error;

      if (dashRes.data) setDashboard(dashRes.data as Dashboard);
      setRuns((runsRes.data || []) as PayrollRun[]);
      setItems((itemsRes.data || []) as PayrollItem[]);
      setReceipts((receiptsRes.data || []) as ReceiptRow[]);
      setAdjustments((adjRes.data || []) as Adjustment[]);
      setDeductions((dedRes.data || []) as Deduction[]);
    } catch (error: any) {
      setMessage(error.message || "Error cargando nómina.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.employee_code, i.employee_name, i.department, i.position_title, i.payroll_code]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, search]);

  async function generatePayroll() {
    try {
      setLoading(true);
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

      const { error } = await supabase.rpc("hr_generate_payroll_run", {
        p_name: `Nómina RD Wood ${now.toLocaleDateString("es-DO")}`,
        p_period_start: start,
        p_period_end: end,
      });

      if (error) throw error;
      setMessage("Nómina generada correctamente.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo generar la nómina.");
    } finally {
      setLoading(false);
    }
  }

  async function closeRun(id: string) {
    try {
      setLoading(true);
      const { error } = await supabase.rpc("hr_close_payroll_run", { p_payroll_run_id: id });
      if (error) throw error;
      setMessage("Corrida de nómina cerrada.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo cerrar la corrida.");
    } finally {
      setLoading(false);
    }
  }

  function printReceipt(r: ReceiptRow) {
    const html = `
      <html>
      <head>
        <title>${r.receipt_code}</title>
        <style>
          body{font-family:Arial;margin:40px;color:#111}
          .box{border:1px solid #ddd;border-radius:16px;padding:24px;max-width:760px;margin:auto}
          h1{margin:0;font-size:28px}
          .muted{color:#555;font-size:13px}
          table{width:100%;border-collapse:collapse;margin-top:20px}
          td{padding:10px;border-bottom:1px solid #eee}
          .total{font-size:24px;font-weight:900}
          .brand{letter-spacing:4px;color:#2563eb;font-weight:700}
        </style>
      </head>
      <body>
        <div class="box">
          <div class="brand">RD WOOD SYSTEM</div>
          <h1>Recibo de Pago</h1>
          <p class="muted">${r.receipt_code} · ${r.payroll_name}</p>
          <p><b>Empleado:</b> ${r.employee_code || ""} · ${r.employee_name}</p>
          <p><b>Departamento:</b> ${r.department || ""} · ${r.position_title || ""}</p>
          <p><b>Periodo:</b> ${r.period_start} al ${r.period_end}</p>
          <table>
            <tr><td>Pago bruto</td><td align="right">${money(r.gross_pay)}</td></tr>
            <tr><td>Deducciones</td><td align="right">${money(r.total_deductions)}</td></tr>
            <tr><td class="total">Neto a pagar</td><td align="right" class="total">${money(r.item_net_pay)}</td></tr>
          </table>
          <p class="muted">Token de validación: ${r.token}</p>
          <p class="muted">Estado: ${r.status}</p>
        </div>
        <script>window.print()</script>
      </body>
      </html>
    `;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "corridas", label: "Corridas", icon: Calculator },
    { id: "detalle", label: "Detalle", icon: ClipboardList },
    { id: "recibos", label: "Recibos", icon: Receipt },
    { id: "ajustes", label: "Ajustes", icon: Gift },
    { id: "deducciones", label: "Deducciones", icon: ShieldCheck },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">RD Wood System</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-5xl">
                Payroll & Compensation Pro
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Fase 22: nómina, horas extra, bonos, comisiones, AFP, SFS, ISR, recibos y costos laborales.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={generatePayroll}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-500"
              >
                <Calculator size={18} />
                Generar nómina
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
          <Kpi title="Corridas" value={dashboard.payroll_runs} icon={<Calculator size={20} />} />
          <Kpi title="Calculadas" value={dashboard.calculated_runs} icon={<CheckCircle2 size={20} />} />
          <Kpi title="Empleados" value={dashboard.processed_employees} icon={<Wallet size={20} />} />
          <Kpi title="Bruto" value={money(dashboard.gross_total)} icon={<Banknote size={20} />} />
          <Kpi title="Deducciones" value={money(dashboard.deduction_total)} icon={<ShieldCheck size={20} />} />
          <Kpi title="Neto" value={money(dashboard.net_total)} icon={<DollarSign size={20} />} />
          <Kpi title="Horas extra" value={money(dashboard.overtime_total)} icon={<BadgeDollarSign size={20} />} />
          <Kpi title="Bonos" value={money(dashboard.bonus_total)} icon={<Gift size={20} />} />
          <Kpi title="Recibos" value={dashboard.receipts_pending_signature} icon={<Receipt size={20} />} />
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

        {tab === "detalle" && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empleado, departamento, nómina..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>
        )}

        {tab === "dashboard" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="Últimas corridas de nómina" icon={<Calculator size={20} />}>
              <div className="space-y-3">
                {runs.slice(0, 6).map((r) => <RunCard key={r.id} item={r} onClose={closeRun} />)}
                {!runs.length && <p className="text-sm text-slate-400">No hay corridas.</p>}
              </div>
            </Panel>

            <Panel title="Top pagos netos" icon={<DollarSign size={20} />}>
              <div className="space-y-3">
                {items.slice(0, 8).map((i) => <PayrollItemCard key={i.id} item={i} />)}
                {!items.length && <p className="text-sm text-slate-400">No hay detalle.</p>}
              </div>
            </Panel>
          </section>
        )}

        {tab === "corridas" && (
          <Panel title="Corridas de nómina" icon={<Calculator size={20} />}>
            <div className="space-y-3">
              {runs.map((r) => <RunCard key={r.id} item={r} onClose={closeRun} />)}
            </div>
          </Panel>
        )}

        {tab === "detalle" && (
          <Panel title="Detalle por empleado" icon={<ClipboardList size={20} />}>
            <div className="space-y-3">
              {filteredItems.map((i) => <PayrollItemCard key={i.id} item={i} />)}
            </div>
          </Panel>
        )}

        {tab === "recibos" && (
          <Panel title="Recibos de pago" icon={<Receipt size={20} />}>
            <div className="space-y-3">
              {receipts.map((r) => (
                <div key={r.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{r.receipt_code} · {r.employee_name}</p>
                      <p className="text-xs text-slate-400">{r.payroll_name} · {r.period_start} → {r.period_end}</p>
                      <p className="mt-2 text-sm text-slate-300">Neto: {money(r.item_net_pay)}</p>
                      <p className="mt-1 text-xs text-slate-500">Token: {r.token}</p>
                    </div>
                    <div className="flex flex-col gap-2 lg:items-end">
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(r.status)}`}>
                        {r.status}
                      </span>
                      <button
                        onClick={() => printReceipt(r)}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500"
                      >
                        <Printer size={14} />
                        Imprimir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!receipts.length && <p className="text-sm text-slate-400">No hay recibos.</p>}
            </div>
          </Panel>
        )}

        {tab === "ajustes" && (
          <Panel title="Ajustes, comisiones e incentivos" icon={<Gift size={20} />}>
            <div className="space-y-3">
              {adjustments.map((a) => (
                <div key={a.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{a.code} · {a.name}</p>
                      <p className="text-xs text-slate-400">{a.employee_code} · {a.employee_name} · {a.adjustment_type}</p>
                      <p className="mt-2 text-sm text-slate-300">{a.notes}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-emerald-300">{money(a.amount)}</p>
                      <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black ${badgeClass(a.status)}`}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {!adjustments.length && <p className="text-sm text-slate-400">No hay ajustes.</p>}
            </div>
          </Panel>
        )}

        {tab === "deducciones" && (
          <Panel title="Deducciones fijas y variables" icon={<ShieldCheck size={20} />}>
            <div className="space-y-3">
              {deductions.map((d) => (
                <div key={d.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{d.code} · {d.name}</p>
                      <p className="text-xs text-slate-400">{d.employee_code} · {d.employee_name} · {d.deduction_type}</p>
                      <p className="mt-2 text-sm text-slate-300">{d.notes}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-red-300">
                        {d.deduction_type === "percent" ? `${d.percent_value}%` : money(d.amount)}
                      </p>
                      <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black ${badgeClass(d.status)}`}>
                        {d.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {!deductions.length && <p className="text-sm text-slate-400">No hay deducciones.</p>}
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function RunCard({ item, onClose }: { item: PayrollRun; onClose: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-black">{item.code} · {item.name}</p>
          <p className="text-xs text-slate-400">{item.period_start} → {item.period_end} · Pago {item.payment_date}</p>
          <p className="mt-2 text-sm text-slate-300">
            Empleados {item.employees_count} · Bruto {money(item.gross_total)} · Neto {money(item.net_total)}
          </p>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(item.status)}`}>
            {item.status}
          </span>
          {item.status !== "cerrada" && item.status !== "pagada" && (
            <button
              onClick={() => onClose(item.id)}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-500"
            >
              Cerrar nómina
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PayrollItemCard({ item }: { item: PayrollItem }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-black">{item.employee_code} · {item.employee_name}</p>
          <p className="text-xs text-slate-400">{item.department} · {item.position_title} · {item.payroll_code}</p>
          <p className="mt-2 text-sm text-slate-300">
            Base {money(item.base_salary)} · Extra {money(item.overtime_amount)} · Bono {money(item.bonus_amount)} · Comisión {money(item.commission_amount)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            AFP {money(item.afp_amount)} · SFS {money(item.sfs_amount)} · ISR {money(item.isr_amount)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Neto a pagar</p>
          <p className="text-2xl font-black text-emerald-300">{money(item.net_pay)}</p>
          <p className="text-xs text-slate-500">Bruto {money(item.gross_pay)} · Ded. {money(item.total_deductions)}</p>
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
