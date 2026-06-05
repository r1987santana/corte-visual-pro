// ============================================================================
// RD WOOD SYSTEM - INDUSTRIAL RISK ENGINE
// ============================================================================

import type { WorkflowState } from "./workflow-engine";

type AnalyzeRiskInput = {
  inventory?: any[];
  bom?: any[];
  order?: any;
  sales?: any[];
  quotes?: any[];
  payments?: any[];
  workflow?: WorkflowState;
};

function n(value: any) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function text(value: any) {
  return String(value || "").trim();
}

function isService(item: any) {
  const group = text(item.grupo || item.group_name || item.category).toLowerCase();
  const unit = text(item.unidad || item.unit).toLowerCase();
  return group.includes("servicio") || unit.includes("servicio");
}

function costOf(item: any) {
  return n(item.cost ?? item.cost_price ?? item.unit_cost ?? item.costo_promedio ?? item.costo_prom);
}

function stockOf(item: any) {
  return n(item.stock ?? item.quantity ?? item.stock_qty);
}

function minOf(item: any) {
  return n(item.min_stock ?? item.minimum_stock ?? item.minimo);
}

function nameOf(item: any) {
  return text(item.material || item.name || item.product_name || item.item_name || item.product_name);
}

export function analyzeRisks(input: AnalyzeRiskInput): string[] {
  const risks: string[] = [];
  const inventory = input.inventory || [];
  const bom = input.bom || [];
  const order = input.order || {};
  const sales = input.sales || [];
  const quotes = input.quotes || [];
  const workflow = input.workflow;

  if (workflow?.blocked) {
    risks.push(`Bloqueo de flujo: ${workflow.reason || workflow.stageLabel || workflow.stage}.`);
  }

  if (inventory.length <= 0) {
    risks.push("Inventario maestro vacio o no cargado.");
  }

  const criticalStock = inventory.filter((item) => {
    const min = minOf(item);
    if (isService(item) || min <= 0) return false;
    return stockOf(item) <= min;
  });

  if (criticalStock.length > 0) {
    risks.push(`${criticalStock.length} articulo(s) tienen stock critico.`);
  }

  const reservedOverStock = inventory.filter((item) => {
    const reserved = n(item.reserved_stock ?? item.stock_reserved);
    return reserved > stockOf(item);
  });

  if (reservedOverStock.length > 0) {
    risks.push(`${reservedOverStock.length} articulo(s) tienen reserva mayor que existencia.`);
  }

  const invalidCost = inventory.filter((item) => !isService(item) && costOf(item) <= 0);

  if (invalidCost.length > 0) {
    const examples = invalidCost.slice(0, 3).map(nameOf).filter(Boolean).join(", ");
    risks.push(`${invalidCost.length} material(es) tienen costo cero o invalido${examples ? `: ${examples}` : ""}.`);
  }

  const uncategorized = inventory.filter((item) => {
    return !text(item.grupo || item.group_name || item.category) || !text(item.subgrupo || item.subcategory);
  });

  if (uncategorized.length > 0) {
    risks.push(`${uncategorized.length} articulo(s) no tienen grupo/subgrupo completo.`);
  }

  const hasOrder = order && typeof order === "object" && Object.keys(order).length > 0;

  if (hasOrder && !text(order.client_name || order.client || order.customer_name)) {
    risks.push("La orden actual no tiene cliente asignado.");
  }

  if (hasOrder && bom.length <= 0 && ["released", "produccion", "in_process", "en_proceso"].includes(text(order.status))) {
    risks.push("La orden fue liberada sin BOM cargado.");
  }

  const badQuotes = quotes.filter((quote) => {
    const margin = n(quote.margin ?? quote.margin_percent);
    const total = n(quote.total ?? quote.amount);
    return total > 0 && margin > 0 && margin <= 15;
  });

  if (badQuotes.length > 0) {
    risks.push(`${badQuotes.length} cotizacion(es) tienen margen bajo o peligroso.`);
  }

  const zeroTotalQuotes = quotes.filter((quote) => {
    return n(quote.total ?? quote.amount) <= 0 && ["draft", "borrador", "pendiente"].includes(text(quote.status));
  });

  if (zeroTotalQuotes.length > 0) {
    risks.push(`${zeroTotalQuotes.length} cotizacion(es) pendientes tienen total en cero.`);
  }

  const totalSales = sales.reduce((acc, item) => acc + n(item.total), 0);

  if (sales.length > 0 && totalSales <= 0) {
    risks.push("Hay ventas registradas, pero el total acumulado esta en cero.");
  }

  if (bom.length > 300) {
    risks.push("BOM extremadamente grande. Revisar optimizacion por modulos.");
  }

  if (hasOrder && n(order.total_cost ?? order.cost_total) <= 0 && bom.length > 0) {
    risks.push("La orden tiene BOM, pero costo total RD$0.00.");
  }

  return risks;
}
