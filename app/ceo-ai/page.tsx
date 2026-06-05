"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Crown,
  Factory,
  Loader2,
  MessageSquareText,
  Package,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type AnyRow = Record<string, any>;

type ChatRow = {
  id: string;
  question: string;
  answer?: string | null;
  intent?: string | null;
  kpi_context?: any;
  created_at?: string | null;
};

type AlertRow = {
  id: string;
  alert_type?: string | null;
  title: string;
  description?: string | null;
  severity?: string | null;
  source_module?: string | null;
  status?: string | null;
  action_recommended?: string | null;
  created_at?: string | null;
};

function money(value: any) {
  const n = Number(value || 0);
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(value: any) {
  const n = Number(value || 0);
  return `${n.toFixed(1)}%`;
}

function num(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function lower(value: any) {
  return String(value || "").toLowerCase();
}

async function safeSelect(table: string, columns = "*"): Promise<AnyRow[]> {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) return [];
  return ((data || []) as unknown) as AnyRow[];
}

function detectIntent(q: string) {
  const s = lower(q);
  if (s.includes("utilidad") || s.includes("ganancia") || s.includes("margen") || s.includes("rentable")) return "rentabilidad";
  if (s.includes("venta") || s.includes("crm") || s.includes("lead") || s.includes("cotizacion") || s.includes("cotización")) return "comercial";
  if (s.includes("produccion") || s.includes("producción") || s.includes("orden") || s.includes("taller") || s.includes("cnc")) return "produccion";
  if (s.includes("inventario") || s.includes("stock") || s.includes("material") || s.includes("agot")) return "inventario";
  if (s.includes("ticket") || s.includes("garantia") || s.includes("garantía") || s.includes("postventa") || s.includes("nps")) return "postventa";
  if (s.includes("instalacion") || s.includes("instalación") || s.includes("entrega")) return "instalacion";
  return "general";
}

export default function CEOAIPage() {
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [question, setQuestion] = useState("");
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);

  const [crmLeads, setCrmLeads] = useState<AnyRow[]>([]);
  const [crmQuotes, setCrmQuotes] = useState<AnyRow[]>([]);
  const [productionOrders, setProductionOrders] = useState<AnyRow[]>([]);
  const [productionItems, setProductionItems] = useState<AnyRow[]>([]);
  const [inventory, setInventory] = useState<AnyRow[]>([]);
  const [serviceTickets, setServiceTickets] = useState<AnyRow[]>([]);
  const [warranties, setWarranties] = useState<AnyRow[]>([]);
  const [surveys, setSurveys] = useState<AnyRow[]>([]);
  const [installationJobs, setInstallationJobs] = useState<AnyRow[]>([]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

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
        chatRows,
        alertRows,
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
        safeSelect("ceo_ai_chats"),
        safeSelect("ceo_ai_alerts"),
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
      setChats(((chatRows as unknown) as ChatRow[]).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).slice(-20));
      setAlerts(((alertRows as unknown) as AlertRow[]).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 12));
    } catch (error: any) {
      alert(error?.message || "Error cargando CEO AI.");
    } finally {
      setLoading(false);
    }
  }

  const kpi = useMemo(() => {
    const salesQuotes = crmQuotes
      .filter((q) => ["aprobada", "enviada"].includes(lower(q.status)))
      .reduce((s, q) => s + num(q.total), 0);

    const productionSales = productionOrders.reduce((s, o) => s + num(o.sale_total || o.total_sale || o.sale_price || o.price || o.total), 0);
    const productionCost = productionOrders.reduce((s, o) => s + num(o.total_cost || o.cost_total || o.production_cost || o.cost), 0);
    const sales = Math.max(salesQuotes, productionSales);
    const profit = sales - productionCost;
    const margin = sales > 0 ? (profit / sales) * 100 : 0;

    const wonLeads = crmLeads.filter((l) => lower(l.stage) === "ganado").length;
    const lostLeads = crmLeads.filter((l) => lower(l.stage) === "perdido").length;
    const activeLeads = crmLeads.filter((l) => !["ganado", "perdido"].includes(lower(l.stage))).length;
    const conversion = crmLeads.length ? (wonLeads / crmLeads.length) * 100 : 0;
    const pipeline = crmLeads
      .filter((l) => !["ganado", "perdido"].includes(lower(l.stage)))
      .reduce((s, l) => s + num(l.estimated_budget), 0);

    const pendingOrders = productionOrders.filter((o) => ["pendiente", "pending"].includes(lower(o.status))).length;
    const processOrders = productionOrders.filter((o) => ["en_produccion", "proceso", "in_progress"].includes(lower(o.status))).length;
    const doneOrders = productionOrders.filter((o) => ["terminada", "finalizada", "done", "cerrado"].includes(lower(o.status))).length;

    const lowStock = inventory.filter((i) => num(i.stock || i.quantity || i.qty) <= num(i.min_stock || 0)).length;
    const inventoryValue = inventory.reduce((s, i) => {
      const qty = num(i.stock || i.quantity || i.qty);
      const cost = num(i.purchase_price || i.unit_cost || i.cost_price || i.cost || i.sale_price || i.price);
      return s + qty * cost;
    }, 0);

    const openTickets = serviceTickets.filter((t) => !["cerrado", "resuelto"].includes(lower(t.status))).length;
    const urgentTickets = serviceTickets.filter((t) => ["alta", "urgente"].includes(lower(t.priority))).length;
    const serviceCost = serviceTickets.reduce((s, t) => s + num(t.real_cost), 0);

    const activeWarranties = warranties.filter((w) => !["vencida", "cancelada"].includes(lower(w.status))).length;
    const avgNps = surveys.length ? surveys.reduce((s, r) => s + num(r.nps || r.rating), 0) / surveys.length : 0;

    const installPending = installationJobs.filter((j) => ["pendiente"].includes(lower(j.status))).length;
    const installProcess = installationJobs.filter((j) => ["en_proceso", "proceso"].includes(lower(j.status))).length;

    const topProjects = productionOrders
      .map((o) => {
        const sale = num(o.sale_total || o.total_sale || o.sale_price || o.price || o.total);
        const cost = num(o.total_cost || o.cost_total || o.production_cost || o.cost);
        return {
          name: o.project_name || o.name || o.order_code || "Proyecto",
          sale,
          cost,
          profit: sale - cost,
          margin: sale > 0 ? ((sale - cost) / sale) * 100 : 0,
          status: o.status || "-",
        };
      })
      .sort((a, b) => b.profit - a.profit);

    return {
      sales,
      productionCost,
      profit,
      margin,
      crmTotal: crmLeads.length,
      activeLeads,
      wonLeads,
      lostLeads,
      conversion,
      pipeline,
      orders: productionOrders.length,
      pendingOrders,
      processOrders,
      doneOrders,
      productionItems: productionItems.length,
      lowStock,
      inventoryValue,
      openTickets,
      urgentTickets,
      serviceCost,
      activeWarranties,
      avgNps,
      installPending,
      installProcess,
      topProjects,
    };
  }, [crmLeads, crmQuotes, productionOrders, productionItems, inventory, serviceTickets, warranties, surveys, installationJobs]);

  function buildAnswer(q: string) {
    const intent = detectIntent(q);
    const top = kpi.topProjects[0];

    const recs: string[] = [];
    if (kpi.margin < 35 && kpi.sales > 0) recs.push("Revisar precios y costos: el margen está por debajo de 35%.");
    if (kpi.lowStock > 0) recs.push(`Hay ${kpi.lowStock} productos con stock bajo. Reponer materiales críticos.`);
    if (kpi.urgentTickets > 0) recs.push(`Atender ${kpi.urgentTickets} tickets urgentes para proteger la reputación.`);
    if (kpi.activeLeads === 0) recs.push("El CRM no tiene leads activos. Activar campaña comercial o registrar oportunidades.");
    if (kpi.installPending > 0) recs.push(`Hay ${kpi.installPending} instalaciones pendientes. Priorizar agenda de campo.`);
    if (!recs.length) recs.push("La operación está estable. Mantener control de margen, inventario y postventa.");

    let answer = "";

    if (intent === "rentabilidad") {
      answer = `📊 ANÁLISIS DE RENTABILIDAD

Ventas actuales: ${money(kpi.sales)}
Costo real: ${money(kpi.productionCost)}
Utilidad bruta: ${money(kpi.profit)}
Margen: ${pct(kpi.margin)}

${top ? `Proyecto más rentable:
${top.name}
Venta: ${money(top.sale)}
Costo: ${money(top.cost)}
Utilidad: ${money(top.profit)}
Margen: ${pct(top.margin)}` : "Todavía no hay proyectos con datos financieros suficientes."}

Recomendación:
${kpi.margin >= 35 ? "El margen está saludable. Puedes escalar ventas cuidando los costos." : "El margen necesita revisión. Ajusta precio de venta o reduce costos de materiales/producción."}`;
    } else if (intent === "comercial") {
      answer = `📈 ANÁLISIS COMERCIAL CRM

Leads totales: ${kpi.crmTotal}
Leads activos: ${kpi.activeLeads}
Ganados: ${kpi.wonLeads}
Perdidos: ${kpi.lostLeads}
Conversión: ${pct(kpi.conversion)}
Pipeline estimado: ${money(kpi.pipeline)}

Recomendación:
${kpi.activeLeads > 0 ? "Dar seguimiento diario a los leads activos y moverlos a medición/cotización." : "Registrar nuevos prospectos y conectar WhatsApp como canal principal de seguimiento."}`;
    } else if (intent === "produccion") {
      answer = `🏭 ANÁLISIS DE PRODUCCIÓN

Órdenes totales: ${kpi.orders}
Pendientes: ${kpi.pendingOrders}
En proceso: ${kpi.processOrders}
Terminadas: ${kpi.doneOrders}
Piezas registradas: ${kpi.productionItems}

Recomendación:
${kpi.pendingOrders > 0 ? "Priorizar órdenes pendientes y revisar materiales faltantes antes de enviar a CNC." : "Producción sin atraso fuerte visible. Mantener control QR por pieza."}`;
    } else if (intent === "inventario") {
      answer = `📦 ANÁLISIS DE INVENTARIO

Valor estimado del inventario: ${money(kpi.inventoryValue)}
Productos con stock bajo: ${kpi.lowStock}

Recomendación:
${kpi.lowStock > 0 ? "Crear compra/reabastecimiento de los productos críticos para evitar detener producción." : "Inventario estable. Mantener actualización de costos de compra y venta."}`;
    } else if (intent === "postventa") {
      answer = `🛠️ ANÁLISIS DE POSTVENTA

Tickets abiertos: ${kpi.openTickets}
Tickets urgentes: ${kpi.urgentTickets}
Garantías activas: ${kpi.activeWarranties}
NPS promedio: ${kpi.avgNps.toFixed(1)}
Costo de servicio: ${money(kpi.serviceCost)}

Recomendación:
${kpi.urgentTickets > 0 ? "Resolver tickets urgentes primero. Postventa rápida genera referidos y protege la marca." : "Postventa controlada. Solicitar encuestas para mejorar NPS."}`;
    } else if (intent === "instalacion") {
      answer = `🚚 ANÁLISIS DE INSTALACIÓN Y CAMPO

Instalaciones pendientes: ${kpi.installPending}
Instalaciones en proceso: ${kpi.installProcess}

Recomendación:
${kpi.installPending > 0 ? "Organizar agenda de instaladores y confirmar logística antes de salir a campo." : "No hay presión fuerte de instalación pendiente según los datos actuales."}`;
    } else {
      answer = `👑 RESUMEN EJECUTIVO RD WOOD SYSTEM

Ventas: ${money(kpi.sales)}
Costo: ${money(kpi.productionCost)}
Utilidad: ${money(kpi.profit)}
Margen: ${pct(kpi.margin)}

CRM:
Leads activos: ${kpi.activeLeads}
Conversión: ${pct(kpi.conversion)}
Pipeline: ${money(kpi.pipeline)}

Producción:
Órdenes: ${kpi.orders}
Piezas: ${kpi.productionItems}

Inventario:
Valor: ${money(kpi.inventoryValue)}
Stock bajo: ${kpi.lowStock}

Postventa:
Tickets abiertos: ${kpi.openTickets}
Garantías activas: ${kpi.activeWarranties}
NPS: ${kpi.avgNps.toFixed(1)}

Recomendaciones principales:
${recs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
    }

    return { intent, answer, recommendations: recs };
  }

  async function askAI(customQuestion?: string) {
    const q = (customQuestion || question).trim();
    if (!q) return;

    setThinking(true);
    setQuestion("");

    try {
      const { intent, answer, recommendations } = buildAnswer(q);

      const { error } = await supabase.from("ceo_ai_chats").insert({
        question: q,
        answer,
        intent,
        kpi_context: kpi,
        created_by: "CEO",
      });

      if (error) throw error;

      for (const rec of recommendations.slice(0, 2)) {
        await supabase.from("ceo_ai_recommendations").insert({
          recommendation_type: intent,
          title: rec.slice(0, 90),
          description: rec,
          impact: intent === "rentabilidad" ? "alto" : "medio",
          priority: rec.includes("urgente") || rec.includes("stock bajo") ? "alta" : "media",
          status: "pendiente",
        });
      }

      await generateAutoAlerts();
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Error consultando CEO AI.");
    } finally {
      setThinking(false);
    }
  }

  async function generateAutoAlerts() {
    const alertsToCreate: Partial<AlertRow>[] = [];

    if (kpi.lowStock > 0) {
      alertsToCreate.push({
        alert_type: "inventario",
        title: "Stock bajo detectado",
        description: `${kpi.lowStock} productos están en nivel bajo de inventario.`,
        severity: "alta",
        source_module: "inventario",
        action_recommended: "Revisar inventario y generar orden de compra.",
      });
    }

    if (kpi.urgentTickets > 0) {
      alertsToCreate.push({
        alert_type: "postventa",
        title: "Tickets urgentes pendientes",
        description: `${kpi.urgentTickets} tickets de postventa requieren atención rápida.`,
        severity: "alta",
        source_module: "postventa",
        action_recommended: "Asignar técnico y cerrar incidencias prioritarias.",
      });
    }

    if (kpi.margin > 0 && kpi.margin < 35) {
      alertsToCreate.push({
        alert_type: "finanzas",
        title: "Margen por debajo de meta",
        description: `El margen actual es ${pct(kpi.margin)}.`,
        severity: "media",
        source_module: "bi_ceo",
        action_recommended: "Ajustar precio o revisar costos de producción.",
      });
    }

    if (!alertsToCreate.length) return;

    for (const a of alertsToCreate) {
      await supabase.from("ceo_ai_alerts").insert(a);
    }
  }

  async function resolveAlert(id: string) {
    const { error } = await supabase
      .from("ceo_ai_alerts")
      .update({ status: "resuelta", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return alert(error.message);
    loadAll();
  }

  const quickQuestions = [
    "Dame un resumen ejecutivo de la empresa",
    "¿Cuál proyecto deja más utilidad?",
    "¿Cómo está el inventario?",
    "¿Cómo va la producción?",
    "¿Cómo está el CRM y las ventas?",
    "¿Qué riesgos tengo en postventa?",
  ];

  return (
    <main className="min-h-screen bg-[#020817] text-white px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-cyan-900/60 bg-gradient-to-br from-[#07111f] to-[#111b38] p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-700 bg-cyan-500/10 px-3 py-1 text-cyan-300 text-xs font-black tracking-[0.25em]">
                <Crown size={14} /> FASE 18
              </div>
              <h1 className="mt-4 text-4xl lg:text-5xl font-black">IA Gerente General</h1>
              <p className="text-slate-300 mt-2">
                CEO AI Assistant para analizar ventas, producción, inventario, CRM, instalación y postventa.
              </p>
            </div>

            <button
              onClick={loadAll}
              disabled={loading}
              className="h-12 px-5 rounded-2xl bg-white text-slate-950 font-black flex items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              Actualizar
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Kpi icon={<CircleDollarSign />} label="Ventas" value={money(kpi.sales)} />
          <Kpi icon={<TrendingUp />} label="Utilidad" value={money(kpi.profit)} />
          <Kpi icon={<Target />} label="Margen" value={pct(kpi.margin)} />
          <Kpi icon={<UserRound />} label="Leads" value={kpi.activeLeads} />
          <Kpi icon={<Factory />} label="Órdenes" value={kpi.orders} />
          <Kpi icon={<AlertTriangle />} label="Alertas" value={alerts.filter((a) => a.status !== "resuelta").length} />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
          <div className="rounded-[30px] border border-cyan-900/60 bg-[#07111f] shadow-2xl overflow-hidden">
            <div className="border-b border-slate-800 p-5 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black flex items-center gap-2">
                <Bot className="text-cyan-300" /> Chat CEO AI
              </h2>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 px-3 py-1 text-xs font-black">
                Datos conectados
              </span>
            </div>

            <div className="h-[520px] overflow-auto p-5 space-y-4 bg-[#030817]">
              {!chats.length && (
                <div className="h-full flex items-center justify-center text-center">
                  <div>
                    <BrainCircuit className="mx-auto text-cyan-300 mb-3" size={46} />
                    <h3 className="text-2xl font-black">Pregunta algo de tu empresa</h3>
                    <p className="text-slate-400 mt-2">Ejemplo: ¿Cuál proyecto deja más utilidad?</p>
                  </div>
                </div>
              )}

              {chats.map((c) => (
                <div key={c.id} className="space-y-3">
                  <div className="ml-auto max-w-[85%] rounded-3xl bg-blue-600 p-4">
                    <div className="text-xs opacity-70 font-black mb-1">CEO</div>
                    <div className="font-bold">{c.question}</div>
                  </div>

                  <div className="max-w-[92%] rounded-3xl border border-cyan-900/50 bg-[#07111f] p-4">
                    <div className="text-xs text-cyan-300 font-black mb-2 flex items-center gap-2">
                      <Bot size={14} /> IA Gerente General · {c.intent || "general"}
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-100">{c.answer}</pre>
                  </div>
                </div>
              ))}

              {thinking && (
                <div className="max-w-[70%] rounded-3xl border border-cyan-900/50 bg-[#07111f] p-4 flex items-center gap-3">
                  <Loader2 className="animate-spin text-cyan-300" />
                  <span className="font-black">Analizando datos de la empresa...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <div className="p-4 border-t border-slate-800">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_56px] gap-3">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      askAI();
                    }
                  }}
                  placeholder="Pregunta: ¿Qué proyecto deja más utilidad? ¿Qué materiales faltan? ¿Cómo van las ventas?"
                  className="min-h-[64px] rounded-2xl border border-slate-800 bg-[#030817] p-4 outline-none focus:border-cyan-500 resize-none"
                />
                <button
                  onClick={() => askAI()}
                  disabled={thinking}
                  className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 font-black flex items-center justify-center"
                >
                  {thinking ? <Loader2 className="animate-spin" /> : <Send />}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {quickQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => askAI(q)}
                    className="rounded-full border border-slate-700 bg-[#0a1627] px-3 py-2 text-xs font-black text-slate-300 hover:border-cyan-500"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Panel title="Resumen Ejecutivo" icon={<BarChart3 className="text-cyan-300" />}>
              <Mini label="Pipeline CRM" value={money(kpi.pipeline)} tone="cyan" />
              <Mini label="Conversión" value={pct(kpi.conversion)} tone="blue" />
              <Mini label="Inventario" value={money(kpi.inventoryValue)} tone="emerald" />
              <Mini label="Stock bajo" value={kpi.lowStock} tone={kpi.lowStock > 0 ? "red" : "emerald"} />
              <Mini label="Tickets abiertos" value={kpi.openTickets} tone={kpi.openTickets > 0 ? "amber" : "emerald"} />
              <Mini label="NPS" value={kpi.avgNps.toFixed(1)} tone="blue" />
            </Panel>

            <Panel title="Alertas IA" icon={<AlertTriangle className="text-amber-300" />}>
              <div className="space-y-3">
                {alerts.filter((a) => a.status !== "resuelta").map((a) => (
                  <div key={a.id} className={`rounded-2xl border p-3 ${a.severity === "alta" ? "border-red-500/30 bg-red-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-black">{a.title}</div>
                        <div className="text-xs text-slate-300 mt-1">{a.description}</div>
                        <div className="text-[11px] text-cyan-300 mt-2 font-black">{a.action_recommended}</div>
                      </div>
                      <button onClick={() => resolveAlert(a.id)} className="rounded-xl bg-emerald-600/20 border border-emerald-500/30 p-2">
                        <CheckCircle2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                {!alerts.filter((a) => a.status !== "resuelta").length && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-emerald-200 font-black">
                    Sin alertas activas
                  </div>
                )}
              </div>
            </Panel>

            <Panel title="Top Proyecto" icon={<Sparkles className="text-cyan-300" />}>
              {kpi.topProjects[0] ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="text-xl font-black">{kpi.topProjects[0].name}</div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Mini label="Venta" value={money(kpi.topProjects[0].sale)} tone="cyan" />
                    <Mini label="Costo" value={money(kpi.topProjects[0].cost)} tone="amber" />
                    <Mini label="Utilidad" value={money(kpi.topProjects[0].profit)} tone="emerald" />
                    <Mini label="Margen" value={pct(kpi.topProjects[0].margin)} tone="blue" />
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-center p-6 font-black">Sin proyectos todavía.</div>
              )}
            </Panel>
          </div>
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
      <h2 className="text-xl font-black flex items-center gap-2 mb-4">
        {icon} {title}
      </h2>
      <div className="space-y-3">{children}</div>
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
      <div className="text-lg font-black mt-1">{value}</div>
    </div>
  );
}
