export type ProductionAction =
  | "GENERATE_QR"
  | "OPEN_CNC"
  | "OPEN_CUTTING"
  | "CREATE_REQUISITION"
  | "CHECK_BOM"
  | "PRIORITIZE_ORDERS"
  | "OPEN_QA";

export type ProductionActionResult = {
  action: ProductionAction;
  title: string;
  message: string;
  route?: string;
  allowed: boolean;
};

export function resolveProductionAction(command: string): ProductionActionResult {
  const raw = String(command || "").toLowerCase();

  if (raw.includes("qr")) {
    return {
      action: "GENERATE_QR",
      title: "Generar QR",
      message: "Primero guarda la optimización en Corte/CNC para crear etiquetas QR reales.",
      route: "/corte",
      allowed: true,
    };
  }

  if (raw.includes("cnc") || raw.includes("nesting")) {
    return {
      action: "OPEN_CNC",
      title: "Enviar a CNC",
      message: "Enviar al módulo Corte y CNC para nesting, veta, merma y preparación de mecanizado.",
      route: "/corte",
      allowed: true,
    };
  }

  if (raw.includes("requisicion") || raw.includes("requisición") || raw.includes("comprar")) {
    return {
      action: "CREATE_REQUISITION",
      title: "Crear requisición",
      message: "Preparar solicitud de almacén/compras para materiales faltantes.",
      route: "/compras",
      allowed: true,
    };
  }

  if (raw.includes("bom")) {
    return {
      action: "CHECK_BOM",
      title: "Revisar BOM",
      message: "Validar materiales, costos y stock antes de procesar producción.",
      route: "/produccion",
      allowed: true,
    };
  }

  if (raw.includes("prioridad") || raw.includes("prioriza")) {
    return {
      action: "PRIORITIZE_ORDERS",
      title: "Priorizar órdenes",
      message: "Ordenar producción por fecha, estado, disponibilidad y utilidad.",
      route: "/produccion",
      allowed: true,
    };
  }

  return {
    action: "CHECK_BOM",
    title: "Acción IA",
    message: "Comando recibido. La IA puede revisar BOM, QR, CNC, requisición, prioridad y QA.",
    route: "/produccion",
    allowed: false,
  };
}
