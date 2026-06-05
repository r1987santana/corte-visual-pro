export type AIActionType =
  | "none"
  | "open_route"
  | "generate_qr"
  | "open_corte_cnc"
  | "create_requisition"
  | "review_bom"
  | "prioritize_orders"
  | "generate_checklist"
  | "analyze_profit"
  | "open_inventory"
  | "open_ceo";

export type AIAction = {
  type: AIActionType;
  label: string;
  route?: string;
  confirmRequired?: boolean;
  payload?: Record<string, any>;
};

export type AIActionIntent = {
  action: AIAction;
  confidence: number;
  reason: string;
};

const normalize = (value: any) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(normalize(word)));
}

export function resolveAIAction({
  message,
  moduleKey,
  pathname,
}: {
  message: string;
  moduleKey?: string;
  pathname?: string;
}): AIActionIntent {
  const raw = normalize(message);
  const moduleText = normalize(`${moduleKey || ""} ${pathname || ""}`);

  if (!raw.trim()) {
    return {
      confidence: 0,
      reason: "Sin mensaje.",
      action: {
        type: "none",
        label: "Sin acción",
      },
    };
  }

  if (hasAny(raw, ["qr", "codigo qr", "etiqueta", "trazabilidad"])) {
    return {
      confidence: 0.94,
      reason: "El usuario solicitó QR o trazabilidad.",
      action: {
        type: "open_corte_cnc",
        label: "Ir a Corte/CNC para generar QR",
        route: "/corte",
        confirmRequired: false,
        payload: { source: "ai", requested: "qr" },
      },
    };
  }

  if (hasAny(raw, ["cnc", "corte", "nesting", "plancha", "optimizar", "merma", "desperdicio"])) {
    return {
      confidence: 0.92,
      reason: "El usuario pidió optimización, corte, nesting o CNC.",
      action: {
        type: "open_corte_cnc",
        label: "Abrir Corte/CNC",
        route: "/corte",
        confirmRequired: false,
        payload: { source: "ai", requested: "cutting" },
      },
    };
  }

  if (hasAny(raw, ["requisicion", "requisición", "comprar", "compra", "faltante", "almacen", "almacén"])) {
    return {
      confidence: 0.88,
      reason: "El usuario pidió compras, requisición o faltantes.",
      action: {
        type: "create_requisition",
        label: "Abrir requisicion de almacen",
        route: "/inventario-inteligente/requisiciones",
        confirmRequired: true,
        payload: { source: "ai", requested: "requisition" },
      },
    };
  }

  if (hasAny(raw, ["bom", "receta", "materiales", "ingenieria", "ingeniería"])) {
    return {
      confidence: 0.86,
      reason: "El usuario pidió revisión BOM o materiales.",
      action: {
        type: "review_bom",
        label: "Revisar BOM",
        route: moduleText.includes("produccion") ? "/produccion" : "/recetas",
        confirmRequired: false,
        payload: { source: "ai", requested: "bom_review" },
      },
    };
  }

  if (hasAny(raw, ["prioridad", "prioriza", "primero", "ordenes", "órdenes", "que produzco"])) {
    return {
      confidence: 0.84,
      reason: "El usuario pidió priorización de producción.",
      action: {
        type: "prioritize_orders",
        label: "Priorizar órdenes",
        route: "/produccion",
        confirmRequired: false,
        payload: { source: "ai", requested: "priority" },
      },
    };
  }

  if (hasAny(raw, ["checklist", "lista", "pasos", "proceso"])) {
    return {
      confidence: 0.8,
      reason: "El usuario pidió checklist o lista operativa.",
      action: {
        type: "generate_checklist",
        label: "Generar checklist",
        route: pathname || "/produccion",
        confirmRequired: false,
        payload: { source: "ai", requested: "checklist" },
      },
    };
  }

  if (hasAny(raw, ["utilidad", "ganancia", "margen", "perdida", "pérdida", "rentabilidad"])) {
    return {
      confidence: 0.82,
      reason: "El usuario pidió análisis financiero o utilidad.",
      action: {
        type: "analyze_profit",
        label: "Analizar utilidad",
        route: moduleText.includes("ceo") ? "/dashboard-ceo" : "/dashboard-ceo",
        confirmRequired: false,
        payload: { source: "ai", requested: "profit_analysis" },
      },
    };
  }

  if (hasAny(raw, ["inventario", "stock", "existencia"])) {
    return {
      confidence: 0.78,
      reason: "El usuario pidió revisar inventario.",
      action: {
        type: "open_inventory",
        label: "Abrir Inventario",
        route: "/inventario-inteligente",
        confirmRequired: false,
        payload: { source: "ai", requested: "inventory" },
      },
    };
  }

  if (hasAny(raw, ["ceo", "empresa", "dashboard", "negocio", "resumen ejecutivo"])) {
    return {
      confidence: 0.76,
      reason: "El usuario pidió análisis CEO.",
      action: {
        type: "open_ceo",
        label: "Abrir CEO",
        route: "/dashboard-ceo",
        confirmRequired: false,
        payload: { source: "ai", requested: "ceo" },
      },
    };
  }

  return {
    confidence: 0.15,
    reason: "No se detectó acción ejecutable clara.",
    action: {
      type: "none",
      label: "Sin acción automática",
    },
  };
}

export function actionInstructionText(action: AIAction) {
  if (action.type === "none") return "";

  if (action.type === "open_corte_cnc") {
    return "\n\nAcción disponible: abrir Corte/CNC para continuar con optimización, nesting, QR y trazabilidad.";
  }

  if (action.type === "create_requisition") {
    return "\n\nAcción disponible: crear requisición de almacén/compras para materiales faltantes.";
  }

  if (action.type === "review_bom") {
    return "\n\nAcción disponible: revisar BOM, materiales, costos y cantidades antes de liberar producción.";
  }

  if (action.type === "prioritize_orders") {
    return "\n\nAcción disponible: priorizar órdenes por estado, materiales disponibles y urgencia.";
  }

  if (action.type === "generate_checklist") {
    return "\n\nAcción disponible: generar checklist operativo del módulo actual.";
  }

  if (action.type === "analyze_profit") {
    return "\n\nAcción disponible: abrir análisis CEO/utilidad para validar rentabilidad.";
  }

  if (action.type === "open_inventory") {
    return "\n\nAcción disponible: abrir Inventario para revisar stock y costos.";
  }

  return "\n\nAcción disponible en el sistema.";
}
