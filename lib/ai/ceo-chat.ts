export type CEOChatContext = {
  message?: string;
  screenContext?: any;
  pageData?: any;
  sales?: any[];
  orders?: any[];
  inventory?: any[];
  quotes?: any[];
  projects?: any[];
};

const n = (value: any) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const txt = (value: any) => String(value ?? "").trim();

function bodyText(ctx: CEOChatContext) {
  return txt(
    ctx.screenContext?.visibleText ||
      ctx.pageData?.visibleText ||
      ctx.pageData?.screenContext?.visibleText ||
      ""
  );
}

function money(value: any) {
  return `RD$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function extractMoneyAfter(text: string, label: string) {
  const re = new RegExp(`${label}\\s*[:\\n ]+\\s*RD\\$?\\s*([0-9,.]+)`, "i");
  const m = text.match(re);
  return m?.[1] ? n(String(m[1]).replace(/,/g, "")) : 0;
}

function extractPercentAfter(text: string, label: string) {
  const re = new RegExp(`${label}\\s*[:\\n ]+\\s*([0-9,.]+)%`, "i");
  const m = text.match(re);
  return m?.[1] ? n(String(m[1]).replace(/,/g, "")) : 0;
}

function rowAmount(row: any) {
  return n(row?.total || row?.amount || row?.grand_total || row?.subtotal || row?.price || row?.monto);
}

function rowCost(row: any) {
  return n(row?.cost || row?.total_cost || row?.cost_total || row?.costo || row?.purchase_cost);
}

function stock(row: any) {
  return n(row?.stock ?? row?.quantity ?? row?.qty ?? row?.cantidad);
}

function minStock(row: any) {
  return n(row?.min_stock ?? row?.minimum_stock ?? row?.minimo);
}

function summarizeCEO(ctx: CEOChatContext) {
  const visible = bodyText(ctx);
  const lower = visible.toLowerCase();

  const sales = ctx.sales || [];
  const orders = ctx.orders || [];
  const inventory = ctx.inventory || [];
  const quotes = ctx.quotes || [];
  const projects = ctx.projects || [];

  const screenHealth = extractPercentAfter(visible, "Health Score");
  const screenSales = extractMoneyAfter(visible, "Ventas Totales");
  const screenProfit = extractMoneyAfter(visible, "Utilidad Total");
  const screenInventoryValue = extractMoneyAfter(visible, "Inventario Valor");
  const screenMargin = extractPercentAfter(visible, "Margen");

  const salesTotal = sales.reduce((sum, row) => sum + rowAmount(row), 0) || screenSales;
  const costTotal = sales.reduce((sum, row) => sum + rowCost(row), 0);
  const profitTotal = screenProfit || Math.max(salesTotal - costTotal, 0);
  const margin = salesTotal > 0 ? (profitTotal / salesTotal) * 100 : screenMargin;

  const pendingOrders = orders.filter((o) => {
    const s = String(o?.status || o?.estado || "").toLowerCase();
    return s.includes("pendiente") || s.includes("proceso") || s.includes("produccion");
  }).length;

  const lowStock = inventory.filter((p) => {
    const min = minStock(p);
    return min > 0 && stock(p) <= min;
  });

  const noStock = inventory.filter((p) => stock(p) <= 0);

  const risks: string[] = [];

  if (salesTotal <= 0) risks.push("Ventas del período en cero.");
  if (profitTotal <= 0) risks.push("Utilidad total en cero o no calculada.");
  if (margin <= 10 && salesTotal > 0) risks.push("Margen bajo.");
  if (pendingOrders > 0) risks.push(`${pendingOrders} orden(es) activas o pendientes.`);
  if (lowStock.length) risks.push(`${lowStock.length} producto(s) con stock bajo.`);
  if (noStock.length) risks.push(`${noStock.length} producto(s) sin stock.`);
  if (lower.includes("alerta")) risks.push("El tablero muestra sección de alertas activa.");

  return {
    visible,
    lower,
    screenHealth,
    salesTotal,
    profitTotal,
    inventoryValue: screenInventoryValue,
    margin,
    ordersCount: orders.length,
    pendingOrders,
    quotesCount: quotes.length,
    projectsCount: projects.length,
    inventoryCount: inventory.length,
    lowStock,
    noStock,
    risks,
  };
}

export function generateCEOResponse(ctx: CEOChatContext): string {
  const raw = txt(ctx.message).toLowerCase();
  const s = summarizeCEO(ctx);

  if (!raw) {
    return "Estoy listo como CEO IA. Puedo analizar ventas, utilidad, inventario, producción, riesgos y prioridades del día.";
  }

  if (raw.includes("hola") || raw.includes("buenas")) {
    return `Hola hermano. Estoy en modo CEO IA. Veo ventas por ${money(s.salesTotal)}, utilidad ${money(s.profitTotal)}, inventario ${money(s.inventoryValue)} y ${s.risks.length} riesgo(s) ejecutivos.`;
  }

  if (raw.includes("verifica") || raw.includes("analiza") || raw.includes("día") || raw.includes("dia") || raw.includes("pantalla")) {
    return [
      "Resumen Ejecutivo CEO IA:",
      `• Ventas totales: ${money(s.salesTotal)}`,
      `• Utilidad total: ${money(s.profitTotal)}`,
      `• Margen: ${s.margin.toFixed(1)}%`,
      `• Valor inventario: ${money(s.inventoryValue)}`,
      `• Órdenes activas/pendientes: ${s.pendingOrders}`,
      `• Productos inventario: ${s.inventoryCount}`,
      "",
      s.risks.length ? `Riesgos:\n• ${s.risks.join("\n• ")}` : "No veo riesgos críticos en pantalla.",
      "",
      "Prioridad CEO: validar utilidad real, cerrar órdenes activas y revisar stock crítico antes de comprar más.",
    ].join("\n");
  }

  if (raw.includes("riesgo") || raw.includes("alerta") || raw.includes("problema")) {
    if (!s.risks.length) {
      return "No veo riesgos críticos ahora mismo. Recomendación: seguir monitoreando ventas, utilidad, producción y stock.";
    }

    return [
      "Riesgos detectados por CEO IA:",
      `• ${s.risks.join("\n• ")}`,
      "",
      "Acción recomendada:",
      "1. Revisar utilidad real.",
      "2. Validar órdenes activas.",
      "3. Revisar stock bajo.",
      "4. Preparar compras solo de materiales críticos.",
    ].join("\n");
  }

  if (raw.includes("utilidad") || raw.includes("ganancia") || raw.includes("margen")) {
    return [
      "Análisis de Utilidad CEO:",
      `• Ventas: ${money(s.salesTotal)}`,
      `• Utilidad: ${money(s.profitTotal)}`,
      `• Margen estimado: ${s.margin.toFixed(1)}%`,
      "",
      s.profitTotal <= 0
        ? "⚠️ La utilidad está en cero o no calculada. Revisa costos reales, inventario y ventas convertidas."
        : "La utilidad tiene valor. Próximo paso: comparar contra costo real de inventario y mano de obra.",
    ].join("\n");
  }

  if (raw.includes("inventario") || raw.includes("stock")) {
    return [
      "Inventario CEO IA:",
      `• Valor inventario visible: ${money(s.inventoryValue)}`,
      `• Productos: ${s.inventoryCount}`,
      `• Stock bajo: ${s.lowStock.length}`,
      `• Sin stock: ${s.noStock.length}`,
      "",
      s.lowStock.length || s.noStock.length
        ? "Recomendación: generar compras solo para críticos y evitar sobreinventario."
        : "Inventario sin alertas críticas visibles.",
    ].join("\n");
  }

  if (raw.includes("produccion") || raw.includes("producción") || raw.includes("orden")) {
    return [
      "Producción vista por CEO IA:",
      `• Órdenes totales recibidas: ${s.ordersCount}`,
      `• Órdenes activas/pendientes: ${s.pendingOrders}`,
      "",
      s.pendingOrders > 0
        ? "Recomendación: revisar cuellos de botella y priorizar órdenes con materiales completos."
        : "No veo órdenes activas críticas en pantalla.",
    ].join("\n");
  }

  if (raw.includes("prioridad") || raw.includes("prioriza") || raw.includes("qué hago") || raw.includes("que hago")) {
    return [
      "Prioridades CEO del día:",
      "1. Confirmar ventas reales y cobros.",
      "2. Revisar utilidad real contra costos.",
      "3. Cerrar BOM de proyectos aprobados.",
      "4. Liberar producción solo con materiales completos.",
      "5. Revisar stock bajo y compras críticas.",
      "6. Ver órdenes atrasadas.",
      "7. Actualizar dashboard al cierre del día.",
    ].join("\n");
  }

  return [
    "CEO IA puede ayudarte con:",
    "• analiza el día",
    "• detecta riesgos",
    "• resume utilidad",
    "• revisa inventario",
    "• revisa producción",
    "• recomienda prioridades",
    "",
    `Estado actual: ventas ${money(s.salesTotal)}, utilidad ${money(s.profitTotal)}, riesgos ${s.risks.length}.`,
  ].join("\n");
}
