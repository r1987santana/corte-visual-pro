"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  CLIENT_LEGAL_DOCUMENT_TYPES,
  type ClientLegalDocumentType,
  getClientLegalDocumentFromRecord,
  normalizeClientDocumentType,
} from "@/lib/clientLegalDocument";

type AnyRow = any;

type Quote = {
  id: string;
  quote_no?: string | null;
  client_id?: string | null;
  measurement_id?: string | null;
  ai_design_request_id?: string | null;
  ai_request_id?: string | null;
  approved_render_url?: string | null;
  render_image_url?: string | null;
  client_name: string;
  client_phone?: string | null;
  client_email?: string | null;
  client_address?: string | null;
  client_document?: string | null;
  project_name?: string | null;
  project_type?: string | null;
  material_preference?: string | null;
  color_preference?: string | null;
  hardware_preference?: string | null;
  total_price?: number | null;
  amount_paid?: number | null;
  balance?: number | null;
  credit_applied?: number | null;
  net_total?: number | null;
  initial_60?: number | null;
  initial_due?: number | null;
  delivery_20?: number | null;
  final_20?: number | null;
  status?: string | null;
  created_at?: string | null;
};

type QuoteItem = {
  item_type?: string;
  code?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  margin_percent: number;
  unit_price: number;
  total_price: number;
};

type ApprovedClientRender = {
  requestId: string;
  renderId?: string | null;
  variant?: string | null;
  title?: string | null;
  url: string;
};

type FormState = {
  measurement_id: string;
  client_id: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  client_address: string;
  client_document: string;
  client_document_type: ClientLegalDocumentType;
  project_name: string;
  project_type: string;
  area_name: string;

  width_m: number;
  height_m: number;
  depth_m: number;
  length_m: number;
  linear_feet: number;
  square_meters: number;

  material_preference: string;
  color_preference: string;
  hardware_preference: string;
  lighting_preference: string;
  customer_requests: string;
  technical_notes: string;
  photos: any[];

  quote_mode: string;
  level: string;
  cost_per_foot: number;
  price_per_foot: number;
  cost_per_m2: number;
  price_per_m2: number;
  fixed_cost: number;
  fixed_price: number;

  tax_percent: number;
  amount_paid: number;
  credit_available: number;
  credit_applied: number;
  initial_60: number;
  initial_due: number;
  delivery_20: number;
  final_20: number;
  status: string;
  valid_until: string;
  payment_terms: string;
  delivery_time: string;
  warranty: string;
  observations: string;
};

const DEFAULT_ITEMS: QuoteItem[] = [];

const PROJECT_TYPES = [
  { value: "cocina", label: "Cocina" },
  { value: "closet", label: "Closet" },
  { value: "mueble_tv", label: "Mueble TV" },
  { value: "oficina", label: "Oficina" },
  { value: "bano", label: "Baño" },
  { value: "panel", label: "Panel decorativo" },
  { value: "general", label: "General" },
];

const LEVELS = [
  {
    key: "estandar",
    name: "Estándar",
    costPerFoot: 4300,
    pricePerFoot: 8100,
    costPerM2: 10500,
    pricePerM2: 18500,
    fixedCost: 45000,
    fixedPrice: 85000,
  },
  {
    key: "premium",
    name: "Premium",
    costPerFoot: 5500,
    pricePerFoot: 10500,
    costPerM2: 13000,
    pricePerM2: 23500,
    fixedCost: 65000,
    fixedPrice: 125000,
  },
  {
    key: "luxury",
    name: "Luxury",
    costPerFoot: 7500,
    pricePerFoot: 14500,
    costPerM2: 16500,
    pricePerM2: 31000,
    fixedCost: 95000,
    fixedPrice: 185000,
  },
];

function money(value: any) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function n(value: any) {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

function approvedStatus(value: any) {
  return String(value || "").toLowerCase().includes("aprob");
}

function isClientApprovedQuote(quote?: Quote | null) {
  const status = String(quote?.status || "").toLowerCase();
  return status.includes("aprobada_cliente") || status.includes("aprobado_cliente") || status.includes("autorizada_cliente");
}

function quoteStatusLabel(status?: string | null) {
  const value = String(status || "").toLowerCase();
  if (value.includes("aprobada_cliente") || value.includes("autorizada_cliente")) return "Autorizada por portal";
  if (value.includes("render")) return "En render IA";
  if (value.includes("enviada")) return "Enviada";
  if (value.includes("rechazada")) return "Rechazada";
  return status || "Borrador";
}

function truthyDbFlag(value: any) {
  if (value === true) return true;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function isApprovedDesignRequest(request: AnyRow | null | undefined) {
  return Boolean(
    request?.approved_render_url ||
      truthyDbFlag(request?.client_approved) ||
      truthyDbFlag(request?.approved_render) ||
      approvedStatus(request?.status) ||
      approvedStatus(request?.ai_status)
  );
}

async function resolveApprovedRenderFromDesign(approvedDesign: any, fallbackUrl: string | null) {
  const requestId = approvedDesign?.quote?.ai_request_id || approvedDesign?.ai_request_id || approvedDesign?.ai_design_request_id || null;
  const fallback = fallbackUrl || "";

  if (!requestId) return fallback;

  const { data: request } = await supabase.from("ai_design_requests").select("*").eq("id", requestId).maybeSingle();
  if (!request) return fallback;

  const selectedRenderId = approvedDesign?.selected_render_id || request.selected_render_id;
  if (selectedRenderId) {
    const { data: selectedRender } = await supabase
      .from("ai_design_renders")
      .select("*")
      .eq("id", selectedRenderId)
      .maybeSingle();

    const selectedUrl = (selectedRender as AnyRow)?.render_image_url || (selectedRender as AnyRow)?.image_url || "";
    if (selectedUrl) return selectedUrl;
  }

  if (request.approved_render_url) return request.approved_render_url;

  const approvedVariant = String(
    approvedDesign?.approved_variant_id ||
      approvedDesign?.approved_variant?.id ||
      request.approved_variant_id ||
      request.selected_variant_id ||
      ""
  )
    .trim()
    .toUpperCase();

  if (approvedVariant) {
    const { data: rows } = await supabase
      .from("ai_design_renders")
      .select("*")
      .eq("ai_design_request_id", requestId)
      .eq("variant", approvedVariant)
      .order("created_at", { ascending: false });

    if (rows?.length) {
      const approvedRow = (rows as AnyRow[]).find((row) => approvedStatus(row.status));
      const render = approvedRow || rows[0];
      const url = render.render_image_url || render.image_url || "";
      if (url) return url;
    }
  }

  return fallback || request.render_image_url || "";
}

async function resolveApprovedClientRender(input: {
  quote?: AnyRow | null;
  measurement?: AnyRow | null;
  measurementId?: string | null;
}): Promise<ApprovedClientRender | null> {
  const quote = input.quote || null;
  const measurement = input.measurement || null;
  const measurementId = input.measurementId || quote?.measurement_id || measurement?.id || null;
  let requestId =
    quote?.ai_design_request_id ||
    quote?.ai_request_id ||
    measurement?.ai_design_request_id ||
    null;

  let request: AnyRow | null = null;

  if (requestId) {
    const { data } = await supabase.from("ai_design_requests").select("*").eq("id", requestId).maybeSingle();
    request = data || null;
  }

  if (!request && measurementId) {
    const { data } = await supabase
      .from("ai_design_requests")
      .select("*")
      .eq("measurement_id", measurementId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    request = data || null;
    requestId = request?.id || requestId;
  }

  if (!request && quote?.id) {
    const { data } = await supabase
      .from("ai_design_requests")
      .select("*")
      .eq("quote_id", quote.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    request = data || null;
    requestId = request?.id || requestId;
  }

  if (!request || !isApprovedDesignRequest(request)) return null;

  let render: AnyRow | null = null;
  const renderId = request.selected_render_id || request.approved_variant_id || request.selected_variant_id || null;

  if (renderId) {
    const { data } = await supabase.from("ai_design_renders").select("*").eq("id", renderId).maybeSingle();
    render = data || null;
  }

  if (!render && request.id) {
    const { data } = await supabase
      .from("ai_design_renders")
      .select("*")
      .eq("ai_design_request_id", request.id)
      .order("updated_at", { ascending: false });
    render = ((data || []) as AnyRow[]).find((row) => approvedStatus(row.status)) || null;
  }

  const url =
    render?.render_image_url ||
    render?.image_url ||
    request.approved_render_url ||
    request.render_image_url ||
    quote?.approved_render_url ||
    quote?.render_image_url ||
    measurement?.approved_render_url ||
    "";

  if (!url || !request.id) return null;

  return {
    requestId: request.id,
    renderId: render?.id || request.selected_render_id || null,
    variant: render?.variant || null,
    title: render?.title || null,
    url,
  };
}

function quoteModeByProjectType(projectType: string) {
  if (projectType === "cocina") return "pie_lineal";
  if (projectType === "closet" || projectType === "panel" || projectType === "oficina") return "m2";
  if (projectType === "mueble_tv" || projectType === "bano") return "precio_fijo";
  return "pie_lineal";
}

function modeLabel(mode: string) {
  if (mode === "pie_lineal") return "Pie lineal";
  if (mode === "m2") return "Metro cuadrado";
  if (mode === "precio_fijo") return "Precio fijo";
  return mode;
}

function projectLabel(type: string) {
  return PROJECT_TYPES.find((x) => x.value === type)?.label || type || "Proyecto";
}

function measurementCode(row: AnyRow) {
  return row?.code || row?.measurement_no || row?.id || "LEV";
}

function measurementLightingPreference(row: AnyRow) {
  const real = row?.real_space_json || {};
  return [real.lighting_preference, real.electrical_notes].filter(Boolean).join(" · ");
}

function measurementTitle(row: AnyRow) {
  return `${measurementCode(row)} · ${row?.client_name || "Cliente"} · ${row?.project_name || "Levantamiento"}`;
}

function whatsappLink(phone?: string | null, quoteNo?: string | null, total?: number | null) {
  const clean = String(phone || "").replace(/\D/g, "");
  if (!clean) return "#";
  const finalPhone = clean.startsWith("1") ? clean : `1${clean}`;
  const msg = `Hola, le compartimos su cotización ${quoteNo || ""} de RD Wood System por ${money(total || 0)}. Quedamos atentos a su aprobación.`;
  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
}

function defaultForm(): FormState {
  return {
    measurement_id: "",
    client_id: "",
    client_name: "",
    client_phone: "",
    client_email: "",
    client_address: "",
    client_document: "",
    client_document_type: "cedula",
    project_name: "Proyecto modular",
    project_type: "cocina",
    area_name: "",

    width_m: 0,
    height_m: 0,
    depth_m: 0,
    length_m: 0,
    linear_feet: 0,
    square_meters: 0,

    material_preference: "",
    color_preference: "",
    hardware_preference: "",
    lighting_preference: "",
    customer_requests: "",
    technical_notes: "",
    photos: [],

    quote_mode: "pie_lineal",
    level: "estandar",
    cost_per_foot: 4300,
    price_per_foot: 8100,
    cost_per_m2: 10500,
    price_per_m2: 18500,
    fixed_cost: 45000,
    fixed_price: 85000,

    tax_percent: 18,
    amount_paid: 0,
    credit_available: 0,
    credit_applied: 0,
    initial_60: 0,
    initial_due: 0,
    delivery_20: 0,
    final_20: 0,
    status: "borrador",
    valid_until: "",
    payment_terms: "60% inicial completo para iniciar producción / 20% antes de transportar módulos / 20% contra entrega final. El abono de medición y render se reserva para descontarse del 20% final.",
    delivery_time: "15 a 25 días laborables luego de aprobación, render y pago inicial.",
    warranty: "Garantía limitada de 12 meses sobre fabricación e instalación.",
    observations: "Precios sujetos a aprobación final del render, validación de materiales y disponibilidad.",
  };
}

export default function CotizadorAutomaticoClient() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [measurements, setMeasurements] = useState<AnyRow[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [selectedMeasurement, setSelectedMeasurement] = useState<AnyRow | null>(null);
  const [approvedClientRender, setApprovedClientRender] = useState<ApprovedClientRender | null>(null);
  const [items, setItems] = useState<QuoteItem[]>(DEFAULT_ITEMS);
  const [form, setForm] = useState<FormState>(defaultForm());

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [quoteSearch, setQuoteSearch] = useState("");
  const [measurementSearch, setMeasurementSearch] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedQuote?.id) return;

    const refresh = () => {
      refreshSelectedQuote(selectedQuote.id);
    };
    const interval = window.setInterval(refresh, 8000);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuote?.id]);

  const selectedLevel = useMemo(() => {
    return LEVELS.find((x) => x.key === form.level) || LEVELS[0];
  }, [form.level]);

  const baseItem: QuoteItem | null = useMemo(() => {
    const projectType = form.project_type || "general";
    const label = projectLabel(projectType);
    const levelName = selectedLevel.name;

    if (form.quote_mode === "pie_lineal") {
      const qty = n(form.linear_feet);
      if (qty <= 0) return null;
      return {
        item_type: "base_pie_lineal",
        code: "BASE-PL",
        description: `${label} ${levelName} por pie lineal · ${form.material_preference || "Material definido en levantamiento"}`,
        quantity: qty,
        unit: "pie lineal",
        unit_cost: n(form.cost_per_foot),
        total_cost: qty * n(form.cost_per_foot),
        margin_percent: n(form.cost_per_foot) > 0 ? ((n(form.price_per_foot) - n(form.cost_per_foot)) / n(form.cost_per_foot)) * 100 : 0,
        unit_price: n(form.price_per_foot),
        total_price: qty * n(form.price_per_foot),
      };
    }

    if (form.quote_mode === "m2") {
      const qty = n(form.square_meters);
      if (qty <= 0) return null;
      return {
        item_type: "base_m2",
        code: "BASE-M2",
        description: `${label} ${levelName} por m² · ${form.material_preference || "Material definido en levantamiento"}`,
        quantity: qty,
        unit: "m²",
        unit_cost: n(form.cost_per_m2),
        total_cost: qty * n(form.cost_per_m2),
        margin_percent: n(form.cost_per_m2) > 0 ? ((n(form.price_per_m2) - n(form.cost_per_m2)) / n(form.cost_per_m2)) * 100 : 0,
        unit_price: n(form.price_per_m2),
        total_price: qty * n(form.price_per_m2),
      };
    }

    if (form.quote_mode === "precio_fijo") {
      return {
        item_type: "base_precio_fijo",
        code: "BASE-FIJO",
        description: `${label} ${levelName} precio global · ${form.material_preference || "Material definido en levantamiento"}`,
        quantity: 1,
        unit: "proyecto",
        unit_cost: n(form.fixed_cost),
        total_cost: n(form.fixed_cost),
        margin_percent: n(form.fixed_cost) > 0 ? ((n(form.fixed_price) - n(form.fixed_cost)) / n(form.fixed_cost)) * 100 : 0,
        unit_price: n(form.fixed_price),
        total_price: n(form.fixed_price),
      };
    }

    return null;
  }, [form, selectedLevel]);

  const visibleItems = useMemo(() => {
    return baseItem ? [baseItem, ...items] : items;
  }, [baseItem, items]);

  const totals = useMemo(() => {
    const totalCost = visibleItems.reduce((sum, item) => sum + n(item.total_cost || n(item.quantity) * n(item.unit_cost)), 0);
    const saleBeforeTax = visibleItems.reduce((sum, item) => sum + n(item.total_price || n(item.quantity) * n(item.unit_price)), 0);
    const utilityAmount = saleBeforeTax - totalCost;
    const marginPercent = totalCost > 0 ? (utilityAmount / totalCost) * 100 : 0;
    const taxAmount = saleBeforeTax * (n(form.tax_percent) / 100);
    const totalPrice = saleBeforeTax + taxAmount;
    const initial60 = totalPrice * 0.60;
    const delivery20 = totalPrice * 0.20;
    const final20 = totalPrice * 0.20;
    const creditApplied = Math.min(n(form.credit_available), final20);
    const initialDue = initial60;
    const balance = totalPrice - creditApplied - n(form.amount_paid);

    return {
      totalCost,
      saleBeforeTax,
      utilityAmount,
      marginPercent,
      taxAmount,
      totalPrice,
      initial60,
      delivery20,
      final20,
      creditApplied,
      initialDue,
      balance,
    };
  }, [visibleItems, form.tax_percent, form.amount_paid]);

  const selectedQuoteApproved = useMemo(() => isClientApprovedQuote(selectedQuote), [selectedQuote]);

  const filteredMeasurements = useMemo(() => {
    const q = measurementSearch.trim().toLowerCase();
    return measurements.filter((m) => {
      const status = String(m.status || m.estado || "").toLowerCase();
      const notConverted = !String(status).includes("cotizado_final") && !String(status).includes("convertido");
      const text = `${m.client_name || ""} ${m.project_name || ""} ${m.project_type || ""} ${m.code || ""}`.toLowerCase();
      return notConverted && (!q || text.includes(q));
    });
  }, [measurements, measurementSearch]);

  const filteredQuotes = useMemo(() => {
    const q = quoteSearch.trim().toLowerCase();
    return quotes.filter((quote) => {
      const text = `${quote.quote_no || ""} ${quote.client_name || ""} ${quote.project_name || ""} ${quote.status || ""}`.toLowerCase();
      return !q || text.includes(q);
    });
  }, [quotes, quoteSearch]);

  async function loadAll() {
    setLoading(true);

    const [quoteRes, measurementRes] = await Promise.all([
      supabase.from("quotes").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("field_measurements").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);

    if (quoteRes.error) alert("Cotizaciones: " + quoteRes.error.message);
    if (measurementRes.error) alert("Levantamientos: " + measurementRes.error.message);

    const nextQuotes = (quoteRes.data || []) as Quote[];
    setQuotes(nextQuotes);
    setMeasurements(measurementRes.data || []);
    if (selectedQuote?.id) {
      const freshSelected = nextQuotes.find((quote) => quote.id === selectedQuote.id);
      if (freshSelected) {
        setSelectedQuote(freshSelected);
        setForm((prev) => ({
          ...prev,
          status: freshSelected.status || prev.status,
        }));
      }
    }
    setLoading(false);
  }

  async function refreshSelectedQuote(quoteId: string) {
    const { data, error } = await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle();
    if (error || !data) return;

    const freshQuote = data as Quote;
    setQuotes((current) => current.map((quote) => (quote.id === quoteId ? freshQuote : quote)));
    setSelectedQuote(freshQuote);
    setForm((prev) => ({
      ...prev,
      status: freshQuote.status || prev.status,
    }));
  }

  function newQuote() {
    setSelectedQuote(null);
    setSelectedMeasurement(null);
    setApprovedClientRender(null);
    setItems(DEFAULT_ITEMS);
    setForm(defaultForm());
  }

  async function loadClientCredit(clientId: string) {
    if (!clientId) return 0;

    const { data, error } = await supabase
      .from("client_credits")
      .select("remaining_amount")
      .eq("client_id", clientId)
      .eq("status", "disponible");

    if (error) {
      console.error("Error cargando crédito:", error.message);
      return 0;
    }

    return (data || []).reduce((sum: number, row: any) => sum + Number(row.remaining_amount || 0), 0);
  }

  function applyLevel(levelKey: string) {
    const level = LEVELS.find((x) => x.key === levelKey) || LEVELS[0];
    setForm((prev) => ({
      ...prev,
      level: level.key,
      cost_per_foot: level.costPerFoot,
      price_per_foot: level.pricePerFoot,
      cost_per_m2: level.costPerM2,
      price_per_m2: level.pricePerM2,
      fixed_cost: level.fixedCost,
      fixed_price: level.fixedPrice,
    }));
  }

  async function loadMeasurement(measurement: AnyRow) {
    setSelectedMeasurement(measurement);
    setApprovedClientRender(null);

    let clientEmail = "";
    let clientPhone = measurement.client_phone || "";
    let clientAddress = measurement.client_address || "";
    let clientDocument = "";
    let clientDocumentType: ClientLegalDocumentType = "cedula";
    let creditAvailable = 0;

    if (measurement.client_id) {
      const [{ data: clientData }, credit] = await Promise.all([
        supabase.from("clients").select("*").eq("id", measurement.client_id).maybeSingle(),
        loadClientCredit(measurement.client_id),
      ]);

      clientEmail = clientData?.email || "";
      clientPhone = clientData?.phone || clientData?.telefono || clientData?.whatsapp || clientPhone;
      clientAddress = clientData?.address || clientData?.direccion || clientAddress;
      const legalDocument = getClientLegalDocumentFromRecord(clientData);
      clientDocument = legalDocument?.number || "";
      clientDocumentType = legalDocument?.type || "cedula";
      creditAvailable = credit;
    }

    const projectType = measurement.project_type || "cocina";
    const quoteMode = quoteModeByProjectType(projectType);
    const photos = Array.isArray(measurement.photos)
      ? measurement.photos
      : Array.isArray(measurement.photo_urls)
      ? measurement.photo_urls
      : [];

    setForm((prev) => ({
      ...prev,
      measurement_id: measurement.id,
      client_id: measurement.client_id || "",
      client_name: measurement.client_name || "",
      client_phone: clientPhone,
      client_email: clientEmail,
      client_address: clientAddress,
      client_document: clientDocument,
      client_document_type: clientDocumentType,
      project_name: measurement.project_name || "Proyecto desde levantamiento",
      project_type: projectType,
      area_name: measurement.area_name || "",

      width_m: n(measurement.width_m),
      height_m: n(measurement.height_m),
      depth_m: n(measurement.depth_m),
      length_m: n(measurement.length_m),
      linear_feet: n(measurement.linear_feet),
      square_meters: n(measurement.square_meters),

      material_preference: measurement.material_preference || "",
      color_preference: measurement.color_preference || "",
      hardware_preference: measurement.hardware_preference || "",
      lighting_preference: measurementLightingPreference(measurement),
      customer_requests: measurement.customer_requests || "",
      technical_notes: measurement.technical_notes || "",
      photos,
      credit_available: creditAvailable,

      quote_mode: quoteMode,
      observations: [
        `Cotización generada desde levantamiento ${measurement.code || measurement.measurement_no || ""}.`,
        measurement.customer_requests ? `Solicitud cliente: ${measurement.customer_requests}` : "",
        measurement.technical_notes ? `Notas técnicas: ${measurement.technical_notes}` : "",
      ].filter(Boolean).join("\n"),
    }));

    const approvedRender = await resolveApprovedClientRender({ measurement, measurementId: measurement.id });
    setApprovedClientRender(approvedRender);
  }

  async function openQuote(quote: Quote) {
    setSelectedQuote(quote);
    setApprovedClientRender(null);

    const { data: itemData } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("created_at", { ascending: true });

    const dbItems = (itemData || []) as QuoteItem[];
    const base = dbItems.find((x) => String(x.item_type || "").startsWith("base_"));
    const manual = dbItems.filter((x) => !String(x.item_type || "").startsWith("base_"));

    let measurement: AnyRow | null = null;

    if (quote.measurement_id) {
      const { data } = await supabase
        .from("field_measurements")
        .select("*")
        .eq("id", quote.measurement_id)
        .maybeSingle();

      measurement = data || null;
      setSelectedMeasurement(measurement);
    } else {
      setSelectedMeasurement(null);
    }

    setItems(manual);
    setForm((prev) => ({
      ...prev,
      measurement_id: quote.measurement_id || "",
      client_id: quote.client_id || "",
      client_name: quote.client_name || "",
      client_phone: quote.client_phone || "",
      client_email: quote.client_email || "",
      client_address: quote.client_address || "",
      client_document: quote.client_document || "",
      client_document_type: "cedula",
      project_name: quote.project_name || "",
      project_type: quote.project_type || "cocina",
      material_preference: quote.material_preference || measurement?.material_preference || "",
      color_preference: quote.color_preference || measurement?.color_preference || "",
      hardware_preference: quote.hardware_preference || measurement?.hardware_preference || "",
      lighting_preference: measurementLightingPreference(measurement),
      quote_mode: base?.item_type === "base_m2" ? "m2" : base?.item_type === "base_precio_fijo" ? "precio_fijo" : "pie_lineal",
      linear_feet: base?.unit === "pie lineal" ? n(base.quantity) : n(measurement?.linear_feet),
      square_meters: base?.unit === "m²" ? n(base.quantity) : n(measurement?.square_meters),
      cost_per_foot: base?.unit === "pie lineal" ? n(base.unit_cost) : prev.cost_per_foot,
      price_per_foot: base?.unit === "pie lineal" ? n(base.unit_price) : prev.price_per_foot,
      cost_per_m2: base?.unit === "m²" ? n(base.unit_cost) : prev.cost_per_m2,
      price_per_m2: base?.unit === "m²" ? n(base.unit_price) : prev.price_per_m2,
      fixed_cost: base?.unit === "proyecto" ? n(base.unit_cost) : prev.fixed_cost,
      fixed_price: base?.unit === "proyecto" ? n(base.unit_price) : prev.fixed_price,
      amount_paid: n(quote.amount_paid),
      credit_applied: n(quote.credit_applied),
      initial_60: n(quote.initial_60),
      initial_due: n(quote.initial_due),
      delivery_20: n(quote.delivery_20),
      final_20: n(quote.final_20),
      status: quote.status || "borrador",
      photos: Array.isArray(measurement?.photos) ? measurement.photos : [],
    }));

    const approvedRender = await resolveApprovedClientRender({ quote, measurement, measurementId: quote.measurement_id });
    setApprovedClientRender(approvedRender);
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        item_type: "extra",
        code: "EXT",
        description: "Extra / accesorio",
        quantity: 1,
        unit: "und",
        unit_cost: 0,
        total_cost: 0,
        margin_percent: 0,
        unit_price: 0,
        total_price: 0,
      },
    ]);
  }

  function updateItem(index: number, field: keyof QuoteItem, value: any) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const numericFields = ["quantity", "unit_cost", "margin_percent", "unit_price", "total_cost", "total_price"];
        const next: QuoteItem = {
          ...item,
          [field]: numericFields.includes(String(field)) ? n(value) : value,
        } as QuoteItem;

        const quantity = n(next.quantity);
        const unitCost = n(next.unit_cost);
        const unitPrice = n(next.unit_price);

        return {
          ...next,
          total_cost: quantity * unitCost,
          total_price: quantity * unitPrice,
          margin_percent: unitCost > 0 ? ((unitPrice - unitCost) / unitCost) * 100 : 0,
        };
      })
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveQuote() {
    if (!form.client_name.trim()) {
      alert("El cliente es obligatorio.");
      return;
    }

    if (!form.project_name.trim()) {
      alert("El proyecto es obligatorio.");
      return;
    }

    if (!baseItem) {
      alert("No hay base de cálculo. Verifica pies lineales, m² o precio fijo.");
      return;
    }

    setSaving(true);

    try {
      let quoteId = selectedQuote?.id;
      let quoteRow: Quote | null = selectedQuote;

      const payload = {
        measurement_id: form.measurement_id || null,
        ai_design_request_id: approvedClientRender?.requestId || selectedQuote?.ai_design_request_id || null,
        client_id: form.client_id || null,
        client_name: form.client_name,
        client_phone: form.client_phone || null,
        client_email: form.client_email || null,
        client_address: form.client_address || null,
        client_document: form.client_document.trim().toUpperCase() || null,
        project_name: form.project_name,
        project_type: form.project_type,
        area_name: form.area_name || null,

        quote_mode: form.quote_mode,
        level: form.level,
        material_preference: form.material_preference || null,
        color_preference: form.color_preference || null,
        hardware_preference: form.hardware_preference || null,

        width_m: form.width_m,
        height_m: form.height_m,
        depth_m: form.depth_m,
        length_m: form.length_m,
        linear_feet: form.linear_feet,
        square_meters: form.square_meters,

        subtotal: totals.saleBeforeTax,
        total_cost: totals.totalCost,
        margin_percent: totals.marginPercent,
        utility_amount: totals.utilityAmount,
        tax_percent: n(form.tax_percent),
        tax_amount: totals.taxAmount,
        total_price: totals.totalPrice,
        amount_paid: n(form.amount_paid),
        credit_applied: totals.creditApplied,
        net_total: totals.totalPrice - totals.creditApplied,
        initial_60: totals.initial60,
        initial_due: totals.initialDue,
        delivery_20: totals.delivery20,
        final_20: totals.final20,
        balance: totals.balance,
        status: form.status,
        valid_until: form.valid_until || null,
        observations: form.observations || null,
        updated_at: new Date().toISOString(),
      };

      if (!quoteId) {
        const quoteNo = `COT-${Date.now().toString().slice(-10)}`;
        const { data, error } = await supabase
          .from("quotes")
          .insert({
            quote_no: quoteNo,
            ...payload,
            created_at: new Date().toISOString(),
          })
          .select("*")
          .single();

        if (error) throw error;
        quoteId = data.id;
        quoteRow = data as Quote;
        setSelectedQuote(quoteRow);
      } else {
        const { data, error } = await supabase
          .from("quotes")
          .update(payload)
          .eq("id", quoteId)
          .select("*")
          .single();

        if (error) throw error;
        quoteRow = data as Quote;
        setSelectedQuote(quoteRow);
      }

      await supabase.from("quote_items").delete().eq("quote_id", quoteId);

      if (visibleItems.length) {
        const { error: itemsError } = await supabase
          .from("quote_items")
          .insert(
            visibleItems.map((item) => ({
              quote_id: quoteId,
              ...item,
              created_at: new Date().toISOString(),
            }))
          );

        if (itemsError) throw itemsError;
      }

      await supabase.from("quote_terms").delete().eq("quote_id", quoteId);
      await supabase.from("quote_terms").insert({
        quote_id: quoteId,
        payment_terms: form.payment_terms,
        delivery_time: form.delivery_time,
        warranty: form.warranty,
        observations: form.observations,
        created_at: new Date().toISOString(),
      });

      await supabase.rpc("apply_credit_and_generate_schedule", { p_quote_id: quoteId });

      if (approvedClientRender?.requestId) {
        await supabase
          .from("ai_design_requests")
          .update({
            quote_id: quoteId,
            status: "render_aprobado",
            ai_status: "render_aprobado",
            approved_render_url: approvedClientRender.url,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", approvedClientRender.requestId);
      }

      if (form.measurement_id) {
        await supabase
          .from("field_measurements")
          .update({
            status: approvedClientRender ? "render_aprobado" : "cotizado",
            estado: approvedClientRender ? "render_aprobado" : "cotizado",
            render_status: approvedClientRender ? "render_aprobado" : undefined,
            approved_render_url: approvedClientRender?.url || undefined,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", form.measurement_id);
      }

      await loadAll();
      alert("✅ Cotización guardada correctamente.");
    } catch (error: any) {
      alert(error?.message || "Error guardando cotización.");
    } finally {
      setSaving(false);
    }
  }

  async function approveQuote() {
    if (!selectedQuote?.id) {
      alert("Primero guarda la cotización.");
      return;
    }

    if (!form.client_document.trim()) {
      alert("Registra la cedula, pasaporte o RNC del cliente antes de generar el contrato.");
      return;
    }

    if (!confirm("¿Confirmas que el cliente aprueba esta cotización y deseas generar el contrato?")) {
      return;
    }

    setSaving(true);

    try {
      const now = new Date().toISOString();

      const { data: updatedQuote, error: quoteError } = await supabase
        .from("quotes")
        .update({
          status: "aprobada_cliente",
          approved_at: now,
          updated_at: now,
        })
        .eq("id", selectedQuote.id)
        .select("*")
        .single();

      if (quoteError) throw quoteError;

      if (form.measurement_id) {
        await supabase
          .from("field_measurements")
          .update({
            status: "cotizacion_aprobada",
            estado: "cotizacion_aprobada",
            updated_at: now,
          })
          .eq("id", form.measurement_id);
      }

      let approvedDesign: any = null;
      try {
        const raw = localStorage.getItem("rdwood_ia_design_approved");
        approvedDesign = raw ? JSON.parse(raw) : null;
      } catch {
        approvedDesign = null;
      }

      const approvedModules =
        Array.isArray(approvedDesign?.modules) && approvedDesign.modules.length
          ? approvedDesign.modules
          : visibleItems;
      const enrichedApprovedModules = approvedModules.map((module: any) => ({
        ...module,
        material: module.material || form.material_preference || null,
        color: module.color || form.color_preference || null,
        hardware: module.hardware || form.hardware_preference || null,
        lights: module.lights || form.lighting_preference || null,
      }));

      const approvedRenderFallback =
        approvedClientRender?.url ||
        approvedDesign?.approved_render_url ||
        approvedDesign?.render_image_url ||
        (updatedQuote as any)?.render_image_url ||
        null;
      const approvedRenderUrl = await resolveApprovedRenderFromDesign(approvedDesign, approvedRenderFallback);
      const resolvedApprovedRenderUrl = approvedRenderUrl || approvedClientRender?.url || "";
      const approvedRequestId =
        approvedClientRender?.requestId ||
        approvedDesign?.quote?.ai_request_id ||
        approvedDesign?.ai_request_id ||
        approvedDesign?.ai_design_request_id ||
        null;

      const contractCode = `CON-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-5)}`;

      const contractPayload = {
        quote_id: selectedQuote.id,
        ai_design_request_id: approvedRequestId,
        client_id: form.client_id || (updatedQuote as any)?.client_id || null,
        client_name: form.client_name || (updatedQuote as any)?.client_name || null,
        client_phone: form.client_phone || (updatedQuote as any)?.client_phone || null,
        client_email: form.client_email || (updatedQuote as any)?.client_email || null,
        client_address: form.client_address || (updatedQuote as any)?.client_address || null,
        project_name: form.project_name || (updatedQuote as any)?.project_name || null,
        project_type: form.project_type || (updatedQuote as any)?.project_type || null,
        approved_render_url: resolvedApprovedRenderUrl,
        approved_render_notes: approvedDesign?.approved_variant_name
          ? `Render aprobado: ${approvedDesign.approved_variant_name}`
          : "Render aprobado por el cliente antes de cotización final.",
        approved_measurements: {
          width_m: form.width_m,
          height_m: form.height_m,
          depth_m: form.depth_m,
          length_m: form.length_m,
          linear_feet: form.linear_feet,
          square_meters: form.square_meters,
          measurement_id: form.measurement_id || null,
        },
        approved_materials: {
          material: form.material_preference || null,
          color: form.color_preference || null,
          hardware: form.hardware_preference || null,
          lights: form.lighting_preference || null,
          client_document: form.client_document.trim().toUpperCase() || (updatedQuote as any)?.client_document || null,
          client_document_type: form.client_document_type || "cedula",
          level: form.level,
          quote_mode: form.quote_mode,
        },
        approved_modules: enrichedApprovedModules,
        total_amount: totals.totalPrice,
        credit_applied: totals.creditApplied,
        initial_60: totals.initial60,
        initial_due: totals.initialDue,
        delivery_20: totals.delivery20,
        final_20: totals.final20,
        payment_terms: form.payment_terms,
        change_policy:
          "Después de aprobado el render, medidas, distribución, materiales, colores y herrajes, cualquier cambio solicitado por el cliente genera costo adicional, posible variación de precio y extensión del tiempo de entrega.",
        client_protection:
          "RDSS SANTANA GROUP debe entregar el proyecto conforme al render, medidas, materiales, colores, herrajes y calidad aprobada.",
        company_protection:
          "El cliente acepta que retrasos por falta de acceso, cambios en obra, decisiones tardías, falta de pago o modificaciones posteriores pueden generar costos y tiempos adicionales.",
        warranty_terms: form.warranty,
        delivery_terms: form.delivery_time,
        status: "borrador",
        updated_at: now,
      };

      const { data: existingContract, error: existingError } = await supabase
        .from("project_contracts")
        .select("id")
        .eq("quote_id", selectedQuote.id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingContract?.id) {
        const { error: updateContractError } = await supabase
          .from("project_contracts")
          .update(contractPayload)
          .eq("id", existingContract.id);

        if (updateContractError) throw updateContractError;
      } else {
        const { error: insertContractError } = await supabase
          .from("project_contracts")
          .insert({
            contract_code: contractCode,
            ...contractPayload,
            created_at: now,
          });

        if (insertContractError) throw insertContractError;
      }

      alert("✅ Cotización aprobada y contrato generado correctamente.");
      window.location.href = `/contratos?quote_id=${selectedQuote.id}`;
    } catch (error: any) {
      alert(error?.message || "Error aprobando cotización y generando contrato.");
    } finally {
      setSaving(false);
    }
  }

  async function createAiRenderRequest() {
    if (!selectedQuote?.id) {
      alert("Primero guarda la cotización.");
      return;
    }

    const activeQuoteId = selectedQuote.id;

    setSaving(true);

    try {
      const promptLines = [
        "Generar render para " + projectLabel(form.project_type) + ".",
        "Cliente: " + form.client_name + ".",
        "Proyecto: " + form.project_name + ".",
        "Medidas: ancho " + form.width_m + "m, alto " + form.height_m + "m, profundidad " + form.depth_m + "m.",
        "Material: " + (form.material_preference || "No definido") + ".",
        "Color: " + (form.color_preference || "No definido") + ".",
        "Herrajes: " + (form.hardware_preference || "No definido") + ".",
        "Solicitud cliente: " + (form.customer_requests || "Sin solicitud adicional") + ".",
        "Notas técnicas: " + (form.technical_notes || "Sin notas técnicas") + ".",
      ];

      const { error } = await supabase.from("ai_design_requests").insert({
        quote_id: activeQuoteId,
        measurement_id: form.measurement_id || null,
        client_id: form.client_id || null,
        client_name: form.client_name,
        phone: form.client_phone || null,
        project_name: form.project_name,
        project_type: form.project_type,
        room_width: Math.round(n(form.width_m) * 1000),
        room_height: Math.round(n(form.height_m) * 1000),
        room_depth: Math.round(n(form.depth_m) * 1000),
        style: selectedLevel.name,
        color_palette: form.color_preference || null,
        material_preference: form.material_preference || null,
        hardware_preference: form.hardware_preference || null,
        budget: totals.totalPrice,
        ai_status: "pendiente_render",
        status: "pendiente_render",
        ai_prompt: promptLines.join("\n"),
        ai_response: "Solicitud creada automáticamente desde Cotizador Automático PRO Fase 28B.",
        suggested_materials: [form.material_preference, form.color_preference, form.hardware_preference].filter(Boolean),
        suggested_modules: visibleItems,
        photos: form.photos || [],
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      await supabase
        .from("quotes")
        .update({
          status: "en_render_ia",
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeQuoteId);

      if (form.measurement_id) {
        await supabase
          .from("field_measurements")
          .update({
            status: "en_render_ia",
            estado: "en_render_ia",
            updated_at: new Date().toISOString(),
          })
          .eq("id", form.measurement_id);
      }

      await loadAll();
      alert("✅ Solicitud de Render IA creada correctamente.");
      window.location.href = "/ia-diseno";
    } catch (error: any) {
      alert(error?.message || "Error creando solicitud IA.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuote(quote: Quote) {
    if (!confirm(`¿Eliminar ${quote.quote_no}?`)) return;

    const { error } = await supabase.from("quotes").delete().eq("id", quote.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (selectedQuote?.id === quote.id) {
      newQuote();
    }

    await loadAll();
  }

  function printQuote() {
    const quoteNo = selectedQuote?.quote_no || "BORRADOR";
    const rows = visibleItems
      .map(
        (item) =>
          `<tr><td>${item.code || ""}</td><td>${item.description}</td><td>${Number(item.quantity || 0).toFixed(2)}</td><td>${item.unit}</td><td>${money(item.unit_price)}</td><td>${money(item.total_price)}</td></tr>`
      )
      .join("");

    const photos = (form.photos || [])
      .slice(0, 4)
      .map((p: any) => `<img src="${p.url}" style="width:100%;height:120px;object-fit:cover;border-radius:12px;border:1px solid #ddd" />`)
      .join("");
    const approvedRenderBlock = approvedClientRender?.url
      ? `
          <section class="approved-render">
            <div class="label">Render aprobado por cliente</div>
            <div class="approved-title">${approvedClientRender.variant ? `Variante ${approvedClientRender.variant}` : "Render autorizado"}</div>
            <img src="${approvedClientRender.url}" alt="Render aprobado por cliente" />
            <p class="muted">Imagen autorizada por el cliente para cotizacion, contrato y produccion.</p>
          </section>
        `
      : "";

    const html = `
      <html>
        <head>
          <title>${quoteNo}</title>
          <style>
            @page{size:letter;margin:10mm}
            body{font-family:Arial;margin:0;color:#111;font-size:12px}
            .brand{letter-spacing:7px;color:#005c99;font-weight:900}
            h1{margin:6px 0 0;font-size:26px}
            h3{margin:12px 0 6px}
            .muted{color:#555}
            .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}
            .box{border:1px solid #111;border-radius:10px;padding:8px;break-inside:avoid;page-break-inside:avoid}
            .label{font-size:10px;color:#555;text-transform:uppercase;font-weight:900}
            .value{font-size:16px;font-weight:900}
            table{width:100%;border-collapse:collapse;margin-top:10px;font-size:11px;break-inside:avoid;page-break-inside:avoid}
            th{background:#07111f;color:white;text-align:left;padding:6px}
            td{border:1px solid #ddd;padding:6px}
            .totals-grid{break-inside:avoid;page-break-inside:avoid;grid-template-columns:repeat(4,minmax(0,1fr))}
            .totals-grid .value,.totals-grid .total{white-space:nowrap;font-size:17px}
            .total{font-size:22px;font-weight:900;color:#005c99}
            .sign{margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:70px;break-inside:avoid;page-break-inside:avoid}
            .line{border-top:1px solid #111;text-align:center;padding-top:8px}
            .photos{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:15px}
            .approved-render{border:2px solid #078a57;border-radius:12px;padding:8px;margin:10px 0 12px;break-inside:avoid;page-break-inside:avoid}
            .approved-render img{display:block;width:100%;max-height:250px;object-fit:contain;background:#050505;border-radius:10px;margin-top:6px}
            .approved-title{font-size:18px;font-weight:900;margin-top:4px;color:#078a57}
            .conditions{break-inside:avoid;page-break-inside:avoid}
            @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
          </style>
        </head>
        <body>
          <div class="brand">RD WOOD SYSTEM</div>
          <h1>COTIZACIÓN ${quoteNo}</h1>
          <p class="muted">Santana Group / RD Wood System · La Romana, República Dominicana</p>

          <div class="grid">
            <div class="box"><div class="label">Cliente</div><div class="value">${form.client_name}</div></div>
            <div class="box"><div class="label">Teléfono</div><div class="value">${form.client_phone}</div></div>
            <div class="box"><div class="label">Documento legal</div><div class="value">${form.client_document || "-"}</div></div>
            <div class="box"><div class="label">Proyecto</div><div class="value">${form.project_name}</div></div>
            <div class="box"><div class="label">Sistema de cálculo</div><div class="value">${modeLabel(form.quote_mode)}</div></div>
          </div>

          <div class="grid">
            <div class="box"><div class="label">Pies lineales</div><div class="value">${n(form.linear_feet).toFixed(2)}</div></div>
            <div class="box"><div class="label">Área m²</div><div class="value">${n(form.square_meters).toFixed(2)}</div></div>
            <div class="box"><div class="label">Material</div><div class="value">${form.material_preference || "-"}</div></div>
            <div class="box"><div class="label">Color</div><div class="value">${form.color_preference || "-"}</div></div>
          </div>

          ${approvedRenderBlock}

          <table>
            <thead>
              <tr><th>Código</th><th>Descripción</th><th>Cant.</th><th>Unidad</th><th>Precio Unit.</th><th>Total</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <div class="grid totals-grid">
            <div class="box"><div class="label">Subtotal</div><div class="value">${money(totals.saleBeforeTax)}</div></div>
            <div class="box"><div class="label">ITBIS</div><div class="value">${money(totals.taxAmount)}</div></div>
            <div class="box"><div class="label">Abono reservado final</div><div class="value">${money(totals.creditApplied)}</div></div>
            <div class="box"><div class="label">Precio Final</div><div class="total">${money(totals.totalPrice)}</div></div>
          </div>

          <h3>Plan de pagos 60/20/20</h3>
          <table>
            <thead><tr><th>Etapa</th><th>Porcentaje</th><th>Monto</th></tr></thead>
            <tbody>
              <tr><td>Inicial para producción completo</td><td>60%</td><td>${money(totals.initial60)}</td></tr>
              <tr><td>Antes de transportar módulos</td><td>20%</td><td>${money(totals.delivery20)}</td></tr>
              <tr><td>Entrega final e instalación</td><td>20%</td><td>${money(totals.final20)}</td></tr>
              <tr><td>Abono medición/render reservado para cierre</td><td>Crédito</td><td>${money(totals.creditApplied)}</td></tr>
            </tbody>
          </table>

          ${photos ? `<h3>Fotos del levantamiento</h3><div class="photos">${photos}</div>` : ""}

          <section class="conditions">
          <h3>Condiciones</h3>
          <p><b>Pago:</b> ${form.payment_terms}</p>
          <p><b>Entrega:</b> ${form.delivery_time}</p>
          <p><b>Garantía:</b> ${form.warranty}</p>
          <p><b>Observaciones:</b> ${form.observations}</p>
          </section>

          <div class="sign"><div class="line">Cliente</div><div class="line">RD Wood System</div></div>
          <script>setTimeout(() => window.print(), 600)</script>
        </body>
      </html>
    `;

    const win = window.open("", "_blank");
    if (!win) {
      alert("Permite popups para imprimir.");
      return;
    }

    win.document.write(html);
    win.document.close();
  }

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-6 text-white">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="rounded-[30px] border border-cyan-900/60 bg-gradient-to-br from-[#07111f] to-[#111b38] p-6 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-700 bg-cyan-500/10 px-3 py-1 text-xs font-black tracking-[0.25em] text-cyan-300">
                <Sparkles size={14} /> FASE 28 · RENDER APROBADO → COTIZACIÓN → CONTRATO
              </div>
              <h1 className="mt-4 text-4xl font-black lg:text-5xl">Cotizador Automático PRO</h1>
              <p className="mt-2 text-slate-300">
                Selecciona un levantamiento aprobado por render IA, calcula precio final, genera PDF y pasa a contrato.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={loadAll} disabled={loading} className="flex h-12 items-center gap-2 rounded-2xl bg-white px-5 font-black text-slate-950">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                Actualizar
              </button>

              <button onClick={newQuote} className="flex h-12 items-center gap-2 rounded-2xl bg-slate-700 px-5 font-black">
                <Plus size={18} />
                Nueva
              </button>

              <button onClick={saveQuote} disabled={saving} className="flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 font-black disabled:opacity-60">
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Guardar
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Kpi icon={<FileText />} label="Cotizaciones" value={quotes.length} />
          <Kpi icon={<Calculator />} label="Levantamientos" value={measurements.length} />
          <Kpi icon={<CircleDollarSign />} label="Costo" value={money(totals.totalCost)} />
          <Kpi icon={<CircleDollarSign />} label="Utilidad" value={money(totals.utilityAmount)} />
          <Kpi icon={<CircleDollarSign />} label="Precio Final" value={money(totals.totalPrice)} />
          <Kpi icon={<CheckCircle2 />} label="Balance" value={money(totals.balance)} />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-[30px] border border-cyan-900/50 bg-[#07111f] p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-black">Levantamientos</h2>
                <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-200">
                  {filteredMeasurements.length}
                </span>
              </div>

              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={measurementSearch}
                  onChange={(e) => setMeasurementSearch(e.target.value)}
                  placeholder="Buscar levantamiento..."
                  className="input pl-10"
                />
              </div>

              <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
                {filteredMeasurements.map((measurement) => (
                  <button
                    key={measurement.id}
                    onClick={() => loadMeasurement(measurement)}
                    className={`w-full rounded-2xl border p-3 text-left transition hover:border-cyan-400/50 ${
                      selectedMeasurement?.id === measurement.id ? "border-cyan-500 bg-cyan-500/10" : "border-slate-800 bg-[#030817]"
                    }`}
                  >
                    <div className="text-xs font-black text-cyan-300">{measurement.code || measurement.measurement_no}</div>
                    <div className="font-black">{measurement.client_name}</div>
                    <div className="text-xs text-slate-400">{measurement.project_name}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                      <span>{measurement.project_type}</span>
                      <span>{n(measurement.linear_feet).toFixed(2)} ft</span>
                      <span>{n(measurement.square_meters).toFixed(2)} m²</span>
                    </div>
                  </button>
                ))}

                {!filteredMeasurements.length && (
                  <div className="rounded-2xl border border-slate-800 bg-[#030817] p-5 text-center text-sm text-slate-500">
                    No hay levantamientos pendientes.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[30px] border border-cyan-900/50 bg-[#07111f] p-4 shadow-2xl">
              <h2 className="mb-3 text-xl font-black">Historial</h2>

              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input value={quoteSearch} onChange={(e) => setQuoteSearch(e.target.value)} placeholder="Buscar cotización..." className="input pl-10" />
              </div>

              <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
                {filteredQuotes.map((quote) => (
                  <div key={quote.id} className={`rounded-2xl border p-3 ${selectedQuote?.id === quote.id ? "border-cyan-500 bg-cyan-500/10" : "border-slate-800 bg-[#030817]"}`}>
                    <button onClick={() => openQuote(quote)} className="w-full text-left">
                      <div className="text-xs font-black text-cyan-300">{quote.quote_no}</div>
                      <div className="font-black">{quote.client_name}</div>
                      <div className="text-xs text-slate-400">{quote.project_name || "Proyecto"}</div>
                      <div className="mt-1 font-black text-emerald-300">{money(quote.total_price)}</div>
                      <div className={["mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em]", isClientApprovedQuote(quote) ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-slate-700 bg-slate-900/60 text-slate-500"].join(" ")}>
                        {quoteStatusLabel(quote.status)}
                      </div>
                    </button>

                    <button onClick={() => deleteQuote(quote)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 py-2 text-xs font-black text-red-200 hover:bg-red-500/20">
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="space-y-4">
            <div className="rounded-[30px] border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-black">Datos de cotización</h2>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-200">
                  {modeLabel(form.quote_mode)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Cliente">
                  <input className="input" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
                </Field>

                <Field label="Teléfono">
                  <input className="input" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} />
                </Field>

                <Field label="Email">
                  <input className="input" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} />
                </Field>

                <Field label="Tipo doc.">
                  <select
                    className="input"
                    value={form.client_document_type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        client_document_type: normalizeClientDocumentType(e.target.value),
                      })
                    }
                  >
                    {CLIENT_LEGAL_DOCUMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Cedula / Pasaporte / RNC">
                  <input
                    className="input"
                    value={form.client_document}
                    onChange={(e) => setForm({ ...form, client_document: e.target.value.toUpperCase() })}
                  />
                </Field>

                <Field label="Dirección">
                  <input className="input" value={form.client_address} onChange={(e) => setForm({ ...form, client_address: e.target.value })} />
                </Field>

                <Field label="Proyecto">
                  <input className="input" value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} />
                </Field>

                <Field label="Área">
                  <input className="input" value={form.area_name} onChange={(e) => setForm({ ...form, area_name: e.target.value })} />
                </Field>

                <Field label="Tipo">
                  <select
                    className="input"
                    value={form.project_type}
                    onChange={(e) => {
                      const projectType = e.target.value;
                      setForm({ ...form, project_type: projectType, quote_mode: quoteModeByProjectType(projectType) });
                    }}
                  >
                    {PROJECT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Sistema de cálculo">
                  <select className="input" value={form.quote_mode} onChange={(e) => setForm({ ...form, quote_mode: e.target.value })}>
                    <option value="pie_lineal">Pie lineal</option>
                    <option value="m2">Metro cuadrado</option>
                    <option value="precio_fijo">Precio fijo</option>
                  </select>
                </Field>

                <Field label="Nivel">
                  <select className="input" value={form.level} onChange={(e) => applyLevel(e.target.value)}>
                    {LEVELS.map((level) => (
                      <option key={level.key} value={level.key}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Pies lineales">
                  <input type="number" className="input" value={form.linear_feet} onChange={(e) => setForm({ ...form, linear_feet: n(e.target.value) })} />
                </Field>

                <Field label="Área m²">
                  <input type="number" className="input" value={form.square_meters} onChange={(e) => setForm({ ...form, square_meters: n(e.target.value) })} />
                </Field>

                <Field label="Válida hasta">
                  <input type="date" className="input" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
              <div className="rounded-[30px] border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
                <h2 className="mb-4 text-2xl font-black">Cálculo comercial</h2>

                {approvedClientRender && (
                  <div className="mb-5 overflow-hidden rounded-3xl border border-emerald-400/40 bg-emerald-400/10">
                    <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
                      <div className="h-36 w-full overflow-hidden rounded-2xl border border-white/10 bg-black md:w-56">
                        <img src={approvedClientRender.url} alt="Render aprobado por cliente" className="h-full w-full object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-200">Render aprobado por cliente</p>
                        <h3 className="mt-2 text-2xl font-black text-white">
                          {approvedClientRender.variant ? `Variante ${approvedClientRender.variant}` : "Render autorizado"}
                        </h3>
                        <p className="mt-2 text-sm font-semibold text-emerald-50">
                          Esta es la imagen que se usara para cotizacion, contrato y produccion.
                        </p>
                        <a href={approvedClientRender.url} target="_blank" className="mt-3 inline-flex rounded-2xl bg-emerald-400 px-4 py-2 text-xs font-black uppercase text-slate-950">
                          Ver render
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="Costo por pie">
                    <input type="number" className="input" value={form.cost_per_foot} onChange={(e) => setForm({ ...form, cost_per_foot: n(e.target.value) })} />
                  </Field>
                  <Field label="Precio por pie">
                    <input type="number" className="input" value={form.price_per_foot} onChange={(e) => setForm({ ...form, price_per_foot: n(e.target.value) })} />
                  </Field>
                  <Field label="Subtotal por pie">
                    <input className="input" readOnly value={money(n(form.linear_feet) * n(form.price_per_foot))} />
                  </Field>

                  <Field label="Costo por m²">
                    <input type="number" className="input" value={form.cost_per_m2} onChange={(e) => setForm({ ...form, cost_per_m2: n(e.target.value) })} />
                  </Field>
                  <Field label="Precio por m²">
                    <input type="number" className="input" value={form.price_per_m2} onChange={(e) => setForm({ ...form, price_per_m2: n(e.target.value) })} />
                  </Field>
                  <Field label="Subtotal m²">
                    <input className="input" readOnly value={money(n(form.square_meters) * n(form.price_per_m2))} />
                  </Field>

                  <Field label="Costo fijo">
                    <input type="number" className="input" value={form.fixed_cost} onChange={(e) => setForm({ ...form, fixed_cost: n(e.target.value) })} />
                  </Field>
                  <Field label="Precio fijo">
                    <input type="number" className="input" value={form.fixed_price} onChange={(e) => setForm({ ...form, fixed_price: n(e.target.value) })} />
                  </Field>
                  <Field label="ITBIS %">
                    <input type="number" className="input" value={form.tax_percent} onChange={(e) => setForm({ ...form, tax_percent: n(e.target.value) })} />
                  </Field>

                  <Field label="Abonado adicional">
                    <input type="number" className="input" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: n(e.target.value) })} />
                  </Field>

                  <Field label="Crédito disponible">
                    <input className="input" readOnly value={money(form.credit_available)} />
                  </Field>

                  <Field label="Estado">
                    <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="borrador">Borrador</option>
                      <option value="enviada">Enviada</option>
                      <option value="aprobada_cliente">Aprobada cliente</option>
                      <option value="en_render_ia">En Render IA</option>
                      <option value="rechazada">Rechazada</option>
                    </select>
                  </Field>

                  <Field label="Balance">
                    <input className="input" readOnly value={money(totals.balance)} />
                  </Field>
                </div>
              </div>

              <div className="rounded-[30px] border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
                <h2 className="mb-4 text-2xl font-black">Resumen</h2>

                <div className="space-y-3">
                  <Row label="Sistema" value={modeLabel(form.quote_mode)} />
                  <Row label="Costo total" value={money(totals.totalCost)} />
                  <Row label={`Utilidad ${totals.marginPercent.toFixed(1)}%`} value={money(totals.utilityAmount)} />
                  <Row label="Venta antes ITBIS" value={money(totals.saleBeforeTax)} />
                  <Row label={`ITBIS ${n(form.tax_percent)}%`} value={money(totals.taxAmount)} />

                  <div className="border-t border-slate-800 pt-3">
                    <Row label="Precio final" value={money(totals.totalPrice)} highlight />
                    <Row label="Abono reservado final" value={money(totals.creditApplied)} />
                    <Row label="Inicial 60%" value={money(totals.initial60)} />
                    <Row label="Inicial pendiente" value={money(totals.initialDue)} highlight />
                    <Row label="20% entrega módulos" value={money(totals.delivery20)} />
                    <Row label="20% entrega final" value={money(totals.final20)} />
                    <Row label="Abonado adicional" value={money(form.amount_paid)} />
                    <Row label="Balance" value={money(totals.balance)} highlight />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-2">
                  <button onClick={printQuote} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white font-black text-slate-950">
                    <Printer size={18} />
                    Imprimir PDF
                  </button>

                  {selectedQuote && (
                    <a href={whatsappLink(form.client_phone, selectedQuote.quote_no, totals.totalPrice)} target="_blank" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 font-black">
                      <MessageCircle size={18} />
                      WhatsApp
                    </a>
                  )}

                  {selectedQuoteApproved && (
                    <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-center text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
                      Autorizada por cliente en portal
                    </div>
                  )}

                  <button onClick={approveQuote} disabled={saving || !selectedQuote} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 font-black disabled:opacity-50">
                    <CheckCircle2 size={18} />
                    {selectedQuoteApproved ? "Generar contrato" : "Aprobar Cliente"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-black">Partidas</h2>
                <button onClick={addItem} className="flex h-10 items-center gap-2 rounded-2xl bg-cyan-600 px-4 font-black">
                  <Plus size={16} />
                  Agregar
                </button>
              </div>

              <div className="overflow-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-[#0a1627] text-slate-300">
                    <tr>
                      <th className="p-3 text-left">Código</th>
                      <th className="p-3 text-left">Descripción</th>
                      <th className="p-3 text-left">Cant.</th>
                      <th className="p-3 text-left">Unidad</th>
                      <th className="p-3 text-left">Costo Unit.</th>
                      <th className="p-3 text-left">Costo Total</th>
                      <th className="p-3 text-left">Precio Unit.</th>
                      <th className="p-3 text-left">Precio Total</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleItems.map((item, index) => {
                      const isBase = String(item.item_type || "").startsWith("base_");

                      return (
                        <tr key={`${item.item_type}-${index}`} className="border-t border-slate-800">
                          <td className="p-2">
                            <input className="input small" value={item.code || ""} readOnly={isBase} onChange={(e) => updateItem(index - (baseItem ? 1 : 0), "code", e.target.value)} />
                          </td>
                          <td className="p-2">
                            <input className="input small min-w-[320px]" value={item.description} readOnly={isBase} onChange={(e) => updateItem(index - (baseItem ? 1 : 0), "description", e.target.value)} />
                          </td>
                          <td className="p-2">
                            <input type="number" className="input small" value={item.quantity} readOnly={isBase} onChange={(e) => updateItem(index - (baseItem ? 1 : 0), "quantity", e.target.value)} />
                          </td>
                          <td className="p-2">
                            <input className="input small" value={item.unit} readOnly={isBase} onChange={(e) => updateItem(index - (baseItem ? 1 : 0), "unit", e.target.value)} />
                          </td>
                          <td className="p-2">
                            <input type="number" className="input small" value={item.unit_cost} readOnly={isBase} onChange={(e) => updateItem(index - (baseItem ? 1 : 0), "unit_cost", e.target.value)} />
                          </td>
                          <td className="p-2 font-black text-amber-300">{money(item.total_cost)}</td>
                          <td className="p-2 font-black text-cyan-300">{money(item.unit_price)}</td>
                          <td className="p-2 font-black text-emerald-300">{money(item.total_price)}</td>
                          <td className="p-2">
                            {!isBase && (
                              <button onClick={() => removeItem(index - (baseItem ? 1 : 0))} className="h-9 w-9 rounded-xl bg-red-500/20 text-red-200">
                                X
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
              <div className="rounded-[30px] border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
                <h2 className="mb-4 text-2xl font-black">Datos del levantamiento</h2>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <InfoCard label="Material" value={form.material_preference || "-"} />
                  <InfoCard label="Color" value={form.color_preference || "-"} />
                  <InfoCard label="Herrajes" value={form.hardware_preference || "-"} />
                  <InfoCard label="Luces" value={form.lighting_preference || "-"} />
                </div>

                <div className="mt-4 grid gap-3">
                  <Field label="Solicitud del cliente">
                    <textarea className="textarea" value={form.customer_requests} onChange={(e) => setForm({ ...form, customer_requests: e.target.value })} />
                  </Field>

                  <Field label="Notas técnicas">
                    <textarea className="textarea" value={form.technical_notes} onChange={(e) => setForm({ ...form, technical_notes: e.target.value })} />
                  </Field>
                </div>

                {form.photos?.length ? (
                  <div className="mt-4">
                    <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                      <ImageIcon size={16} />
                      Fotos
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      {form.photos.slice(0, 8).map((photo: any, index: number) => (
                        <a key={`${photo.url}-${index}`} href={photo.url} target="_blank" className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
                          <img src={photo.url} alt={photo.title || `Foto ${index + 1}`} className="h-28 w-full object-cover" />
                          <p className="truncate px-3 py-2 text-xs text-slate-400">{photo.title || `Foto ${index + 1}`}</p>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[30px] border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
                <h2 className="mb-4 text-2xl font-black">Condiciones comerciales</h2>

                <div className="space-y-3">
                  <Field label="Pago">
                    <textarea className="textarea" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
                  </Field>

                  <Field label="Entrega">
                    <textarea className="textarea" value={form.delivery_time} onChange={(e) => setForm({ ...form, delivery_time: e.target.value })} />
                  </Field>

                  <Field label="Garantía">
                    <textarea className="textarea" value={form.warranty} onChange={(e) => setForm({ ...form, warranty: e.target.value })} />
                  </Field>

                  <Field label="Observaciones">
                    <textarea className="textarea" value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
                  </Field>
                </div>
              </div>
            </div>
          </section>
        </section>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          height: 46px;
          border-radius: 14px;
          border: 1px solid #243247;
          background: #030817;
          padding: 0 14px;
          outline: none;
          color: white;
        }
        .input.small {
          height: 38px;
          border-radius: 12px;
          min-width: 90px;
        }
        .input:focus,
        .textarea:focus {
          border-color: #06b6d4;
        }
        .textarea {
          width: 100%;
          min-height: 75px;
          border-radius: 14px;
          border: 1px solid #243247;
          background: #030817;
          padding: 12px 14px;
          outline: none;
          color: white;
        }
      `}</style>
    </main>
  );
}

function Kpi({ icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-[#07111f] p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</div>
        <div className="rounded-2xl bg-cyan-500/10 p-2 text-cyan-300">{icon}</div>
      </div>
      <div className="mt-3 text-xl font-black">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label>
      <div className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</div>
      {children}
    </label>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={highlight ? "text-2xl font-black text-cyan-300" : "font-black"}>{value}</div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">{label}</div>
      <div className="mt-2 text-sm font-bold text-slate-200">{value}</div>
    </div>
  );
}
