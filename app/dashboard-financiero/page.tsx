import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Boxes,
  ClipboardList,
  Coins,
  Factory,
  PackageSearch,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Wallet,
} from "lucide-react";

import {
  analyzeAccountingAudit,
  type AccountingIssue,
  type LedgerEntry,
} from "@/lib/contabilidad/accounting-audit";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type FinanceSnapshot = {
  audit: ReturnType<typeof analyzeAccountingAudit>;
  inventoryValue: number;
  stockTotal: number;
  products: number;
  stockCritical: number;
  purchasePendingCount: number;
  purchasePendingTotal: number;
  productionActive: number;
  productionCost: number;
  revenueBase: number;
  costBase: number;
  profit: number;
  margin: number;
  lastUpdate: string;
  sourceNote: string;
};

function n(value: any) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function text(value: any) {
  return String(value ?? "").trim();
}

function norm(value: any) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function money(value: number, digits = 2) {
  return `RD$${Number(value || 0).toLocaleString("es-DO", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function compactMoney(value: number) {
  const abs = Math.abs(value || 0);
  if (abs >= 1_000_000) return `RD$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 100_000) return `RD$${(value / 1_000).toFixed(1)}K`;
  return money(value, 0);
}

function rowAmount(row: any, keys: string[]) {
  for (const key of keys) {
    const value = n(row?.[key]);
    if (value !== 0) return value;
  }
  return 0;
}

function stockOf(row: any) {
  return rowAmount(row, ["stock", "quantity", "qty", "available_qty", "on_hand"]);
}

function inventoryCostOf(row: any) {
  return rowAmount(row, [
    "purchase_cost",
    "cost_price",
    "unit_cost",
    "average_cost",
    "cost",
    "sale_price",
    "unit_price",
  ]);
}

function isCriticalStock(row: any) {
  const stock = stockOf(row);
  const minimum = rowAmount(row, ["min_stock", "minimum_stock", "reorder_point", "safety_stock"]);
  if (minimum > 0) return stock <= minimum;
  return stock <= 0;
}

function isPendingPurchase(row: any) {
  const status = norm(row?.status || row?.state || row?.workflow_status);
  return !["recibida", "recibido", "received", "cerrada", "closed", "completada", "completed", "cancelada", "cancelled"].some((item) =>
    status.includes(item),
  );
}

function isActiveProduction(row: any) {
  const status = norm(row?.status || row?.state || row?.workflow_status);
  return !["terminada", "terminado", "completed", "completada", "cerrada", "closed", "cancelada", "cancelled", "entregado"].some((item) =>
    status.includes(item),
  );
}

function productionCostOf(row: any) {
  return rowAmount(row, [
    "total_cost",
    "cost_total",
    "estimated_cost",
    "production_cost",
    "costo_total",
    "costo",
    "cost",
  ]);
}

async function fetchSupabase(path: string, options: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Faltan variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const body = await res.text();
  if (!res.ok) throw new Error(body || `HTTP ${res.status}`);
  return body ? JSON.parse(body) : null;
}

async function safeTable(table: string, limit = 1000) {
  try {
    const rows = await fetchSupabase(`/rest/v1/${table}?select=*&limit=${limit}`);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function getFinanceSnapshot(): Promise<FinanceSnapshot> {
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
    inventory,
    productionOrders,
  ] = await Promise.all([
    safeTable("sales", 500),
    safeTable("project_contracts", 1000),
    safeTable("payments", 1000),
    safeTable("client_payments", 1500),
    safeTable("income_records", 1500),
    safeTable("accounts_payable", 1000),
    safeTable("accounts_payable_payments", 1000),
    safeTable("purchase_orders", 1000),
    safeTable("payroll_runs", 500),
    safeTable("audit_logs", 1000),
    safeTable("inventory", 1500),
    safeTable("production_orders", 1000),
  ]);

  const audit = analyzeAccountingAudit({
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

  const inventoryValue = inventory.reduce((sum, item) => sum + stockOf(item) * inventoryCostOf(item), 0);
  const stockTotal = inventory.reduce((sum, item) => sum + stockOf(item), 0);
  const stockCritical = inventory.filter(isCriticalStock).length;

  const pendingPurchases = purchaseOrders.filter(isPendingPurchase);
  const purchasePendingTotal = pendingPurchases.reduce(
    (sum, po) => sum + rowAmount(po, ["total_amount", "total", "amount", "subtotal"]),
    0,
  );

  const activeProduction = productionOrders.filter(isActiveProduction);
  const productionCost = productionOrders.reduce((sum, order) => sum + productionCostOf(order), 0);
  const revenueBase = Math.max(audit.metrics.invoicedIncome, audit.metrics.cashIn);
  const costBase = productionCost + audit.metrics.cashOut;
  const profit = revenueBase - costBase;
  const margin = revenueBase > 0 ? (profit / revenueBase) * 100 : 0;

  return {
    audit,
    inventoryValue,
    stockTotal,
    products: inventory.length,
    stockCritical,
    purchasePendingCount: pendingPurchases.length,
    purchasePendingTotal,
    productionActive: activeProduction.length,
    productionCost,
    revenueBase,
    costBase,
    profit,
    margin,
    lastUpdate: new Date().toLocaleString("es-DO"),
    sourceNote: "Lectura directa: contratos, caja, CxC/CxP, compras, produccion e inventario.",
  };
}

function toneClasses(tone: "green" | "cyan" | "blue" | "amber" | "red" | "violet") {
  const tones = {
    green: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    cyan: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
    blue: "border-blue-400/25 bg-blue-400/10 text-blue-200",
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    red: "border-rose-400/25 bg-rose-400/10 text-rose-200",
    violet: "border-violet-400/25 bg-violet-400/10 text-violet-200",
  };
  return tones[tone];
}

function KpiCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: any;
  tone: "green" | "cyan" | "blue" | "amber" | "red" | "violet";
}) {
  return (
    <article className="min-w-0 rounded-[24px] border border-white/10 bg-[#0b1224]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.03]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.32em] text-slate-500">{title}</p>
          <h2 className="mt-3 break-words text-2xl font-black leading-tight text-white md:text-[28px]">{value}</h2>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${toneClasses(tone)}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-400">{detail}</p>
    </article>
  );
}

function IssueBadge({ issue }: { issue: AccountingIssue }) {
  const isCritical = issue.severity === "critical";
  return (
    <div className={`rounded-2xl border p-4 ${isCritical ? "border-rose-400/25 bg-rose-500/10" : "border-amber-400/25 bg-amber-500/10"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${isCritical ? "bg-rose-400/15 text-rose-200" : "bg-amber-400/15 text-amber-200"}`}>
          {issue.severity}
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{issue.area}</span>
      </div>
      <h3 className="mt-3 text-base font-black text-white">{issue.title}</h3>
      <p className="mt-1 text-sm text-slate-300">{issue.detail}</p>
      <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-slate-200">{issue.action}</p>
    </div>
  );
}

function ledgerTone(entry: LedgerEntry) {
  if (entry.type === "income") return "text-emerald-300";
  if (entry.type === "expense") return "text-rose-300";
  if (entry.type === "receivable") return "text-cyan-300";
  return "text-amber-300";
}

export default async function DashboardFinancieroPage() {
  const snapshot = await getFinanceSnapshot();
  const { audit } = snapshot;
  const issues = audit.issues.slice(0, 4);
  const ledger = audit.ledger.slice(0, 8);
  const health = Math.max(0, Math.min(100, audit.score - (snapshot.margin < 10 && snapshot.revenueBase > 0 ? 8 : 0)));

  const cards = [
    {
      title: "Cobros reales",
      value: money(audit.metrics.cashIn),
      detail: "Caja deduplicada",
      icon: Wallet,
      tone: "green" as const,
    },
    {
      title: "Venta contratada",
      value: money(audit.metrics.invoicedIncome),
      detail: "Contratos y ventas emitidas",
      icon: ClipboardList,
      tone: "cyan" as const,
    },
    {
      title: "CxC abierta",
      value: money(audit.metrics.receivableOpen),
      detail: "Pendiente por cobrar",
      icon: Banknote,
      tone: audit.metrics.receivableOpen > 0 ? ("amber" as const) : ("green" as const),
    },
    {
      title: "Egresos pagados",
      value: money(audit.metrics.cashOut),
      detail: "Pagos suplidor y nomina",
      icon: ArrowDownRight,
      tone: audit.metrics.cashOut > 0 ? ("red" as const) : ("blue" as const),
    },
    {
      title: "CxP abierta",
      value: money(audit.metrics.payableOpen),
      detail: "Compromisos pendientes",
      icon: CreditIcon,
      tone: audit.metrics.payableOpen > 0 ? ("amber" as const) : ("green" as const),
    },
    {
      title: "Utilidad real",
      value: money(snapshot.profit),
      detail: `Margen ${snapshot.margin.toFixed(1)}%`,
      icon: ArrowUpRight,
      tone: snapshot.profit >= 0 ? ("green" as const) : ("red" as const),
    },
    {
      title: "Inventario valor",
      value: compactMoney(snapshot.inventoryValue),
      detail: `${snapshot.products} articulos activos`,
      icon: Boxes,
      tone: "blue" as const,
    },
    {
      title: "Stock critico",
      value: String(snapshot.stockCritical),
      detail: `${snapshot.stockTotal.toLocaleString("es-DO")} unidades fisicas`,
      icon: AlertTriangle,
      tone: snapshot.stockCritical > 0 ? ("red" as const) : ("green" as const),
    },
    {
      title: "Compras pendientes",
      value: String(snapshot.purchasePendingCount),
      detail: money(snapshot.purchasePendingTotal),
      icon: ShoppingCart,
      tone: snapshot.purchasePendingCount > 0 ? ("amber" as const) : ("green" as const),
    },
    {
      title: "Produccion activa",
      value: String(snapshot.productionActive),
      detail: `Costo acumulado ${money(snapshot.productionCost)}`,
      icon: Factory,
      tone: snapshot.productionActive > 0 ? ("cyan" as const) : ("blue" as const),
    },
    {
      title: "Costo total",
      value: money(snapshot.costBase),
      detail: "Produccion + egresos",
      icon: Coins,
      tone: "violet" as const,
    },
    {
      title: "Blindaje",
      value: `${health}%`,
      detail: `${audit.metrics.criticalIssues} criticas / ${audit.metrics.warningIssues} alertas`,
      icon: ShieldCheck,
      tone: health >= 85 ? ("green" as const) : health >= 65 ? ("amber" as const) : ("red" as const),
    },
  ];

  return (
    <main className="min-h-screen bg-[#050914] p-4 text-white md:p-6">
      <section className="overflow-hidden rounded-[30px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_34%),linear-gradient(135deg,rgba(8,47,73,0.94),rgba(15,23,42,0.96)_55%,rgba(30,41,59,0.92))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.38)] md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-5xl">
            <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.38em] text-cyan-100">
              Finanzas reales - CEO live
            </div>
            <h1 className="mt-5 text-4xl font-black leading-none text-white md:text-6xl">
              Dashboard Financiero Real
            </h1>
            <p className="mt-4 max-w-4xl text-base font-semibold leading-7 text-slate-300">
              Caja, contratos, cuentas por cobrar, cuentas por pagar, compras, produccion e inventario en una sola lectura operativa.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/20 p-4 lg:min-w-[280px]">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">Ultima actualizacion</p>
            <p className="text-lg font-black text-cyan-100">{snapshot.lastUpdate}</p>
            <a
              href="/dashboard-financiero"
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-50 hover:bg-cyan-300/20"
            >
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </a>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <KpiCard key={card.title} {...card} />
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-[28px] border border-white/10 bg-[#071122]/90 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.32)] md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-cyan-300" />
                <h2 className="text-2xl font-black">Lectura ejecutiva</h2>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-400">{snapshot.sourceNote}</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-200">Resultado</p>
              <p className="text-xl font-black text-white">{money(snapshot.profit)}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Ingresos base</p>
              <p className="mt-2 text-xl font-black text-white">{money(snapshot.revenueBase)}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">Mayor entre facturado y cobrado.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Costo base</p>
              <p className="mt-2 text-xl font-black text-white">{money(snapshot.costBase)}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">Produccion mas egresos reales.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Margen</p>
              <p className={`mt-2 text-xl font-black ${snapshot.margin >= 20 ? "text-emerald-300" : snapshot.margin >= 10 ? "text-amber-300" : "text-rose-300"}`}>
                {snapshot.margin.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400">Utilidad sobre ingreso base.</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr] gap-3 bg-black/35 px-4 py-3 text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
              <span>Movimiento</span>
              <span>Origen</span>
              <span>Monto</span>
              <span>Balance</span>
            </div>
            <div className="divide-y divide-white/10">
              {ledger.length > 0 ? (
                ledger.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[1fr_0.8fr_0.8fr_0.8fr] gap-3 px-4 py-4 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-black text-white">{entry.party}</p>
                      <p className="truncate text-xs font-semibold text-slate-500">{entry.description}</p>
                    </div>
                    <p className={`truncate font-black uppercase ${ledgerTone(entry)}`}>{entry.type}</p>
                    <p className="font-black text-white">{money(entry.amount)}</p>
                    <p className="font-black text-slate-300">{money(entry.balance)}</p>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                  No hay movimientos financieros disponibles.
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-[#071122]/90 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.32)] md:p-6">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-cyan-300" />
              <h2 className="text-2xl font-black">Decisiones</h2>
            </div>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-black text-white">
                  {snapshot.profit >= 0 ? "Rentabilidad positiva" : "Proyecto o periodo en perdida"}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {snapshot.profit >= 0
                    ? "La venta cubre el costo leido por el sistema."
                    : "Revisar costos de produccion, compras y egresos antes de cerrar."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-black text-white">
                  {audit.metrics.receivableOpen > 0 ? "Cobranza pendiente" : "CxC al dia"}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {audit.metrics.receivableOpen > 0
                    ? `Hay ${money(audit.metrics.receivableOpen)} pendiente por cobrar.`
                    : "No hay balance abierto en contratos/ventas leidos."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-black text-white">
                  {snapshot.stockCritical > 0 ? "Inventario requiere atencion" : "Inventario sin criticos"}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {snapshot.stockCritical > 0
                    ? `${snapshot.stockCritical} articulos estan en minimo o sin stock.`
                    : "Los articulos activos estan por encima del minimo configurado."}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#071122]/90 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.32)] md:p-6">
            <div className="flex items-center gap-3">
              <PackageSearch className="h-6 w-6 text-amber-300" />
              <h2 className="text-2xl font-black">Alertas reales</h2>
            </div>
            <div className="mt-5 space-y-3">
              {issues.length > 0 ? (
                issues.map((issue, index) => <IssueBadge key={`${issue.title}-${index}`} issue={issue} />)
              ) : (
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5 text-center">
                  <ShieldCheck className="mx-auto h-8 w-8 text-emerald-300" />
                  <p className="mt-3 font-black text-emerald-200">Sin alertas financieras criticas.</p>
                  <p className="mt-1 text-sm text-slate-400">La auditoria no encontro duplicados ni descuadres activos.</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function CreditIcon(props: { className?: string }) {
  return <Banknote {...props} />;
}
