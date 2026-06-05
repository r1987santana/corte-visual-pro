// ============================================================================
// RD WOOD SYSTEM - MASTER AI BRAIN
// ============================================================================

import { analyzeRisks } from "./risk-engine";
import { analyzeInventoryAI } from "./inventory-ai";
import { analyzeProductionFlowAI } from "./production-flow-ai";
import { analyzeCommercialFlowAI } from "./commercial-flow-ai";
import { analyzeDeliveryFlowAI } from "./delivery-flow-ai";
import { buildWorkflowState, type WorkflowStage } from "./workflow-engine";

export type AIBrainContext = {
  module?: string;
  pathname?: string;
  userMessage?: string;

  client?: any;
  appointment?: any;
  measurement?: any;
  designRequest?: any;
  quote?: any;
  contract?: any;
  payments?: any[];
  project?: any;
  order?: any;
  bom?: any[];
  requisitions?: any[];
  pieceLabels?: any[];
  delivery?: any;

  inventory?: any[];
  quotes?: any[];
  sales?: any[];

  screenData?: Record<string, any>;
};

export type AIBrainResponse = {
  summary: string;
  risks: string[];
  recommendations: string[];
  nextActions: {
    type: string;
    label: string;
    route?: string;
  }[];
  workflow: ReturnType<typeof buildWorkflowState>;
};

type StagePlan = {
  route: string;
  action: string;
  recommendation: string;
};

const STAGE_PLANS: Record<WorkflowStage, StagePlan> = {
  cliente: {
    route: "/clientes",
    action: "Crear cliente maestro",
    recommendation: "Captar el cliente con telefono, direccion, tipo de proyecto y notas comerciales.",
  },
  agenda: {
    route: "/agenda",
    action: "Agendar visita",
    recommendation: "Agendar visita y confirmar responsable antes de pedir levantamiento.",
  },
  pago_medicion: {
    route: "/agenda",
    action: "Registrar pago RD$5,000",
    recommendation: "No avanzar a medicion/render sin soporte del pago fijo RD$5,000.",
  },
  levantamiento: {
    route: "/levantamientos",
    action: "Tomar medidas",
    recommendation: "Registrar medidas reales, fotos del espacio y observaciones tecnicas.",
  },
  render: {
    route: "/ia-diseno",
    action: "Preparar 4 renders",
    recommendation: "Crear variantes visuales con medidas y materiales reales; el cliente debe elegir una.",
  },
  aprobacion_render: {
    route: "/portal-cliente",
    action: "Enviar portal cliente",
    recommendation: "Guardar el render aprobado como evidencia antes de cotizar.",
  },
  cotizacion: {
    route: "/cotizaciones",
    action: "Crear cotizacion",
    recommendation: "Cotizar desde el render aprobado, validar margen y aplicar el credito RD$5,000.",
  },
  contrato: {
    route: "/contratos",
    action: "Generar contrato",
    recommendation: "Contrato debe incluir render aprobado, condiciones 60/20/20 y alcance del proyecto.",
  },
  pago_inicial: {
    route: "/contratos",
    action: "Registrar 60%",
    recommendation: "Produccion no debe liberarse sin el pago inicial del 60% o autorizacion formal.",
  },
  requisicion: {
    route: "/inventario-inteligente/requisiciones",
    action: "Crear requisicion",
    recommendation: "Consolidar planchas, cantos y herrajes desde BOM para que almacen despache.",
  },
  produccion: {
    route: "/produccion",
    action: "Validar BOM",
    recommendation: "Validar BOM, costos, materiales vinculados y orden lista antes de cortar.",
  },
  corte: {
    route: "/corte",
    action: "Optimizar corte",
    recommendation: "Optimizar planchas, revisar veta, merma, etiquetas y piezas fuera de formato.",
  },
  canteo: {
    route: "/trazabilidad-piezas",
    action: "Controlar canteo/CNC",
    recommendation: "Marcar avance pieza por pieza para no mezclar modulos.",
  },
  ensamble: {
    route: "/ensamblado",
    action: "Ensamblar modulo",
    recommendation: "Validar herrajes, piezas internas y evidencia antes de liberar limpieza.",
  },
  limpieza: {
    route: "/trazabilidad-piezas",
    action: "Empacar modulo",
    recommendation: "Limpiar, proteger, empacar y dejar modulo listo para transporte.",
  },
  transporte: {
    route: "/transporte",
    action: "Preparar despacho",
    recommendation: "Asignar chofer, vehiculo, ruta, WhatsApp y fotos de carga.",
  },
  instalacion: {
    route: "/instalacion",
    action: "Instalar y evidenciar",
    recommendation: "Instalacion debe registrar fotos, incidencias y avance por modulo.",
  },
  verificacion: {
    route: "/verificacion",
    action: "Verificar calidad",
    recommendation: "QA debe aprobar medidas, terminacion, limpieza y cumplimiento del render aprobado.",
  },
  entrega: {
    route: "/entrega-final",
    action: "Cerrar entrega final",
    recommendation: "No cerrar sin foto final, firma del cliente y acta impresa/guardada.",
  },
  postventa: {
    route: "/postventa",
    action: "Activar postventa",
    recommendation: "Registrar garantia, aprendizaje del proyecto y seguimiento comercial.",
  },
};

function n(value: any) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function activeInventory(inventory: any[]) {
  return (inventory || []).filter((item) => {
    const status = String(item.status || "active").toLowerCase();
    return status === "active" || status === "activo";
  });
}

function lowStockCount(inventory: any[]) {
  return activeInventory(inventory).filter((item) => {
    const min = n(item.min_stock ?? item.minimum_stock ?? item.minimo);
    if (min <= 0) return false;
    return n(item.stock ?? item.quantity) <= min;
  }).length;
}

function nextActionForStage(stage: WorkflowStage) {
  const plan = STAGE_PLANS[stage];
  return {
    type: `open_${stage}`,
    label: plan.action,
    route: plan.route,
  };
}

export async function runIndustrialBrain(context: AIBrainContext): Promise<AIBrainResponse> {
  const workflow = buildWorkflowState({
    client: context.client,
    appointment: context.appointment,
    measurement: context.measurement,
    designRequest: context.designRequest,
    quote: context.quote,
    contract: context.contract,
    payments: context.payments || [],
    project: context.project,
    order: context.order,
    bom: context.bom || [],
    requisitions: context.requisitions || [],
    pieceLabels: context.pieceLabels || [],
    delivery: context.delivery,
    screenData: context.screenData || {},
  });

  const risks = analyzeRisks({
    inventory: context.inventory || [],
    order: context.order,
    bom: context.bom || [],
    sales: context.sales || [],
    quotes: context.quotes || [],
    payments: context.payments || [],
    workflow,
  });

  const recommendations: string[] = [];
  const nextActions: {
    type: string;
    label: string;
    route?: string;
  }[] = [];

  const currentPlan = STAGE_PLANS[workflow.stage];
  const inventoryInsight = analyzeInventoryAI(context.inventory || []);
  const productionInsight = analyzeProductionFlowAI({
    order: context.order,
    bom: context.bom || [],
    inventory: context.inventory || [],
    pieceLabels: context.pieceLabels || [],
  });
  const deliveryInsight = analyzeDeliveryFlowAI({
    order: context.order,
    project: context.project,
    pieceLabels: context.pieceLabels || [],
    delivery: context.delivery,
  });
  const commercialInsight = analyzeCommercialFlowAI({
    client: context.client,
    appointment: context.appointment,
    measurement: context.measurement,
    designRequest: context.designRequest,
    quote: context.quote,
    contract: context.contract,
    payments: context.payments || [],
  });
  recommendations.push(currentPlan.recommendation);
  nextActions.push(nextActionForStage(workflow.stage));

  if (workflow.nextStage) {
    const nextPlan = STAGE_PLANS[workflow.nextStage];
    recommendations.push(`Proximo modulo: ${workflow.nextStageLabel}. ${nextPlan.recommendation}`);
    nextActions.push({
      type: `open_${workflow.nextStage}`,
      label: nextPlan.action,
      route: nextPlan.route,
    });
  }

  if (workflow.blocked) {
    recommendations.unshift(`Bloqueado: ${workflow.reason || "falta una condicion obligatoria"}`);
  }

  const inventoryCount = activeInventory(context.inventory || []).length;
  const criticalCount = lowStockCount(context.inventory || []);

  if (inventoryCount > 0) {
    recommendations.push(inventoryInsight.summary);
    recommendations.push(...inventoryInsight.recommendations.slice(0, 4));
  }

  if (context.module?.includes("inventario")) {
    recommendations.push("Inventario IA debe vigilar costo promedio, reservas, stock minimo, grupos y subgrupos.");
    if (inventoryInsight.purchaseCandidates.length > 0) {
      recommendations.push(
        `Compra sugerida: ${inventoryInsight.purchaseCandidates
          .slice(0, 3)
          .map((item) => `${item.name} x${item.suggestedQty}`)
          .join("; ")}`,
      );
    }
    nextActions.push({
      type: "open_inventory_requisitions",
      label: "Abrir requisiciones",
      route: "/inventario-inteligente/requisiciones",
    });
  }

  if (context.module?.includes("produccion")) {
    recommendations.push(productionInsight.summary);
    recommendations.push(...productionInsight.recommendations.slice(0, 4));
    recommendations.push(...productionInsight.blockers.map((blocker) => `Bloqueo produccion: ${blocker}`).slice(0, 3));
    recommendations.push("Produccion IA debe exigir BOM, requisicion, QR y estados por pieza antes de avanzar.");
    nextActions.push({
      type: "open_traceability",
      label: "Abrir trazabilidad",
      route: "/trazabilidad-piezas",
    });
  }

  if (context.module?.includes("corte")) {
    recommendations.push(productionInsight.summary);
    recommendations.push(...productionInsight.recommendations.slice(0, 4));
    recommendations.push(...productionInsight.blockers.map((blocker) => `Bloqueo corte: ${blocker}`).slice(0, 3));
    recommendations.push("Corte IA debe proteger veta, kerf, merma, piezas fuera de plancha y salida CNC.");
  }

  if (
    context.module?.includes("agenda") ||
    context.module?.includes("diseno") ||
    context.module?.includes("dise") ||
    context.module?.includes("cotizaciones") ||
    context.module?.includes("ia_") ||
    context.module?.includes("ventas")
  ) {
    recommendations.push(commercialInsight.summary);
    recommendations.push(...commercialInsight.recommendations.slice(0, 4));
    recommendations.push(...commercialInsight.blockers.map((blocker) => `Bloqueo comercial: ${blocker}`).slice(0, 4));
  }

  if (
    context.module?.includes("transporte") ||
    context.module?.includes("logistica") ||
    context.module?.includes("instalacion") ||
    context.module?.includes("verificacion") ||
    context.module?.includes("entrega")
  ) {
    recommendations.push(deliveryInsight.summary);
    recommendations.push(...deliveryInsight.recommendations.slice(0, 5));
    recommendations.push(...deliveryInsight.blockers.map((blocker) => `Bloqueo campo: ${blocker}`).slice(0, 5));
    nextActions.push({
      type: `open_${deliveryInsight.stage}`,
      label:
        deliveryInsight.stage === "cerrado"
          ? "Abrir postventa"
          : deliveryInsight.stage === "entrega"
            ? "Abrir entrega final"
            : deliveryInsight.stage === "verificacion"
              ? "Abrir verificacion"
              : deliveryInsight.stage === "instalacion"
                ? "Abrir instalacion"
                : "Abrir transporte",
      route: deliveryInsight.nextRoute,
    });
  }

  if (risks.length <= 0) {
    recommendations.push("No se detectan riesgos criticos en el contexto cargado.");
  }

  const summary = [
    "IA Maestra RD Wood",
    "",
    `Modulo actual: ${context.module || "global"}`,
    `Etapa: ${workflow.stageLabel}`,
    `Progreso: ${workflow.progress}%`,
    `Siguiente: ${workflow.nextStageLabel || "ciclo cerrado"}`,
    `Estado: ${workflow.blocked ? "BLOQUEADO" : "ACTIVO"}`,
    workflow.reason ? `Motivo: ${workflow.reason}` : "",
    `Riesgos: ${risks.length}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary,
    risks,
    recommendations: Array.from(new Set(recommendations)).slice(0, 12),
    nextActions: Array.from(new Map(nextActions.map((action) => [action.route || action.type, action])).values()).slice(0, 8),
    workflow,
  };
}
