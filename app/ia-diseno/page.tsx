"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/saas/auth-client";
import {
  clientPhoneFromQuote,
  openClientPortalWhatsApp,
  whatsappLinkForClient,
} from "@/lib/clientPortalWhatsApp";
import {
  enrichModuleMaterialRoles,
  type DesignMaterialRoles,
} from "@/lib/designMaterialRoles";
import { buildIADesignPrompt } from "@/lib/iaDesignPrompt";

type AnyRow = Record<string, any>;

type QuoteRow = {
  id: string;
  source?: "ai_design_request" | "field_measurement";
  ai_request_id?: string | null;
  measurement_id?: string | null;
  quote_id?: string | null;
  client_id?: string | null;
  code?: string | null;
  quote_number?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  project_name?: string | null;
  project_type?: string | null;
  width_mm?: number | null;
  depth_mm?: number | null;
  height_mm?: number | null;
  style?: string | null;
  color_palette?: string | null;
  notes?: string | null;
  presupuesto?: number | null;
  status?: string | null;
  created_at?: string | null;
  render_image_url?: string | null;
  approved_render_url?: string | null;
  material_preference?: string | null;
  hardware_preference?: string | null;
  customer_requests?: string | null;
  technical_notes?: string | null;
  photos?: AnyRow[];
  suggested_modules?: AnyRow[];
  ai_prompt?: string | null;
  approved_variant_id?: string | null;
  approved_variant_name?: string | null;
  selected_variant_id?: string | null;
  selected_render_id?: string | null;
};

type DesignModule = {
  id: string;
  name: string;
  type: string;
  quantity: number;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  material: string;
  color: string;
  edge: string;
  notes: string;
  material_roles?: DesignMaterialRoles;
};

type RenderVariant = {
  id: "A" | "B" | "C" | "D" | "E";
  name: string;
  concept: string;
  mood: string;
};

type VariantRenderState = Record<
  string,
  {
    status: "pendiente" | "generando" | "generado" | "aprobado" | "error";
    imageUrl: string;
    error?: string;
  }
>;

const VARIANTS: RenderVariant[] = [
  {
    id: "A",
    name: "Comercial premium",
    concept: "Diseño limpio, elegante y fácil de fabricar.",
    mood: "Moderno, balanceado, apto para aprobación rápida.",
  },
  {
    id: "B",
    name: "Luxury cálida",
    concept: "Madera, iluminación cálida y detalles premium.",
    mood: "Lujo residencial, acogedor y comercial.",
  },
  {
    id: "C",
    name: "Industrial moderna",
    concept: "Negro, madera y líneas rectas con carácter fuerte.",
    mood: "Moderno masculino, alto impacto visual.",
  },
  {
    id: "D",
    name: "Orgánica europea",
    concept: "Volúmenes suaves, colores balanceados y estética europea.",
    mood: "Minimalista, natural y sofisticado.",
  },
  {
    id: "E",
    name: "Italiana high-end",
    concept: "Diseño tipo showroom, proporciones premium y luces LED.",
    mood: "Alta gama, lujo moderno y presentación de venta.",
  },
];

const DEFAULT_RENDER_STATE: VariantRenderState = {
  A: { status: "pendiente", imageUrl: "" },
  B: { status: "pendiente", imageUrl: "" },
  C: { status: "pendiente", imageUrl: "" },
  D: { status: "pendiente", imageUrl: "" },
  E: { status: "pendiente", imageUrl: "" },
};

function defaultRenderState(): VariantRenderState {
  return {
    A: { status: "pendiente", imageUrl: "" },
    B: { status: "pendiente", imageUrl: "" },
    C: { status: "pendiente", imageUrl: "" },
    D: { status: "pendiente", imageUrl: "" },
    E: { status: "pendiente", imageUrl: "" },
  };
}

function clientPortalUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/portal-cliente/${token}`;
}

function money(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function n(value: any, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function uid(prefix = "mod") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

function normalizeQuote(row: AnyRow): QuoteRow {
  return {
    ...row,
    id: String(row.id),
    code: row.code ?? row.quote_number ?? row.numero ?? row.id,
    quote_number: row.quote_number ?? row.code ?? row.numero ?? row.id,
    client_name: row.client_name ?? row.cliente ?? row.customer_name ?? "Cliente general",
    client_phone: row.client_phone ?? row.telefono ?? row.phone ?? "",
    client_email: row.client_email ?? row.email ?? "",
    project_name: row.project_name ?? row.proyecto ?? row.project ?? "Proyecto IA",
    project_type: row.project_type ?? row.tipo_proyecto ?? row.tipo ?? "centro_tv",
    width_mm: n(row.width_mm ?? row.ancho_mm ?? row.room_width ?? row.ancho, 2000),
    depth_mm: n(row.depth_mm ?? row.profundidad_mm ?? row.room_depth ?? row.profundidad, 450),
    height_mm: n(row.height_mm ?? row.alto_mm ?? row.room_height ?? row.alto, 2200),
    style: row.style ?? row.estilo ?? "moderno",
    color_palette: row.color_palette ?? row.colores ?? "blanco / madera / negro",
    notes: row.notes ?? row.notas ?? "",
    presupuesto: Number(row.presupuesto ?? row.total ?? row.grand_total ?? 0),
    status: row.status ?? row.estado ?? "en_diseno_ia",
    created_at: row.created_at ?? null,
    render_image_url: row.render_image_url ?? null,
    approved_render_url: row.approved_render_url ?? null,
    approved_variant_id: row.approved_variant_id ?? null,
    approved_variant_name: row.approved_variant_name ?? null,
    selected_variant_id: row.selected_variant_id ?? null,
    selected_render_id: row.selected_render_id ?? null,
  };
}

function normalizeAIDesignRequest(row: AnyRow): QuoteRow {
  return {
    id: String(row.id),
    source: "ai_design_request",
    ai_request_id: String(row.id),
    measurement_id: row.measurement_id || row.field_measurement_id || null,
    quote_id: row.quote_id || null,
    client_id: row.client_id || null,
    code: row.code || row.request_code || `IA-${String(row.id).slice(0, 8)}`,
    quote_number: row.request_code || row.code || `IA-${String(row.id).slice(0, 8)}`,
    client_name: row.client_name || row.customer_name || "Cliente general",
    client_phone: row.client_phone || row.phone || row.telefono || "",
    client_email: row.client_email || row.email || "",
    project_name: row.project_name || row.name || "Proyecto IA desde levantamiento",
    project_type: row.project_type || row.tipo_proyecto || "general",
    width_mm: Number(row.room_width || row.width_mm || row.wall_width_mm || 2000),
    depth_mm: Number(row.room_depth || row.depth_mm || row.available_depth_mm || 450),
    height_mm: Number(row.room_height || row.height_mm || row.ceiling_height_mm || 2200),
    style: row.style || row.design_style || "moderno",
    color_palette: row.color_palette || row.color_preference || "blanco / madera / negro",
    notes: [
      row.material_preference ? `Material: ${row.material_preference}` : null,
      row.hardware_preference ? `Herrajes: ${row.hardware_preference}` : null,
      row.customer_requests ? `Solicitudes del cliente: ${row.customer_requests}` : null,
      row.technical_notes ? `Notas técnicas: ${row.technical_notes}` : null,
      row.obstacles_notes ? `Obstáculos: ${row.obstacles_notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    presupuesto: Number(row.budget || row.presupuesto || 0),
    status: row.ai_status || row.status || "pendiente_render",
    created_at: row.created_at,
    render_image_url: row.render_image_url || null,
    approved_render_url: row.approved_render_url || null,
    approved_variant_id: row.approved_variant_id || null,
    approved_variant_name: row.approved_variant_name || null,
    selected_variant_id: row.selected_variant_id || null,
    selected_render_id: row.selected_render_id || null,
    material_preference: row.material_preference || "",
    hardware_preference: row.hardware_preference || "",
    customer_requests: row.customer_requests || "",
    technical_notes: row.technical_notes || "",
    photos: row.photos || row.photo_urls || [],
    suggested_modules: row.suggested_modules || [],
    ai_prompt: row.ai_prompt || "",
  };
}

function normalizeMeasurement(row: AnyRow): QuoteRow {
  const real = row.real_space_json || {};
  const selectedOption = real.selected_ai_option || null;
  const firstOption = Array.isArray(real.ai_options) ? real.ai_options[0] : null;
  const option = selectedOption || firstOption || null;
  const measurementId = String(row.id);
  const width = Number(real.wall_width_mm || row.width_mm || row.room_width || 2000);
  const depth = Number(real.available_depth_mm || row.depth_mm || row.room_depth || 450);
  const height = Number(real.ceiling_height_mm || row.ceiling_height_mm || row.height_mm || row.room_height || 2200);

  return {
    id: `field-${measurementId}`,
    source: "field_measurement",
    ai_request_id: row.ai_design_request_id || null,
    measurement_id: measurementId,
    quote_id: row.quote_id || null,
    client_id: row.client_id || null,
    code: row.code || row.measurement_no || `LEV-${measurementId.slice(0, 8)}`,
    quote_number: row.code || row.measurement_no || `LEV-${measurementId.slice(0, 8)}`,
    client_name: row.client_name || row.customer_name || "Cliente general",
    client_phone: row.client_phone || row.phone || row.telefono || "",
    client_email: row.client_email || row.email || "",
    project_name: row.project_name || row.name || "Proyecto desde levantamiento",
    project_type: row.project_type || row.tipo_proyecto || "general",
    width_mm: width,
    depth_mm: depth,
    height_mm: height,
    style: real.style_preference || row.style || row.design_style || "moderno",
    color_palette: row.color_preference || real.color_preference || "blanco / madera / negro",
    notes: [
      row.material_preference ? `Material: ${row.material_preference}` : null,
      row.hardware_preference ? `Herrajes: ${row.hardware_preference}` : null,
      row.customer_requests || real.customer_needs ? `Solicitudes del cliente: ${row.customer_requests || real.customer_needs}` : null,
      row.technical_notes ? `Notas técnicas: ${row.technical_notes}` : null,
      real.obstacles_notes ? `Obstáculos: ${real.obstacles_notes}` : null,
      option?.name ? `Opción sugerida: ${option.name}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    presupuesto: Number(row.budget || row.presupuesto || 0),
    status: row.render_status || row.status || row.estado || "levantamiento_cargado",
    created_at: row.created_at,
    render_image_url: row.render_image_url || real.render_image_url || null,
    approved_render_url: row.approved_render_url || real.approved_render_url || null,
    approved_variant_id: row.approved_variant_id || null,
    approved_variant_name: row.approved_variant_name || null,
    selected_variant_id: row.selected_variant_id || null,
    selected_render_id: row.selected_render_id || null,
    material_preference: row.material_preference || real.material_preference || "",
    hardware_preference: row.hardware_preference || real.hardware_preference || "",
    customer_requests: row.customer_requests || real.customer_needs || "",
    technical_notes: row.technical_notes || "",
    photos: row.photos || row.photo_urls || [],
    suggested_modules: option?.modules || row.suggested_modules || real.suggested_modules || [],
    ai_prompt: row.ai_prompt || real.ai_prompt || "",
  };
}

function emptyModule(q?: QuoteRow | null): DesignModule {
  return {
    id: uid("modulo"),
    name: "Nuevo módulo",
    type: "Personalizado",
    quantity: 1,
    width_mm: n(q?.width_mm, 1200),
    depth_mm: n(q?.depth_mm, 450),
    height_mm: 720,
    material: "Melamina 18mm",
    color: q?.color_palette || "blanco / madera / negro",
    edge: "PVC 1mm visible",
    notes: "Definir puertas, gavetas, repisas o función del módulo.",
  };
}

function buildModules(q: QuoteRow): DesignModule[] {
  const width = n(q.width_mm, 2400);
  const depth = n(q.depth_mm, 450);
  const height = n(q.height_mm, 2200);
  const suggested = Array.isArray((q as any).suggested_modules) ? (q as any).suggested_modules : [];

  if (suggested.length) {
    return suggested.map((item: AnyRow, index: number) => ({
      id: String(item.id || item.module_code || item.module_name || `modulo-${index + 1}`),
      name: item.name || item.module_name || `Módulo ${index + 1}`,
      type: item.type || item.module_type || q.project_type || "Personalizado",
      quantity: n(item.quantity || item.qty, 1),
      width_mm: n(item.width_mm || item.width || item.ancho_mm, width),
      depth_mm: n(item.depth_mm || item.depth || item.profundidad_mm, depth),
      height_mm: n(item.height_mm || item.height || item.alto_mm, Math.min(height, 2200)),
      material: item.material || item.material_preference || q.material_preference || "Melamina 18mm",
      color: item.color || item.color_preference || q.color_palette || "blanco / madera / negro",
      edge: item.edge || item.edge_band || item.canteo || "PVC 1mm visible",
      notes: item.notes || item.notas || "Módulo sugerido desde levantamiento.",
    })).map((module: DesignModule) => enrichModuleMaterialRoles(module, q));
  }

  const projectType = String(q.project_type || "").toLowerCase();

  if (projectType.includes("centro") || projectType.includes("tv")) {
    return [
      {
        id: "modulo-bajo",
        name: "Módulo bajo TV",
        type: "Base inferior",
        quantity: 1,
        width_mm: width,
        depth_mm: depth,
        height_mm: Math.min(650, Math.round(height * 0.3)),
        material: "Melamina 18mm",
        color: "madera",
        edge: "PVC 1mm visible",
        notes: "Gavetas o puertas inferiores según render aprobado.",
      },
      {
        id: "panel-tv",
        name: "Panel decorativo TV",
        type: "Panel pared",
        quantity: 1,
        width_mm: width,
        depth_mm: 80,
        height_mm: height,
        material: "Melamina 18mm",
        color: "blanco / negro",
        edge: "PVC 1mm visible",
        notes: "Panel principal para TV con opción LED.",
      },
      {
        id: "repisas-tv",
        name: "Repisas flotantes",
        type: "Repisas",
        quantity: 3,
        width_mm: Math.round(width * 0.35),
        depth_mm: Math.min(depth, 320),
        height_mm: 40,
        material: "Melamina 18mm",
        color: "blanco",
        edge: "PVC 1mm visible",
        notes: "Repisas decorativas laterales o superiores.",
      },
    ].map((module) => enrichModuleMaterialRoles(module, q));
  }

  if (projectType.includes("closet")) {
    return [
      {
        id: "torre-colgar",
        name: "Torre de colgar",
        type: "Closet colgar",
        quantity: 1,
        width_mm: Math.round(width * 0.45),
        depth_mm: depth,
        height_mm: height,
        material: "Melamina 18mm",
        color: q.color_palette || "blanco",
        edge: "PVC 1mm visible",
        notes: "Área para ropa larga/corta.",
      },
      {
        id: "torre-gavetas",
        name: "Torre de gavetas",
        type: "Closet gavetas",
        quantity: 1,
        width_mm: Math.round(width * 0.3),
        depth_mm: depth,
        height_mm: height,
        material: "Melamina 18mm",
        color: q.color_palette || "blanco",
        edge: "PVC 1mm visible",
        notes: "Gavetas y divisiones.",
      },
      {
        id: "repisas-closet",
        name: "Repisas / zapatero",
        type: "Closet repisas",
        quantity: 1,
        width_mm: Math.round(width * 0.25),
        depth_mm: depth,
        height_mm: height,
        material: "Melamina 18mm",
        color: q.color_palette || "blanco",
        edge: "PVC 1mm visible",
        notes: "Repisas abiertas o zapatero.",
      },
    ];
  }

  if (projectType.includes("cocina")) {
    return [
      {
        id: "modulos-base",
        name: "Módulos base",
        type: "Cocina base",
        quantity: 3,
        width_mm: 600,
        depth_mm: 560,
        height_mm: 720,
        material: "Melamina 18mm",
        color: q.color_palette || "blanco",
        edge: "PVC 1mm visible",
        notes: "Bases inferiores: fregadero, gavetero o puertas.",
      },
      {
        id: "aereos",
        name: "Gabinetes aéreos",
        type: "Cocina aéreo",
        quantity: 3,
        width_mm: 600,
        depth_mm: 330,
        height_mm: 700,
        material: "Melamina 18mm",
        color: q.color_palette || "blanco",
        edge: "PVC 1mm visible",
        notes: "Módulos superiores.",
      },
      {
        id: "torre",
        name: "Torre / despensa",
        type: "Cocina torre",
        quantity: 1,
        width_mm: 700,
        depth_mm: 600,
        height_mm: height,
        material: "Melamina 18mm",
        color: q.color_palette || "blanco",
        edge: "PVC 1mm visible",
        notes: "Torre nevera, horno o despensa.",
      },
    ];
  }

  return [
    {
      id: "modulo-principal",
      name: "Módulo principal",
      type: "Personalizado",
      quantity: 1,
      width_mm: width,
      depth_mm: depth,
      height_mm: height,
      material: "Melamina 18mm",
      color: q.color_palette || "blanco / madera / negro",
      edge: "PVC 1mm visible",
      notes: "Módulo principal del proyecto.",
    },
  ];
}

function buildPrompt(q: any, modules: DesignModule[], variant: RenderVariant) {
  return buildIADesignPrompt(q, modules, variant);
}

function escapeHtml(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function base64ToBlob(base64: string, mimeType = "image/png") {
  const cleanBase64 = base64.includes(",") ? base64.split(",").pop() || "" : base64;
  const byteCharacters = atob(cleanBase64);
  const byteArrays: ArrayBuffer[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    byteArrays.push(new Uint8Array(byteNumbers).buffer);
  }

  return new Blob(byteArrays, { type: mimeType });
}

async function uploadGeneratedRenderFromBase64(base64: string, mimeType = "image/png") {
  const blob = await base64ToBlob(base64, mimeType);
  const path = `ai-render/render-${Date.now()}-${uid("render")}.png`;

  const { error } = await supabase.storage.from("ai-design-images").upload(path, blob, {
    upsert: true,
    contentType: mimeType,
  });

  if (error) {
    throw new Error("Error subiendo render a Storage: " + error.message);
  }

  const { data } = supabase.storage.from("ai-design-images").getPublicUrl(path);
  return data.publicUrl;
}

export default function IADisenoPage() {
  const [mounted, setMounted] = useState(false);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRow | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [modules, setModules] = useState<DesignModule[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<RenderVariant>(VARIANTS[0]);
  const [renders, setRenders] = useState<VariantRenderState>(defaultRenderState);
  const [generatingVariant, setGeneratingVariant] = useState("");
  const [savingProposal, setSavingProposal] = useState(false);
  const [portalUrl, setPortalUrl] = useState("");

  useEffect(() => {
    setMounted(true);
    void loadQuotes();
  }, []);

  useEffect(() => {
    if (selectedQuote) {
      setModules(buildModules(selectedQuote));
      setRenders(defaultRenderState());
      setSelectedVariant(VARIANTS[0]);
      void loadSavedRenders(selectedQuote);
    }
  }, [selectedQuote?.id]);

  async function loadQuotes() {
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("ai_design_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const rows = (data || []).map((row: any) => {
        return {
          // IMPORTANTE: ahora IA Diseño trabaja desde levantamientos, no desde solicitudes IA aprobadas.
          id: String(row.id),
          ai_request_id: String(row.id),
          measurement_id: row.measurement_id || row.field_measurement_id || null,
          quote_id: row.quote_id || null,
          code: row.code || row.request_code || `IA-${String(row.id).slice(0, 8)}`,
          quote_number: row.request_code || row.code || `IA-${String(row.id).slice(0, 8)}`,
          client_name: row.client_name || row.customer_name || "Cliente general",
          client_phone: row.client_phone || row.phone || row.telefono || "",
          client_email: row.client_email || row.email || "",
          project_name: row.project_name || row.name || "Proyecto IA desde levantamiento",
          project_type: row.project_type || row.tipo_proyecto || "general",
          width_mm: Number(row.room_width || row.width_mm || row.wall_width_mm || 2000),
          depth_mm: Number(row.room_depth || row.depth_mm || row.available_depth_mm || 450),
          height_mm: Number(row.room_height || row.height_mm || row.ceiling_height_mm || 2200),
          style: row.style || row.design_style || "moderno",
          color_palette: row.color_palette || row.color_preference || "blanco / madera / negro",
          notes: [
            row.material_preference ? `Material: ${row.material_preference}` : null,
            row.hardware_preference ? `Herrajes: ${row.hardware_preference}` : null,
            row.customer_requests ? `Solicitudes del cliente: ${row.customer_requests}` : null,
            row.technical_notes ? `Notas técnicas: ${row.technical_notes}` : null,
            row.obstacles_notes ? `Obstáculos: ${row.obstacles_notes}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          presupuesto: Number(row.budget || row.presupuesto || 0),
          status: row.ai_status || row.status || "pendiente_render",
          created_at: row.created_at,
          render_image_url: row.render_image_url || null,
          approved_variant_id: row.approved_variant_id || null,
          approved_variant_name: row.approved_variant_name || null,
          material_preference: row.material_preference || "",
          hardware_preference: row.hardware_preference || "",
          customer_requests: row.customer_requests || "",
          technical_notes: row.technical_notes || "",
          photos: row.photos || row.photo_urls || [],
          suggested_modules: row.suggested_modules || [],
          ai_prompt: row.ai_prompt || "",
        };
      });

      const { data: measurementsData, error: measurementsError } = await supabase
        .from("field_measurements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      if (measurementsError) throw measurementsError;

      const requestMeasurementIds = new Set(
        rows
          .map((row: any) => row.measurement_id)
          .filter(Boolean)
          .map(String)
      );
      const measurementRows = (measurementsData || [])
        .filter((row: AnyRow) => !requestMeasurementIds.has(String(row.id)))
        .map(normalizeMeasurement);
      const mergedRows = [...rows, ...measurementRows];

      setQuotes(mergedRows as any);
      setSelectedQuote((current) => {
        if (current && mergedRows.some((r: any) => r.id === current.id)) return current;
        return mergedRows[0] || null;
      });
      setMessage("✅ Solicitudes IA desde levantamientos cargadas correctamente.");
    } catch (err: any) {
      setMessage(`❌ ${err?.message || "No se pudieron cargar las solicitudes IA desde levantamientos."}`);
    } finally {
      setLoading(false);
    }
  }

  function existingAIDesignRequestId(quote: QuoteRow | null) {
    if (!quote) return null;
    if (quote.ai_request_id) return String(quote.ai_request_id);
    if (quote.source === "ai_design_request" && !String(quote.id).startsWith("field-")) return String(quote.id);
    return null;
  }

  async function loadSavedRenders(quote: QuoteRow) {
    const requestId = existingAIDesignRequestId(quote);
    if (!requestId) return;

    const { data, error } = await supabase
      .from("ai_design_renders")
      .select("*")
      .eq("ai_design_request_id", requestId)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("No se pudieron cargar renders guardados:", error.message);
      return;
    }

    if (!data?.length) return;

    const next = defaultRenderState();
    const approvedUrl = quote.approved_render_url || "";
    const selectedRenderId = quote.selected_render_id || "";
    const approvedVariantId = String(quote.approved_variant_id || quote.selected_variant_id || "").toUpperCase();
    const hasExactApproval = Boolean(approvedUrl || selectedRenderId);

    for (const row of data as AnyRow[]) {
      const variantId = String(row.variant || "").toUpperCase();
      if (!next[variantId]) continue;

      const imageUrl = row.render_image_url || row.image_url || "";
      if (!imageUrl) continue;

      const rowStatus = String(row.status || "").toLowerCase();
      const isExactApproved =
        (selectedRenderId && String(row.id) === String(selectedRenderId)) ||
        (approvedUrl && imageUrl === approvedUrl);
      const isApproved =
        isExactApproved ||
        rowStatus.includes("aprob") ||
        (!hasExactApproval && approvedVariantId === variantId);
      const current = next[variantId];

      if (current.status === "aprobado" && !isApproved) {
        continue;
      }

      next[variantId] = {
        status: isApproved ? "aprobado" : "generado",
        imageUrl,
      };
    }

    setRenders(next);
  }

  function updateModule(id: string, key: keyof DesignModule, value: string) {
    setModules((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              material_roles: ["name", "type", "color", "material", "notes"].includes(String(key)) ? undefined : item.material_roles,
              [key]:
                key === "width_mm" ||
                key === "depth_mm" ||
                key === "height_mm" ||
                key === "quantity"
                  ? n(value, Number(item[key]) || 1)
                  : value,
            }
          : item
      )
    );
  }

  function addModule() {
    setModules((current) => [...current, emptyModule(selectedQuote)]);
    setMessage("✅ Módulo agregado. Ajusta medidas, cantidad, color y notas.");
  }

  function duplicateModule(module: DesignModule) {
    setModules((current) => [
      ...current,
      {
        ...module,
        id: uid("modulo-copia"),
        name: `${module.name} copia`,
      },
    ]);
    setMessage(`✅ Módulo duplicado: ${module.name}.`);
  }

  function deleteModule(id: string) {
    setModules((current) => {
      if (current.length <= 1) {
        setMessage("⚠️ Debe quedar al menos un módulo.");
        return current;
      }
      return current.filter((m) => m.id !== id);
    });
  }

  function resetModules() {
    if (!selectedQuote) return;
    setModules(buildModules(selectedQuote));
    setRenders(defaultRenderState());
    setMessage("✅ Módulos restaurados según el tipo de proyecto.");
  }

  function prepareIA() {
    setMessage("✅ IA preparada con módulos dinámicos, cantidades, colores y medidas. Lista para generar render OpenAI.");
  }

  async function copyPrompt() {
    if (!prompt) {
      setMessage("⚠️ No hay prompt para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(prompt);
      setMessage("✅ Prompt IA copiado al portapapeles.");
    } catch {
      setMessage("⚠️ No se pudo copiar automáticamente. Selecciona el texto manualmente.");
    }
  }

  function generatedVariantItems() {
    return VARIANTS.map((variant) => ({
      variant,
      imageUrl: renders[variant.id]?.imageUrl || "",
      status: renders[variant.id]?.status || "pendiente",
    })).filter((item) => item.imageUrl);
  }

  async function saveProposalForClient(generatedOverride?: ReturnType<typeof generatedVariantItems>) {
    if (!selectedQuote) {
      setMessage("Selecciona una solicitud IA primero.");
      return;
    }

    const generated = generatedOverride || generatedVariantItems();
    if (!generated.length) {
      setMessage("Genera por lo menos una variante antes de guardar para el cliente.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSavingProposal(true);
    const approvedModules = modules.map((module) => enrichModuleMaterialRoles(module, selectedQuote));
    const finalPrompt = buildPrompt(selectedQuote, approvedModules, selectedVariant);
    const measurementId = selectedQuote.measurement_id || null;
    const quoteId = selectedQuote.quote_id || null;

    try {
      const requestId = await ensureAIDesignRequest(finalPrompt);
      const nextPortalUrl = clientPortalUrl(requestId);
      const proposalPayload = {
        quote: selectedQuote,
        quote_id: quoteId,
        measurement_id: measurementId,
        ai_design_request_id: requestId,
        portal_token: requestId,
        portal_url: nextPortalUrl,
        modules: approvedModules,
        variants: generated.map((item) => ({
          id: item.variant.id,
          name: item.variant.name,
          concept: item.variant.concept,
          imageUrl: item.imageUrl,
          status: item.status,
        })),
        flow_status: "pendiente_decision_cliente",
        saved_at: new Date().toISOString(),
      };

      localStorage.setItem("rdwood_ia_design_pending_client", JSON.stringify(proposalPayload));

      await supabase
        .from("ai_design_requests")
        .update({
          ai_status: "pendiente_decision_cliente",
          status: "pendiente_decision_cliente",
          suggested_modules: approvedModules,
          ai_prompt: finalPrompt,
          client_portal_token: requestId,
          client_portal_url: nextPortalUrl,
          portal_enabled: true,
          portal_enabled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", requestId);

      if (quoteId) {
        await supabase
          .from("quotes")
          .update({
            status: "pendiente_decision_cliente",
          } as any)
          .eq("id", quoteId);
      }

      if (measurementId) {
        await supabase
          .from("field_measurements")
          .update({
            render_status: "pendiente_decision_cliente",
            status: "pendiente_decision_cliente",
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", measurementId);
      }

      const nextQuote: QuoteRow = {
        ...selectedQuote,
        id: requestId,
        source: "ai_design_request",
        ai_request_id: requestId,
        status: "pendiente_decision_cliente",
      };
      setSelectedQuote(nextQuote);
      setQuotes((current) => current.map((item) => (item.id === selectedQuote.id ? nextQuote : item)));
      setPortalUrl(nextPortalUrl);
      const shouldOpenWhatsApp = generated.length >= VARIANTS.length;
      const whatsappOpened = shouldOpenWhatsApp
        ? openClientPortalWhatsApp(nextQuote, nextPortalUrl, generated.length)
        : false;
      const clientPhone = clientPhoneFromQuote(nextQuote);
      if (shouldOpenWhatsApp && whatsappOpened) {
        setMessage(`Propuesta guardada. WhatsApp abierto para ${clientPhone}. Variantes listas: ${generated.length}. Link cliente: ${nextPortalUrl}`);
      } else if (shouldOpenWhatsApp && !clientPhone) {
        setMessage(`Propuesta guardada, pero el cliente no tiene telefono/WhatsApp cargado. Variantes listas: ${generated.length}. Link cliente: ${nextPortalUrl}`);
      } else if (shouldOpenWhatsApp) {
        setMessage(`Propuesta guardada. El navegador bloqueo la ventana de WhatsApp; usa el boton WhatsApp cliente. Link cliente: ${nextPortalUrl}`);
      } else {
        setMessage(`Propuesta guardada para decision del cliente. Variantes listas: ${generated.length}. Link cliente: ${nextPortalUrl}`);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: any) {
      setMessage(`Error guardando propuesta: ${error?.message || "Error desconocido"}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSavingProposal(false);
    }
  }

  function printClientProposal() {
    if (!selectedQuote) {
      setMessage("Selecciona una solicitud IA primero.");
      return;
    }

    const generated = generatedVariantItems();
    if (!generated.length) {
      setMessage("Genera por lo menos una variante antes de imprimir el paquete del cliente.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const variantCards = generated
      .map(
        ({ variant, imageUrl }) => `
          <section class="variant">
            <div class="variant-head">
              <div>
                <span>Variante ${escapeHtml(variant.id)}</span>
                <h2>${escapeHtml(variant.name)}</h2>
              </div>
              <strong>Pendiente de decision</strong>
            </div>
            <p>${escapeHtml(variant.concept)}</p>
            <img src="${escapeHtml(imageUrl)}" />
          </section>
        `
      )
      .join("");

    const moduleRows = modules
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.quantity)}</td>
            <td>${escapeHtml(item.width_mm)} x ${escapeHtml(item.depth_mm)} x ${escapeHtml(item.height_mm)} mm</td>
            <td>${escapeHtml(item.material)}</td>
            <td>${escapeHtml(item.color)}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>RD WOOD SYSTEM - Propuesta IA</title>
          <style>
            @page { size: letter landscape; margin: 8mm; }
            body { margin: 0; padding: 10px; font-family: Arial, sans-serif; color: #111827; background: #f8fafc; }
            .page { max-width: 980px; margin: 0 auto; }
            .header { border: 1px solid #0f172a; background: white; padding: 10px 14px; margin-bottom: 8px; break-after: avoid; page-break-after: avoid; }
            .brand { font-size: 17px; font-weight: 900; letter-spacing: .16em; }
            .muted { color: #64748b; font-size: 10px; line-height: 1.28; margin: 6px 0; }
            .status { display: inline-block; margin-top: 2px; border: 1px solid #f59e0b; background: #fffbeb; color: #92400e; padding: 5px 8px; font-weight: 900; font-size: 10px; text-transform: uppercase; letter-spacing: .12em; }
            .variant { page-break-inside: avoid; break-inside: avoid; border: 1px solid #cbd5e1; background: white; padding: 10px; margin: 8px 0; }
            .variant-head { display: flex; align-items: start; justify-content: space-between; gap: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            .variant-head span { color: #0891b2; font-size: 12px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
            h1, h2 { margin: 0; }
            h1 { font-size: 22px; }
            h2 { font-size: 19px; }
            .variant p { color: #475569; font-weight: 700; font-size: 11px; margin: 8px 0; }
            .variant img { width: 100%; max-height: 112mm; object-fit: contain; border: 1px solid #e2e8f0; background: #fff; display: block; }
            table { width: 100%; border-collapse: collapse; background: white; margin-top: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f1f5f9; text-transform: uppercase; letter-spacing: .08em; }
            @media print {
              body { background: white; padding: 0; }
              .header { padding: 8px 12px; margin-bottom: 6px; }
              .variant { page-break-inside: avoid; break-inside: avoid; margin: 6px 0; padding: 8px; }
              .variant img { max-height: 108mm; }
            }
          </style>
        </head>
        <body>
          <main class="page">
            <section class="header">
              <div class="brand">RD WOOD SYSTEM</div>
              <h1>Propuesta visual IA para aprobacion</h1>
              <p class="muted">
                Cliente: <strong>${escapeHtml(selectedQuote.client_name || "")}</strong><br />
                Proyecto: <strong>${escapeHtml(selectedQuote.project_name || "")}</strong><br />
                Medidas base: ${escapeHtml(selectedQuote.width_mm || "")} x ${escapeHtml(selectedQuote.depth_mm || "")} x ${escapeHtml(selectedQuote.height_mm || "")} mm
              </p>
              <div class="status">No aprobado - pendiente decision del cliente</div>
            </section>

            ${variantCards}

            <section class="variant">
              <h2>Modulos considerados</h2>
              <table>
                <thead>
                  <tr><th>Modulo</th><th>Cant.</th><th>Medidas</th><th>Material</th><th>Color</th></tr>
                </thead>
                <tbody>${moduleRows}</tbody>
              </table>
            </section>
          </main>
          <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 500); };</script>
        </body>
      </html>
    `;

    const win = window.open("", "_blank", "width=1100,height=900");
    if (!win) {
      setMessage("El navegador bloqueo la ventana de impresion del paquete cliente.");
      return;
    }

    win.document.write(html);
    win.document.close();
    setMessage(`Paquete de ${generated.length} variantes preparado para impresion/envio al cliente.`);
  }

  async function ensureAIDesignRequest(promptText: string) {
    if (!selectedQuote) throw new Error("Selecciona un levantamiento primero.");

    const existingRequestId = (selectedQuote as any).ai_request_id;
    if (existingRequestId) return String(existingRequestId);

    const measurementId =
      selectedQuote.measurement_id ||
      (String(selectedQuote.id).startsWith("field-") ? String(selectedQuote.id).replace(/^field-/, "") : null);

    if (!measurementId) return String(selectedQuote.id);

    const { data: existing, error: existingError } = await supabase
      .from("ai_design_requests")
      .select("*")
      .eq("measurement_id", measurementId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    const attachRequest = (request: AnyRow) => {
      const requestId = String(request.id);
      const updatedQuote: QuoteRow = {
        ...selectedQuote,
        id: requestId,
        source: "ai_design_request",
        ai_request_id: requestId,
        status: request.ai_status || request.status || selectedQuote.status,
      };

      setSelectedQuote(updatedQuote);
      setQuotes((current) => current.map((item) => (item.id === selectedQuote.id ? updatedQuote : item)));
      return requestId;
    };

    if (existing?.id) return attachRequest(existing);

    const payload: AnyRow = {
      measurement_id: measurementId,
      quote_id: selectedQuote.quote_id || null,
      client_id: selectedQuote.client_id || null,
      client_name: selectedQuote.client_name || null,
      phone: selectedQuote.client_phone || null,
      project_name: selectedQuote.project_name || "Proyecto desde levantamiento",
      project_type: selectedQuote.project_type || "general",
      room_width: selectedQuote.width_mm || 0,
      room_height: selectedQuote.height_mm || 0,
      room_depth: selectedQuote.depth_mm || 0,
      style: selectedQuote.style || "moderno",
      color_palette: selectedQuote.color_palette || "Por definir",
      material_preference: selectedQuote.material_preference || null,
      hardware_preference: selectedQuote.hardware_preference || null,
      customer_requests: selectedQuote.customer_requests || null,
      technical_notes: selectedQuote.technical_notes || selectedQuote.notes || null,
      photos: selectedQuote.photos || [],
      suggested_modules: modules.map((module) => enrichModuleMaterialRoles(module, selectedQuote)),
      ai_prompt: promptText,
      source: "field_measurements",
      status: "pendiente_render",
      ai_status: "pendiente_render",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("ai_design_requests")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    await supabase
      .from("field_measurements")
      .update({
        ai_design_request_id: data.id,
        ready_for_render: true,
        render_status: "pendiente_render",
        status: "pendiente_render",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", measurementId);

    return attachRequest(data);
  }

  async function saveRenderUrlToDatabase(variant: RenderVariant, imageUrl: string, promptText: string) {
    if (!selectedQuote?.id) return;

    const moduleSnapshot = modules.map((module) => enrichModuleMaterialRoles(module, selectedQuote));
    const requestId = await ensureAIDesignRequest(promptText);
    const quoteId = (selectedQuote as any).quote_id || null;
    const measurementId = (selectedQuote as any).measurement_id || null;

    const payload: any = {
      ai_design_request_id: requestId,
      variant: variant.id,
      title: `Propuesta ${variant.id} · ${variant.name}`,
      render_prompt: promptText,
      render_image_url: imageUrl,
      status: "render_generado",
    };

    // Solo enviamos quote_id si existe. En el nuevo flujo viene desde levantamiento y puede ser null.
    if (quoteId) payload.quote_id = quoteId;

    const { error } = await supabase.from("ai_design_renders").insert(payload as any);

    if (error) {
      console.warn("No se pudo guardar en ai_design_renders:", error.message);
    }

    const { error: requestError } = await supabase
      .from("ai_design_requests")
      .update({
        ai_status: "render_generado",
        status: "render_generado",
        render_image_url: imageUrl,
        suggested_modules: moduleSnapshot,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", requestId);

    if (requestError) {
      console.warn("No se pudo actualizar ai_design_requests:", requestError.message);
    }

    if (quoteId) {
      const { error: quoteError } = await supabase
        .from("quotes")
        .update({
          status: "render_generado",
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", quoteId);

      if (quoteError) {
        console.warn("No se pudo actualizar quotes:", quoteError.message);
      }
    }

    if (measurementId) {
      await supabase
        .from("field_measurements")
        .update({
          render_status: "render_generado",
          status: "render_generado",
          render_image_url: imageUrl,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", measurementId);
    }
  }

  async function generateVariant(variant: RenderVariant) {
    if (!selectedQuote) {
      setMessage("⚠️ Selecciona una solicitud IA primero.");
      return;
    }

    const renderPrompt = buildPrompt(selectedQuote, modules, variant);

    try {
      setSelectedVariant(variant);
      setGeneratingVariant(variant.id);
      setMessage(`⏳ Generando render real OpenAI para variante ${variant.id}...`);

      setRenders((current) => ({
        ...current,
        [variant.id]: { status: "generando", imageUrl: current[variant.id]?.imageUrl || "" },
      }));

      const response = await apiFetch("/api/ai-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: renderPrompt,
          variant: variant.id,
          size: "1024x1024",
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const msg = result?.error || result?.message || "Error generando render IA.";
        setRenders((current) => ({
          ...current,
          [variant.id]: { status: "error", imageUrl: "", error: msg },
        }));
        setMessage(`❌ ${msg}`);
        return;
      }

      let imageUrl =
        result?.imageUrl ||
        result?.url ||
        result?.render_image_url ||
        result?.publicUrl ||
        "";

      const base64Image =
        result?.image_base64 ||
        result?.base64 ||
        result?.b64_json ||
        result?.image ||
        "";

      if (!imageUrl && base64Image) {
        imageUrl = await uploadGeneratedRenderFromBase64(base64Image, result?.mime_type || "image/png");
      }

      if (!imageUrl) {
        const msg = "La API respondió, pero no devolvió imagen. Revisa /api/ai-render.";
        setRenders((current) => ({
          ...current,
          [variant.id]: { status: "error", imageUrl: "", error: msg },
        }));
        setMessage(`❌ ${msg}`);
        console.log("Respuesta /api/ai-render:", result);
        return;
      }

      setRenders((current) => ({
        ...current,
        [variant.id]: { status: "generado", imageUrl },
      }));

      await saveRenderUrlToDatabase(variant, imageUrl, renderPrompt);

      setMessage(`✅ Render IA generado correctamente para variante ${variant.id}.`);
    } catch (e: any) {
      const msg = e?.message || "Error generando render.";
      setRenders((current) => ({
        ...current,
        [variant.id]: { status: "error", imageUrl: "", error: msg },
      }));
      setMessage(`❌ ${msg}`);
      console.error(e);
    } finally {
      setGeneratingVariant("");
    }
  }

  async function generateAllVariantsForClient() {
    if (!selectedQuote) {
      setMessage("Selecciona una solicitud IA primero.");
      return;
    }

    setSavingProposal(true);
    const generated: ReturnType<typeof generatedVariantItems> = [];

    try {
      for (const variant of VARIANTS) {
        const currentImage = renders[variant.id]?.imageUrl || "";
        if (currentImage) {
          generated.push({ variant, imageUrl: currentImage, status: renders[variant.id]?.status || "generado" });
          continue;
        }

        const renderPrompt = buildPrompt(selectedQuote, modules, variant);
        setSelectedVariant(variant);
        setGeneratingVariant(variant.id);
        setMessage(`Generando variante ${variant.id} de 5 para portal del cliente...`);
        setRenders((current) => ({
          ...current,
          [variant.id]: { status: "generando", imageUrl: current[variant.id]?.imageUrl || "" },
        }));

        const response = await apiFetch("/api/ai-render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: renderPrompt,
            variant: variant.id,
            size: "1024x1024",
          }),
        });

        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(result?.error || result?.message || `Error generando variante ${variant.id}.`);
        }

        let imageUrl =
          result?.imageUrl ||
          result?.url ||
          result?.render_image_url ||
          result?.publicUrl ||
          "";

        const base64Image =
          result?.image_base64 ||
          result?.base64 ||
          result?.b64_json ||
          result?.image ||
          "";

        if (!imageUrl && base64Image) {
          imageUrl = await uploadGeneratedRenderFromBase64(base64Image, result?.mime_type || "image/png");
        }

        if (!imageUrl) {
          throw new Error(`La variante ${variant.id} no devolvio imagen.`);
        }

        await saveRenderUrlToDatabase(variant, imageUrl, renderPrompt);
        generated.push({ variant, imageUrl, status: "generado" });
        setRenders((current) => ({
          ...current,
          [variant.id]: { status: "generado", imageUrl },
        }));
      }

      await saveProposalForClient(generated);
    } catch (error: any) {
      setMessage(`Error generando paquete IA para cliente: ${error?.message || error}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setGeneratingVariant("");
      setSavingProposal(false);
    }
  }

  function printRender(variant: RenderVariant) {
    {
      const imageUrl = renders[variant.id]?.imageUrl;

      if (!imageUrl) {
        setMessage("Primero genera el render de esta variante para poder imprimirlo.");
        return;
      }

      const printWindow = window.open("", "_blank", "width=1280,height=900");
      if (!printWindow) {
        setMessage("El navegador bloqueó la ventana de impresión.");
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>RD WOOD SYSTEM - Render ${escapeHtml(variant.id)}</title>
            <style>
              @page { size: letter landscape; margin: 8mm; }
              * { box-sizing: border-box; }
              body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #fff; color: #111; }
              .sheet { min-height: 100vh; display: flex; flex-direction: column; gap: 10px; padding: 12px; }
              .top { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
              .brand { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
              .meta { text-align: right; font-size: 11px; line-height: 1.35; color: #333; }
              .render-wrap { flex: 1; min-height: 0; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; overflow: hidden; }
              img { display: block; max-width: 100%; max-height: calc(100vh - 90px); object-fit: contain; }
              @media print {
                .sheet { min-height: auto; height: 100vh; padding: 0; }
                .top { padding: 0 0 8px; }
                img { max-height: calc(100vh - 70px); }
              }
            </style>
          </head>
          <body>
            <div class="sheet">
              <div class="top">
                <div>
                  <div class="brand">RD WOOD SYSTEM</div>
                  <div>Render ${escapeHtml(variant.id)} · ${escapeHtml(variant.name)}</div>
                </div>
                <div class="meta">
                  <strong>${escapeHtml(selectedQuote?.project_name || "")}</strong><br/>
                  ${escapeHtml(selectedQuote?.client_name || "")}
                </div>
              </div>
              <div class="render-wrap">
                <img src="${escapeHtml(imageUrl)}" />
              </div>
            </div>
            <script>
              window.onload = function() {
                setTimeout(function(){ window.print(); }, 600);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      setMessage(`Render ${variant.id} preparado para impresión.`);
      return;
    }

    {
    if (!selectedQuote) {
      setMessage("Selecciona una solicitud IA primero.");
      return;
    }

    const maxWidth = Math.max(...modules.map((m) => n(m.width_mm, 1)), 1);
    const maxHeight = Math.max(...modules.map((m) => n(m.height_mm, 1)), 1);
    const moduleCards = modules
      .map((m, index) => {
        const widthPct = Math.max(32, Math.min(100, (n(m.width_mm, 1) / maxWidth) * 100));
        const heightPx = Math.max(76, Math.min(220, (n(m.height_mm, 1) / maxHeight) * 190));
        return `
          <div class="module-card">
            <div class="module-head">
              <strong>${index + 1}. ${escapeHtml(m.name)}</strong>
              <span>x${escapeHtml(m.quantity)}</span>
            </div>
            <div class="module-shape" style="width:${widthPct}%;height:${heightPx}px">
              <div class="dim dim-w">${escapeHtml(m.width_mm)} mm</div>
              <div class="dim dim-h">${escapeHtml(m.height_mm)} mm</div>
              <div class="dim dim-d">Prof. ${escapeHtml(m.depth_mm)} mm</div>
            </div>
            <div class="module-meta">
              <span>${escapeHtml(m.type)}</span>
              <span>${escapeHtml(m.material)}</span>
              <span>${escapeHtml(m.edge)}</span>
            </div>
          </div>
        `;
      })
      .join("");

    const win = window.open("", "_blank", "width=1280,height=900");
    if (!win) {
      setMessage("El navegador bloqueó la ventana de impresión.");
      return;
    }

    win!.document.write(`
      <html>
        <head>
          <title>RD WOOD SYSTEM - Diagrama ${escapeHtml(variant.id)}</title>
          <style>
            @page { size: letter landscape; margin: 10mm; }
            * { box-sizing: border-box; }
            body { margin: 0; padding: 18px; font-family: Arial, sans-serif; background: #fff; color: #111; }
            .sheet { width: 100%; min-height: calc(100vh - 36px); border: 2px solid #111; padding: 18px; }
            .top { display: flex; justify-content: space-between; gap: 18px; border-bottom: 2px solid #111; padding-bottom: 12px; }
            h1 { margin: 0; font-size: 22px; letter-spacing: 1px; }
            h2 { margin: 5px 0 0; font-size: 15px; color: #0369a1; }
            .meta { text-align: right; font-size: 12px; line-height: 1.45; }
            .modules { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
            .module-card { break-inside: avoid; border: 1.5px solid #111; min-height: 230px; padding: 12px; }
            .module-head { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; text-transform: uppercase; }
            .module-head span { border: 1px solid #111; padding: 2px 7px; font-weight: 800; }
            .module-shape { position: relative; margin: 30px auto 22px; min-width: 180px; border: 2px solid #0369a1; background: repeating-linear-gradient(45deg, #f2f8fc, #f2f8fc 8px, #e0eef7 8px, #e0eef7 16px); }
            .dim { position: absolute; border: 1px solid #111; background: #fff; padding: 3px 7px; font-size: 11px; font-weight: 800; white-space: nowrap; }
            .dim-w { left: 50%; top: -25px; transform: translateX(-50%); }
            .dim-h { right: -54px; top: 50%; transform: rotate(90deg) translateX(50%); transform-origin: right center; }
            .dim-d { left: 50%; bottom: -25px; transform: translateX(-50%); color: #0369a1; }
            .module-meta { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; font-size: 11px; }
            .module-meta span { border: 1px solid #bbb; padding: 4px 7px; }
            @media print {
              body { padding: 0; }
              .sheet { min-height: auto; border-width: 1.5px; }
              .modules { gap: 10px; }
              .module-card { min-height: 205px; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="top">
              <div>
                <h1>RD WOOD SYSTEM</h1>
                <h2>Diagrama técnico de módulos · Variante ${escapeHtml(variant.id)} · ${escapeHtml(variant.name)}</h2>
              </div>
              <div class="meta">
                <strong>${escapeHtml(selectedQuote?.project_name || "")}</strong><br/>
                ${escapeHtml(selectedQuote?.client_name || "")}<br/>
                Espacio: ${escapeHtml(selectedQuote?.width_mm || "")} x ${escapeHtml(selectedQuote?.depth_mm || "")} x ${escapeHtml(selectedQuote?.height_mm || "")} mm
              </div>
            </div>
            <div class="modules">${moduleCards}</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function(){ window.print(); }, 600);
            }
          </script>
        </body>
      </html>
    `);
    win!.document.close();

    setMessage(`Diagrama técnico preparado para variante ${variant.id}.`);
    return;

    }

    const imageUrl = renders[variant.id]?.imageUrl;

    if (!imageUrl) {
      setMessage("⚠️ Este render todavía no tiene imagen. Primero genera esta variante.");
      return;
    }

    const win = window.open("", "_blank", "width=1200,height=900");
    if (!win) {
      setMessage("⚠️ El navegador bloqueó la ventana de impresión.");
      return;
    }

    win!.document.write(`
      <html>
        <head>
          <title>RD WOOD SYSTEM - Render ${variant.id}</title>
          <style>
            @page { size: letter landscape; margin: 10mm; }
            body { margin: 0; padding: 30px; font-family: Arial, sans-serif; background: #fff; color: #111; }
            h1 { margin: 0; font-size: 24px; }
            h2 { margin: 8px 0 18px; font-size: 18px; color: #0369a1; }
            img { width: 100%; max-height: 760px; object-fit: contain; border: 1px solid #ddd; }
            .meta { margin-bottom: 18px; font-size: 13px; color: #333; }
          </style>
        </head>
        <body>
          <h1>RD WOOD SYSTEM</h1>
          <h2>Render IA · Variante ${variant.id} · ${variant.name}</h2>
          <div class="meta">
            Proyecto: ${selectedQuote?.project_name || ""}<br/>
            Cliente: ${selectedQuote?.client_name || ""}<br/>
            Medidas: ${selectedQuote?.width_mm || ""} x ${selectedQuote?.depth_mm || ""} x ${selectedQuote?.height_mm || ""} mm<br/>
            Módulos: ${modules.map((m) => `${m.name} x${m.quantity}`).join(" · ")}
          </div>
          <img src="${imageUrl}" />
          <script>
            window.onload = function() {
              setTimeout(function(){ window.print(); }, 600);
            }
          </script>
        </body>
      </html>
    `);
    win!.document.close();

    setMessage(`✅ Impresión preparada para variante ${variant.id}.`);
  }

  async function approveRender(variant: RenderVariant) {
    if (!selectedQuote) {
      setMessage("⚠️ Selecciona una solicitud IA primero.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const imageUrl = renders[variant.id]?.imageUrl;

    if (!imageUrl) {
      setMessage("⚠️ Primero genera el render de esta variante antes de aprobar.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const approvedModules = modules.map((module) => enrichModuleMaterialRoles(module, selectedQuote));
    const finalPrompt = buildPrompt(selectedQuote, approvedModules, variant);
    const measurementId = selectedQuote.measurement_id || null;

    const approvedPayload: any = {
      quote: selectedQuote,
      quote_id: selectedQuote.quote_id || null,
      measurement_id: measurementId,
      modules: approvedModules,
      approved_variant: variant,
      approved_variant_id: variant.id,
      approved_variant_name: variant.name,
      render_image_url: imageUrl,
      approved_render_url: imageUrl,
      prompt: finalPrompt,
      flow_status: "render_aprobado_cotizacion",
      quote_status: "pendiente_cotizacion",
      source: "ia_diseno",
      approved_at: new Date().toISOString(),
    };

    try {
      localStorage.setItem("rdwood_ia_design_approved", JSON.stringify(approvedPayload));
      localStorage.setItem("rdwood_render_approved_for_quote", JSON.stringify(approvedPayload));
      localStorage.removeItem("rdwood_production_pending_bom");

      setRenders((current) => ({
        ...current,
        [variant.id]: {
          ...current[variant.id],
          status: "aprobado",
          imageUrl,
        },
      }));

      const requestId = await ensureAIDesignRequest(finalPrompt);
      const quoteId = (selectedQuote as any).quote_id || null;
      let selectedRenderId: string | null = null;

      const { data: approvedRenderRow, error: approvedRenderError } = await supabase
        .from("ai_design_renders")
        .select("id")
        .eq("ai_design_request_id", requestId)
        .eq("variant", variant.id)
        .eq("render_image_url", imageUrl)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (approvedRenderError) {
        console.warn("No se pudo localizar el render aprobado exacto:", approvedRenderError.message);
      }

      if (approvedRenderRow?.id) {
        selectedRenderId = String(approvedRenderRow.id);
        const { error: renderStatusError } = await supabase
          .from("ai_design_renders")
          .update({
            status: "aprobado_cliente",
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", selectedRenderId);

        if (renderStatusError) {
          console.warn("No se pudo marcar el render como aprobado:", renderStatusError.message);
        }

        approvedPayload.selected_render_id = selectedRenderId;
        localStorage.setItem("rdwood_ia_design_approved", JSON.stringify(approvedPayload));
        localStorage.setItem("rdwood_render_approved_for_quote", JSON.stringify(approvedPayload));
      }

      await supabase
        .from("ai_design_requests")
        .update({
          ai_status: "render_aprobado",
          status: "render_aprobado",
          selected_render_id: selectedRenderId,
          approved_render: true,
          client_approved: true,
          approved_render_at: new Date().toISOString(),
          render_approved_at: new Date().toISOString(),
          approved_render_url: imageUrl,
          render_image_url: imageUrl,
          suggested_modules: approvedModules,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", requestId);

      if (quoteId) {
        await supabase
          .from("quotes")
          .update({
            status: "render_aprobado",
            render_approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", quoteId);
      }

      if (measurementId) {
        await supabase
          .from("field_measurements")
          .update({
            render_status: "render_aprobado",
            status: "render_aprobado",
            ready_for_quote: true,
            approved_render_url: imageUrl,
            render_image_url: imageUrl,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", measurementId);
      }

      setMessage(`Render ${variant.id} aprobado correctamente. Abriendo Cotización...`);
      window.scrollTo({ top: 0, behavior: "smooth" });

      setTimeout(() => {
        window.location.href = measurementId
          ? `/cotizador-automatico?measurement_id=${encodeURIComponent(measurementId)}`
          : "/cotizador-automatico";
      }, 900);
    } catch (error: any) {
      console.error("approveRender error:", error);
      setMessage(`❌ Error aprobando render: ${error?.message || "Error desconocido"}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const filteredQuotes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return quotes;

    return quotes.filter((q) =>
      [q.quote_number, q.code, q.client_name, q.project_name, q.project_type, q.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [quotes, search]);

  const prompt = useMemo(() => {
    if (!selectedQuote) return "";
    return buildPrompt(selectedQuote, modules, selectedVariant);
  }, [selectedQuote, modules, selectedVariant]);

  const totalModuleUnits = useMemo(() => {
    return modules.reduce((sum, item) => sum + n(item.quantity, 1), 0);
  }, [modules]);

  const generatedForPortalCount = generatedVariantItems().length || VARIANTS.length;
  const portalWhatsAppUrl = whatsappLinkForClient(selectedQuote, portalUrl, generatedForPortalCount);

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-[#020817] px-6 py-8 text-white">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <section className="rounded-[28px] border border-cyan-900/80 bg-[#07111f] p-6 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-700 px-4 py-2 text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
                IA Diseño · OpenAI Render · Módulos Dinámicos
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
                Render IA para aprobación del cliente
              </h1>
              <p className="mt-3 max-w-4xl text-slate-300">
                Este módulo toma una solicitud IA desde levantamiento, permite agregar todos los módulos necesarios,
                maneja cantidades por módulo, genera variantes A/B/C/D/E con OpenAI y prepara
                el render aprobado para Cotización.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={loadQuotes}
                className="rounded-2xl bg-slate-100 px-5 py-3 font-black text-slate-950 hover:bg-white"
              >
                ↻ RECARGAR
              </button>
              <button
                type="button"
                onClick={prepareIA}
                className="rounded-2xl bg-cyan-500 px-5 py-3 font-black text-white hover:bg-cyan-400"
              >
                ✦ PREPARAR IA
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 font-bold text-emerald-200">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="min-w-0 break-words">{message}</p>
              {portalUrl ? (
                <div className="flex shrink-0 flex-wrap gap-2">
                  {portalWhatsAppUrl ? (
                    <a
                      href={portalWhatsAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300"
                    >
                      Enviar WhatsApp
                    </a>
                  ) : (
                    <span className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-black text-amber-100">
                      Sin WhatsApp
                    </span>
                  )}
                  <a
                    href={portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-cyan-400/40 px-4 py-2 text-sm font-black text-cyan-100 hover:bg-cyan-400/10"
                  >
                    Abrir portal
                  </a>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
          <aside className="rounded-[28px] border border-cyan-900/80 bg-[#07111f] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-black">Solicitudes IA</h2>
              <span className="rounded-full border border-cyan-700 px-3 py-1 text-xs font-black text-cyan-300">
                {filteredQuotes.length}
              </span>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar solicitud IA, cliente o proyecto..."
              className="mb-4 w-full rounded-2xl border border-slate-700 bg-[#020817] px-4 py-3 font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />

            <div className="max-h-[720px] space-y-3 overflow-auto pr-2">
              {loading ? (
                <div className="rounded-2xl border border-slate-800 p-5 text-slate-400">
                  Cargando...
                </div>
              ) : filteredQuotes.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 p-5 text-slate-400">
                  No hay solicitudes IA.
                </div>
              ) : (
                filteredQuotes.map((q, index) => {
                  const active = selectedQuote?.id === q.id;
                  return (
                    <button
                      key={`${q.id}-${index}`}
                      type="button"
                      onClick={() => {
                        setSelectedQuote(q);
                        setMessage(`✅ Solicitud IA seleccionada: ${q.project_name}`);
                      }}
                      className={[
                        "w-full rounded-2xl border p-4 text-left transition",
                        active
                          ? "border-cyan-400 bg-cyan-950/50"
                          : "border-slate-800 bg-[#020817] hover:border-cyan-700",
                      ].join(" ")}
                    >
                      <div className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                        {q.quote_number || q.code}
                      </div>
                      <div className="mt-1 text-xl font-black">{q.project_name}</div>
                      <div className="text-sm text-slate-400">
                        {q.client_name} · {q.project_type}
                      </div>
                      <div className="mt-2 inline-flex rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-300">
                        {q.status}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="space-y-6">
            {selectedQuote ? (
              <>
                <div className="rounded-[28px] border border-cyan-900/80 bg-[#07111f] p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
                        Solicitud IA {selectedQuote.quote_number || selectedQuote.code}
                      </div>
                      <h2 className="mt-2 text-4xl font-black">{selectedQuote.project_name}</h2>
                      <p className="mt-1 text-slate-400">
                        {selectedQuote.client_name} · {selectedQuote.project_type}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-[#020817] p-4">
                      <div className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
                        Estado IA
                      </div>
                      <div className="mt-2 text-2xl font-black text-cyan-300">
                        {selectedQuote.status}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
                    <Metric label="Ancho" value={`${selectedQuote.width_mm} mm`} />
                    <Metric label="Prof." value={`${selectedQuote.depth_mm} mm`} />
                    <Metric label="Alto" value={`${selectedQuote.height_mm} mm`} />
                    <Metric label="Presupuesto" value={money(Number(selectedQuote.presupuesto || 0))} />
                    <Metric label="Módulos" value={`${modules.length} tipos / ${totalModuleUnits} uds`} />
                  </div>
                </div>

                <div className="rounded-[28px] border border-cyan-900/80 bg-[#07111f] p-6">
                  <h3 className="text-2xl font-black">Datos tomados del levantamiento</h3>

                  <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <Field label="Cliente" value={selectedQuote.client_name || ""} />
                    <Field label="Teléfono" value={selectedQuote.client_phone || ""} />
                    <Field label="Proyecto" value={selectedQuote.project_name || ""} />
                    <Field label="Tipo" value={selectedQuote.project_type || ""} />
                    <Field label="Estilo" value={selectedQuote.style || ""} />
                    <Field label="Colores" value={selectedQuote.color_palette || ""} />
                    <Field label="Ancho mm" value={String(selectedQuote.width_mm || "")} />
                    <Field label="Profundidad mm" value={String(selectedQuote.depth_mm || "")} />
                    <Field label="Alto mm" value={String(selectedQuote.height_mm || "")} />
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-slate-400">
                      Notas
                    </div>
                    <textarea
                      readOnly
                      value={selectedQuote.notes || ""}
                      className="h-28 w-full rounded-2xl border border-slate-700 bg-[#020817] p-4 font-bold text-white outline-none"
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
                    IA Diseño genera render visual. Al aprobar, el proyecto pasa a Cotización; Producción queda para después del contrato.
                  </div>
                </div>

                <div className="rounded-[28px] border border-cyan-900/80 bg-[#07111f] p-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h3 className="text-2xl font-black">Módulos dinámicos para render</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Agrega todos los módulos necesarios del proyecto. Cada módulo tiene cantidad, medidas, material, color y canteo.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={resetModules}
                        className="rounded-2xl bg-slate-700 px-4 py-3 text-sm font-black hover:bg-slate-600"
                      >
                        Restaurar
                      </button>
                      <button
                        type="button"
                        onClick={addModule}
                        className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-white hover:bg-cyan-400"
                      >
                        + Agregar módulo
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {modules.map((m, index) => (
                      <div key={m.id} className="rounded-2xl border border-slate-800 bg-[#020817] p-4">
                        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                              Módulo #{index + 1}
                            </div>
                            <div className="mt-1 text-lg font-black">
                              {m.name} · x{m.quantity}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => duplicateModule(m)}
                              className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-black hover:bg-slate-600"
                            >
                              Duplicar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteModule(m.id)}
                              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black hover:bg-red-500"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                          <EditableField label="Nombre" value={m.name} onChange={(v) => updateModule(m.id, "name", v)} />
                          <EditableField label="Tipo" value={m.type} onChange={(v) => updateModule(m.id, "type", v)} />
                          <EditableField label="Cantidad" value={String(m.quantity)} onChange={(v) => updateModule(m.id, "quantity", v)} />
                          <EditableField label="Material" value={m.material} onChange={(v) => updateModule(m.id, "material", v)} />
                          <EditableField label="Color" value={m.color} onChange={(v) => updateModule(m.id, "color", v)} />
                          <EditableField label="Ancho mm" value={String(m.width_mm)} onChange={(v) => updateModule(m.id, "width_mm", v)} />
                          <EditableField label="Prof. mm" value={String(m.depth_mm)} onChange={(v) => updateModule(m.id, "depth_mm", v)} />
                          <EditableField label="Alto mm" value={String(m.height_mm)} onChange={(v) => updateModule(m.id, "height_mm", v)} />
                          <EditableField label="Canteo" value={m.edge} onChange={(v) => updateModule(m.id, "edge", v)} />
                        </div>

                        <div className="mt-4">
                          <EditableField label="Notas del módulo" value={m.notes} onChange={(v) => updateModule(m.id, "notes", v)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-cyan-900/80 bg-[#07111f] p-6">
                  <h3 className="text-2xl font-black">Variantes A/B/C/D/E · Render OpenAI</h3>

                  <p className="mt-1 text-sm font-semibold text-slate-400">
                    Guarda la propuesta si el cliente necesita tiempo para decidir. Aprobar solo cuando elija una variante.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={generateAllVariantsForClient}
                      disabled={savingProposal || Boolean(generatingVariant)}
                      className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                    >
                      {savingProposal || generatingVariant ? "Procesando..." : "Generar 5 + link cliente"}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveProposalForClient()}
                      disabled={savingProposal}
                      className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-amber-400 disabled:opacity-60"
                    >
                      {savingProposal ? "Guardando..." : "Guardar pendiente"}
                    </button>
                    <button
                      type="button"
                      onClick={printClientProposal}
                      className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-950 hover:bg-white"
                    >
                      Imprimir paquete cliente
                    </button>
                  </div>

                  {portalUrl && (
                    <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200">Portal del cliente listo</p>
                      <a href={portalUrl} target="_blank" className="mt-2 block break-all text-sm font-black text-cyan-200 underline">
                        {portalUrl}
                      </a>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {portalWhatsAppUrl ? (
                          <a
                            href={portalWhatsAppUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-300"
                          >
                            WhatsApp cliente
                          </a>
                        ) : (
                          <span className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-100">
                            Cliente sin WhatsApp
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-400">
                        Este link se puede enviar por WhatsApp. El cliente aprueba una variante desde su portal y el flujo pasa a Cotizacion.
                      </p>
                    </div>
                  )}

                  <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {VARIANTS.map((variant) => {
                      const active = selectedVariant.id === variant.id;
                      const renderState = renders[variant.id] || { status: "pendiente", imageUrl: "" };
                      const isGenerating = generatingVariant === variant.id || renderState.status === "generando";

                      return (
                        <div
                          key={variant.id}
                          className={[
                            "rounded-2xl border bg-[#020817] p-4",
                            active ? "border-cyan-400" : "border-slate-800",
                          ].join(" ")}
                        >
                          <div className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                            Variante {variant.id}
                          </div>
                          <h4 className="mt-1 text-xl font-black">
                            {variant.id} · {variant.name}
                          </h4>
                          <p className="mt-2 text-sm text-slate-400">{variant.concept}</p>

                          <div className="mt-4 flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-500">
                            {renderState.imageUrl ? (
                              <img
                                src={renderState.imageUrl}
                                alt={`Render ${variant.id}`}
                                className="h-full w-full object-cover"
                              />
                            ) : isGenerating ? (
                              <div className="text-center">
                                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
                                <div className="font-black text-cyan-300">Generando render OpenAI...</div>
                              </div>
                            ) : renderState.status === "error" ? (
                              <div className="p-4 text-center text-red-300">
                                {renderState.error || "Error generando render"}
                              </div>
                            ) : (
                              <div className="text-center">
                                <div className="font-black text-slate-400">Render pendiente</div>
                                <div className="mt-1 text-xs text-slate-600">Presiona Generar</div>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 grid grid-cols-3 gap-3">
                            <button
                              type="button"
                              disabled={isGenerating}
                              onClick={() => generateVariant(variant)}
                              className="rounded-xl bg-cyan-500 px-3 py-3 font-black hover:bg-cyan-400 disabled:opacity-50"
                            >
                              {isGenerating ? "Generando..." : "Generar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => printRender(variant)}
                              className="rounded-xl bg-slate-700 px-3 py-3 font-black hover:bg-slate-600"
                            >
                              Imprimir
                            </button>
                            <button
                              type="button"
                              onClick={() => approveRender(variant)}
                              className="rounded-xl bg-emerald-600 px-3 py-3 font-black hover:bg-emerald-500"
                            >
                              Aprobar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[28px] border border-cyan-900/80 bg-[#07111f] p-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <h3 className="text-2xl font-black">Prompt IA maestro</h3>
                    <button
                      type="button"
                      onClick={copyPrompt}
                      className="rounded-2xl bg-cyan-500 px-5 py-3 font-black text-white hover:bg-cyan-400"
                    >
                      COPIAR PROMPT IA
                    </button>
                  </div>

                  <textarea
                    readOnly
                    value={prompt}
                    className="mt-4 h-80 w-full rounded-2xl border border-slate-700 bg-[#020817] p-4 font-mono text-sm text-cyan-100 outline-none"
                  />
                </div>
              </>
            ) : (
              <div className="rounded-[28px] border border-cyan-900 bg-[#07111f] p-12 text-center text-slate-400">
                Selecciona una solicitud IA.
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#020817] p-4">
      <div className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-slate-400">
        {label}
      </div>
      <input
        readOnly
        value={value}
        className="w-full rounded-2xl border border-slate-700 bg-[#020817] px-4 py-3 font-bold text-white outline-none"
      />
    </label>
  );
}

function EditableField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-slate-400">
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-[#020817] px-4 py-3 font-bold text-white outline-none focus:border-cyan-400"
      />
    </label>
  );
}
