"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Signature,
  UserRound,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { compensationLabel } from "@/lib/rrhh/operational-compensation";

type PayrollRun = {
  id: string;
  period_start: string;
  period_end: string;
  employees_count?: number | null;
  gross_total?: number | null;
  overtime_total?: number | null;
  deductions_total?: number | null;
  net_total?: number | null;
  status?: string | null;
  created_at?: string | null;
};

type PayrollItem = {
  id: string;
  payroll_run_id: string;
  employee_id?: string | null;
  employee_code?: string | null;
  employee_name?: string | null;
  department?: string | null;
  position?: string | null;
  gross_salary?: number | null;
  worked_minutes?: number | null;
  extra_minutes?: number | null;
  late_minutes?: number | null;
  overtime_pay?: number | null;
  operational_compensation?: number | null;
  operational_compensation_detail?: Array<{
    role_key?: string | null;
    role_label?: string | null;
    stage?: string | null;
    unit_type?: string | null;
    quantity?: number | null;
    base_rate?: number | null;
    stage_percent?: number | null;
    role_percent?: number | null;
    amount?: number | null;
    order_code?: string | null;
    module_name?: string | null;
  }> | null;
  late_deduction?: number | null;
  afp_amount?: number | null;
  sfs_amount?: number | null;
  isr_amount?: number | null;
  other_deductions?: number | null;
  net_pay?: number | null;
  bank_name?: string | null;
  bank_account?: string | null;
  status?: string | null;
  created_at?: string | null;
  employees?: {
    photo_url?: string | null;
    full_name?: string | null;
  } | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function currency(value: number | null | undefined) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
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

function minutesToText(minutes?: number | null) {
  const safe = Math.max(0, Math.round(Number(minutes || 0)));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m}m`;
}

function numberValue(value?: number | null) {
  return Number(value || 0);
}

function operationalCompensationDetail(item: PayrollItem) {
  const lines = Array.isArray(item.operational_compensation_detail) ? item.operational_compensation_detail : [];
  if (!lines.length) return "Pies producidos/instalados auditados";

  return lines
    .slice(0, 3)
    .map((line) => {
      const role = line.role_label || compensationLabel(line.role_key);
      const unit = line.unit_type === "pie_cuadrado" ? "pie2" : "pie lin.";
      return `${role}: ${Number(line.quantity || 0).toFixed(2)} ${unit}`;
    })
    .join(" | ");
}

function printReceipt(itemId: string) {
  const receipt = document.getElementById(`receipt-${itemId}`);
  if (!receipt) return;

  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) return;

  win.document.write(`
    <html>
      <head>
        <title>Recibo de Nómina</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, Helvetica, sans-serif;
            background: #ffffff;
            color: #0f172a;
          }
          .receipt {
            width: 100%;
            max-width: 850px;
            margin: 0 auto;
            border: 1px solid #cbd5e1;
            border-radius: 18px;
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #031525, #0f2f5f);
            color: white;
            padding: 28px;
          }
          .brand {
            font-size: 12px;
            letter-spacing: 5px;
            color: #67e8f9;
            font-weight: 900;
          }
          h1 { margin: 8px 0 0; font-size: 30px; }
          .sub { margin-top: 6px; color: #cbd5e1; font-size: 13px; }
          .content { padding: 26px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .box {
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 14px;
            background: #f8fafc;
          }
          .label {
            font-size: 10px;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 900;
          }
          .value {
            margin-top: 7px;
            font-size: 18px;
            font-weight: 900;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th {
            text-align: left;
            font-size: 11px;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #475569;
            background: #f1f5f9;
            padding: 12px;
            border-bottom: 1px solid #cbd5e1;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
          }
          .right { text-align: right; }
          .net {
            background: #ecfdf5;
            color: #047857;
            font-weight: 900;
            font-size: 20px;
          }
          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 35px;
            margin-top: 60px;
          }
          .line {
            border-top: 1px solid #334155;
            padding-top: 10px;
            text-align: center;
            font-size: 12px;
            color: #334155;
            font-weight: 700;
          }
          .footer {
            padding: 16px 26px 26px;
            color: #64748b;
            font-size: 11px;
            text-align: center;
          }
          @media print {
            body { padding: 0; }
            .receipt { border-radius: 0; border: none; }
          }
        </style>
      </head>
      <body>
        ${receipt.innerHTML}
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);

  win.document.close();
}

function exportReceiptHtml(item: PayrollItem, run: PayrollRun) {
  const html = document.getElementById(`receipt-${item.id}`)?.innerHTML || "";
  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recibo-nomina-${item.employee_code || item.employee_name || item.id}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function RecibosNominaPdfProPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) || null,
    [runs, selectedRunId]
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) || null,
    [items, selectedItemId]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) =>
      [
        item.employee_name,
        item.employee_code,
        item.department,
        item.position,
        item.bank_name,
        item.bank_account,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, search]);

  async function loadRuns() {
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;

      const list = (data || []) as PayrollRun[];
      setRuns(list);

      if (!selectedRunId && list.length) {
        setSelectedRunId(list[0].id);
        await loadItems(list[0].id);
      } else if (selectedRunId) {
        await loadItems(selectedRunId);
      }

      setMessage("Recibos de nómina actualizados.");
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "Error cargando recibos de nómina.");
    } finally {
      setLoading(false);
    }
  }

  async function loadItems(runId: string) {
    const { data, error } = await supabase
      .from("payroll_run_items")
      .select("*, employees(photo_url, full_name)")
      .eq("payroll_run_id", runId)
      .order("employee_name", { ascending: true });

    if (error) throw error;

    const list = (data || []) as PayrollItem[];
    setItems(list);
    setSelectedItemId(list[0]?.id || "");
  }

  useEffect(() => {
    loadRuns();
  }, []);

  async function handleRunChange(runId: string) {
    setSelectedRunId(runId);
    setLoading(true);
    try {
      await loadItems(runId);
      setMessage("Corrida de nómina cargada.");
    } catch (error: any) {
      setMessage(error?.message || "Error cargando detalle de nómina.");
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.gross += numberValue(item.gross_salary);
        acc.overtime += numberValue(item.overtime_pay);
        acc.operationalCompensation += numberValue(item.operational_compensation);
        acc.deductions +=
          numberValue(item.afp_amount) +
          numberValue(item.sfs_amount) +
          numberValue(item.isr_amount) +
          numberValue(item.other_deductions) +
          numberValue(item.late_deduction);
        acc.net += numberValue(item.net_pay);
        return acc;
      },
      { gross: 0, overtime: 0, operationalCompensation: 0, deductions: 0, net: 0 }
    );
  }, [items]);

  return (
    <main className="min-h-screen bg-[#020817] p-4 text-white md:p-6">
      <div className="mx-auto w-full max-w-[1780px] space-y-5">
        <section className="rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-[#081421] via-[#0b1830] to-[#111b3f] p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 md:flex">
                <FileText size={34} />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.30em] text-cyan-300">
                  <BadgeCheck size={14} /> FASE 8.2.7
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                  Recibos de Nómina PDF PRO
                </h1>
                <p className="mt-2 max-w-4xl text-sm text-slate-300">
                  Generación de recibos individuales desde corridas de nómina: desglose, firmas y comprobante imprimible.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={loadRuns}
                disabled={loading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-5 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                Actualizar
              </button>

              <button
                disabled={!selectedItem}
                onClick={() => selectedItem && printReceipt(selectedItem.id)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                <Printer size={18} />
                Imprimir / PDF
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
          <Kpi title="Corridas" value={runs.length} subtitle="Nóminas guardadas" icon={<FileText />} tone="cyan" />
          <Kpi title="Empleados" value={items.length} subtitle="Recibos en corrida" icon={<UserRound />} tone="cyan" />
          <Kpi title="Bruto" value={currency(totals.gross)} subtitle="Salario total" icon={<Banknote />} tone="green" />
          <Kpi title="Comp. operativa" value={currency(totals.operationalCompensation)} subtitle="Pies auditados" icon={<BadgeCheck />} tone="cyan" />
          <Kpi title="Deducciones" value={currency(totals.deductions)} subtitle="AFP + SFS + ISR + otros" icon={<Wallet />} tone="amber" />
          <Kpi title="Neto" value={currency(totals.net)} subtitle="Total a pagar" icon={<CheckCircle2 />} tone="green" />
        </section>

        <section className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                <CalendarDays size={14} /> Corrida de nómina
              </span>
              <select
                value={selectedRunId}
                onChange={(e) => handleRunChange(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              >
                {!runs.length ? <option value="">No hay nóminas guardadas</option> : null}
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {formatDate(run.period_start)} - {formatDate(run.period_end)} · {currency(run.net_total)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                <Search size={14} /> Buscar recibo
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Empleado, código, banco, cuenta..."
                className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              />
            </label>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
          <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
            <h2 className="text-2xl font-black">Recibos disponibles</h2>
            <p className="mt-1 text-sm text-slate-400">Selecciona un empleado para generar su recibo.</p>

            <div className="mt-5 max-h-[720px] space-y-3 overflow-auto pr-1">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={cx(
                    "w-full rounded-2xl border p-4 text-left transition",
                    selectedItemId === item.id
                      ? "border-cyan-400 bg-cyan-500/15"
                      : "border-slate-800 bg-[#030817] hover:border-cyan-700"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar item={item} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-white">{item.employee_name || "Empleado"}</p>
                      <p className="text-xs text-slate-400">
                        {item.employee_code || "Sin código"} · {item.position || "Sin cargo"}
                      </p>
                      <p className="mt-1 text-xs text-emerald-300">Neto: {currency(item.net_pay)}</p>
                    </div>
                    <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase text-amber-300">
                      {item.status || "pendiente"}
                    </span>
                  </div>
                </button>
              ))}

              {!filteredItems.length ? (
                <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm font-bold text-slate-500">
                  No hay recibos para mostrar.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black">Vista previa del recibo</h2>
                <p className="text-sm text-slate-400">Formato profesional listo para imprimir o guardar como PDF.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  disabled={!selectedItem}
                  onClick={() => selectedItem && selectedRun && exportReceiptHtml(selectedItem, selectedRun)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 disabled:opacity-60"
                >
                  <Download size={16} />
                  HTML
                </button>

                <button
                  disabled={!selectedItem}
                  onClick={() => selectedItem && printReceipt(selectedItem.id)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  <Printer size={16} />
                  Imprimir / PDF
                </button>
              </div>
            </div>

            {selectedItem && selectedRun ? (
              <ReceiptPreview item={selectedItem} run={selectedRun} />
            ) : (
              <div className="flex min-h-[600px] items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-[#030817] text-center">
                <div>
                  <Eye className="mx-auto mb-4 text-slate-500" size={52} />
                  <p className="text-xl font-black text-white">Selecciona un recibo</p>
                  <p className="mt-2 text-sm text-slate-500">Cuando selecciones un empleado, aparecerá el recibo aquí.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ReceiptPreview({ item, run }: { item: PayrollItem; run: PayrollRun }) {
  const totalDeductions =
    numberValue(item.afp_amount) +
    numberValue(item.sfs_amount) +
    numberValue(item.isr_amount) +
    numberValue(item.other_deductions) +
    numberValue(item.late_deduction);

  return (
    <div className="overflow-auto rounded-3xl bg-white p-3 text-slate-900">
      <div id={`receipt-${item.id}`} className="receipt">
        <div className="header">
          <div className="brand">RD WOOD SYSTEM</div>
          <h1>Recibo de Nómina</h1>
          <div className="sub">
            Periodo: {formatDate(run.period_start)} al {formatDate(run.period_end)} · Comprobante interno RRHH
          </div>
        </div>

        <div className="content">
          <div className="grid">
            <div className="box">
              <div className="label">Empleado</div>
              <div className="value">{item.employee_name || "Empleado"}</div>
            </div>

            <div className="box">
              <div className="label">Código</div>
              <div className="value">{item.employee_code || "-"}</div>
            </div>

            <div className="box">
              <div className="label">Departamento</div>
              <div className="value">{item.department || "-"}</div>
            </div>

            <div className="box">
              <div className="label">Cargo</div>
              <div className="value">{item.position || "-"}</div>
            </div>

            <div className="box">
              <div className="label">Banco</div>
              <div className="value">{item.bank_name || "Sin banco"}</div>
            </div>

            <div className="box">
              <div className="label">Cuenta</div>
              <div className="value">{item.bank_account || "Sin cuenta"}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th className="right">Detalle</th>
                <th className="right">Monto</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>Salario bruto</td>
                <td className="right">Base mensual / periodo</td>
                <td className="right">{currency(item.gross_salary)}</td>
              </tr>
              <tr>
                <td>Horas trabajadas</td>
                <td className="right">{minutesToText(item.worked_minutes)}</td>
                <td className="right">-</td>
              </tr>
              <tr>
                <td>Horas extra</td>
                <td className="right">{minutesToText(item.extra_minutes)}</td>
                <td className="right">{currency(item.overtime_pay)}</td>
              </tr>
              <tr>
                <td>Compensacion operacional</td>
                <td className="right">{operationalCompensationDetail(item)}</td>
                <td className="right">{currency(item.operational_compensation)}</td>
              </tr>
              <tr>
                <td>Tardanza</td>
                <td className="right">{minutesToText(item.late_minutes)}</td>
                <td className="right">-{currency(item.late_deduction)}</td>
              </tr>
              <tr>
                <td>AFP</td>
                <td className="right">2.87%</td>
                <td className="right">-{currency(item.afp_amount)}</td>
              </tr>
              <tr>
                <td>SFS</td>
                <td className="right">3.04%</td>
                <td className="right">-{currency(item.sfs_amount)}</td>
              </tr>
              <tr>
                <td>ISR</td>
                <td className="right">Según configuración</td>
                <td className="right">-{currency(item.isr_amount)}</td>
              </tr>
              <tr>
                <td>Otros descuentos</td>
                <td className="right">Otros</td>
                <td className="right">-{currency(item.other_deductions)}</td>
              </tr>
              <tr>
                <td><strong>Total descuentos</strong></td>
                <td className="right">AFP + SFS + ISR + otros</td>
                <td className="right"><strong>-{currency(totalDeductions)}</strong></td>
              </tr>
              <tr className="net">
                <td>Neto a pagar</td>
                <td className="right">Transferencia / efectivo</td>
                <td className="right">{currency(item.net_pay)}</td>
              </tr>
            </tbody>
          </table>

          <div className="signatures">
            <div className="line">Firma del empleado</div>
            <div className="line">Firma autorizada / RRHH</div>
          </div>
        </div>

        <div className="footer">
          Este recibo es generado por RD Wood System. Verifique los montos antes de firma y pago.
        </div>
      </div>
    </div>
  );
}

function Avatar({ item }: { item: PayrollItem }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/25 bg-cyan-500/10 text-cyan-300">
      {item.employees?.photo_url ? (
        <img src={item.employees.photo_url} className="h-full w-full object-cover" />
      ) : (
        <UserRound size={20} />
      )}
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
