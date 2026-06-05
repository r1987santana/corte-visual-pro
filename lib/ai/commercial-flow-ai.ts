// ============================================================================
// RD WOOD SYSTEM - COMMERCIAL / DESIGN AI ANALYZER
// ============================================================================

export type CommercialAIInsight = {
  summary: string;
  recommendations: string[];
  blockers: string[];
};

function n(value: any) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function text(value: any, fallback = "") {
  const result = String(value || "").trim();
  return result || fallback;
}

function lower(value: any) {
  return text(value).toLowerCase();
}

function hasObject(value: any) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

function statusHas(value: any, word: string) {
  return lower(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .includes(word);
}

function paymentTotal(payments: any[]) {
  return (payments || []).reduce((acc, payment) => acc + n(payment.amount ?? payment.total ?? payment.monto), 0);
}

function quoteMargin(quote: any) {
  const total = n(quote?.total);
  const cost = n(quote?.cost_total ?? quote?.total_cost);
  if (n(quote?.margin) > 0) return n(quote.margin);
  if (total <= 0) return 0;
  return ((total - cost) / total) * 100;
}

export function analyzeCommercialFlowAI({
  client,
  appointment,
  measurement,
  designRequest,
  quote,
  contract,
  payments,
}: {
  client?: any;
  appointment?: any;
  measurement?: any;
  designRequest?: any;
  quote?: any;
  contract?: any;
  payments?: any[];
}): CommercialAIInsight {
  const blockers: string[] = [];
  const recommendations: string[] = [];
  const paid = paymentTotal(payments || []);
  const margin = quoteMargin(quote);

  const hasClient = hasObject(client) || text(quote?.client_name || contract?.client_name);
  const hasAppointment = hasObject(appointment);
  const hasMeasurement = hasObject(measurement) || n(designRequest?.room_width) > 0 || n(quote?.width_m) > 0;
  const hasDesign = hasObject(designRequest) || text(contract?.approved_render_url);
  const renderApproved =
    Boolean(text(contract?.approved_render_url)) ||
    Boolean(designRequest?.selected_variant_id) ||
    statusHas(designRequest?.ai_status || designRequest?.status || quote?.status, "aprob");
  const hasQuote = hasObject(quote) || Boolean(contract?.quote_id);
  const hasContract = hasObject(contract);

  if (!hasClient) blockers.push("Falta crear cliente maestro.");
  if (hasClient && !hasAppointment) blockers.push("Falta agendar visita al cliente.");
  if (hasAppointment && paid < 5000) blockers.push("Falta pago fijo RD$5,000 antes de medir/renderizar.");
  if (paid >= 5000 && !hasMeasurement) blockers.push("Falta levantamiento con medidas reales.");
  if (hasMeasurement && !hasDesign) blockers.push("Falta preparar renders IA.");
  if (hasDesign && !renderApproved) blockers.push("Falta aprobacion del render por el cliente.");
  if (renderApproved && !hasQuote) blockers.push("Falta cotizacion desde render aprobado.");
  if (hasQuote && margin > 0 && margin < 25) blockers.push(`Margen bajo en cotizacion: ${margin.toFixed(1)}%.`);
  if (hasQuote && !hasContract && statusHas(quote?.status, "aprob")) blockers.push("Cotizacion aprobada sin contrato generado.");

  recommendations.push("Flujo comercial correcto: cliente -> agenda -> RD$5,000 -> levantamiento -> 4 renders -> cotizacion -> contrato.");

  if (!hasClient) {
    recommendations.push("Captar datos minimos: nombre, telefono, direccion, tipo de proyecto y canal.");
  } else if (!hasAppointment) {
    recommendations.push("Agendar visita y confirmar por WhatsApp antes de enviar equipo.");
  } else if (paid < 5000) {
    recommendations.push("Registrar pago fijo RD$5,000 con soporte; este credito se descuenta al final.");
  } else if (!hasMeasurement) {
    recommendations.push("Tomar medidas reales y fotos; eso alimenta render y cotizacion.");
  } else if (!hasDesign) {
    recommendations.push("Generar 4 opciones de render con estilos claros para que el cliente elija.");
  } else if (!renderApproved) {
    recommendations.push("Enviar portal del cliente con las opciones y guardar la seleccion aprobada.");
  } else if (!hasQuote) {
    recommendations.push("Cotizar solo el render aprobado y validar margen antes del contrato.");
  } else if (!hasContract) {
    recommendations.push("Generar contrato con render aprobado, forma de pago 60/20/20 y alcance.");
  } else {
    recommendations.push("Contrato listo: validar pago inicial 60% antes de produccion.");
  }

  const summary = [
    `Cliente: ${hasClient ? "si" : "no"}`,
    `Agenda: ${hasAppointment ? "si" : "no"}`,
    `Pago medicion: RD$${paid.toLocaleString("es-DO", { maximumFractionDigits: 2 })}`,
    `Medidas: ${hasMeasurement ? "si" : "no"}`,
    `Render aprobado: ${renderApproved ? "si" : "no"}`,
    `Cotizacion: ${hasQuote ? "si" : "no"}`,
    `Contrato: ${hasContract ? "si" : "no"}`,
  ].join(" | ");

  return {
    summary,
    recommendations,
    blockers,
  };
}
