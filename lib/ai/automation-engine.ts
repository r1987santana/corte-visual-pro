// ============================================================================
// lib/ai/automation-engine.ts
// RD WOOD SYSTEM - INDUSTRIAL AUTOMATION ENGINE + AI NOTIFICATIONS
// ============================================================================

import {
  onIndustrialEvent,
  INDUSTRIAL_EVENTS,
} from "./event-bus";

import { executeLiveAIAction } from "./live-actions";

import {
  createAINotification,
} from "./notification-center";

// ============================================================================
// QUOTE APPROVED
// ============================================================================

onIndustrialEvent(
  INDUSTRIAL_EVENTS.QUOTE_APPROVED,
  async (event) => {
    console.log("Automation: Quote approved", event);

    createAINotification({
      title: "Cotización aprobada",
      description: "Producción debe iniciar BOM y validación de materiales.",
      severity: "info",
      module: "produccion",
      actionRoute: "/produccion",
      metadata: event.payload,
    });

    await executeLiveAIAction({
      action: "create_alert",
      payload: {
        title: "Cotización aprobada",
        description: "Producción debe iniciar BOM y validación.",
        severity: "info",
      },
    });
  }
);

// ============================================================================
// STOCK CRITICAL
// ============================================================================

onIndustrialEvent(
  INDUSTRIAL_EVENTS.STOCK_CRITICAL,
  async (event) => {
    console.log("Automation: Critical stock", event);

    createAINotification({
      title: "Stock crítico detectado",
      description: "Inventario requiere revisión inmediata.",
      severity: "danger",
      module: "inventario",
      actionRoute: "/inventario",
      metadata: event.payload,
    });

    await executeLiveAIAction({
      action: "create_alert",
      payload: {
        title: "Stock crítico detectado",
        description: "Inventario requiere revisión inmediata.",
        severity: "danger",
      },
    });
  }
);

// ============================================================================
// CNC READY
// ============================================================================

onIndustrialEvent(
  INDUSTRIAL_EVENTS.CNC_READY,
  async (event) => {
    console.log("Automation: CNC ready", event);

    createAINotification({
      title: "CNC listo",
      description: "La orden está lista para corte, nesting, QR y trazabilidad.",
      severity: "success",
      module: "corte",
      actionRoute: "/corte",
      metadata: event.payload,
    });

    await executeLiveAIAction({
      action: "generate_qr",
      payload: event.payload,
    });
  }
);

// ============================================================================
// LOW MARGIN
// ============================================================================

onIndustrialEvent(
  INDUSTRIAL_EVENTS.LOW_MARGIN,
  async (event) => {
    console.log("Automation: Low margin", event);

    createAINotification({
      title: "Margen bajo detectado",
      description: "Proyecto con utilidad peligrosa. Revisar costos y precio.",
      severity: "warning",
      module: "dashboard-ceo",
      actionRoute: "/dashboard-ceo",
      metadata: event.payload,
    });

    await executeLiveAIAction({
      action: "create_alert",
      payload: {
        title: "Margen bajo detectado",
        description: "Proyecto con utilidad peligrosa.",
        severity: "warning",
      },
    });
  }
);

// ============================================================================
// ORDER COMPLETED
// ============================================================================

onIndustrialEvent(
  INDUSTRIAL_EVENTS.ORDER_COMPLETED,
  async (event) => {
    console.log("Automation: Order completed", event);

    createAINotification({
      title: "Orden completada",
      description: "Preparar verificación final, entrega e historial del cliente.",
      severity: "success",
      module: "produccion",
      actionRoute: "/produccion",
      metadata: event.payload,
    });

    await executeLiveAIAction({
      action: "generate_checklist",
      payload: event.payload,
    });
  }
);

// ============================================================================
// BOM READY
// ============================================================================

onIndustrialEvent(
  INDUSTRIAL_EVENTS.BOM_READY,
  async (event) => {
    console.log("Automation: BOM ready", event);

    createAINotification({
      title: "BOM listo",
      description: "Materiales listos para validación de stock y corte.",
      severity: "success",
      module: "produccion",
      actionRoute: "/produccion",
      metadata: event.payload,
    });

    await executeLiveAIAction({
      action: "prioritize_orders",
      payload: event.payload,
    });
  }
);

// ============================================================================
// QR GENERATED
// ============================================================================

onIndustrialEvent(
  INDUSTRIAL_EVENTS.QR_GENERATED,
  async (event) => {
    console.log("Automation: QR generated", event);

    createAINotification({
      title: "QR generado",
      description: "Etiquetas listas para trazabilidad de piezas.",
      severity: "success",
      module: "trazabilidad",
      actionRoute: "/qr-trazabilidad",
      metadata: event.payload,
    });
  }
);

// ============================================================================
// INSTALLATION READY
// ============================================================================

onIndustrialEvent(
  INDUSTRIAL_EVENTS.INSTALLATION_READY,
  async (event) => {
    console.log("Automation: Installation ready", event);

    createAINotification({
      title: "Instalación lista",
      description: "Preparar transporte, checklist y fotos de entrega.",
      severity: "info",
      module: "instalacion",
      actionRoute: "/instalacion",
      metadata: event.payload,
    });

    await executeLiveAIAction({
      action: "generate_checklist",
      payload: event.payload,
    });
  }
);

console.log("Industrial Automation Engine Active");