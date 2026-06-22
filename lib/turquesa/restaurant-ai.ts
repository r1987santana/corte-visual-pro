import { existsSync, readFileSync } from "fs";
import path from "path";
import type { TurquesaInventoryItem, TurquesaSnapshot } from "./restaurant-data";

export type TurquesaAIRecommendation = {
  area: "cocina" | "caja" | "inventario" | "compras" | "reservas" | "wifi" | "gerencia";
  priority: "ok" | "watch" | "urgent";
  title: string;
  text: string;
  action: string;
};

export type TurquesaAIDiagnostic = {
  area: "cocina" | "caja" | "inventario" | "reservas" | "wifi" | "impresoras";
  status: "ok" | "watch" | "urgent";
  score: number;
  metric: string;
  finding: string;
  action: string;
};

export type TurquesaAIDecision = {
  id: string;
  area: "cocina" | "caja" | "inventario" | "compras" | "reservas" | "wifi" | "impresoras" | "gerencia";
  title: string;
  summary: string;
  risk: "low" | "medium" | "high" | "critical";
  status: "draft" | "pending" | "approved";
  actionLabel: string;
};

export type TurquesaAIEvent = {
  id: string;
  area: string;
  title: string;
  summary: string;
  severity: "info" | "success" | "warning" | "danger" | "critical";
  riskScore: number;
  createdAt: string;
};

export type TurquesaAIResult = {
  ok: boolean;
  provider: "openai_responses" | "local_rules";
  model?: string;
  summary: string;
  riskLevel: "normal" | "atencion" | "critico";
  riskScore: number;
  recommendations: TurquesaAIRecommendation[];
  diagnostics: TurquesaAIDiagnostic[];
  decisions: TurquesaAIDecision[];
  events: TurquesaAIEvent[];
  guardrails: string[];
  watchlist: string[];
  nextActions: string[];
  assistantReply?: string;
  error?: string;
};

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.5";

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function paidTotal(snapshot: TurquesaSnapshot) {
  const shift = snapshot.shift;
  return Math.round(num(shift.cashSales) + num(shift.cardSales) + num(shift.transferSales));
}

function inventoryValue(inventory: TurquesaInventoryItem[]) {
  return Math.round(inventory.reduce((sum, item) => sum + num(item.onHand) * num(item.avgCost), 0));
}

function readEnvValue(filePath: string, envName: string) {
  if (!existsSync(filePath)) return "";
  const content = readFileSync(filePath, "utf8");
  const line = content
    .split(/\r?\n/)
    .find((entry) => new RegExp(`^\\s*${envName}\\s*=`).test(entry));
  if (!line) return "";
  const value = line.replace(/^\s*[^=]+\s*=\s*/, "").trim();
  return value.replace(/^["']|["']$/g, "");
}

function turquesaEnvPath() {
  return path.join(process.cwd(), "turquesa-restaurante", ".env.local");
}

function openAIKey() {
  return process.env.OPENAI_API_KEY || readEnvValue(turquesaEnvPath(), "OPENAI_API_KEY");
}

function outputTextFromResponse(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  const chunks: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content?.text) chunks.push(String(content.text));
      if (content?.type === "text" && content?.text) chunks.push(String(content.text));
    }
  }
  return chunks.join("\n").trim();
}

function supportsReasoningControls(model: string) {
  const normalized = String(model || "").toLowerCase();
  return normalized.startsWith("gpt-5") || normalized.startsWith("o");
}

function supportsTemperature(model: string) {
  const normalized = String(model || "").toLowerCase();
  return !normalized.startsWith("gpt-5") && !normalized.startsWith("o");
}

function parseJsonObject(text: string) {
  const clean = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(clean);
}

function normalizeRecommendation(item: any): TurquesaAIRecommendation {
  const area = ["cocina", "caja", "inventario", "compras", "reservas", "wifi", "gerencia"].includes(item?.area)
    ? item.area
    : "gerencia";
  const priority = ["ok", "watch", "urgent"].includes(item?.priority) ? item.priority : "watch";
  return {
    area,
    priority,
    title: String(item?.title || "Recomendacion operativa").slice(0, 90),
    text: String(item?.text || "Revisar el turno con gerencia.").slice(0, 260),
    action: String(item?.action || "Confirmar con el responsable del turno.").slice(0, 160),
  };
}

function normalizeDiagnostic(item: any): TurquesaAIDiagnostic {
  const area = ["cocina", "caja", "inventario", "reservas", "wifi", "impresoras"].includes(item?.area)
    ? item.area
    : "cocina";
  const status = ["ok", "watch", "urgent"].includes(item?.status) ? item.status : "watch";
  return {
    area,
    status,
    score: Math.max(0, Math.min(100, Number(item?.score || 50))),
    metric: String(item?.metric || "En observacion").slice(0, 80),
    finding: String(item?.finding || "Revisar este frente del turno.").slice(0, 220),
    action: String(item?.action || "Confirmar con el responsable.").slice(0, 160),
  };
}

function normalizeDecision(item: any, index: number): TurquesaAIDecision {
  const area = ["cocina", "caja", "inventario", "compras", "reservas", "wifi", "impresoras", "gerencia"].includes(item?.area)
    ? item.area
    : "gerencia";
  const risk = ["low", "medium", "high", "critical"].includes(item?.risk) ? item.risk : "medium";
  const status = ["draft", "pending", "approved"].includes(item?.status) ? item.status : "draft";
  return {
    id: String(item?.id || `turq_dec_${index + 1}`),
    area,
    title: String(item?.title || "Decision supervisada").slice(0, 100),
    summary: String(item?.summary || "Requiere validacion humana antes de ejecutar.").slice(0, 260),
    risk,
    status,
    actionLabel: String(item?.actionLabel || "Preparar aprobacion").slice(0, 90),
  };
}

function normalizeEvent(item: any, index: number): TurquesaAIEvent {
  const severity = ["info", "success", "warning", "danger", "critical"].includes(item?.severity)
    ? item.severity
    : "info";
  return {
    id: String(item?.id || `turq_evt_${index + 1}`),
    area: String(item?.area || "gerencia").slice(0, 50),
    title: String(item?.title || "Evento AI").slice(0, 100),
    summary: String(item?.summary || "Evento operativo detectado.").slice(0, 220),
    severity,
    riskScore: Math.max(0, Math.min(100, Number(item?.riskScore || 25))),
    createdAt: String(item?.createdAt || new Date().toISOString()),
  };
}

function normalizeAIJson(value: any, fallback: TurquesaAIResult, model: string): TurquesaAIResult {
  const riskLevel = ["normal", "atencion", "critico"].includes(value?.riskLevel) ? value.riskLevel : fallback.riskLevel;
  const recommendations = Array.isArray(value?.recommendations)
    ? value.recommendations.slice(0, 5).map(normalizeRecommendation)
    : fallback.recommendations;
  const diagnostics = Array.isArray(value?.diagnostics)
    ? value.diagnostics.slice(0, 6).map(normalizeDiagnostic)
    : fallback.diagnostics;
  const decisions = Array.isArray(value?.decisions)
    ? value.decisions.slice(0, 5).map(normalizeDecision)
    : fallback.decisions;
  const events = Array.isArray(value?.events)
    ? value.events.slice(0, 8).map(normalizeEvent)
    : fallback.events;
  return {
    ok: true,
    provider: "openai_responses",
    model,
    summary: String(value?.summary || fallback.summary).slice(0, 360),
    riskLevel,
    riskScore: Math.max(0, Math.min(100, Number(value?.riskScore || fallback.riskScore))),
    recommendations: recommendations.length ? recommendations : fallback.recommendations,
    diagnostics: diagnostics.length ? diagnostics : fallback.diagnostics,
    decisions: decisions.length ? decisions : fallback.decisions,
    events: events.length ? events : fallback.events,
    guardrails: Array.isArray(value?.guardrails)
      ? value.guardrails.slice(0, 6).map((item: any) => String(item).slice(0, 140))
      : fallback.guardrails,
    watchlist: Array.isArray(value?.watchlist) ? value.watchlist.slice(0, 6).map((item: any) => String(item).slice(0, 120)) : fallback.watchlist,
    nextActions: Array.isArray(value?.nextActions)
      ? value.nextActions.slice(0, 5).map((item: any) => String(item).slice(0, 150))
      : fallback.nextActions,
    assistantReply: String(value?.assistantReply || fallback.assistantReply || value?.summary || fallback.summary).slice(0, 700),
  };
}

export function analyzeTurquesaLocal(snapshot: TurquesaSnapshot): TurquesaAIResult {
  const openTables = snapshot.tables.filter((table) => table.status === "open" || table.status === "attention");
  const attentionTables = snapshot.tables.filter((table) => table.status === "attention");
  const readyTickets = snapshot.kitchenTickets.filter((ticket) => ticket.status === "ready");
  const cookingTickets = snapshot.kitchenTickets.filter((ticket) => ticket.status === "cooking");
  const criticalInventory = snapshot.inventory.filter((item) => item.trend === "critico");
  const lowInventory = snapshot.inventory.filter((item) => item.trend === "bajo");
  const openBalance = openTables.reduce((sum, table) => sum + num(table.total), 0);
  const paid = paidTotal(snapshot);
  const riskScore = Math.min(
    100,
    24 +
      criticalInventory.length * 18 +
      lowInventory.length * 8 +
      attentionTables.length * 14 +
      readyTickets.length * 8 +
      cookingTickets.filter((ticket) => ticket.minutes >= 12).length * 5
  );
  const recommendations: TurquesaAIRecommendation[] = [];

  if (criticalInventory.length) {
    recommendations.push({
      area: "inventario",
      priority: "urgent",
      title: "Compra critica antes del proximo servicio",
      text: `${criticalInventory.map((item) => item.item).join(", ")} esta por debajo del minimo operativo.`,
      action: "Generar compra sugerida y confirmar proveedor/costo antes de abrir el proximo turno.",
    });
  }

  if (readyTickets.length) {
    recommendations.push({
      area: "cocina",
      priority: "watch",
      title: "Retirar platos listos del KDS",
      text: `${readyTickets.length} ticket(s) aparecen listos para servir y pueden afectar tiempos de mesa.`,
      action: `Servir o avanzar ${readyTickets[0].id} y revisar barra/cocina cada 5 minutos.`,
    });
  }

  if (attentionTables.length) {
    recommendations.push({
      area: "caja",
      priority: "watch",
      title: "Mesa en atencion requiere seguimiento",
      text: `${attentionTables.map((table) => table.label).join(", ")} necesita cierre de experiencia o cobro oportuno.`,
      action: "Enviar encargado de salon, confirmar satisfaccion y preparar cobro si la mesa termino.",
    });
  }

  recommendations.push({
    area: "gerencia",
    priority: "ok",
    title: "Pulso del turno",
    text: `Venta cobrada ${paid.toLocaleString("es-DO")} DOP, ${openTables.length} mesa(s) abiertas y ${snapshot.reservations.length} reserva(s) activas.`,
    action: "Mantener gerencia revisando caja, cocina e inventario antes del cierre.",
  });

  const riskLevel = criticalInventory.length ? "critico" : attentionTables.length || lowInventory.length || readyTickets.length ? "atencion" : "normal";
  const diagnostics: TurquesaAIDiagnostic[] = [
    {
      area: "cocina",
      status: readyTickets.length || cookingTickets.some((ticket) => ticket.minutes >= 12) ? "watch" : "ok",
      score: Math.min(100, 30 + snapshot.kitchenTickets.length * 8 + readyTickets.length * 14),
      metric: `${snapshot.kitchenTickets.length} tickets KDS`,
      finding: readyTickets.length
        ? `${readyTickets.length} ticket(s) listos esperando servicio.`
        : "Flujo de cocina dentro del rango operativo.",
      action: readyTickets.length ? `Servir ${readyTickets[0].id} antes de abrir nuevas comandas.` : "Mantener tablero KDS visible.",
    },
    {
      area: "caja",
      status: openBalance > paid * 0.35 ? "watch" : "ok",
      score: Math.min(100, 28 + Math.round(openBalance / 1500)),
      metric: `${openTables.length} mesas abiertas`,
      finding: `Caja cobrada ${paid.toLocaleString("es-DO")} DOP y saldo abierto ${openBalance.toLocaleString("es-DO")} DOP.`,
      action: attentionTables.length ? "Preparar cobro y seguimiento de satisfaccion." : "Mantener cuadre antes del cierre.",
    },
    {
      area: "inventario",
      status: criticalInventory.length ? "urgent" : lowInventory.length ? "watch" : "ok",
      score: Math.min(100, 22 + criticalInventory.length * 30 + lowInventory.length * 14),
      metric: `${criticalInventory.length} criticos`,
      finding: criticalInventory.length
        ? `${criticalInventory.map((item) => item.item).join(", ")} bajo minimo.`
        : lowInventory.length
          ? `${lowInventory.map((item) => item.item).join(", ")} cerca de reposicion.`
          : "Inventario estable para el turno.",
      action: criticalInventory.length ? "Preparar compra supervisada antes del proximo servicio." : "Revisar consumo al cierre.",
    },
    {
      area: "reservas",
      status: snapshot.reservations.length >= 3 ? "watch" : "ok",
      score: Math.min(100, 26 + snapshot.reservations.length * 10),
      metric: `${snapshot.reservations.length} reservas`,
      finding: snapshot.reservations[0]
        ? `Proxima: ${snapshot.reservations[0].time} / ${snapshot.reservations[0].name}.`
        : "Sin reservas inmediatas.",
      action: "Preasignar mesa, anfitrion y tiempos de cocina.",
    },
    {
      area: "wifi",
      status: snapshot.wifiLeads.length ? "ok" : "watch",
      score: Math.min(100, 20 + snapshot.wifiLeads.length * 12),
      metric: `${snapshot.wifiLeads.length} leads`,
      finding: snapshot.wifiLeads.length
        ? "Portal Wi-Fi esta captando clientes para CRM."
        : "No hay leads recientes del portal Wi-Fi.",
      action: "Convertir clientes nuevos en promocion o base CRM.",
    },
    {
      area: "impresoras",
      status: snapshot.kitchenTickets.length ? "ok" : "watch",
      score: Math.min(100, 30 + snapshot.kitchenTickets.length * 9),
      metric: "3 estaciones",
      finding: "Despacho, cocina y bar deben recibir comandas separadas.",
      action: "Verificar cola antes de cada pico de servicio.",
    },
  ];

  const decisions: TurquesaAIDecision[] = [
    ...(criticalInventory.length
      ? [
          {
            id: "turq_dec_compra_critica",
            area: "compras" as const,
            title: "Compra critica de insumos",
            summary: `${criticalInventory.map((item) => item.item).join(", ")} por debajo del minimo. Requiere aprobacion de gerencia antes de ordenar.`,
            risk: "high" as const,
            status: "draft" as const,
            actionLabel: "Preparar aprobacion",
          },
        ]
      : []),
    ...(attentionTables.length
      ? [
          {
            id: "turq_dec_servicio_mesa",
            area: "gerencia" as const,
            title: "Intervencion de servicio",
            summary: `${attentionTables.map((table) => table.label).join(", ")} requiere seguimiento de salon antes de cobro o salida.`,
            risk: "medium" as const,
            status: "draft" as const,
            actionLabel: "Asignar encargado",
          },
        ]
      : []),
    ...(readyTickets.length
      ? [
          {
            id: "turq_dec_despacho_kds",
            area: "cocina" as const,
            title: "Despacho inmediato KDS",
            summary: `${readyTickets[0].id} esta listo. Evitar que el plato pierda temperatura o afecte experiencia.`,
            risk: "medium" as const,
            status: "draft" as const,
            actionLabel: "Enviar a salon",
          },
        ]
      : []),
    {
      id: "turq_dec_cierre_turno",
      area: "caja" as const,
      title: "Preparacion de cierre",
      summary: openTables.length
        ? `Aun hay ${openTables.length} mesa(s) activas. No cerrar turno hasta cobrar o transferir responsabilidad.`
        : "Turno apto para cuadre final con gerencia.",
      risk: openTables.length ? "medium" as const : "low" as const,
      status: "draft" as const,
      actionLabel: openTables.length ? "Revisar mesas" : "Preparar cierre",
    },
  ].slice(0, 5);

  const eventTime = new Date().toISOString();
  const events: TurquesaAIEvent[] = [
    ...criticalInventory.slice(0, 2).map((item, index) => ({
      id: `turq_evt_stock_${index}`,
      area: "inventario",
      title: `Stock critico: ${item.item}`,
      summary: `${item.onHand} ${item.unit} disponible; minimo ${item.min}.`,
      severity: "critical" as const,
      riskScore: 88,
      createdAt: eventTime,
    })),
    ...readyTickets.slice(0, 2).map((ticket, index) => ({
      id: `turq_evt_kds_${index}`,
      area: ticket.station,
      title: `Ticket listo ${ticket.id}`,
      summary: `${ticket.table}: ${ticket.items.join(", ")}.`,
      severity: "warning" as const,
      riskScore: 61,
      createdAt: eventTime,
    })),
    ...attentionTables.slice(0, 2).map((table, index) => ({
      id: `turq_evt_mesa_${index}`,
      area: "salon",
      title: `Mesa en atencion ${table.label}`,
      summary: `${table.zone}, ${table.minutes} min, total ${table.total.toLocaleString("es-DO")} DOP.`,
      severity: "warning" as const,
      riskScore: 58,
      createdAt: eventTime,
    })),
    {
      id: "turq_evt_wifi",
      area: "wifi",
      title: "Portal Wi-Fi captando clientes",
      summary: `${snapshot.wifiLeads.length} lead(s) capturados para CRM y promociones.`,
      severity: "success" as const,
      riskScore: 18,
      createdAt: eventTime,
    },
  ].slice(0, 8);

  return {
    ok: true,
    provider: "local_rules",
    summary: `Turno ${snapshot.shift.label}: ${openTables.length} mesa(s) abiertas, ${snapshot.kitchenTickets.length} ticket(s) KDS, ${criticalInventory.length} insumo(s) critico(s) y valor de inventario aproximado ${inventoryValue(snapshot.inventory).toLocaleString("es-DO")} DOP.`,
    riskLevel,
    riskScore,
    recommendations: recommendations.slice(0, 5),
    diagnostics,
    decisions,
    events,
    guardrails: [
      "Compras, descuentos, anulaciones y cierre de caja requieren aprobacion humana.",
      "La AI no modifica inventario ni dinero sin registrar responsable.",
      "Las sugerencias de servicio se validan con gerente de turno.",
      "Los datos del portal Wi-Fi se usan solo para CRM autorizado.",
    ],
    watchlist: [
      ...criticalInventory.slice(0, 3).map((item) => `${item.item}: ${item.onHand} ${item.unit} disponible, minimo ${item.min}`),
      ...readyTickets.slice(0, 2).map((ticket) => `${ticket.id}: listo en ${ticket.station}`),
      ...attentionTables.slice(0, 2).map((table) => `${table.label}: mesa en atencion`),
    ].slice(0, 6),
    nextActions: [
      criticalInventory.length ? "Generar o revisar compra sugerida." : "Mantener monitoreo de inventario.",
      readyTickets.length ? "Servir tickets listos antes de nuevas comandas." : "Mantener KDS bajo observacion.",
      openTables.length ? "Preparar caja para cierre cuando no queden mesas abiertas." : "Turno apto para cierre operativo.",
    ],
    assistantReply: [
      riskLevel === "critico" ? "El turno necesita atencion inmediata." : riskLevel === "atencion" ? "El turno esta estable, pero con puntos a vigilar." : "El turno esta bajo control.",
      criticalInventory.length ? `Prioridad: compra supervisada de ${criticalInventory.map((item) => item.item).join(", ")}.` : "Inventario sin bloqueo critico principal.",
      readyTickets.length ? `Despachar ${readyTickets[0].id} primero.` : "KDS sin platos listos acumulados.",
      attentionTables.length ? `Gerencia debe revisar ${attentionTables.map((table) => table.label).join(", ")}.` : "Salon sin mesas marcadas en atencion.",
    ].join(" "),
  };
}

function compactSnapshot(snapshot: TurquesaSnapshot) {
  return {
    restaurant: snapshot.restaurant,
    shift: snapshot.shift,
    paidTotal: paidTotal(snapshot),
    tables: snapshot.tables.map((table) => ({
      label: table.label,
      status: table.status,
      zone: table.zone,
      total: table.total,
      minutes: table.minutes,
    })),
    tickets: snapshot.kitchenTickets.map((ticket) => ({
      id: ticket.id,
      table: ticket.table,
      station: ticket.station,
      status: ticket.status,
      minutes: ticket.minutes,
      items: ticket.items,
    })),
    reservations: snapshot.reservations,
    inventory: snapshot.inventory.map((item) => ({
      item: item.item,
      onHand: item.onHand,
      unit: item.unit,
      min: item.min,
      trend: item.trend,
      avgCost: item.avgCost,
      supplier: item.supplier,
    })),
    purchaseRequests: snapshot.purchaseRequests.slice(0, 3),
    wifiLeads: snapshot.wifiLeads.slice(0, 5),
  };
}

export async function analyzeTurquesaWithAI(snapshot: TurquesaSnapshot, question = ""): Promise<TurquesaAIResult> {
  const fallback = analyzeTurquesaLocal(snapshot);
  const apiKey = openAIKey();
  const model = process.env.TURQUESA_OPENAI_MODEL || process.env.OPENAI_TEXT_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    return { ...fallback, error: "missing_openai_api_key" };
  }

  const instructions = [
    "Eres Turquesa AI Copilot, asistente operativo para un restaurante de playa en Bayahibe.",
    "Responde en espanol claro, accionable y breve para gerente, caja, cocina e inventario.",
    "Usa solo los datos del contexto. No inventes ventas, clientes, pagos, costos ni reservas.",
    "No ejecutes cambios ni ordenes compras por tu cuenta. Toda accion de dinero, inventario o personal requiere aprobacion humana.",
    "Devuelve solo JSON valido con: summary, riskLevel(normal|atencion|critico), riskScore(0-100), diagnostics[{area,status,score,metric,finding,action}], decisions[{id,area,title,summary,risk,status,actionLabel}], events[{id,area,title,summary,severity,riskScore,createdAt}], guardrails[], recommendations[{area,priority,title,text,action}], watchlist[], nextActions[], assistantReply.",
  ].join("\n");

  const requestBody: Record<string, any> = {
    model,
    instructions,
    store: false,
    input: [
      {
        role: "user",
        content: JSON.stringify({
          question: question || "Analiza el turno actual y prioriza acciones.",
          snapshot: compactSnapshot(snapshot),
          localBaseline: fallback,
        }),
      },
    ],
    max_output_tokens: 1200,
    truncation: "auto",
    metadata: {
      system: "rd-wood-system",
      module: "turquesa_restaurante",
    },
  };

  if (supportsReasoningControls(model)) requestBody.reasoning = { effort: "low" };
  if (supportsTemperature(model)) requestBody.temperature = 0.2;

  try {
    const response = await fetch(RESPONSES_URL, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ...fallback, model, error: payload?.error?.message || `OpenAI ${response.status}` };
    }

    const text = outputTextFromResponse(payload);
    if (!text) return { ...fallback, model, error: "empty_openai_response" };
    return normalizeAIJson(parseJsonObject(text), fallback, model);
  } catch (error: any) {
    return {
      ...fallback,
      model,
      error: error?.name === "AbortError" ? "openai_timeout" : error?.message || "openai_request_failed",
    };
  }
}
