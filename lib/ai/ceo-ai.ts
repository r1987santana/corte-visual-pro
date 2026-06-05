export type CEOAIResult = {
  score: number;
  health: "excelente" | "bien" | "riesgo" | "critico";
  alerts: { type: "success" | "warning" | "danger" | "info"; title: string; message: string }[];
  priorities: { title: string; message: string }[];
};

const n = (v: any) => {
  const parsed = Number(v || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function analyzeCEO(data: {
  salesTotal?: number;
  profitTotal?: number;
  inventoryValue?: number;
  pendingOrders?: number;
  lowStock?: number;
  noStock?: number;
}): CEOAIResult {
  const alerts: CEOAIResult["alerts"] = [];
  const priorities: CEOAIResult["priorities"] = [];

  const sales = n(data.salesTotal);
  const profit = n(data.profitTotal);
  const margin = sales > 0 ? (profit / sales) * 100 : 0;

  let score = 100;

  if (sales <= 0) {
    score -= 20;
    alerts.push({ type: "warning", title: "Ventas en cero", message: "No hay ventas visibles en el período." });
  }

  if (profit <= 0) {
    score -= 25;
    alerts.push({ type: "danger", title: "Utilidad no visible", message: "La utilidad está en cero o no calculada." });
  }

  if (sales > 0 && margin < 15) {
    score -= 20;
    alerts.push({ type: "warning", title: "Margen bajo", message: `Margen estimado ${margin.toFixed(1)}%.` });
  }

  if (n(data.pendingOrders) > 0) {
    score -= Math.min(20, n(data.pendingOrders) * 4);
    alerts.push({ type: "info", title: "Órdenes activas", message: `${data.pendingOrders} orden(es) requieren seguimiento.` });
  }

  if (n(data.lowStock) > 0 || n(data.noStock) > 0) {
    score -= Math.min(25, n(data.lowStock) + n(data.noStock) * 2);
    alerts.push({ type: "warning", title: "Stock crítico", message: "Hay productos con stock bajo o sin stock." });
  }

  if (!alerts.length) {
    alerts.push({ type: "success", title: "Empresa saludable", message: "No hay riesgos ejecutivos críticos." });
  }

  priorities.push({ title: "Utilidad real", message: "Validar ventas contra costos reales." });
  priorities.push({ title: "Producción", message: "Cerrar órdenes activas con materiales completos." });
  priorities.push({ title: "Inventario", message: "Comprar solo críticos para proteger flujo de caja." });

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    health: score >= 85 ? "excelente" : score >= 65 ? "bien" : score >= 40 ? "riesgo" : "critico",
    alerts,
    priorities,
  };
}
