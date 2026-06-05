// ============================================================================
// RD WOOD SYSTEM - MASTER WORKFLOW ENGINE
// Centraliza el flujo real: cliente -> entrega final.
// ============================================================================

export type WorkflowStage =
  | "cliente"
  | "agenda"
  | "pago_medicion"
  | "levantamiento"
  | "render"
  | "aprobacion_render"
  | "cotizacion"
  | "contrato"
  | "pago_inicial"
  | "requisicion"
  | "produccion"
  | "corte"
  | "canteo"
  | "ensamble"
  | "limpieza"
  | "transporte"
  | "instalacion"
  | "verificacion"
  | "entrega"
  | "postventa";

export type WorkflowGate = {
  key: string;
  label: string;
  ok: boolean;
  required: boolean;
  route?: string;
  reason?: string;
};

export type WorkflowState = {
  stage: WorkflowStage;
  stageLabel: string;
  progress: number;
  nextStage?: WorkflowStage;
  nextStageLabel?: string;
  blocked?: boolean;
  reason?: string;
  gates: WorkflowGate[];
  checklist: string[];
};

type BuildWorkflowInput = {
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
  screenData?: Record<string, any>;
};

const MEASUREMENT_FEE = 5000;

const STAGE_LABELS: Record<WorkflowStage, string> = {
  cliente: "Maestro cliente",
  agenda: "Agenda / visita",
  pago_medicion: "Pago fijo RD$5,000",
  levantamiento: "Levantamiento de medidas",
  render: "Render IA",
  aprobacion_render: "Aprobacion de render",
  cotizacion: "Cotizacion",
  contrato: "Contrato",
  pago_inicial: "Pago inicial 60%",
  requisicion: "Requisicion de materiales",
  produccion: "Produccion",
  corte: "Corte",
  canteo: "Canteo / CNC",
  ensamble: "Ensamblado",
  limpieza: "Limpieza / empaque",
  transporte: "Transporte",
  instalacion: "Instalacion",
  verificacion: "Verificacion",
  entrega: "Entrega final",
  postventa: "Postventa",
};

function n(value: any) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function text(value: any) {
  return String(value || "").trim();
}

function lower(value: any) {
  return text(value).toLowerCase();
}

function hasObject(value: any) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

function statusIs(value: any, names: string[]) {
  const raw = lower(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return names.some((name) => raw.includes(name));
}

function sumPayments(payments: any[], matcher?: (payment: any) => boolean) {
  return (payments || [])
    .filter((payment) => !matcher || matcher(payment))
    .reduce((acc, payment) => {
      return acc + n(payment.amount ?? payment.total ?? payment.value ?? payment.monto);
    }, 0);
}

function hasAnyDimension(...records: any[]) {
  return records.some((record) => {
    if (!hasObject(record)) return false;

    return [
      record.width_m,
      record.height_m,
      record.depth_m,
      record.length_m,
      record.room_width,
      record.room_height,
      record.room_depth,
      record.width,
      record.height,
      record.depth,
    ].some((value) => n(value) > 0);
  });
}

function paymentLooksLikeMeasurement(payment: any) {
  const haystack = [
    payment?.concept,
    payment?.notes,
    payment?.nota,
    payment?.source_type,
    payment?.source_reference,
  ].join(" ");

  return statusIs(haystack, ["medicion", "levantamiento", "render", "visita"]);
}

function pieceStatusSet(pieceLabels: any[]) {
  return new Set(
    (pieceLabels || [])
      .map((piece) => lower(piece.current_status || piece.status || piece.new_status))
      .filter(Boolean),
  );
}

function allPiecesAtLeast(pieceLabels: any[], accepted: string[]) {
  if (!pieceLabels?.length) return false;
  const normalizedAccepted = accepted.map((item) => lower(item));

  return pieceLabels.every((piece) => {
    const status = lower(piece.current_status || piece.status || piece.new_status);
    return normalizedAccepted.some((candidate) => status.includes(candidate));
  });
}

function pushGate(gates: WorkflowGate[], gate: WorkflowGate) {
  gates.push(gate);
  return gate.ok;
}

function makeState({
  stage,
  progress,
  nextStage,
  blocked = false,
  reason,
  gates,
  checklist,
}: {
  stage: WorkflowStage;
  progress: number;
  nextStage?: WorkflowStage;
  blocked?: boolean;
  reason?: string;
  gates: WorkflowGate[];
  checklist: string[];
}): WorkflowState {
  return {
    stage,
    stageLabel: STAGE_LABELS[stage],
    progress,
    nextStage,
    nextStageLabel: nextStage ? STAGE_LABELS[nextStage] : undefined,
    blocked,
    reason,
    gates,
    checklist,
  };
}

export function buildWorkflowState(input: BuildWorkflowInput): WorkflowState {
  const client = input.client || {};
  const appointment = input.appointment || {};
  const measurement = input.measurement || {};
  const designRequest = input.designRequest || {};
  const quote = input.quote || {};
  const contract = input.contract || {};
  const project = input.project || {};
  const order = input.order || {};
  const bom = input.bom || [];
  const payments = input.payments || [];
  const requisitions = input.requisitions || [];
  const pieceLabels = input.pieceLabels || [];
  const delivery = input.delivery || {};
  const screenData = input.screenData || {};

  const gates: WorkflowGate[] = [];

  const hasClient = pushGate(gates, {
    key: "client",
    label: "Cliente creado",
    ok:
      hasObject(client) ||
      Boolean(text(screenData.clientName)) ||
      Boolean(text(project.client_name || quote.client_name || contract.client_name || order.client_name)),
    required: true,
    route: "/clientes",
  });

  const hasAppointment = pushGate(gates, {
    key: "appointment",
    label: "Visita agendada",
    ok:
      hasObject(appointment) ||
      statusIs(screenData.visibleText, ["agenda", "visita agendada"]) ||
      statusIs(project.status || quote.status || contract.status, ["agend"]),
    required: true,
    route: "/agenda",
  });

  const measurementPaid = pushGate(gates, {
    key: "measurement_payment",
    label: "Pago fijo RD$5,000 registrado",
    ok:
      sumPayments(payments, paymentLooksLikeMeasurement) >= MEASUREMENT_FEE ||
      n(contract.credit_applied ?? quote.credit_applied ?? project.credit_applied) >= MEASUREMENT_FEE ||
      statusIs(quote.status || designRequest.ai_status || measurement.status, ["pagado", "paid"]),
    required: true,
    route: "/agenda",
    reason: "Antes de medir y renderizar debe existir el pago fijo RD$5,000.",
  });

  const hasMeasurement = pushGate(gates, {
    key: "measurement",
    label: "Levantamiento con medidas",
    ok:
      hasObject(measurement) ||
      hasAnyDimension(measurement, designRequest, project, quote) ||
      statusIs(designRequest.ai_status || quote.status, ["levantamiento", "medido", "medidas"]),
    required: true,
    route: "/levantamientos",
  });

  const hasRenderRequest = pushGate(gates, {
    key: "render_request",
    label: "Render IA preparado",
    ok:
      hasObject(designRequest) ||
      Boolean(text(contract.approved_render_url || project.approved_render_url || project.render_url || quote.render_url)),
    required: true,
    route: "/ia-diseno",
  });

  const renderApproved = pushGate(gates, {
    key: "render_approved",
    label: "Render aprobado por cliente",
    ok:
      Boolean(text(contract.approved_render_url || project.approved_render_url)) ||
      Boolean(designRequest.selected_variant_id) ||
      statusIs(designRequest.status || designRequest.ai_status || quote.status || contract.status, [
        "aprobado",
        "approved",
        "render aprobado",
      ]),
    required: true,
    route: "/portal-cliente",
  });

  const hasQuote = pushGate(gates, {
    key: "quote",
    label: "Cotizacion creada",
    ok: hasObject(quote) || Boolean(contract.quote_id) || Boolean(order.quote_id),
    required: true,
    route: "/cotizaciones",
  });

  const quoteApproved = pushGate(gates, {
    key: "quote_approved",
    label: "Cotizacion aprobada",
    ok:
      statusIs(quote.status || contract.status, ["aprobada", "approved", "firmado", "signed"]) ||
      hasObject(contract),
    required: true,
    route: "/cotizaciones",
  });

  const hasContract = pushGate(gates, {
    key: "contract",
    label: "Contrato generado",
    ok: hasObject(contract) || Boolean(order.contract_id),
    required: true,
    route: "/contratos",
  });

  const totalProject = n(contract.total_amount ?? quote.total ?? order.total ?? project.total);
  const initialRequired = totalProject > 0 ? totalProject * 0.6 : 0;
  const paidTowardInitial =
    n(contract.initial_paid ?? contract.amount_paid ?? quote.amount_paid ?? project.amount_paid) +
    n(contract.credit_applied ?? quote.credit_applied ?? project.credit_applied);

  const initialPaid = pushGate(gates, {
    key: "initial_payment",
    label: "Pago inicial 60%",
    ok:
      statusIs(contract.payment_status || contract.status || order.status, ["pagado", "paid", "produccion", "released"]) ||
      (initialRequired > 0 && paidTowardInitial >= initialRequired),
    required: true,
    route: "/contratos",
    reason: "Produccion no debe iniciar sin el 60% inicial o autorizacion equivalente.",
  });

  const productionReleased = pushGate(gates, {
    key: "production_released",
    label: "Liberado a produccion",
    ok:
      hasObject(order) ||
      statusIs(contract.status || quote.status || project.status, ["produccion", "released", "liberado"]),
    required: true,
    route: "/produccion",
  });

  const hasRequisition = pushGate(gates, {
    key: "requisition",
    label: "Requisicion de materiales",
    ok:
      requisitions.length > 0 ||
      statusIs(order.status || order.inventory_status, ["requisicion", "reservado", "despachado"]),
    required: true,
    route: "/inventario-inteligente/requisiciones",
  });

  const hasBom = pushGate(gates, {
    key: "bom",
    label: "BOM / materiales definidos",
    ok: bom.length > 0 || n(order.items_count) > 0 || n(order.materials_count) > 0,
    required: true,
    route: "/produccion",
  });

  const hasPieces = pieceLabels.length > 0 || n(order.pieces_count) > 0;
  const statusSet = pieceStatusSet(pieceLabels);
  const allCut = allPiecesAtLeast(pieceLabels, [
    "cortada",
    "corte",
    "canteada",
    "perforada",
    "ensamblada",
    "empacada",
    "instalada",
    "entregada",
  ]);
  const allEdged = allPiecesAtLeast(pieceLabels, ["canteada", "perforada", "ensamblada", "empacada", "instalada", "entregada"]);
  const allAssembled = allPiecesAtLeast(pieceLabels, ["ensamblada", "empacada", "instalada", "entregada"]);
  const allPacked = allPiecesAtLeast(pieceLabels, ["empacada", "instalada", "entregada"]);
  const allInstalled = allPiecesAtLeast(pieceLabels, ["instalada", "entregada"]);

  const transportReady =
    allPacked ||
    statusIs(order.status || project.status, ["empacado", "transporte", "despacho", "en ruta", "instalacion"]);

  const verified =
    statusIs(delivery.qa_status || delivery.status || order.qa_status || project.status, ["aprobado", "verificado", "qa aprobado"]);

  const deliveryClosed =
    statusIs(delivery.delivery_status || delivery.status || project.status, ["firmado", "entregado", "cerrado"]) ||
    Boolean(delivery.signed_at || delivery.received_by);

  if (!hasClient) {
    return makeState({
      stage: "cliente",
      progress: 3,
      nextStage: "agenda",
      gates,
      checklist: ["Crear cliente maestro", "Registrar telefono y direccion", "Definir tipo de proyecto"],
    });
  }

  if (!hasAppointment) {
    return makeState({
      stage: "agenda",
      progress: 8,
      nextStage: "pago_medicion",
      gates,
      checklist: ["Agendar visita", "Asignar responsable", "Confirmar direccion y hora con el cliente"],
    });
  }

  if (!measurementPaid) {
    return makeState({
      stage: "pago_medicion",
      progress: 14,
      nextStage: "levantamiento",
      blocked: true,
      reason: "Falta registrar el pago fijo RD$5,000 antes del levantamiento/render.",
      gates,
      checklist: ["Registrar pago RD$5,000", "Guardar soporte", "Liberar levantamiento"],
    });
  }

  if (!hasMeasurement) {
    return makeState({
      stage: "levantamiento",
      progress: 20,
      nextStage: "render",
      gates,
      checklist: ["Tomar medidas reales", "Registrar fotos del espacio", "Validar modulos solicitados"],
    });
  }

  if (!hasRenderRequest) {
    return makeState({
      stage: "render",
      progress: 28,
      nextStage: "aprobacion_render",
      gates,
      checklist: ["Preparar 4 opciones de render", "Usar medidas aprobadas", "Incluir materiales sugeridos"],
    });
  }

  if (!renderApproved) {
    return makeState({
      stage: "aprobacion_render",
      progress: 35,
      nextStage: "cotizacion",
      blocked: true,
      reason: "El cliente debe aprobar una opcion de render antes de cotizar.",
      gates,
      checklist: ["Enviar portal/link al cliente", "Confirmar render aprobado", "Guardar imagen aprobada"],
    });
  }

  if (!hasQuote || !quoteApproved) {
    return makeState({
      stage: "cotizacion",
      progress: 45,
      nextStage: "contrato",
      blocked: !quoteApproved && hasQuote,
      reason: hasQuote && !quoteApproved ? "La cotizacion existe, pero todavia no esta aprobada." : undefined,
      gates,
      checklist: ["Cotizar desde render aprobado", "Aplicar credito RD$5,000", "Validar margen"],
    });
  }

  if (!hasContract) {
    return makeState({
      stage: "contrato",
      progress: 52,
      nextStage: "pago_inicial",
      gates,
      checklist: ["Generar contrato", "Adjuntar render aprobado", "Enviar portal de firma"],
    });
  }

  if (!initialPaid) {
    return makeState({
      stage: "pago_inicial",
      progress: 58,
      nextStage: "requisicion",
      blocked: true,
      reason: "Falta el 60% inicial para liberar materiales y produccion.",
      gates,
      checklist: ["Registrar 60% inicial", "Validar soporte", "Liberar produccion"],
    });
  }

  if (!productionReleased) {
    return makeState({
      stage: "produccion",
      progress: 62,
      nextStage: "requisicion",
      gates,
      checklist: ["Liberar orden", "Crear BOM", "Preparar requisicion"],
    });
  }

  if (!hasRequisition) {
    return makeState({
      stage: "requisicion",
      progress: 66,
      nextStage: "produccion",
      blocked: true,
      reason: "Produccion necesita requisicion de materiales antes de cortar.",
      gates,
      checklist: ["Consolidar planchas, cantos y herrajes", "Imprimir requisicion", "Despachar almacen"],
    });
  }

  if (!hasBom) {
    return makeState({
      stage: "produccion",
      progress: 70,
      nextStage: "corte",
      blocked: true,
      reason: "No existe BOM/materiales para producir.",
      gates,
      checklist: ["Crear BOM", "Vincular inventario", "Validar cantidades"],
    });
  }

  if (!hasPieces || !allCut) {
    return makeState({
      stage: "corte",
      progress: 74,
      nextStage: "canteo",
      gates,
      checklist: ["Optimizar planchas", "Validar veta", "Generar etiquetas QR", "Marcar piezas cortadas"],
    });
  }

  if (!allEdged) {
    return makeState({
      stage: "canteo",
      progress: 80,
      nextStage: "ensamble",
      gates,
      checklist: ["Cantear lados requeridos", "Completar perforaciones CNC", "Registrar avance por pieza"],
    });
  }

  if (!allAssembled) {
    return makeState({
      stage: "ensamble",
      progress: 86,
      nextStage: "limpieza",
      gates,
      checklist: ["Ensamblar por modulo", "Validar herrajes", "Tomar evidencia si aplica"],
    });
  }

  if (!allPacked) {
    return makeState({
      stage: "limpieza",
      progress: 90,
      nextStage: "transporte",
      gates,
      checklist: ["Limpiar piezas", "Empacar modulos", "Liberar despacho"],
    });
  }

  if (!transportReady || !statusSet.has("instalada")) {
    return makeState({
      stage: allInstalled ? "verificacion" : transportReady ? "instalacion" : "transporte",
      progress: transportReady ? 94 : 92,
      nextStage: transportReady ? "verificacion" : "instalacion",
      gates,
      checklist: transportReady
        ? ["Instalar modulos", "Subir fotos de instalacion", "Reportar incidencia si existe"]
        : ["Asignar chofer", "Cargar modulos", "Enviar WhatsApp al cliente"],
    });
  }

  if (!verified) {
    return makeState({
      stage: "verificacion",
      progress: 97,
      nextStage: "entrega",
      gates,
      checklist: ["Verificar calidad", "Validar checklist QA", "Autorizar entrega final"],
    });
  }

  if (!deliveryClosed) {
    return makeState({
      stage: "entrega",
      progress: 99,
      nextStage: "postventa",
      blocked: true,
      reason: "Falta cerrar acta, foto final o firma de entrega.",
      gates,
      checklist: ["Subir foto final", "Firmar cliente", "Guardar acta de entrega"],
    });
  }

  return makeState({
    stage: "postventa",
    progress: 100,
    gates,
    checklist: ["Activar garantia", "Registrar aprendizaje del proyecto", "Cerrar ciclo comercial"],
  });
}
