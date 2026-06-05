import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/security/api-guard";
import { shouldRequireApproval, type AIDecisionRisk } from "@/lib/ai/level5";

const MONITOR_TABLE = "ai_monitor_events";
const DECISIONS_TABLE = "ai_decision_queue";

type MonitorSeverity = "info" | "warning" | "danger" | "critical";

type MonitorEventInput = {
  module: string;
  eventType: string;
  title: string;
  summary: string;
  severity: MonitorSeverity;
  riskScore: number;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, any>;
  decision?: {
    actionType: string;
    title: string;
    summary: string;
    risk: AIDecisionRisk;
    route?: string;
    payload?: Record<string, any>;
  };
};

function now() {
  return new Date().toISOString();
}

function safeDecisionId(input: MonitorEventInput) {
  const raw = `${input.eventType}_${input.entityType || "global"}_${input.entityId || "main"}`;
  return `ai_dec_${raw.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 120)}`;
}

function toNumber(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function text(value: any) {
  return String(value || "").trim();
}

function rowName(row: any) {
  return (
    text(row.name) ||
    text(row.product_name) ||
    text(row.nombre) ||
    text(row.material) ||
    text(row.item_name) ||
    text(row.code) ||
    text(row.id) ||
    "Registro"
  );
}

async function safeSelect(supabase: any, table: string, query = "*", limit = 300) {
  const { data, error } = await supabase.from(table).select(query).limit(limit);
  if (error) return [];
  return data || [];
}

function stockOf(row: any) {
  return toNumber(row.stock ?? row.quantity ?? row.qty ?? row.cantidad ?? row.existencia);
}

function minStockOf(row: any) {
  return toNumber(row.min_stock ?? row.stock_minimo ?? row.minimum_stock ?? row.minimo ?? row.reorder_point);
}

function costOf(row: any) {
  return toNumber(row.cost ?? row.unit_cost ?? row.costo ?? row.costo_unitario ?? row.cost_price ?? row.price_cost);
}

function priceOf(row: any) {
  return toNumber(row.sale_price ?? row.price ?? row.precio_venta ?? row.venta ?? row.unit_price);
}

function quoteMargin(row: any) {
  return toNumber(row.margin ?? row.margin_percent ?? row.profit_margin ?? row.margen);
}

function quoteTotal(row: any) {
  return toNumber(row.total ?? row.total_amount ?? row.total_price ?? row.net_total);
}

function isOpenStatus(value: any) {
  const status = text(value).toLowerCase();
  return !["cerrado", "closed", "completado", "completed", "cancelado", "cancelled", "entregado"].includes(status);
}

function money(value: number) {
  return `RD$${Math.round(value).toLocaleString("en-US")}`;
}

function servicePricingHint(row: any) {
  const name = rowName(row);
  const normalized = name.toLowerCase();
  const unit = text(row.unit || row.unidad || "unidad");
  const currentCost = costOf(row);
  const currentPrice = priceOf(row);

  let suggestedCost = 0;
  let suggestedPrice = currentPrice;
  let basis = "Usar una base provisional y validar contra costo real antes de cotizar.";

  if (normalized.includes("instal")) {
    suggestedCost = 2500;
    suggestedPrice = currentPrice > 0 ? currentPrice : 5000;
    basis = "Servicio de instalacion: costo operativo base por salida/cuadrilla y precio minimo para proteger margen.";
  } else if (normalized.includes("transporte")) {
    suggestedCost = 1500;
    suggestedPrice = currentPrice > 0 ? currentPrice : 3000;
    basis = "Servicio de transporte: combustible, tiempo y desgaste con precio minimo por entrega local.";
  } else if (normalized.includes("render") || normalized.includes("levantamiento")) {
    suggestedCost = currentPrice > 0 ? Math.round(currentPrice * 0.55) : 2500;
    suggestedPrice = currentPrice > 0 ? currentPrice : 5000;
    basis = "Render y levantamiento: costo tecnico estimado en 55% del precio actual.";
  } else if (normalized.includes("canteo")) {
    suggestedCost = currentPrice > 0 ? Math.max(1, Math.round(currentPrice * 0.5)) : 18;
    suggestedPrice = currentPrice > 0 ? currentPrice : 35;
    basis = "Canteo: costo estimado por metro en 50% del precio de venta.";
  } else if (normalized.includes("perfor")) {
    suggestedCost = 10;
    suggestedPrice = currentPrice > 0 ? currentPrice : 25;
    basis = "Perforacion: costo base por unidad de operacion con margen minimo.";
  } else if (normalized.includes("cnc") || normalized.includes("corte")) {
    suggestedCost = 700;
    suggestedPrice = currentPrice > 0 ? currentPrice : 1500;
    basis = "Corte CNC: costo base por setup/servicio para no cotizar produccion en cero.";
  } else if (currentPrice > 0) {
    suggestedCost = Math.max(1, Math.round(currentPrice * 0.55));
    basis = "Costo sugerido calculado como 55% del precio de venta actual.";
  } else {
    suggestedCost = 1000;
    suggestedPrice = 2000;
  }

  const actionSummary = `Actualizar ${name}: costo sugerido ${money(suggestedCost)} y precio venta sugerido ${money(suggestedPrice)} por ${unit}.`;

  return {
    product: name,
    sku: text(row.code || row.sku),
    unit,
    currentCost,
    currentPrice,
    suggestedCost,
    suggestedPrice,
    basis,
    actionSummary,
    targetFields: {
      cost: ["unit_cost", "cost", "cost_price", "purchase_cost"],
      price: ["sale_price", "price", "unit_price", "precio_venta"],
    },
    nextSteps: [
      `Abrir inventario y buscar ${name}.`,
      `Actualizar costo a ${money(suggestedCost)}.`,
      `Actualizar precio venta a ${money(suggestedPrice)} si esta en cero o por debajo del minimo.`,
      "Validar margen antes de cotizar o producir.",
    ],
  };
}

async function upsertMonitorEvent(supabase: any, input: MonitorEventInput) {
  let query = supabase
    .from(MONITOR_TABLE)
    .select("id")
    .eq("status", "open")
    .eq("event_type", input.eventType)
    .limit(1);

  query = input.entityId ? query.eq("entity_id", input.entityId) : query.is("entity_id", null);

  const { data: existing } = await query;
  const payload = {
    module: input.module,
    event_type: input.eventType,
    title: input.title,
    summary: input.summary,
    severity: input.severity,
    risk_score: Math.max(0, Math.min(100, Math.round(input.riskScore))),
    entity_type: input.entityType || null,
    entity_id: input.entityId || null,
    payload: input.payload || {},
    status: "open",
  };

  const existingId = existing?.[0]?.id;
  if (existingId) {
    await supabase
      .from(MONITOR_TABLE)
      .update(payload)
      .eq("id", existingId);
    return existingId;
  }

  const { data } = await supabase
    .from(MONITOR_TABLE)
    .insert({ ...payload, created_at: now() })
    .select("id")
    .single();

  return data?.id || null;
}

async function upsertDecision(supabase: any, input: MonitorEventInput, userEmail: string) {
  if (!input.decision) return null;

  const id = safeDecisionId(input);
  const date = now();
  const requiresApproval = shouldRequireApproval(input.decision.risk, input.decision.actionType);

  const { data: existing } = await supabase
    .from(DECISIONS_TABLE)
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (existing?.status && existing.status !== "pending") return id;

  const record = {
    id,
    module: input.module,
    action_type: input.decision.actionType,
    title: input.decision.title,
    summary: input.decision.summary,
    risk: input.decision.risk,
    status: "pending",
    payload: {
      ...(input.payload || {}),
      ...(input.decision.payload || {}),
      source_event_type: input.eventType,
      entity_type: input.entityType || null,
      entity_id: input.entityId || null,
    },
    route: input.decision.route || null,
    requires_approval: requiresApproval,
    created_by: userEmail,
    updated_at: date,
  };

  await supabase
    .from(DECISIONS_TABLE)
    .upsert(
      {
        ...record,
        created_at: date,
      },
      { onConflict: "id" }
    );

  return id;
}

function buildMonitorEvents(data: {
  inventory: any[];
  quotes: any[];
  orders: any[];
  payments: any[];
  purchaseOrders: any[];
  requisitions: any[];
  sales: any[];
}) {
  const events: MonitorEventInput[] = [];
  const inventory = data.inventory || [];

  if (inventory.length === 0) {
    events.push({
      module: "inventario",
      eventType: "inventory_empty",
      title: "Inventario vacio",
      summary: "No hay inventario cargado para monitoreo operativo.",
      severity: "critical",
      riskScore: 95,
      entityType: "inventario",
      payload: { count: 0 },
      decision: {
        actionType: "open_inventory",
        title: "Cargar inventario maestro",
        summary: "Abrir inventario y cargar productos antes de iniciar pruebas operativas.",
        risk: "critical",
        route: "/inventario-inteligente",
      },
    });
  }

  const criticalStock = inventory
    .filter((row) => minStockOf(row) > 0 && stockOf(row) <= minStockOf(row))
    .slice(0, 12);

  criticalStock.forEach((row) => {
    const name = rowName(row);
    events.push({
      module: "inventario",
      eventType: "critical_stock",
      title: `Stock critico: ${name}`,
      summary: `${name} esta en ${stockOf(row)} y su minimo es ${minStockOf(row)}.`,
      severity: "danger",
      riskScore: 88,
      entityType: "inventory",
      entityId: text(row.id),
      payload: { product: name, stock: stockOf(row), minStock: minStockOf(row) },
      decision: {
        actionType: "create_requisition",
        title: `Crear requisicion por ${name}`,
        summary: `Preparar requisicion de almacen/compras para ${name}.`,
        risk: "high",
        route: "/inventario-inteligente/requisiciones",
      },
    });
  });

  const missingCost = inventory
    .filter((row) => costOf(row) <= 0)
    .slice(0, 12);

  missingCost.forEach((row) => {
    const name = rowName(row);
    const pricing = servicePricingHint(row);
    events.push({
      module: "inventario",
      eventType: "missing_inventory_cost",
      title: `Costo pendiente: ${name}`,
      summary: `${name} no tiene costo valido. Sugerencia IA: ${pricing.actionSummary}`,
      severity: "warning",
      riskScore: 64,
      entityType: "inventory",
      entityId: text(row.id),
      payload: {
        inventoryId: text(row.id),
        cost: costOf(row),
        price: priceOf(row),
        pricing,
      },
      decision: {
        actionType: "update_inventory_service_pricing",
        title: `Actualizar ${name}: ${money(pricing.suggestedCost)} costo / ${money(pricing.suggestedPrice)} venta`,
        summary: `Accion propuesta: ${pricing.actionSummary} Actual: costo ${money(pricing.currentCost)}, precio ${money(pricing.currentPrice)}. Motivo: ${pricing.basis}`,
        risk: "medium",
        route: "/inventario-inteligente",
        payload: {
          inventoryId: text(row.id),
          pricing,
          executionPlan: pricing.actionSummary,
          requiresHumanValidation: true,
        },
      },
    });
  });

  const lowMarginQuotes = (data.quotes || [])
    .filter((row) => quoteTotal(row) > 0 && quoteMargin(row) > 0 && quoteMargin(row) < 25)
    .slice(0, 10);

  lowMarginQuotes.forEach((row) => {
    const code = text(row.quote_number || row.quote_no || row.quote_code || row.id);
    events.push({
      module: "cotizador",
      eventType: "low_quote_margin",
      title: `Margen bajo en cotizacion ${code}`,
      summary: `La cotizacion ${code} tiene margen ${quoteMargin(row)}%.`,
      severity: quoteMargin(row) < 15 ? "danger" : "warning",
      riskScore: quoteMargin(row) < 15 ? 84 : 68,
      entityType: "quote",
      entityId: text(row.id),
      payload: { quote: code, margin: quoteMargin(row), total: quoteTotal(row) },
      decision: {
        actionType: "analyze_profit",
        title: `Revisar margen de ${code}`,
        summary: `Validar costos y precio antes de aprobar ${code}.`,
        risk: quoteMargin(row) < 15 ? "high" : "medium",
        route: "/cotizaciones",
      },
    });
  });

  const activeOrders = (data.orders || []).filter((row) => isOpenStatus(row.status || row.estado));
  const ordersWithoutBom = activeOrders
    .filter((row) => toNumber(row.total_items ?? row.total_pieces ?? row.items_count) <= 0)
    .slice(0, 10);

  ordersWithoutBom.forEach((row) => {
    const code = text(row.order_number || row.order_code || row.code || row.id);
    events.push({
      module: "produccion",
      eventType: "production_without_bom",
      title: `Orden sin BOM: ${code}`,
      summary: `La orden ${code} esta abierta, pero no tiene BOM/piezas suficientes para liberar produccion.`,
      severity: "warning",
      riskScore: 72,
      entityType: "production_order",
      entityId: text(row.id),
      payload: { order: code, status: row.status || row.estado },
      decision: {
        actionType: "review_bom",
        title: `Revisar BOM de ${code}`,
        summary: `Abrir produccion y validar materiales antes de corte.`,
        risk: "medium",
        route: "/produccion",
      },
    });
  });

  const pendingRequisitions = (data.requisitions || []).filter((row) => isOpenStatus(row.status || row.estado));
  if (pendingRequisitions.length > 0) {
    events.push({
      module: "compras",
      eventType: "pending_requisitions",
      title: "Requisiciones pendientes",
      summary: `${pendingRequisitions.length} requisicion(es) requieren seguimiento.`,
      severity: "warning",
      riskScore: 62,
      entityType: "warehouse_requisitions",
      payload: { count: pendingRequisitions.length },
      decision: {
        actionType: "review_requisitions",
        title: "Revisar requisiciones pendientes",
        summary: "Validar aprobacion, despacho o compra para requisiciones abiertas.",
        risk: "medium",
        route: "/inventario-inteligente/requisiciones",
      },
    });
  }

  const pendingPurchaseOrders = (data.purchaseOrders || []).filter((row) => isOpenStatus(row.status || row.estado));
  if (pendingPurchaseOrders.length > 0) {
    events.push({
      module: "compras",
      eventType: "pending_purchase_orders",
      title: "Ordenes de compra pendientes",
      summary: `${pendingPurchaseOrders.length} orden(es) de compra estan abiertas o sin recepcion final.`,
      severity: "warning",
      riskScore: 58,
      entityType: "purchase_orders",
      payload: { count: pendingPurchaseOrders.length },
      decision: {
        actionType: "review_purchase_orders",
        title: "Revisar ordenes de compra",
        summary: "Dar seguimiento a compras pendientes de recepcion.",
        risk: "medium",
        route: "/ordenes-compra",
      },
    });
  }

  const activePayments = (data.payments || []).filter((row) => isOpenStatus(row.status || row.estado));
  if (activePayments.length > 0) {
    events.push({
      module: "dashboard_ceo",
      eventType: "pending_payments",
      title: "Pagos pendientes",
      summary: `${activePayments.length} pago(s) requieren verificacion administrativa.`,
      severity: "warning",
      riskScore: 60,
      entityType: "client_payments",
      payload: { count: activePayments.length },
      decision: {
        actionType: "audit_cash",
        title: "Auditar pagos pendientes",
        summary: "Revisar soportes de pago y caja antes de cierre.",
        risk: "medium",
        route: "/pagos",
      },
    });
  }

  return events;
}

function toClient(row: any) {
  return {
    id: row.id,
    module: row.module,
    eventType: row.event_type,
    title: row.title,
    summary: row.summary,
    severity: row.severity,
    riskScore: row.risk_score,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: row.payload || {},
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function GET(req: Request) {
  const session = await requireApiSession(req, "dashboard_ceo");
  if (!session.ok) return session.response;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "open";

  const { data, error } = await session.supabase
    .from(MONITOR_TABLE)
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({
      ok: true,
      events: [],
      setupRequired: true,
      message: "La tabla ai_monitor_events no esta disponible.",
    });
  }

  return NextResponse.json({ ok: true, events: (data || []).map(toClient) });
}

export async function POST(req: Request) {
  const session = await requireApiSession(req, "dashboard_ceo");
  if (!session.ok) return session.response;

  const [inventory, quotes, orders, payments, purchaseOrders, requisitions, sales] = await Promise.all([
    safeSelect(session.supabase, "inventory", "*", 600),
    safeSelect(session.supabase, "quotes", "*", 300),
    safeSelect(session.supabase, "production_orders", "*", 300),
    safeSelect(session.supabase, "client_payments", "*", 300),
    safeSelect(session.supabase, "purchase_orders", "*", 300),
    safeSelect(session.supabase, "warehouse_requisitions", "*", 300),
    safeSelect(session.supabase, "sales", "*", 300),
  ]);

  const detected = buildMonitorEvents({
    inventory,
    quotes,
    orders,
    payments,
    purchaseOrders,
    requisitions,
    sales,
  });

  const eventIds: Array<string | null> = [];
  const decisionIds: Array<string | null> = [];

  for (const event of detected) {
    eventIds.push(await upsertMonitorEvent(session.supabase, event));
    decisionIds.push(await upsertDecision(session.supabase, event, session.user.email));
  }

  const healthScore = Math.max(
    0,
    100 - detected.reduce((sum, event) => sum + Math.max(5, Math.round(event.riskScore / 12)), 0)
  );

  return NextResponse.json({
    ok: true,
    scannedAt: now(),
    healthScore,
    detected: detected.length,
    eventIds: eventIds.filter(Boolean),
    decisionIds: decisionIds.filter(Boolean),
    summary: {
      inventory: inventory.length,
      quotes: quotes.length,
      orders: orders.length,
      payments: payments.length,
      purchaseOrders: purchaseOrders.length,
      requisitions: requisitions.length,
      sales: sales.length,
    },
  });
}

export async function PATCH(req: Request) {
  const session = await requireApiSession(req, "dashboard_ceo");
  if (!session.ok) return session.response;

  const body = await req.json();
  const id = text(body?.id);
  const status = text(body?.status || "acknowledged").toLowerCase();

  if (!id) return NextResponse.json({ ok: false, message: "Falta id." }, { status: 400 });
  if (!["acknowledged", "resolved", "dismissed"].includes(status)) {
    return NextResponse.json({ ok: false, message: "Estado no permitido." }, { status: 400 });
  }

  const patch: Record<string, any> = {
    status,
  };
  if (status === "resolved" || status === "dismissed") patch.resolved_at = now();

  const { data, error } = await session.supabase
    .from(MONITOR_TABLE)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, event: toClient(data) });
}
