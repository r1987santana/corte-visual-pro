"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownToLine,
  BadgeCheck,
  Boxes,
  Camera,
  CheckCircle2,
  Clock,
  Gift,
  Hammer,
  HeartHandshake,
  ImageIcon,
  MessageCircle,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  UploadCloud,
  UserPlus,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  contractPaymentSummary,
  type CajaPayment,
} from "@/lib/cajaPrincipal";

type PortalProject = {
  id: string;
  client_id?: string | null;
  code?: string;
  name?: string;
  project_name?: string;
  client_name?: string;
  client_phone?: string | null;
  client_email?: string | null;
  approved_render_url?: string | null;
  status?: string;
};

type HeroAI = {
  project_id: string;
  hero_image: string;
  source_table?: string;
  category?: string;
  ai_score?: number;
};

type CommercialSummary = {
  project_id: string;
  warranty_status?: string;
  warranty_code?: string;
  warranty_expires_at?: string;
  total_amount?: number;
  paid_amount?: number;
  credit_applied?: number;
  initial_required?: number;
  initial_paid?: number;
  initial_due?: number;
  delivery_20?: number;
  delivery_paid?: number;
  delivery_due?: number;
  final_20?: number;
  final_paid?: number;
  final_due?: number;
  balance?: number;
  payment_status?: string;
  satisfaction_avg?: number;
  referral_count?: number;
};

type CatalogItem = {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  price?: number | null;
  currency?: string | null;
  category?: string | null;
};

type Claim = {
  id: string;
  issue_title: string;
  priority?: string | null;
  ai_classification?: string | null;
  ai_risk_score?: number | null;
  status?: string | null;
  ticket_code?: string | null;
  ticket_status?: string | null;
  photo_count?: number | null;
};

type DesignPortalVariant = {
  id: string;
  variant: string;
  title?: string | null;
  name?: string | null;
  concept?: string | null;
  render_image_url?: string | null;
  image_url?: string | null;
  status?: string | null;
};

type PortalQuote = {
  id: string;
  client_id?: string | null;
  ai_design_request_id?: string | null;
  measurement_id?: string | null;
  quote_no?: string | null;
  quote_number?: string | null;
  quote_code?: string | null;
  client_name?: string | null;
  project_name?: string | null;
  project_type?: string | null;
  material_preference?: string | null;
  color_preference?: string | null;
  hardware_preference?: string | null;
  width_m?: number | null;
  height_m?: number | null;
  depth_m?: number | null;
  length_m?: number | null;
  linear_feet?: number | null;
  square_meters?: number | null;
  client_document?: string | null;
  status?: string | null;
  total_price?: number | null;
  total_amount?: number | null;
  total?: number | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  credit_applied?: number | null;
  initial_60?: number | null;
  delivery_20?: number | null;
  final_20?: number | null;
  balance?: number | null;
  valid_until?: string | null;
  observations?: string | null;
};

type PortalQuoteItem = {
  id?: string;
  code?: string | null;
  description?: string | null;
  quantity?: number | null;
  qty?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  price?: number | null;
  total_price?: number | null;
  final_price?: number | null;
  subtotal?: number | null;
};

type PortalQuoteTerms = {
  payment_terms?: string | null;
  delivery_time?: string | null;
  warranty?: string | null;
  observations?: string | null;
};

type PortalTraceabilityModule = {
  key: string;
  order_code: string;
  module_name: string;
  total: number;
  pending: number;
  inProcess: number;
  cut: number;
  edged: number;
  drilled: number;
  cnc: number;
  assembled: number;
  packed: number;
  transported: number;
  installed: number;
  delivered: number;
  progress: number;
  statusLabel: string;
  pieces: any[];
  lastUpdated?: string | null;
};

type PortalTraceability = {
  orderCodes: string[];
  modules: PortalTraceabilityModule[];
  totalPieces: number;
  inProcess: number;
  cut: number;
  assembled: number;
  packed: number;
  installed: number;
  delivered: number;
  progress: number;
  lastUpdated?: string | null;
};

type LocalPhoto = {
  file: File;
  preview: string;
};

const STORAGE_BUCKET = "warranty-claims";

const FALLBACK_HERO =
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=1800&auto=format&fit=crop";

const timelineBase = [
  { title: "Diseño", desc: "Render aprobado", icon: BadgeCheck },
  { title: "Contrato", desc: "Aceptación", icon: ShieldCheck },
  { title: "Inicial 60%", desc: "Pago para producir", icon: Wallet },
  { title: "Producción", desc: "Fabricación", icon: Hammer },
  { title: "20% entrega", desc: "Pago para despacho", icon: Wallet },
  { title: "Transporte", desc: "Despacho", icon: Truck },
  { title: "Instalación", desc: "Campo", icon: Wrench },
  { title: "QA", desc: "Calidad", icon: ShieldCheck },
  { title: "Entrega", desc: "Firma final", icon: CheckCircle2 },
];

const defaultGallery = [
  { id: "1", asset_url: "https://images.unsplash.com/photo-1556911220-bff31c812dba?q=80&w=900&auto=format&fit=crop", title: "Cocina premium" },
  { id: "2", asset_url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=900&auto=format&fit=crop", title: "Instalación" },
  { id: "3", asset_url: "https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?q=80&w=900&auto=format&fit=crop", title: "Entrega" },
  { id: "4", asset_url: "https://images.unsplash.com/photo-1600566752355-35792bedcfea?q=80&w=900&auto=format&fit=crop", title: "Detalle" },
];

const PORTAL_REFRESH_MS = 120000;

function contractToPortalProject(contract: any): PortalProject {
  return {
    id: contract.id,
    client_id: contract.client_id || null,
    code: contract.contract_code,
    name: contract.project_name,
    project_name: contract.project_name,
    client_name: contract.client_name,
    client_phone: contract.client_phone,
    client_email: contract.client_email,
    approved_render_url: contract.approved_render_url,
    status: contractBusinessStatus(contract),
  };
}

function contractToSummary(contract: any, payments: CajaPayment[] = []): CommercialSummary {
  const payment = contractPaymentSummary(contract, payments);
  const status = normalizeText(contract.status);
  const warrantyActive = status.includes("entregado_final") || status.includes("cerrado") || status.includes("entregado");

  return {
    project_id: contract.id,
    warranty_status: contract.warranty_status || (warrantyActive ? "activa" : "pendiente entrega final"),
    warranty_code: contract.warranty_code || contract.contract_code || "Pendiente",
    warranty_expires_at: contract.warranty_expires_at || contract.warranty_end_at || contract.warranty_until || undefined,
    total_amount: payment.total,
    paid_amount: payment.paidApplied,
    credit_applied: payment.credit,
    initial_required: payment.initialRequired,
    initial_paid: payment.initialPaid,
    initial_due: payment.initialDue,
    delivery_20: payment.deliveryRequired,
    delivery_paid: payment.deliveryPaid,
    delivery_due: payment.deliveryDue,
    final_20: payment.finalRequired,
    final_paid: payment.finalPaid,
    final_due: payment.finalDue,
    balance: payment.balance,
    payment_status: contract.status || "firmado",
    satisfaction_avg: 0,
    referral_count: 0,
  };
}

function n(value: any) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeVariantId(value: any) {
  return String(value || "").trim().toUpperCase();
}

function isApprovedRenderStatus(value: any) {
  return String(value || "").toLowerCase().includes("aprob");
}

function truthyDbFlag(value: any) {
  if (value === true) return true;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function isClientApprovedRequest(request: any) {
  return Boolean(
    truthyDbFlag(request?.client_approved) ||
      truthyDbFlag(request?.approved_render) ||
      request?.approved_render_url ||
      isApprovedRenderStatus(request?.status) ||
      isApprovedRenderStatus(request?.ai_status)
  );
}

function requestApprovedRenderUrl(request: any) {
  return isClientApprovedRequest(request) ? request?.approved_render_url || request?.render_image_url || null : null;
}

async function resolveContractApprovedRender(contract: any) {
  const contractRender = contract?.approved_render_url || contract?.render_image_url || "";
  const requestId = contract?.ai_design_request_id;

  if (!requestId) {
    return contractRender;
  }

  const { data: request } = await supabase.from("ai_design_requests").select("*").eq("id", requestId).maybeSingle();
  if (!request) {
    return contractRender;
  }

  if (request.selected_render_id) {
    const { data: selectedRender } = await supabase
      .from("ai_design_renders")
      .select("*")
      .eq("id", request.selected_render_id)
      .maybeSingle();

    const selectedUrl = (selectedRender as any)?.render_image_url || (selectedRender as any)?.image_url || "";
    if (selectedUrl) return selectedUrl;
  }

  if (request.approved_render_url) {
    return request.approved_render_url;
  }

  const variantId = normalizeVariantId(request.approved_variant_id || request.selected_variant_id);
  if (variantId) {
    const { data: rows } = await supabase
      .from("ai_design_renders")
      .select("*")
      .eq("ai_design_request_id", requestId)
      .eq("variant", variantId)
      .order("created_at", { ascending: false });

    if (rows?.length) {
      const approved = (rows as any[]).find((row) => isApprovedRenderStatus(row.status));
      const render = approved || (!contractRender ? rows[0] : null);
      const url = render?.render_image_url || render?.image_url || "";
      if (url) return url;
    }
  }

  return contractRender || request.render_image_url || "";
}

function contractBusinessStatus(contract: any) {
  const status = normalizeText(contract.status);
  const productionStatus = normalizeText(contract.production_status || contract.production_order_status || contract.order_status);
  const total = n(contract.total_amount || contract.total_price);
  const credit = n(contract.credit_applied);
  const paymentRegistered = n(contract.initial_paid || contract.paid_amount || contract.amount_paid);
  const initialRequired = n(contract.initial_required || contract.initial_60) || total * 0.6;
  const initialDueFromDb = contract.initial_due === null || contract.initial_due === undefined ? null : n(contract.initial_due);
  const computedInitialDue = Math.max(initialRequired - credit - paymentRegistered, 0);
  const initialDue = paymentRegistered > 0 ? computedInitialDue : initialDueFromDb ?? computedInitialDue;

  if (productionStatus.includes("entreg")) return "entregado";
  if (productionStatus.includes("qa") || productionStatus.includes("verificacion")) return "verificacion_qa";
  if (productionStatus.includes("instal")) return "instalacion";
  if (productionStatus.includes("transport") || productionStatus.includes("despacho")) return "transporte";
  if (productionStatus.includes("produccion") || productionStatus.includes("production") || productionStatus.includes("proceso")) {
    return initialDue <= 0 ? "produccion" : "inicial_60_pendiente";
  }
  if (status.includes("firmado") || status.includes("aceptado")) {
    return initialDue <= 0 ? "inicial_60_pagado" : "inicial_60_pendiente";
  }
  if (status.includes("render") || contract.approved_render_url || contract.render_image_url) return "render_aprobado";
  return "revision_comercial";
}

function statusToProgress(status?: string | null) {
  const s = normalizeText(status);
  if (s.includes("cerrado") || s.includes("entregado")) return 100;
  if (s.includes("entrega_final_pendiente")) return 96;
  if (s.includes("qa") || s.includes("verificacion")) return 90;
  if (s.includes("instal")) return 82;
  if (s.includes("transport")) return 72;
  if (s.includes("delivery_20_pagado") || s.includes("despacho_liberado")) return 66;
  if (s.includes("delivery_20_pendiente")) return 60;
  if (s.includes("produccion") || s.includes("production")) return 55;
  if (s.includes("inicial_60_pagado")) return 46;
  if (s.includes("inicial_60_pendiente")) return 36;
  if (s.includes("firmado") || s.includes("contrato")) return 34;
  if (s.includes("cotizacion_aprobada")) return 32;
  if (s.includes("render") || s.includes("dise")) return 24;
  return 18;
}

function statusLabel(status?: string | null) {
  const s = normalizeText(status);
  if (s.includes("pendiente_decision_cliente")) return "Pendiente decision de render";
  if (s.includes("render_generado")) return "Pendiente decision de render";
  if (s.includes("entregado")) return "Entregado";
  if (s.includes("entrega_final_pendiente")) return "Calidad listo";
  if (s.includes("verificacion") || s.includes("qa")) return "Verificación QA";
  if (s.includes("instal")) return "Instalación";
  if (s.includes("transport")) return "Transporte";
  if (s.includes("delivery_20_pagado") || s.includes("despacho_liberado")) return "20% entrega pagado";
  if (s.includes("delivery_20_pendiente")) return "Pendiente 20% entrega";
  if (s.includes("produccion")) return "Producción";
  if (s.includes("inicial_60_pagado")) return "Inicial 60% pagado";
  if (s.includes("inicial_60_pendiente")) return "Pendiente pago inicial 60%";
  if (s.includes("firmado") || s.includes("contrato")) return "Contrato firmado";
  if (s.includes("cotizacion_aprobada")) return "Cotizacion aprobada";
  if (s.includes("render")) return "Render aprobado";
  return "Revisión comercial";
}

function requestToPortalProject(request: any): PortalProject {
  const approvedRenderUrl = requestApprovedRenderUrl(request);
  const requestStatus = isClientApprovedRequest(request)
    ? request.status || request.ai_status || "render_aprobado"
    : "pendiente_decision_cliente";

  return {
    id: request.id,
    client_id: request.client_id || null,
    code: request.request_code || request.code || `IA-${String(request.id).slice(0, 8)}`,
    name: request.project_name || request.name || "Proyecto IA",
    project_name: request.project_name || request.name || "Proyecto IA",
    client_name: request.client_name || request.customer_name || "Cliente RD Wood",
    client_phone: request.client_phone || request.phone || request.telefono || null,
    client_email: request.client_email || request.email || null,
    approved_render_url: approvedRenderUrl,
    status: requestStatus,
  };
}

function variantName(variant: DesignPortalVariant) {
  const raw = String(variant.variant || variant.id || "").toUpperCase();
  const title = variant.name || variant.title || "";
  return title || `Variante ${raw}`;
}

function variantImage(variant: DesignPortalVariant) {
  return variant.render_image_url || variant.image_url || "";
}

function referralCodeForProject(project?: PortalProject | null) {
  const base = String(project?.client_id || project?.id || "CLIENTE")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10)
    .toUpperCase();
  return `RDW-${base || "CLIENTE"}`;
}

function referralLinkForProject(token: string, project?: PortalProject | null) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/referir/${referralCodeForProject(project)}?portal=${encodeURIComponent(token)}`;
}

function timelineDone(index: number, progress: number) {
  return progress >= [20, 32, 45, 58, 66, 76, 84, 92, 100][index];
}

function currency(value?: number | null, cur = "DOP") {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: cur || "DOP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function portalDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("es-DO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function quoteCode(quote?: PortalQuote | null) {
  return quote?.quote_no || quote?.quote_number || quote?.quote_code || `COT-${String(quote?.id || "").slice(0, 8)}`;
}

function quoteTotal(quote?: PortalQuote | null) {
  return n(quote?.total_price || quote?.total_amount || quote?.total);
}

function quoteItemQuantity(item: PortalQuoteItem) {
  return n(item.quantity ?? item.qty ?? 1);
}

function quoteItemUnitPrice(item: PortalQuoteItem) {
  return n(item.unit_price ?? item.price);
}

function quoteItemTotal(item: PortalQuoteItem) {
  return n(item.total_price ?? item.final_price ?? item.subtotal ?? quoteItemQuantity(item) * quoteItemUnitPrice(item));
}

function isQuoteApprovedByClient(quote?: PortalQuote | null) {
  const status = normalizeText(quote?.status);
  return status.includes("aprobada_cliente") || status.includes("aprobado_cliente") || status.includes("autorizada_cliente");
}

function portalContractCode() {
  return `CON-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-5)}`;
}

function portalClientUrl(portalToken: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/portal-cliente/${portalToken}`;
}

async function resolvePortalQuote(request: any, project?: PortalProject | null) {
  const ids = [
    request?.quote_id ? { column: "id", value: request.quote_id } : null,
    request?.measurement_id ? { column: "measurement_id", value: request.measurement_id } : null,
    request?.id ? { column: "ai_design_request_id", value: request.id } : null,
    project?.id ? { column: "project_id", value: project.id } : null,
  ].filter(Boolean) as { column: string; value: string }[];

  for (const filter of ids) {
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq(filter.column, filter.value)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) return data as PortalQuote;
  }

  return null;
}

function paymentBreakdown(summary: CommercialSummary | null) {
  const total = n(summary?.total_amount);
  const credit = n(summary?.credit_applied);
  const paidApplied = n(summary?.paid_amount);
  const initialRequired = n(summary?.initial_required) || total * 0.6;
  const delivery20 = n(summary?.delivery_20) || total * 0.2;
  const final20 = n(summary?.final_20) || total * 0.2;
  const status = normalizeText(summary?.payment_status);
  const deliveryReleased = status.includes("delivery_20_pagado") || status.includes("despacho_liberado");

  const directInitialPaid = n(summary?.initial_paid);
  const directDeliveryPaid = n(summary?.delivery_paid);
  const directFinalPaid = n(summary?.final_paid);
  const cashApplied = Math.max(0, paidApplied - credit);
  const cashPool = Math.max(cashApplied, directInitialPaid + directDeliveryPaid + directFinalPaid);

  const initialPaid = Math.min(initialRequired, directInitialPaid || cashPool);
  const afterInitial = Math.max(cashPool - initialPaid, 0);
  const deliveryPaid = Math.min(delivery20, Math.max(directDeliveryPaid, afterInitial, deliveryReleased ? delivery20 : 0));
  const afterDelivery = Math.max(cashPool - initialPaid - deliveryPaid, 0);
  const finalPaid = Math.max(directFinalPaid, afterDelivery);

  const initialDue = Math.max(initialRequired - initialPaid, 0);
  const deliveryDue = Math.max(delivery20 - deliveryPaid, 0);
  const finalDue = Math.max(final20 - credit - finalPaid, 0);
  const totalApplied = Math.min(total, credit + initialPaid + deliveryPaid + finalPaid);
  const balance = Math.max(total - totalApplied, 0);

  return {
    total,
    credit,
    initialRequired,
    initialPaid,
    initialDue,
    delivery20,
    deliveryPaid,
    deliveryDue,
    final20,
    finalPaid,
    finalDue,
    totalApplied,
    balance,
    initialCovered: total > 0 && initialDue <= 0,
    deliveryCovered: total > 0 && deliveryDue <= 0,
    finalCovered: total > 0 && finalDue <= 0,
  };
}

function inferProjectType(text: string) {
  const value = normalizeText(text);
  if (value.includes("cocina")) return "cocina";
  if (value.includes("closet") || value.includes("clo")) return "closet";
  if (value.includes("tv") || value.includes("centro")) return "centro_tv";
  if (value.includes("vanity") || value.includes("bano") || value.includes("baño")) return "vanity";
  if (value.includes("oficina")) return "oficina";
  if (value.includes("puerta")) return "puertas";
  return "otro";
}

function classifyIssue(text: string) {
  const s = text.toLowerCase();

  if (s.includes("bisagra") || s.includes("puerta") || s.includes("corredera") || s.includes("herrajes")) {
    return { category: "herrajes", priority: "media", ai: "Ajuste / herraje", score: 62 };
  }

  if (s.includes("agua") || s.includes("humedad") || s.includes("hinchado") || s.includes("mojado") || s.includes("fuga")) {
    return { category: "humedad", priority: "alta", ai: "Riesgo por humedad / agua", score: 92 };
  }

  if (s.includes("rayado") || s.includes("golpe") || s.includes("mancha") || s.includes("acabado")) {
    return { category: "acabado", priority: "media", ai: "Acabado / estética", score: 55 };
  }

  if (s.includes("roto") || s.includes("urgente") || s.includes("despegado") || s.includes("caido") || s.includes("cayó")) {
    return { category: "critico", priority: "alta", ai: "Incidencia crítica", score: 88 };
  }

  return { category: "general", priority: "media", ai: "Postventa general", score: 50 };
}

async function createCrmLeadFromPortal(input: {
  customerName: string;
  phone?: string | null;
  email?: string | null;
  source: "referido" | "web";
  projectType: string;
  needDescription: string;
  notes: string;
  priority?: string;
}) {
  let leadCode = `LEAD-PORTAL-${Date.now()}`;

  const codeRes = await supabase.rpc("generate_crm_lead_code");
  if (!codeRes.error && codeRes.data) {
    leadCode = String(codeRes.data);
  }

  const { data: lead, error } = await supabase
    .from("crm_leads")
    .insert({
      lead_code: leadCode,
      customer_name: input.customerName,
      phone: input.phone || null,
      email: input.email || null,
      source: input.source,
      project_type: input.projectType || "otro",
      need_description: input.needDescription,
      estimated_budget: 0,
      stage: "prospecto",
      status: "activo",
      priority: input.priority || "alta",
      assigned_to: "Comercial",
      notes: input.notes,
      updated_at: new Date().toISOString(),
    })
    .select("id, lead_code")
    .single();

  if (error) throw error;

  await supabase.from("crm_activities").insert({
    lead_id: lead.id,
    activity_type: "whatsapp",
    title: input.source === "referido" ? "Contactar referido desde portal" : "Contactar nueva solicitud desde portal",
    description: input.needDescription,
    status: "pendiente",
    created_by: "Portal Cliente",
  });

  return lead.lead_code || leadCode;
}

async function loadContractPayments(contract: any): Promise<CajaPayment[]> {
  const filters = [
    contract?.id ? `contract_id.eq.${contract.id}` : "",
    contract?.quote_id ? `quote_id.eq.${contract.quote_id}` : "",
    contract?.client_id ? `client_id.eq.${contract.client_id}` : "",
  ].filter(Boolean);

  const rows = new Map<string, CajaPayment>();

  if (filters.length) {
    const { data } = await supabase
      .from("client_payments")
      .select("*")
      .or(filters.join(","))
      .order("created_at", { ascending: false })
      .limit(500);

    (data || []).forEach((payment: any) => rows.set(payment.id || `${payment.payment_code}-${rows.size}`, payment));
  }

  if (contract?.client_name) {
    const { data } = await supabase
      .from("client_payments")
      .select("*")
      .ilike("client_name", `%${contract.client_name}%`)
      .order("created_at", { ascending: false })
      .limit(200);

    (data || []).forEach((payment: any) => rows.set(payment.id || `${payment.payment_code}-${rows.size}`, payment));
  }

  return Array.from(rows.values());
}

async function safePortalRows(tableName: string, limit = 500) {
  try {
    const { data, error } = await supabase.from(tableName).select("*").limit(limit);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

function rowMatchesContract(row: any, contract: any) {
  const client = normalizeText(contract?.client_name);
  const project = normalizeText(contract?.project_name);
  const quoteId = String(contract?.quote_id || "");
  const rowClient = normalizeText(row?.client_name || row?.customer_name || row?.customer || row?.nombre_cliente);
  const rowProject = normalizeText(row?.project_name || row?.project || row?.name || row?.title);
  const rowQuote = String(row?.quote_id || "");

  if (quoteId && rowQuote && quoteId === rowQuote) return true;
  return Boolean(
    client &&
      project &&
      rowClient &&
      rowProject &&
      (rowClient.includes(client) || client.includes(rowClient)) &&
      (rowProject.includes(project) || project.includes(rowProject))
  );
}

function rowOrderCode(row: any) {
  return String(row?.order_code || row?.production_code || row?.production_order_code || row?.work_order_code || "").trim();
}

async function rowsByOrderCodes(tableName: string, orderCodes: string[]) {
  if (!orderCodes.length) return [];
  try {
    const { data, error } = await supabase.from(tableName).select("*").in("order_code", orderCodes).limit(500);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

function isQaApprovedRow(row: any) {
  const status = normalizeText(`${row?.status || ""} ${row?.qa_status || ""} ${row?.assignment_status || ""}`);
  return status.includes("aprobado") || status.includes("approved") || status.includes("liberado_entrega_final");
}

const TRACE_STATUS_FLOW = [
  "pendiente",
  "en_corte",
  "cortada",
  "canteada",
  "perforada",
  "cnc",
  "ensamblada",
  "empacada",
  "transportada",
  "instalada",
  "entregada",
];

const TRACE_PROCESS_STATES = new Set(["en_corte", "cortada", "canteada", "perforada", "cnc", "ensamblada", "empacada", "transportada"]);
const TRACE_READY_CUT = ["cortada", "canteada", "perforada", "cnc", "ensamblada", "empacada", "transportada", "instalada", "entregada"];
const TRACE_READY_EDGE = ["canteada", "perforada", "cnc", "ensamblada", "empacada", "transportada", "instalada", "entregada"];
const TRACE_READY_DRILL = ["perforada", "cnc", "ensamblada", "empacada", "transportada", "instalada", "entregada"];
const TRACE_READY_CNC = ["cnc", "ensamblada", "empacada", "transportada", "instalada", "entregada"];
const TRACE_READY_ASSEMBLY = ["ensamblada", "empacada", "transportada", "instalada", "entregada"];
const TRACE_READY_PACKED = ["empacada", "transportada", "instalada", "entregada"];
const TRACE_READY_TRANSPORT = ["transportada", "instalada", "entregada"];
const TRACE_READY_INSTALLED = ["instalada", "entregada"];

function traceStatus(value?: string | null) {
  const normalized = normalizeText(value || "pendiente").trim();
  return normalized || "pendiente";
}

function traceStatusScore(value?: string | null) {
  const index = TRACE_STATUS_FLOW.indexOf(traceStatus(value));
  return index >= 0 ? index : 0;
}

function traceModuleKey(piece: any) {
  return `${piece.order_code || "SIN-ORDEN"}__${piece.module_name || "Sin modulo"}`;
}

function traceModuleStatusLabel(group: PortalTraceabilityModule) {
  if (group.total <= 0) return "Pendiente";
  if (group.delivered === group.total) return "Entregado";
  if (group.installed === group.total) return "Instalado";
  if (group.transported === group.total) return "En transporte";
  if (group.packed === group.total) return "Empacado";
  if (group.assembled === group.total) return "Ensamblado";
  if (group.cnc === group.total || group.drilled === group.total || group.edged === group.total || group.cut === group.total) return "Listo ensamblado";
  if (group.inProcess > 0) return "En proceso";
  return "Pendiente";
}

function countTrace(pieces: any[], statuses: string[]) {
  return pieces.filter((piece) => statuses.includes(traceStatus(piece.current_status))).length;
}

async function loadPortalTraceability(contract: any): Promise<PortalTraceability | null> {
  if (!contract) return null;

  const allProduction = await safePortalRows("production_orders", 1000);
  const productionRows = allProduction.filter((row: any) => rowMatchesContract(row, contract));
  const orderCodes = Array.from(new Set(productionRows.map(rowOrderCode).filter(Boolean)));
  const orderIds = Array.from(new Set(productionRows.map((row: any) => String(row.id || row.production_order_id || "")).filter(Boolean)));

  if (!orderCodes.length && !orderIds.length) return null;

  const [byCode, byId] = await Promise.all([
    orderCodes.length
      ? supabase.from("piece_labels").select("*").in("order_code", orderCodes).limit(2000)
      : Promise.resolve({ data: [], error: null } as any),
    orderIds.length
      ? supabase.from("piece_labels").select("*").in("production_order_id", orderIds).limit(2000)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const piecesById = new Map<string, any>();
  [...(byCode.data || []), ...(byId.data || [])].forEach((piece: any) => {
    const key = String(piece.id || piece.label_code || `${piece.order_code}-${piece.piece_name}`);
    if (!piecesById.has(key)) piecesById.set(key, piece);
  });

  const pieces = Array.from(piecesById.values());
  if (!pieces.length) return null;

  const groups = new Map<string, PortalTraceabilityModule>();
  for (const piece of pieces) {
    const key = traceModuleKey(piece);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        order_code: piece.order_code || "SIN-ORDEN",
        module_name: piece.module_name || "Sin modulo",
        total: 0,
        pending: 0,
        inProcess: 0,
        cut: 0,
        edged: 0,
        drilled: 0,
        cnc: 0,
        assembled: 0,
        packed: 0,
        transported: 0,
        installed: 0,
        delivered: 0,
        progress: 0,
        statusLabel: "Pendiente",
        pieces: [],
        lastUpdated: null,
      });
    }
    groups.get(key)!.pieces.push(piece);
  }

  const modules = Array.from(groups.values()).map((group) => {
    group.pieces.sort((a, b) => String(a.label_code || "").localeCompare(String(b.label_code || ""), "es"));
    group.total = group.pieces.length;
    group.pending = group.pieces.filter((piece) => traceStatus(piece.current_status) === "pendiente").length;
    group.inProcess = group.pieces.filter((piece) => TRACE_PROCESS_STATES.has(traceStatus(piece.current_status))).length;
    group.cut = countTrace(group.pieces, TRACE_READY_CUT);
    group.edged = countTrace(group.pieces, TRACE_READY_EDGE);
    group.drilled = countTrace(group.pieces, TRACE_READY_DRILL);
    group.cnc = countTrace(group.pieces, TRACE_READY_CNC);
    group.assembled = countTrace(group.pieces, TRACE_READY_ASSEMBLY);
    group.packed = countTrace(group.pieces, TRACE_READY_PACKED);
    group.transported = countTrace(group.pieces, TRACE_READY_TRANSPORT);
    group.installed = countTrace(group.pieces, TRACE_READY_INSTALLED);
    group.delivered = countTrace(group.pieces, ["entregada"]);
    group.progress = Math.round((group.pieces.reduce((sum, piece) => sum + traceStatusScore(piece.current_status), 0) / Math.max(1, group.total * (TRACE_STATUS_FLOW.length - 1))) * 100);
    group.statusLabel = traceModuleStatusLabel(group);
    group.lastUpdated = group.pieces
      .map((piece) => piece.updated_at || piece.created_at)
      .filter(Boolean)
      .sort()
      .pop() || null;
    return group;
  }).sort((a, b) => a.module_name.localeCompare(b.module_name, "es"));

  const totalPieces = pieces.length;
  const totalScore = pieces.reduce((sum, piece) => sum + traceStatusScore(piece.current_status), 0);

  return {
    orderCodes,
    modules,
    totalPieces,
    inProcess: pieces.filter((piece) => TRACE_PROCESS_STATES.has(traceStatus(piece.current_status))).length,
    cut: countTrace(pieces, TRACE_READY_CUT),
    assembled: countTrace(pieces, TRACE_READY_ASSEMBLY),
    packed: countTrace(pieces, TRACE_READY_PACKED),
    installed: countTrace(pieces, TRACE_READY_INSTALLED),
    delivered: countTrace(pieces, ["entregada"]),
    progress: Math.round((totalScore / Math.max(1, totalPieces * (TRACE_STATUS_FLOW.length - 1))) * 100),
    lastUpdated: pieces.map((piece) => piece.updated_at || piece.created_at).filter(Boolean).sort().pop() || null,
  };
}

async function loadContractWarranty(contract: any) {
  const allProduction = await safePortalRows("production_orders", 800);
  const productionRows = allProduction.filter((row: any) => rowMatchesContract(row, contract));
  const orderCodes = Array.from(new Set(productionRows.map(rowOrderCode).filter(Boolean)));
  const finalRows = await rowsByOrderCodes("final_delivery_reports", orderCodes);
  const delivered = finalRows
    .filter((row: any) => normalizeText(`${row.delivery_status || ""} ${row.final_status || ""}`).includes("cerrado") || row.delivery_closed)
    .sort((a: any, b: any) => String(b.updated_at || b.closed_at || b.created_at || "").localeCompare(String(a.updated_at || a.closed_at || a.created_at || "")));

  const row = delivered[0] || finalRows[0];
  if (!row) return null;

  return {
    warranty_status: "activa",
    warranty_code: row.warranty_code || contract.contract_code || "Garantía RD Wood",
    warranty_expires_at: row.warranty_end_at || row.warranty_expires_at || row.expires_at || undefined,
  };
}

async function resolveContractOperationalStatus(contract: any, payments: CajaPayment[]) {
  const payment = contractPaymentSummary(contract, payments);
  const contractStatus = normalizeText(contract?.status);

  if (contractStatus.includes("entregado_final") || contractStatus.includes("cerrado")) {
    return contract?.status || "entregado_final";
  }

  const allProduction = await safePortalRows("production_orders", 800);
  const productionRows = allProduction.filter((row: any) => rowMatchesContract(row, contract));
  const orderCodes = Array.from(new Set(productionRows.map(rowOrderCode).filter(Boolean)));

  const [transportEvents, installationRows, installationAssignments, verificationRows, finalRows] = await Promise.all([
    rowsByOrderCodes("transport_module_events", orderCodes),
    rowsByOrderCodes("installation_handoffs", orderCodes),
    rowsByOrderCodes("installation_assignments", orderCodes),
    rowsByOrderCodes("verification_reports", orderCodes),
    rowsByOrderCodes("final_delivery_reports", orderCodes),
  ]);

  if (finalRows.some((row: any) => normalizeText(`${row.delivery_status || ""} ${row.final_status || ""} ${row.status || ""}`).includes("cerrado") || row.delivery_closed)) {
    return "entregado_final";
  }
  if (finalRows.length) return "entrega_final_pendiente";
  if (verificationRows.some(isQaApprovedRow) || installationAssignments.some(isQaApprovedRow)) {
    return "entrega_final_pendiente";
  }
  if (verificationRows.length) return "verificacion_qa";
  if (installationRows.length || installationAssignments.length) return "instalacion";
  if (transportEvents.length) return "transporte";
  if (contractStatus.includes("delivery_20_pagado") || contractStatus.includes("despacho_liberado")) {
    return "delivery_20_pagado";
  }

  const productionStatus = normalizeText(productionRows.map((row: any) => row.status || row.production_status || row.order_status).join(" "));
  if (productionStatus.includes("instal")) return "instalacion";
  if (productionStatus.includes("transport") || productionStatus.includes("despacho")) return "transporte";
  if (productionRows.length || productionStatus.includes("produccion") || productionStatus.includes("production")) {
    return payment.deliveryCovered ? "delivery_20_pagado" : "delivery_20_pendiente";
  }

  if (payment.initialCovered) return "inicial_60_pagado";
  if (contractStatus.includes("firmado")) return "inicial_60_pendiente";
  return contractBusinessStatus(contract);
}

export default function ClientPortalCommercialWorldPage() {
  const params = useParams();
  const token = Array.isArray(params?.token) ? params.token[0] : (params?.token as string) || "";

  const [project, setProject] = useState<PortalProject | null>(null);
  const [hero, setHero] = useState<HeroAI>({
    project_id: "demo",
    hero_image: FALLBACK_HERO,
    source_table: "fallback",
    category: "premium_fallback",
    ai_score: 10,
  });
  const [summary, setSummary] = useState<CommercialSummary | null>(null);
  const [gallery, setGallery] = useState(defaultGallery);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [designRequest, setDesignRequest] = useState<any | null>(null);
  const [designVariants, setDesignVariants] = useState<DesignPortalVariant[]>([]);
  const [portalQuote, setPortalQuote] = useState<PortalQuote | null>(null);
const [portalQuoteItems, setPortalQuoteItems] = useState<PortalQuoteItem[]>([]);
  const [portalQuoteTerms, setPortalQuoteTerms] = useState<PortalQuoteTerms | null>(null);
  const [traceability, setTraceability] = useState<PortalTraceability | null>(null);
  const [deliveryPaymentConfirmed, setDeliveryPaymentConfirmed] = useState(false);
  const [approvingVariant, setApprovingVariant] = useState("");
  const [approvingQuote, setApprovingQuote] = useState(false);
  const [loading, setLoading] = useState(true);

  const [rating, setRating] = useState(5);
  const [surveyComment, setSurveyComment] = useState("");
  const [refName, setRefName] = useState("");
  const [refPhone, setRefPhone] = useState("");
  const [newProject, setNewProject] = useState("");
  const [message, setMessage] = useState("");

  const [openClaim, setOpenClaim] = useState(false);
  const [clientPhone, setClientPhone] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [submittingClaim, setSubmittingClaim] = useState(false);

  const progress = useMemo(() => {
    const contractProgress = statusToProgress(project?.status);
    const productionProgress = traceability?.progress || 0;
    return Math.max(contractProgress, productionProgress);
  }, [project?.status, traceability?.progress]);
  const payment = useMemo(() => paymentBreakdown(summary), [summary]);
  const nextPayment = useMemo(() => {
    if (!payment.initialCovered) return { label: "Inicial pendiente", value: payment.initialDue };
    if (!payment.deliveryCovered) return { label: "20% para despacho", value: payment.deliveryDue };
    if (!payment.finalCovered) return { label: "Final instalación", value: payment.finalDue };
    return { label: "Proyecto al día", value: 0 };
  }, [payment]);
  const approvedRenderImage = hero.hero_image || project?.approved_render_url || FALLBACK_HERO;
  const hasApprovedRender = Boolean(project?.approved_render_url || hero.category === "approved_render");
  const needsDesignDecision = Boolean(designRequest && designVariants.length > 0 && !hasApprovedRender);
  const deliveryReleasedByStatus = normalizeText(project?.status).includes("delivery_20_pagado") || normalizeText(project?.status).includes("despacho_liberado");
  const projectStatusText = normalizeText(project?.status);
  const quoteStatusText = normalizeText(`${portalQuote?.status || ""} ${(portalQuote as any)?.contract_status || ""}`);
  const finalDeliveryClosed = projectStatusText.includes("entregado_final") || projectStatusText.includes("cerrado");
  const quoteReadOnly = Boolean(
    finalDeliveryClosed ||
      projectStatusText.includes("entregado") ||
      projectStatusText.includes("entrega_final") ||
      quoteStatusText.includes("entregado_final") ||
      quoteStatusText.includes("cerrado")
  );
  const canApproveQuote = Boolean(portalQuote && !quoteReadOnly && !isQuoteApprovedByClient(portalQuote));
  const readyForFinalDelivery = normalizeText(project?.status).includes("entrega_final_pendiente") || finalDeliveryClosed;
  const packedReadyForDeliveryPayment = Boolean(
    traceability &&
      traceability.totalPieces > 0 &&
      traceability.packed >= traceability.totalPieces &&
      !payment.deliveryCovered &&
      !deliveryPaymentConfirmed &&
      !deliveryReleasedByStatus
  );
  const packedReadyForDeliverySchedule = Boolean(
    traceability &&
      traceability.totalPieces > 0 &&
      traceability.packed >= traceability.totalPieces &&
      (payment.deliveryCovered || deliveryPaymentConfirmed || deliveryReleasedByStatus) &&
      traceability.installed < traceability.totalPieces
  );

  useEffect(() => {
    loadPortal();

    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const portalWindow = window as Window & { __rdwoodClientPortalRefresh?: number };
    if (portalWindow.__rdwoodClientPortalRefresh) {
      window.clearInterval(portalWindow.__rdwoodClientPortalRefresh);
    }

    const interval = window.setInterval(() => {
      loadPortal(true);
    }, PORTAL_REFRESH_MS);

    portalWindow.__rdwoodClientPortalRefresh = interval;

    return () => {
      window.clearInterval(interval);
      if (portalWindow.__rdwoodClientPortalRefresh === interval) {
        delete portalWindow.__rdwoodClientPortalRefresh;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadPortal(silent = false) {
    setMessage("");
    if (!silent) setLoading(true);
    setHero({
      project_id: "demo",
      hero_image: FALLBACK_HERO,
      source_table: "fallback",
      category: "premium_fallback",
      ai_score: 10,
    });
    setSummary(null);
    setGallery(defaultGallery);
    setClaims([]);
    setDesignRequest(null);
    setDesignVariants([]);
    setPortalQuote(null);
    setPortalQuoteItems([]);
    setPortalQuoteTerms(null);
    setTraceability(null);
    setDeliveryPaymentConfirmed(false);

    let current: PortalProject | null = null;
    let source: "portal" | "contract" | null = null;
    let contractFallback: any = null;
    let activeDesignRequest: any = null;

    const tokenRes = await supabase
      .from("client_portal_tokens")
      .select("project_id")
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (tokenRes.data?.project_id) {
      const p = await supabase
        .from("v_client_portal_projects")
        .select("*")
        .eq("id", tokenRes.data.project_id)
        .maybeSingle();

      current = (p.data as PortalProject) || null;
      if (current) source = "portal";
    }

    if (!current) {
      const contractRes = await supabase
        .from("project_contracts")
        .select("*")
        .eq("client_portal_token", token)
        .eq("portal_enabled", true)
        .maybeSingle();

      if (contractRes.data) {
        contractFallback = contractRes.data;
        current = contractToPortalProject(contractFallback);
        source = "contract";

        const approvedRender = await resolveContractApprovedRender(contractFallback);
        current.approved_render_url = approvedRender;
        const contractPayments = await loadContractPayments(contractFallback);
        const contractPayment = contractPaymentSummary(contractFallback, contractPayments);
        current.status = await resolveContractOperationalStatus(contractFallback, contractPayments);
        setTraceability(await loadPortalTraceability(contractFallback));
        setDeliveryPaymentConfirmed(contractPayment.deliveryCovered);

        setHero({
          project_id: contractFallback.id,
          hero_image: approvedRender || FALLBACK_HERO,
          source_table: approvedRender ? "project_contracts.approved_render_url" : "fallback",
          category: "approved_render",
          ai_score: approvedRender ? 100 : 10,
        });

        setSummary({ ...contractToSummary(contractFallback, contractPayments), ...(await loadContractWarranty(contractFallback)) });
        setGallery(
          approvedRender
            ? [
                {
                  id: "approved-render",
                  asset_url: approvedRender,
                  title: "Render aprobado por el cliente",
                },
              ]
            : defaultGallery
        );
      }
    }

    if (!current) {
      const requestRes = await supabase
        .from("ai_design_requests")
        .select("*")
        .eq("id", token)
        .maybeSingle();

      if (requestRes.data) {
        const request = requestRes.data as any;
        activeDesignRequest = request;
        const rendersRes = await supabase
          .from("ai_design_renders")
          .select("*")
          .eq("ai_design_request_id", request.id)
          .order("variant", { ascending: true });

        const variants = ((rendersRes.data || []) as any[])
          .map((row) => ({
            id: String(row.id),
            variant: String(row.variant || "").toUpperCase(),
            title: row.title || null,
            name: row.variant_name || row.name || row.title || null,
            concept: row.concept || row.notes || null,
            render_image_url: row.render_image_url || row.image_url || null,
            image_url: row.image_url || null,
            status: row.status || "render_generado",
          }))
          .filter((row) => row.variant && variantImage(row));

        current = requestToPortalProject(request);
        source = "portal";
        setDesignRequest(request);
        setDesignVariants(variants);

        const approvedVariant = variants.find((row) => isApprovedRenderStatus(row.status));
        const heroImage =
          requestApprovedRenderUrl(request) ||
          variantImage(approvedVariant || variants[0]) ||
          FALLBACK_HERO;

        setHero({
          project_id: request.id,
          hero_image: heroImage,
          source_table: heroImage === FALLBACK_HERO ? "fallback" : "ai_design_renders",
          category: requestApprovedRenderUrl(request) ? "approved_render" : "pending_design_decision",
          ai_score: heroImage === FALLBACK_HERO ? 10 : 96,
        });

        setGallery(
          variants.length
            ? variants.map((row) => ({
                id: row.id,
                asset_url: variantImage(row),
                title: variantName(row),
              }))
            : defaultGallery
        );

        setSummary({
          project_id: request.id,
          total_amount: Number(request.budget || request.presupuesto || 0),
          paid_amount: 0,
          credit_applied: 5000,
          payment_status: request.status || request.ai_status || "pendiente_decision_cliente",
          balance: Number(request.budget || request.presupuesto || 0),
          warranty_status: "pendiente contrato",
          warranty_code: "Pendiente",
        });
      }
    }

    if (!current) {
      setProject(null);
      setCatalog([]);
      setMessage("Este enlace de portal no esta activo o fue reemplazado. Solicita un nuevo link a RD Wood.");
      setLoading(false);
      return;
    }

    setProject(current);

    const quote = await resolvePortalQuote(activeDesignRequest || contractFallback, current);
    if (quote) {
      setPortalQuote(quote);

      const [itemsRes, termsRes] = await Promise.all([
        supabase.from("quote_items").select("*").eq("quote_id", quote.id).order("created_at", { ascending: true }),
        supabase.from("quote_terms").select("*").eq("quote_id", quote.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      setPortalQuoteItems((itemsRes.data || []) as PortalQuoteItem[]);
      setPortalQuoteTerms((termsRes.data as PortalQuoteTerms) || null);

      if (!contractFallback) {
        const contractByQuote = await supabase
          .from("project_contracts")
          .select("*")
          .eq("quote_id", quote.id)
          .maybeSingle();

        if (contractByQuote.data) {
          contractFallback = contractByQuote.data;
          const contractPayments = await loadContractPayments(contractFallback);
          const contractPayment = contractPaymentSummary(contractFallback, contractPayments);
          const contractStatus = await resolveContractOperationalStatus(contractFallback, contractPayments);

          setTraceability(await loadPortalTraceability(contractByQuote.data));
          setDeliveryPaymentConfirmed(contractPayment.deliveryCovered);
          setSummary({ ...contractToSummary(contractFallback, contractPayments), ...(await loadContractWarranty(contractFallback)) });
          setProject((prev) => (prev ? { ...prev, status: contractStatus } : prev));
        }
      }
    }

    if (current?.id && current.id !== "demo" && source !== "contract") {
      const h = await supabase
        .from("v_client_portal_hero_ai")
        .select("*")
        .eq("project_id", current.id)
        .maybeSingle();

      if (h.data) setHero(h.data as HeroAI);

      const s = await supabase
        .from("v_client_portal_commercial_summary")
        .select("*")
        .eq("project_id", current.id)
        .maybeSingle();

      if (s.data) setSummary(s.data as CommercialSummary);

      const finalPhotos = await supabase
        .from("final_delivery_photos")
        .select("id, photo_url")
        .eq("project_id", current.id)
        .order("created_at", { ascending: false })
        .limit(8);

      if (finalPhotos.data?.length) {
        setGallery(
          finalPhotos.data.map((x: any) => ({
            id: x.id,
            asset_url: x.photo_url,
            title: "Foto del proyecto",
          }))
        );
      }

      const c = await supabase
        .from("v_client_portal_claims_full")
        .select("*")
        .eq("project_id", current.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setClaims((c.data || []) as Claim[]);
    } else if (source === "contract") {
      const c = await supabase
        .from("v_client_portal_claims_full")
        .select("*")
        .eq("project_id", current.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setClaims((c.data || []) as Claim[]);
    }

    const cat = await supabase
      .from("client_portal_catalog_items")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(6);

    setCatalog((cat.data || []) as CatalogItem[]);
    setLoading(false);
  }

  function handlePhotoSelect(files: FileList | null) {
    if (!files) return;

    const accepted = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 8);

    const next = accepted.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...next].slice(0, 8));
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return copy;
    });
  }

  async function uploadClaimPhotos(claimId: string) {
    const uploaded: {
      photo_url: string;
      storage_path: string;
      file_name: string;
      file_size: number;
      mime_type: string;
    }[] = [];

    for (const item of photos) {
      const extension = item.file.name.split(".").pop() || "jpg";
      const cleanName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${project?.id || "demo"}/${claimId}/${Date.now()}-${crypto.randomUUID()}-${cleanName}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, item.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: item.file.type,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

      uploaded.push({
        photo_url: data.publicUrl,
        storage_path: storagePath,
        file_name: item.file.name,
        file_size: item.file.size,
        mime_type: item.file.type,
      });
    }

    return uploaded;
  }

  async function submitClaim() {
    if (!project) return;
    if (!issueTitle.trim()) {
      alert("Escribe el problema que presenta el proyecto.");
      return;
    }

    setSubmittingClaim(true);
    setMessage("");

    try {
      const ai = classifyIssue(issueTitle + " " + issueDescription);

      const { data: claim, error: claimError } = await supabase
        .from("client_portal_claims")
        .insert({
          project_id: project.id,
          portal_token: token,
          client_name: project.client_name || "Cliente RD Wood",
          client_phone: clientPhone,
          issue_title: issueTitle,
          issue_description: issueDescription,
          issue_category: ai.category,
          priority: ai.priority,
          ai_classification: ai.ai,
          ai_risk_score: ai.score,
          warranty_status: "pendiente_validacion",
          status: "recibido",
        })
        .select("id")
        .single();

      if (claimError) throw new Error(claimError.message);

      const uploadedPhotos = await uploadClaimPhotos(claim.id);

      if (uploadedPhotos.length > 0) {
        const { error: photosError } = await supabase.from("client_portal_claim_photos").insert(
          uploadedPhotos.map((p) => ({
            claim_id: claim.id,
            photo_url: p.photo_url,
            storage_path: p.storage_path,
            file_name: p.file_name,
            file_size: p.file_size,
            mime_type: p.mime_type,
            notes: "Foto tomada/cargada por cliente desde portal",
          }))
        );

        if (photosError) throw new Error(photosError.message);
      }

      const rpc = await supabase.rpc("fn_create_after_sales_ticket_from_claim", {
        p_claim_id: claim.id,
      });

      if (rpc.error) throw new Error(rpc.error.message);

      setMessage("✅ Reclamo enviado con fotos. Se creó un ticket de postventa para seguimiento.");

      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setIssueTitle("");
      setIssueDescription("");
      setClientPhone("");
      setOpenClaim(false);
      await loadPortal();
    } catch (error: any) {
      alert("Error enviando reclamo: " + (error?.message || error));
    } finally {
      setSubmittingClaim(false);
    }
  }

  async function submitSurvey() {
    if (!project) return;

    const { error } = await supabase.from("client_satisfaction_surveys").insert({
      project_id: project.id,
      client_name: project.client_name,
      rating,
      comment: surveyComment,
      would_recommend: rating >= 4,
    });

    setMessage(error ? "Error guardando encuesta: " + error.message : "✅ Gracias por tu valoración.");
    setSurveyComment("");
    await loadPortal();
  }

  async function submitReferral() {
    if (!project) return;
    if (!refName.trim() || !refPhone.trim()) {
      alert("Completa nombre y teléfono del referido.");
      return;
    }

    const referralCode = referralCodeForProject(project);
    const referralPayload = {
      project_id: project.id,
      referrer_client_id: project.client_id || null,
      referrer_name: project.client_name,
      referrer_phone: project.client_phone || null,
      referral_code: referralCode,
      referral_link: referralLinkForProject(token, project),
      referred_name: refName,
      referred_phone: refPhone,
      project_interest: "Referido desde portal cliente",
      source: "portal_cliente",
      status: "lead_registrado",
      bonus_status: "pendiente_proyecto",
      bonus_type: "descuento_proxima_compra",
      bonus_amount: 0,
      portal_token: token,
      notes: `Referido creado desde portal del proyecto ${project.project_name || project.name || project.id}.`,
    };

    const { error } = await supabase.from("client_referrals").insert(referralPayload);

    if (error) {
      const fallback = await supabase.from("client_referrals").insert({
        project_id: project.id,
        referrer_name: project.client_name,
        referred_name: refName,
        referred_phone: refPhone,
        project_interest: "Referido desde portal cliente",
      });

      if (fallback.error) {
        setMessage("Error guardando referido: " + fallback.error.message);
        return;
      }
    }

    let finalMessage = "✅ Referido registrado.";

    try {
      const leadCode = await createCrmLeadFromPortal({
        customerName: refName.trim(),
        phone: refPhone.trim(),
        source: "referido",
        projectType: "otro",
        needDescription: `Referido por ${project.client_name || "cliente"} desde portal cliente.`,
        notes: `Origen: portal cliente ${token}. Proyecto origen: ${project.project_name || project.name || project.id}.`,
      });
      finalMessage = `✅ Referido registrado y enviado a CRM (${leadCode}).`;
    } catch (crmError: any) {
      finalMessage = `✅ Referido registrado. Pendiente revisar CRM: ${crmError?.message || crmError}`;
    }

    setRefName("");
    setRefPhone("");
    await loadPortal();
    setMessage(finalMessage);
  }

  async function submitNewProject() {
    if (!project) return;
    if (!newProject.trim()) {
      alert("Escribe qué quiere cotizar el cliente.");
      return;
    }

    const { error } = await supabase.from("client_new_project_requests").insert({
      source_project_id: project.id,
      client_name: project.client_name,
      description: newProject,
      request_type: "nuevo_proyecto",
    });

    if (error) {
      setMessage("Error guardando solicitud: " + error.message);
      return;
    }

    try {
      const leadCode = await createCrmLeadFromPortal({
        customerName: project.client_name || "Cliente portal",
        phone: project.client_phone,
        email: project.client_email,
        source: "web",
        projectType: inferProjectType(newProject),
        needDescription: newProject.trim(),
        notes: `Solicitud de nuevo proyecto desde portal cliente ${token}. Proyecto origen: ${project.project_name || project.name || project.id}.`,
      });
      setMessage(`✅ Solicitud recibida y enviada a CRM (${leadCode}).`);
    } catch (crmError: any) {
      setMessage(`✅ Solicitud recibida. Pendiente revisar CRM: ${crmError?.message || crmError}`);
    }

    setNewProject("");
  }

  async function submitCatalogInterest(item: CatalogItem) {
    if (!project) return;

    const itemPrice = n(item.price);
    const itemCurrency = item.currency || "DOP";
    const description = `Cliente solicita adicional recomendado: ${item.title}. Precio mostrado: ${currency(itemPrice, itemCurrency)}.`;

    const catalogRequest = await supabase.from("client_portal_catalog_requests").insert({
      project_id: project.id,
      client_id: project.client_id || null,
      client_name: project.client_name || "Cliente portal",
      client_phone: project.client_phone || null,
      item_id: item.id,
      item_title: item.title,
      item_description: item.description || null,
      item_price: itemPrice,
      currency: itemCurrency,
      category: item.category || null,
      source: "portal_cliente",
      status: "solicitado",
      notes: `Solicitud desde Recomendado para ti. Portal: ${token}. Proyecto: ${project.project_name || project.name || project.id}.`,
    });

    try {
      const leadCode = await createCrmLeadFromPortal({
        customerName: project.client_name || "Cliente portal",
        phone: project.client_phone,
        email: project.client_email,
        source: "web",
        projectType: inferProjectType(`${item.title} ${item.description || ""}`),
        needDescription: description,
        notes: `Solicitud de adicional desde portal cliente ${token}. Item catalogo: ${item.id}. ${
          catalogRequest.error ? "No se guardo en client_portal_catalog_requests; revisar configuracion de tabla." : "Solicitud registrada en catalogo."
        }`,
      });
      setMessage(`✅ Solicitud de adicional enviada a CRM (${leadCode}).`);
    } catch (crmError: any) {
      if (catalogRequest.error) {
        setMessage(`Error guardando solicitud: ${catalogRequest.error.message}`);
        return;
      }
      setMessage(`✅ Solicitud recibida. Pendiente revisar CRM: ${crmError?.message || crmError}`);
    }
  }

  async function approveDesignVariant(variant: DesignPortalVariant) {
    if (!designRequest) return;
    const imageUrl = variantImage(variant);
    if (!imageUrl) {
      setMessage("Esta variante no tiene imagen disponible para aprobar.");
      return;
    }

    setApprovingVariant(variant.id);
    setMessage("");

    try {
      const now = new Date().toISOString();

      await supabase
        .from("ai_design_renders")
        .update({ status: "render_no_seleccionado", updated_at: now } as any)
        .eq("ai_design_request_id", designRequest.id);

      const { error: renderError } = await supabase
        .from("ai_design_renders")
        .update({ status: "aprobado_cliente", updated_at: now } as any)
        .eq("id", variant.id);

      if (renderError) throw renderError;

      const { error: requestError } = await supabase
        .from("ai_design_requests")
        .update({
          status: "render_aprobado",
          ai_status: "render_aprobado",
          client_approved: true,
          approved_render: true,
          selected_render_id: variant.id,
          selected_variant_id: variant.id,
          approved_variant_id: variant.id,
          approved_render_url: imageUrl,
          render_image_url: imageUrl,
          approved_render_at: now,
          render_approved_at: now,
          approved_at: now,
          approved_render_by: "cliente_portal",
          approval_notes: `Render aprobado por cliente: ${variantName(variant)}`,
          updated_at: now,
        } as any)
        .eq("id", designRequest.id);

      if (requestError) throw requestError;

      if (designRequest.measurement_id) {
        await supabase
          .from("field_measurements")
          .update({
            status: "render_aprobado",
            estado: "render_aprobado",
            render_status: "render_aprobado",
            approved_render_url: imageUrl,
            render_approved_at: now,
            render_approved_by: "cliente_portal",
            updated_at: now,
          } as any)
          .eq("id", designRequest.measurement_id);
      }

      setDesignRequest((current: any) => ({
        ...current,
        status: "render_aprobado",
        ai_status: "render_aprobado",
        approved_render_url: imageUrl,
        render_image_url: imageUrl,
        selected_render_id: variant.id,
        approved_variant_id: variant.variant,
        approval_notes: `Render aprobado por cliente: ${variantName(variant)}`,
      }));
      setDesignVariants((current) =>
        current.map((row) => ({
          ...row,
          status: row.id === variant.id ? "aprobado_cliente" : "render_no_seleccionado",
        }))
      );
      setProject((current) =>
        current
          ? {
              ...current,
              approved_render_url: imageUrl,
              status: "render_aprobado",
            }
          : current
      );
      setHero({
        project_id: designRequest.id,
        hero_image: imageUrl,
        source_table: "ai_design_renders.aprobado_cliente",
        category: "approved_render",
        ai_score: 100,
      });
      setMessage("Render aprobado correctamente. Tu proyecto queda listo para Cotizacion; el pago online se habilitara en una proxima fase.");
    } catch (error: any) {
      setMessage(`Error aprobando render: ${error?.message || error}`);
    } finally {
      setApprovingVariant("");
    }
  }

  async function approvePortalQuote() {
    if (!portalQuote) return;

    setApprovingQuote(true);
    setMessage("");

    try {
      const now = new Date().toISOString();
      const { error: quoteError } = await supabase
        .from("quotes")
        .update({
          status: "aprobada_cliente",
          approved_at: now,
          updated_at: now,
        } as any)
        .eq("id", portalQuote.id);

      if (quoteError) throw quoteError;

      if (designRequest?.id) {
        await supabase
          .from("ai_design_requests")
          .update({
            quote_id: portalQuote.id,
            status: "cotizacion_aprobada_cliente",
            ai_status: "cotizacion_aprobada_cliente",
            updated_at: now,
          } as any)
          .eq("id", designRequest.id);
      }

      if (designRequest?.measurement_id) {
        await supabase
          .from("field_measurements")
          .update({
            status: "cotizacion_aprobada_cliente",
            estado: "cotizacion_aprobada_cliente",
            updated_at: now,
          } as any)
          .eq("id", designRequest.measurement_id);
      }

      await ensureContractFromPortalQuote(now);

      setPortalQuote((current) =>
        current
          ? {
              ...current,
              status: "aprobada_cliente",
            }
          : current
      );
      setProject((current) => (current ? { ...current, status: "cotizacion_aprobada_cliente" } : current));
      setMessage("Cotizacion autorizada correctamente. Contrato preparado para el siguiente paso.");
    } catch (error: any) {
      setMessage(`Error autorizando cotizacion: ${error?.message || error}`);
    } finally {
      setApprovingQuote(false);
    }
  }

  async function ensureContractFromPortalQuote(now: string) {
    if (!portalQuote) return;

    const total = quoteTotal(portalQuote);
    const measurementId = portalQuote.measurement_id || designRequest?.measurement_id || null;
    let approvedMeasurement: any = null;

    if (measurementId) {
      const { data } = await supabase
        .from("field_measurements")
        .select("*")
        .eq("id", measurementId)
        .maybeSingle();
      approvedMeasurement = data || null;
    }

    const measurementDetails = approvedMeasurement?.real_space_json || {};
    const material = portalQuote.material_preference || designRequest?.material_preference || "";
    const color = portalQuote.color_preference || designRequest?.color_palette || "";
    const hardware = portalQuote.hardware_preference || designRequest?.hardware_preference || "";
    const lights = [measurementDetails.lighting_preference, measurementDetails.electrical_notes].filter(Boolean).join(" · ");
    const approvedModules = portalQuoteItems.map((item) => ({
      ...item,
      name: item.description || item.code || "Modulo",
      material,
      color,
      hardware,
      lights,
      width_m: portalQuote.width_m || null,
      height_m: portalQuote.height_m || null,
      depth_m: portalQuote.depth_m || null,
      linear_feet: portalQuote.linear_feet || null,
      square_meters: portalQuote.square_meters || null,
    }));
    const contractPayload = {
      quote_id: portalQuote.id,
      ai_design_request_id: designRequest?.id || portalQuote.ai_design_request_id || null,
      client_id: project?.client_id || null,
      client_name: portalQuote.client_name || project?.client_name || null,
      client_phone: project?.client_phone || null,
      client_email: project?.client_email || null,
      project_name: portalQuote.project_name || project?.project_name || project?.name || null,
      project_type: portalQuote.project_type || null,
      approved_render_url: project?.approved_render_url || hero.hero_image || null,
      approved_render_notes: "Render y cotizacion autorizados por el cliente desde el portal.",
      approved_measurements: {
        measurement_id: measurementId,
        width_m: portalQuote.width_m || null,
        height_m: portalQuote.height_m || null,
        depth_m: portalQuote.depth_m || null,
        length_m: portalQuote.length_m || null,
        linear_feet: portalQuote.linear_feet || null,
        square_meters: portalQuote.square_meters || null,
      },
      approved_materials: {
        source: "portal_cliente",
        material,
        color,
        hardware,
        lights,
        handle_preference: measurementDetails.handle_preference || null,
        opening_system: measurementDetails.opening_system || null,
        client_document: portalQuote.client_document || null,
        client_document_type: "cedula",
      },
      approved_modules: approvedModules,
      total_amount: total,
      credit_applied: n(portalQuote.credit_applied),
      initial_60: n(portalQuote.initial_60) || total * 0.6,
      initial_due: n(portalQuote.initial_60) || total * 0.6,
      delivery_20: n(portalQuote.delivery_20) || total * 0.2,
      final_20: n(portalQuote.final_20) || total * 0.2,
      payment_terms: portalQuoteTerms?.payment_terms || "60% inicial / 20% antes de transporte / 20% entrega final.",
      delivery_terms: portalQuoteTerms?.delivery_time || null,
      warranty_terms: portalQuoteTerms?.warranty || null,
      change_policy:
        "Despues de aprobada la cotizacion, render, medidas, materiales y condiciones, cualquier cambio solicitado por el cliente puede generar costo adicional.",
      client_protection: "RD Wood debe entregar el proyecto conforme a render, medidas y cotizacion aprobada.",
      company_protection: "El cliente acepta condiciones, pagos y tiempos indicados en la cotizacion autorizada.",
      status: "borrador",
      client_portal_token: token,
      client_portal_url: portalClientUrl(token),
      portal_enabled: true,
      portal_enabled_at: now,
      updated_at: now,
    };

    const { data: existingContract, error: existingError } = await supabase
      .from("project_contracts")
      .select("id")
      .eq("quote_id", portalQuote.id)
      .maybeSingle();

    if (existingError) throw existingError;

    let contractId = existingContract?.id || "";

    if (contractId) {
      const { error } = await supabase.from("project_contracts").update(contractPayload as any).eq("id", contractId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("project_contracts")
        .insert({
          contract_code: portalContractCode(),
          ...contractPayload,
          created_at: now,
        } as any)
        .select("id")
        .single();

      if (error) throw error;
      contractId = data?.id || "";
    }

    if (contractId) {
      await supabase
        .from("quotes")
        .update({
          contract_id: contractId,
          contract_status: "borrador",
          updated_at: now,
        } as any)
        .eq("id", portalQuote.id);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050816] px-6 text-white">
        <section className="w-full max-w-xl rounded-3xl border border-cyan-300/20 bg-slate-950/80 p-5 text-center sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300 sm:tracking-[0.3em]">RD Wood System</p>
          <h1 className="mt-4 break-words text-2xl font-black sm:text-3xl">Abriendo portal privado</h1>
          <p className="mt-3 text-sm font-semibold text-slate-400">Validando enlace del cliente.</p>
        </section>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050816] px-6 text-white">
        <section className="w-full max-w-xl rounded-3xl border border-amber-300/30 bg-slate-950/80 p-5 text-center sm:p-8">
          <AlertTriangle className="mx-auto text-amber-300" size={42} />
          <h1 className="mt-4 break-words text-2xl font-black sm:text-3xl">Link no disponible</h1>
          <p className="mt-3 text-sm font-semibold text-slate-300">
            {message || "Este enlace no esta activo. Solicita uno nuevo al equipo RD Wood."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="relative min-h-[620px] overflow-hidden sm:min-h-[720px]">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${approvedRenderImage})` }} />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-transparent to-transparent" />

        <div className="relative mx-auto flex min-h-[620px] max-w-7xl flex-col justify-center px-4 py-10 sm:min-h-[720px] sm:px-6 sm:py-12">
          <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100 backdrop-blur sm:px-4 sm:text-xs sm:tracking-[0.28em]">
            <Sparkles size={15} />
            <span className="truncate">Portal Comercial · {project?.code || "RD WOOD"}</span>
          </div>

          <h1 className="mt-6 max-w-4xl break-words text-4xl font-black leading-tight sm:mt-8 sm:text-6xl md:text-8xl">
            {project?.name || project?.project_name || "Proyecto RD Wood"}
          </h1>

          <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-slate-200 sm:text-xl">
            Bienvenido, {project?.client_name || "cliente"}. Aquí puedes ver tu proyecto, garantía, pagos, referidos, nuevos servicios y reportar incidencias.
          </p>

          <div className="mt-6 grid gap-3 sm:mt-8 sm:flex sm:flex-wrap sm:gap-4">
            <button onClick={() => setOpenClaim(true)} className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black uppercase text-slate-950 sm:w-auto sm:px-6 sm:py-4">
              <AlertTriangle size={18} />
              Reportar incidencia
            </button>

            <a href="https://wa.me/18096905636" target="_blank" className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black uppercase text-slate-950 sm:w-auto sm:px-6 sm:py-4">
              <MessageCircle size={18} />
              Hablar con mi asesor
            </a>

            <button className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black uppercase text-white backdrop-blur sm:w-auto sm:px-6 sm:py-4">
              <ArrowDownToLine size={18} />
              Descargar garantía
            </button>
          </div>

          <div className="mt-8 grid max-w-6xl grid-cols-2 gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
            <HeroCard title="Estado" value={statusLabel(project?.status)} />
            <HeroCard title="Progreso" value={`${progress}%`} />
            <HeroCard title="Inicial 60%" value={payment.initialCovered ? "Pagado" : currency(payment.initialDue)} />
            <HeroCard title="Balance" value={currency(payment.balance)} />
            <HeroCard title="Garantía" value={summary?.warranty_status || "activa"} />
            <HeroCard title="Reclamos" value={String(claims.length)} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {message && (
          <div className="mb-6 rounded-3xl border border-cyan-300/30 bg-cyan-300/10 p-5 text-sm font-black text-cyan-100">
            {message}
          </div>
        )}

        {needsDesignDecision && (
          <div className="mb-6 rounded-3xl border border-cyan-300/25 bg-white/[0.04] p-4 sm:p-5 md:mb-8 md:rounded-[34px] md:p-7">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200 sm:tracking-[0.35em]">Seleccion de diseño</p>
                <h2 className="mt-2 text-2xl font-black sm:text-4xl">Elige el render que apruebas</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-400">
                  Revisa las propuestas generadas para tu proyecto. Al aprobar una version, RD Wood la recibe directamente para preparar la cotizacion.
                </p>
              </div>
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase text-amber-100">
                Pendiente decision
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {designVariants.map((variant) => {
                const approved = isApprovedRenderStatus(variant.status);
                return (
                  <div key={variant.id} className={["overflow-hidden rounded-2xl border bg-slate-950 sm:rounded-3xl", approved ? "border-emerald-300/50" : "border-white/10"].join(" ")}>
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200 sm:tracking-[0.25em]">Variante {variant.variant}</p>
                        <h3 className="mt-1 break-words text-lg font-black sm:text-xl">{variantName(variant)}</h3>
                      </div>
                      {approved && <BadgeCheck className="text-emerald-300" />}
                    </div>
                    <div className="flex aspect-square items-center justify-center bg-black">
                      <img src={variantImage(variant)} alt={variantName(variant)} className="h-full w-full object-contain" />
                    </div>
                    <div className="p-4">
                      {variant.concept && <p className="mb-4 text-sm font-semibold text-slate-400">{variant.concept}</p>}
                      <button
                        type="button"
                        onClick={() => approveDesignVariant(variant)}
                        disabled={Boolean(approvingVariant)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black uppercase text-slate-950 disabled:opacity-60"
                      >
                        <CheckCircle2 size={17} />
                        {approvingVariant === variant.id ? "Aprobando..." : "Aprobar esta version"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-blue-300/20 bg-blue-400/10 p-4 text-sm font-bold text-blue-50">
              Proxima fase: pago online en este mismo portal para aprobar cotizacion y abonar por tarjeta, PayPal u otro proveedor.
            </div>
          </div>
        )}

        {hasApprovedRender && (
          <div className="mb-6 rounded-3xl border border-cyan-300/25 bg-white/[0.04] p-4 sm:p-5 md:mb-8 md:rounded-[34px] md:p-7">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200 sm:tracking-[0.35em]">Render aprobado</p>
                <h2 className="mt-2 text-2xl font-black sm:text-4xl">Visual autorizado del proyecto</h2>
              </div>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase text-emerald-100">
                Aprobado por cliente
              </span>
            </div>
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black">
              <img
                src={approvedRenderImage}
                alt={`Render aprobado de ${project?.project_name || project?.name || "proyecto"}`}
                className="max-h-[620px] w-full object-contain"
              />
            </div>
          </div>
        )}

        {portalQuote && (
          <div className="mb-6 rounded-3xl border border-emerald-300/30 bg-emerald-300/10 p-4 sm:p-5 md:mb-8 md:rounded-[34px] md:p-7">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200 sm:tracking-[0.35em]">Cotizacion final</p>
                <h2 className="mt-2 break-words text-2xl font-black sm:text-4xl">{quoteCode(portalQuote)}</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold text-emerald-50">
                  {quoteReadOnly
                    ? "Proyecto entregado. Esta cotizacion queda disponible como historico comercial del proyecto."
                    : "Revisa el precio, partidas y condiciones. Al autorizar, RD Wood recibe la aprobacion para preparar contrato y pago inicial."}
                </p>
              </div>
              <span className={["rounded-full border px-4 py-2 text-xs font-black uppercase", quoteReadOnly || isQuoteApprovedByClient(portalQuote) ? "border-emerald-200/40 bg-emerald-200/20 text-emerald-50" : "border-amber-300/40 bg-amber-300/10 text-amber-100"].join(" ")}>
                {quoteReadOnly ? "Proyecto entregado" : isQuoteApprovedByClient(portalQuote) ? "Autorizada por cliente" : "Pendiente autorizacion"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
              <InfoRow label="Precio final" value={currency(quoteTotal(portalQuote))} />
              <InfoRow label="Inicial 60%" value={currency(portalQuote.initial_60)} />
              <InfoRow label="20% entrega" value={currency(portalQuote.delivery_20)} />
              <InfoRow label="20% final" value={currency(portalQuote.final_20)} />
              <InfoRow label="Abono reservado final" value={currency(portalQuote.credit_applied)} />
              <InfoRow label="Final pendiente" value={currency(Math.max(n(portalQuote.final_20) - n(portalQuote.credit_applied), 0))} />
            </div>

            {portalQuoteItems.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 sm:rounded-3xl">
                <div className="grid grid-cols-[minmax(0,1fr)_64px_96px] gap-2 bg-slate-950 px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 sm:grid-cols-[minmax(0,1fr)_80px_120px] sm:px-4 sm:text-xs sm:tracking-[0.2em] md:grid-cols-[minmax(0,1fr)_90px_150px_150px]">
                  <div>Partida</div>
                  <div>Cant.</div>
                  <div className="hidden md:block">Unitario</div>
                  <div>Total</div>
                </div>
                {portalQuoteItems.map((item, index) => (
                  <div key={item.id || index} className="grid grid-cols-[minmax(0,1fr)_64px_96px] gap-2 border-t border-white/10 px-3 py-3 text-xs font-semibold sm:grid-cols-[minmax(0,1fr)_80px_120px] sm:px-4 sm:text-sm md:grid-cols-[minmax(0,1fr)_90px_150px_150px]">
                    <div className="min-w-0">
                      <div className="font-black text-white">{item.description || item.code || "Partida"}</div>
                      {item.code && <div className="mt-1 text-xs text-slate-500">{item.code}</div>}
                    </div>
                    <div className="break-words">{quoteItemQuantity(item).toFixed(2)} {item.unit || ""}</div>
                    <div className="hidden md:block">{currency(quoteItemUnitPrice(item))}</div>
                    <div className="break-words font-black text-emerald-200">{currency(quoteItemTotal(item))}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Pago</p>
                <p className="mt-2 text-sm font-semibold text-slate-200">{portalQuoteTerms?.payment_terms || "60% inicial / 20% antes de transporte / 20% entrega final."}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Entrega</p>
                <p className="mt-2 text-sm font-semibold text-slate-200">{portalQuoteTerms?.delivery_time || "Segun disponibilidad y aprobacion final."}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Garantia</p>
                <p className="mt-2 text-sm font-semibold text-slate-200">{portalQuoteTerms?.warranty || "Garantia limitada RD Wood."}</p>
              </div>
            </div>

            {canApproveQuote ? (
              <button
                type="button"
                onClick={approvePortalQuote}
                disabled={approvingQuote}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-black uppercase text-slate-950 disabled:opacity-60"
              >
                <CheckCircle2 size={18} />
                {approvingQuote ? "Autorizando cotizacion..." : "Autorizar cotizacion"}
              </button>
            ) : (
              <div className="mt-6 rounded-2xl border border-emerald-200/30 bg-emerald-200/10 p-4 text-sm font-black text-emerald-50">
                {quoteReadOnly
                  ? "Proyecto entregado. La cotizacion queda cerrada para consulta del cliente."
                  : "Cotizacion autorizada. RD Wood continuara con contrato y pago inicial."}
              </div>
            )}
          </div>
        )}

        {openClaim && (
          <div className="mb-6 rounded-3xl border border-amber-300/30 bg-amber-300/10 p-4 sm:p-6 md:mb-8 md:rounded-[34px] md:p-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200 sm:tracking-[0.35em]">Reclamo de garantía</p>
                <h2 className="mt-2 text-2xl font-black sm:text-4xl">Reportar incidencia</h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold text-amber-50">
                  El cliente puede tomar fotos con su cámara o subirlas desde galería. Se crea ticket automático en Postventa.
                </p>
              </div>
              <button onClick={() => setOpenClaim(false)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black">
                Cerrar
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Teléfono / WhatsApp" className="rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-amber-300" />
              <input value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} placeholder="Ej: Puerta descuadrada, bisagra dañada, humedad..." className="rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-amber-300" />
              <textarea value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} placeholder="Describe el problema con detalles..." className="h-32 rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-amber-300 lg:col-span-2" />

              <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 lg:col-span-2">
                <div className="mb-4 flex items-center gap-3">
                  <Camera className="text-amber-200" />
                  <h3 className="text-xl font-black">Fotos del problema</h3>
                </div>

                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300/40 bg-amber-300/10 p-5 text-center hover:bg-amber-300/15 sm:rounded-3xl sm:p-8">
                  <UploadCloud className="mb-3 text-amber-200" size={36} />
                  <div className="text-lg font-black">Tomar foto o subir desde galería</div>
                  <div className="mt-2 text-sm font-semibold text-amber-50">
                    En celular abrirá la cámara automáticamente.
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePhotoSelect(e.target.files)}
                  />
                </label>

                {photos.length > 0 && (
                  <div className="mt-5 grid gap-4 md:grid-cols-4">
                    {photos.map((item, index) => (
                      <div key={item.preview} className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
                        <img src={item.preview} alt="Foto del reclamo" className="h-36 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute right-2 top-2 rounded-full bg-black/70 p-2 text-white"
                        >
                          <X size={15} />
                        </button>
                        <div className="p-2 text-[10px] font-bold text-slate-300">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button onClick={submitClaim} disabled={submittingClaim} className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-amber-300 px-6 py-4 text-sm font-black uppercase text-slate-950 disabled:opacity-50">
              <Send size={18} />
              {submittingClaim ? "Subiendo fotos y creando ticket..." : "Enviar reclamo y crear ticket"}
            </button>
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3 sm:p-5 md:rounded-[34px] md:p-8">
          <div className="flex flex-col gap-2 [&>p]:hidden sm:[&>p]:block md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200 sm:text-xs sm:tracking-[0.35em]">Avance inteligente</p>
              <h2 className="mt-1 text-xl font-black sm:mt-2 sm:text-3xl md:text-4xl">Timeline del Proyecto</h2>
            </div>
            <p className="max-w-xl text-sm font-semibold text-slate-400">Tu proyecto actualizado con información comercial y de servicio.</p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-6 md:mt-8 md:grid-cols-3 md:gap-4 xl:grid-cols-5 2xl:grid-cols-9">
            {timelineBase.map((step, index) => {
              const Icon = step.icon;
              const done = timelineDone(index, progress);
              const active = !done && (index === 0 || timelineDone(index - 1, progress));
              return (
                <div key={step.title} className={["min-w-0 rounded-2xl border p-2 text-center md:min-h-[190px] md:rounded-3xl md:p-4 md:text-left", active ? "border-cyan-300/60 bg-cyan-300/15" : done ? "border-emerald-300/30 bg-emerald-300/10" : "border-white/10 bg-slate-950/50"].join(" ")}>
                  <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 md:mx-0 md:h-12 md:w-12 md:rounded-2xl">
                    <Icon className={["h-4 w-4 md:h-6 md:w-6", done ? "text-emerald-300" : active ? "text-cyan-200" : "text-slate-400"].join(" ")} />
                  </div>
                  <h3 className="mt-2 break-words text-[11px] font-black leading-tight md:mt-4 md:text-base">{step.title}</h3>
                  <p className="mt-2 hidden break-words text-sm font-medium leading-relaxed text-slate-400 md:block">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {readyForFinalDelivery && (
          <div className="mt-8 rounded-3xl border border-emerald-300/30 bg-emerald-300/[0.08] p-4 sm:p-6 md:rounded-[34px] md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200 sm:tracking-[0.35em]">{finalDeliveryClosed ? "Entrega completada" : "Calidad listo"}</p>
            <h2 className="mt-2 text-2xl font-black sm:text-4xl">{finalDeliveryClosed ? "Tu proyecto fue entregado" : "Tu proyecto fue aprobado por calidad"}</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-emerald-50/90">
              {finalDeliveryClosed
                ? "La entrega final fue registrada. Tu garantía de 1 año queda activa desde la entrega."
                : "El equipo de calidad ya libero el proyecto. RD Wood coordinara contigo la firma y cierre de entrega final."}
            </p>
            {finalDeliveryClosed && payment.finalDue > 0 ? (
              <div className="mt-5 rounded-3xl border border-amber-200/40 bg-amber-300/15 p-4">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-100">Pago final pendiente</p>
                <p className="mt-1 text-3xl font-black text-amber-50">{currency(payment.finalDue)}</p>
                <p className="mt-1 text-sm font-semibold text-amber-50/90">20% final menos el abono reservado de medición/render de RD$5,000.</p>
              </div>
            ) : null}
            {!finalDeliveryClosed ? (
              <a href="https://wa.me/18096905636" target="_blank" className="mt-5 inline-flex rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-black uppercase text-slate-950">
                Coordinar entrega final
              </a>
            ) : payment.finalDue > 0 ? (
              <a href="https://wa.me/18096905636" target="_blank" className="mt-5 inline-flex rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black uppercase text-slate-950">
                Coordinar pago final
              </a>
            ) : (
              <div className="mt-5 inline-flex rounded-2xl border border-emerald-200/30 bg-emerald-200/10 px-5 py-3 text-sm font-black uppercase text-emerald-50">
                Proyecto entregado
              </div>
            )}
          </div>
        )}

        {traceability && !readyForFinalDelivery && (
          <div className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4 sm:p-6 md:rounded-[34px] md:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200 sm:tracking-[0.35em]">Trazabilidad de produccion</p>
                <h2 className="mt-2 text-2xl font-black sm:text-4xl">Tu proyecto en planta</h2>
                <p className="mt-2 text-sm font-semibold text-slate-400">
                  Seguimiento real por modulos y piezas escaneadas en corte, ensamblado, transporte e instalacion.
                </p>
              </div>
              <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/60 p-4 text-left sm:text-right md:rounded-3xl">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Orden</p>
                <p className="mt-1 break-words text-base font-black text-cyan-100 sm:text-lg">{traceability.orderCodes.join(" / ") || "Produccion"}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">Ultima actualizacion: {portalDate(traceability.lastUpdated)}</p>
              </div>
            </div>

            {packedReadyForDeliveryPayment && (
              <div className="mt-6 rounded-3xl border border-amber-300/40 bg-amber-300/12 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100 sm:tracking-[0.3em]">Accion requerida</p>
                    <h3 className="mt-2 text-2xl font-black text-white">Tu orden esta empacada y lista para transporte</h3>
                    <p className="mt-2 max-w-3xl text-sm font-semibold text-amber-50/90">
                      Para que Transportacion pueda llevar tu orden debes completar el pago del 20% de entrega.
                      Luego de recibir ese pago, RD Wood agenda contigo la fecha de entrega.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200/30 bg-slate-950/70 p-4 text-left sm:text-right">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-100">Monto pendiente</p>
                    <p className="mt-1 break-words text-2xl font-black text-amber-100 sm:text-3xl">{currency(payment.deliveryDue)}</p>
                    <a href="https://wa.me/18096905636" target="_blank" className="mt-3 inline-flex w-full justify-center rounded-2xl bg-amber-300 px-4 py-3 text-sm font-black uppercase text-slate-950 sm:w-auto">
                      Coordinar pago y entrega
                    </a>
                  </div>
                </div>
              </div>
            )}

            {packedReadyForDeliverySchedule && (
              <div className="mt-6 rounded-3xl border border-emerald-300/40 bg-emerald-300/12 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100 sm:tracking-[0.3em]">Pago recibido</p>
                    <h3 className="mt-2 text-2xl font-black text-white">Tu orden esta liberada para transporte</h3>
                    <p className="mt-2 max-w-3xl text-sm font-semibold text-emerald-50/90">
                      Ya registramos el pago del 20% de entrega. El equipo de RD Wood coordina contigo la agenda de entrega y transporte.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/30 bg-slate-950/70 p-4 text-left sm:text-right">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">20% entrega</p>
                    <p className="mt-1 text-3xl font-black text-emerald-100">Pagado</p>
                    <a href="https://wa.me/18096905636" target="_blank" className="mt-3 inline-flex w-full justify-center rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-black uppercase text-slate-950 sm:w-auto">
                      Coordinar fecha de entrega
                    </a>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-6">
              <TraceStat label="Piezas" value={traceability.totalPieces} />
              <TraceStat label="En proceso" value={traceability.inProcess} />
              <TraceStat label="Cortadas" value={traceability.cut} />
              <TraceStat label="Empacadas" value={traceability.packed} />
              <TraceStat label="Instaladas" value={traceability.installed} />
              <TraceStat label="Avance" value={`${traceability.progress}%`} />
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              {traceability.modules.map((module) => (
                <div key={module.key} className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Modulo</p>
                      <h3 className="mt-2 text-xl font-black">{module.module_name}</h3>
                      <p className="mt-1 text-xs font-bold text-slate-500">{module.order_code}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
                      <Boxes />
                    </div>
                  </div>

                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, Math.max(0, module.progress))}%` }} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <InfoRow label="Estado" value={module.statusLabel} />
                    <InfoRow label="Avance" value={`${module.progress}%`} />
                    <InfoRow label="Piezas" value={String(module.total)} />
                    <InfoRow label="Corte" value={`${module.cut}/${module.total}`} />
                    <InfoRow label="Ensamblado" value={`${module.assembled}/${module.total}`} />
                    <InfoRow label="Instalado" value={`${module.installed}/${module.total}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_430px]">
          <div className="space-y-8">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6 md:rounded-[34px] md:p-8">
              <div className="flex items-center gap-3">
                <ImageIcon className="text-cyan-200" />
                <h2 className="text-2xl font-black sm:text-3xl">Galería del Proyecto</h2>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {gallery.map((img: any) => (
                  <div key={img.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950 sm:rounded-3xl">
                    <img
                      src={img.asset_url}
                      alt={img.title || "Foto"}
                      className={[
                        "h-56 w-full transition duration-500 sm:h-72",
                        img.id === "approved-render" ? "object-contain" : "object-cover hover:scale-105",
                      ].join(" ")}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6 md:rounded-[34px] md:p-8">
              <div className="flex items-center gap-3">
                <ShoppingBag className="text-cyan-200" />
                <h2 className="text-2xl font-black sm:text-3xl">Recomendado para ti</h2>
              </div>
              <p className="mt-2 text-sm text-slate-400">Servicios y accesorios que complementan tu proyecto.</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {catalog.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950 sm:rounded-3xl">
                    {item.image_url && <img src={item.image_url} className="h-40 w-full object-cover" alt={item.title} />}
                    <div className="p-4">
                      <div className="break-words text-lg font-black">{item.title}</div>
                      <p className="mt-2 line-clamp-3 text-sm text-slate-400">{item.description}</p>
                      <div className="mt-4 break-words text-lg font-black text-cyan-200 sm:text-xl">{currency(item.price, item.currency || "DOP")}</div>
                      <button type="button" onClick={() => submitCatalogInterest(item)} className="mt-4 block w-full rounded-2xl bg-cyan-400 px-4 py-3 text-center text-sm font-black uppercase text-slate-950">
                        Solicitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 sm:rounded-3xl sm:p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <UserPlus className="text-emerald-200" />
                    <h3 className="text-lg font-black sm:text-xl">Recomienda a un amigo</h3>
                  </div>
                  <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/70 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200 sm:tracking-[0.22em]">Tu codigo</p>
                    <p className="mt-2 break-words text-xl font-black text-white sm:text-2xl">{referralCodeForProject(project)}</p>
                    <button
                      onClick={() => navigator.clipboard?.writeText(referralLinkForProject(token, project))}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-black uppercase text-slate-950"
                    >
                      Copiar enlace
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <input value={refName} onChange={(e) => setRefName(e.target.value)} placeholder="Nombre del referido" className="w-full rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-emerald-300" />
                    <input value={refPhone} onChange={(e) => setRefPhone(e.target.value)} placeholder="Telefono / WhatsApp" className="w-full rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-emerald-300" />
                    <button onClick={submitReferral} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black uppercase text-slate-950">
                      <Gift size={16} /> Registrar referido
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-4 sm:rounded-3xl sm:p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <HeartHandshake className="text-cyan-200" />
                    <h3 className="text-lg font-black sm:text-xl">Solicitar nuevo proyecto</h3>
                  </div>
                  <textarea value={newProject} onChange={(e) => setNewProject(e.target.value)} placeholder="Ejemplo: Quiero cotizar un closet, cocina o mueble de TV..." className="h-32 w-full rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-300" />
                  <button onClick={submitNewProject} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black uppercase text-slate-950">
                    <Send size={16} /> Enviar solicitud
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <SideCard title="Mis reclamos" icon={<AlertTriangle className="text-amber-200" />}>
              {claims.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-slate-400 sm:rounded-3xl sm:p-8">
                  <Clock className="mx-auto mb-3" />
                  Sin reclamos registrados.
                </div>
              ) : (
                <div className="space-y-3">
                  {claims.map((c) => (
                    <div key={c.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="font-black text-amber-100">{c.issue_title}</div>
                      <div className="mt-1 text-xs text-slate-500">{c.ai_classification}</div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <InfoRow label="Ticket" value={c.ticket_code || "Pendiente"} />
                        <InfoRow label="Estado" value={c.ticket_status || c.status || "recibido"} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setOpenClaim(true)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-3 text-sm font-black uppercase text-slate-950">
                <AlertTriangle size={16} /> Nuevo reclamo
              </button>
            </SideCard>

            <SideCard title="Garantía digital" icon={<ShieldCheck className="text-emerald-200" />}>
              <InfoRow label="Código" value={summary?.warranty_code || "Pendiente"} />
              <InfoRow label="Estado" value={summary?.warranty_status || "activa"} />
              <InfoRow label="Vence" value={summary?.warranty_expires_at || "No definido"} />
            </SideCard>

            <SideCard title="Balance del proyecto" icon={<Wallet className="text-cyan-200" />}>
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-4 sm:rounded-3xl sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200 sm:tracking-[0.28em]">Pendiente actual</p>
                <p className="mt-2 break-words text-3xl font-black text-white sm:text-4xl">{currency(nextPayment.value || payment.balance)}</p>
                <p className="mt-1 text-sm font-bold text-slate-400">{nextPayment.label}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MiniMoney label="Total" value={currency(payment.total)} />
                <MiniMoney label="Aplicado" value={currency(payment.totalApplied)} />
                <MiniMoney label="Reservado" value={currency(payment.credit)} />
                <MiniMoney label="Balance" value={currency(payment.balance)} />
              </div>

              <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/60 p-3 sm:rounded-3xl sm:p-4">
                <PaymentStep label="Inicial 60%" done={payment.initialCovered} value={payment.initialCovered ? "Cubierto" : currency(payment.initialDue)} />
                <PaymentStep label="20% despacho" done={payment.deliveryCovered} value={payment.deliveryCovered ? "Cubierto" : currency(payment.deliveryDue)} />
                <PaymentStep label="Final instalación" done={payment.finalCovered} value={payment.finalCovered ? "Cubierto" : currency(payment.finalDue)} />
              </div>

              <a href="https://wa.me/18096905636" target="_blank" className="mt-4 block rounded-2xl bg-emerald-400 px-4 py-3 text-center text-sm font-black uppercase text-slate-950">
                Consultar balance
              </a>
            </SideCard>

            <SideCard title="Encuesta de satisfacción" icon={<Star className="text-amber-300" />}>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)}>
                    <Star size={26} className={n <= rating ? "fill-amber-300 text-amber-300" : "text-slate-600"} />
                  </button>
                ))}
              </div>
              <textarea value={surveyComment} onChange={(e) => setSurveyComment(e.target.value)} placeholder="Cuéntanos tu experiencia..." className="mt-4 h-24 w-full rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-300" />
              <button onClick={submitSurvey} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-3 text-sm font-black uppercase text-slate-950">
                <Send size={16} /> Enviar valoración
              </button>
            </SideCard>


          </div>
        </div>
      </section>
    </main>
  );
}

function HeroCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur sm:rounded-3xl sm:p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200 sm:text-xs sm:tracking-[0.25em]">{title}</p>
      <p className="mt-2 break-words text-lg font-black capitalize sm:text-2xl">{value}</p>
    </div>
  );
}

function TraceStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 sm:rounded-3xl sm:p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.22em]">{label}</p>
      <p className="mt-2 break-words text-xl font-black text-white sm:text-2xl">{value}</p>
    </div>
  );
}

function MiniMoney({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 sm:p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 sm:tracking-[0.22em]">{label}</p>
      <p className="mt-2 break-words text-base font-black text-white sm:text-lg">{value}</p>
    </div>
  );
}

function PaymentStep({ label, done, value }: { label: string; done: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-white">{label}</p>
        <p className="mt-1 text-xs font-bold text-slate-500">{value}</p>
      </div>
      <span className={["shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase", done ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-200" : "border-amber-300/40 bg-amber-300/15 text-amber-100"].join(" ")}>
        {done ? "OK" : "Pendiente"}
      </span>
    </div>
  );
}

function SideCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:rounded-[34px] sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        {icon}
        <h2 className="text-xl font-black sm:text-2xl">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 sm:p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.25em]">{label}</p>
      <p className="mt-1 break-words text-base font-black sm:text-lg">{value}</p>
    </div>
  );
}
