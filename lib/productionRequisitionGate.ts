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

function itemMissingQty(item: any) {
  const explicit = n(item?.cantidad_faltante ?? item?.qty_missing ?? item?.missing_qty ?? item?.faltante);
  if (explicit > 0) return explicit;

  const requested = n(item?.qty_requested ?? item?.quantity_requested ?? item?.cantidad_solicitada ?? item?.quantity ?? item?.qty);
  const dispatched = n(item?.qty_dispatched ?? item?.quantity_dispatched ?? item?.cantidad_despachada);
  const reserved = n(item?.qty_reserved ?? item?.quantity_reserved ?? item?.cantidad_reservada);
  const covered = Math.max(dispatched, reserved);

  return requested > 0 ? Math.max(0, requested - covered) : 0;
}

export async function getProductionRequisitionGate(productionOrderId?: string | null): Promise<ProductionRequisitionGate> {
  if (!productionOrderId) {
    return {
      canCut: true,
      status: "manual",
      title: "Modo manual",
      message: "No hay orden de produccion vinculada. La compuerta de requisicion aplica a ordenes reales.",
    };
  }

  try {
    const { data: requisitions, error } = await supabase
      .from("warehouse_requisitions")
      .select("*")
      .eq("production_order_id", productionOrderId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    const requisition = Array.isArray(requisitions) ? requisitions[0] : null;
    if (!requisition) {
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
