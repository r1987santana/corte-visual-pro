// ============================================================================
// lib/ai/notification-center.ts
// RD WOOD SYSTEM - INDUSTRIAL AI FEED ENGINE
// FASE 37 · Operational Intelligence
// ============================================================================

export type NotificationSeverity = "info" | "success" | "warning" | "danger";

export type AINotificationPriority = "critical" | "high" | "medium" | "low";

export type AINotificationCategory =
  | "produccion"
  | "inventario"
  | "finanzas"
  | "compras"
  | "ventas"
  | "instalacion"
  | "ia"
  | "logistica"
  | "corte"
  | "ceo"
  | "sistema";

export type AINotification = {
  id: string;
  title: string;
  description?: string;
  severity: NotificationSeverity;
  priority: AINotificationPriority;
  category: AINotificationCategory;
  module?: string;
  source?: string;
  eventType?: string;
  riskScore: number;
  recommendedAction?: string;
  actionLabel?: string;
  actionRoute?: string;
  createdAt: string;
  read?: boolean;
  metadata?: any;
};

export type AIFeedStats = {
  total: number;
  unread: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  riskScore: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
};

// ============================================================================
// MEMORY STORAGE
// ============================================================================

const notifications: AINotification[] = [];

function createId() {
  return "NTF-" + Date.now().toString() + "-" + Math.random().toString(16).slice(2, 8);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalizePriority(
  priority?: AINotificationPriority,
  severity?: NotificationSeverity,
  riskScore?: number
): AINotificationPriority {
  if (priority) return priority;

  const score = Number(riskScore || 0);

  if (severity === "danger" || score >= 85) return "critical";
  if (severity === "warning" || score >= 65) return "high";
  if (severity === "info" || score >= 35) return "medium";
  return "low";
}

function normalizeRiskScore(
  severity: NotificationSeverity,
  priority: AINotificationPriority,
  riskScore?: number
) {
  if (typeof riskScore === "number") return clamp(riskScore);

  if (priority === "critical") return 92;
  if (priority === "high") return 72;
  if (priority === "medium") return 45;
  if (severity === "danger") return 88;
  if (severity === "warning") return 66;
  if (severity === "success") return 12;
  return 28;
}

function normalizeCategory(value?: string): AINotificationCategory {
  const raw = String(value || "").toLowerCase();

  if (raw.includes("produ")) return "produccion";
  if (raw.includes("invent") || raw.includes("stock")) return "inventario";
  if (raw.includes("finan") || raw.includes("ceo") || raw.includes("margen") || raw.includes("util")) return "finanzas";
  if (raw.includes("compra") || raw.includes("requis")) return "compras";
  if (raw.includes("venta") || raw.includes("cotiza")) return "ventas";
  if (raw.includes("instal")) return "instalacion";
  if (raw.includes("log") || raw.includes("trans")) return "logistica";
  if (raw.includes("corte") || raw.includes("cnc")) return "corte";
  if (raw.includes("ia")) return "ia";
  if (raw.includes("ceo")) return "ceo";

  return "sistema";
}

function defaultRecommendedAction(item: Partial<AINotification>) {
  const category = normalizeCategory(item.category || item.module);
  const severity = item.severity || "info";

  if (category === "inventario" && severity === "danger") return "Generar requisición de compra o validar stock físico.";
  if (category === "produccion" && severity !== "success") return "Revisar orden, BOM, materiales y cuello de botella.";
  if (category === "finanzas" && severity !== "success") return "Revisar margen, costo real y precio aprobado.";
  if (category === "corte") return "Abrir Corte/CNC para validar nesting, merma, veta y QR.";
  if (category === "instalacion") return "Preparar checklist, fotos, transporte y verificación final.";
  if (category === "compras") return "Validar proveedor, costo, MOQ y urgencia.";
  if (category === "ventas") return "Revisar aprobación, cobro, contrato o conversión a venta.";

  return "Revisar la alerta y tomar acción operativa.";
}

// ============================================================================
// CREATE NOTIFICATION
// ============================================================================

export function createAINotification(
  notification: Omit<
    Partial<AINotification> & Pick<AINotification, "title" | "severity">,
    "id" | "createdAt"
  >
): AINotification {
  const priority = normalizePriority(notification.priority, notification.severity, notification.riskScore);
  const riskScore = normalizeRiskScore(notification.severity, priority, notification.riskScore);
  const category = normalizeCategory(notification.category || notification.module || notification.eventType);

  const item: AINotification = {
    id: createId(),
    title: notification.title,
    description: notification.description || "",
    severity: notification.severity,
    priority,
    category,
    module: notification.module || category,
    source: notification.source || "IA Industrial",
    eventType: notification.eventType || "AI_NOTIFICATION",
    riskScore,
    recommendedAction: notification.recommendedAction || defaultRecommendedAction({ ...notification, category }),
    actionLabel: notification.actionLabel || "Abrir módulo",
    actionRoute: notification.actionRoute,
    createdAt: new Date().toISOString(),
    read: false,
    metadata: notification.metadata || {},
  };

  notifications.unshift(item);

  // Mantener el feed liviano.
  if (notifications.length > 120) {
    notifications.splice(120);
  }

  console.log("AI Notification:", item);

  return item;
}

// ============================================================================
// QUICK INDUSTRIAL HELPERS
// ============================================================================

export function notifyStockCritical(payload?: any) {
  return createAINotification({
    title: payload?.title || "Stock crítico detectado",
    description: payload?.description || "Inventario requiere revisión inmediata antes de liberar producción.",
    severity: "danger",
    priority: "critical",
    category: "inventario",
    module: "inventario",
    source: "Risk Engine",
    eventType: "STOCK_CRITICAL",
    riskScore: 94,
    recommendedAction: "Crear requisición, validar existencia física y bloquear producción si falta material.",
    actionLabel: "Abrir Inventario",
    actionRoute: "/inventario",
    metadata: payload || {},
  });
}

export function notifyLowMargin(payload?: any) {
  return createAINotification({
    title: payload?.title || "Margen bajo detectado",
    description: payload?.description || "Proyecto con utilidad peligrosa. Revisar costo real, precio y desperdicio.",
    severity: "warning",
    priority: "high",
    category: "finanzas",
    module: "dashboard-ceo",
    source: "CEO AI",
    eventType: "LOW_MARGIN",
    riskScore: 78,
    recommendedAction: "Recalcular costo real, validar BOM y aprobar ajuste de precio si aplica.",
    actionLabel: "Abrir CEO",
    actionRoute: "/dashboard-ceo",
    metadata: payload || {},
  });
}

export function notifyOrderDelayed(payload?: any) {
  return createAINotification({
    title: payload?.title || "Orden retrasada",
    description: payload?.description || "Una orden de producción está detenida o fuera de tiempo.",
    severity: "warning",
    priority: "high",
    category: "produccion",
    module: "produccion",
    source: "Workflow Engine",
    eventType: "ORDER_DELAYED",
    riskScore: 74,
    recommendedAction: "Revisar cuello de botella en corte, canteo, ensamble o instalación.",
    actionLabel: "Abrir Producción",
    actionRoute: "/produccion",
    metadata: payload || {},
  });
}

export function notifyCNCReady(payload?: any) {
  return createAINotification({
    title: payload?.title || "CNC listo",
    description: payload?.description || "La orden está lista para nesting, corte, QR y trazabilidad.",
    severity: "success",
    priority: "medium",
    category: "corte",
    module: "corte",
    source: "Production AI",
    eventType: "CNC_READY",
    riskScore: 18,
    recommendedAction: "Abrir Corte/CNC y validar optimización antes de cortar.",
    actionLabel: "Abrir Corte/CNC",
    actionRoute: "/corte",
    metadata: payload || {},
  });
}

export function notifyQRGenerated(payload?: any) {
  return createAINotification({
    title: payload?.title || "QR generado",
    description: payload?.description || "Etiquetas listas para trazabilidad de piezas y módulos.",
    severity: "success",
    priority: "low",
    category: "ia",
    module: "trazabilidad",
    source: "Automation Engine",
    eventType: "QR_GENERATED",
    riskScore: 8,
    recommendedAction: "Imprimir etiquetas y colocar por pieza/módulo.",
    actionLabel: "Abrir Trazabilidad",
    actionRoute: "/trazabilidad-piezas",
    metadata: payload || {},
  });
}

// ============================================================================
// GET NOTIFICATIONS
// ============================================================================

export function getAINotifications(filters?: {
  unreadOnly?: boolean;
  severity?: NotificationSeverity;
  priority?: AINotificationPriority;
  category?: AINotificationCategory;
  limit?: number;
}) {
  let data = [...notifications];

  if (filters?.unreadOnly) data = data.filter((n) => !n.read);
  if (filters?.severity) data = data.filter((n) => n.severity === filters.severity);
  if (filters?.priority) data = data.filter((n) => n.priority === filters.priority);
  if (filters?.category) data = data.filter((n) => n.category === filters.category);

  return data.slice(0, filters?.limit || 100);
}

export function getAINotificationStats(): AIFeedStats {
  const total = notifications.length;
  const unread = notifications.filter((n) => !n.read).length;
  const critical = notifications.filter((n) => n.priority === "critical").length;
  const high = notifications.filter((n) => n.priority === "high").length;
  const medium = notifications.filter((n) => n.priority === "medium").length;
  const low = notifications.filter((n) => n.priority === "low").length;

  const active = notifications.filter((n) => !n.read);
  const riskScore = active.length
    ? Math.round(active.reduce((acc, n) => acc + Number(n.riskScore || 0), 0) / active.length)
    : 0;

  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  notifications.forEach((n) => {
    byCategory[n.category] = (byCategory[n.category] || 0) + 1;
    bySeverity[n.severity] = (bySeverity[n.severity] || 0) + 1;
  });

  return {
    total,
    unread,
    critical,
    high,
    medium,
    low,
    riskScore,
    byCategory,
    bySeverity,
  };
}

// ============================================================================
// AI DECISION SUMMARY
// ============================================================================

export function getAIDecisionSummary() {
  const stats = getAINotificationStats();
  const top = getAINotifications({ unreadOnly: true, limit: 5 });

  if (!top.length) {
    return {
      status: "stable",
      title: "Operación estable",
      message: "No hay alertas activas pendientes.",
      nextAction: "Continuar monitoreo.",
      riskScore: 0,
    };
  }

  const highest = top.sort((a, b) => b.riskScore - a.riskScore)[0];

  return {
    status: stats.riskScore >= 80 ? "critical" : stats.riskScore >= 60 ? "risk" : "active",
    title: highest.title,
    message: highest.description || highest.recommendedAction || "Revisar alerta.",
    nextAction: highest.recommendedAction || "Abrir módulo relacionado.",
    riskScore: stats.riskScore,
  };
}

// ============================================================================
// MARK AS READ
// ============================================================================

export function markAINotificationAsRead(id: string) {
  const notification = notifications.find((n) => n.id === id);

  if (notification) {
    notification.read = true;
  }

  return notification;
}

export function markAllAINotificationsAsRead() {
  notifications.forEach((n) => {
    n.read = true;
  });

  return notifications;
}

// ============================================================================
// DELETE NOTIFICATION
// ============================================================================

export function removeAINotification(id: string) {
  const index = notifications.findIndex((n) => n.id === id);

  if (index >= 0) {
    notifications.splice(index, 1);
  }
}

// ============================================================================
// CLEAR ALL
// ============================================================================

export function clearAINotifications() {
  notifications.length = 0;
}

// ============================================================================
// DEV / DEMO SEED
// ============================================================================

export function seedAIDemoNotifications() {
  if (notifications.length > 0) return notifications;

  notifyStockCritical({
    description: "MDF RH 18mm por debajo del mínimo operativo.",
    material: "MDF RH 18mm",
  });

  notifyLowMargin({
    description: "Proyecto con margen estimado menor a 15%.",
    project: "Proyecto muestra",
  });

  notifyOrderDelayed({
    description: "OP-DEMO-001 lleva más de 48 horas sin avanzar.",
    order_code: "OP-DEMO-001",
  });

  notifyCNCReady({
    description: "Orden lista para optimización y generación de QR.",
  });

  return notifications;
}
