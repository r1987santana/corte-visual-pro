import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServiceSupabase, requireApiSession } from "@/lib/security/api-guard";

export const dynamic = "force-dynamic";

function getSupabase() {
  return getServiceSupabase();
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

function poNumber(po: any) {
  return po?.po_number || po?.order_number || po?.code || po?.invoice_number || "OC-SIN-NUMERO";
}

function poSupplier(po: any) {
  return po?.supplier_name || po?.supplier || "Proveedor por definir";
}

function itemName(item: any) {
  return item?.item_name || item?.product_name || item?.material || item?.name || "Producto sin nombre";
}

function orderedQty(item: any) {
  return n(item?.quantity ?? item?.quantity_to_buy ?? item?.qty ?? item?.qty_requested ?? 0);
}

function receivedQty(item: any) {
  return n(item?.qty_received ?? item?.quantity_received ?? item?.cantidad_recibida ?? 0);
}

function unitCost(item: any) {
  return n(item?.unit_cost ?? item?.estimated_cost ?? item?.cost ?? item?.costo_unitario ?? 0);
}

function inventoryName(item: any) {
  return item?.material || item?.name || item?.product_name || item?.description || "Producto sin nombre";
}

function inventoryStock(item: any) {
  return n(item?.stock ?? item?.quantity ?? item?.qty ?? 0);
}

function inventoryReserved(item: any) {
  return n(item?.reserved_stock ?? item?.stock_reserved ?? 0);
}

function inventoryCost(item: any) {
  return n(item?.costo_promedio ?? item?.unit_cost ?? item?.purchase_cost ?? item?.cost_price ?? item?.cost ?? 0);
}

function invAliases(item: any) {
  return [item?.material, item?.name, item?.product_name, item?.code]
    .filter(Boolean)
    .map(norm);
}

function findInventoryByName(name: string, inventory: any[]) {
  const target = norm(name);
  return (
    inventory.find((item) => invAliases(item).includes(target)) ||
    inventory.find((item) =>
      invAliases(item).some((alias) => alias.length >= 4 && target.length >= 4 && (alias.includes(target) || target.includes(alias)))
    ) ||
    null
  );
}

function pickColumns<T extends readonly string[]>(payload: Record<string, any>, columns: T) {
  return Object.fromEntries(columns.map((column) => [column, payload[column]]));
}

const INVENTORY_COLUMNS = [
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
  "tipo_material",
  "unidad_base",
  "ai_match_key",
  "is_active",
  "is_hardware",
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
  "created_at",
  "note",
  "type",
  "origin",
  "stock_before",
  "stock_after",
  "user_name",
  "material_used",
  "related_order",
  "product_id",
  "product_name",
  "reference",
  "material_name",
  "unit_price",
  "producto_id",
  "tipo",
  "cantidad",
  "stock_antes",
  "stock_despues",
  "referencia",
  "origen",
  "proyecto",
  "costo",
  "costo_unitario",
  "costo_total",
  "nota",
  "fecha",
  "product_code",
  "source_table",
  "invoice_number",
  "total_cost",
  "inventory_id",
  "qty",
  "project_name",
  "source",
] as const;

async function createInventoryProduct(supabase: any, item: any, supplier: string) {
  const now = new Date().toISOString();
  const name = itemName(item);
  const cost = unitCost(item);
  const code = `AUTO-${norm(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase() || Date.now()}`;
  const payload = pickColumns(
    {
      code,
      material: name,
      grupo: item?.group_name || item?.category || "Herrajes",
      subgrupo: item?.subgroup_name || item?.subcategory || "",
      unidad: item?.unit || "Unidad",
      medidas: "",
      stock: 0,
      minimo: n(item?.min_stock ?? 0),
      costo_prom: cost,
      venta: 0,
      proveedor: supplier,
      created_at: now,
      name,
      category: item?.category || item?.group_name || "Herrajes",
      subcategory: item?.subcategory || item?.subgroup_name || "",
      unit_cost: cost,
      unit_price: 0,
      sale_price: 0,
      cost_price: cost,
      updated_at: now,
      unit: item?.unit || "Unidad",
      supplier,
      minimum_stock: n(item?.min_stock ?? 0),
      notes: `Creado automatico al recibir ${poNumber({ po_number: item?.source_po })}`,
      quantity: 0,
      reorder_quantity: 0,
      auto_purchase: false,
      product_name: name,
      group_name: item?.group_name || item?.category || "Herrajes",
      min_stock: n(item?.min_stock ?? 0),
      status: "active",
      type: "hardware",
      costo_promedio: cost,
      precio_venta: 0,
      purchase_cost: cost,
      price: 0,
      cost,
      tipo_material: "herrajes",
      unidad_base: item?.unit || "Unidad",
      ai_match_key: norm(name),
      is_active: true,
      is_hardware: true,
      reserved_stock: 0,
      stock_reserved: 0,
    },
    INVENTORY_COLUMNS
  );

  const { data, error } = await supabase.from("inventory").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

async function createMovement(supabase: any, args: any) {
  const now = new Date().toISOString();
  const note = `Entrada por recepcion de compra ${args.reference}`;
  const payload = pickColumns(
    {
      item_id: null,
      movement_type: "entrada",
      reason: "recepcion_compra",
      quantity: Math.abs(args.qty),
      unit_cost: args.cost,
      project_id: null,
      reference_type: "purchase_receipt",
      reference_id: args.receiptId || null,
      notes: note,
      created_at: now,
      note,
      type: "entrada",
      origin: "recepcion_compras_almacen",
      stock_before: args.beforeStock,
      stock_after: args.afterStock,
      user_name: "RD Wood System",
      material_used: args.productName,
      related_order: args.reference,
      product_id: args.inventoryId,
      product_name: args.productName,
      reference: args.reference,
      material_name: args.productName,
      unit_price: args.cost,
      producto_id: args.inventoryId,
      tipo: "entrada",
      cantidad: Math.abs(args.qty),
      stock_antes: args.beforeStock,
      stock_despues: args.afterStock,
      referencia: args.reference,
      origen: "recepcion_compras_almacen",
      proyecto: args.projectName || null,
      costo: args.cost,
      costo_unitario: args.cost,
      costo_total: args.qty * args.cost,
      nota: note,
      fecha: now,
      product_code: args.productCode || null,
      source_table: "purchase_receipts",
      invoice_number: args.reference,
      total_cost: args.qty * args.cost,
      inventory_id: args.inventoryId,
      qty: Math.abs(args.qty),
      project_name: args.projectName || null,
      source: "purchase_receipt",
    },
    INVENTORY_MOVEMENT_COLUMNS
  );

  const { error } = await supabase.from("inventory_movements").insert(payload);
  if (error) throw error;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession(request, ["compras", "inventario"]);
    if (!session.ok) return session.response;

    const body = await request.json();
    const purchaseOrderId = body?.purchaseOrderId;
    const receiveValues = body?.receiveValues || {};
    const notes = body?.notes || "";

    if (!purchaseOrderId) {
      return NextResponse.json({ ok: false, error: "Falta purchaseOrderId." }, { status: 400 });
    }

    const supabase = session.supabase;
    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("id", purchaseOrderId)
      .maybeSingle();

    if (poError || !po) throw poError || new Error("Orden de compra no encontrada.");

    const { data: poItems, error: itemsError } = await supabase
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", purchaseOrderId);

    if (itemsError) throw itemsError;
    if (!poItems?.length) {
      return NextResponse.json({ ok: false, error: "Esta OC no tiene lineas para recibir." }, { status: 400 });
    }

    const { data: inventory, error: inventoryError } = await supabase.from("inventory").select("*").limit(3000);
    if (inventoryError) throw inventoryError;

    const inventoryMap = new Map((inventory || []).map((item: any) => [String(item.id), item]));
    const receiptNo = `REC-${Date.now().toString().slice(-10)}`;
    const now = new Date().toISOString();

    const { data: receipt, error: receiptError } = await supabase
      .from("purchase_receipts")
      .insert({
        receipt_no: receiptNo,
        code: receiptNo,
        purchase_order_id: purchaseOrderId,
        status: "recibida",
        estado: "recibida",
        received_by_name: "Almacen",
        supplier_name: poSupplier(po),
        notes: notes || `Recepcion de almacen para ${poNumber(po)}`,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (receiptError) throw receiptError;

    const { data: linkedReqs } = await supabase
      .from("warehouse_requisitions")
      .select("*")
      .or(`purchase_order_id.eq.${purchaseOrderId},purchase_request_id.eq.${purchaseOrderId}`);
    const linkedReq = linkedReqs?.[0] || null;

    let totalReceived = 0;
    let receivedLines = 0;
    let createdInventory = 0;

    for (const item of poItems) {
      const qtyToReceive = n(receiveValues[String(item.id)]);
      if (qtyToReceive <= 0) continue;

      const existingId = item.product_id || item.item_id || item.inventory_id;
      let inv = existingId ? inventoryMap.get(String(existingId)) : null;
      if (!inv) inv = findInventoryByName(itemName(item), inventory || []);
      if (!inv) {
        inv = await createInventoryProduct(supabase, { ...item, source_po: poNumber(po) }, poSupplier(po));
        inventoryMap.set(String(inv.id), inv);
        createdInventory += 1;
      }

      const before = inventoryStock(inv);
      const currentCost = inventoryCost(inv);
      const cost = unitCost(item) || currentCost;
      const after = before + qtyToReceive;
      const oldValue = before * currentCost;
      const newValue = qtyToReceive * cost;
      const avgCost = after > 0 ? (oldValue + newValue) / after : cost;

      const { error: invError } = await supabase
        .from("inventory")
        .update({
          stock: after,
          quantity: after,
          costo_promedio: avgCost,
          costo_prom: avgCost,
          unit_cost: avgCost,
          cost_price: avgCost,
          cost: avgCost,
          purchase_cost: cost,
          updated_at: now,
        })
        .eq("id", inv.id);
      if (invError) throw invError;

      inv.stock = after;
      inv.quantity = after;
      inv.costo_promedio = avgCost;
      inv.unit_cost = avgCost;

      const newReceived = receivedQty(item) + qtyToReceive;
      const itemStatus = newReceived >= orderedQty(item) ? "recibido" : "parcial";

      const { error: itemUpdateError } = await supabase
        .from("purchase_order_items")
        .update({
          product_id: inv.id,
          item_id: null,
          qty_received: newReceived,
          quantity_received: newReceived,
          cantidad_recibida: newReceived,
          updated_at: now,
        })
        .eq("id", item.id);
      if (itemUpdateError) throw itemUpdateError;

      const { error: receiptItemError } = await supabase.from("purchase_receipt_items").insert({
        purchase_receipt_id: receipt.id,
        purchase_order_id: purchaseOrderId,
        purchase_order_item_id: item.id,
        inventory_id: inv.id,
        product_id: inv.id,
        product_name: inventoryName(inv),
        item_name: inventoryName(inv),
        qty_ordered: orderedQty(item),
        qty_received: qtyToReceive,
        quantity_received: qtyToReceive,
        cantidad_recibida: qtyToReceive,
        unit_cost: cost,
        total: qtyToReceive * cost,
        status: itemStatus,
        estado: itemStatus,
        notes: "Entrada confirmada por Almacen.",
        created_at: now,
        updated_at: now,
      });
      if (receiptItemError) throw receiptItemError;

      await createMovement(supabase, {
        inventoryId: String(inv.id),
        productName: inventoryName(inv),
        productCode: inv.code || null,
        qty: qtyToReceive,
        beforeStock: before,
        afterStock: after,
        cost,
        reference: receiptNo,
        receiptId: receipt.id,
        projectName: linkedReq?.project_name || null,
      });

      if (linkedReq?.id) {
        const { data: reqItems } = await supabase
          .from("warehouse_requisition_items")
          .select("*")
          .or(`warehouse_requisition_id.eq.${linkedReq.id},requisition_id.eq.${linkedReq.id}`);

        const matchingReqItems = (reqItems || []).filter((reqItem: any) => {
          const linkedItemId = reqItem.purchase_order_item_id && String(reqItem.purchase_order_item_id) === String(item.id);
          const sameName = norm(reqItem.product_name || reqItem.item_name || reqItem.material) === norm(itemName(item));
          return linkedItemId || sameName;
        });

        for (const reqItem of matchingReqItems) {
          const pendingReq = Math.max(0, n(reqItem.qty_requested ?? reqItem.quantity_requested ?? reqItem.cantidad_solicitada ?? reqItem.quantity) - n(reqItem.qty_dispatched ?? reqItem.quantity_dispatched ?? reqItem.cantidad_despachada));
          const reserveQty = Math.min(qtyToReceive, pendingReq);
          if (reserveQty <= 0) continue;

          const nextReserved = inventoryReserved(inv) + reserveQty;
          const { error: reserveError } = await supabase
            .from("inventory")
            .update({ reserved_stock: nextReserved, stock_reserved: nextReserved, updated_at: now })
            .eq("id", inv.id);
          if (reserveError) throw reserveError;
          inv.reserved_stock = nextReserved;
          inv.stock_reserved = nextReserved;

          const { error: reqItemError } = await supabase
            .from("warehouse_requisition_items")
            .update({
              inventory_id: inv.id,
              product_id: inv.id,
              item_id: null,
              qty_reserved: reserveQty,
              quantity_reserved: reserveQty,
              cantidad_reservada: reserveQty,
              qty_missing: Math.max(0, pendingReq - reserveQty),
              cantidad_faltante: Math.max(0, pendingReq - reserveQty),
              status: reserveQty >= pendingReq ? "reservada" : "reserva_parcial",
              estado: reserveQty >= pendingReq ? "reservada" : "reserva_parcial",
              updated_at: now,
            })
            .eq("id", reqItem.id);
          if (reqItemError) throw reqItemError;
        }
      }

      totalReceived += qtyToReceive * cost;
      receivedLines += 1;
    }

    const { data: freshItems, error: freshError } = await supabase
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", purchaseOrderId);
    if (freshError) throw freshError;

    const orderedTotal = (freshItems || []).reduce((sum: number, item: any) => sum + orderedQty(item), 0);
    const receivedTotal = (freshItems || []).reduce((sum: number, item: any) => sum + receivedQty(item), 0);
    const poFinalStatus = receivedTotal >= orderedTotal ? "recibida" : "parcial";

    await supabase
      .from("purchase_receipts")
      .update({ total_received: totalReceived, updated_at: now })
      .eq("id", receipt.id);

    const { error: poUpdateError } = await supabase
      .from("purchase_orders")
      .update({
        status: poFinalStatus,
        estado: poFinalStatus,
        receipt_status: poFinalStatus,
        received_at: poFinalStatus === "recibida" ? now : po.received_at || null,
        received_by_name: "Almacen",
        updated_at: now,
      })
      .eq("id", purchaseOrderId);
    if (poUpdateError) throw poUpdateError;

    if (linkedReq?.id) {
      await supabase
        .from("warehouse_requisitions")
        .update({
          status: "parcial",
          estado: "parcial",
          purchase_status: poFinalStatus,
          updated_at: now,
        })
        .eq("id", linkedReq.id);
    }

    return NextResponse.json({
      ok: true,
      receiptNo,
      purchaseOrderId,
      status: poFinalStatus,
      receivedLines,
      totalReceived,
      createdInventory,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Error recibiendo compra." },
      { status: 500 }
    );
  }
}
