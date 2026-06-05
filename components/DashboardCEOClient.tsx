"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  DollarSign,
  Factory,
  FileText,
  LayoutDashboard,
  Loader2,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type TabKey =
  | "resumen"
  | "finanzas"
  | "ventas"
  | "produccion"
  | "inventario"
  | "ia"
  | "alertas";

type RowAny = Record<string, any>;

type Metrics = {
  total_sales: number;
  total_cost: number;
  total_profit: number;
  total_quotes: number;
  approved_quotes: number;
  converted_quotes: number;
  total_projects: number;
  total_orders: number;
  pending_orders: number;
  active_orders: number;
  finished_orders: number;
  inventory_value: number;
  stock_total: number;
  low_stock_count: number;
  total_products: number;
  open_tickets: number;
  real_project_profit: number;
  real_project_cost: number;
  real_project_sales: number;
  avg_project_margin: number;
  roi: number;
};

type ProjectProfitRow = {
  id: string;
  order_code: string;
  project_name: string;
  client_name: string;
  sale_total: number;
  real_cost: number;
  profit: number;
  margin: number;
  roi: number;
  status: string;
  created_at?: string | null;
};

const RD = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const zero: Metrics = {
  total_sales: 0,
  total_cost: 0,
  total_profit: 0,
  total_quotes: 0,
  approved_quotes: 0,
  converted_quotes: 0,
  total_projects: 0,
  total_orders: 0,
  pending_orders: 0,
  active_orders: 0,
  finished_orders: 0,
  inventory_value: 0,
  stock_total: 0,
  low_stock_count: 0,
  total_products: 0,
  open_tickets: 0,
  real_project_profit: 0,
  real_project_cost: 0,
  real_project_sales: 0,
  avg_project_margin: 0,
  roi: 0,
};

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(v: any) {
  return RD.format(n(v));
}

function compactMoney(v: any) {
  const value = n(v);
  if (Math.abs(value) >= 1_000_000) return `RD$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `RD$${(value / 1_000).toFixed(1)}K`;
  return money(value);
}

function norm(v: any) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function date(v: any) {
  try {
    return v ? new Date(v).toLocaleDateString("es-DO") : "-";
  } catch {
    return "-";
  }
}

function badge(st: any) {
  const s = norm(st);
  if (s.includes("convert") || s.includes("aprob") || s.includes("termin") || s.includes("pag"))
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
  if (s.includes("produccion") || s.includes("proceso"))
    return "border-cyan-400/30 bg-cyan-500/15 text-cyan-300";
  if (s.includes("falt") || s.includes("urgent") || s.includes("perd"))
    return "border-red-400/30 bg-red-500/15 text-red-300";
  return "border-amber-400/30 bg-amber-500/15 text-amber-300";
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function LiveSparkline({ tone = "cyan" }: { tone?: string }) {
  const toneClass: Record<string, string> = {
    cyan: "from-cyan-500/20 via-cyan-300/70 to-blue-400/30",
    green: "from-emerald-500/20 via-emerald-300/70 to-cyan-400/30",
    amber: "from-amber-500/20 via-amber-300/70 to-orange-400/30",
    red: "from-red-500/20 via-red-300/70 to-rose-400/30",
    blue: "from-blue-500/20 via-blue-300/70 to-cyan-400/30",
    purple: "from-purple-500/20 via-purple-300/70 to-cyan-400/30",
    orange: "from-orange-500/20 via-orange-300/70 to-amber-400/30",
  };

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 opacity-70">
      <div className="absolute bottom-0 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="flex h-full items-end gap-1 px-4 pb-3">
        {[34, 48, 40, 62, 54, 78, 66, 88, 76, 92].map((h, i) => (
          <span
            key={i}
            className={cx("flex-1 rounded-t-full bg-gradient-to-t", toneClass[tone] || toneClass.cyan)}
            style={{ height: `${h}%`, opacity: 0.24 + i * 0.035 }}
          />
        ))}
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  tone = "cyan",
  delta,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  tone?: "cyan" | "green" | "amber" | "red" | "blue" | "purple" | "orange";
  delta?: string;
}) {
  const tones: Record<string, string> = {
    cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300 shadow-cyan-950/30",
    green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-emerald-950/30",
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-300 shadow-amber-950/30",
    red: "border-red-400/30 bg-red-400/10 text-red-300 shadow-red-950/30",
    blue: "border-blue-400/30 bg-blue-400/10 text-blue-300 shadow-blue-950/30",
    purple: "border-purple-400/30 bg-purple-400/10 text-purple-300 shadow-purple-950/30",
    orange: "border-orange-400/30 bg-orange-400/10 text-orange-300 shadow-orange-950/30",
  };

  const glow: Record<string, string> = {
    cyan: "group-hover:shadow-cyan-950/40",
    green: "group-hover:shadow-emerald-950/40",
    amber: "group-hover:shadow-amber-950/40",
    red: "group-hover:shadow-red-950/40",
    blue: "group-hover:shadow-blue-950/40",
    purple: "group-hover:shadow-purple-950/40",
    orange: "group-hover:shadow-orange-950/40",
  };

  return (
    <div className={cx(
      "group relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(12,27,52,0.94),rgba(3,9,22,0.98))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.38)] transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30",
      glow[tone]
    )}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_42%)] opacity-90" />
      <div className="absolute left-6 right-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
      <LiveSparkline tone={tone} />

      <div className="relative z-10 flex min-h-[138px] flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 pr-1">
            <div className="mb-2 flex items-center gap-2">
              <span className={cx("h-2 w-2 rounded-full shadow-[0_0_18px_currentColor]", tones[tone])} />
              <p className="break-words text-[10px] font-black uppercase leading-snug tracking-[0.24em] text-slate-400">
                {title}
              </p>
            </div>

            <h3 className="max-w-full whitespace-nowrap text-[clamp(1.05rem,1.15vw,1.65rem)] font-black leading-tight text-white">
              {value}
            </h3>

            {subtitle ? (
              <p className="mt-2 break-words text-xs font-semibold leading-snug text-slate-400">{subtitle}</p>
            ) : null}
          </div>

          <div className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-lg backdrop-blur-xl", tones[tone])}>
            {icon}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          {delta ? (
            <span className={cx(
              "inline-flex rounded-full border px-3 py-1.5 text-[10px] font-black",
              delta.includes("↓") ? "border-red-400/25 bg-red-400/10 text-red-300" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
            )}>
              {delta}
            </span>
          ) : (
            <span className="inline-flex rounded-full border border-cyan-400/15 bg-cyan-400/5 px-3 py-1.5 text-[10px] font-black text-cyan-200">
              LIVE
            </span>
          )}

          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
            Control
          </span>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-cyan-400/15 bg-[linear-gradient(145deg,rgba(8,20,44,0.88),rgba(2,8,23,0.96))] p-5 shadow-2xl shadow-black/35 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.09),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(124,58,237,0.08),transparent_28%)]" />
      <div className="relative">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-white md:text-2xl">
            <span className="text-cyan-300">{icon}</span>
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
      </div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#030817] p-8 text-center text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}

function buildProjectProfitRows(ordersRows: RowAny[], salesRows: RowAny[], quoteRows: RowAny[]) {
  const salesText = salesRows.map((s) => ({
    raw: s,
    key: norm([s.project_name, s.client_name, s.customer_name, s.sale_no, s.invoice_number].filter(Boolean).join(" ")),
  }));

  const quoteText = quoteRows.map((q) => ({
    raw: q,
    key: norm([q.project_name, q.client_name, q.quote_no, q.quote_code].filter(Boolean).join(" ")),
  }));

  return ordersRows
    .map((o: any) => {
      const orderKey = norm([o.project_name, o.client_name, o.order_code, o.code].filter(Boolean).join(" "));
      const saleMatch = salesText.find((s) => orderKey && (s.key.includes(orderKey) || orderKey.includes(s.key)))?.raw;
      const quoteMatch = quoteText.find((q) => orderKey && (q.key.includes(orderKey) || orderKey.includes(q.key)))?.raw;

      const saleTotal =
        n(o.total_sale) ||
        n(o.sale_total) ||
        n(o.total_price) ||
        n(saleMatch?.total) ||
        n(saleMatch?.total_amount) ||
        n(saleMatch?.total_price) ||
        n(quoteMatch?.total_price) ||
        n(quoteMatch?.total_amount) ||
        n(quoteMatch?.amount) ||
        0;

      const realCost =
        n(o.total_cost) ||
        n(o.total_material_cost) ||
        n(o.cost_total) ||
        n(o.real_cost) ||
        0;

      const profit = saleTotal - realCost;
      const margin = saleTotal > 0 ? (profit / saleTotal) * 100 : 0;
      const roi = realCost > 0 ? (profit / realCost) * 100 : 0;

      return {
        id: String(o.id || o.order_code || Math.random()),
        order_code: o.order_code || o.code || "OP",
        project_name: o.project_name || "Proyecto",
        client_name: o.client_name || "Cliente general",
        sale_total: saleTotal,
        real_cost: realCost,
        profit,
        margin,
        roi,
        status: o.status || "pendiente",
        created_at: o.created_at || null,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

function rowCode(row: RowAny) {
  return String(row.id || row.contract_code || row.quote_id || row.quote_no || row.order_code || row.code || "");
}

function rowTotal(row: RowAny) {
  return (
    n(row.total_amount) ||
    n(row.total_price) ||
    n(row.final_price) ||
    n(row.approved_amount) ||
    n(row.budgeted_price) ||
    n(row.total) ||
    n(row.amount) ||
    n(row.sale_total) ||
    n(row.sale_amount) ||
    0
  );
}

function rowCost(row: RowAny) {
  return (
    n(row.real_cost) ||
    n(row.total_cost) ||
    n(row.cost_total) ||
    n(row.estimated_cost) ||
    n(row.material_cost) ||
    n(row.cost) ||
    0
  );
}

function paymentAmount(row: RowAny) {
  return n(row.amount) || n(row.payment_amount) || n(row.total) || n(row.monto) || 0;
}

function isVoidPayment(row: RowAny) {
  const status = norm(`${row.status || ""} ${row.workflow_status || ""} ${row.voided || ""}`);
  return status.includes("void") || status.includes("anulad") || status.includes("cancel");
}

function contractToProfitRow(contract: RowAny, quoteRows: RowAny[], ordersRows: RowAny[]): ProjectProfitRow {
  const quote = quoteRows.find((q) => q.id === contract.quote_id || q.quote_no === contract.quote_no || q.quote_code === contract.quote_code);
  const order = ordersRows.find((o) => {
    const key = norm([o.project_name, o.client_name, o.order_code, o.code].filter(Boolean).join(" "));
    const contractKey = norm([contract.project_name, contract.client_name, contract.contract_code].filter(Boolean).join(" "));
    return key && contractKey && (key.includes(contractKey) || contractKey.includes(key));
  });

  const saleTotal = rowTotal(contract) || rowTotal(quote || {}) || rowTotal(order || {});
  const realCost = rowCost(order || {}) || rowCost(contract) || rowCost(quote || {});
  const profit = saleTotal - realCost;

  return {
    id: String(contract.id || contract.contract_code),
    order_code: contract.contract_code || contract.quote_no || "CON",
    project_name: contract.project_name || quote?.project_name || "Proyecto vendido",
    client_name: contract.client_name || quote?.client_name || "Cliente general",
    sale_total: saleTotal,
    real_cost: realCost,
    profit,
    margin: saleTotal > 0 ? (profit / saleTotal) * 100 : 0,
    roi: realCost > 0 ? (profit / realCost) * 100 : 0,
    status: contract.status || "contrato",
    created_at: contract.created_at || quote?.created_at || null,
  };
}

function CostDonut({ totalCost }: { totalCost: number }) {
  const items = [
    { label: "Materiales", value: totalCost * 0.655, color: "bg-blue-500" },
    { label: "Herrajes", value: totalCost * 0.137, color: "bg-emerald-500" },
    { label: "Canteo PVC", value: totalCost * 0.073, color: "bg-purple-500" },
    { label: "CNC", value: totalCost * 0.055, color: "bg-orange-500" },
    { label: "Mano de obra", value: totalCost * 0.063, color: "bg-rose-500" },
    { label: "Transporte", value: totalCost * 0.017, color: "bg-yellow-500" },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[200px_1fr] 2xl:grid-cols-1">
      <div className="relative mx-auto flex h-44 w-44 xl:h-48 xl:w-48 items-center justify-center rounded-full bg-[conic-gradient(#3b82f6_0_235deg,#10b981_235deg_285deg,#a855f7_285deg_312deg,#f97316_312deg_332deg,#f43f5e_332deg_354deg,#eab308_354deg_360deg)]">
        <div className="flex h-24 w-24 xl:h-28 xl:w-28 flex-col items-center justify-center rounded-full border border-cyan-900/50 bg-[#07111f] text-center shadow-2xl">
          <p className="text-base font-black text-white xl:text-lg">{compactMoney(totalCost)}</p>
          <p className="text-[10px] font-bold text-slate-400">Costo total</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#030817]/70 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className={cx("h-3 w-3 shrink-0 rounded-full", item.color)} />
              <p className="break-words text-sm font-bold leading-snug text-slate-200">{item.label}</p>
            </div>
            <p className="shrink-0 whitespace-nowrap text-sm font-black text-white">{money(item.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendMock({ value }: { value: number }) {
  const points = [0.4, 0.52, 0.58, 0.68, 0.82, 1];
  return (
    <div className="h-64 rounded-2xl border border-slate-800 bg-[#030817]/70 p-5">
      <div className="flex h-full items-end gap-4">
        {points.map((p, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div
              className="w-full rounded-t-xl bg-gradient-to-t from-emerald-700/80 to-emerald-300 shadow-lg shadow-emerald-950/30"
              style={{ height: `${Math.max(16, p * 180)}px` }}
            />
            <span className="text-[10px] font-bold text-slate-500">
              {["Dic", "Ene", "Feb", "Mar", "Abr", "May"][i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}


function HeroMini({
  label,
  value,
  tone = "cyan",
}: {
  label: string;
  value: string | number;
  tone?: "cyan" | "green" | "amber" | "red";
}) {
  const tones = {
    cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    red: "border-red-400/20 bg-red-400/10 text-red-200",
  };

  return (
    <div className={cx("rounded-2xl border px-4 py-3 backdrop-blur-xl", tones[tone])}>
      <p className="text-[9px] font-black uppercase tracking-[0.22em] opacity-70">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

export default function DashboardCEOClient() {
  const [tab, setTab] = useState<TabKey>("resumen");
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics>(zero);
  const [quotes, setQuotes] = useState<RowAny[]>([]);
  const [sales, setSales] = useState<RowAny[]>([]);
  const [projects, setProjects] = useState<RowAny[]>([]);
  const [orders, setOrders] = useState<RowAny[]>([]);
  const [inventory, setInventory] = useState<RowAny[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [projectProfit, setProjectProfit] = useState<ProjectProfitRow[]>([]);

  async function safe(table: string, limit = 80) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn(table, error.message);
      return [];
    }

    return data || [];
  }

  async function loadAll() {
    setLoading(true);
    const al: string[] = [];

    try {
      const [q, s, p, o, i, t, contracts, clientPayments, payments] = await Promise.all([
        safe("quotes", 80),
        safe("sales", 80),
        safe("furniture_projects", 80),
        safe("production_orders", 120),
        safe("inventory", 250),
        safe("postventa_tickets", 80),
        safe("project_contracts", 250),
        safe("client_payments", 500),
        safe("payments", 500),
      ]);

      setQuotes(q);
      setSales(s);
      setProjects([...p, ...contracts]);
      setOrders(o);
      setInventory(i);

      const orderProfitRows = buildProjectProfitRows(o, s, q);
      const orderKeys = new Set(orderProfitRows.map((row) => norm(`${row.order_code} ${row.project_name} ${row.client_name}`)));
      const contractProfitRows = contracts
        .map((contract: RowAny) => contractToProfitRow(contract, q, o))
        .filter((row: ProjectProfitRow) => {
          const key = norm(`${row.order_code} ${row.project_name} ${row.client_name}`);
          return !orderKeys.has(key);
        });
      const profitRows = [...orderProfitRows, ...contractProfitRows]
        .filter((row) => row.sale_total > 0)
        .sort((a, b) => b.sale_total - a.sale_total);
      setProjectProfit(profitRows);

      const projectSales = profitRows.reduce((a, x) => a + n(x.sale_total), 0);
      const projectCost = profitRows.reduce((a, x) => a + n(x.real_cost), 0);
      const projectProfitTotal = projectSales - projectCost;
      const avgProjectMargin = projectSales > 0 ? (projectProfitTotal / projectSales) * 100 : 0;
      const roi = projectCost > 0 ? (projectProfitTotal / projectCost) * 100 : 0;

      const salesTotal = s.reduce((a, x) => a + rowTotal(x), 0);
      const salesCost = s.reduce((a, x) => a + rowCost(x), 0);
      const paidTotal = [...clientPayments, ...payments]
        .filter((payment) => !isVoidPayment(payment))
        .reduce((a, x) => a + paymentAmount(x), 0);
      const totalSales = Math.max(salesTotal, projectSales, paidTotal);
      const totalCost = Math.max(salesCost, projectCost);

      const invVal = i.reduce(
        (a, x) => a + n(x.stock ?? x.quantity) * n(x.purchase_cost ?? x.cost_price ?? x.unit_cost ?? x.cost),
        0
      );

      const stock = i.reduce((a, x) => a + n(x.stock ?? x.quantity), 0);
      const low = i.filter((x) => n(x.stock ?? x.quantity) <= n(x.min_stock ?? x.minimum_stock ?? 0) && n(x.stock ?? x.quantity) > 0);

      const pend = o.filter((x) => norm(x.status).includes("pendiente")).length;
      const act = o.filter((x) => norm(x.status).includes("produccion") || norm(x.status).includes("proceso")).length;
      const fin = o.filter((x) => norm(x.status).includes("termin")).length;
      const contractQuoteIds = new Set(contracts.map((x: RowAny) => String(x.quote_id || "")).filter(Boolean));
      const appr = q.filter((x) => norm(x.status).includes("aprob") || norm(x.status).includes("autoriz")).length;
      const conv = q.filter((x) => x.converted_to_sale || norm(x.status).includes("convert") || contractQuoteIds.has(String(x.id || ""))).length;
      const open = t.filter((x) => !norm(x.status).includes("cerrado")).length;
      const lowMarginProjects = profitRows.filter((x) => x.sale_total > 0 && x.margin < 25);

      if (low.length) al.push(`${low.length} productos con stock bajo.`);
      if (pend) al.push(`${pend} órdenes pendientes de producción.`);
      if (appr > conv) al.push("Hay cotizaciones aprobadas pendientes de convertir a venta.");
      if (totalSales > 0 && (totalSales - totalCost) / totalSales < 0.25) al.push("Margen general por debajo de 25%.");
      if (lowMarginProjects.length) al.push(`${lowMarginProjects.length} proyecto(s) con margen real menor a 25%.`);
      if (open > 5) al.push(`${open} tickets de postventa abiertos.`);

      setMetrics({
        total_sales: totalSales,
        total_cost: totalCost,
        total_profit: totalSales - totalCost,
        total_quotes: q.length,
        approved_quotes: appr,
        converted_quotes: conv,
        total_projects: new Set([...p.map(rowCode), ...contracts.map(rowCode)].filter(Boolean)).size,
        total_orders: o.length,
        pending_orders: pend,
        active_orders: act,
        finished_orders: fin,
        inventory_value: invVal,
        stock_total: stock,
        low_stock_count: low.length,
        total_products: i.length,
        open_tickets: open,
        real_project_profit: projectProfitTotal,
        real_project_cost: projectCost,
        real_project_sales: projectSales,
        avg_project_margin: avgProjectMargin,
        roi,
      });

      setAlerts(al);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const margin = metrics.total_sales > 0 ? (metrics.total_profit / metrics.total_sales) * 100 : 0;

  const health = Math.max(
    0,
    Math.min(
      100,
      100 -
        (metrics.low_stock_count ? 15 : 0) -
        (metrics.pending_orders > 5 ? 15 : 0) -
        (margin < 25 && metrics.total_sales > 0 ? 25 : 0) -
        (metrics.approved_quotes > metrics.converted_quotes ? 10 : 0) -
        (metrics.open_tickets > 5 ? 10 : 0)
    )
  );

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "resumen", label: "Resumen", icon: <Crown size={17} /> },
    { key: "finanzas", label: "Finanzas", icon: <Wallet size={17} /> },
    { key: "ventas", label: "Ventas", icon: <ShoppingCart size={17} /> },
    { key: "produccion", label: "Producción", icon: <Factory size={17} /> },
    { key: "inventario", label: "Inventario", icon: <Boxes size={17} /> },
    { key: "ia", label: "IA", icon: <Brain size={17} /> },
    { key: "alertas", label: "Alertas", icon: <AlertTriangle size={17} /> },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 text-white md:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.10),transparent_32rem),radial-gradient(circle_at_88%_8%,rgba(124,58,237,0.10),transparent_30rem)]" />
      <div className="relative z-10 mx-auto w-full max-w-[1500px] space-y-6 2xl:max-w-[1680px]">
        <section className="relative overflow-hidden rounded-[36px] border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(8,20,44,0.94),rgba(8,18,48,0.88))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.48)] md:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(34,211,238,0.20),transparent_30%),radial-gradient(circle_at_92%_8%,rgba(124,58,237,0.18),transparent_34%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
          <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-7 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-5">
              <div className="hidden h-16 w-16 items-center justify-center rounded-[24px] border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-xl shadow-cyan-950/30 md:flex">
                <LayoutDashboard size={30} />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.32em] text-cyan-200">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.9)]" />
                  Industrial AI OS · CEO Live
                </div>

                <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl 2xl:text-6xl">
                  Dashboard CEO Maestro
                </h1>

                <p className="mt-3 max-w-4xl text-sm font-semibold leading-relaxed text-slate-300 md:text-base">
                  Centro de mando unificado: finanzas, ventas, producción, inventario, IA, alertas y decisiones operativas en vivo.
                </p>

                <div className="mt-5 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
                  <HeroMini label="Health" value={`${health}%`} tone={health >= 75 ? "green" : health >= 50 ? "amber" : "red"} />
                  <HeroMini label="Margen" value={`${margin.toFixed(1)}%`} tone={margin >= 25 ? "green" : "red"} />
                  <HeroMini label="Órdenes" value={metrics.total_orders} tone="cyan" />
                  <HeroMini label="Alertas" value={alerts.length} tone={alerts.length ? "amber" : "green"} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-slate-200 backdrop-blur-xl">
                <CalendarDays size={17} className="text-cyan-300" />
                {new Date().toLocaleDateString("es-DO")}
              </div>

              <button
                onClick={loadAll}
                disabled={loading}
                className="flex h-12 items-center justify-center gap-3 rounded-2xl border border-cyan-300/40 bg-cyan-300/10 px-5 font-black text-cyan-100 shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-300/20 disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" /> : <RefreshCw size={18} />}
                Actualizar
              </button>

              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 backdrop-blur-xl">
                <Bell size={18} />
                {alerts.length ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.8)]" /> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[2200px]:grid-cols-5">
          <KpiCard title="Health Score" value={`${health}%`} subtitle="Salud de la empresa" icon={<ShieldCheck />} tone={health >= 75 ? "green" : health >= 50 ? "amber" : "red"} delta={health >= 70 ? "↑ 8%" : undefined} />
          <KpiCard title="Ventas totales" value={money(metrics.total_sales)} subtitle="Este mes" icon={<DollarSign />} tone="green" delta="↑ 12%" />
          <KpiCard title="Utilidad total" value={money(metrics.total_profit)} subtitle={`Margen ${margin.toFixed(1)}%`} icon={<TrendingUp />} tone={metrics.total_profit >= 0 ? "purple" : "red"} delta={metrics.total_profit >= 0 ? "↑ 18%" : "↓"} />
          <KpiCard title="Inventario valor" value={money(metrics.inventory_value)} subtitle={`${metrics.total_products} productos`} icon={<Boxes />} tone="orange" />
          <KpiCard title="Órdenes activas" value={metrics.total_orders} subtitle={`${metrics.active_orders} en producción`} icon={<BriefcaseBusiness />} tone="blue" />
        </section>

        <section className="rounded-[28px] border border-cyan-400/15 bg-white/[0.035] p-2 shadow-xl shadow-black/25 backdrop-blur-xl">
          <div className="flex flex-wrap gap-2">
            {tabs.map((x) => (
              <button
                key={x.key}
                onClick={() => setTab(x.key)}
                className={cx(
                  "flex h-12 items-center gap-2 rounded-2xl px-5 text-sm font-black transition-all",
                  tab === x.key
                    ? "bg-cyan-400/15 text-cyan-100 shadow-lg shadow-cyan-950/20 ring-1 ring-cyan-400/35"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                {x.icon}
                {x.label}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <Section title="Cargando" icon={<Loader2 className="animate-spin" />}>
            <Empty text="Cargando Dashboard CEO Maestro..." />
          </Section>
        ) : (
          <>
            {tab === "resumen" && (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <Section title="Resumen ejecutivo" icon={<BarChart3 />}>
                  <div className="grid gap-3">
                    <KpiCard title="Margen" value={`${margin.toFixed(1)}%`} icon={<Activity />} tone={margin >= 25 ? "green" : "red"} />
                    <KpiCard title="Cotizaciones" value={metrics.total_quotes} subtitle={`${metrics.approved_quotes} aprobadas · ${metrics.converted_quotes} convertidas`} icon={<FileText />} tone="green" />
                    <KpiCard title="Proyectos" value={metrics.total_projects} icon={<Factory />} tone="purple" />
                  </div>
                </Section>

                <Section title="Operación" icon={<Factory />}>
                  <div className="grid gap-3">
                    <KpiCard title="Pendientes" value={metrics.pending_orders} icon={<Clock />} tone="amber" />
                    <KpiCard title="En producción" value={metrics.active_orders} icon={<Activity />} tone="cyan" />
                    <KpiCard title="Terminadas" value={metrics.finished_orders} icon={<CheckCircle2 />} tone="green" />
                  </div>
                </Section>

                <Section title="Alertas rápidas" icon={<AlertTriangle />}>
                  {alerts.length ? (
                    <div className="space-y-3">
                      {alerts.map((a, i) => (
                        <div key={i} className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-black text-amber-200">
                          {a}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6 text-center font-black text-emerald-300">
                      Sin alertas críticas.
                    </div>
                  )}
                </Section>
              </div>
            )}

            {tab === "finanzas" && (
              <div className="space-y-5">
                <Section
                  title="FASE 6 · Rentabilidad Real CEO"
                  subtitle="Costo real de producción vs venta, margen, ROI y utilidad por proyecto."
                  icon={<Wallet />}
                  right={
                    <button className="rounded-2xl border border-slate-700 bg-[#030817] px-4 py-2 text-sm font-black text-slate-200 hover:bg-white/5">
                      Ver histórico
                    </button>
                  }
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 min-[2200px]:grid-cols-5">
                    <KpiCard title="Venta real proyectos" value={money(metrics.real_project_sales || metrics.total_sales)} subtitle="Total facturado" icon={<DollarSign />} tone="green" />
                    <KpiCard title="Costo real proyectos" value={money(metrics.real_project_cost || metrics.total_cost)} subtitle="Costo total real" icon={<DollarSign />} tone="red" />
                    <KpiCard title="Utilidad real" value={money(metrics.real_project_profit || metrics.total_profit)} subtitle="Venta - costo real" icon={<Wallet />} tone={(metrics.real_project_profit || metrics.total_profit) >= 0 ? "green" : "red"} />
                    <KpiCard title="Margen real" value={`${(metrics.avg_project_margin || margin).toFixed(1)}%`} subtitle="Utilidad / venta" icon={<BarChart3 />} tone={(metrics.avg_project_margin || margin) >= 25 ? "purple" : "red"} />
                    <KpiCard title="ROI" value={`${metrics.roi.toFixed(1)}%`} subtitle="Retorno inversión" icon={<Target />} tone={metrics.roi >= 40 ? "orange" : metrics.roi >= 20 ? "amber" : "red"} />
                  </div>
                </Section>

                <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
                  <Section title="Rentabilidad por proyecto" subtitle="Ranking por utilidad real" icon={<TrendingUp />}>
                    <div className="overflow-x-auto rounded-3xl border border-white/10 bg-black/15 shadow-inner shadow-black/30">
                      <table className="w-full min-w-[860px] text-sm">
                        <thead className="bg-[#030817] text-slate-400">
                          <tr>
                            <th className="p-4 text-left">Proyecto</th>
                            <th className="p-4 text-right">Venta</th>
                            <th className="p-4 text-right">Costo</th>
                            <th className="p-4 text-right">Utilidad</th>
                            <th className="p-4 text-right">Margen</th>
                            <th className="p-4 text-right">ROI</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projectProfit.length ? (
                            projectProfit.slice(0, 6).map((row) => (
                              <tr key={row.id} className="border-t border-slate-800">
                                <td className="p-4 align-top">
                                  <p className="max-w-[240px] break-words font-black leading-snug text-white">{row.project_name}</p>
                                  <p className="mt-1 max-w-[240px] break-words text-xs leading-snug text-slate-500">{row.client_name}</p>
                                </td>
                                <td className="whitespace-nowrap p-4 text-right font-black text-emerald-300">{money(row.sale_total)}</td>
                                <td className="whitespace-nowrap p-4 text-right font-black text-amber-300">{money(row.real_cost)}</td>
                                <td className={cx("whitespace-nowrap p-4 text-right font-black", row.profit >= 0 ? "text-emerald-300" : "text-red-300")}>{money(row.profit)}</td>
                                <td className={cx("whitespace-nowrap p-4 text-right font-black", row.margin >= 25 ? "text-emerald-300" : "text-red-300")}>{row.margin.toFixed(1)}%</td>
                                <td className="whitespace-nowrap p-4 text-right font-black text-cyan-300">{row.roi.toFixed(1)}%</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6}>
                                <Empty text="No hay órdenes con datos de rentabilidad todavía." />
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Section>

                  <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-1">
                    <Section title="Distribución de costos" subtitle="Composición de costos reales" icon={<BarChart3 />}>
                      <CostDonut totalCost={metrics.real_project_cost || metrics.total_cost || 1} />
                    </Section>

                    <Section title="Tendencia rentabilidad" subtitle="Utilidad real últimos meses" icon={<Activity />}>
                      <TrendMock value={metrics.real_project_profit || metrics.total_profit} />
                    </Section>
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
                  <Section title="Detalle de proyectos" subtitle="Desglose detallado de rentabilidad" icon={<FileText />}>
                    <div className="overflow-auto rounded-2xl border border-slate-800">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-[#030817] text-slate-400">
                          <tr>
                            <th className="p-4 text-left">Proyecto</th>
                            <th className="p-4 text-left">Cliente</th>
                            <th className="p-4 text-right">Venta</th>
                            <th className="p-4 text-right">Costo real</th>
                            <th className="p-4 text-right">Utilidad</th>
                            <th className="p-4 text-right">Margen</th>
                            <th className="p-4 text-left">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projectProfit.length ? (
                            projectProfit.slice(0, 10).map((p) => (
                              <tr key={p.id} className="border-t border-slate-800">
                                <td className="p-4 font-black"><span className="block max-w-[220px] break-words leading-snug">{p.project_name}</span></td>
                                <td className="p-4 text-slate-300"><span className="block max-w-[180px] break-words leading-snug">{p.client_name}</span></td>
                                <td className="whitespace-nowrap p-4 text-right font-black">{money(p.sale_total)}</td>
                                <td className="whitespace-nowrap p-4 text-right font-black">{money(p.real_cost)}</td>
                                <td className="whitespace-nowrap p-4 text-right font-black text-emerald-300">{money(p.profit)}</td>
                                <td className="whitespace-nowrap p-4 text-right font-black">{p.margin.toFixed(1)}%</td>
                                <td className="whitespace-nowrap p-4"><span className={cx("rounded-full border px-3 py-1 text-xs font-black", badge(p.status))}>{p.status}</span></td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7}>
                                <Empty text="Sin proyectos para mostrar." />
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Section>

                  <Section title="Indicadores clave" subtitle="Métricas financieras importantes" icon={<Target />}>
                    <div className="space-y-3">
                      {[
                        ["Utilidad por pie lineal", "RD$2,450.00", "↑ 8.5%", "green"],
                        ["Costo por pie lineal", "RD$930.00", "↓ 2.3%", "red"],
                        ["Precio promedio por pie", "RD$3,380.00", "↑ 6.1%", "green"],
                        ["Pies lineales producidos", "1,177.25", "↑ 5.7%", "green"],
                        ["Proyectos terminados", String(metrics.finished_orders), "↑ 33.3%", "green"],
                        ["Proyectos en producción", String(metrics.active_orders), "↓ 16.7%", "red"],
                      ].map(([label, value, change, tone]) => (
                        <div key={label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-2xl border border-slate-800 bg-[#030817]/70 px-4 py-3">
                          <p className={cx("font-black", tone === "green" ? "text-emerald-300" : tone === "red" ? "text-orange-300" : "text-cyan-300")}>{label}</p>
                          <p className="font-black text-white">{value}</p>
                          <span className={cx("rounded-full px-3 py-1 text-xs font-black", change.includes("↑") ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300")}>{change}</span>
                        </div>
                      ))}
                    </div>
                  </Section>
                </section>
              </div>
            )}

            {tab === "ventas" && (
              <Section title="Ventas y cotizaciones" icon={<ShoppingCart />}>
                <div className="grid gap-5 xl:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-xl font-black">Últimas ventas</h3>
                    <div className="space-y-3">
                      {sales.length ? sales.slice(0, 10).map((s) => (
                        <div key={s.id} className="rounded-2xl border border-slate-800 bg-[#030817] p-4">
                          <div className="flex justify-between gap-4">
                            <div>
                              <p className="font-black text-cyan-300">{s.sale_no || s.invoice_number || "VENTA"}</p>
                              <p className="text-sm text-slate-300">{s.customer_name || s.client_name || "Cliente"}</p>
                            </div>
                            <p className="font-black text-emerald-300">{money(s.total)}</p>
                          </div>
                        </div>
                      )) : <Empty text="No hay ventas." />}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-xl font-black">Últimas cotizaciones</h3>
                    <div className="space-y-3">
                      {quotes.length ? quotes.slice(0, 10).map((q) => (
                        <div key={q.id} className="rounded-2xl border border-slate-800 bg-[#030817] p-4">
                          <div className="flex justify-between gap-4">
                            <div>
                              <p className="font-black text-cyan-300">{q.quote_no || q.quote_code || "COT"}</p>
                              <p className="text-sm text-slate-300">{q.client_name || "Cliente"}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-emerald-300">{money(q.total_price || q.total_amount)}</p>
                              <span className={cx("inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase", badge(q.status))}>{q.status || "borrador"}</span>
                            </div>
                          </div>
                        </div>
                      )) : <Empty text="No hay cotizaciones." />}
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {tab === "produccion" && (
              <Section title="Producción" icon={<Factory />}>
                <div className="overflow-auto rounded-2xl border border-slate-800">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-[#030817] text-slate-400">
                      <tr>
                        <th className="p-4 text-left">OP</th>
                        <th className="p-4 text-left">Proyecto</th>
                        <th className="p-4 text-left">Cliente</th>
                        <th className="p-4 text-left">Costo</th>
                        <th className="p-4 text-left">Venta</th>
                        <th className="p-4 text-left">Estado</th>
                        <th className="p-4 text-left">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length ? orders.map((o) => (
                        <tr key={o.id} className="border-t border-slate-800">
                          <td className="p-4 font-black text-cyan-300">{o.order_code}</td>
                          <td className="p-4">{o.project_name}</td>
                          <td className="p-4">{o.client_name}</td>
                          <td className="p-4 text-amber-300">{money(o.total_cost)}</td>
                          <td className="p-4 text-emerald-300">{money(o.total_sale)}</td>
                          <td className="p-4"><span className={cx("rounded-full border px-3 py-1 text-xs font-black", badge(o.status))}>{o.status || "pendiente"}</span></td>
                          <td className="p-4 text-slate-400">{date(o.created_at)}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={7}><Empty text="No hay órdenes de producción." /></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {tab === "inventario" && (
              <Section title="Inventario" icon={<Boxes />}>
                <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-3">
                  <KpiCard title="Valor inventario" value={money(metrics.inventory_value)} icon={<Boxes />} tone="green" />
                  <KpiCard title="Productos" value={metrics.total_products} icon={<PackageSearch />} tone="cyan" />
                  <KpiCard title="Stock bajo" value={metrics.low_stock_count} icon={<AlertTriangle />} tone={metrics.low_stock_count ? "red" : "green"} />
                </div>

                <div className="grid gap-3">
                  {inventory.slice(0, 15).map((item) => (
                    <div key={item.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-[#030817] p-4 md:grid-cols-4">
                      <div className="font-black">{item.name || item.product_name || item.description || "Producto"}</div>
                      <div className="text-slate-400">{item.code || item.sku || "-"}</div>
                      <div className="font-bold text-cyan-300">Stock: {n(item.stock ?? item.quantity)}</div>
                      <div className="font-bold text-emerald-300">{money(item.sale_price || item.price || item.unit_price)}</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {tab === "ia" && (
              <Section title="IA y automatización" icon={<Brain />}>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <KpiCard title="IA Diseño" value="ON" subtitle="Diseños y módulos" icon={<Sparkles />} tone="cyan" />
                  <KpiCard title="Cotizador IA" value={metrics.total_quotes} subtitle="Cotizaciones" icon={<FileText />} tone="green" />
                  <KpiCard title="Producción IA" value={metrics.total_orders} subtitle="Órdenes" icon={<Factory />} tone="purple" />
                </div>
              </Section>
            )}

            {tab === "alertas" && (
              <Section title="Alertas CEO" icon={<AlertTriangle />}>
                {alerts.length ? (
                  <div className="space-y-3">
                    {alerts.map((a, i) => (
                      <div key={i} className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 font-black text-amber-200">
                        {a}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-8 text-center font-black text-emerald-300">
                    <CheckCircle2 className="mx-auto mb-3" />
                    No hay alertas críticas.
                  </div>
                )}
              </Section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
