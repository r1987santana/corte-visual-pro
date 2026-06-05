export type AIAutonomyLevel = 1 | 2 | 3 | 4 | 5;

export type AIDecisionRisk = "low" | "medium" | "high" | "critical";

export type AIDecisionStatus = "pending" | "approved" | "rejected" | "executed" | "cancelled";

export type AIDecisionRequest = {
  module: string;
  actionType: string;
  title: string;
  summary: string;
  risk: AIDecisionRisk;
  payload?: Record<string, any>;
  route?: string;
  requiresApproval?: boolean;
};

export type AICapability = {
  key: string;
  level: AIAutonomyLevel;
  label: string;
  description: string;
  requiresApproval: boolean;
};

export const AI_LEVEL5_CAPABILITIES: AICapability[] = [
  {
    key: "persistent_memory",
    level: 3,
    label: "Memoria operativa persistente",
    description: "Recuerda decisiones, riesgos, clientes, proyectos y patrones aunque se reinicie Vercel.",
    requiresApproval: false,
  },
  {
    key: "risk_monitoring",
    level: 3,
    label: "Monitoreo de riesgos",
    description: "Detecta inventario bajo, margen peligroso, flujo bloqueado, cobros y produccion atrasada.",
    requiresApproval: false,
  },
  {
    key: "approval_queue",
    level: 4,
    label: "Acciones con aprobacion",
    description: "Prepara acciones reales y las deja esperando autorizacion humana antes de ejecutar.",
    requiresApproval: true,
  },
  {
    key: "guided_execution",
    level: 4,
    label: "Ejecucion guiada",
    description: "Abre modulos, prepara requisiciones, revisa BOM y prioriza ordenes con trazabilidad.",
    requiresApproval: true,
  },
  {
    key: "business_copilot",
    level: 5,
    label: "Copiloto empresarial",
    description: "Coordina CEO, ventas, inventario, produccion, RRHH, seguridad y finanzas con decision central.",
    requiresApproval: true,
  },
];

export function getAIAutonomyLevel() {
  return 5 as AIAutonomyLevel;
}

export function shouldRequireApproval(risk: AIDecisionRisk, actionType?: string) {
  const normalized = String(actionType || "").toLowerCase();
  if (risk === "high" || risk === "critical") return true;
  return [
    "create_requisition",
    "auto_purchase",
    "approve_production",
    "change_price",
    "delete_data",
    "send_external_message",
    "close_payroll",
  ].some((key) => normalized.includes(key));
}

export function summarizeAICapabilities() {
  return AI_LEVEL5_CAPABILITIES.map((item) => {
    const approval = item.requiresApproval ? "requiere aprobacion" : "monitoreo automatico";
    return `[Nivel ${item.level}] ${item.label}: ${item.description} (${approval}).`;
  }).join("\n");
}
