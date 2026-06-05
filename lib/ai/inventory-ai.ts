// ============================================================================
// RD WOOD SYSTEM - INVENTORY AI ANALYZER
// ============================================================================

export type InventoryAIItem = {
  code?: string | null;
  material?: string | null;
  name?: string | null;
  product_name?: string | null;
  grupo?: string | null;
  group_name?: string | null;
  category?: string | null;
  subgrupo?: string | null;
  subcategory?: string | null;
  unidad?: string | null;
  unit?: string | null;
  stock?: number | null;
  quantity?: number | null;
  min_stock?: number | null;
  minimum_stock?: number | null;
  minimo?: number | null;
  cost?: number | null;
  cost_price?: number | null;
  unit_cost?: number | null;
  costo_promedio?: number | null;
  costo_prom?: number | null;
  sale_price?: number | null;
  price?: number | null;
  venta?: number | null;
  reserved_stock?: number | null;
  stock_reserved?: number | null;
  status?: string | null;
};

export type InventoryAIInsight = {
  healthScore: number;
  summary: string;
  recommendations: string[];
  purchaseCandidates: {
    code: string;
    name: string;
    group: string;
    stock: number;
    min: number;
    suggestedQty: number;
  }[];
  groupSummary: {
    group: string;
    items: number;
    stockValue: number;
    critical: number;
  }[];
};

function n(value: any) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function text(value: any, fallback = "") {
  const result = String(value || "").trim();
  return result || fallback;
}

function itemName(item: InventoryAIItem) {
  return text(item.material || item.name || item.product_name, "Articulo sin nombre");
}

function itemCode(item: InventoryAIItem) {
  return text(item.code, "SIN-CODIGO");
}

function itemGroup(item: InventoryAIItem) {
  return text(item.grupo || item.group_name || item.category, "SIN-GRUPO").toUpperCase();
}

function itemSubgroup(item: InventoryAIItem) {
  return text(item.subgrupo || item.subcategory, "SIN-SUBGRUPO");
}

function stockOf(item: InventoryAIItem) {
  return n(item.stock ?? item.quantity);
}

function minOf(item: InventoryAIItem) {
  return n(item.min_stock ?? item.minimum_stock ?? item.minimo);
}

function costOf(item: InventoryAIItem) {
  return n(item.cost ?? item.cost_price ?? item.unit_cost ?? item.costo_promedio ?? item.costo_prom);
}

function saleOf(item: InventoryAIItem) {
  return n(item.sale_price ?? item.price ?? item.venta);
}

function reservedOf(item: InventoryAIItem) {
  return n(item.reserved_stock ?? item.stock_reserved);
}

function isActive(item: InventoryAIItem) {
  const status = text(item.status, "active").toLowerCase();
  return status === "active" || status === "activo";
}

function isService(item: InventoryAIItem) {
  const group = itemGroup(item).toLowerCase();
  const unit = text(item.unidad || item.unit).toLowerCase();
  return group.includes("servicio") || unit.includes("servicio");
}

export function analyzeInventoryAI(items: InventoryAIItem[]): InventoryAIInsight {
  const active = (items || []).filter(isActive);
  const physical = active.filter((item) => !isService(item));
  const critical = physical.filter((item) => minOf(item) > 0 && stockOf(item) <= minOf(item));
  const zeroCost = physical.filter((item) => costOf(item) <= 0);
  const zeroSale = physical.filter((item) => saleOf(item) <= 0);
  const missingGroup = physical.filter((item) => itemGroup(item) === "SIN-GRUPO" || itemSubgroup(item) === "SIN-SUBGRUPO");
  const overReserved = physical.filter((item) => reservedOf(item) > stockOf(item));

  const groupMap = new Map<string, { group: string; items: number; stockValue: number; critical: number }>();

  for (const item of active) {
    const group = itemGroup(item);
    const current = groupMap.get(group) || { group, items: 0, stockValue: 0, critical: 0 };
    current.items += 1;
    current.stockValue += stockOf(item) * costOf(item);
    if (minOf(item) > 0 && stockOf(item) <= minOf(item)) current.critical += 1;
    groupMap.set(group, current);
  }

  const groupSummary = Array.from(groupMap.values()).sort((a, b) => b.stockValue - a.stockValue);

  const purchaseCandidates = critical
    .map((item) => {
      const min = minOf(item);
      const stock = stockOf(item);
      return {
        code: itemCode(item),
        name: itemName(item),
        group: itemGroup(item),
        stock,
        min,
        suggestedQty: Math.max(min * 2 - stock, min, 1),
      };
    })
    .sort((a, b) => b.suggestedQty - a.suggestedQty)
    .slice(0, 8);

  const penalties =
    critical.length * 4 +
    zeroCost.length * 3 +
    zeroSale.length * 2 +
    missingGroup.length * 3 +
    overReserved.length * 5;

  const healthScore = Math.max(0, Math.min(100, 100 - penalties));
  const topGroups = groupSummary.slice(0, 4).map((group) => `${group.group}: ${group.items}`).join(" | ");

  const recommendations: string[] = [];

  if (active.length <= 0) {
    recommendations.push("Cargar catalogo maestro antes de iniciar pruebas.");
  } else {
    recommendations.push(`Catalogo listo: ${active.length} articulos activos en ${groupSummary.length} grupos.`);
  }

  if (topGroups) {
    recommendations.push(`Grupos principales: ${topGroups}.`);
  }

  if (critical.length > 0) {
    recommendations.push(`Preparar compra para ${critical.length} articulo(s) en stock critico.`);
  }

  if (zeroCost.length > 0) {
    recommendations.push(`Corregir costos de ${zeroCost.length} articulo(s) antes de cotizar o producir.`);
  }

  if (zeroSale.length > 0) {
    recommendations.push(`Revisar precio de venta en ${zeroSale.length} articulo(s) fisicos.`);
  }

  if (missingGroup.length > 0) {
    recommendations.push(`Completar grupo/subgrupo en ${missingGroup.length} articulo(s).`);
  }

  if (overReserved.length > 0) {
    recommendations.push(`Resolver ${overReserved.length} reserva(s) mayores al stock fisico.`);
  }

  if (purchaseCandidates.length <= 0 && active.length > 0) {
    recommendations.push("No hay compras urgentes segun stock minimo actual.");
  }

  return {
    healthScore,
    summary: `Salud inventario ${healthScore}%. Articulos: ${active.length}. Criticos: ${critical.length}. Valor grupos: ${groupSummary.length}.`,
    recommendations,
    purchaseCandidates,
    groupSummary,
  };
}
