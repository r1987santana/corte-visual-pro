// ============================================================================
// RD WOOD SYSTEM - MASTER AI ORCHESTRATOR
// ============================================================================

import { executeAIAction } from "./action-executor";
import { runIndustrialBrain } from "./brain";
import { analyzeRisks } from "./risk-engine";
import { buildWorkflowState } from "./workflow-engine";

export type AIOrchestratorInput = {
  module?: string;
  pathname?: string;
  message?: string;

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
  sales?: any[];
  quotes?: any[];

  requestedAction?: string;
  screenData?: Record<string, any>;
};

export type AIOrchestratorResponse = {
  summary: string;
  workflow: any;
  risks: string[];
  recommendations: string[];
  execution?: {
    success: boolean;
    message: string;
    action?: any;
  };
  nextActions: {
    type: string;
    label: string;
    route?: string;
  }[];
};

function formatGateLines(workflow: any) {
  const gates = Array.isArray(workflow?.gates) ? workflow.gates : [];
  return gates
    .filter((gate: any) => gate.required)
    .slice(0, 10)
    .map((gate: any) => `${gate.ok ? "OK" : "PENDIENTE"} - ${gate.label}`)
    .join("\n");
}

export async function orchestrateIndustrialAI(input: AIOrchestratorInput): Promise<AIOrchestratorResponse> {
  const workflow = buildWorkflowState({
    client: input.client,
    appointment: input.appointment,
    measurement: input.measurement,
    designRequest: input.designRequest,
    quote: input.quote,
    contract: input.contract,
    payments: input.payments || [],
    project: input.project,
    order: input.order,
    bom: input.bom || [],
    requisitions: input.requisitions || [],
    pieceLabels: input.pieceLabels || [],
    delivery: input.delivery,
    screenData: input.screenData || {},
  });

  const risks = analyzeRisks({
    inventory: input.inventory || [],
    bom: input.bom || [],
    order: input.order,
    sales: input.sales || [],
    quotes: input.quotes || [],
    payments: input.payments || [],
    workflow,
  });

  const brain = await runIndustrialBrain({
    module: input.module,
    pathname: input.pathname,
    userMessage: input.message,
    client: input.client,
    appointment: input.appointment,
    measurement: input.measurement,
    designRequest: input.designRequest,
    quote: input.quote,
    contract: input.contract,
    payments: input.payments || [],
    project: input.project,
    order: input.order,
    bom: input.bom || [],
    requisitions: input.requisitions || [],
    pieceLabels: input.pieceLabels || [],
    delivery: input.delivery,
    inventory: input.inventory || [],
    quotes: input.quotes || [],
    sales: input.sales || [],
    screenData: input.screenData || {},
  });

  let execution:
    | {
        success: boolean;
        message: string;
        action?: any;
      }
    | undefined;

  if (input.requestedAction) {
    execution = await executeAIAction({
      actionType: input.requestedAction,
      payload: {
        project: input.project,
        order: input.order,
        workflow,
      },
    });
  }

  const recommendations = [...brain.recommendations];
  const gateLines = formatGateLines(workflow);

  const summary = [
    "RD WOOD IA MAESTRA",
    "",
    `Etapa actual: ${workflow.stageLabel || workflow.stage}`,
    `Progreso operativo: ${workflow.progress}%`,
    `Siguiente paso: ${workflow.nextStageLabel || "postventa / cierre"}`,
    `Estado: ${workflow.blocked ? "BLOQUEADO" : "ACTIVO"}`,
    workflow.reason ? `Motivo: ${workflow.reason}` : "",
    "",
    "Reglas del flujo:",
    gateLines || "Sin reglas obligatorias pendientes.",
    "",
    `Riesgos detectados: ${risks.length}`,
    `Acciones sugeridas: ${brain.nextActions.length}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summary,
    workflow,
    risks,
    recommendations,
    execution,
    nextActions: brain.nextActions,
  };
}
