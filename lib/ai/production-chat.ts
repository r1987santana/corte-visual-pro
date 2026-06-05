export type ProductionChatContext = {
  module?: string;
  message?: string;
  orders?: any[];
  items?: any[];
  inventory?: any[];
  currentOrder?: any;
  selectedItem?: any;
  pageData?: any;
  screenContext?: any;
};

const n = (value: any) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const txt = (value: any) => String(value ?? "").trim();

function getName(row: any) {
  return txt(
    row?.name ||
      row?.product_name ||
      row?.material ||
      row?.material_name ||
      row?.item_name ||
      row?.part_name ||
      row?.piece_name ||
      row?.description ||
      "Sin nombre"
  );
}

function getStock(row: any) {
  return n(row?.stock ?? row?.quantity ?? row?.qty ?? row?.cantidad);
}

function getCost(row: any) {
  return n(row?.cost_price ?? row?.unit_cost ?? row?.purchase_cost ?? row?.cost ?? row?.total_cost);
}

function getStatus(row: any) {
  return txt(row?.status || row?.estado || "pendiente").toLowerCase();
}

function getOrderCode(row: any) {
  return txt(row?.order_code || row?.code || row?.quote_no || row?.id || "OP-SIN-CODIGO");
}

function findLowStock(inventory: any[] = []) {
  return inventory.filter((p) => {
    const stock = getStock(p);
    const min = n(p?.min_stock ?? p?.minimum_stock ?? p?.minimo);
    return min > 0 && stock <= min;
  });
}

function findNoStock(inventory: any[] = []) {
  return inventory.filter((p) => getStock(p) <= 0);
}

function findZeroCost(items: any[] = []) {
  return items.filter((i) => getCost(i) <= 0);
}

function bodyText(ctx: ProductionChatContext) {
  return txt(
    ctx.screenContext?.visibleText ||
      ctx.pageData?.visibleText ||
      ctx.pageData?.screenContext?.visibleText ||
      ""
  );
}

function extractNumberAfter(text: string, label: string) {
  const re = new RegExp(`${label}\\s*[:\\n ]+\\s*(RD\\$)?\\s*([0-9,.]+)`, "i");
  const m = text.match(re);
  return m?.[2] ? n(String(m[2]).replace(/,/g, "")) : 0;
}

function formatMoney(value: any) {
  return `RD$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function summarizeProduction(ctx: ProductionChatContext) {
  const orders = ctx.orders || [];
  const items = ctx.items || [];
  const inventory = ctx.inventory || [];
  const visible = bodyText(ctx);
  const lower = visible.toLowerCase();

  const pending = orders.filter((o) => getStatus(o).includes("pendiente")).length;
  const process = orders.filter((o) => getStatus(o).includes("proceso") || getStatus(o).includes("produccion")).length;
  const finished = orders.filter((o) => getStatus(o).includes("terminado") || getStatus(o).includes("finalizado")).length;
  const lowStock = findLowStock(inventory);
  const noStock = findNoStock(inventory);
  const zeroCost = findZeroCost(items);

  const screenProducts = extractNumberAfter(visible, "Productos");
  const screenAvailable = extractNumberAfter(visible, "Disponibles");
  const screenMaterials = extractNumberAfter(visible, "Materiales");
  const screenOrderCost = extractNumberAfter(visible, "Costo orden");

  const hasApprovedRender = lower.includes("render aprobado");
  const hasPendingBom = lower.includes("pendiente bom");
  const hasBomAuto = lower.includes("bom auto");
  const hasProjectFromDesign = lower.includes("proyectos enviados desde cotización") || lower.includes("ia diseño");

  return {
    ordersCount: orders.length || 0,
    itemsCount: items.length || screenMaterials || 0,
    inventoryCount: inventory.length || screenProducts || 0,
    pending,
    process,
    finished,
    lowStock,
    noStock,
    zeroCost,
    screenProducts,
    screenAvailable,
    screenMaterials,
    screenOrderCost,
    hasApprovedRender,
    hasPendingBom,
    hasBomAuto,
    hasProjectFromDesign,
    visible,
    lower,
  };
}

function screenBasedRisks(s: ReturnType<typeof summarizeProduction>) {
  const risks: string[] = [];

  if (s.hasApprovedRender && s.hasPendingBom) {
    risks.push("Hay render aprobado, pero el proyecto todavía está pendiente de BOM/ensamblaje.");
  }

  if (s.screenOrderCost === 0 && s.hasApprovedRender) {
    risks.push("El costo de orden aparece en RD$0.00; debes cargar/vincular materiales antes de procesar.");
  }

  if (s.lower.includes("selecciona receta bom")) {
    risks.push("No hay receta BOM seleccionada.");
  }

  if (s.lower.includes("selecciona proyecto aprobado")) {
    risks.push("No hay proyecto aprobado seleccionado en el control de producción.");
  }

  return risks;
}

export function generateProductionResponse(ctx: ProductionChatContext): string {
  const raw = txt(ctx.message).toLowerCase();
  const s = summarizeProduction(ctx);
  const risks = screenBasedRisks(s);

  if (!raw) return "Estoy listo para ayudarte en Producción. Pregúntame por BOM, faltantes, QR, CNC, margen, prioridad o checklist.";

  if (raw.includes("hola") || raw.includes("buenas")) {
    return `Hola hermano. Estoy en Producción IA. Veo ${s.inventoryCount} producto(s), ${s.screenAvailable || 0} disponible(s), ${s.itemsCount} material(es) y ${risks.length} riesgo(s) visible(s).`;
  }

  if (raw.includes("pantalla") || raw.includes("analiza") || raw.includes("resumen")) {
    return [
      "Análisis de Producción IA:",
      `• Productos visibles: ${s.inventoryCount}`,
      `• Disponibles: ${s.screenAvailable || 0}`,
      `• Materiales en orden/BOM: ${s.itemsCount}`,
      `• Costo de orden visible: ${formatMoney(s.screenOrderCost)}`,
      s.hasApprovedRender ? "• Render aprobado detectado." : "",
      s.hasPendingBom ? "• Estado: pendiente BOM / ensamble." : "",
      risks.length ? `\nRiesgos:\n• ${risks.join("\n• ")}` : "\nNo veo riesgos críticos de pantalla en este momento.",
      "\nPróximo paso: carga el proyecto aprobado, genera/vincula BOM real y valida materiales.",
    ].filter(Boolean).join("\n");
  }

  if (raw.includes("qr")) {
    return [
      "Sistema QR Industrial:",
      "• Puedo ayudarte a generar QR por pieza, módulo y orden.",
      "• El QR debe salir luego de tener piezas/BOM y optimización de corte.",
      "• Ruta recomendada: Producción → Corte/CNC → Guardar optimización → QR/Trazabilidad.",
      "",
      `• Materiales/BOM visibles: ${s.itemsCount}`,
      `• Costo orden: ${formatMoney(s.screenOrderCost)}`,
      risks.length ? `• Riesgos antes de QR: ${risks.length}` : "• Riesgos antes de QR: 0 críticos visibles",
    ].join("\n");
  }

  if (raw.includes("cnc") || raw.includes("nesting") || raw.includes("mecanizado")) {
    return [
      "Motor CNC IA:",
      "• Validar piezas con ancho/alto.",
      "• Revisar nesting y optimización.",
      "• Validar orientación de veta.",
      "• Preparar exportación CNC futura.",
      "",
      s.hasPendingBom ? "⚠️ Falta cerrar BOM antes de CNC." : "BOM pendiente no detectado.",
      "Recomendación: vincula materiales reales y envía a Corte/CNC.",
    ].join("\n");
  }

  if (raw.includes("optimizar") || raw.includes("plancha") || raw.includes("merma") || raw.includes("desperdicio")) {
    return [
      "Optimización Industrial:",
      "• Analizar distribución de piezas, merma y selección de plancha.",
      "• Para cálculo real necesito piezas con ancho/alto y material.",
      "• Corte/CNC calcula eficiencia, retazos, veta, 4x8/7x8 y desperdicio.",
    ].join("\n");
  }

  if (raw.includes("ensambl") || raw.includes("armado") || raw.includes("armar")) {
    return [
      "Control de Ensamblado:",
      "1. Cerrar BOM.",
      "2. Enviar a Corte/CNC.",
      "3. Generar QR.",
      "4. Pasar a canteo.",
      "5. Ensamblar por módulo.",
      "6. QA final.",
    ].join("\n");
  }

  if (raw.includes("costo") || raw.includes("margen") || raw.includes("ganancia") || raw.includes("utilidad")) {
    return [
      "Análisis Financiero IA:",
      `• Costo actual orden visible: ${formatMoney(s.screenOrderCost)}`,
      `• Materiales cargados: ${s.itemsCount}`,
      `• Riesgos detectados: ${risks.length}`,
      s.screenOrderCost <= 0
        ? "⚠️ El costo está en cero. Faltan materiales vinculados o BOM real."
        : "Costo con valor detectado. Compáralo contra cotización aprobada.",
    ].join("\n");
  }

  if (raw.includes("prioriza") || raw.includes("prioridad") || raw.includes("primero") || raw.includes("producir")) {
    const selected = (ctx.orders || [])[0];

    if (selected) {
      return `Prioridad Operativa:\n1. Iniciar con ${getOrderCode(selected)}.\n2. Validar materiales.\n3. Cerrar BOM.\n4. Enviar a Corte/CNC.\n5. Ensamble y QA.`;
    }

    return [
      "Prioridad Operativa:",
      "1. Render aprobado.",
      "2. Cerrar BOM.",
      "3. Validar inventario.",
      "4. Enviar a Corte/CNC.",
      "5. QR, canteo, ensamble y QA.",
    ].join("\n");
  }

  if (raw.includes("falta") || raw.includes("faltante") || raw.includes("stock")) {
    if (s.noStock.length || s.lowStock.length) {
      return [
        "Detecté posibles faltantes:",
        s.noStock.length ? `• ${s.noStock.length} material(es) sin stock. Ej: ${getName(s.noStock[0])}.` : "",
        s.lowStock.length ? `• ${s.lowStock.length} material(es) en stock bajo. Ej: ${getName(s.lowStock[0])}.` : "",
        "Recomendación: generar requisición a almacén/compras.",
      ].filter(Boolean).join("\n");
    }

    if (risks.length) return `Faltantes/riesgos visibles:\n• ${risks.join("\n• ")}`;

    return "No detecté faltantes críticos con los datos visibles.";
  }

  if (raw.includes("bom") || raw.includes("material") || raw.includes("materiales")) {
    if (s.zeroCost.length) return `BOM con ${s.zeroCost.length} partida(s) con costo cero. Revisa: ${getName(s.zeroCost[0])}.`;

    if (!s.itemsCount) {
      return [
        "No veo partidas BOM cargadas todavía.",
        s.hasApprovedRender ? "Detecté render aprobado: siguiente paso es generar/vincular BOM real." : "",
        "Acción: selecciona receta BOM o carga proyecto aprobado.",
      ].filter(Boolean).join("\n");
    }

    return `BOM revisado: veo ${s.itemsCount} partida(s). Próximo paso: validar stock, costos y enviar a corte/CNC.`;
  }

  if (raw.includes("riesgo") || raw.includes("error") || raw.includes("revisar")) {
    const list = [
      s.noStock.length ? `${s.noStock.length} material(es) sin stock` : "",
      s.lowStock.length ? `${s.lowStock.length} material(es) en stock bajo` : "",
      s.zeroCost.length ? `${s.zeroCost.length} partida(s) con costo cero` : "",
      !s.itemsCount ? "BOM sin partidas visibles" : "",
      ...risks,
    ].filter(Boolean);

    return list.length
      ? `Riesgos detectados:\n• ${list.join("\n• ")}`
      : "No veo riesgos críticos con los datos actuales.";
  }

  if (raw.includes("checklist") || raw.includes("lista")) {
    return [
      "Checklist Producción IA:",
      "1. Confirmar cliente y proyecto.",
      "2. Verificar render aprobado.",
      "3. Seleccionar proyecto aprobado o receta BOM.",
      "4. Revisar BOM, costos y materiales.",
      "5. Validar stock.",
      "6. Enviar piezas a Corte/CNC.",
      "7. Generar QR.",
      "8. Canteo, ensamble y QA.",
    ].join("\n");
  }

  return [
    "Te respondo como Producción IA.",
    "Comandos que entiendo:",
    "• generar QR",
    "• optimizar plancha",
    "• enviar CNC",
    "• revisar margen",
    "• revisar BOM",
    "• detectar faltantes",
    "• priorizar órdenes",
    "• checklist producción",
    "",
    `Productos: ${s.inventoryCount}`,
    `Disponibles: ${s.screenAvailable || 0}`,
    `Materiales/BOM: ${s.itemsCount}`,
    `Costo orden: ${formatMoney(s.screenOrderCost)}`,
  ].join("\n");
}
