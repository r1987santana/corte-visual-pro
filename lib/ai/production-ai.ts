export type ProductionAlertType = "success" | "warning" | "danger" | "info";

export type ProductionAIAlert = {
  type: ProductionAlertType;
  title: string;
  message: string;
};

export type ProductionRecommendation = {
  title: string;
  message: string;
};

export type ProductionAIInput = {
  orders?: any[];
  items?: any[];
  inventory?: any[];
};

export type ProductionAIResult = {
  score: number;
  status: "saludable" | "atencion" | "riesgo" | "critico";
  totalOrders: number;
  pendingOrders: number;
  processOrders: number;
  delayedOrders: number;
  alerts: ProductionAIAlert[];
  recommendations: ProductionRecommendation[];
};

const n = (v: any) => {
  const parsed = Number(v || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function status(row: any) {
  return String(row?.status || row?.estado || "pendiente").toLowerCase();
}

function stock(row: any) {
  return n(row?.stock ?? row?.quantity ?? row?.qty ?? row?.cantidad);
}

function minStock(row: any) {
  return n(row?.min_stock ?? row?.minimum_stock ?? row?.minimo);
}

function cost(row: any) {
  return n(row?.unit_cost ?? row?.cost_price ?? row?.purchase_cost ?? row?.cost ?? row?.total_cost);
}

function daysOld(value: any) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return 0;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

export function analyzeProduction(input: ProductionAIInput): ProductionAIResult {
  const orders = input.orders || [];
  const items = input.items || [];
  const inventory = input.inventory || [];

  const alerts: ProductionAIAlert[] = [];
  const recommendations: ProductionRecommendation[] = [];

  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => status(o).includes("pendiente") || status(o).includes("aprob")).length;
  const processOrders = orders.filter((o) => status(o).includes("proceso") || status(o).includes("produccion") || status(o).includes("cut")).length;
  const delayedOrders = orders.filter((o) => daysOld(o?.updated_at || o?.created_at) >= 3 && !status(o).includes("final")).length;

  const lowStock = inventory.filter((p) => {
    const min = minStock(p);
    return min > 0 && stock(p) <= min;
  });

  const noStock = inventory.filter((p) => stock(p) <= 0);
  const zeroCost = items.filter((i) => cost(i) <= 0);

  let score = 100;

  if (!totalOrders) {
    score -= 20;
    alerts.push({ type: "info", title: "Sin órdenes", message: "No hay órdenes cargadas para análisis de producción." });
  }

  if (delayedOrders) {
    score -= Math.min(30, delayedOrders * 8);
    alerts.push({ type: "warning", title: "Órdenes atrasadas", message: `${delayedOrders} orden(es) requieren seguimiento.` });
  }

  if (noStock.length) {
    score -= Math.min(35, noStock.length * 4);
    alerts.push({ type: "danger", title: "Material sin stock", message: `${noStock.length} material(es) en cero pueden detener producción.` });
  }

  if (lowStock.length) {
    score -= Math.min(20, lowStock.length * 2);
    alerts.push({ type: "warning", title: "Stock bajo", message: `${lowStock.length} material(es) están cerca del mínimo.` });
  }

  if (zeroCost.length) {
    score -= Math.min(25, zeroCost.length * 3);
    alerts.push({ type: "warning", title: "Costos incompletos", message: `${zeroCost.length} partida(s) tienen costo en cero.` });
  }

  if (!alerts.length) {
    alerts.push({ type: "success", title: "Producción saludable", message: "No hay riesgos críticos detectados." });
  }

  if (pendingOrders > 0) {
    recommendations.push({ title: "Priorizar BOM", message: "Cerrar BOM de órdenes pendientes antes de liberar corte." });
  }

  if (lowStock.length || noStock.length) {
    recommendations.push({ title: "Requisición", message: "Generar solicitud a almacén/compras por materiales críticos." });
  }

  if (processOrders > 0) {
    recommendations.push({ title: "Revisar avance", message: "Validar Corte, Canteo, Ensamble y QA de órdenes en proceso." });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    status: score >= 85 ? "saludable" : score >= 65 ? "atencion" : score >= 40 ? "riesgo" : "critico",
    totalOrders,
    pendingOrders,
    processOrders,
    delayedOrders,
    alerts,
    recommendations,
  };
}
