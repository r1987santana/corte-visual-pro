import { NextResponse } from "next/server";
import { getServiceSupabase, requireApiSession } from "@/lib/security/api-guard";
import { isTrustedLocalRequest } from "@/lib/security/local-session";
import {
  TurquesaInventoryItem,
  TurquesaInventoryTrend,
  TurquesaKitchenTicket,
  TurquesaMaterialYieldMetric,
  TurquesaOrderItem,
  TurquesaOperatingExpense,
  TurquesaPurchaseRequest,
  TurquesaRecipeIngredient,
  TurquesaSnapshot,
  TurquesaSpoilageEvent,
  TurquesaTableStatus,
  freshDemoSnapshot,
} from "@/lib/turquesa/restaurant-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESTAURANT_SLUG = "turquesa-restaurante";

type DbContext = {
  supabase: any;
  actorEmail: string;
  localDev: boolean;
};

type OperationBody = Record<string, any>;
type PaymentMethod = "cash" | "card" | "transfer";
type ExpensePaymentMethod = PaymentMethod | "pending";
type WifiLeadStatus = "nuevo" | "promocion" | "cliente" | "no_contactar";
type SpoilageSourceType = "inventory" | "menu_item";
type StaffAccessRole = "waiter" | "supervisor";
type StaffAccessSession = {
  role: StaffAccessRole;
  code: string;
  name: string;
  label: string;
};

type DbTableRow = {
  id: string;
  code: string;
  seats?: number | string | null;
  status?: string | null;
  current_server_name?: string | null;
  current_started_at?: string | null;
  current_order_id?: string | null;
  dining_area_id?: string | null;
};

type DbOrderRow = {
  id: string;
  total?: number | string | null;
  subtotal?: number | string | null;
  opened_at?: string | null;
  status?: string | null;
  pax?: number | string | null;
  guest_name?: string | null;
  notes?: string | null;
};

type DbMenuRow = {
  id: string;
  name: string;
  station?: string | null;
  price?: number | string | null;
};

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function normalizePax(value: unknown, fallback = 1) {
  const parsed = Number(value);
  const safeFallback = Math.max(1, Math.min(50, Math.round(Number(fallback) || 1)));
  if (!Number.isFinite(parsed)) return safeFallback;
  return Math.max(1, Math.min(50, Math.round(parsed)));
}

function guestNamesFromBody(body: OperationBody, pax: number) {
  const raw = Array.isArray(body?.guestNames) ? body.guestNames : [];
  return raw.map((name: unknown) => clean(name)).filter(Boolean).slice(0, pax);
}

function guestNamesFromOrder(order: DbOrderRow | null | undefined) {
  return clean(order?.guest_name)
    .split(",")
    .map((name) => clean(name))
    .filter(Boolean);
}

function orderItemKitchenNote(line: TurquesaOrderItem) {
  const guestName = clean(line.guestName);
  const note = clean(line.note || (line as any).comment || (line as any).notes);
  return [
    guestName ? `Para: ${guestName}` : "",
    note ? `Nota: ${note}` : "",
  ]
    .filter(Boolean)
    .join(" / ");
}

const waiterAccessCodes: StaffAccessSession[] = [
  { role: "waiter", code: "1010", name: "Laura", label: "Laura / Salon" },
  { role: "waiter", code: "2020", name: "Rafael", label: "Rafael / Terraza" },
  { role: "waiter", code: "3030", name: "Mia", label: "Mia / Bar" },
  { role: "waiter", code: "4040", name: "Carlos", label: "Carlos / Eventos" },
  { role: "waiter", code: "5050", name: "Nadia", label: "Nadia / Bar" },
];

const supervisorAccessCode: StaffAccessSession = {
  role: "supervisor",
  code: "9090",
  name: "Supervisor",
  label: "Supervisor general",
};

function staffAccessFromBody(body: OperationBody): StaffAccessSession | null {
  const code = clean(body?.staffCode);
  if (!code) return null;
  if (code === supervisorAccessCode.code) return supervisorAccessCode;
  return waiterAccessCodes.find((staff) => staff.code === code) || null;
}

function tableIsOpenForStaffAccess(table: any) {
  const status = clean(table?.status).toLowerCase();
  return Boolean(table?.current_order_id) || status === "open" || status === "attention";
}

function requireTableStaffAccess(body: OperationBody, table: any, action: string) {
  const staff = staffAccessFromBody(body);
  if (!staff) {
    return {
      response: NextResponse.json({ ok: false, error: `Codigo de mozo requerido para ${action}.` }, { status: 403 }),
    };
  }

  const tableOwner = clean(table?.current_server_name);
  const hasOwner = tableOwner && tableOwner.toLowerCase() !== "libre";
  if (staff.role !== "supervisor" && tableIsOpenForStaffAccess(table) && hasOwner && tableOwner !== staff.name) {
    return {
      response: NextResponse.json(
        { ok: false, error: `Mesa ${clean(table?.code) || "seleccionada"} abierta por ${tableOwner}. Solo ${tableOwner} o supervisor puede ${action}.` },
        { status: 403 }
      ),
    };
  }

  return { staff };
}

function normalizePaymentMethod(value: unknown): PaymentMethod {
  const method = clean(value).toLowerCase();
  if (method === "cash" || method === "card" || method === "transfer") return method;
  return "card";
}

function normalizeExpenseMethod(value: unknown): ExpensePaymentMethod {
  const method = clean(value).toLowerCase();
  if (method === "cash" || method === "card" || method === "transfer" || method === "pending") return method;
  return "cash";
}

function normalizeSpoilageSourceType(value: unknown): SpoilageSourceType {
  const sourceType = clean(value).toLowerCase();
  if (
    sourceType === "menu_item" ||
    sourceType === "menu" ||
    sourceType === "plato" ||
    sourceType === "service" ||
    sourceType === "prepared_food"
  ) {
    return "menu_item";
  }
  return "inventory";
}

const spoilageReasonLabels: Record<string, string> = {
  spoiled_raw: "Materia prima en mal estado",
  expired: "Producto vencido",
  service_error: "Error de servicio",
  customer_return: "Producto devuelto",
  breakage: "Rotura o derrame",
  quality_control: "Control de calidad",
  other: "Otro decomiso",
};

function normalizeSpoilageReason(value: unknown) {
  const key = clean(value).toLowerCase();
  return Object.prototype.hasOwnProperty.call(spoilageReasonLabels, key) ? key : "other";
}

function paymentMethodLabel(method: PaymentMethod) {
  if (method === "cash") return "efectivo";
  if (method === "transfer") return "transferencia";
  return "tarjeta";
}

function expenseMethodLabel(method: ExpensePaymentMethod) {
  if (method === "cash") return "efectivo";
  if (method === "transfer") return "transferencia";
  if (method === "pending") return "pendiente";
  return "tarjeta";
}

function shiftSalesColumn(method: PaymentMethod) {
  if (method === "cash") return "cash_sales";
  if (method === "transfer") return "transfer_sales";
  return "card_sales";
}

function expenseCategoryConfig(value: unknown) {
  const key = clean(value).toLowerCase().replace(/\s+/g, "_");
  const categories: Record<string, { label: string; accountCode: string; accountName: string }> = {
    local: { label: "Local", accountCode: "6120", accountName: "Gastos de local sin factura" },
    servicios: { label: "Servicios", accountCode: "6130", accountName: "Servicios sin factura" },
    transporte: { label: "Transporte", accountCode: "6140", accountName: "Transporte sin factura" },
    compra_menor: { label: "Compra menor", accountCode: "6150", accountName: "Compras menores sin factura" },
    personal: { label: "Personal", accountCode: "6160", accountName: "Pagos operativos sin factura" },
    mantenimiento: { label: "Mantenimiento", accountCode: "6170", accountName: "Mantenimiento sin factura" },
    otros: { label: "Otros", accountCode: "6190", accountName: "Gastos varios sin factura" },
  };

  return categories[key] || categories.otros;
}

function expenseCreditAccount(method: ExpensePaymentMethod) {
  if (method === "cash") return { accountCode: "1101", accountName: "Caja general" };
  if (method === "transfer") return { accountCode: "1115", accountName: "Banco transferencia" };
  if (method === "pending") return { accountCode: "2115", accountName: "CXP gastos sin factura" };
  return { accountCode: "1110", accountName: "Banco tarjeta" };
}

function money(value: unknown) {
  return Math.round(num(value) * 100) / 100;
}

function normalizeDiscountRate(value: unknown) {
  const rate = Math.round(num(value) * 10000) / 10000;
  if (Math.abs(rate - 0.05) < 0.0001) return 0.05;
  if (Math.abs(rate - 0.1) < 0.0001) return 0.1;
  if (Math.abs(rate - 0.2) < 0.0001) return 0.2;
  return 0;
}

function discountMessage(rate: number, label: unknown) {
  const cleanLabel = clean(label);
  if (!rate) return "";
  return ` Descuento aplicado: ${cleanLabel || `${Math.round(rate * 100)}%`}.`;
}

function quantity(value: unknown) {
  return Math.round(num(value) * 1000) / 1000;
}

function quantityLabel(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function normalizeWifiLeadStatus(value: unknown): WifiLeadStatus {
  const status = clean(value).toLowerCase();
  if (status === "nuevo" || status === "promocion" || status === "cliente" || status === "no_contactar") return status;
  return "cliente";
}

function normalizeReservationStatus(value: unknown) {
  const status = clean(value).toLowerCase();
  if (status === "pending" || status === "confirmed" || status === "seated" || status === "cancelled" || status === "no_show") {
    return status;
  }
  return "pending";
}

function reservationIso(dateValue: unknown, timeValue: unknown) {
  const today = new Date().toISOString().slice(0, 10);
  const rawDate = clean(dateValue) || today;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
  const rawTime = clean(timeValue) || "20:00";
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime : "20:00";
  return new Date(`${date}T${time}:00-04:00`).toISOString();
}

function publicErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as any)?.message || error || "");
  if (
    message.includes("turquesa_") ||
    message.includes("schema cache") ||
    message.includes("relation") ||
    message.includes("does not exist")
  ) {
    return "Base Turquesa pendiente de aplicar en Supabase.";
  }
  return message || "base Turquesa no disponible";
}

function timeLabel(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-DO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function minutesSince(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function uiTableStatus(value: unknown): TurquesaTableStatus {
  const status = String(value || "free");
  if (status === "open" || status === "reserved" || status === "attention" || status === "free") return status;
  if (status === "cleaning") return "attention";
  return "free";
}

function uiInventoryTrend(onHand: number, minimum: number, reorder: number): TurquesaInventoryTrend {
  if (onHand < minimum) return "critico";
  if (reorder > 0 && onHand <= reorder) return "bajo";
  if (minimum > 0 && onHand <= minimum * 1.25) return "bajo";
  return "ok";
}

function materialYieldNote(spoilageRate: number, spoilageQty: number) {
  if (spoilageRate >= 12) return "Merma alta. Revisar frio, porcion, limpieza y preparacion.";
  if (spoilageRate >= 5 || spoilageQty > 0) return "Merma presente. Mantener seguimiento por turno.";
  return "Rendimiento sano contra recetas y decomisos.";
}

function materialYieldStatus(spoilageRate: number, spoilageCost: number) {
  if (spoilageRate >= 12 || spoilageCost >= 1200) return "critico" as const;
  if (spoilageRate >= 5 || spoilageCost > 0) return "vigilar" as const;
  return "ok" as const;
}

function buildMaterialYieldMetrics(
  inventory: TurquesaInventoryItem[],
  recipeIngredients: TurquesaRecipeIngredient[],
  consumptionEvents: any[],
  spoilageEvents: any[]
): TurquesaMaterialYieldMetric[] {
  const metrics = new Map<string, TurquesaMaterialYieldMetric>();
  const recipesByIngredient = new Map<string, number>();

  recipeIngredients.forEach((recipe) => {
    recipesByIngredient.set(recipe.ingredient, (recipesByIngredient.get(recipe.ingredient) || 0) + 1);
  });

  inventory.forEach((item) => {
    metrics.set(item.item, {
      item: item.item,
      unit: item.unit,
      theoreticalUsed: 0,
      spoilageQty: 0,
      totalOut: 0,
      yieldRate: 100,
      spoilageRate: 0,
      spoilageCost: 0,
      onHand: item.onHand,
      avgCost: item.avgCost,
      recipeLinks: recipesByIngredient.get(item.item) || 0,
      status: "ok",
      note: "Rendimiento sano contra recetas y decomisos.",
    });
  });

  const addUsage = (itemName: string, qty: number, unit: string, cost: number, source: "recipe" | "spoilage") => {
    if (!itemName || qty <= 0) return;
    const current =
      metrics.get(itemName) ||
      ({
        item: itemName,
        unit: unit || "u",
        theoreticalUsed: 0,
        spoilageQty: 0,
        totalOut: 0,
        yieldRate: 100,
        spoilageRate: 0,
        spoilageCost: 0,
        onHand: 0,
        avgCost: 0,
        recipeLinks: recipesByIngredient.get(itemName) || 0,
        status: "ok",
        note: "Rendimiento sano contra recetas y decomisos.",
      } satisfies TurquesaMaterialYieldMetric);

    if (source === "recipe") {
      current.theoreticalUsed = quantity(current.theoreticalUsed + qty);
    } else {
      current.spoilageQty = quantity(current.spoilageQty + qty);
      current.spoilageCost = money(current.spoilageCost + cost);
    }
    if (!current.unit && unit) current.unit = unit;
    metrics.set(itemName, current);
  };

  (consumptionEvents || []).forEach((event) => {
    const payload = event.payload || {};
    (payload.consumed_items || []).forEach((line: any) => {
      addUsage(clean(line.item_name), quantity(line.consumed_quantity), clean(line.unit), 0, "recipe");
    });
  });

  (spoilageEvents || []).forEach((event) => {
    const payload = event.payload || {};
    const affected = Array.isArray(payload.affected_items) ? payload.affected_items : [];
    if (affected.length) {
      affected.forEach((line: any) => {
        addUsage(clean(line.item_name), quantity(line.quantity), clean(line.unit), money(line.cost), "spoilage");
      });
      return;
    }
    if (normalizeSpoilageSourceType(payload.source_type) === "inventory") {
      addUsage(clean(payload.item_name), quantity(payload.quantity), clean(payload.unit), money(payload.total_cost), "spoilage");
    }
  });

  return Array.from(metrics.values())
    .map((metric) => {
      const totalOut = quantity(metric.theoreticalUsed + metric.spoilageQty);
      const spoilageRate = totalOut ? Math.round((metric.spoilageQty / totalOut) * 100) : 0;
      const yieldRate = totalOut ? Math.max(0, 100 - spoilageRate) : 100;
      return {
        ...metric,
        totalOut,
        yieldRate,
        spoilageRate,
        status: materialYieldStatus(spoilageRate, metric.spoilageCost),
        note: materialYieldNote(spoilageRate, metric.spoilageQty),
      };
    })
    .sort((a, b) => {
      const severity = { critico: 2, vigilar: 1, ok: 0 };
      return severity[b.status] - severity[a.status] || b.spoilageCost - a.spoilageCost || b.totalOut - a.totalOut;
    });
}

async function getDbContext(request: Request): Promise<DbContext | Response> {
  const session = await requireApiSession(request, ["dashboard_ceo", "ventas"]);
  if (session.ok) {
    return {
      supabase: session.supabase,
      actorEmail: session.user.email,
      localDev: false,
    };
  }

  if (process.env.NODE_ENV !== "production" && isTrustedLocalRequest(request)) {
    return {
      supabase: getServiceSupabase(),
      actorEmail: "turquesa-local-dev@rdss.local",
      localDev: true,
    };
  }

  return session.response;
}

async function getRestaurant(supabase: any) {
  const { data, error } = await supabase
    .from("turquesa_restaurants")
    .select("id,name,location,tax_rate,service_charge_rate")
    .eq("slug", RESTAURANT_SLUG)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getOpenShift(supabase: any, restaurantId: string) {
  const { data, error } = await supabase
    .from("turquesa_shifts")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function readSnapshot(supabase: any): Promise<TurquesaSnapshot> {
  const restaurant = await getRestaurant(supabase);
  if (!restaurant) {
    return freshDemoSnapshot("Base Turquesa sin seed. Ejecuta scripts/turquesa-restaurant-core.sql.");
  }

  const shift = await getOpenShift(supabase, restaurant.id);
  const reservationsStart = new Date();
  reservationsStart.setHours(0, 0, 0, 0);
  const reservationsEnd = new Date(reservationsStart);
  reservationsEnd.setDate(reservationsEnd.getDate() + 14);

  const [
    areasResult,
    tablesResult,
    menuResult,
    reservationsResult,
    inventoryResult,
    recipeIngredientsResult,
    purchaseRequestsResult,
    operatingExpensesResult,
    consumptionEventsResult,
    spoilageEventsResult,
    leadsResult,
  ] = await Promise.all([
    supabase
      .from("turquesa_dining_areas")
      .select("id,name")
      .eq("restaurant_id", restaurant.id),
    supabase
      .from("turquesa_tables")
      .select("id,code,seats,status,current_server_name,current_started_at,current_order_id,dining_area_id,sort_order")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("turquesa_menu_items")
      .select("id,name,category_name,station,price,prep_minutes,sort_order")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("turquesa_reservations")
      .select("id,reservation_at,guest_name,pax,source,status,note,table_id,phone,email,created_at")
      .eq("restaurant_id", restaurant.id)
      .gte("reservation_at", reservationsStart.toISOString())
      .lt("reservation_at", reservationsEnd.toISOString())
      .order("reservation_at", { ascending: true })
      .limit(40),
    supabase
      .from("turquesa_inventory_items")
      .select("id,item_name,unit,on_hand,minimum_stock,reorder_stock,avg_cost,supplier")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("item_name", { ascending: true })
      .limit(12),
    supabase
      .from("turquesa_recipe_ingredients")
      .select("id,menu_item_id,inventory_item_id,quantity,unit,yield_note")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(80),
    supabase
      .from("turquesa_purchase_requests")
      .select("id,request_code,status,priority,total_estimated,requested_at,created_at,turquesa_purchase_request_items(item_name,quantity,unit,supplier,estimated_cost)")
      .eq("restaurant_id", restaurant.id)
      .in("status", ["draft", "requested", "approved", "received"])
      .order("requested_at", { ascending: false })
      .limit(5),
    shift?.id
      ? supabase
          .from("turquesa_accounting_entries")
          .select("id,entry_date,account_code,account_name,debit,credit,memo,metadata,created_at")
          .eq("restaurant_id", restaurant.id)
          .eq("shift_id", shift.id)
          .eq("reference_type", "uninvoiced_expense")
          .eq("status", "posted")
          .gt("debit", 0)
          .order("created_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("turquesa_events")
      .select("id,payload,created_at")
      .eq("restaurant_id", restaurant.id)
      .eq("event_type", "inventory_consumed_by_ticket")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("turquesa_events")
      .select("id,description,payload,actor_email,created_at")
      .eq("restaurant_id", restaurant.id)
      .eq("event_type", "inventory_spoilage_recorded")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("turquesa_wifi_leads")
      .select("full_name,source,status,last_seen_at,visits")
      .eq("restaurant_id", restaurant.id)
      .order("last_seen_at", { ascending: false })
      .limit(8),
  ]);

  for (const result of [
    areasResult,
    tablesResult,
    menuResult,
    reservationsResult,
    inventoryResult,
    recipeIngredientsResult,
    purchaseRequestsResult,
    operatingExpensesResult,
    consumptionEventsResult,
    spoilageEventsResult,
    leadsResult,
  ]) {
    if (result.error) throw result.error;
  }

  const areas = new Map<string, string>((areasResult.data || []).map((area: any) => [area.id, area.name]));
  const dbTables = (tablesResult.data || []) as DbTableRow[];
  const orderIds = dbTables.map((table: any) => table.current_order_id).filter(Boolean);

  const ordersResult = orderIds.length
    ? await supabase
        .from("turquesa_orders")
        .select("id,total,subtotal,opened_at,status,pax,guest_name,notes")
        .in("id", orderIds)
    : { data: [], error: null };

  if (ordersResult.error) throw ordersResult.error;
  const ordersData = (ordersResult.data || []) as DbOrderRow[];
  const orders = new Map<string, DbOrderRow>(ordersData.map((order) => [order.id, order]));
  const tableById = new Map<string, DbTableRow>(dbTables.map((table) => [table.id, table]));
  const menuById = new Map<string, any>((menuResult.data || []).map((item: any) => [item.id, item]));
  const inventoryById = new Map<string, any>((inventoryResult.data || []).map((item: any) => [item.id, item]));

  const tables = dbTables.map((table: any) => {
    const order = table.current_order_id ? orders.get(table.current_order_id) : null;
    const guestNames = guestNamesFromOrder(order);
    return {
      id: table.id,
      label: table.code,
      seats: Number(table.seats || 0),
      activePax: order ? normalizePax(order.pax, Number(table.seats || 1)) : undefined,
      guestNames,
      zone: areas.get(table.dining_area_id) || "Salon",
      status: uiTableStatus(table.status),
      server: table.current_server_name || "Libre",
      total: num(order?.total || order?.subtotal),
      minutes: minutesSince(table.current_started_at || order?.opened_at),
    };
  });

  const ticketQuery = shift?.id
    ? supabase
        .from("turquesa_kitchen_tickets")
        .select("id,ticket_number,table_id,order_id,station,status,fired_at,notes")
        .eq("shift_id", shift.id)
        .in("status", ["new", "cooking", "ready"])
        .order("fired_at", { ascending: true })
        .limit(30)
    : Promise.resolve({ data: [], error: null });

  const ticketsResult = await ticketQuery;
  if (ticketsResult.error) throw ticketsResult.error;
  const ticketIds = (ticketsResult.data || []).map((ticket: any) => ticket.id);
  const ticketItemsResult = ticketIds.length
    ? await supabase
        .from("turquesa_kitchen_ticket_items")
        .select("ticket_id,item_name,quantity,notes")
        .in("ticket_id", ticketIds)
    : { data: [], error: null };

  if (ticketItemsResult.error) throw ticketItemsResult.error;
  const itemsByTicket = new Map<string, string[]>();
  (ticketItemsResult.data || []).forEach((item: any) => {
    const note = clean(item.notes);
    const label = `${Number(item.quantity || 1).toFixed(Number(item.quantity || 1) % 1 ? 1 : 0)}x ${item.item_name}${note ? ` (${note})` : ""}`;
    const list = itemsByTicket.get(item.ticket_id) || [];
    list.push(label);
    itemsByTicket.set(item.ticket_id, list);
  });

  const kitchenTickets: TurquesaKitchenTicket[] = (ticketsResult.data || []).map((ticket: any) => ({
    id: ticket.ticket_number,
    table: tableById.get(ticket.table_id)?.code || clean(ticket.notes) || "Para llevar",
    items: itemsByTicket.get(ticket.id) || [],
    station: ticket.station || "Mixta",
    minutes: minutesSince(ticket.fired_at),
    status: ticket.status === "ready" ? "ready" : ticket.status === "cooking" ? "cooking" : "new",
  }));

  const openOrdersTotal = Array.from(orders.values()).reduce<number>((sum, order) => sum + num(order.total || order.subtotal), 0);
  const openingCash = num(shift?.opening_cash);
  const cashSales = num(shift?.cash_sales);
  const cardSales = num(shift?.card_sales);
  const transferSales = num(shift?.transfer_sales);
  const cashOpen = cashSales + cardSales + transferSales;
  const operatingExpenses: TurquesaOperatingExpense[] = ((operatingExpensesResult.data || []) as any[]).map((entry) => {
    const metadata = entry.metadata || {};
    return {
      id: entry.id,
      code: clean(metadata.expense_code) || `GSF-${String(entry.id || "").slice(0, 4).toUpperCase()}`,
      category: clean(metadata.category_label) || clean(metadata.category) || entry.account_name || "Gasto",
      description: clean(metadata.description) || clean(entry.memo) || entry.account_name || "Gasto sin factura",
      amount: num(entry.debit),
      method: normalizeExpenseMethod(metadata.method),
      responsible: clean(metadata.responsible) || clean(metadata.created_by) || "Caja",
      note: clean(metadata.note),
      createdAt: entry.created_at || entry.entry_date || new Date().toISOString(),
    };
  });
  const cashOperatingExpenses = operatingExpenses
    .filter((expense) => expense.method === "cash")
    .reduce((sum, expense) => sum + expense.amount, 0);
  const expectedCashDrawer = money(openingCash + cashSales - cashOperatingExpenses);
  const spoilageEvents: TurquesaSpoilageEvent[] = ((spoilageEventsResult.data || []) as any[]).map((event) => {
    const payload = event.payload || {};
    const sourceType = normalizeSpoilageSourceType(payload.source_type);
    return {
      id: event.id,
      item: clean(payload.item_name) || clean(payload.menu_item_name) || clean(event.description) || "Decomiso",
      sourceType,
      quantity: quantity(payload.quantity),
      unit: clean(payload.unit) || (sourceType === "menu_item" ? "plato" : "u"),
      reason: clean(payload.reason_label) || spoilageReasonLabels[normalizeSpoilageReason(payload.reason_key)],
      cost: money(payload.total_cost),
      responsible: clean(payload.responsible) || clean(event.actor_email) || "Equipo",
      note: clean(payload.note),
      createdAt: event.created_at || new Date().toISOString(),
    };
  });
  const inventoryItems: TurquesaInventoryItem[] = (inventoryResult.data || []).map((item: any) => {
    const onHand = num(item.on_hand);
    const min = num(item.minimum_stock);
    const reorder = num(item.reorder_stock);
    return {
      item: item.item_name,
      onHand,
      unit: item.unit,
      min,
      trend: uiInventoryTrend(onHand, min, reorder),
      avgCost: num(item.avg_cost),
      supplier: item.supplier || "Proveedor por definir",
    };
  });
  const recipeIngredientItems: TurquesaRecipeIngredient[] = ((recipeIngredientsResult.data || []) as any[]).map((item) => ({
    id: item.id,
    menuItem: menuById.get(item.menu_item_id)?.name || "Menu",
    ingredient: inventoryById.get(item.inventory_item_id)?.item_name || "Insumo",
    qty: num(item.quantity),
    unit: item.unit || inventoryById.get(item.inventory_item_id)?.unit || "u",
    note: item.yield_note || "",
  }));
  const materialYieldMetrics = buildMaterialYieldMetrics(
    inventoryItems,
    recipeIngredientItems,
    (consumptionEventsResult.data || []) as any[],
    (spoilageEventsResult.data || []) as any[]
  );

  return {
    source: "database",
    message: "Datos cargados desde la base Turquesa.",
    generatedAt: new Date().toISOString(),
    restaurant: {
      id: restaurant.id,
      name: restaurant.name || "Turquesa Restaurante",
      location: restaurant.location || "Cadaques Caribe, Bayahibe",
    },
    shift: {
      id: shift?.id || "sin-turno",
      label: shift?.label || "Sin turno abierto",
      status: shift?.status || "closed",
      openedAt: shift?.opened_at || new Date().toISOString(),
      closedAt: shift?.closed_at || null,
      projectedSales: cashOpen + openOrdersTotal,
      cashOpen,
      openingCash,
      cashSales,
      cardSales,
      transferSales,
      serviceChargeTotal: num(shift?.service_charge_total),
      taxTotal: num(shift?.tax_total),
      tipPool: num(shift?.tip_pool),
      expectedCashDrawer,
      countedCash: shift?.counted_cash == null ? null : num(shift.counted_cash),
      cashDifference: shift?.cash_difference == null ? null : num(shift.cash_difference),
    },
    tables,
    menuItems: (menuResult.data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category_name,
      price: num(item.price),
      station: item.station,
      prep: Number(item.prep_minutes || 0),
    })),
    kitchenTickets,
    reservations: (reservationsResult.data || []).map((item: any) => ({
      id: item.id,
      date: dateLabel(item.reservation_at),
      time: timeLabel(item.reservation_at),
      name: item.guest_name,
      guests: Number(item.pax || 0),
      area: tableById.get(item.table_id)?.code || "Sin mesa asignada",
      note: item.note || "",
      status: normalizeReservationStatus(item.status),
      source: item.source || "Directa",
      phone: item.phone || "",
      email: item.email || "",
      createdAt: item.created_at || item.reservation_at,
    })),
    inventory: inventoryItems,
    recipeIngredients: recipeIngredientItems,
    purchaseRequests: ((purchaseRequestsResult.data || []) as any[]).map((request): TurquesaPurchaseRequest => ({
      id: request.id,
      code: request.request_code,
      status: request.status,
      priority: request.priority || "normal",
      total: num(request.total_estimated),
      createdAt: request.requested_at || request.created_at,
      items: (request.turquesa_purchase_request_items || []).map((item: any) => ({
        item: item.item_name,
        qty: num(item.quantity),
        unit: item.unit || "u",
        supplier: item.supplier || "Proveedor",
        estimatedCost: num(item.estimated_cost),
      })),
    })),
    operatingExpenses,
    spoilageEvents,
    materialYieldMetrics,
    wifiLeads: (leadsResult.data || []).map((lead: any) => ({
      name: lead.full_name,
      time: timeLabel(lead.last_seen_at),
      source: lead.source || "Wi-Fi",
      status: lead.status || "nuevo",
    })),
  };
}

async function recalcOrderTotals(
  supabase: any,
  restaurant: any,
  orderId: string,
  options: { serviceChargeable?: boolean; discountRate?: number | null } = {}
) {
  const { data, error } = await supabase
    .from("turquesa_order_items")
    .select("line_total")
    .eq("order_id", orderId)
    .neq("status", "void");

  if (error) throw error;
  let serviceChargeable = options.serviceChargeable;
  const { data: order, error: orderError } = await supabase
    .from("turquesa_orders")
    .select("order_type,discount")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (serviceChargeable == null) {
    serviceChargeable = order?.order_type !== "takeout";
  }

  const subtotal = (data || []).reduce((sum: number, item: any) => sum + num(item.line_total), 0);
  const hasDiscountRate = Object.prototype.hasOwnProperty.call(options, "discountRate");
  const discount = hasDiscountRate
    ? Math.min(subtotal, money(subtotal * normalizeDiscountRate(options.discountRate)))
    : Math.min(subtotal, money(order?.discount));
  const taxableSubtotal = Math.max(0, subtotal - discount);
  const service = serviceChargeable ? Math.round(taxableSubtotal * num(restaurant.service_charge_rate) * 100) / 100 : 0;
  const tax = Math.round(taxableSubtotal * num(restaurant.tax_rate) * 100) / 100;
  const total = taxableSubtotal + service + tax;

  const { error: updateError } = await supabase
    .from("turquesa_orders")
    .update({
      subtotal,
      service_charge: service,
      tax,
      discount,
      total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updateError) throw updateError;
  return { subtotal, discount, taxableSubtotal, service, tax, total };
}

async function ensureOpenShift(supabase: any, restaurantId: string, actorEmail: string) {
  const existing = await getOpenShift(supabase, restaurantId);
  if (existing) return existing;

  const code = new Date().toISOString().slice(0, 10) + "-auto";
  const { data, error } = await supabase
    .from("turquesa_shifts")
    .insert({
      restaurant_id: restaurantId,
      shift_code: code,
      label: "Turno activo",
      status: "open",
      opened_by_email: actorEmail,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function consumeInventoryForTicket(
  supabase: any,
  restaurantId: string,
  shiftId: string | null,
  ticket: any,
  orderItems: any[],
  actorEmail: string
) {
  const menuQty = new Map<string, number>();
  orderItems.forEach((item) => {
    const menuItemId = clean(item.menu_item_id);
    if (!menuItemId) return;
    menuQty.set(menuItemId, quantity((menuQty.get(menuItemId) || 0) + num(item.quantity)));
  });

  const menuItemIds = Array.from(menuQty.keys());
  if (!menuItemIds.length) return [];

  const { data: recipes, error: recipeError } = await supabase
    .from("turquesa_recipe_ingredients")
    .select("menu_item_id,inventory_item_id,quantity,unit")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .in("menu_item_id", menuItemIds);

  if (recipeError) throw recipeError;
  if (!recipes?.length) return [];

  const consumptionByInventory = new Map<string, number>();
  (recipes || []).forEach((recipe: any) => {
    const inventoryItemId = clean(recipe.inventory_item_id);
    if (!inventoryItemId) return;
    const consumed = quantity(num(recipe.quantity) * (menuQty.get(recipe.menu_item_id) || 0));
    consumptionByInventory.set(inventoryItemId, quantity((consumptionByInventory.get(inventoryItemId) || 0) + consumed));
  });

  const inventoryIds = Array.from(consumptionByInventory.keys());
  if (!inventoryIds.length) return [];

  const { data: inventoryRows, error: inventoryError } = await supabase
    .from("turquesa_inventory_items")
    .select("id,item_name,on_hand,unit,minimum_stock,reorder_stock")
    .eq("restaurant_id", restaurantId)
    .in("id", inventoryIds);

  if (inventoryError) throw inventoryError;

  const inventoryById = new Map<string, any>((inventoryRows || []).map((item: any) => [item.id, item]));
  const now = new Date().toISOString();
  const consumedLines: any[] = [];

  for (const [inventoryItemId, consumedQty] of consumptionByInventory.entries()) {
    const inventory = inventoryById.get(inventoryItemId);
    if (!inventory) continue;

    const previousOnHand = quantity(inventory.on_hand);
    const nextOnHand = Math.max(0, quantity(previousOnHand - consumedQty));
    const shortage = Math.max(0, quantity(consumedQty - previousOnHand));

    const { error: updateError } = await supabase
      .from("turquesa_inventory_items")
      .update({
        on_hand: nextOnHand,
        updated_by_email: actorEmail,
        updated_at: now,
      })
      .eq("restaurant_id", restaurantId)
      .eq("id", inventory.id);

    if (updateError) throw updateError;

    consumedLines.push({
      inventory_item_id: inventory.id,
      item_name: inventory.item_name,
      consumed_quantity: consumedQty,
      previous_on_hand: previousOnHand,
      next_on_hand: nextOnHand,
      shortage,
      unit: inventory.unit,
    });
  }

  if (consumedLines.length) {
    await supabase.from("turquesa_events").insert({
      restaurant_id: restaurantId,
      shift_id: shiftId,
      entity_type: "turquesa_kitchen_tickets",
      entity_id: ticket.id,
      event_type: "inventory_consumed_by_ticket",
      actor_email: actorEmail,
      description: `${ticket.ticket_number}: inventario descontado por ${consumedLines.length} insumo(s).`,
      payload: {
        ticket_number: ticket.ticket_number,
        consumed_items: consumedLines,
      },
    });
  }

  return consumedLines;
}

function consumptionMessage(lines: any[]) {
  if (!lines.length) return "";
  const visible = lines
    .slice(0, 3)
    .map((line) => `${line.item_name} -${quantityLabel(num(line.consumed_quantity))} ${line.unit || ""}`.trim())
    .join(", ");
  const extra = lines.length > 3 ? ` y ${lines.length - 3} mas` : "";
  const shortage = lines.some((line) => num(line.shortage) > 0) ? " Hay consumo sobre stock disponible." : "";
  return ` Inventario descontado: ${visible}${extra}.${shortage}`;
}

async function sendToKitchen(body: OperationBody, context: DbContext) {
  const tableLabel = clean(body?.tableLabel);
  const lines = Array.isArray(body?.items) ? (body.items as TurquesaOrderItem[]) : [];

  if (!tableLabel) return NextResponse.json({ ok: false, error: "Mesa requerida." }, { status: 400 });
  if (!lines.length) return NextResponse.json({ ok: false, error: "La comanda esta vacia." }, { status: 400 });

  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });
  const shift = await ensureOpenShift(context.supabase, restaurant.id, context.actorEmail);

  const { data: table, error: tableError } = await context.supabase
    .from("turquesa_tables")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .eq("code", tableLabel)
    .maybeSingle();

  if (tableError) throw tableError;
  if (!table) return NextResponse.json({ ok: false, error: "Mesa no encontrada." }, { status: 404 });
  const access = requireTableStaffAccess(body, table, "enviar a cocina");
  if (access.response) return access.response;
  const staff = access.staff as StaffAccessSession;
  const pax = normalizePax(body?.pax, Number(table.seats || 1));
  const guestNames = guestNamesFromBody(body, pax);
  const guestSummary = guestNames.join(", ");
  const guestNotes = guestSummary ? `Comensales: ${guestSummary}` : clean(body?.notes);

  let order: any = null;
  if (table.current_order_id) {
    const { data, error } = await context.supabase
      .from("turquesa_orders")
      .select("*")
      .eq("id", table.current_order_id)
      .in("status", ["open", "sent", "ready"])
      .maybeSingle();
    if (error) throw error;
    order = data;
  }

  if (!order) {
    const orderNumber = `TRQ-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${table.code}`;
    const { data, error } = await context.supabase
      .from("turquesa_orders")
      .insert({
        restaurant_id: restaurant.id,
        shift_id: shift.id,
        table_id: table.id,
        order_number: orderNumber,
        status: "open",
        server_name:
          staff.role === "supervisor"
            ? clean(body?.serverName) || table.current_server_name || staff.name
            : staff.name,
        guest_name: guestSummary || null,
        pax,
        notes: guestNotes || null,
        created_by_email: context.actorEmail,
      })
      .select("*")
      .single();
    if (error) throw error;
    order = data;
  }

  const orderGuestPatch: Record<string, unknown> = {
    pax,
    updated_at: new Date().toISOString(),
  };
  if (guestSummary) {
    orderGuestPatch.guest_name = guestSummary;
    orderGuestPatch.notes = guestNotes;
  }
  const { error: orderGuestError } = await context.supabase
    .from("turquesa_orders")
    .update(orderGuestPatch)
    .eq("id", order.id);

  if (orderGuestError) throw orderGuestError;
  order = { ...order, ...orderGuestPatch };

  const menuNames = lines.map((line) => clean(line.name)).filter(Boolean);
  const { data: menuRows, error: menuError } = await context.supabase
    .from("turquesa_menu_items")
    .select("id,name,station,price")
    .eq("restaurant_id", restaurant.id)
    .in("name", menuNames.length ? menuNames : [""]);

  if (menuError) throw menuError;
  const menuRowsData = (menuRows || []) as DbMenuRow[];
  const menuByName = new Map<string, DbMenuRow>(menuRowsData.map((item) => [item.name, item]));

  const itemRows = lines.map((line) => {
    const menuItem = menuByName.get(line.name);
    const qty = Math.max(1, Number(line.qty || 1));
    return {
      restaurant_id: restaurant.id,
      order_id: order.id,
      menu_item_id: menuItem?.id || null,
      item_name: line.name,
      station: menuItem?.station || line.station || "Mixta",
      quantity: qty,
      unit_price: num(menuItem?.price || line.price),
      status: "sent",
      notes: orderItemKitchenNote(line),
    };
  });

  const { data: insertedItems, error: itemsError } = await context.supabase
    .from("turquesa_order_items")
    .insert(itemRows)
    .select("*");

  if (itemsError) throw itemsError;
  await recalcOrderTotals(context.supabase, restaurant, order.id);

  const ticketNumber = `K-${String(Date.now()).slice(-6)}`;
  const stations = Array.from(new Set(itemRows.map((item) => item.station).filter(Boolean)));
  const { data: ticket, error: ticketError } = await context.supabase
    .from("turquesa_kitchen_tickets")
    .insert({
      restaurant_id: restaurant.id,
      shift_id: shift.id,
      order_id: order.id,
      table_id: table.id,
      ticket_number: ticketNumber,
      station: stations.length === 1 ? stations[0] : "Mixta",
      status: "new",
      server_name: order.server_name,
      notes: guestNotes || null,
    })
    .select("*")
    .single();

  if (ticketError) throw ticketError;

  const ticketItemRows = (insertedItems || []).map((item: any) => ({
    restaurant_id: restaurant.id,
    ticket_id: ticket.id,
    order_item_id: item.id,
    item_name: item.item_name,
    quantity: item.quantity,
    station: item.station,
    notes: item.notes,
  }));

  if (ticketItemRows.length) {
    const { error } = await context.supabase.from("turquesa_kitchen_ticket_items").insert(ticketItemRows);
    if (error) throw error;
  }

  let consumedLines: any[] = [];
  let consumptionWarning = "";
  try {
    consumedLines = await consumeInventoryForTicket(
      context.supabase,
      restaurant.id,
      shift.id,
      ticket,
      insertedItems || [],
      context.actorEmail
    );
  } catch (error) {
    consumptionWarning = ` Inventario automatico pendiente: ${publicErrorMessage(error)}.`;
  }

  const { error: tableUpdateError } = await context.supabase
    .from("turquesa_tables")
    .update({
      status: table.status === "free" || table.status === "reserved" ? "open" : table.status,
      current_order_id: order.id,
      current_server_name: order.server_name,
      current_started_at: table.current_started_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", table.id);

  if (tableUpdateError) throw tableUpdateError;

  return NextResponse.json({
    ok: true,
    message: `Comanda ${ticketNumber} enviada a cocina.${consumptionMessage(consumedLines)}${consumptionWarning}`,
    snapshot: await readSnapshot(context.supabase),
  });
}

async function advanceTicket(body: OperationBody, context: DbContext) {
  const ticketId = clean(body?.ticketId);
  if (!ticketId) return NextResponse.json({ ok: false, error: "Ticket requerido." }, { status: 400 });

  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });

  const { data: ticket, error } = await context.supabase
    .from("turquesa_kitchen_tickets")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .eq("ticket_number", ticketId)
    .maybeSingle();

  if (error) throw error;
  if (!ticket) return NextResponse.json({ ok: false, error: "Ticket no encontrado." }, { status: 404 });

  const nextStatus =
    ticket.status === "new" ? "cooking" :
    ticket.status === "cooking" ? "ready" :
    ticket.status === "ready" ? "served" :
    ticket.status;

  const patch: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };
  if (nextStatus === "cooking") patch.cooking_at = new Date().toISOString();
  if (nextStatus === "ready") patch.ready_at = new Date().toISOString();
  if (nextStatus === "served") patch.served_at = new Date().toISOString();

  const { error: updateError } = await context.supabase
    .from("turquesa_kitchen_tickets")
    .update(patch)
    .eq("id", ticket.id);

  if (updateError) throw updateError;

  return NextResponse.json({
    ok: true,
    message: `Ticket ${ticketId} actualizado.`,
    snapshot: await readSnapshot(context.supabase),
  });
}

async function createTakeoutSale(body: OperationBody, context: DbContext) {
  const method = normalizePaymentMethod(body?.method);
  const discountRate = normalizeDiscountRate(body?.discountRate);
  const lines = Array.isArray(body?.items) ? (body.items as TurquesaOrderItem[]) : [];

  if (!lines.length) return NextResponse.json({ ok: false, error: "La venta para llevar esta vacia." }, { status: 400 });

  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });
  const shift = await ensureOpenShift(context.supabase, restaurant.id, context.actorEmail);

  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const orderNumber = `TRQ-${timestamp}-LLEVAR`;
  const { data: order, error: orderError } = await context.supabase
    .from("turquesa_orders")
    .insert({
      restaurant_id: restaurant.id,
      shift_id: shift.id,
      table_id: null,
      order_number: orderNumber,
      order_type: "takeout",
      status: "open",
      guest_name: "Para llevar",
      pax: 1,
      server_name: "Caja rapida",
      notes: `Venta rapida para llevar sin 10% legal de servicio/propina.${discountMessage(discountRate, body?.discountLabel)}`,
      created_by_email: context.actorEmail,
    })
    .select("*")
    .single();

  if (orderError) throw orderError;

  const menuNames = lines.map((line) => clean(line.name)).filter(Boolean);
  const { data: menuRows, error: menuError } = await context.supabase
    .from("turquesa_menu_items")
    .select("id,name,station,price")
    .eq("restaurant_id", restaurant.id)
    .in("name", menuNames.length ? menuNames : [""]);

  if (menuError) throw menuError;
  const menuRowsData = (menuRows || []) as DbMenuRow[];
  const menuByName = new Map<string, DbMenuRow>(menuRowsData.map((item) => [item.name, item]));

  const itemRows = lines.map((line) => {
    const menuItem = menuByName.get(line.name);
    const qty = Math.max(1, Number(line.qty || 1));
    return {
      restaurant_id: restaurant.id,
      order_id: order.id,
      menu_item_id: menuItem?.id || null,
      item_name: line.name,
      station: menuItem?.station || line.station || "Mixta",
      quantity: qty,
      unit_price: num(menuItem?.price || line.price),
      status: "sent",
      notes: orderItemKitchenNote(line),
    };
  });

  const { data: insertedItems, error: itemsError } = await context.supabase
    .from("turquesa_order_items")
    .insert(itemRows)
    .select("*");

  if (itemsError) throw itemsError;

  const totals = await recalcOrderTotals(context.supabase, restaurant, order.id, {
    serviceChargeable: false,
    discountRate,
  });
  const amount = money(totals.total);
  if (amount <= 0) return NextResponse.json({ ok: false, error: "No hay balance pendiente para cobrar." }, { status: 400 });

  const ticketNumber = `K-${String(Date.now()).slice(-6)}`;
  const stations = Array.from(new Set(itemRows.map((item) => item.station).filter(Boolean)));
  const { data: ticket, error: ticketError } = await context.supabase
    .from("turquesa_kitchen_tickets")
    .insert({
      restaurant_id: restaurant.id,
      shift_id: shift.id,
      order_id: order.id,
      table_id: null,
      ticket_number: ticketNumber,
      station: stations.length === 1 ? stations[0] : "Mixta",
      status: "new",
      server_name: "Para llevar",
      notes: "Para llevar",
    })
    .select("*")
    .single();

  if (ticketError) throw ticketError;

  const ticketItemRows = (insertedItems || []).map((item: any) => ({
    restaurant_id: restaurant.id,
    ticket_id: ticket.id,
    order_item_id: item.id,
    item_name: item.item_name,
    quantity: item.quantity,
    station: item.station,
    notes: item.notes,
  }));

  if (ticketItemRows.length) {
    const { error } = await context.supabase.from("turquesa_kitchen_ticket_items").insert(ticketItemRows);
    if (error) throw error;
  }

  const now = new Date().toISOString();
  const { error: paymentError } = await context.supabase
    .from("turquesa_payments")
    .insert({
      restaurant_id: restaurant.id,
      shift_id: shift.id,
      order_id: order.id,
      method,
      amount,
      reference: "takeout-quick-sale",
      received_by_email: context.actorEmail,
    });

  if (paymentError) throw paymentError;

  const { error: orderUpdateError } = await context.supabase
    .from("turquesa_orders")
    .update({
      paid_total: amount,
      status: "paid",
      closed_at: now,
      updated_at: now,
    })
    .eq("id", order.id);

  if (orderUpdateError) throw orderUpdateError;

  const salesColumn = shiftSalesColumn(method);
  const nextMethodSales = money(num(shift?.[salesColumn]) + amount);
  const shiftPatch: Record<string, unknown> = {
    [salesColumn]: nextMethodSales,
    tax_total: money(num(shift?.tax_total) + totals.tax),
    service_charge_total: money(num(shift?.service_charge_total) + totals.service),
    updated_at: now,
  };
  if (method === "cash") {
    shiftPatch.expected_cash_drawer = money(num(shift?.opening_cash) + nextMethodSales);
  }

  const { error: shiftUpdateError } = await context.supabase
    .from("turquesa_shifts")
    .update(shiftPatch)
    .eq("id", shift.id);

  if (shiftUpdateError) throw shiftUpdateError;

  let consumedLines: any[] = [];
  let consumptionWarning = "";
  try {
    consumedLines = await consumeInventoryForTicket(
      context.supabase,
      restaurant.id,
      shift.id,
      ticket,
      insertedItems || [],
      context.actorEmail
    );
  } catch (error) {
    consumptionWarning = ` Inventario automatico pendiente: ${publicErrorMessage(error)}.`;
  }

  return NextResponse.json({
    ok: true,
    message: `Venta para llevar ${orderNumber} cobrada por ${paymentMethodLabel(method)} sin 10% legal.${discountMessage(discountRate, body?.discountLabel)} Ticket ${ticketNumber} enviado a cocina.${consumptionMessage(consumedLines)}${consumptionWarning}`,
    snapshot: await readSnapshot(context.supabase),
  });
}

async function createUninvoicedExpense(body: OperationBody, context: DbContext) {
  const amount = money(body?.amount);
  const description = clean(body?.description);
  const category = expenseCategoryConfig(body?.category);
  const method = normalizeExpenseMethod(body?.method);
  const responsible = clean(body?.responsible) || "Caja";
  const note = clean(body?.note);

  if (!description) return NextResponse.json({ ok: false, error: "Descripcion del gasto requerida." }, { status: 400 });
  if (amount <= 0) return NextResponse.json({ ok: false, error: "Monto del gasto requerido." }, { status: 400 });

  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });
  const shift = await ensureOpenShift(context.supabase, restaurant.id, context.actorEmail);
  const credit = expenseCreditAccount(method);
  const now = new Date().toISOString();
  const expenseCode = `GSF-${now.slice(0, 10).replace(/\D/g, "")}-${String(Date.now()).slice(-5)}`;
  const metadata = {
    expense_code: expenseCode,
    category: clean(body?.category) || "otros",
    category_label: category.label,
    description,
    method,
    responsible,
    note,
    no_invoice: true,
    created_by: context.actorEmail,
  };

  const { error: entriesError } = await context.supabase.from("turquesa_accounting_entries").insert([
    {
      restaurant_id: restaurant.id,
      shift_id: shift.id,
      entry_date: now.slice(0, 10),
      account_code: category.accountCode,
      account_name: category.accountName,
      debit: amount,
      credit: 0,
      reference_type: "uninvoiced_expense",
      reference_id: shift.id,
      memo: description,
      status: "posted",
      metadata: { ...metadata, line: "expense" },
    },
    {
      restaurant_id: restaurant.id,
      shift_id: shift.id,
      entry_date: now.slice(0, 10),
      account_code: credit.accountCode,
      account_name: credit.accountName,
      debit: 0,
      credit: amount,
      reference_type: "uninvoiced_expense",
      reference_id: shift.id,
      memo: `Pago ${description}`,
      status: "posted",
      metadata: { ...metadata, line: "offset" },
    },
  ]);

  if (entriesError) throw entriesError;

  if (method === "cash") {
    const expectedCashDrawer = money(num(shift.expected_cash_drawer || num(shift.opening_cash) + num(shift.cash_sales)) - amount);
    const { error: shiftError } = await context.supabase
      .from("turquesa_shifts")
      .update({ expected_cash_drawer: expectedCashDrawer, updated_at: now })
      .eq("id", shift.id);

    if (shiftError) throw shiftError;
  }

  await context.supabase.from("turquesa_events").insert({
    restaurant_id: restaurant.id,
    shift_id: shift.id,
    entity_type: "turquesa_accounting_entries",
    entity_id: shift.id,
    event_type: "uninvoiced_expense_created",
    actor_email: context.actorEmail,
    description: `${expenseCode}: ${description} registrado sin factura por ${amount}.`,
    payload: metadata,
  });

  return NextResponse.json({
    ok: true,
    message: `${expenseCode} registrado: ${description} por ${money(amount)} via ${expenseMethodLabel(method)} sin factura.`,
    snapshot: await readSnapshot(context.supabase),
  });
}

async function closeOrder(body: OperationBody, context: DbContext) {
  const tableLabel = clean(body?.tableLabel);
  const method = normalizePaymentMethod(body?.method);
  const requestedAmount = num(body?.amount);
  const discountRate = normalizeDiscountRate(body?.discountRate);

  if (!tableLabel) return NextResponse.json({ ok: false, error: "Mesa requerida." }, { status: 400 });

  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });
  const openShift = await ensureOpenShift(context.supabase, restaurant.id, context.actorEmail);

  const { data: table, error: tableError } = await context.supabase
    .from("turquesa_tables")
    .select("id,code,status,current_order_id,current_server_name")
    .eq("restaurant_id", restaurant.id)
    .eq("code", tableLabel)
    .maybeSingle();

  if (tableError) throw tableError;
  if (!table) return NextResponse.json({ ok: false, error: "Mesa no encontrada." }, { status: 404 });
  if (!table.current_order_id) return NextResponse.json({ ok: false, error: "La mesa no tiene una orden abierta." }, { status: 400 });
  const access = requireTableStaffAccess(body, table, "cobrar");
  if (access.response) return access.response;

  const { data: order, error: orderError } = await context.supabase
    .from("turquesa_orders")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .eq("id", table.current_order_id)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 });
  if (order.status === "paid") return NextResponse.json({ ok: false, error: "La orden ya esta pagada." }, { status: 400 });

  const totals = await recalcOrderTotals(context.supabase, restaurant, order.id, { discountRate });
  const previousPaid = num(order.paid_total);
  const due = Math.max(0, totals.total - previousPaid);
  const amount = requestedAmount > 0 ? Math.min(requestedAmount, due || requestedAmount) : due;

  if (amount <= 0) return NextResponse.json({ ok: false, error: "No hay balance pendiente para cobrar." }, { status: 400 });

  const shiftId = order.shift_id || openShift.id;
  const { data: shift, error: shiftError } = await context.supabase
    .from("turquesa_shifts")
    .select("*")
    .eq("id", shiftId)
    .maybeSingle();

  if (shiftError) throw shiftError;

  const { error: paymentError } = await context.supabase
    .from("turquesa_payments")
    .insert({
      restaurant_id: restaurant.id,
      shift_id: shiftId,
      order_id: order.id,
      method,
      amount,
      received_by_email: context.actorEmail,
    });

  if (paymentError) throw paymentError;

  const paidTotal = previousPaid + amount;
  const fullyPaid = paidTotal + 0.01 >= totals.total;
  const now = new Date().toISOString();

  const { error: orderUpdateError } = await context.supabase
    .from("turquesa_orders")
    .update({
      paid_total: paidTotal,
      status: fullyPaid ? "paid" : order.status,
      closed_at: fullyPaid ? now : order.closed_at,
      updated_at: now,
    })
    .eq("id", order.id);

  if (orderUpdateError) throw orderUpdateError;

  const salesColumn = shiftSalesColumn(method);
  const shiftPatch: Record<string, unknown> = {
    [salesColumn]: num(shift?.[salesColumn]) + amount,
    updated_at: now,
  };

  const { error: shiftUpdateError } = await context.supabase
    .from("turquesa_shifts")
    .update(shiftPatch)
    .eq("id", shiftId);

  if (shiftUpdateError) throw shiftUpdateError;

  if (fullyPaid) {
    const [{ error: tableUpdateError }, { error: itemsUpdateError }, { error: ticketUpdateError }] = await Promise.all([
      context.supabase
        .from("turquesa_tables")
        .update({
          status: "free",
          current_order_id: null,
          current_server_name: "Libre",
          current_started_at: null,
          updated_at: now,
        })
        .eq("id", table.id),
      context.supabase
        .from("turquesa_order_items")
        .update({ status: "served", updated_at: now })
        .eq("order_id", order.id)
        .neq("status", "void"),
      context.supabase
        .from("turquesa_kitchen_tickets")
        .update({ status: "served", served_at: now, updated_at: now })
        .eq("order_id", order.id)
        .in("status", ["new", "cooking", "ready"]),
    ]);

    if (tableUpdateError) throw tableUpdateError;
    if (itemsUpdateError) throw itemsUpdateError;
    if (ticketUpdateError) throw ticketUpdateError;
  }

  return NextResponse.json({
    ok: true,
    message: fullyPaid
      ? `Pago por ${paymentMethodLabel(method)} registrado.${discountMessage(discountRate, body?.discountLabel)} Mesa ${table.code} liberada.`
      : `Pago parcial por ${paymentMethodLabel(method)} registrado en ${table.code}.${discountMessage(discountRate, body?.discountLabel)}`,
    snapshot: await readSnapshot(context.supabase),
  });
}

async function createReservation(body: OperationBody, context: DbContext) {
  const guestName = clean(body?.guestName);
  const pax = Math.max(1, Math.min(50, Number(body?.pax || 2)));
  const note = clean(body?.note);
  const phone = clean(body?.phone);
  const email = clean(body?.email);
  const tableLabel = clean(body?.tableLabel);
  const reservationAt = reservationIso(body?.date, body?.time);

  if (!guestName) return NextResponse.json({ ok: false, error: "Nombre de reserva requerido." }, { status: 400 });

  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });

  let tableId = null;
  if (tableLabel) {
    const { data: table, error: tableError } = await context.supabase
      .from("turquesa_tables")
      .select("id")
      .eq("restaurant_id", restaurant.id)
      .eq("code", tableLabel)
      .maybeSingle();
    if (tableError) throw tableError;
    tableId = table?.id || null;
  }

  const { error } = await context.supabase
    .from("turquesa_reservations")
    .insert({
      restaurant_id: restaurant.id,
      table_id: tableId,
      reservation_at: reservationAt,
      guest_name: guestName,
      phone: phone || null,
      email: email || null,
      pax,
      source: clean(body?.source) || "Turquesa OS",
      status: "confirmed",
      note: note || null,
    });

  if (error) throw error;

  return NextResponse.json({
    ok: true,
    message: `Reserva creada para ${guestName}.`,
    snapshot: await readSnapshot(context.supabase),
  });
}

async function updateReservationStatus(body: OperationBody, context: DbContext) {
  const reservationId = clean(body?.reservationId);
  const status = normalizeReservationStatus(body?.status);
  const note = clean(body?.note);

  if (!reservationId) return NextResponse.json({ ok: false, error: "Reserva requerida." }, { status: 400 });

  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (note) patch.note = note;

  const { data: reservation, error } = await context.supabase
    .from("turquesa_reservations")
    .update(patch)
    .eq("restaurant_id", restaurant.id)
    .eq("id", reservationId)
    .select("guest_name")
    .maybeSingle();

  if (error) throw error;
  if (!reservation) return NextResponse.json({ ok: false, error: "Reserva no encontrada." }, { status: 404 });

  const label =
    status === "confirmed"
      ? "confirmada"
      : status === "cancelled"
        ? "marcada sin disponibilidad"
        : status === "seated"
          ? "sentada"
          : status === "no_show"
            ? "marcada no-show"
            : "pendiente";

  return NextResponse.json({
    ok: true,
    message: `Reserva de ${reservation.guest_name} ${label}.`,
    snapshot: await readSnapshot(context.supabase),
  });
}

async function recordSpoilage(body: OperationBody, context: DbContext) {
  const sourceType = normalizeSpoilageSourceType(body?.sourceType);
  const itemName = clean(body?.itemName);
  const menuItemName = clean(body?.menuItemName || body?.itemName);
  const requestedQty = quantity(body?.quantity);
  const reasonKey = normalizeSpoilageReason(body?.reason);
  const reasonLabel = spoilageReasonLabels[reasonKey];
  const responsible = clean(body?.responsible) || context.actorEmail || "Equipo";
  const note = clean(body?.note);

  if (requestedQty <= 0) return NextResponse.json({ ok: false, error: "Cantidad de decomiso requerida." }, { status: 400 });
  if (sourceType === "inventory" && !itemName) {
    return NextResponse.json({ ok: false, error: "Materia prima requerida para decomiso." }, { status: 400 });
  }
  if (sourceType === "menu_item" && !menuItemName) {
    return NextResponse.json({ ok: false, error: "Plato requerido para decomiso." }, { status: 400 });
  }

  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });
  const shift = await getOpenShift(context.supabase, restaurant.id);
  const now = new Date().toISOString();
  const spoilageCode = `DEC-${now.slice(0, 10).replace(/\D/g, "")}-${String(Date.now()).slice(-5)}`;

  let entityType = "turquesa_inventory_items";
  let entityId = "";
  let displayItem = itemName;
  let unit = "u";
  const affectedLines: Array<{
    inventory: any;
    quantity: number;
    previousOnHand: number;
    nextOnHand: number;
    unit: string;
    cost: number;
  }> = [];

  if (sourceType === "inventory") {
    const { data: item, error: itemError } = await context.supabase
      .from("turquesa_inventory_items")
      .select("id,item_name,on_hand,unit,avg_cost")
      .eq("restaurant_id", restaurant.id)
      .eq("item_name", itemName)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!item) return NextResponse.json({ ok: false, error: "Materia prima no encontrada." }, { status: 404 });

    const previousOnHand = quantity(item.on_hand);
    if (requestedQty > previousOnHand) {
      return NextResponse.json(
        { ok: false, error: `${item.item_name} solo tiene ${quantityLabel(previousOnHand)} ${item.unit || "u"} disponible.` },
        { status: 409 }
      );
    }

    entityId = item.id;
    displayItem = item.item_name;
    unit = item.unit || "u";
    affectedLines.push({
      inventory: item,
      quantity: requestedQty,
      previousOnHand,
      nextOnHand: quantity(previousOnHand - requestedQty),
      unit,
      cost: money(requestedQty * num(item.avg_cost)),
    });
  } else {
    const { data: menuItem, error: menuError } = await context.supabase
      .from("turquesa_menu_items")
      .select("id,name")
      .eq("restaurant_id", restaurant.id)
      .eq("name", menuItemName)
      .maybeSingle();

    if (menuError) throw menuError;
    if (!menuItem) return NextResponse.json({ ok: false, error: "Plato no encontrado en el menu." }, { status: 404 });

    const { data: recipes, error: recipeError } = await context.supabase
      .from("turquesa_recipe_ingredients")
      .select("inventory_item_id,quantity,unit")
      .eq("restaurant_id", restaurant.id)
      .eq("menu_item_id", menuItem.id)
      .eq("is_active", true);

    if (recipeError) throw recipeError;
    if (!recipes?.length) {
      return NextResponse.json({ ok: false, error: "Ese plato no tiene receta enlazada para descontar inventario." }, { status: 409 });
    }

    const inventoryIds = Array.from(new Set((recipes || []).map((recipe: any) => clean(recipe.inventory_item_id)).filter(Boolean)));
    const { data: inventoryRows, error: inventoryError } = await context.supabase
      .from("turquesa_inventory_items")
      .select("id,item_name,on_hand,unit,avg_cost")
      .eq("restaurant_id", restaurant.id)
      .in("id", inventoryIds);

    if (inventoryError) throw inventoryError;
    const inventoryById = new Map<string, any>((inventoryRows || []).map((item: any) => [item.id, item]));

    entityType = "turquesa_menu_items";
    entityId = menuItem.id;
    displayItem = menuItem.name;
    unit = "plato";

    for (const recipe of recipes || []) {
      const inventory = inventoryById.get(recipe.inventory_item_id);
      if (!inventory) {
        return NextResponse.json({ ok: false, error: "Receta con inventario incompleto." }, { status: 409 });
      }
      const lineQty = quantity(num(recipe.quantity) * requestedQty);
      const previousOnHand = quantity(inventory.on_hand);
      if (lineQty > previousOnHand) {
        return NextResponse.json(
          { ok: false, error: `${inventory.item_name} solo tiene ${quantityLabel(previousOnHand)} ${inventory.unit || recipe.unit || "u"} disponible.` },
          { status: 409 }
        );
      }
      affectedLines.push({
        inventory,
        quantity: lineQty,
        previousOnHand,
        nextOnHand: quantity(previousOnHand - lineQty),
        unit: inventory.unit || recipe.unit || "u",
        cost: money(lineQty * num(inventory.avg_cost)),
      });
    }
  }

  for (const line of affectedLines) {
    const { error: updateError } = await context.supabase
      .from("turquesa_inventory_items")
      .update({
        on_hand: line.nextOnHand,
        updated_by_email: context.actorEmail,
        updated_at: now,
      })
      .eq("restaurant_id", restaurant.id)
      .eq("id", line.inventory.id);

    if (updateError) throw updateError;
  }

  const totalCost = money(affectedLines.reduce((sum, line) => sum + line.cost, 0));
  const payload = {
    spoilage_code: spoilageCode,
    source_type: sourceType,
    item_name: displayItem,
    menu_item_name: sourceType === "menu_item" ? displayItem : null,
    quantity: requestedQty,
    unit,
    reason_key: reasonKey,
    reason_label: reasonLabel,
    responsible,
    note,
    total_cost: totalCost,
    affected_items: affectedLines.map((line) => ({
      inventory_item_id: line.inventory.id,
      item_name: line.inventory.item_name,
      quantity: line.quantity,
      unit: line.unit,
      previous_on_hand: line.previousOnHand,
      next_on_hand: line.nextOnHand,
      cost: line.cost,
    })),
  };

  const { data: event, error: eventError } = await context.supabase
    .from("turquesa_events")
    .insert({
      restaurant_id: restaurant.id,
      shift_id: shift?.id || null,
      entity_type: entityType,
      entity_id: entityId || null,
      event_type: "inventory_spoilage_recorded",
      actor_email: context.actorEmail,
      description: `${spoilageCode}: ${displayItem} dado de baja por ${reasonLabel}.`,
      payload,
    })
    .select("id")
    .single();

  if (eventError) throw eventError;

  if (totalCost > 0) {
    const { error: entriesError } = await context.supabase.from("turquesa_accounting_entries").insert([
      {
        restaurant_id: restaurant.id,
        shift_id: shift?.id || null,
        entry_date: now.slice(0, 10),
        account_code: "6120",
        account_name: "Decomisos y mermas de inventario",
        debit: totalCost,
        credit: 0,
        reference_type: "inventory_spoilage",
        reference_id: event.id,
        memo: `${spoilageCode}: ${displayItem}`,
        status: "posted",
        metadata: { ...payload, line: "spoilage_expense" },
      },
      {
        restaurant_id: restaurant.id,
        shift_id: shift?.id || null,
        entry_date: now.slice(0, 10),
        account_code: "1300",
        account_name: "Inventario cocina y bar",
        debit: 0,
        credit: totalCost,
        reference_type: "inventory_spoilage",
        reference_id: event.id,
        memo: `${spoilageCode}: baja de inventario`,
        status: "posted",
        metadata: { ...payload, line: "inventory_offset" },
      },
    ]);

    if (entriesError) throw entriesError;
  }

  return NextResponse.json({
    ok: true,
    message: `${spoilageCode}: decomiso registrado. ${displayItem} -${quantityLabel(requestedQty)} ${unit}. Costo estimado RD$${totalCost.toLocaleString("es-DO")}.`,
    snapshot: await readSnapshot(context.supabase),
  });
}

async function adjustInventory(body: OperationBody, context: DbContext) {
  const itemName = clean(body?.itemName);
  const delta = Number(body?.delta || 0);
  const reason = clean(body?.reason) || "Ajuste rapido";

  if (!itemName) return NextResponse.json({ ok: false, error: "Item de inventario requerido." }, { status: 400 });
  if (!Number.isFinite(delta) || delta === 0) return NextResponse.json({ ok: false, error: "Cantidad de ajuste invalida." }, { status: 400 });

  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });

  const { data: item, error: itemError } = await context.supabase
    .from("turquesa_inventory_items")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .eq("item_name", itemName)
    .maybeSingle();

  if (itemError) throw itemError;
  if (!item) return NextResponse.json({ ok: false, error: "Item de inventario no encontrado." }, { status: 404 });

  const nextOnHand = Math.max(0, Math.round((num(item.on_hand) + delta) * 1000) / 1000);
  const now = new Date().toISOString();

  const { error: updateError } = await context.supabase
    .from("turquesa_inventory_items")
    .update({
      on_hand: nextOnHand,
      updated_by_email: context.actorEmail,
      updated_at: now,
    })
    .eq("id", item.id);

  if (updateError) throw updateError;

  await context.supabase.from("turquesa_events").insert({
    restaurant_id: restaurant.id,
    entity_type: "turquesa_inventory_items",
    entity_id: item.id,
    event_type: "inventory_adjusted",
    actor_email: context.actorEmail,
    description: `${itemName}: ajuste ${delta > 0 ? "+" : ""}${delta}. ${reason}`,
    payload: {
      item_name: itemName,
      previous_on_hand: num(item.on_hand),
      next_on_hand: nextOnHand,
      delta,
      reason,
    },
  });

  return NextResponse.json({
    ok: true,
    message: `${itemName} ajustado a ${nextOnHand} ${item.unit || ""}.`.trim(),
    snapshot: await readSnapshot(context.supabase),
  });
}

async function updateInventoryCost(body: OperationBody, context: DbContext) {
  const itemName = clean(body?.itemName);
  const avgCost = money(body?.avgCost);
  const supplier = clean(body?.supplier) || "Proveedor por definir";

  if (!itemName) return NextResponse.json({ ok: false, error: "Item de inventario requerido." }, { status: 400 });
  if (!Number.isFinite(avgCost) || avgCost < 0) return NextResponse.json({ ok: false, error: "Costo promedio invalido." }, { status: 400 });

  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });

  const { data: item, error: itemError } = await context.supabase
    .from("turquesa_inventory_items")
    .select("id,item_name,unit,avg_cost,supplier")
    .eq("restaurant_id", restaurant.id)
    .eq("item_name", itemName)
    .maybeSingle();

  if (itemError) throw itemError;
  if (!item) return NextResponse.json({ ok: false, error: "Item de inventario no encontrado." }, { status: 404 });

  const now = new Date().toISOString();
  const { error: updateError } = await context.supabase
    .from("turquesa_inventory_items")
    .update({
      avg_cost: avgCost,
      supplier,
      updated_by_email: context.actorEmail,
      updated_at: now,
    })
    .eq("id", item.id);

  if (updateError) throw updateError;

  await context.supabase.from("turquesa_events").insert({
    restaurant_id: restaurant.id,
    entity_type: "turquesa_inventory_items",
    entity_id: item.id,
    event_type: "inventory_cost_updated",
    actor_email: context.actorEmail,
    description: `${itemName}: costo promedio actualizado a ${avgCost}.`,
    payload: {
      item_name: itemName,
      previous_avg_cost: num(item.avg_cost),
      next_avg_cost: avgCost,
      previous_supplier: item.supplier || null,
      next_supplier: supplier,
    },
  });

  return NextResponse.json({
    ok: true,
    message: `Costo ${itemName} actualizado a ${avgCost} por ${item.unit || "u"}.`,
    snapshot: await readSnapshot(context.supabase),
  });
}

async function createPurchaseRequest(body: OperationBody, context: DbContext) {
  const reason = clean(body?.reason) || "Compra sugerida desde inventario bajo";
  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });

  const { data: inventoryRows, error: inventoryError } = await context.supabase
    .from("turquesa_inventory_items")
    .select("id,item_name,unit,on_hand,minimum_stock,reorder_stock,avg_cost,supplier")
    .eq("restaurant_id", restaurant.id)
    .eq("is_active", true)
    .order("item_name", { ascending: true });

  if (inventoryError) throw inventoryError;

  const suggestedItems = (inventoryRows || [])
    .map((item: any) => {
      const onHand = num(item.on_hand);
      const min = num(item.minimum_stock);
      const reorder = num(item.reorder_stock) || min * 2;
      const shouldBuy = onHand < min || (reorder > 0 && onHand <= reorder);
      const qty = Math.max(0, Math.ceil(Math.max(reorder - onHand, min - onHand, 0)));
      const estimatedCost = money(qty * num(item.avg_cost));

      return {
        item,
        shouldBuy,
        qty,
        estimatedCost,
      };
    })
    .filter((row: any) => row.shouldBuy && row.qty > 0);

  if (!suggestedItems.length) {
    return NextResponse.json({ ok: false, error: "Inventario estable. No hay compra sugerida." }, { status: 400 });
  }

  const shift = await getOpenShift(context.supabase, restaurant.id);
  const requestCode = `COMP-${new Date().toISOString().replace(/\D/g, "").slice(2, 12)}-${String(Date.now()).slice(-4)}`;
  const totalEstimated = money(suggestedItems.reduce((sum: number, row: any) => sum + row.estimatedCost, 0));
  const priority = suggestedItems.some((row: any) => num(row.item.on_hand) < num(row.item.minimum_stock)) ? "urgent" : "normal";

  const { data: purchaseRequest, error: requestError } = await context.supabase
    .from("turquesa_purchase_requests")
    .insert({
      restaurant_id: restaurant.id,
      shift_id: shift?.id || null,
      request_code: requestCode,
      status: "draft",
      priority,
      reason,
      total_estimated: totalEstimated,
      requested_by_email: context.actorEmail,
    })
    .select("*")
    .single();

  if (requestError) throw requestError;

  const itemRows = suggestedItems.map((row: any) => ({
    restaurant_id: restaurant.id,
    purchase_request_id: purchaseRequest.id,
    inventory_item_id: row.item.id,
    item_name: row.item.item_name,
    quantity: row.qty,
    unit: row.item.unit || "u",
    supplier: row.item.supplier || "Proveedor por definir",
    estimated_unit_cost: num(row.item.avg_cost),
    estimated_cost: row.estimatedCost,
    notes: num(row.item.on_hand) < num(row.item.minimum_stock) ? "Stock critico" : "Reposicion sugerida",
  }));

  const { error: itemsError } = await context.supabase.from("turquesa_purchase_request_items").insert(itemRows);
  if (itemsError) throw itemsError;

  await context.supabase.from("turquesa_events").insert({
    restaurant_id: restaurant.id,
    shift_id: shift?.id || null,
    entity_type: "turquesa_purchase_requests",
    entity_id: purchaseRequest.id,
    event_type: "purchase_request_created",
    actor_email: context.actorEmail,
    description: `${requestCode}: compra sugerida por ${itemRows.length} item(s).`,
    payload: {
      request_code: requestCode,
      priority,
      reason,
      total_estimated: totalEstimated,
      items: itemRows.map((item: any) => ({
        item_name: item.item_name,
        quantity: item.quantity,
        unit: item.unit,
        supplier: item.supplier,
        estimated_cost: item.estimated_cost,
      })),
    },
  });

  return NextResponse.json({
    ok: true,
    message: `${requestCode} preparada con ${itemRows.length} item(s).`,
    snapshot: await readSnapshot(context.supabase),
  });
}

async function updateRecipeIngredient(body: OperationBody, context: DbContext) {
  const recipeId = clean(body?.recipeId);
  const menuItemName = clean(body?.menuItemName);
  const ingredientName = clean(body?.ingredientName);
  const nextQuantity = quantity(body?.quantity);

  if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
    return NextResponse.json({ ok: false, error: "Cantidad de receta invalida." }, { status: 400 });
  }

  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });

  let recipe: any = null;
  const shouldUseId = recipeId && !recipeId.startsWith("REC-DEMO-") && /^[0-9a-f-]{32,36}$/i.test(recipeId);

  if (shouldUseId) {
    const { data, error } = await context.supabase
      .from("turquesa_recipe_ingredients")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("id", recipeId)
      .maybeSingle();

    if (error) throw error;
    recipe = data;
  }

  if (!recipe && menuItemName && ingredientName) {
    const [menuResult, inventoryResult] = await Promise.all([
      context.supabase
        .from("turquesa_menu_items")
        .select("id,name")
        .eq("restaurant_id", restaurant.id)
        .eq("name", menuItemName)
        .maybeSingle(),
      context.supabase
        .from("turquesa_inventory_items")
        .select("id,item_name,unit")
        .eq("restaurant_id", restaurant.id)
        .eq("item_name", ingredientName)
        .maybeSingle(),
    ]);

    if (menuResult.error) throw menuResult.error;
    if (inventoryResult.error) throw inventoryResult.error;
    if (!menuResult.data || !inventoryResult.data) {
      return NextResponse.json({ ok: false, error: "Menu o insumo de receta no encontrado." }, { status: 404 });
    }

    const { data, error } = await context.supabase
      .from("turquesa_recipe_ingredients")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("menu_item_id", menuResult.data.id)
      .eq("inventory_item_id", inventoryResult.data.id)
      .maybeSingle();

    if (error) throw error;
    recipe = data;
  }

  if (!recipe) return NextResponse.json({ ok: false, error: "Receta no encontrada." }, { status: 404 });

  const previousQuantity = quantity(recipe.quantity);
  const now = new Date().toISOString();
  const { error: updateError } = await context.supabase
    .from("turquesa_recipe_ingredients")
    .update({
      quantity: nextQuantity,
      updated_at: now,
    })
    .eq("restaurant_id", restaurant.id)
    .eq("id", recipe.id);

  if (updateError) throw updateError;

  await context.supabase.from("turquesa_events").insert({
    restaurant_id: restaurant.id,
    entity_type: "turquesa_recipe_ingredients",
    entity_id: recipe.id,
    event_type: "recipe_ingredient_updated",
    actor_email: context.actorEmail,
    description: `${menuItemName || "Receta"} / ${ingredientName || "Insumo"} ajustado a ${quantityLabel(nextQuantity)} ${recipe.unit || ""}.`.trim(),
    payload: {
      recipe_id: recipe.id,
      menu_item_name: menuItemName,
      ingredient_name: ingredientName,
      previous_quantity: previousQuantity,
      next_quantity: nextQuantity,
      unit: recipe.unit,
    },
  });

  return NextResponse.json({
    ok: true,
    message: `Receta ${menuItemName || ""} actualizada a ${quantityLabel(nextQuantity)} ${recipe.unit || ""}.`.trim(),
    snapshot: await readSnapshot(context.supabase),
  });
}

async function receivePurchaseRequest(body: OperationBody, context: DbContext) {
  const requestId = clean(body?.requestId);
  const requestCode = clean(body?.requestCode);
  const notes = clean(body?.notes);

  if (!requestId && !requestCode) {
    return NextResponse.json({ ok: false, error: "Solicitud de compra requerida." }, { status: 400 });
  }

  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });

  const shouldUseId = requestId && !requestId.startsWith("local-") && /^[0-9a-f-]{32,36}$/i.test(requestId);
  let requestQuery = context.supabase
    .from("turquesa_purchase_requests")
    .select("*")
    .eq("restaurant_id", restaurant.id);

  requestQuery = shouldUseId ? requestQuery.eq("id", requestId) : requestQuery.eq("request_code", requestCode);

  const { data: purchaseRequest, error: requestError } = await requestQuery.maybeSingle();
  if (requestError) throw requestError;
  if (!purchaseRequest) return NextResponse.json({ ok: false, error: "Solicitud de compra no encontrada." }, { status: 404 });
  if (purchaseRequest.status === "received") {
    return NextResponse.json({ ok: false, error: `${purchaseRequest.request_code} ya fue recibida.` }, { status: 409 });
  }
  if (purchaseRequest.status === "cancelled") {
    return NextResponse.json({ ok: false, error: `${purchaseRequest.request_code} esta cancelada.` }, { status: 409 });
  }

  const { data: requestItems, error: itemsError } = await context.supabase
    .from("turquesa_purchase_request_items")
    .select("id,inventory_item_id,item_name,quantity,unit,received_quantity")
    .eq("restaurant_id", restaurant.id)
    .eq("purchase_request_id", purchaseRequest.id)
    .order("created_at", { ascending: true });

  if (itemsError) throw itemsError;
  if (!requestItems?.length) {
    return NextResponse.json({ ok: false, error: "La solicitud no tiene items para recibir." }, { status: 400 });
  }

  const inventoryIds = Array.from(new Set(requestItems.map((item: any) => clean(item.inventory_item_id)).filter(Boolean)));
  const inventoryNames = Array.from(new Set(requestItems.map((item: any) => clean(item.item_name)).filter(Boolean)));
  const [inventoryByIdResult, inventoryByNameResult] = await Promise.all([
    inventoryIds.length
      ? context.supabase
          .from("turquesa_inventory_items")
          .select("id,item_name,on_hand,unit")
          .eq("restaurant_id", restaurant.id)
          .in("id", inventoryIds)
      : Promise.resolve({ data: [], error: null }),
    inventoryNames.length
      ? context.supabase
          .from("turquesa_inventory_items")
          .select("id,item_name,on_hand,unit")
          .eq("restaurant_id", restaurant.id)
          .in("item_name", inventoryNames)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (inventoryByIdResult.error) throw inventoryByIdResult.error;
  if (inventoryByNameResult.error) throw inventoryByNameResult.error;

  const inventoryById = new Map<string, any>((inventoryByIdResult.data || []).map((item: any) => [item.id, item]));
  const inventoryByName = new Map<string, any>(
    (inventoryByNameResult.data || []).map((item: any) => [String(item.item_name || "").toLowerCase(), item])
  );
  const receipts = new Map<string, { inventory: any; quantity: number; lines: any[] }>();

  for (const item of requestItems) {
    const inventoryItem =
      (item.inventory_item_id ? inventoryById.get(item.inventory_item_id) : null) ||
      inventoryByName.get(String(item.item_name || "").toLowerCase());

    if (!inventoryItem) {
      return NextResponse.json({ ok: false, error: `Inventario no encontrado para ${item.item_name}.` }, { status: 409 });
    }

    const current = receipts.get(inventoryItem.id) || { inventory: inventoryItem, quantity: 0, lines: [] };
    current.quantity += num(item.quantity);
    current.lines.push(item);
    receipts.set(inventoryItem.id, current);
  }

  const now = new Date().toISOString();
  const receivedItems: any[] = [];

  for (const receipt of receipts.values()) {
    const nextOnHand = Math.max(0, Math.round((num(receipt.inventory.on_hand) + receipt.quantity) * 1000) / 1000);
    const { error: inventoryError } = await context.supabase
      .from("turquesa_inventory_items")
      .update({
        on_hand: nextOnHand,
        updated_by_email: context.actorEmail,
        updated_at: now,
      })
      .eq("restaurant_id", restaurant.id)
      .eq("id", receipt.inventory.id);

    if (inventoryError) throw inventoryError;

    receivedItems.push({
      item_name: receipt.inventory.item_name,
      quantity: receipt.quantity,
      previous_on_hand: num(receipt.inventory.on_hand),
      next_on_hand: nextOnHand,
      unit: receipt.inventory.unit,
    });
  }

  for (const item of requestItems) {
    const { error: itemUpdateError } = await context.supabase
      .from("turquesa_purchase_request_items")
      .update({
        received_quantity: num(item.quantity),
        updated_at: now,
      })
      .eq("id", item.id);

    if (itemUpdateError) throw itemUpdateError;
  }

  const { error: requestUpdateError } = await context.supabase
    .from("turquesa_purchase_requests")
    .update({
      status: "received",
      received_at: now,
      notes: notes || purchaseRequest.notes,
      updated_at: now,
    })
    .eq("id", purchaseRequest.id);

  if (requestUpdateError) throw requestUpdateError;

  await context.supabase.from("turquesa_events").insert({
    restaurant_id: restaurant.id,
    shift_id: purchaseRequest.shift_id || null,
    entity_type: "turquesa_purchase_requests",
    entity_id: purchaseRequest.id,
    event_type: "purchase_request_received",
    actor_email: context.actorEmail,
    description: `${purchaseRequest.request_code}: compra recibida e inventario actualizado.`,
    payload: {
      request_code: purchaseRequest.request_code,
      notes,
      received_items: receivedItems,
    },
  });

  return NextResponse.json({
    ok: true,
    message: `${purchaseRequest.request_code} recibida. Inventario actualizado.`,
    snapshot: await readSnapshot(context.supabase),
  });
}

async function updateWifiLead(body: OperationBody, context: DbContext) {
  const fullName = clean(body?.fullName);
  const status = normalizeWifiLeadStatus(body?.status);

  if (!fullName) return NextResponse.json({ ok: false, error: "Cliente Wi-Fi requerido." }, { status: 400 });

  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });

  const { data, error } = await context.supabase
    .from("turquesa_wifi_leads")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("restaurant_id", restaurant.id)
    .eq("full_name", fullName)
    .select("id")
    .limit(1);

  if (error) throw error;
  if (!data?.length) return NextResponse.json({ ok: false, error: "Cliente Wi-Fi no encontrado." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    message: `${fullName} marcado como ${status}.`,
    snapshot: await readSnapshot(context.supabase),
  });
}

async function closeShift(body: OperationBody, context: DbContext) {
  const countedCash = money(body?.countedCash);
  const notes = clean(body?.notes);

  if (!Number.isFinite(countedCash) || countedCash < 0) {
    return NextResponse.json({ ok: false, error: "Efectivo contado invalido." }, { status: 400 });
  }

  const restaurant = await getRestaurant(context.supabase);
  if (!restaurant) return NextResponse.json({ ok: false, error: "Ejecuta primero scripts/turquesa-restaurant-core.sql." }, { status: 503 });

  const shift = await getOpenShift(context.supabase, restaurant.id);
  if (!shift) return NextResponse.json({ ok: false, error: "No hay turno abierto para cerrar." }, { status: 400 });

  const [openOrdersResult, openTablesResult, paymentsResult, cashExpensesResult] = await Promise.all([
    context.supabase
      .from("turquesa_orders")
      .select("id,order_number,total,status")
      .eq("restaurant_id", restaurant.id)
      .eq("shift_id", shift.id)
      .in("status", ["open", "sent", "ready"])
      .limit(20),
    context.supabase
      .from("turquesa_tables")
      .select("id,code,status,current_order_id")
      .eq("restaurant_id", restaurant.id)
      .or("status.in.(open,attention),current_order_id.not.is.null")
      .limit(20),
    context.supabase
      .from("turquesa_payments")
      .select("method,amount")
      .eq("restaurant_id", restaurant.id)
      .eq("shift_id", shift.id),
    context.supabase
      .from("turquesa_accounting_entries")
      .select("debit,metadata")
      .eq("restaurant_id", restaurant.id)
      .eq("shift_id", shift.id)
      .eq("reference_type", "uninvoiced_expense")
      .eq("status", "posted")
      .gt("debit", 0),
  ]);

  if (openOrdersResult.error) throw openOrdersResult.error;
  if (openTablesResult.error) throw openTablesResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (cashExpensesResult.error) throw cashExpensesResult.error;

  const openOrders = openOrdersResult.data || [];
  const openTables = openTablesResult.data || [];
  if (openOrders.length || openTables.length) {
    const tableList = openTables.map((table: any) => table.code).filter(Boolean).join(", ");
    return NextResponse.json(
      {
        ok: false,
        error: tableList
          ? `No se puede cerrar: mesas abiertas ${tableList}.`
          : "No se puede cerrar: hay ordenes abiertas.",
      },
      { status: 409 }
    );
  }

  const totals = (paymentsResult.data || []).reduce(
    (acc: Record<PaymentMethod, number>, payment: any) => {
      const method = normalizePaymentMethod(payment.method);
      acc[method] += num(payment.amount);
      return acc;
    },
    { cash: 0, card: 0, transfer: 0 }
  );
  const cashSales = money(totals.cash || shift.cash_sales);
  const cardSales = money(totals.card || shift.card_sales);
  const transferSales = money(totals.transfer || shift.transfer_sales);
  const openingCash = money(shift.opening_cash);
  const cashExpenses = (cashExpensesResult.data || []).reduce((sum: number, entry: any) => {
    return normalizeExpenseMethod(entry.metadata?.method) === "cash" ? sum + num(entry.debit) : sum;
  }, 0);
  const expectedCashDrawer = money(openingCash + cashSales - cashExpenses);
  const cashDifference = money(countedCash - expectedCashDrawer);
  const now = new Date().toISOString();
  const closingSummary = {
    opening_cash: openingCash,
    cash_sales: cashSales,
    card_sales: cardSales,
    transfer_sales: transferSales,
    cash_uninvoiced_expenses: money(cashExpenses),
    expected_cash_drawer: expectedCashDrawer,
    counted_cash: countedCash,
    cash_difference: cashDifference,
    closed_by_email: context.actorEmail,
  };

  const { error: shiftError } = await context.supabase
    .from("turquesa_shifts")
    .update({
      status: "closed",
      closed_at: now,
      closed_by_email: context.actorEmail,
      cash_sales: cashSales,
      card_sales: cardSales,
      transfer_sales: transferSales,
      expected_cash_drawer: expectedCashDrawer,
      counted_cash: countedCash,
      cash_difference: cashDifference,
      closing_summary: closingSummary,
      notes: notes || shift.notes,
      updated_at: now,
    })
    .eq("id", shift.id);

  if (shiftError) throw shiftError;

  await context.supabase.from("turquesa_events").insert({
    restaurant_id: restaurant.id,
    shift_id: shift.id,
    entity_type: "turquesa_shifts",
    entity_id: shift.id,
    event_type: "shift_closed",
    actor_email: context.actorEmail,
    description: `Turno ${shift.label} cerrado. Diferencia de caja ${cashDifference}.`,
    payload: closingSummary,
  });

  return NextResponse.json({
    ok: true,
    message: `Turno ${shift.label} cerrado. Diferencia de caja ${cashDifference}.`,
    snapshot: await readSnapshot(context.supabase),
  });
}

export async function GET(request: Request) {
  try {
    const context = await getDbContext(request);
    if (context instanceof Response) return context;

    return NextResponse.json({
      ok: true,
      snapshot: await readSnapshot(context.supabase),
      localDev: context.localDev,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: true,
      snapshot: freshDemoSnapshot(`Modo demo: ${publicErrorMessage(error)}`),
      warning: error?.message || "base Turquesa no disponible",
    });
  }
}

export async function POST(request: Request) {
  try {
    const context = await getDbContext(request);
    if (context instanceof Response) return context;

    const body = await request.json().catch(() => ({}));
    const action = clean(body?.action);

    if (action === "send_to_kitchen") return await sendToKitchen(body, context);
    if (action === "advance_ticket") return await advanceTicket(body, context);
    if (action === "create_takeout_sale") return await createTakeoutSale(body, context);
    if (action === "create_uninvoiced_expense") return await createUninvoicedExpense(body, context);
    if (action === "close_order") return await closeOrder(body, context);
    if (action === "create_reservation") return await createReservation(body, context);
    if (action === "update_reservation_status") return await updateReservationStatus(body, context);
    if (action === "record_spoilage") return await recordSpoilage(body, context);
    if (action === "adjust_inventory") return await adjustInventory(body, context);
    if (action === "update_inventory_cost") return await updateInventoryCost(body, context);
    if (action === "create_purchase_request") return await createPurchaseRequest(body, context);
    if (action === "update_recipe_ingredient") return await updateRecipeIngredient(body, context);
    if (action === "receive_purchase_request") return await receivePurchaseRequest(body, context);
    if (action === "update_wifi_lead") return await updateWifiLead(body, context);
    if (action === "close_shift") return await closeShift(body, context);

    return NextResponse.json({ ok: false, error: "Accion no soportada." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: publicErrorMessage(error) || "No se pudo procesar Turquesa Restaurante." },
      { status: 500 }
    );
  }
}
