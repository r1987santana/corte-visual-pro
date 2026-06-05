import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateProductionResponse } from "@/lib/ai/production-chat";
import { generateCEOResponse } from "@/lib/ai/ceo-chat";
import { resolveAIAction, actionInstructionText } from "@/lib/ai/action-router";
import { orchestrateIndustrialAI } from "@/lib/ai/orchestrator";
import { requireApiSession } from "@/lib/security/api-guard";

async function safeSelect(table: string, query = "*", limit = 100) {
  try {
    const { data, error } = await supabase.from(table).select(query).limit(limit);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

function firstRow(rows: any[]) {
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function loadProductionItems(orders: any[]) {
  try {
    const orderIds = (orders || [])
      .map((o: any) => o.id)
      .filter(Boolean)
      .slice(0, 30);

    if (orderIds.length === 0) return [];

    const { data, error } = await supabase
      .from("production_order_items")
      .select("*")
      .in("production_order_id", orderIds)
      .limit(500);

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

function isProductionModule(moduleName: string, pathname: string) {
  return (
    moduleName.includes("produccion") ||
    moduleName.includes("produccion") ||
    moduleName.includes("production") ||
    pathname.includes("produccion") ||
    pathname.includes("produccion")
  );
}

function isCEOModule(moduleName: string, pathname: string) {
  return (
    moduleName.includes("ceo") ||
    pathname.includes("dashboard-ceo") ||
    pathname.includes("ceo")
  );
}

function isCutModule(moduleName: string, pathname: string) {
  return (
    moduleName.includes("corte") ||
    moduleName.includes("cnc") ||
    moduleName.includes("cut") ||
    pathname.includes("corte") ||
    pathname.includes("cnc")
  );
}

function normalizeText(value: any) {
  return String(value || "").trim();
}

function buildDefaultResponse({
  moduleName,
  message,
  orchestratorSummary,
  orchestratorDetails,
  actionText,
}: {
  moduleName: string;
  message: string;
  orchestratorSummary: string;
  orchestratorDetails: string;
  actionText: string;
}) {
  return [
    orchestratorSummary,
    orchestratorDetails,
    "",
    "IA operativa activa.",
    `Modulo detectado: ${moduleName || "global"}`,
    message ? `Mensaje recibido: ${message}` : "",
    "",
    "Puedo ayudarte con:",
    "- generar QR",
    "- abrir Corte/CNC",
    "- crear requisicion",
    "- revisar BOM",
    "- priorizar ordenes",
    "- analizar utilidad",
    "- revisar inventario",
    actionText,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatOrchestratorDetails(orchestrator: any) {
  const recommendations = Array.isArray(orchestrator?.recommendations) ? orchestrator.recommendations : [];
  const checklist = Array.isArray(orchestrator?.workflow?.checklist) ? orchestrator.workflow.checklist : [];
  const nextActions = Array.isArray(orchestrator?.nextActions) ? orchestrator.nextActions : [];

  return [
    recommendations.length > 0 ? `Recomendaciones:\n- ${recommendations.slice(0, 5).join("\n- ")}` : "",
    checklist.length > 0 ? `Checklist de etapa:\n- ${checklist.slice(0, 5).join("\n- ")}` : "",
    nextActions.length > 0
      ? `Acciones sugeridas:\n- ${nextActions
          .slice(0, 4)
          .map((action: any) => action.label || action.type)
          .join("\n- ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(req: Request) {
  try {
    const session = await requireApiSession(req);
    if (!session.ok) return session.response;

    const body = await req.json();

    const moduleName = normalizeText(
      body?.module ||
        body?.moduleName ||
        body?.moduleKey ||
        body?.screenContext?.module ||
        ""
    ).toLowerCase();

    const pathname = normalizeText(body?.pathname || body?.screenContext?.path || "").toLowerCase();
    const message = normalizeText(body?.message || body?.prompt || "");

    const screenContext = body?.screenContext || body?.context?.screenContext || null;
    const pageData = body?.pageData || body?.context || screenContext || {};

    const actionIntent = resolveAIAction({
      message,
      moduleKey: moduleName,
      pathname,
    });

    const actionText = actionInstructionText(actionIntent.action);

    const isProduction = isProductionModule(moduleName, pathname);
    const isCEO = isCEOModule(moduleName, pathname);
    const isCut = isCutModule(moduleName, pathname);

    let orders: any[] = [];
    let productionItems: any[] = [];
    let inventory: any[] = [];
    let sales: any[] = [];
    let quotes: any[] = [];
    let projects: any[] = [];
    let clients: any[] = [];
    let appointments: any[] = [];
    let payments: any[] = [];
    let measurements: any[] = [];
    let designRequests: any[] = [];
    let contracts: any[] = [];
    let requisitions: any[] = [];
    let pieceLabels: any[] = [];
    let deliveries: any[] = [];
    let finalDeliveryPhotos: any[] = [];
    let finalDeliverySignatures: any[] = [];
    let finalDeliveryChecklist: any[] = [];
    let verificationReports: any[] = [];
    let verificationIssues: any[] = [];
    let verificationPhotos: any[] = [];
    let installationAssignments: any[] = [];
    let installationHandoffs: any[] = [];
    let installationEvents: any[] = [];
    let installationScans: any[] = [];
    let transportEvents: any[] = [];
    let transportPhotos: any[] = [];
    let logisticsDrivers: any[] = [];
    let logisticsVehicles: any[] = [];
    let assemblyChecks: any[] = [];
    let serviceCatalog: any[] = [];

    const baseData = await Promise.all([
      safeSelect("production_orders", "*", 100),
      safeSelect("inventory", "*", 500),
      safeSelect("quotes", "*", 200),
      safeSelect("projects", "*", 200),
      safeSelect("furniture_projects", "*", 200),
      safeSelect("clients", "*", 200),
      safeSelect("calendar_events", "*", 200),
      safeSelect("client_payments", "*", 200),
      safeSelect("field_measurements", "*", 200),
      safeSelect("ai_design_requests", "*", 200),
      safeSelect("project_contracts", "*", 200),
      safeSelect("warehouse_requisitions", "*", 200),
      safeSelect("piece_labels", "*", 500),
      safeSelect("final_delivery_reports", "*", 200),
      safeSelect("sales", "*", 200),
      safeSelect("final_delivery_photos", "*", 300),
      safeSelect("final_delivery_signatures", "*", 300),
      safeSelect("final_delivery_checklist", "*", 300),
      safeSelect("verification_reports", "*", 300),
      safeSelect("verification_issues", "*", 300),
      safeSelect("verification_general_photos", "*", 300),
      safeSelect("installation_assignments", "*", 300),
      safeSelect("installation_handoffs", "*", 300),
      safeSelect("installation_module_events", "*", 500),
      safeSelect("project_installation_scans", "*", 500),
      safeSelect("transport_module_events", "*", 500),
      safeSelect("transport_module_photos", "*", 500),
      safeSelect("logistics_drivers", "*", 200),
      safeSelect("logistics_vehicles", "*", 200),
      safeSelect("assembly_module_checks", "*", 300),
      safeSelect("client_portal_catalog_items", "*", 200),
    ]);

    orders = baseData[0];
    inventory = baseData[1];
    quotes = baseData[2];
    projects = [...baseData[3], ...baseData[4]];
    clients = baseData[5];
    appointments = baseData[6];
    payments = baseData[7];
    measurements = baseData[8];
    designRequests = baseData[9];
    contracts = baseData[10];
    requisitions = baseData[11];
    pieceLabels = baseData[12];
    deliveries = baseData[13];
    sales = baseData[14];
    finalDeliveryPhotos = baseData[15];
    finalDeliverySignatures = baseData[16];
    finalDeliveryChecklist = baseData[17];
    verificationReports = baseData[18];
    verificationIssues = baseData[19];
    verificationPhotos = baseData[20];
    installationAssignments = baseData[21];
    installationHandoffs = baseData[22];
    installationEvents = baseData[23];
    installationScans = baseData[24];
    transportEvents = baseData[25];
    transportPhotos = baseData[26];
    logisticsDrivers = baseData[27];
    logisticsVehicles = baseData[28];
    assemblyChecks = baseData[29];
    serviceCatalog = baseData[30];
    productionItems = await loadProductionItems(orders);

    const contextOrder =
      body?.currentOrder ||
      body?.context?.currentOrder ||
      body?.order ||
      orders?.[0] ||
      null;

    const contextClient =
      body?.client ||
      body?.context?.client ||
      firstRow(clients);

    const contextAppointment =
      body?.appointment ||
      body?.context?.appointment ||
      firstRow(appointments);

    const contextMeasurement =
      body?.measurement ||
      body?.context?.measurement ||
      firstRow(measurements);

    const contextDesignRequest =
      body?.designRequest ||
      body?.context?.designRequest ||
      firstRow(designRequests);

    const contextQuote =
      body?.quote ||
      body?.context?.quote ||
      firstRow(quotes);

    const contextContract =
      body?.contract ||
      body?.context?.contract ||
      firstRow(contracts);

    const deliveryReport = firstRow(deliveries);
    const loadedDelivery = {
      ...(deliveryReport || {}),
      report: deliveryReport,
      reports: deliveries,
      photos: finalDeliveryPhotos,
      signatures: finalDeliverySignatures,
      checklist: finalDeliveryChecklist,
      verificationReports,
      verificationIssues,
      verificationPhotos,
      installationAssignments,
      installationHandoffs,
      installationEvents,
      installationScans,
      transportEvents,
      transportPhotos,
      drivers: logisticsDrivers,
      vehicles: logisticsVehicles,
      assemblyChecks,
    };

    const explicitDelivery = body?.delivery || body?.context?.delivery || null;
    const contextDelivery =
      explicitDelivery && typeof explicitDelivery === "object" && !Array.isArray(explicitDelivery)
        ? { ...loadedDelivery, ...explicitDelivery }
        : loadedDelivery;

    const contextProject =
      body?.project ||
      body?.context?.project ||
      projects?.[0] ||
      null;

    const contextBom =
      body?.items ||
      body?.context?.items ||
      body?.bom ||
      productionItems ||
      [];

    const contextInventory =
      body?.inventory ||
      body?.context?.inventory ||
      inventory ||
      [];

    const contextSales =
      body?.sales ||
      body?.context?.sales ||
      sales ||
      [];

    const contextQuotes =
      body?.quotes ||
      body?.context?.quotes ||
      quotes ||
      [];

    const orchestrator = await orchestrateIndustrialAI({
      module: moduleName,
      pathname,
      message,
      client: contextClient,
      appointment: contextAppointment,
      measurement: contextMeasurement,
      designRequest: contextDesignRequest,
      quote: contextQuote,
      contract: contextContract,
      payments,
      project: contextProject,
      order: contextOrder,
      bom: contextBom,
      requisitions,
      pieceLabels,
      delivery: contextDelivery,
      inventory: contextInventory,
      sales: contextSales,
      quotes: contextQuotes,
      requestedAction:
        body?.requestedAction ||
        body?.context?.requestedAction ||
        actionIntent.action?.type ||
        null,
      screenData: {
        ...(screenContext || {}),
        ...(body?.context?.screenData || {}),
        ...(body?.screenData || {}),
        serviceCatalog,
        contracts,
        payments,
      },
    });

    if (isCEO) {
      const ceoBase = generateCEOResponse({
        message,
        screenContext,
        pageData,
        sales: contextSales,
        orders,
        inventory: contextInventory,
        quotes: contextQuotes,
        projects,
      });

      const answer = [
        ceoBase,
        "",
        "ORQUESTADOR INDUSTRIAL:",
        orchestrator.summary,
        formatOrchestratorDetails(orchestrator),
        orchestrator.risks.length > 0 ? `Riesgos del motor central:\n- ${orchestrator.risks.join("\n- ")}` : "",
        actionText,
      ]
        .filter(Boolean)
        .join("\n");

      return NextResponse.json({
        ok: true,
        answer,
        response: answer,
        message: answer,
        action: actionIntent.action,
        actionIntent,
        risks: orchestrator.risks,
        workflow: orchestrator.workflow,
        recommendations: orchestrator.recommendations,
        nextActions: orchestrator.nextActions,
        execution: orchestrator.execution,
        meta: {
          module: "ceo",
          sales: contextSales.length,
          orders: orders.length,
          items: productionItems.length,
          inventory: contextInventory.length,
          quotes: contextQuotes.length,
          projects: projects.length,
        },
      });
    }

    if (isProduction) {
      const productionBase = generateProductionResponse({
        module: moduleName || "produccion",
        message,
        orders,
        items: contextBom,
        inventory: contextInventory,
        currentOrder: contextOrder,
        selectedItem: body?.selectedItem || body?.context?.selectedItem || null,
        pageData,
        screenContext,
      });

      const answer = [
        productionBase,
        "",
        "ORQUESTADOR INDUSTRIAL:",
        orchestrator.summary,
        formatOrchestratorDetails(orchestrator),
        orchestrator.risks.length > 0 ? `Riesgos del motor central:\n- ${orchestrator.risks.join("\n- ")}` : "",
        actionText,
      ]
        .filter(Boolean)
        .join("\n");

      return NextResponse.json({
        ok: true,
        answer,
        response: answer,
        message: answer,
        action: actionIntent.action,
        actionIntent,
        risks: orchestrator.risks,
        workflow: orchestrator.workflow,
        recommendations: orchestrator.recommendations,
        nextActions: orchestrator.nextActions,
        execution: orchestrator.execution,
        meta: {
          module: "produccion",
          orders: orders.length,
          items: contextBom.length,
          inventory: contextInventory.length,
          quotes: contextQuotes.length,
          projects: projects.length,
        },
      });
    }

    if (isCut) {
      const answer = [
        "Corte/CNC IA conectado al Orquestador Industrial.",
        "",
        orchestrator.summary,
        formatOrchestratorDetails(orchestrator),
        orchestrator.risks.length > 0 ? `Riesgos detectados:\n- ${orchestrator.risks.join("\n- ")}` : "",
        "Proximo paso recomendado: validar piezas, material, veta, nesting, merma y QR.",
        actionText,
      ]
        .filter(Boolean)
        .join("\n");

      return NextResponse.json({
        ok: true,
        answer,
        response: answer,
        message: answer,
        action: actionIntent.action,
        actionIntent,
        risks: orchestrator.risks,
        workflow: orchestrator.workflow,
        recommendations: orchestrator.recommendations,
        nextActions: orchestrator.nextActions,
        execution: orchestrator.execution,
        meta: {
          module: "corte",
          orders: orders.length,
          items: contextBom.length,
          inventory: contextInventory.length,
        },
      });
    }

    const answer = buildDefaultResponse({
      moduleName,
      message,
      orchestratorSummary: orchestrator.summary,
      orchestratorDetails: formatOrchestratorDetails(orchestrator),
      actionText,
    });

    return NextResponse.json({
      ok: true,
      answer,
      response: answer,
      message: answer,
      action: actionIntent.action,
      actionIntent,
      risks: orchestrator.risks,
      workflow: orchestrator.workflow,
      recommendations: orchestrator.recommendations,
      nextActions: orchestrator.nextActions,
      execution: orchestrator.execution,
      meta: {
        module: moduleName || "global",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        answer: "No pude responder ahora mismo por un error interno del asistente.",
        response: "No pude responder ahora mismo por un error interno del asistente.",
        message: error?.message || "Error desconocido",
      },
      { status: 500 }
    );
  }
}
