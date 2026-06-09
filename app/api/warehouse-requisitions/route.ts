import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServiceSupabase, requireApiSession } from "@/lib/security/api-guard";

export const dynamic = "force-dynamic";

function getSupabase() {
  return getServiceSupabase();
}

function productionStatusFromRequisition(status?: string | null) {
  const value = String(status || "").toLowerCase();

  if (value === "despachada") return "materiales_despachados";
  if (value === "parcial") return "requisicion_parcial";
  if (value === "autorizada") return "requisicion_autorizada";

  return "requisicion_creada";
}

async function syncProductionOrderRequisitionStatus(supabase: any, productionOrderId: string | null | undefined, status?: string | null) {
  if (!productionOrderId) return;

  const nextStatus = productionStatusFromRequisition(status);
  const readyForCutting = nextStatus === "materiales_despachados";
  const { error } = await supabase
    .from("production_orders")
    .update({
      status: nextStatus,
      estado: nextStatus,
      ready_for_cutting: readyForCutting,
      cutting_status: readyForCutting ? "materiales_despachados" : nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productionOrderId);

  if (error) {
    console.warn("No se pudo sincronizar estado de orden con requisicion:", error.message);
  }
}

async function safeSelect(supabase: any, table: string, orderBy = "created_at") {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderBy, { ascending: false })
      .limit(1500);

    return { data: data || [], error: error?.message || null };
  } catch (error: any) {
    return { data: [], error: error?.message || "Error desconocido" };
  }
}

const INVENTORY_COLUMNS = [
  "id",
  "code",
  "material",
  "grupo",
  "subgrupo",
  "unidad",
  "medidas",
  "stock",
  "minimo",
  "costo_prom",
  "venta",
  "proveedor",
  "created_at",
  "name",
  "category",
  "subcategory",
  "unit_cost",
  "unit_price",
  "sale_price",
  "cost_price",
  "updated_at",
  "unit",
  "supplier",
  "minimum_stock",
  "notes",
  "quantity",
  "reorder_quantity",
  "auto_purchase",
  "product_name",
  "group_name",
  "min_stock",
  "status",
  "type",
  "costo_promedio",
  "precio_venta",
  "purchase_cost",
  "price",
  "cost",
  "largo_mm",
  "ancho_mm",
  "grosor_mm",
  "area_m2",
  "tipo_material",
  "tipo_tablero",
  "es_tablero",
  "unidad_base",
  "desperdicio_pct",
  "tiene_veta",
  "sentido_veta",
  "ai_match_key",
  "is_active",
  "is_board",
  "sheet_width_mm",
  "sheet_height_mm",
  "thickness_mm",
  "is_edge",
  "edge_width_mm",
  "is_hardware",
  "is_tablero",
  "reserved_stock",
  "stock_reserved",
] as const;

const INVENTORY_MOVEMENT_COLUMNS = [
  "item_id",
  "movement_type",
  "reason",
  "quantity",
  "unit_cost",
  "project_id",
  "reference_type",
  "reference_id",
  "notes",
  "created_by",
  "created_at",
  "note",
  "type",
  "origin",
  "stock_before",
  "stock_after",
  "user_name",
  "user_email",
  "material_used",
  "related_order",
  "product_id",
  "product_name",
  "reference",
  "material_name",
  "created_by_name",
  "created_by_email",
  "material_id",
  "unit_price",
  "producto_id",
  "tipo",
  "cantidad",
  "stock_antes",
  "stock_despues",
  "referencia",
  "origen",
  "cliente",
  "proyecto",
  "costo",
  "costo_unitario",
  "costo_total",
  "nota",
  "fecha",
  "product_code",
  "source_table",
  "sale_id",
  "invoice_number",
  "total_cost",
  "production_order_id",
  "order_code",
  "inventory_id",
  "qty",
  "project_name",
  "source",
] as const;

const LEGACY_MOVEMENT_COLUMNS = [
  "item_id",
  "item_nombre",
  "tipo",
  "cantidad",
  "stock_antes",
  "stock_despues",
  "orden_relacionada",
  "material_usado",
  "notas",
  "created_at",
  "origen",
  "referencia",
  "producto_id",
  "fecha",
  "nota",
  "costo_unitario",
  "costo_total",
  "product_id",
  "cliente",
  "proyecto",
  "costo",
  "quantity",
] as const;

const PURCHASE_ORDER_COLUMNS = [
  "supplier_id",
  "supplier_name",
  "po_number",
  "status",
  "subtotal",
  "tax",
  "total",
  "notes",
  "created_at",
  "invoice_number",
  "supplier",
  "invoice_no",
  "note",
  "user_name",
  "user_email",
  "order_number",
  "created_by",
  "total_estimated",
  "whatsapp_message",
  "code",
  "updated_at",
  "estado",
  "expected_date",
  "eta",
  "delivery_date",
  "received_at",
  "received_by_name",
  "receipt_status",
] as const;

const PURCHASE_ORDER_ITEM_COLUMNS = [
  "purchase_order_id",
  "item_id",
  "item_name",
  "quantity",
  "unit_cost",
  "total",
  "created_at",
  "category",
  "subcategory",
  "unit",
  "purchase_id",
  "user_name",
  "user_email",
  "product_id",
  "product_name",
  "group_name",
  "subgroup_name",
  "current_stock",
  "min_stock",
  "max_stock",
  "quantity_to_buy",
  "estimated_cost",
  "qty",
  "notes",
  "updated_at",
  "qty_received",
  "quantity_received",
  "cantidad_recibida",
] as const;

function pickColumns<T extends readonly string[]>(payload: Record<string, any>, columns: T) {
  return Object.fromEntries(columns.map((column) => [column, payload[column]]));
}

function n(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function norm(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function invName(item: any) {
  return item?.name || item?.product_name || item?.material || item?.code || "Producto";
}

function invUnit(item: any) {
  return item?.unit || item?.unidad || "Unidad";
}

function invStock(item: any) {
  return n(item?.stock ?? item?.quantity);
}

function invReserved(item: any) {
  return n(item?.reserved_stock ?? item?.stock_reserved);
}

function invAvailable(item: any) {
  return Math.max(0, invStock(item) - invReserved(item));
}

function itemMaterialName(item: any) {
  return item?.material_name || item?.material || item?.item_name || item?.product_name || item?.name || "Material sin identificar";
}

function invAliases(item: any) {
  return [invName(item), item?.material, item?.name, item?.product_name, item?.code, item?.sku]
    .filter(Boolean)
    .map(norm);
}

function findInventory(name: string, inventory: any[]) {
  const target = norm(name);
  return (
    inventory.find((item) => invAliases(item).includes(target)) ||
    inventory.find((item) =>
      invAliases(item).some((alias) => alias.length >= 8 && target.length >= 8 && (alias.includes(target) || target.includes(alias)))
    ) ||
    null
  );
}

function sheetSize(name: string, inventoryItem: any) {
  const text = norm(name);
  const width = n(inventoryItem?.sheet_width_mm ?? inventoryItem?.ancho_mm);
  const height = n(inventoryItem?.sheet_height_mm ?? inventoryItem?.largo_mm);

  if (width > 0 && height > 0) return { width, height };
  if (text.includes("7x8") || text.includes("7*8") || text.includes("7 x 8")) return { width: 2134, height: 2440 };
  return { width: 1220, height: 2440 };
}

function buildRequisitionLines(orderItems: any[], inventory: any[]) {
  const grouped = new Map<string, any>();

  for (const item of orderItems) {
    const materialName = itemMaterialName(item);
    const inv = findInventory(materialName, inventory);
    const fullText = norm([materialName, item.product_name, item.part_name, item.module_name].filter(Boolean).join(" "));
    const hasDims = n(item.width_mm ?? item.ancho_mm ?? item.width) > 0 && n(item.height_mm ?? item.largo_mm ?? item.length_mm ?? item.height) > 0;
    const isBoard = hasDims && /(melamina|mdf|tablero|plywood|fondo)/.test(fullText);
    const isEdge = fullText.includes("canto");
    const unitKind = isBoard ? "plancha" : isEdge ? "canto" : "unidad";
    const key = `${inv?.id || norm(materialName)}|${unitKind}`;
    const current =
      grouped.get(key) || {
        inv,
        name: inv ? invName(inv) : materialName,
        unit: inv ? invUnit(inv) : item.unit || item.unidad || "Unidad",
        qty: 0,
        areaM2: 0,
        rawQty: 0,
        note: "",
      };

    if (isBoard) {
      const sheet = sheetSize(current.name, inv);
      const sheetArea = Math.max(0.0001, (sheet.width * sheet.height) / 1_000_000);
      const itemArea =
        (n(item.width_mm ?? item.ancho_mm ?? item.width) *
          n(item.height_mm ?? item.largo_mm ?? item.length_mm ?? item.height) *
          Math.max(1, n(item.quantity ?? item.qty ?? item.cantidad ?? 1))) /
        1_000_000;
      current.areaM2 += itemArea;
      current.qty = Math.max(1, Math.ceil((current.areaM2 * 1.15) / sheetArea));
      current.unit = "plancha";
      current.note = `Plancha estimada por area BOM (${Math.round(current.areaM2 * 1000) / 1000} m2 + 15% merma).`;
    } else if (isEdge) {
      current.rawQty += n(item.quantity ?? item.qty ?? item.cantidad ?? 0);
      current.qty = Math.round(current.rawQty * 1.1 * 10) / 10;
      current.unit = "metro";
      current.note = "Canto PVC calculado desde BOM + 10% merma.";
    } else {
      current.qty = Math.round((current.qty + n(item.quantity ?? item.qty ?? item.cantidad ?? 1)) * 100) / 100;
      current.note = "Herraje/material consolidado desde BOM de produccion.";
    }

    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .filter((line) => line.qty > 0)
    .map((line) => {
      const reservedQty = line.inv ? Math.min(invAvailable(line.inv), line.qty) : 0;
      return { ...line, reservedQty, missingQty: Math.max(0, line.qty - reservedQty) };
    });
}

function reqCode(req: any) {
  return req?.code || req?.requisition_no || req?.codigo || `REQ-${String(req?.id || "").slice(0, 8)}`;
}

function reqTitle(req: any) {
  return req?.project_name || req?.project || req?.motivo || req?.reason || "Requisicion";
}

function reqClient(req: any) {
  return req?.client_name || req?.customer_name || req?.cliente || req?.client || null;
}

function getItemQty(item: any) {
  return n(item?.qty_requested ?? item?.quantity_requested ?? item?.cantidad_solicitada ?? item?.quantity ?? item?.qty ?? 0);
}

function getItemReserved(item: any) {
  return n(item?.qty_reserved ?? item?.quantity_reserved ?? item?.cantidad_reservada ?? 0);
}

function getItemDispatched(item: any) {
  return n(item?.qty_dispatched ?? item?.quantity_dispatched ?? item?.cantidad_despachada ?? 0);
}

function getItemApproved(item: any) {
  return n(item?.qty_approved ?? item?.quantity_approved ?? item?.cantidad_aprobada ?? 0);
}

function itemInventoryId(item: any) {
  return item?.inventory_id || item?.product_id || null;
}

function itemDisplayName(item: any, inv?: any) {
  return item?.product_name || item?.item_name || item?.material || (inv ? invName(inv) : "Producto sin identificar");
}

function unitCost(item: any) {
  return n(item?.cost_price ?? item?.unit_cost ?? item?.purchase_cost ?? item?.cost ?? item?.costo_prom ?? item?.costo_promedio);
}

async function createMovement(supabase: any, args: any) {
  const now = new Date().toISOString();
  const note = `Despacho de requisicion ${reqCode(args.req)} - ${reqTitle(args.req)}`;
  const movementPayload = pickColumns(
    {
      item_id: null,
      movement_type: "salida",
      reason: "requisicion_almacen",
      quantity: -Math.abs(args.qty),
      unit_cost: args.cost,
      project_id: args.req?.project_id || null,
      reference_type: "warehouse_requisition",
      reference_id: args.req?.id || null,
      notes: note,
      created_by: null,
      created_at: now,
      note,
      type: "salida",
      origin: "requisiciones_almacen",
      stock_before: args.beforeStock,
      stock_after: args.afterStock,
      user_name: "RD Wood System",
      user_email: null,
      material_used: args.productName,
      related_order: reqCode(args.req),
      product_id: args.inventoryId,
      product_name: args.productName,
      reference: reqCode(args.req),
      material_name: args.productName,
      created_by_name: "RD Wood System",
      created_by_email: null,
      material_id: null,
      unit_price: args.cost,
      producto_id: args.inventoryId,
      tipo: "salida",
      cantidad: -Math.abs(args.qty),
      stock_antes: args.beforeStock,
      stock_despues: args.afterStock,
      referencia: reqCode(args.req),
      origen: "requisiciones_almacen",
      cliente: reqClient(args.req),
      proyecto: reqTitle(args.req),
      costo: args.cost,
      costo_unitario: args.cost,
      costo_total: args.qty * args.cost,
      nota: note,
      fecha: now,
      product_code: args.productCode || null,
      source_table: "warehouse_requisitions",
      sale_id: null,
      invoice_number: null,
      total_cost: args.qty * args.cost,
      production_order_id: args.req?.production_order_id || null,
      order_code: args.req?.production_order_code || args.req?.order_code || null,
      inventory_id: args.inventoryId,
      qty: -Math.abs(args.qty),
      project_name: reqTitle(args.req),
      source: "warehouse_requisition",
    },
    INVENTORY_MOVEMENT_COLUMNS
  );

  let res = await supabase.from("inventory_movements").insert(movementPayload);
  if (!res.error) return null;

  const fallback = pickColumns(
    {
      item_id: null,
      item_nombre: args.productName,
      tipo: "salida",
      cantidad: -Math.abs(args.qty),
      stock_antes: args.beforeStock,
      stock_despues: args.afterStock,
      orden_relacionada: reqCode(args.req),
      material_usado: args.productName,
      notas: note,
      created_at: now,
      origen: "requisiciones_almacen",
      referencia: reqCode(args.req),
      producto_id: args.inventoryId,
      fecha: now,
      nota: note,
      costo_unitario: args.cost,
      costo_total: args.qty * args.cost,
      product_id: args.inventoryId,
      cliente: reqClient(args.req),
      proyecto: reqTitle(args.req),
      costo: args.cost,
      quantity: -Math.abs(args.qty),
    },
    LEGACY_MOVEMENT_COLUMNS
  );
  res = await supabase.from("movimientos").insert(fallback);
  return res.error || null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession(request, "inventario");
    if (!session.ok) return session.response;
    const supabase = session.supabase;

    const [reqRes, itemRes, invRes, ordersRes, orderItemsRes, poRes] = await Promise.all([
      safeSelect(supabase, "warehouse_requisitions"),
      safeSelect(supabase, "warehouse_requisition_items"),
      safeSelect(supabase, "inventory", "material"),
      safeSelect(supabase, "production_orders"),
      safeSelect(supabase, "production_order_items"),
      safeSelect(supabase, "purchase_orders"),
    ]);

    const errors = [
      reqRes.error && `warehouse_requisitions: ${reqRes.error}`,
      itemRes.error && `warehouse_requisition_items: ${itemRes.error}`,
      invRes.error && `inventory: ${invRes.error}`,
      ordersRes.error && `production_orders: ${ordersRes.error}`,
      orderItemsRes.error && `production_order_items: ${orderItemsRes.error}`,
      poRes.error && `purchase_orders: ${poRes.error}`,
    ].filter(Boolean);

    return NextResponse.json({
      ok: errors.length === 0,
      errors,
      requisitions: reqRes.data,
      items: itemRes.data,
      inventory: invRes.data,
      orders: ordersRes.data,
      orderItems: orderItemsRes.data,
      purchaseRequests: poRes.data,
      schema: {
        inventory: INVENTORY_COLUMNS,
        inventoryMovements: INVENTORY_MOVEMENT_COLUMNS,
        legacyMovements: LEGACY_MOVEMENT_COLUMNS,
        purchaseOrders: PURCHASE_ORDER_COLUMNS,
        purchaseOrderItems: PURCHASE_ORDER_ITEM_COLUMNS,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Error cargando requisiciones." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession(request, ["inventario", "compras", "produccion"]);
    if (!session.ok) return session.response;

    const body = await request.json();
    const action = body?.action;
    const productionOrderId = body?.productionOrderId;
    const requisitionId = body?.requisitionId;
    const supabase = session.supabase;

    if (action === "update-status") {
      if (!requisitionId || !body?.status) {
        return NextResponse.json({ ok: false, error: "Faltan requisitionId o status." }, { status: 400 });
      }

      const status = String(body.status);
      const payload: any = { status, estado: status, updated_at: new Date().toISOString() };
      if (status === "autorizada") payload.approved_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("warehouse_requisitions")
        .update(payload)
        .eq("id", requisitionId)
        .select("id, code, requisition_no, status, estado, production_order_id")
        .single();

      if (error) throw error;
      await syncProductionOrderRequisitionStatus(supabase, data?.production_order_id, status);
      return NextResponse.json({ ok: true, requisition: data, code: reqCode(data), status });
    }

    if (action === "dispatch") {
      if (!requisitionId) {
        return NextResponse.json({ ok: false, error: "Falta requisitionId." }, { status: 400 });
      }

      const { data: req, error: reqError } = await supabase
        .from("warehouse_requisitions")
        .select("*")
        .eq("id", requisitionId)
        .maybeSingle();

      if (reqError || !req) throw reqError || new Error("Requisicion no encontrada.");

      const { data: reqItems, error: reqItemsError } = await supabase
        .from("warehouse_requisition_items")
        .select("*")
        .or(`warehouse_requisition_id.eq.${requisitionId},requisition_id.eq.${requisitionId}`);

      if (reqItemsError) throw reqItemsError;
      if (!reqItems?.length) return NextResponse.json({ ok: false, error: "Esta requisicion no tiene items para despachar." }, { status: 400 });

      const { data: inventory, error: inventoryError } = await supabase.from("inventory").select("*").limit(2000);
      if (inventoryError) throw inventoryError;

      const inventoryMap = new Map((inventory || []).map((item: any) => [String(item.id), item]));
      let dispatchedLines = 0;
      let partialLines = 0;
      let blockedLines = 0;

      for (const item of reqItems) {
        const inventoryId = itemInventoryId(item);
        const inv = inventoryId ? inventoryMap.get(String(inventoryId)) : null;
        if (!inventoryId || !inv) {
          blockedLines += 1;
          continue;
        }

        const requestedQty = getItemQty(item);
        const alreadyDispatched = getItemDispatched(item);
        const reservedQty = getItemReserved(item);
        const pendingQty = Math.max(0, requestedQty - alreadyDispatched);
        if (pendingQty <= 0) continue;

        const qtyToDispatch = Math.min(invStock(inv), pendingQty);
        if (qtyToDispatch <= 0) {
          blockedLines += 1;
          continue;
        }

        const before = invStock(inv);
        const after = before - qtyToDispatch;
        const reserveToRelease = Math.min(reservedQty, qtyToDispatch);
        const nextReserved = Math.max(0, invReserved(inv) - reserveToRelease);
        const cost = unitCost(inv);
        const productName = itemDisplayName(item, inv);

        const movementError = await createMovement(supabase, {
          inventoryId: String(inventoryId),
          productName,
          productCode: inv?.code || null,
          qty: qtyToDispatch,
          beforeStock: before,
          afterStock: after,
          cost,
          req,
        });
        if (movementError) throw movementError;

        const { error: invError } = await supabase
          .from("inventory")
          .update({
            stock: after,
            quantity: after,
            reserved_stock: nextReserved,
            stock_reserved: nextReserved,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inventoryId);
        if (invError) throw invError;

        inv.stock = after;
        inv.quantity = after;
        inv.reserved_stock = nextReserved;
        inv.stock_reserved = nextReserved;

        const newDispatched = alreadyDispatched + qtyToDispatch;
        const newReserved = Math.max(0, reservedQty - reserveToRelease);
        const missing = Math.max(0, requestedQty - newDispatched - newReserved);
        const lineStatus = newDispatched >= requestedQty ? "despachada" : "parcial";

        const { error: itemError } = await supabase
          .from("warehouse_requisition_items")
          .update({
            qty_dispatched: newDispatched,
            quantity_dispatched: newDispatched,
            cantidad_despachada: newDispatched,
            qty_reserved: newReserved,
            quantity_reserved: newReserved,
            cantidad_reservada: newReserved,
            qty_missing: missing,
            cantidad_faltante: missing,
            qty_approved: Math.max(getItemApproved(item), newDispatched),
            quantity_approved: Math.max(getItemApproved(item), newDispatched),
            cantidad_aprobada: Math.max(getItemApproved(item), newDispatched),
            status: lineStatus,
            estado: lineStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        if (itemError) throw itemError;

        dispatchedLines += 1;
        if (qtyToDispatch < pendingQty) partialLines += 1;
      }

      const finalStatus = partialLines > 0 || blockedLines > 0 ? "parcial" : "despachada";
      const { error: statusError } = await supabase
        .from("warehouse_requisitions")
        .update({
          status: finalStatus,
          estado: finalStatus,
          dispatched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requisitionId);

      if (statusError) throw statusError;
      await syncProductionOrderRequisitionStatus(supabase, req.production_order_id, finalStatus);

      return NextResponse.json({ ok: true, code: reqCode(req), status: finalStatus, dispatchedLines, partialLines, blockedLines });
    }

    if (action === "create-purchase-order-from-shortage") {
      if (!requisitionId) {
        return NextResponse.json({ ok: false, error: "Falta requisitionId." }, { status: 400 });
      }

      const { data: req, error: reqError } = await supabase
        .from("warehouse_requisitions")
        .select("*")
        .eq("id", requisitionId)
        .maybeSingle();

      if (reqError || !req) throw reqError || new Error("Requisicion no encontrada.");
      if (req.purchase_order_id || req.purchase_request_id) {
        return NextResponse.json({
          ok: true,
          alreadyExists: true,
          purchaseOrderId: req.purchase_order_id || req.purchase_request_id,
          code: reqCode(req),
          message: "Esta requisicion ya tiene OC vinculada.",
        });
      }

      const { data: reqItems, error: reqItemsError } = await supabase
        .from("warehouse_requisition_items")
        .select("*")
        .or(`warehouse_requisition_id.eq.${requisitionId},requisition_id.eq.${requisitionId}`);

      if (reqItemsError) throw reqItemsError;
      if (!reqItems?.length) {
        return NextResponse.json({ ok: false, error: "Esta requisicion no tiene items." }, { status: 400 });
      }

      const { data: inventory, error: inventoryError } = await supabase.from("inventory").select("*").limit(2000);
      if (inventoryError) throw inventoryError;

      const inventoryMap = new Map((inventory || []).map((item: any) => [String(item.id), item]));
      const shortageLines = reqItems
        .map((item: any) => {
          const inventoryId = itemInventoryId(item);
          const inv = inventoryId ? inventoryMap.get(String(inventoryId)) : null;
          const requested = getItemQty(item);
          const reservedQty = getItemReserved(item);
          const dispatched = getItemDispatched(item);
          const missing = Math.max(0, requested - reservedQty - dispatched);
          const cost = inv ? unitCost(inv) : n(item?.estimated_unit_cost ?? item?.unit_cost ?? item?.cost ?? item?.costo_unitario ?? 0);
          return { item, inv, missing, cost };
        })
        .filter((line: any) => line.missing > 0);

      if (!shortageLines.length) {
        return NextResponse.json({ ok: false, error: "Esta requisicion no tiene faltantes para comprar." }, { status: 400 });
      }

      const code = `AUTO-OC-${Date.now().toString().slice(-10)}`;
      const now = new Date().toISOString();
      const estimatedTotal = shortageLines.reduce((sum: number, line: any) => sum + line.missing * line.cost, 0);
      const orderPayload = pickColumns(
        {
          supplier_id: null,
          supplier_name: "Proveedor por definir",
          po_number: code,
          status: "pendiente",
          subtotal: estimatedTotal,
          tax: 0,
          total: estimatedTotal,
          notes: `Orden automatica generada desde requisicion ${reqCode(req)} - ${reqTitle(req)}`,
          created_at: now,
          invoice_number: code,
          supplier: "Proveedor por definir",
          invoice_no: code,
          note: `Orden automatica generada desde requisicion ${reqCode(req)}`,
          user_name: "RD Wood System",
          user_email: null,
          order_number: code,
          created_by: null,
          total_estimated: estimatedTotal,
          whatsapp_message: null,
          code,
          updated_at: now,
          estado: "pendiente",
          expected_date: null,
          eta: null,
          delivery_date: null,
          received_at: null,
          received_by_name: null,
          receipt_status: "pendiente",
        },
        PURCHASE_ORDER_COLUMNS
      );

      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .insert(orderPayload)
        .select("*")
        .single();
      if (poError) throw poError;

      const rows = shortageLines.map((line: any) => {
        const itemName = itemDisplayName(line.item, line.inv);
        return pickColumns(
          {
            purchase_order_id: po.id,
            item_id: null,
            item_name: itemName,
            quantity: line.missing,
            unit_cost: line.cost,
            total: line.missing * line.cost,
            created_at: now,
            category: line.inv?.category || line.inv?.grupo || "General",
            subcategory: line.inv?.subcategory || line.inv?.subgrupo || "",
            unit: line.item?.unit || line.item?.unidad || line.inv?.unit || line.inv?.unidad || "Unidad",
            purchase_id: po.id,
            user_name: "RD Wood System",
            user_email: null,
            product_id: line.inv?.id || line.item?.inventory_id || line.item?.product_id || null,
            product_name: itemName,
            group_name: line.inv?.group_name || line.inv?.grupo || line.inv?.category || "General",
            subgroup_name: line.inv?.subgrupo || line.inv?.subcategory || "",
            current_stock: line.inv ? invStock(line.inv) : 0,
            min_stock: line.inv ? n(line.inv?.min_stock ?? line.inv?.minimum_stock ?? line.inv?.minimo) : 0,
            max_stock: null,
            quantity_to_buy: line.missing,
            estimated_cost: line.cost,
            qty: line.missing,
            notes: `Faltante de requisicion ${reqCode(req)}. Solicitado ${getItemQty(line.item)}, reservado ${getItemReserved(line.item)}, despachado ${getItemDispatched(line.item)}.`,
            updated_at: now,
            qty_received: 0,
            quantity_received: 0,
            cantidad_recibida: 0,
          },
          PURCHASE_ORDER_ITEM_COLUMNS
        );
      });

      const { data: poItems, error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(rows)
        .select("*");
      if (itemsError) throw itemsError;

      const { error: reqUpdateError } = await supabase
        .from("warehouse_requisitions")
        .update({
          purchase_order_id: po.id,
          purchase_request_id: po.id,
          purchase_requested_at: now,
          purchase_status: "pendiente",
          status: "compra_generada",
          estado: "compra_generada",
          updated_at: now,
        })
        .eq("id", requisitionId);
      if (reqUpdateError) throw reqUpdateError;

      for (const [index, line] of shortageLines.entries()) {
        await supabase
          .from("warehouse_requisition_items")
          .update({
            purchase_order_item_id: poItems?.[index]?.id || null,
            qty_missing: line.missing,
            cantidad_faltante: line.missing,
            updated_at: now,
          })
          .eq("id", line.item.id);
      }

      return NextResponse.json({
        ok: true,
        code: reqCode(req),
        purchaseOrderId: po.id,
        purchaseOrderCode: code,
        itemCount: rows.length,
        total: estimatedTotal,
      });
    }

    if (action !== "create-from-order" || !productionOrderId) {
      return NextResponse.json({ ok: false, error: "Accion invalida." }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabase
      .from("production_orders")
      .select("*")
      .eq("id", productionOrderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ ok: false, error: orderError?.message || "Orden no encontrada." }, { status: 404 });
    }

    const orderCode = order.order_code || order.code || `OP-${String(productionOrderId).slice(0, 8)}`;
    const { data: existing, error: existingError } = await supabase
      .from("warehouse_requisitions")
      .select("id, code, requisition_no, status, estado, production_order_id")
      .eq("production_order_id", productionOrderId)
      .maybeSingle();

    if (existingError) throw existingError;

    const { data: orderItems, error: orderItemsError } = await supabase
      .from("production_order_items")
      .select("*")
      .eq("production_order_id", productionOrderId);

    if (orderItemsError) throw orderItemsError;
    if (!orderItems?.length) return NextResponse.json({ ok: false, error: "La orden no tiene items de produccion." }, { status: 400 });

    const { data: inventory, error: inventoryError } = await supabase.from("inventory").select("*").limit(2000);
    if (inventoryError) throw inventoryError;

    const lines = buildRequisitionLines(orderItems, inventory || []);
    if (!lines.length) return NextResponse.json({ ok: false, error: "No hay materiales para requisicion." }, { status: 400 });

    let req = existing;
    let alreadyExists = Boolean(existing?.id);
    if (!req?.id) {
      const code = `REQ-BOM-${String(orderCode).replace(/[^a-zA-Z0-9-]/g, "").slice(-12)}-${Date.now().toString().slice(-5)}`;
      const { data: created, error: createError } = await supabase
        .from("warehouse_requisitions")
        .insert({
          code,
          requisition_no: code,
          type: "produccion_automatica",
          tipo: "produccion_automatica",
          request_type: "produccion_automatica",
          requisition_type: "produccion_automatica",
          department: "Produccion",
          departamento: "Produccion",
          requested_department: "Produccion",
          status: "pendiente_autorizacion",
          estado: "pendiente_autorizacion",
          production_order_id: productionOrderId,
          project_id: order.project_id || null,
          project_name: order.project_name || "Proyecto de produccion",
          reason: `Requisicion automatica de materiales para ${orderCode}: planchas, cantos y herrajes consolidados desde BOM.`,
          urgency: "normal",
          requested_by_name: "Produccion",
          requested_by: "Produccion",
          reserved_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id, code, requisition_no, status, estado, production_order_id")
        .single();

      if (createError) throw createError;
      req = created;
      alreadyExists = false;
    }

    const { data: existingItems, error: existingItemsError } = await supabase
      .from("warehouse_requisition_items")
      .select("id")
      .eq("warehouse_requisition_id", req.id)
      .limit(1);

    if (existingItemsError) throw existingItemsError;

    if (!existingItems?.length) {
      const rows = lines.map((line) => ({
        requisition_id: req.id,
        warehouse_requisition_id: req.id,
        inventory_id: line.inv?.id || null,
        product_id: line.inv?.id || null,
        product_name: line.name,
        item_name: line.name,
        material: line.name,
        qty_requested: line.qty,
        quantity_requested: line.qty,
        cantidad_solicitada: line.qty,
        qty_reserved: line.reservedQty,
        quantity_reserved: line.reservedQty,
        cantidad_reservada: line.reservedQty,
        qty_missing: line.missingQty,
        cantidad_faltante: line.missingQty,
        qty_approved: 0,
        qty_dispatched: 0,
        unit: line.unit,
        unidad: line.unit,
        status: !line.inv ? "sin_match_inventario" : line.missingQty > 0 ? "reserva_parcial" : "reservada",
        estado: !line.inv ? "sin_match_inventario" : line.missingQty > 0 ? "reserva_parcial" : "reservada",
        destination: "Produccion",
        destino: "Produccion",
        notes: `${line.note} ${line.inv ? "" : "Sin match de inventario. "}Reservado: ${line.reservedQty}/${line.qty}. Faltante: ${line.missingQty}.`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: itemError } = await supabase.from("warehouse_requisition_items").insert(rows);
      if (itemError) throw itemError;

      for (const line of lines) {
        if (!line.inv?.id || line.reservedQty <= 0) continue;
        await supabase
          .from("inventory")
          .update({
            reserved_stock: invReserved(line.inv) + line.reservedQty,
            stock_reserved: invReserved(line.inv) + line.reservedQty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", line.inv.id);
      }
    }

    const reqStatus = (req as any)?.status || (req as any)?.estado || "pendiente_autorizacion";
    await syncProductionOrderRequisitionStatus(supabase, productionOrderId, reqStatus);

    return NextResponse.json({
      ok: true,
      alreadyExists,
      code: req.code || req.requisition_no,
      orderCode,
      lineCount: lines.length,
      reserved: lines.reduce((sum, line) => sum + line.reservedQty, 0),
      missing: lines.reduce((sum, line) => sum + line.missingQty, 0),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Error creando requisicion." },
      { status: 500 }
    );
  }
}
