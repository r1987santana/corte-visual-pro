export type QuoteAiItem = {
  product_id?: string | null;
  product_name: string;
  quantity: number;
  price: number;
  cost_price?: number;
  subtotal?: number;
  stock?: number;
  item_type?: "producto" | "servicio" | string;
};

export type QuoteAiContext = {
  module?: string;
  mode?: "articulos" | "servicio" | string;
  clientName?: string;
  clientPhone?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  costTotal?: number;
  profitTotal?: number;
  margin?: number;
  items?: QuoteAiItem[];
  serviceStats?: {
    piecesTotal?: number;
    cutFeet?: number;
    edgeMeters?: number;
    cncQty?: number;
    estimatedBoards?: number;
    wastePercent?: number;
  };
  nesting?: {
    boards?: number;
    wastePercent?: number;
    oversized?: number;
  };
};

export type QuoteAiAlert = {
  level: "ok" | "info" | "warning" | "danger";
  title: string;
  message: string;
};

export type QuoteAiRecommendation = {
  title: string;
  detail: string;
  action?: string;
};

export type QuoteAiAnalysis = {
  score: number;
  health: "excelente" | "bien" | "riesgo" | "critico";
  summary: string;
  alerts: QuoteAiAlert[];
  recommendations: QuoteAiRecommendation[];
  nextSteps: string[];
};

function n(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function pct(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

export function analyzeCotizacionContext(context: QuoteAiContext): QuoteAiAnalysis {
  const items = Array.isArray(context.items) ? context.items : [];
  const subtotal = n(context.subtotal);
  const total = n(context.total);
  const costTotal = n(context.costTotal);
  const profitTotal = n(context.profitTotal);
  const margin = subtotal > 0 ? (profitTotal / subtotal) * 100 : n(context.margin);
  const mode = context.mode || "articulos";

  const alerts: QuoteAiAlert[] = [];
  const recommendations: QuoteAiRecommendation[] = [];
  const nextSteps: string[] = [];

  if (items.length === 0) {
    alerts.push({
      level: "info",
      title: "Cotización vacía",
      message: "Agrega productos o despiece para que la IA pueda analizar utilidad, stock y riesgo.",
    });
  }

  if (subtotal > 0 && margin < 15) {
    alerts.push({
      level: "danger",
      title: "Margen crítico",
      message: `El margen estimado es ${pct(margin)}. Revisa precio, costo o descuento antes de enviar.`,
    });
    recommendations.push({
      title: "Subir precio o ajustar costo",
      detail: `Para una operación saludable, intenta llevar esta cotización por encima de 25% de margen.`,
      action: "recomendar_precio",
    });
  } else if (subtotal > 0 && margin < 25) {
    alerts.push({
      level: "warning",
      title: "Margen bajo",
      message: `Margen actual ${pct(margin)}. Puede ser aceptable solo si es cliente estratégico o venta rápida.`,
    });
  } else if (subtotal > 0) {
    alerts.push({
      level: "ok",
      title: "Margen saludable",
      message: `Margen estimado ${pct(margin)} con utilidad aproximada de ${money(profitTotal)}.`,
    });
  }

  const noCostItems = items.filter((item) => n(item.cost_price) <= 0 && item.item_type !== "servicio");
  if (noCostItems.length > 0) {
    alerts.push({
      level: "warning",
      title: "Productos sin costo",
      message: `${noCostItems.length} producto(s) no tienen costo. La utilidad puede estar inflada.`,
    });
    recommendations.push({
      title: "Completar costos de inventario",
      detail: noCostItems.slice(0, 3).map((i) => i.product_name).join(", "),
      action: "revisar_costos",
    });
  }

  const noStockItems = items.filter((item) => typeof item.stock === "number" && n(item.stock) < n(item.quantity));
  if (noStockItems.length > 0) {
    alerts.push({
      level: "danger",
      title: "Stock insuficiente",
      message: `${noStockItems.length} producto(s) podrían no tener existencia suficiente para vender.`,
    });
    recommendations.push({
      title: "Generar alerta de compra",
      detail: "Revisa inventario antes de convertir esta cotización a venta.",
      action: "recomendar_compra",
    });
  }

  if (mode === "servicio") {
    const waste = n(context.serviceStats?.wastePercent ?? context.nesting?.wastePercent);
    const boards = n(context.serviceStats?.estimatedBoards ?? context.nesting?.boards);
    const oversized = n(context.nesting?.oversized);

    if (boards > 0) {
      alerts.push({
        level: waste > 35 ? "warning" : "ok",
        title: "Optimización de plancha",
        message: `Estimado: ${boards} plancha(s), merma aproximada ${pct(waste)}.`,
      });
    }

    if (waste > 35) {
      recommendations.push({
        title: "Revisar orientación y plancha",
        detail: "La merma está alta. Prueba plancha 7x8, reordenar piezas o revisar si la veta permite rotación.",
        action: "optimizar_corte",
      });
    }

    if (oversized > 0) {
      alerts.push({
        level: "danger",
        title: "Piezas fuera de plancha",
        message: `${oversized} pieza(s) no caben en la dimensión de plancha seleccionada.`,
      });
    }
  }

  if (subtotal > 0 && total > 0) {
    nextSteps.push("Confirmar datos del cliente antes de guardar o enviar.");
    nextSteps.push("Revisar margen y costos antes de convertir a venta.");
  }

  if (mode === "servicio") {
    nextSteps.push("Validar medidas del despiece con el cliente.");
    nextSteps.push("Generar orden interna de corte después del pago.");
  } else {
    nextSteps.push("Verificar stock antes de vender y descontar inventario.");
  }

  let score = 100;
  score -= alerts.filter((a) => a.level === "danger").length * 30;
  score -= alerts.filter((a) => a.level === "warning").length * 15;
  if (items.length === 0) score = 40;
  score = Math.max(0, Math.min(100, score));

  const health = score >= 85 ? "excelente" : score >= 70 ? "bien" : score >= 45 ? "riesgo" : "critico";

  return {
    score,
    health,
    summary:
      items.length === 0
        ? "Aún no hay información suficiente para analizar la cotización."
        : `Cotización con ${items.length} línea(s), subtotal ${money(subtotal)}, utilidad ${money(profitTotal)} y margen ${pct(margin)}.`,
    alerts,
    recommendations,
    nextSteps,
  };
}

export function buildCotizacionesLocalAnswer(
  message: string,
  context: QuoteAiContext & {
    pathname?: string;
    cartItems?: QuoteAiItem[];
    visibleText?: string;
    screenNumbers?: number[];
    piecesCount?: number;
    boardSize?: string;
    cutFeet?: number;
    edgeMeters?: number;
    cncQty?: number;
    wastePercent?: number;
  }
) {
  const analysis = analyzeCotizacionContext({
    ...context,
    items: context.items || context.cartItems || [],
    serviceStats: {
      piecesTotal: context.piecesCount,
      cutFeet: context.cutFeet,
      edgeMeters: context.edgeMeters,
      cncQty: context.cncQty,
      wastePercent: context.wastePercent,
      ...context.serviceStats,
    },
  });

  return [
    "### Cotizaciones IA",
    analysis.summary,
    "",
    "### Alertas",
    analysis.alerts.length
      ? analysis.alerts.map((alert) => `- ${alert.title}: ${alert.message}`).join("\n")
      : "- Sin alertas criticas detectadas.",
    "",
    "### Recomendaciones",
    analysis.recommendations.length
      ? analysis.recommendations.map((item) => `- ${item.title}: ${item.detail}`).join("\n")
      : "- Mantener precio, costo y datos del cliente validados.",
    "",
    "### Proximo paso",
    analysis.nextSteps[0] || "Completar datos y revisar margen antes de enviar.",
    message ? `\nSolicitud recibida: ${message}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
