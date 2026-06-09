import type { ProductionRequisitionGate } from "@/lib/productionRequisitionGate";

type ProductionStatusSnapshot = Record<string, any> | null | undefined;

const MATERIALS_DISPATCHED_STATUSES = new Set([
  "materiales_despachados",
  "material_despachado",
  "despachada",
  "despachado",
  "almacen_despachado",
  "ready_for_cutting",
  "listo_corte",
  "liberado_corte",
]);

export function cleanProductionStatus(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function isMaterialsDispatchedOrder(row: ProductionStatusSnapshot) {
  if (!row) return false;
  if (row.ready_for_cutting === true) return true;

  const statuses = [
    row.status,
    row.estado,
    row.inventory_status,
    row.cutting_status,
    row.material_status,
    row.requisition_status,
  ].map(cleanProductionStatus);

  return statuses.some((status) => MATERIALS_DISPATCHED_STATUSES.has(status));
}

export function buildLocalMaterialsDispatchedGate({
  orderSnapshot,
  orderCodeOverride,
  fallbackOrderCode,
  productionOrderId,
}: {
  orderSnapshot: ProductionStatusSnapshot;
  orderCodeOverride?: string | null;
  fallbackOrderCode?: string | null;
  productionOrderId?: string | null;
}): ProductionRequisitionGate | null {
  if (!isMaterialsDispatchedOrder(orderSnapshot)) return null;

  const code = String(
    orderSnapshot?.order_code ||
      orderSnapshot?.code ||
      orderCodeOverride ||
      fallbackOrderCode ||
      productionOrderId ||
      "OP"
  );
  const status = cleanProductionStatus(
    orderSnapshot?.status ||
      orderSnapshot?.estado ||
      orderSnapshot?.cutting_status ||
      "materiales_despachados"
  );

  return {
    canCut: true,
    status: "ready",
    title: "Materiales liberados",
    message: `Orden ${code} marcada como ${status}. Corte puede continuar.`,
    requisitionStatus: status,
    missingQty: 0,
  };
}
