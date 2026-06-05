import { AI_MODULE_CONFIGS, AIModuleKey } from "./assistant-config";
import { buildCotizacionesLocalAnswer } from "./modules/cotizaciones";

type LocalPayload = {
  moduleKey: AIModuleKey;
  moduleName?: string;
  message: string;
  pathname?: string;
  screenContext?: Record<string, any>;
};

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function buildLocalAssistantResponse(payload: LocalPayload) {
  const config = AI_MODULE_CONFIGS[payload.moduleKey] || AI_MODULE_CONFIGS.general;
  const msg = normalize(payload.message || "");
  const ctx = payload.screenContext || {};

  if (payload.moduleKey === "cotizaciones") {
    return buildCotizacionesLocalAnswer(payload.message, {
      pathname: payload.pathname,
      mode: ctx.mode,
      clientName: ctx.clientName,
      subtotal: ctx.subtotal,
      tax: ctx.tax,
      total: ctx.total,
      costTotal: ctx.costTotal,
      profitTotal: ctx.profitTotal,
      margin: ctx.margin,
      cartItems: ctx.cartItems,
      visibleText: ctx.visibleText,
      screenNumbers: ctx.screenNumbers,
      piecesCount: ctx.piecesCount,
      boardSize: ctx.boardSize,
      cutFeet: ctx.cutFeet,
      edgeMeters: ctx.edgeMeters,
      cncQty: ctx.cncQty,
      wastePercent: ctx.wastePercent,
    });
  }

  if (payload.moduleKey === "inventario") {
    return "### Inventario IA\nPrimero revisaría stock crítico, costo promedio, movimientos recientes y productos sin rotación. No recomiendo ajustar cantidades sin soporte y trazabilidad.";
  }

  if (payload.moduleKey === "produccion" || payload.moduleKey === "corte") {
    return "### Producción / Corte IA\nRevisa medidas en mm, veta, piezas fuera de plancha, faltantes de material, canteo y orden de prioridad. No inicies corte sin validar despiece y material disponible.";
  }

  if (payload.moduleKey === "rrhh") {
    return "### RRHH IA\nPuedo ayudarte a filtrar candidatos por competencias, crear entrevistas y preparar checklist de ingreso. La decisión final debe quedarse en manos humanas y con evidencia objetiva.";
  }

  if (msg.includes("que hago") || msg.includes("siguiente") || msg.includes("recomienda")) {
    return [
      `### ${config.name} activo`,
      config.mission,
      "",
      "### Próximas acciones sugeridas",
      config.quickActions.map((a) => `- ${a}`).join("\n"),
    ].join("\n");
  }

  return [
    `### ${config.name} activo`,
    config.mission,
    "",
    "Puedo ayudarte a detectar errores, recomendar próximos pasos y preparar acciones operativas dentro de este módulo.",
    `Acciones rápidas: ${config.quickActions.join(" · ")}.`,
  ].join("\n");
}
