// ============================================================================
// lib/ai/event-bus.ts
// RD WOOD SYSTEM - INDUSTRIAL EVENT BUS
// ============================================================================

export type IndustrialEvent = {
  type: string;

  module?: string;

  payload?: any;

  createdAt: string;
};

type EventHandler = (
  event: IndustrialEvent
) => Promise<void> | void;

// ============================================================================
// EVENT STORAGE
// ============================================================================

const listeners: Record<
  string,
  EventHandler[]
> = {};

// ============================================================================
// REGISTER EVENT
// ============================================================================

export function onIndustrialEvent(
  eventType: string,
  handler: EventHandler
) {
  if (!listeners[eventType]) {
    listeners[eventType] = [];
  }

  listeners[eventType].push(handler);
}

// ============================================================================
// EMIT EVENT
// ============================================================================

export async function emitIndustrialEvent(
  event: IndustrialEvent
) {
  const handlers =
    listeners[event.type] || [];

  for (const handler of handlers) {
    try {
      await handler(event);
    } catch (error) {
      console.error(
        "Industrial event error:",
        error
      );
    }
  }
}

// ============================================================================
// COMMON EVENTS
// ============================================================================

export const INDUSTRIAL_EVENTS = {
  QUOTE_APPROVED:
    "QUOTE_APPROVED",

  ORDER_CREATED:
    "ORDER_CREATED",

  BOM_READY:
    "BOM_READY",

  CNC_READY:
    "CNC_READY",

  QR_GENERATED:
    "QR_GENERATED",

  INSTALLATION_READY:
    "INSTALLATION_READY",

  STOCK_CRITICAL:
    "STOCK_CRITICAL",

  LOW_MARGIN:
    "LOW_MARGIN",

  ORDER_COMPLETED:
    "ORDER_COMPLETED",
};