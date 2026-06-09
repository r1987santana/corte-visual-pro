"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Crown,
  Factory,
  Loader2,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type AnyRow = Record<string, any>;

function money(value: any) {
  const n = Number(value || 0);
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(value: any) {
  const n = Number(value || 0);
  return `${n.toFixed(1)}%`;
}

function n(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normal(value: any) {
  return String(value || "").toLowerCase();
}

async function safeSelect(table: string, columns = "*") {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) return [];
  return data || [];
}

export default function BICEOPage() {
  const [loading, setLoading] = useState(false);

  const [crmLeads, setCrmLeads] = useState<AnyRow[]>([]);
  const [crmQuotes, setCrmQuotes] = useState<AnyRow[]>([]);
  const [productionOrders, setProductionOrders] = useState<AnyRow[]>([]);
  const [productionItems, setProductionItems] = useState<AnyRow[]>([]);
  const [inventory, setInventory] = useState<AnyRow[]>([]);
  const [serviceTickets, setServiceTickets] = useState<AnyRow[]>([]);
  const [warranties, setWarranties] = useState<AnyRow[]>([]);
  const [surveys, setSurveys] = useState<AnyRow[]>([]);
  const [installationJobs, setInstallationJobs] = useState<AnyRow[]>([]);
  const [targets, setTargets] = useState<AnyRow[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [
        leads,
        quotes,
        orders,
        items,
        inv,
        tickets,
        warr,
        surv,
        installs,
        targetRows,
      ] = await Promise.all([
        safeSelect("crm_leads"),
        safeSelect("crm_quotes"),
        safeSelect("production_orders_ai"),
        safeSelect("production_order_ai_items"),
        safeSelect("inventory"),
        safeSelect("service_tickets"),
        safeSelect("customer_warranties"),
        safeSelect("customer_surveys"),
        safeSelect("installation_jobs"),
        safeSelect("ceo_targets"),
      ]);

      setCrmLeads(leads);
      setCrmQuotes(quotes);
      setProductionOrders(orders);
      setProductionItems(items);
      setInventory(inv);
      setServiceTickets(tickets);
      setWarranties(warr);
      setSurveys(surv);
      setInstallationJobs(installs);
      setTargets(targetRows);
    } catch (error: any) {
      alert(error?.message || "Error cargando BI CEO.");
    } finally {
      setLoading(false);
    }
  }

  const bi = useMemo(() => {
    const quoteSales = crmQuotes
      .filter((q) => ["aprobada", "enviada"].includes(normal(q.status)))
      .reduce((sum, q) => sum + n(q.total), 0);

    const leadPipeline = crmLeads
      .filter((l) => !["ganado", "perdido"].includes(normal(l.stage)))
      .reduce((sum, l) => sum + n(l.estimated_budget), 0);

    const wonLeads = crmLeads.filter((l) => normal(l.stage) === "ganado");
    const lostLeads = crmLeads.filter((l) => normal(l.stage) === "perdido");
    const activeLeads = crmLeads.filter((l) => !["ganado", "perdido"].includes(normal(l.stage)));

    const productionSales = productionOrders.reduce(
      (sum, o) => sum + n(o.sale_total || o.total_sale || o.sale_price || o.price || o.total),
      0
    );

    const productionCost = productionOrders.reduce(
      (sum, o) => sum + n(o.total_cost || o.cost_total || o.production_cost || o.cost),
      0
    );

    const totalSales = Math.max(quoteSales, productionSales);
    const totalCost = productionCost;
    const grossProfit = totalSales - totalCost;
    const margin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

    const ordersPending = productionOrders.filter((o) => ["pendiente", "pending"].includes(normal(o.status))).length;
    const ordersProcess = productionOrders.filter((o) => ["en_produccion", "in_progress", "proceso"].includes(normal(o.status))).length;
    const ordersDone = productionOrders.filter((o) => ["terminada", "finalizada", "cerrado", "done"].includes(normal(o.status))).length;

    const lowStock = inventory.filter((i) => n(i.stock || i.quantity || i.qty) <= n(i.min_stock || 0)).length;
    const inventoryValue = inventory.reduce((sum, i) => {
      const qty = n(i.stock || i.quantity || i.qty);
      const cost = n(i.purchase_price || i.unit_cost || i.cost_price || i.cost || i.sale_price || i.price);
      return sum + qty * cost;
    }, 0);

    const openTickets = serviceTickets.filter((t) => !["cerrado", "resuelto"].includes(normal(t.status))).length;
    const closedTickets = serviceTickets.filter((t) => ["cerrado", "resuelto"].includes(normal(t.status))).length;
    const urgentTickets = serviceTickets.filter((t) => ["alta", "urgente"].includes(normal(t.priority))).length;
    const serviceCost = serviceTickets.reduce((sum, t) => sum + n(t.real_cost), 0);

    const activeWarranties = warranties.filter((w) => !["vencida", "cancelada"].includes(normal(w.status))).length;
    const avgNps = surveys.length
      ? surveys.reduce((sum, s) => sum + n(s.nps || s.rating), 0) / surveys.length
      : 0;

    const installPending = installationJobs.filter((j) => ["pendiente"].includes(normal(j.status))).length;
    const installProcess = installationJobs.filter((j) => ["en_proceso", "proceso"].includes(normal(j.status))).length;
    const installDone = installationJobs.filter((j) => ["finalizada", "terminada", "entregada"].includes(normal(j.status))).length;

    const conversion = crmLeads.length > 0 ? (wonLeads.length / crmLeads.length) * 100 : 0;

    const salesTarget = n(targets.find((t) => t.target_key === "monthly_sales")?.target_value || 1000000);
    const profitTarget = n(targets.find((t) => t.target_key === "monthly_profit")?.target_value || 350000);
    const conversionTarget = n(targets.find((t) => t.target_key === "conversion_rate")?.target_value || 35);
    const npsTarget = n(targets.find((t) => t.target_key === "nps_score")?.target_value || 9);

    const healthScore =
      Math.min(25, salesTarget ? (totalSales / salesTarget) * 25 : 0) +
      Math.min(25, profitTarget ? (grossProfit / profitTarget) * 25 : 0) +
      Math.min(25, conversionTarget ? (conversion / conversionTarget) * 25 : 0) +
      Math.min(25, npsTarget ? (avgNps / npsTarget) * 25 : 0);

    const topProjects = [...productionOrders]
      .map((o) => {
        const sale = n(o.sale_total || o.total_sale || o.sale_price || o.price || o.total);
        const cost = n(o.total_cost || o.cost_total || o.production_cost || o.cost);
        return {
          name: o.project_name || o.name || o.order_code || "Proyecto",
          sale,
          cost,
          profit: sale - cost,
          margin: sale > 0 ? ((sale - cost) / sale) * 100 : 0,
          status: o.status || "-",
        };
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 8);

    const stageCounts = [
      "prospecto",
      "contactado",
      "medicion",
      "cotizacion_enviada",
      "negociacion",
      "ganado",
      "perdido",
    ].map((stage) => ({
      stage,
      count: crmLeads.filter((l) => normal(l.stage) === stage).length,
      amount: crmLeads.filter((l) => normal(l.stage) === stage).reduce((sum, l) => sum + n(l.estimated_budget), 0),
    }));

    return {
      totalSales,
      totalCost,
      grossProfit,
      margin,
      quoteSales,
      leadPipeline,
      activeLeads: activeLeads.length,
      wonLeads: wonLeads.length,
      lostLeads: lostLeads.length,
      conversion,
      productionOrders: productionOrders.length,
      ordersPending,
      ordersProcess,
      ordersDone,
      productionItems: productionItems.length,
      lowStock,
      inventoryValue,
      openTickets,
      closedTickets,
      urgentTickets,
      serviceCost,
      activeWarranties,
      avgNps,
      installPending,
      installProcess,
      installDone,
      healthScore,
      salesTarget,
      profitTarget,
      conversionTarget,
      npsTarget,
      topProjects,
      stageCounts,
    };
  }, [
    crmLeads,
    crmQuotes,
    productionOrders,
    productionItems,
    inventory,
    serviceTickets,
    warranties,
    surveys,
    installationJobs,
    targets,
  ]);

  function printReport() {
    const html = `
      <html>
      <head>
        <title>BI CEO RD Wood System</title>
        <style>
          @page{size:letter;margin:10mm}
          body{font-family:Arial;margin:30px;color:#111}
          .brand{letter-spacing:8px;color:#005c99;font-weight:900}
          h1{font-size:30px;margin:5px 0}
          .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
          .box{border:1px solid #111;border-radius:12px;padding:14px;margin:10px 0}
          .big{font-size:22px;font-weight:900}
          table{width:100%;border-collapse:collapse;margin-top:12px}
          th{background:#07111f;color:#fff;text-align:left;padding:8px}
          td{border:1px solid #ddd;padding:8px}
        </style>
      </head>
      <body>
        <div class="brand">RD WOOD SYSTEM</div>
        <h1>Reporte Ejecutivo CEO</h1>
        <p>${new Date().toLocaleString("es-DO")}</p>
        <div class="grid">
          <div class="box"><b>Ventas</b><div class="big">${money(bi.totalSales)}</div></div>
          <div class="box"><b>Costo</b><div class="big">${money(bi.totalCost)}</div></div>
          <div class="box"><b>Utilidad</b><div class="big">${money(bi.grossProfit)}</div></div>
          <div class="box"><b>Margen</b><div class="big">${pct(bi.margin)}</div></div>
          <div class="box"><b>Pipeline</b><div class="big">${money(bi.leadPipeline)}</div></div>
          <div class="box"><b>Conversión</b><div class="big">${pct(bi.conversion)}</div></div>
          <div class="box"><b>Tickets abiertos</b><div class="big">${bi.openTickets}</div></div>
          <div class="box"><b>NPS</b><div class="big">${bi.avgNps.toFixed(1)}</div></div>
        </div>
        <h2>Top proyectos</h2>
        <table>
          <thead><tr><th>Proyecto</th><th>Venta</th><th>Costo</th><th>Utilidad</th><th>Margen</th></tr></thead>
          <tbody>
            ${bi.topProjects.map(p => `<tr><td>${p.name}</td><td>${money(p.sale)}</td><td>${money(p.cost)}</td><td>${money(p.profit)}</td><td>${pct(p.margin)}</td></tr>`).join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  return (
    <main className="min-h-screen bg-[#020817] text-white px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-cyan-900/60 bg-gradient-to-br from-[#07111f] to-[#111b38] p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-700 bg-cyan-500/10 px-3 py-1 text-cyan-300 text-xs font-black tracking-[0.25em]">
                <Crown size={14} /> FASE 17
              </div>
              <h1 className="mt-4 text-4xl lg:text-5xl font-black">Business Intelligence CEO Pro</h1>
              <p className="text-slate-300 mt-2">
                Indicadores financieros, comerciales, producción, inventario, instalación y postventa.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={loadAll}
                disabled={loading}
                className="h-12 px-5 rounded-2xl bg-white text-slate-950 font-black flex items-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                Actualizar
              </button>
              <button
                onClick={printReport}
                className="h-12 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 font-black flex items-center gap-2"
              >
                <BarChart3 size={18} /> Imprimir Reporte
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          <div className="rounded-[30px] border border-cyan-900/60 bg-[#07111f] p-6 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 rounded-full border-8 border-cyan-400/30 bg-cyan-500/10 flex items-center justify-center">
                <span className="text-3xl font-black">{bi.healthScore.toFixed(0)}</span>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-black">Health Score</div>
                <h2 className="text-2xl font-black">Empresa</h2>
                <p className="text-sm text-slate-400">Meta combinada: ventas, utilidad, conversión y NPS.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <Progress label="Ventas vs meta" value={bi.salesTarget ? (bi.totalSales / bi.salesTarget) * 100 : 0} />
              <Progress label="Utilidad vs meta" value={bi.profitTarget ? (bi.grossProfit / bi.profitTarget) * 100 : 0} />
              <Progress label="Conversión CRM" value={bi.conversionTarget ? (bi.conversion / bi.conversionTarget) * 100 : 0} />
              <Progress label="NPS Postventa" value={bi.npsTarget ? (bi.avgNps / bi.npsTarget) * 100 : 0} />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={<CircleDollarSign />} label="Ventas" value={money(bi.totalSales)} />
            <Kpi icon={<Factory />} label="Costo" value={money(bi.totalCost)} />
            <Kpi icon={<TrendingUp />} label="Utilidad" value={money(bi.grossProfit)} />
            <Kpi icon={<Target />} label="Margen" value={pct(bi.margin)} />
            <Kpi icon={<BriefcaseBusiness />} label="Pipeline CRM" value={money(bi.leadPipeline)} />
            <Kpi icon={<Users />} label="Leads activos" value={bi.activeLeads} />
            <Kpi icon={<ClipboardList />} label="Órdenes" value={bi.productionOrders} />
            <Kpi icon={<ShieldCheck />} label="Garantías" value={bi.activeWarranties} />
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="Comercial CRM" icon={<BriefcaseBusiness className="text-cyan-300" />}>
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Ganados" value={bi.wonLeads} tone="emerald" />
              <Mini label="Perdidos" value={bi.lostLeads} tone="red" />
              <Mini label="Conversión" value={pct(bi.conversion)} tone="cyan" />
              <Mini label="Cotizaciones" value={money(bi.quoteSales)} tone="amber" />
            </div>
            <div className="mt-4 space-y-2">
              {bi.stageCounts.map((s) => (
                <div key={s.stage} className="rounded-2xl bg-[#030817] border border-slate-800 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-black capitalize">{s.stage.replace("_", " ")}</span>
                    <span className="text-cyan-300 font-black">{s.count}</span>
                  </div>
                  <div className="text-xs text-slate-400">{money(s.amount)}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Producción e Inventario" icon={<Factory className="text-cyan-300" />}>
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Pendientes" value={bi.ordersPending} tone="amber" />
              <Mini label="En proceso" value={bi.ordersProcess} tone="cyan" />
              <Mini label="Terminadas" value={bi.ordersDone} tone="emerald" />
              <Mini label="Piezas" value={bi.productionItems} tone="blue" />
              <Mini label="Stock bajo" value={bi.lowStock} tone="red" />
              <Mini label="Valor inventario" value={money(bi.inventoryValue)} tone="emerald" />
            </div>
          </Panel>

          <Panel title="Campo y Postventa" icon={<Wrench className="text-cyan-300" />}>
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Tickets abiertos" value={bi.openTickets} tone="amber" />
              <Mini label="Tickets cerrados" value={bi.closedTickets} tone="emerald" />
              <Mini label="Urgentes" value={bi.urgentTickets} tone="red" />
              <Mini label="Costo servicio" value={money(bi.serviceCost)} tone="red" />
              <Mini label="Inst. pendientes" value={bi.installPending} tone="amber" />
              <Mini label="Inst. proceso" value={bi.installProcess} tone="cyan" />
              <Mini label="Inst. listas" value={bi.installDone} tone="emerald" />
              <Mini label="NPS" value={bi.avgNps.toFixed(1)} tone="blue" />
            </div>
          </Panel>
        </section>

        <section className="rounded-[30px] border border-cyan-900/60 bg-[#07111f] p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-black flex items-center gap-2">
              <Sparkles className="text-cyan-300" /> Top rentabilidad por proyecto
            </h2>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-200">
              CEO Ranking
            </span>
          </div>

          <div className="overflow-auto rounded-2xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-[#0a1627] text-slate-300">
                <tr>
                  <th className="text-left p-3">Proyecto</th>
                  <th className="text-left p-3">Venta</th>
                  <th className="text-left p-3">Costo</th>
                  <th className="text-left p-3">Utilidad</th>
                  <th className="text-left p-3">Margen</th>
                  <th className="text-left p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {bi.topProjects.map((p, i) => (
                  <tr key={`${p.name}-${i}`} className="border-t border-slate-800">
                    <td className="p-3 font-black">{p.name}</td>
                    <td className="p-3">{money(p.sale)}</td>
                    <td className="p-3 text-amber-300">{money(p.cost)}</td>
                    <td className="p-3 text-emerald-300 font-black">{money(p.profit)}</td>
                    <td className="p-3">{pct(p.margin)}</td>
                    <td className="p-3">{p.status}</td>
                  </tr>
                ))}
                {!bi.topProjects.length && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-black">
                      Todavía no hay órdenes con data financiera.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DecisionCard
            icon={<TrendingUp />}
            title="Recomendación CEO"
            text={
              bi.margin >= 35
                ? "La empresa tiene buen margen. Escala ventas sin perder control de costos."
                : "Revisar costos de producción y precios. El margen está por debajo de una meta saludable."
            }
            good={bi.margin >= 35}
          />
          <DecisionCard
            icon={bi.urgentTickets > 0 ? <AlertTriangle /> : <CheckCircle2 />}
            title="Riesgo Operativo"
            text={
              bi.urgentTickets > 0
                ? "Hay tickets urgentes. Resolver postventa rápido para proteger reputación y referidos."
                : "Postventa controlada. Mantén seguimiento y encuestas para elevar NPS."
            }
            good={bi.urgentTickets === 0}
          />
        </section>
      </div>
    </main>
  );
}

function Kpi({ icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-[#07111f] p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="text-slate-400 text-xs font-black uppercase tracking-[0.22em]">{label}</div>
        <div className="rounded-2xl bg-cyan-500/10 text-cyan-300 p-2">{icon}</div>
      </div>
      <div className="mt-3 text-2xl font-black">{value}</div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: any; children: any }) {
  return (
    <section className="rounded-[30px] border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
      <h2 className="text-2xl font-black flex items-center gap-2 mb-4">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

function Mini({ label, value, tone }: { label: string; value: any; tone: "cyan" | "emerald" | "red" | "amber" | "blue" }) {
  const classes: Record<string, string> = {
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    red: "border-red-500/30 bg-red-500/10 text-red-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  };
  return (
    <div className={`rounded-2xl border p-3 ${classes[tone]}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] font-black opacity-80">{label}</div>
      <div className="text-xl font-black mt-1">{value}</div>
    </div>
  );
}

function Progress({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value || 0));
  return (
    <div>
      <div className="flex justify-between text-xs font-black text-slate-300 mb-1">
        <span>{label}</span>
        <span>{clamped.toFixed(0)}%</span>
      </div>
      <div className="h-3 rounded-full bg-[#030817] border border-slate-800 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function DecisionCard({ icon, title, text, good }: { icon: any; title: string; text: string; good: boolean }) {
  return (
    <div className={`rounded-[30px] border p-5 shadow-xl ${good ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
      <h3 className={`text-xl font-black flex items-center gap-2 ${good ? "text-emerald-200" : "text-amber-200"}`}>
        {icon} {title}
      </h3>
      <p className="text-slate-300 mt-2">{text}</p>
    </div>
  );
}
