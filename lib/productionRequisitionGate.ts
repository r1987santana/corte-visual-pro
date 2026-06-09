import { supabase } from "@/lib/supabase";

export type ProductionRequisitionGate = {
  canCut: boolean;
  status: "manual" | "blocked" | "ready";
  title: string;
  message: string;
  requisitionCode?: string;
  requisitionStatus?: string;
  missingQty?: number;
};

function cleanStatus(value: any) {
  return String(value || "").toLowerCase().trim();
}

function n(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function reqCode(row: any) {
  return row?.code || row?.requisition_no || row?.numero || "REQ-SIN-CODIGO";
}

function cleanLookup(value: any) {
  return String(value || "").trim();
}

function cleanToken(value: any) {
  return cleanLookup(value).replace(/[^a-zA-Z0-9_-]/g, "");
}

function orderCodeTokens(productionOrderId?: string | null, orderCode?: string | null) {
  const rawTokens = [cleanToken(productionOrderId), cleanToken(orderCode)];
  const code = cleanToken(orderCode);

  if (code.length > 8) {
    rawTokens.push(code.slice(-12));
  }

  const codeParts = cleanLookup(orderCode).split(/[-_\s]+/).filter(Boolean);
  for (const part of codeParts) {
    if (part.length >= 4) rawTokens.push(cleanToken(part));
  }

  return Array.from(new Set(rawTokens.filter((token) => token.length >= 6)));
}

async function findRequisition(productionOrderId?: string | null, orderCode?: string | null) {
  const id = cleanLookup(productionOrderId);
  let lastError: any = null;

  if (id) {
    const { data, error } = await supabase
      .from("warehouse_requisitions")
      .select("*")
      .eq("production_order_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      lastError = error;
    } else if (Array.isArray(data) && data[0]) {
      return data[0];
    }
  }

  for (const token of orderCodeTokens(productionOrderId, orderCode)) {
    const pattern = `%${token}%`;
    const { data, error } = await supabase
      .from("warehouse_requisitions")
      .select("*")
      .or(
        [
          `code.ilike.${pattern}`,
          `requisition_no.ilike.${pattern}`,
          `req_number.ilike.${pattern}`,
          `reason.ilike.${pattern}`,
          `notes.ilike.${pattern}`,
          `project_reference.ilike.${pattern}`,
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      lastError = error;
      continue;
    }

    if (Array.isArray(data) && data[0]) {
      return data[0];
    }
  }

  if (lastError && !id && !cleanLookup(orderCode)) throw lastError;
  return null;
}

async function findProductionOrder(productionOrderId?: string | null, orderCode?: string | null) {
  const id = cleanLookup(productionOrderId);
  if (id) {
    const { data } = await supabase
      .from("production_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (data) return data;
  }

  for (const token of orderCodeTokens(productionOrderId, orderCode)) {
    const pattern = `%${token}%`;
    const { data } = await supabase
      .from("production_orders")
      .select("*")
      .or(
        [
          `code.ilike.${pattern}`,
          `order_code.ilike.${pattern}`,
          `order_number.ilike.${pattern}`,
          `notes.ilike.${pattern}`,
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(1);

    if (Array.isArray(data) && data[0]) return data[0];
  }

  return null;
}

function orderMaterialsDispatched(order: any) {
  const status = cleanStatus(order?.status || order?.estado || order?.inventory_status || order?.cutting_status);
  return new Set([
    "materiales_despachados",
    "material_despachado",
    "despachada",
    "despachado",
    "ready_for_cutting",
    "listo_corte",
    "liberado_corte",
  ]).has(status);
}

function itemMissingQty(item: any) {
  const explicit = n(item?.cantidad_faltante ?? item?.qty_missing ?? item?.missing_qty ?? item?.faltante);
  if (explicit > 0) return explicit;

  const requested = n(item?.qty_requested ?? item?.quantity_requested ?? item?.cantidad_solicitada ?? item?.quantity ?? item?.qty);
  const dispatched = n(item?.qty_dispatched ?? item?.quantity_dispatched ?? item?.cantidad_despachada);
  const reserved = n(item?.qty_reserved ?? item?.quantity_reserved ?? item?.cantidad_reservada);
  const covered = Math.max(dispatched, reserved);

  return requested > 0 ? Math.max(0, requested - covered) : 0;
}

export async function getProductionRequisitionGate(
  productionOrderId?: string | null,
  orderCode?: string | null
): Promise<ProductionRequisitionGate> {
  if (!productionOrderId && !orderCode) {
    return {
      canCut: true,
      status: "manual",
      title: "Modo manual",
      message: "No hay orden de produccion vinculada. La compuerta de requisicion aplica a ordenes reales.",
    };
  }

  try {
    const requisition = await findRequisition(productionOrderId, orderCode);
    if (!requisition) {
      const order = await findProductionOrder(productionOrderId, orderCode);
      if (orderMaterialsDispatched(order)) {
        const code = cleanLookup(order?.order_code || order?.code || orderCode || productionOrderId || "OP");
        const status = cleanStatus(order?.status || order?.estado || order?.inventory_status || order?.cutting_status);

        return {
          canCut: true,
          status: "ready",
          title: "Materiales liberados",
          message: `Orden ${code} marcada como ${status}. Corte puede continuar.`,
          requisitionStatus: status,
          missingQty: 0,
        };
      }

      return {
        canCut: false,
        status: "blocked",
        title: "Falta requisicion de materiales",
        message: "Produccion necesita crear la requisicion BOM en el Centro de Requisiciones antes de cortar.",
      };
    }

    const { data: items, error: itemsError } = await supabase
      .from("warehouse_requisition_items")
      .select("*")
      .or(`warehouse_requisition_id.eq.${requisition.id},requisition_id.eq.${requisition.id}`);

    if (itemsError) throw itemsError;

    const missingQty = (items || []).reduce((sum, item) => sum + itemMissingQty(item), 0);
    const status = cleanStatus(requisition.status || requisition.estado);
    const readyStatuses = new Set(["despachada", "cerrada", "completada", "completed", "closed"]);
    const code = reqCode(requisition);

    if (missingQty > 0) {
      return {
        canCut: false,
        status: "blocked",
        title: "Requisicion con faltantes",
        message: `La requisicion ${code} tiene ${missingQty} unidad(es) faltante(s). Genera compra o resuelve el faltante antes de cortar.`,
        requisitionCode: code,
        requisitionStatus: status,
        missingQty,
      };
    }

    if (!readyStatuses.has(status)) {
      return {
        canCut: false,
        status: "blocked",
        title: "Requisicion pendiente de despacho",
        message: `La requisicion ${code} esta en estado ${status || "pendiente"}. Centro de Requisiciones debe despachar antes de cortar.`,
        requisitionCode: code,
        requisitionStatus: status,
        missingQty,
      };
    }

    return {
      canCut: true,
      status: "ready",
      title: "Materiales liberados",
      message: `Requisicion ${code} despachada. Corte puede continuar.`,
      requisitionCode: code,
      requisitionStatus: status,
      missingQty,
    };
  } catch (error: any) {
    return {
      canCut: false,
      status: "blocked",
      title: "No se pudo validar requisicion",
      message: `Valida el Centro de Requisiciones antes de cortar. Detalle: ${error?.message || error}`,
    };
  }
}
