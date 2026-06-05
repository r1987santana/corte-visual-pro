// ============================================================================
// RD WOOD SYSTEM - PRODUCTION / CUT AI ANALYZER
// ============================================================================

export type ProductionAIInsight = {
  summary: string;
  recommendations: string[];
  blockers: string[];
  pieceStats: {
    total: number;
    byStatus: Record<string, number>;
    modules: number;
  };
  bomStats: {
    total: number;
    linked: number;
    unlinked: number;
    estimatedCost: number;
  };
};

function n(value: any) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function text(value: any, fallback = "") {
  const result = String(value || "").trim();
  return result || fallback;
}

function statusOf(piece: any) {
  return text(piece.current_status || piece.status || piece.new_status, "pendiente").toLowerCase();
}

function productName(item: any) {
  return text(item.product_name || item.item_name || item.material_name || item.material || item.name, "Material sin nombre");
}

function inventoryName(item: any) {
  return text(item.material || item.name || item.product_name, "");
}

function quantityOf(item: any) {
  return n(item.quantity ?? item.qty ?? item.quantity_required ?? item.cantidad_solicitada ?? 1);
}

function costOf(item: any) {
  return n(item.unit_cost ?? item.cost_price ?? item.cost ?? item.costo_promedio);
}

function hasLinkedInventory(item: any) {
  return Boolean(item.inventory_item_id || item.inventory_id || item.product_id || item.material_id || item.item_id);
}

function normalize(value: any) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findInventoryMatch(item: any, inventory: any[]) {
  const wanted = normalize(productName(item));
  if (!wanted) return null;

  return inventory.find((inv) => {
    const haystack = normalize(`${inventoryName(inv)} ${inv.code || ""} ${inv.grupo || ""} ${inv.subgrupo || ""}`);
    return haystack.includes(wanted) || wanted.includes(haystack);
  });
}

export function analyzeProductionFlowAI({
  order,
  bom,
  inventory,
  pieceLabels,
}: {
  order?: any;
  bom?: any[];
  inventory?: any[];
  pieceLabels?: any[];
}): ProductionAIInsight {
  const bomRows = bom || [];
  const inventoryRows = inventory || [];
  const pieces = pieceLabels || [];
  const blockers: string[] = [];
  const recommendations: string[] = [];

  const byStatus: Record<string, number> = {};
  const modules = new Set<string>();

  for (const piece of pieces) {
    const status = statusOf(piece);
    byStatus[status] = (byStatus[status] || 0) + 1;
    const moduleName = text(piece.module_name);
    if (moduleName) modules.add(moduleName);
  }

  const linked = bomRows.filter(hasLinkedInventory).length;
  const unlinked = bomRows.length - linked;
  const estimatedCost = bomRows.reduce((acc, item) => acc + quantityOf(item) * costOf(item), 0);

  if (!order || Object.keys(order || {}).length <= 0) {
    recommendations.push("No hay orden activa. Cuando entre una orden, la IA debe exigir BOM y requisicion antes de corte.");
  }

  if (bomRows.length <= 0) {
    blockers.push("No hay BOM cargado para produccion.");
    recommendations.push("Crear BOM desde render/cotizacion antes de liberar corte.");
  }

  if (unlinked > 0) {
    blockers.push(`${unlinked} linea(s) BOM no estan vinculadas a inventario.`);
    recommendations.push("Vincular cada material BOM contra inventory para requisicion y descuento real.");
  }

  const shortageLines = bomRows.filter((item) => {
    const inv = findInventoryMatch(item, inventoryRows);
    if (!inv) return false;
    return n(inv.stock ?? inv.quantity) < quantityOf(item);
  });

  if (shortageLines.length > 0) {
    blockers.push(`${shortageLines.length} material(es) no tienen existencia suficiente.`);
    recommendations.push("Enviar faltantes a requisicion/OC antes de cortar.");
  }

  if (pieces.length <= 0 && bomRows.length > 0) {
    recommendations.push("Generar etiquetas/piezas de trazabilidad desde la optimizacion de corte.");
  }

  if (pieces.length > 0) {
    const pending = Object.entries(byStatus)
      .filter(([status]) => status.includes("pendiente"))
      .reduce((acc, [, count]) => acc + count, 0);
    const cut = Object.entries(byStatus)
      .filter(([status]) => status.includes("cort"))
      .reduce((acc, [, count]) => acc + count, 0);
    const packed = Object.entries(byStatus)
      .filter(([status]) => status.includes("empac") || status.includes("instal"))
      .reduce((acc, [, count]) => acc + count, 0);

    recommendations.push(`Piezas: ${pieces.length}. Pendientes: ${pending}. Cortadas: ${cut}. Empacadas/instaladas: ${packed}.`);

    if (pending > 0) {
      recommendations.push("Priorizar piezas pendientes y evitar mover un modulo completo si faltan piezas internas.");
    }
  }

  if (estimatedCost <= 0 && bomRows.length > 0) {
    blockers.push("BOM con costo estimado en cero.");
    recommendations.push("Corregir costos antes de aprobar margen y consumo.");
  }

  const summary = [
    `Orden: ${text(order?.order_code || order?.code || order?.id, "sin orden activa")}`,
    `BOM: ${bomRows.length} linea(s), ${linked} vinculada(s), ${unlinked} pendiente(s)`,
    `Piezas: ${pieces.length} en ${modules.size} modulo(s)`,
    `Costo estimado: RD$${estimatedCost.toLocaleString("es-DO", { maximumFractionDigits: 2 })}`,
  ].join(" | ");

  if (blockers.length <= 0 && bomRows.length > 0) {
    recommendations.push("Produccion puede avanzar si la requisicion esta autorizada y almacen despacho.");
  }

  return {
    summary,
    recommendations,
    blockers,
    pieceStats: {
      total: pieces.length,
      byStatus,
      modules: modules.size,
    },
    bomStats: {
      total: bomRows.length,
      linked,
      unlinked,
      estimatedCost,
    },
  };
}
