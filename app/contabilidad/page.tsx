"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  FileSearch,
  Landmark,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { analyzeAccountingAudit, type AccountingIssue, type LedgerEntry } from "@/lib/contabilidad/accounting-audit";

type AccountingState = {
  sales: any[];
  projectContracts: any[];
  payments: any[];
  clientPayments: any[];
  incomeRecords: any[];
  accountsPayable: any[];
  payablePayments: any[];
  purchaseOrders: any[];
  payrollRuns: any[];
  auditLogs: any[];
};

const emptyState: AccountingState = {
  sales: [],
  projectContracts: [],
  payments: [],
  clientPayments: [],
  incomeRecords: [],
  accountsPayable: [],
  payablePayments: [],
  purchaseOrders: [],
  payrollRuns: [],
  auditLogs: [],
};

async function safeSelect(table: string, limit = 1000) {
  try {
    const { data, error } = await supabase.from(table).select("*").limit(limit);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

function money(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateText(value?: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("es-DO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function issueTone(severity: AccountingIssue["severity"]) {
  if (severity === "critical") return "border-red-400/35 bg-red-500/10 text-red-100";
  if (severity === "warning") return "border-amber-400/35 bg-amber-500/10 text-amber-100";
  return "border-cyan-400/35 bg-cyan-500/10 text-cyan-100";
}

function entryTone(type: LedgerEntry["type"]) {
  if (type === "income") return "text-emerald-300";
  if (type === "expense") return "text-red-300";
  if (type === "payable") return "text-amber-300";
  if (type === "receivable") return "text-cyan-300";
  return "text-slate-300";
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    caja_principal: "Caja Principal",
    ingreso_manual: "Ingreso manual",
    project_contracts: "Contrato proyecto",
    sales: "Ventas / CxC",
    payments: "Cobros ventas",
    accounts_payable: "CxP",
    accounts_payable_payments: "Pagos suplidor",
    purchase_orders: "Orden compra",
    payroll_runs: "Nomina",
  };
  return labels[source] || source;
}

export default function ContabilidadBlindadaPage() {
  const [state, setState] = useState<AccountingState>(emptyState);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");

  async function loadData() {
    setLoading(true);
    const [
      sales,
      projectContracts,
      payments,
      clientPayments,
      incomeRecords,
      accountsPayable,
      payablePayments,
      purchaseOrders,
      payrollRuns,
      auditLogs,
    ] = await Promise.all([
      safeSelect("sales"),
      safeSelect("project_contracts"),
      safeSelect("payments"),
      safeSelect("client_payments"),
      safeSelect("income_records"),
      safeSelect("accounts_payable"),
      safeSelect("accounts_payable_payments"),
      safeSelect("purchase_orders"),
      safeSelect("payroll_runs"),
      safeSelect("audit_logs"),
    ]);

    setState({
      sales,
      projectContracts,
      payments,
      clientPayments,
      incomeRecords,
      accountsPayable,
      payablePayments,
      purchaseOrders,
      payrollRuns,
      auditLogs,
    });
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const audit = useMemo(() => analyzeAccountingAudit(state), [state]);

  const filteredLedger = useMemo(() => {
    const q = search.trim().toLowerCase();
    return audit.ledger.filter((entry) => {
      if (typeFilter !== "todos" && entry.type !== typeFilter) return false;
      if (!q) return true;
      return `${entry.source} ${entry.code} ${entry.party} ${entry.description} ${entry.status}`.toLowerCase().includes(q);
    });
  }, [audit.ledger, search, typeFilter]);

  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return audit.issues;
    return audit.issues.filter((issue) =>
      `${issue.area} ${issue.title} ${issue.detail} ${issue.action}`.toLowerCase().includes(q),
    );
  }, [audit.issues, search]);

  return (
    <main className="min-h-screen bg-[#020817] p-4 text-white md:p-6">
      <div className="mx-auto w-full max-w-[1780px] space-y-5">
        <section className="rounded-[28px] border border-cyan-400/20 bg-[linear-gradient(135deg,#06111d_0%,#0a1c2b_45%,#101a3c_100%)] p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.30em] text-cyan-300">
                <Landmark size={14} /> CONTABILIDAD PRO
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                Contabilidad Blindada
              </h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-300">
                Caja, CxC, CxP, compras, nomina y auditoria sin duplicar los espejos contables.
              </p>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-5 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              Actualizar
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <Kpi title="Blindaje contable" value={`${audit.score}%`} icon={<ShieldCheck />} tone={audit.score >= 80 ? "green" : "amber"} />
          <Kpi title="Cobros reales caja" value={money(audit.metrics.cashIn)} icon={<TrendingUp />} tone="green" />
          <Kpi title="Ventas emitidas" value={money(audit.metrics.invoicedIncome)} icon={<Wallet />} tone="cyan" />
          <Kpi title="CxC abierta" value={money(audit.metrics.receivableOpen)} icon={<Banknote />} tone={audit.metrics.receivableOpen ? "amber" : "green"} />
          <Kpi title="Egresos pagos" value={money(audit.metrics.cashOut)} icon={<TrendingDown />} tone="red" />
          <Kpi title="CxP abierta" value={money(audit.metrics.payableOpen)} icon={<AlertTriangle />} tone={audit.metrics.payableOpen ? "amber" : "green"} />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[26px] border border-cyan-400/15 bg-[#07111f] p-5 shadow-2xl shadow-black/30">
            <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-2xl font-black">Libro mayor operativo</h2>
                <p className="text-sm text-slate-400">{filteredLedger.length} movimiento(s) filtrado(s)</p>
              </div>
              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative w-full md:w-[340px]">
                  <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar codigo, cliente, suplidor..."
                    className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] pl-11 pr-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="h-12 rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-black text-white outline-none focus:border-cyan-400"
                >
                  <option value="todos">Todos</option>
                  <option value="income">Ingresos</option>
                  <option value="expense">Egresos</option>
                  <option value="receivable">CxC</option>
                  <option value="payable">CxP</option>
                </select>
              </div>
            </div>

            <div className="overflow-auto rounded-2xl border border-slate-800 bg-[#030817]">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-[#030817] text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                  <tr>
                    <th className="px-4 py-4">Tipo</th>
                    <th className="px-4 py-4">Codigo</th>
                    <th className="px-4 py-4">Origen</th>
                    <th className="px-4 py-4">Cliente / Suplidor</th>
                    <th className="px-4 py-4">Monto</th>
                    <th className="px-4 py-4">Pagado</th>
                    <th className="px-4 py-4">Balance</th>
                    <th className="px-4 py-4">Fecha</th>
                    <th className="px-4 py-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredLedger.slice(0, 250).map((entry) => (
                    <tr key={entry.id} className="hover:bg-cyan-500/5">
                      <td className={`px-4 py-4 font-black uppercase ${entryTone(entry.type)}`}>{entry.type}</td>
                      <td className="px-4 py-4 font-black text-cyan-200">{entry.code}</td>
                      <td className="px-4 py-4 text-slate-300">{sourceLabel(entry.source)}</td>
                      <td className="px-4 py-4">
                        <p className="font-black text-white">{entry.party}</p>
                        <p className="text-xs text-slate-500">{entry.description}</p>
                      </td>
                      <td className="px-4 py-4 font-black text-white">{money(entry.amount)}</td>
                      <td className="px-4 py-4 font-black text-emerald-300">{money(entry.paid)}</td>
                      <td className="px-4 py-4 font-black text-amber-300">{money(entry.balance)}</td>
                      <td className="px-4 py-4 text-slate-400">{dateText(entry.createdAt)}</td>
                      <td className="px-4 py-4 text-slate-300">{entry.status || "-"}</td>
                    </tr>
                  ))}
                  {!filteredLedger.length ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-sm font-bold text-slate-500">
                        No hay movimientos para este filtro.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5">
            <Panel title="Alertas anti fraude" icon={<AlertTriangle className="text-amber-300" />}>
              <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
                {filteredIssues.map((issue, index) => (
                  <div key={`${issue.title}-${index}`} className={`rounded-2xl border p-4 ${issueTone(issue.severity)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-current/25 px-3 py-1 text-[11px] font-black uppercase">{issue.severity}</span>
                      <span className="text-xs font-black uppercase tracking-[0.22em] opacity-80">{issue.area}</span>
                    </div>
                    <h3 className="mt-3 font-black">{issue.title}</h3>
                    <p className="mt-1 text-sm opacity-90">{issue.detail}</p>
                    <p className="mt-3 rounded-xl border border-current/15 bg-black/20 p-3 text-xs font-bold">{issue.action}</p>
                  </div>
                ))}

                {!filteredIssues.length ? (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center text-emerald-100">
                    <CheckCircle2 className="mx-auto mb-3" size={42} />
                    <p className="font-black">Sin alertas contables.</p>
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel title="Controles de cierre" icon={<FileSearch className="text-cyan-300" />}>
              {audit.controls.map((control) => (
                <div key={control} className="rounded-2xl border border-slate-800 bg-[#030817] p-4 text-sm font-bold text-slate-200">
                  {control}
                </div>
              ))}
            </Panel>

            <Panel title="Cobertura auditoria" icon={<BadgeCheck className="text-cyan-300" />}>
              <Line label="Audit logs" value={String(audit.metrics.auditLogs)} />
              <Line label="Alertas criticas" value={String(audit.metrics.criticalIssues)} danger={audit.metrics.criticalIssues > 0} />
              <Line label="Alertas medias" value={String(audit.metrics.warningIssues)} danger={audit.metrics.warningIssues > 0} />
              <Line label="Nomina neta cargada" value={money(audit.metrics.payrollNet)} />
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

function Kpi({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  tone: "cyan" | "green" | "amber" | "red";
}) {
  const tones = {
    cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-300 shadow-cyan-950/20",
    green: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300 shadow-emerald-950/20",
    amber: "border-amber-400/25 bg-amber-500/10 text-amber-300 shadow-amber-950/20",
    red: "border-red-400/25 bg-red-500/10 text-red-300 shadow-red-950/20",
  };
  return (
    <div className="overflow-hidden rounded-[22px] border border-cyan-400/14 bg-[linear-gradient(145deg,#081421,#050b16)] p-5 shadow-xl shadow-black/25">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase leading-4 tracking-[0.22em] text-slate-400">{title}</p>
          <h3 className="mt-3 break-words text-xl font-black leading-tight text-white xl:text-[1.35rem]">
            {value}
          </h3>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-lg ${tones[tone]}`}>
          <span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] border border-cyan-400/15 bg-[#07111f] p-5 shadow-2xl shadow-black/30">
      <div className="mb-5 flex items-center gap-3">
        <span className="[&>svg]:h-6 [&>svg]:w-6">{icon}</span>
        <h2 className="text-2xl font-black">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Line({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#030817] p-4 text-sm">
      <span className="font-bold text-slate-400">{label}</span>
      <span className={`font-black ${danger ? "text-red-300" : "text-white"}`}>{value}</span>
    </div>
  );
}
