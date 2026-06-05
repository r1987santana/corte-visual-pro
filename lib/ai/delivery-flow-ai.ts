// ============================================================================
// RD WOOD SYSTEM - DELIVERY / FIELD AI
// ============================================================================

type DeliveryInput = {
  order?: any;
  project?: any;
  pieceLabels?: any[];
  delivery?: any;
};

export type DeliveryFlowInsight = {
  summary: string;
  stage: "transporte" | "instalacion" | "verificacion" | "entrega" | "cerrado";
  score: number;
  metrics: {
    modules: number;
    pieces: number;
    packedPieces: number;
    installedPieces: number;
    transportEvents: number;
    transportPhotos: number;
    installationEvents: number;
    verificationReports: number;
    finalPhotos: number;
    signatures: number;
    checklistDone: number;
  };
  blockers: string[];
  recommendations: string[];
  nextRoute: string;
};

function arr(value: any): any[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function text(value: any) {
  return String(value ?? "").trim();
}

function lower(value: any) {
  return text(value).toLowerCase();
}

function hasText(value: any) {
  return text(value).length > 0;
}

function statusIn(value: any, candidates: string[]) {
  const current = lower(value);
  return candidates.some((candidate) => current.includes(candidate));
}

function uniqueModules(pieceLabels: any[]) {
  const keys = new Set<string>();
  pieceLabels.forEach((piece) => {
    const order = text(piece.order_code || piece.production_order_code || piece.orderCode || "SIN-ORDEN");
    const moduleName = text(piece.module_name || piece.module || "SIN-MODULO");
    keys.add(`${order}__${moduleName}`);
  });
  return keys.size;
}

function countStatuses(rows: any[], fields: string[], statuses: string[]) {
  return rows.filter((row) => fields.some((field) => statusIn(row?.[field], statuses))).length;
}

function deliveryRows(delivery: any) {
  return {
    reports: arr(delivery?.reports || delivery?.finalDeliveryReports || delivery?.report),
    photos: arr(delivery?.photos || delivery?.finalDeliveryPhotos),
    signatures: arr(delivery?.signatures || delivery?.finalDeliverySignatures),
    checklist: arr(delivery?.checklist || delivery?.finalDeliveryChecklist),
    verificationReports: arr(delivery?.verificationReports),
    verificationIssues: arr(delivery?.verificationIssues),
    verificationPhotos: arr(delivery?.verificationPhotos || delivery?.verificationGeneralPhotos),
    transportEvents: arr(delivery?.transportEvents),
    transportPhotos: arr(delivery?.transportPhotos),
    installationAssignments: arr(delivery?.installationAssignments),
    installationHandoffs: arr(delivery?.installationHandoffs),
    installationEvents: arr(delivery?.installationEvents),
    installationScans: arr(delivery?.installationScans),
    drivers: arr(delivery?.drivers),
    vehicles: arr(delivery?.vehicles),
    assemblyChecks: arr(delivery?.assemblyChecks),
  };
}

export function analyzeDeliveryFlowAI(input: DeliveryInput): DeliveryFlowInsight {
  const pieceLabels = arr(input.pieceLabels);
  const rows = deliveryRows(input.delivery || {});

  const modules = uniqueModules(pieceLabels);
  const pieces = pieceLabels.length;
  const packedPieces = countStatuses(pieceLabels, ["current_status", "status"], [
    "empacada",
    "carga_transporte",
    "salida_transporte",
    "en_transporte",
    "transportada",
    "instalada",
    "entregada",
  ]);
  const installedPieces = countStatuses(pieceLabels, ["current_status", "status", "installation_status"], [
    "instalada",
    "instalado",
    "entregada",
  ]);

  const hasDriver = rows.transportEvents.some((event) => hasText(event.driver_id) || hasText(event.driver_name));
  const hasVehicle = rows.transportEvents.some((event) => hasText(event.vehicle_id) || hasText(event.vehicle));
  const hasTransportDelivery = rows.transportEvents.some((event) =>
    statusIn(event.event_type || event.event_status || event.status, ["entrega_instalacion", "entregado", "instalacion"]),
  );
  const hasInstallation = installedPieces > 0 || rows.installationAssignments.some((row) =>
    statusIn(row.status || row.installation_status || row.assignment_status, ["instalada", "completada", "finalizada", "qa"]),
  );
  const hasQaApproved = rows.verificationReports.some((report) =>
    statusIn(report.qa_status || report.status || report.final_status, ["aprobado", "liberado", "verificado"]),
  );
  const openIssues = rows.verificationIssues.filter((issue) =>
    !statusIn(issue.status || issue.issue_status, ["cerrado", "resuelto", "cancelado"]),
  );
  const report = rows.reports[0] || input.delivery || {};
  const deliveryClosed =
    statusIn(report.delivery_status || report.final_status || report.status, ["firmado", "entregado", "cerrado"]) ||
    hasText(report.closed_at) ||
    hasText(report.signed_at);

  const checklistDone = rows.checklist.filter((item) => {
    if (typeof item === "string") return true;
    return Boolean(item.checked || item.done || item.is_done || item.completed);
  }).length;

  const metrics = {
    modules,
    pieces,
    packedPieces,
    installedPieces,
    transportEvents: rows.transportEvents.length,
    transportPhotos: rows.transportPhotos.length,
    installationEvents: rows.installationEvents.length,
    verificationReports: rows.verificationReports.length,
    finalPhotos: rows.photos.length,
    signatures: rows.signatures.length,
    checklistDone,
  };

  const blockers: string[] = [];
  const recommendations: string[] = [];

  if (pieces <= 0 && rows.installationAssignments.length <= 0 && rows.reports.length <= 0) {
    blockers.push("No hay modulos o piezas liberadas para campo.");
  }

  if (packedPieces > 0 && rows.transportEvents.length <= 0) {
    blockers.push("Falta registrar carga/transporte del modulo.");
  }

  if (rows.transportEvents.length > 0 && !hasDriver) {
    blockers.push("Falta chofer asignado en transporte.");
  }

  if (rows.transportEvents.length > 0 && !hasVehicle) {
    blockers.push("Falta vehiculo asignado en transporte.");
  }

  if (rows.transportEvents.length > 0 && rows.transportPhotos.length <= 0) {
    blockers.push("Falta foto de carga o evidencia de transporte.");
  }

  if (hasTransportDelivery && !hasInstallation) {
    blockers.push("Transporte entrego, pero instalacion no tiene avance registrado.");
  }

  if (hasInstallation && !hasQaApproved) {
    blockers.push("Instalacion necesita verificacion QA aprobada.");
  }

  if (openIssues.length > 0) {
    blockers.push(`Hay ${openIssues.length} incidencia(s) de verificacion sin cerrar.`);
  }

  if (hasQaApproved && rows.photos.length <= 0) {
    blockers.push("Entrega final necesita al menos una foto final.");
  }

  if (hasQaApproved && rows.signatures.length < 2) {
    blockers.push("Entrega final necesita firma del cliente y representante.");
  }

  let stage: DeliveryFlowInsight["stage"] = "transporte";
  let nextRoute = "/transporte";
  if (deliveryClosed) {
    stage = "cerrado";
    nextRoute = "/postventa";
  } else if (hasQaApproved) {
    stage = "entrega";
    nextRoute = "/entrega-final";
  } else if (hasInstallation) {
    stage = "verificacion";
    nextRoute = "/verificacion";
  } else if (hasTransportDelivery || rows.installationHandoffs.length > 0 || rows.transportEvents.length > 0) {
    stage = "instalacion";
    nextRoute = "/instalacion";
  }

  recommendations.push(
    `Campo: ${modules} modulo(s), ${pieces} pieza(s), ${packedPieces} lista(s) para despacho, ${installedPieces} instalada(s).`,
  );
  recommendations.push(
    "Transporte debe registrar chofer, vehiculo, GPS/ubicacion, foto de carga y WhatsApp al cliente.",
  );
  recommendations.push("Instalacion debe guardar avance por modulo, fotos e incidencias antes de QA.");
  recommendations.push("Entrega final debe cerrar con foto final, checklist completo y dos firmas.");

  if (rows.transportEvents.length <= 0 && packedPieces > 0) {
    recommendations.push("Siguiente accion: abrir Transporte y marcar Cargar para el modulo listo.");
  } else if (!hasInstallation && rows.transportEvents.length > 0) {
    recommendations.push("Siguiente accion: abrir Instalacion y confirmar avance real del modulo.");
  } else if (hasInstallation && !hasQaApproved) {
    recommendations.push("Siguiente accion: abrir Verificacion y aprobar o devolver incidencia.");
  } else if (hasQaApproved && !deliveryClosed) {
    recommendations.push("Siguiente accion: abrir Entrega Final, subir foto y firmar acta.");
  }

  const scoreParts = [
    pieces > 0 ? 15 : 0,
    packedPieces > 0 ? 15 : 0,
    rows.transportEvents.length > 0 ? 15 : 0,
    rows.transportPhotos.length > 0 ? 10 : 0,
    hasInstallation ? 15 : 0,
    hasQaApproved ? 15 : 0,
    rows.photos.length > 0 ? 7 : 0,
    rows.signatures.length >= 2 ? 8 : 0,
  ];
  const score = Math.min(100, scoreParts.reduce((sum, value) => sum + value, 0));

  const summary = [
    `Campo IA: etapa ${stage}.`,
    `Score ${score}%.`,
    `${metrics.transportEvents} evento(s) transporte, ${metrics.installationEvents} evento(s) instalacion, ${metrics.verificationReports} QA, ${metrics.finalPhotos} foto(s) final(es), ${metrics.signatures} firma(s).`,
  ].join(" ");

  return {
    summary,
    stage,
    score,
    metrics,
    blockers,
    recommendations,
    nextRoute,
  };
}
