"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/saas/auth-client";
import { createProductionFromProject } from "@/lib/productionEngine";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Factory,
  PackagePlus,
  Plus,
  RefreshCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";

type AnyRow = any;

type InventoryProduct = {
  id: string;
  code?: string | null;
  name?: string | null;
  product_name?: string | null;
  material?: string | null;
  description?: string | null;
  descripcion?: string | null;
  sku?: string | null;
  category?: string | null;
  subcategory?: string | null;
  unit?: string | null;
  unidad?: string | null;
  stock?: number | null;
  quantity?: number | null;
  reserved_stock?: number | null;
  stock_reserved?: number | null;
  sheet_width_mm?: number | null;
  sheet_height_mm?: number | null;
  ancho_mm?: number | null;
  largo_mm?: number | null;
  cost_price?: number | null;
  unit_cost?: number | null;
  purchase_cost?: number | null;
  sale_price?: number | null;
  unit_price?: number | null;
};

type ProductionItem = {
  // id se usa para UI/React. Puede ser un ID compuesto.
  id: string;

  // inventory_item_id es el UUID real que se manda al RPC para descontar inventario.
  inventory_item_id?: string | null;
  product_id?: string | null;
  material_id?: string | null;
  production_order_id?: string | null;
  order_id?: string | null;

  name: string;
  code: string;
  product_name?: string | null;
  item_name?: string | null;
  material?: string | null;
  material_name?: string | null;
  category: string;
  unit: string;
  stock: number;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  source: "manual" | "bom";

  // Campos opcionales para Corte Inteligente PRO
  part_name?: string | null;
  module_name?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  thickness_mm?: number | null;
  edge_top?: boolean | null;
  edge_bottom?: boolean | null;
  edge_left?: boolean | null;
  edge_right?: boolean | null;
  edge_front?: boolean | null;
  edge_back?: boolean | null;
  allow_rotate?: boolean | null;
};

type Recipe = {
  id: string;
  recipe_code?: string | null;
  recipe_name: string;
  product_name?: string | null;
  category?: string | null;
  sale_price?: number | null;
  labor_cost?: number | null;
  overhead_cost?: number | null;
  notes?: string | null;
};

type BomItem = {
  id: string;
  recipe_id: string;
  material_id: string;
  material_name: string | null;
  unit: string | null;
  quantity_required: number | null;
  waste_percent: number | null;
  unit_cost: number | null;
  total_cost: number | null;
};

type OrderRow = {
  id: string;
  order_code?: string | null;
  code?: string | null;
  client_name?: string | null;
  project_name?: string | null;
  status?: string | null;
  total_cost?: number | null;
  created_at?: string | null;
};

type PendingProductionPayload = {
  client_name?: string;
  project_name?: string;
  notes?: string;
  render_image_url?: string;
  approved_render_url?: string;
  prompt?: string;
  design_prompt?: string;
  quote_id?: string;
  modules?: any[];
  approved_modules?: any[];
  flow_status?: string;
  production_status?: string;
  ai_request_id?: string;
  approved_variant_id?: string;
  approved_variant_name?: string;
  approved_variant?: any;
  quote?: any;
};

type AIDesignRequestRow = {
  id: string;
  source?: "ai" | "quote";
  quote_no?: string | null;
  quote_id?: string | null;
  project_id?: string | null;
  client_name?: string | null;
  phone?: string | null;
  project_name?: string | null;
  project_type?: string | null;
  room_width?: number | null;
  room_height?: number | null;
  room_depth?: number | null;
  style?: string | null;
  color_palette?: string | null;
  budget?: number | null;
  ai_status?: string | null;
  ai_prompt?: string | null;
  ai_response?: string | null;
  notes?: string | null;
  suggested_materials?: any;
  suggested_modules?: any;
  render_image_url?: string | null;
  approved_render_url?: string | null;
  approved_variant_id?: string | null;
  approved_variant_name?: string | null;
  selected_variant_id?: string | null;
  selected_render_id?: string | null;
  created_at?: string | null;
};

const money = (value: number | null | undefined) =>
  `RD$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const num = (value: number | null | undefined) => Number(value || 0);
const productName = (p: InventoryProduct) => p.name || p.product_name || p.material || p.code || "Producto";
const productStock = (p: InventoryProduct) => num(p.stock ?? p.quantity);
const productCost = (p: InventoryProduct) => num(p.cost_price ?? p.unit_cost ?? p.purchase_cost);
const productUnit = (p: InventoryProduct) => p.unit || p.unidad || "Unidad";

function normalizeVariantId(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function isApprovedRenderStatus(value: unknown) {
  return String(value || "").toLowerCase().includes("aprob");
}

async function resolveDesignApprovedRenderUrl(request: AIDesignRequestRow) {
  const fallback = request.approved_render_url || request.render_image_url || "";

  if (request.source !== "ai" || !request.id) {
    return fallback;
  }

  if (request.selected_render_id) {
    const { data, error } = await supabase
      .from("ai_design_renders")
      .select("*")
      .eq("id", request.selected_render_id)
      .maybeSingle();

    if (!error) {
      const selectedUrl = (data as any)?.render_image_url || (data as any)?.image_url || "";
      if (selectedUrl) return selectedUrl;
    }
  }

  if (request.approved_render_url) {
    return request.approved_render_url;
  }

  const variantId = normalizeVariantId(request.approved_variant_id || request.selected_variant_id);
  if (variantId) {
    const { data, error } = await supabase
      .from("ai_design_renders")
      .select("*")
      .eq("ai_design_request_id", request.id)
      .eq("variant", variantId)
      .order("created_at", { ascending: false });

    if (!error && data?.length) {
      const rows = data as AnyRow[];
      const approved = rows.find((row) => isApprovedRenderStatus(row.status));
      const row = approved || rows[0];
      const url = row.render_image_url || row.image_url || "";
      if (url) return url;
    }
  }

  return fallback;
}

function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function getRealInventoryId(item: ProductionItem) {
  if (isValidUuid(item.inventory_item_id)) return item.inventory_item_id;
  if (isValidUuid(item.product_id)) return item.product_id;
  if (isValidUuid(item.material_id)) return item.material_id;
  if (isValidUuid(item.id)) return item.id;
  return "";
}

function appendNote(base: string, extra: string) {
  const current = String(base || "").trim();
  return current ? `${current}\n${extra}` : extra;
}

function cleanText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function productReserved(p?: InventoryProduct | null) {
  return num(p?.reserved_stock ?? p?.stock_reserved);
}

function productAvailable(p?: InventoryProduct | null) {
  return Math.max(0, productStock(p || ({} as InventoryProduct)) - productReserved(p));
}

function itemTechnicalName(item: ProductionItem) {
  return [
    item.name,
    item.product_name,
    item.item_name,
    item.material_name,
    item.material,
    item.category,
    item.module_name,
    item.part_name,
    item.code,
  ]
    .filter(Boolean)
    .join(" ");
}

function isBoardLike(item: ProductionItem) {
  const text = cleanText(itemTechnicalName(item));
  const hasDims = Number(item.width_mm || 0) > 0 && Number(item.height_mm || 0) > 0;
  return hasDims && /(melamina|mdf|tablero|plywood|fondo)/.test(text);
}

function isEdgeLike(item: ProductionItem) {
  return cleanText(itemTechnicalName(item)).includes("canto");
}

function sheetSizeForMaterial(name: string, product?: InventoryProduct | null) {
  const text = cleanText(name);
  const explicitW = num(product?.sheet_width_mm ?? product?.ancho_mm);
  const explicitH = num(product?.sheet_height_mm ?? product?.largo_mm);

  if (explicitW > 0 && explicitH > 0) {
    return { width: explicitW, height: explicitH };
  }

  if (text.includes("7x8") || text.includes("7 x 8")) {
    return { width: 2134, height: 2440 };
  }

  return { width: 1220, height: 2440 };
}

function roundQty(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(Number(value || 0) * factor) / factor;
}

function itemMaterialName(item: ProductionItem) {
  return (
    item.material_name ||
    item.material ||
    item.item_name ||
    item.product_name ||
    item.name ||
    "Material sin identificar"
  );
}

function inventoryAliases(product: InventoryProduct) {
  return [
    productName(product),
    product.material,
    product.name,
    product.product_name,
    product.description,
    product.descripcion,
    product.code,
    product.sku,
  ]
    .filter(Boolean)
    .map((value) => cleanText(value));
}

function findInventoryProductForItem(item: ProductionItem, products: InventoryProduct[]) {
  const realId = getRealInventoryId(item);
  if (realId) {
    const byId = products.find((product) => String(product.id) === String(realId));
    if (byId) return byId;
  }

  const exactCandidates = [
    item.material_name,
    item.material,
    item.item_name,
    item.product_name,
    item.name,
    item.code,
  ]
    .filter(Boolean)
    .map((value) => cleanText(value));

  for (const candidate of exactCandidates) {
    const exact = products.find((product) => inventoryAliases(product).includes(candidate));
    if (exact) return exact;
  }

  const fuzzyCandidates = exactCandidates.filter((candidate) => candidate.length >= 8);
  for (const candidate of fuzzyCandidates) {
    const fuzzy = products.find((product) =>
      inventoryAliases(product).some((alias) => alias.length >= 8 && (alias.includes(candidate) || candidate.includes(alias)))
    );
    if (fuzzy) return fuzzy;
  }

  return null;
}

type RequisitionLine = {
  key: string;
  inventoryId: string | null;
  name: string;
  unit: string;
  qty: number;
  stock: number;
  reservedQty: number;
  missingQty: number;
  note: string;
};

function buildRequisitionLines(items: ProductionItem[], products: InventoryProduct[]): RequisitionLine[] {
  const byId = new Map(products.map((p) => [String(p.id), p]));
  const grouped = new Map<string, RequisitionLine & { areaM2?: number; rawQty?: number }>();

  for (const item of items) {
    const inventoryId = getRealInventoryId(item);
    const product = (inventoryId ? byId.get(inventoryId) : null) || findInventoryProductForItem(item, products);
    const linkedInventoryId = product?.id || inventoryId || null;
    const materialName = product ? productName(product) : itemMaterialName(item);
    const itemForClass = { ...item, name: `${item.name} ${materialName}` };
    const boardLine = isBoardLike(itemForClass);
    const edgeLine = isEdgeLike(itemForClass);
    const keyBase = `${linkedInventoryId || cleanText(materialName)}|${boardLine ? "plancha" : edgeLine ? "canto" : "unidad"}`;
    const current =
      grouped.get(keyBase) ||
      {
        key: keyBase,
        inventoryId: linkedInventoryId,
        name: materialName,
        unit: item.unit || productUnit(product || ({} as InventoryProduct)),
        qty: 0,
        stock: product ? productStock(product) : item.stock,
        reservedQty: 0,
        missingQty: 0,
        note: "",
        areaM2: 0,
        rawQty: 0,
      };

    if (boardLine) {
      const sheet = sheetSizeForMaterial(materialName, product);
      const sheetArea = Math.max(0.0001, (sheet.width * sheet.height) / 1_000_000);
      const itemArea = (Number(item.width_mm || 0) * Number(item.height_mm || 0) * Number(item.quantity || 1)) / 1_000_000;
      current.areaM2 = Number(current.areaM2 || 0) + itemArea;
      current.rawQty = Number(current.rawQty || 0) + Number(item.quantity || 1);
      current.qty = Math.max(1, Math.ceil((Number(current.areaM2 || 0) * 1.15) / sheetArea));
      current.unit = "plancha";
      current.note = `Plancha estimada por area BOM (${roundQty(Number(current.areaM2 || 0), 3)} m2 + 15% merma). Formato ${sheet.height} x ${sheet.width} mm.`;
    } else if (edgeLine) {
      current.rawQty = Number(current.rawQty || 0) + Number(item.quantity || 0);
      current.qty = roundQty(Number(current.rawQty || 0) * 1.1, 1);
      current.unit = "metro";
      current.note = "Canto PVC calculado desde cantos del BOM + 10% merma.";
    } else {
      current.qty = roundQty(current.qty + Number(item.quantity || 0), 2);
      current.unit = item.unit || current.unit || "unidad";
      current.note = "Herraje/material consolidado desde BOM de produccion.";
    }

    grouped.set(keyBase, current);
  }

  return Array.from(grouped.values())
    .map((line) => ({
      key: line.key,
      inventoryId: line.inventoryId,
      name: line.name,
      unit: line.unit,
      qty: line.qty,
      stock: line.stock,
      reservedQty: 0,
      missingQty: line.qty,
      note: line.note,
    }))
    .filter((line) => line.qty > 0);
}


export default function ProduccionBomProClient() {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<ProductionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [mode, setMode] = useState<"manual" | "bom">("bom");
  const [search, setSearch] = useState("");
  const [clientName, setClientName] = useState("Cliente general");
  const [projectName, setProjectName] = useState("Proyecto de producción");
  const [notes, setNotes] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [recipeUnits, setRecipeUnits] = useState(1);
  const [newRecipeName, setNewRecipeName] = useState("");
  const [newRecipeSalePrice, setNewRecipeSalePrice] = useState(0);
  const [newRecipeLabor, setNewRecipeLabor] = useState(0);
  const [message, setMessage] = useState("Producción lista");
  const [pendingPayload, setPendingPayload] = useState<PendingProductionPayload | null>(null);
  const [designRequests, setDesignRequests] = useState<AIDesignRequestRow[]>([]);
  const [selectedDesignRequestId, setSelectedDesignRequestId] = useState("");

  useEffect(() => {
    refreshAll();
    void loadPendingFromIADesign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  async function loadPendingFromIADesign() {
    try {
      const raw = localStorage.getItem("rdwood_production_pending_bom");
      const rawBackup = localStorage.getItem("rdwood_ia_design_approved");
      const sourceRaw = raw || rawBackup;

      if (!sourceRaw) {
        return false;
      }

      const payload: PendingProductionPayload = JSON.parse(sourceRaw);
      const quote = payload.quote || {};
      const approvedModules = payload.approved_modules || payload.modules || [];
      let renderUrl = payload.approved_render_url || payload.render_image_url || "";
      const requestId =
        payload.ai_request_id ||
        quote.ai_request_id ||
        (quote.source === "ai_design_request" ? quote.id : null);

      let requestRow: AnyRow | null = null;
      if (isValidUuid(requestId)) {
        const { data } = await supabase.from("ai_design_requests").select("*").eq("id", requestId).maybeSingle();
        requestRow = (data as AnyRow) || null;
      } else {
        const client = payload.client_name || quote.client_name || quote.cliente || "";
        const project = payload.project_name || quote.project_name || quote.proyecto || "";
        if (client && project) {
          const { data } = await supabase
            .from("ai_design_requests")
            .select("*")
            .eq("client_name", client)
            .eq("project_name", project)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          requestRow = (data as AnyRow) || null;
        }
      }

      if (requestRow?.id) {
        renderUrl = (await resolveDesignApprovedRenderUrl({ ...requestRow, id: requestRow.id, source: "ai" })) || renderUrl;
      }

      const normalizedPayload: PendingProductionPayload = {
        ...payload,
        client_name: payload.client_name || quote.client_name || quote.cliente || "Cliente general",
        project_name: payload.project_name || quote.project_name || quote.proyecto || "Proyecto IA Diseño",
        render_image_url: renderUrl,
        approved_render_url: renderUrl,
        modules: approvedModules,
        prompt: payload.prompt || payload.design_prompt || "",
        production_status: payload.production_status || "pendiente_bom",
        flow_status: payload.flow_status || "cotizacion_render_aprobado_produccion",
      };

      setPendingPayload(normalizedPayload);
      setMode("bom");
      setClientName(normalizedPayload.client_name || "Cliente general");
      setProjectName(normalizedPayload.project_name || "Proyecto IA Diseño");

      const generatedItems: ProductionItem[] = approvedModules.map((module: any, index: number) => {
        const qty = Math.max(1, Number(module.quantity || 1));

        return {
          id: `ia-module-${Date.now()}-${index}`,
          name: module.name || module.module_name || `Módulo IA ${index + 1}`,
          code: `IA-MOD-${index + 1}`,
          category: "Módulo IA aprobado",
          unit: "Unidad",
          stock: 9999,
          quantity: qty,
          unit_cost: 0,
          total_cost: 0,
          source: "bom",
        };
      });

      if (generatedItems.length > 0) {
        setItems(generatedItems);
      }

      const noteParts: string[] = [];
      noteParts.push("=== RENDER APROBADO DESDE IA DISEÑO ===");
      noteParts.push(`Cliente: ${normalizedPayload.client_name || "Cliente general"}`);
      noteParts.push(`Proyecto: ${normalizedPayload.project_name || "Proyecto IA Diseño"}`);
      noteParts.push(`Estado: ${normalizedPayload.production_status || "pendiente_bom"}`);
      noteParts.push(`Flujo: ${normalizedPayload.flow_status || "cotizacion_render_aprobado_produccion"}`);

      if (normalizedPayload.approved_variant_id || normalizedPayload.approved_variant?.id) {
        noteParts.push(
          `Variante aprobada: ${
            normalizedPayload.approved_variant_id ||
            normalizedPayload.approved_variant?.id
          } - ${
            normalizedPayload.approved_variant_name ||
            normalizedPayload.approved_variant?.name ||
            ""
          }`
        );
      }

      if (renderUrl) {
        noteParts.push(`Render aprobado: ${renderUrl}`);
      }

      if (approvedModules.length) {
        noteParts.push("");
        noteParts.push(`MÓDULOS APROBADOS (${approvedModules.length})`);

        approvedModules.forEach((m: any, index: number) => {
          noteParts.push(
            `${index + 1}. ${m.name || m.module_name || `Módulo ${index + 1}`} | Tipo: ${
              m.type || "N/A"
            } | Cant: ${m.quantity || 1} | Medidas: ${m.width_mm || 0} x ${
              m.depth_mm || 0
            } x ${m.height_mm || 0} mm | Material: ${m.material || "N/A"} | Color: ${
              m.color || "N/A"
            } | Canto: ${m.edge || "N/A"} | Notas: ${m.notes || ""}`
          );
        });
      }

      if (normalizedPayload.prompt) {
        noteParts.push("");
        noteParts.push("PROMPT IA:");
        noteParts.push(normalizedPayload.prompt);
      }

      if (normalizedPayload.notes) {
        noteParts.push("");
        noteParts.push("NOTAS:");
        noteParts.push(normalizedPayload.notes);
      }

      setNotes(noteParts.join("\\n"));
      setMessage(
        `✅ Render aprobado cargado desde IA Diseño. ${approvedModules.length} módulo(s) listo(s) para generar BOM real.`
      );

      localStorage.removeItem("rdwood_production_pending_bom");
      return true;
    } catch (error) {
      console.error("Error leyendo render aprobado desde IA Diseño:", error);
      setMessage("⚠️ No se pudo cargar el render aprobado desde IA Diseño.");
      return false;
    }
  }

  async function refreshAll() {
    setLoading(true);
    await Promise.all([loadProducts(), loadRecipes(), loadOrders(), loadDesignRequests()]);
    setLoading(false);
  }

  async function loadDesignRequests() {
    const next: AIDesignRequestRow[] = [];

    // 1) Proyectos que ya fueron enviados a IA Diseño.
    const ai = await supabase
      .from("ai_design_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (!ai.error && ai.data) {
      next.push(...((ai.data || []).map((row: any) => ({ ...row, source: "ai" as const }))));
    } else if (ai.error) {
      console.warn("No se pudieron cargar ai_design_requests:", ai.error.message);
    }

    // 2) Cotizaciones reales aprobadas o enviadas a diseño.
    // Producción NO crea proyectos; solo lee la cotización ya creada/aprobada.
    const quotes = await supabase
      .from("quotes")
      .select("id, quote_no, client_name, project_name, project_type, total_price, amount_paid, balance, status, created_at")
      .in("status", ["aprobada", "en_diseno_ia", "aprobado", "render_aprobado", "pendiente_bom"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (!quotes.error && quotes.data) {
      const quoteRows = (quotes.data || []).map((q: any) => ({
        id: `quote:${q.id}`,
        source: "quote" as const,
        quote_id: q.id,
        quote_no: q.quote_no,
        client_name: q.client_name,
        project_name: q.project_name || q.quote_no || "Cotización aprobada",
        project_type: q.project_type,
        budget: q.total_price,
        ai_status: q.status || "aprobada",
        notes: `Cotización ${q.quote_no || q.id} cargada desde la tabla quotes. Producción solo prepara BOM; no crea proyectos.`,
        created_at: q.created_at,
      }));

      // Evita duplicar cotizaciones que ya tienen ai_design_requests.
      const existingQuoteIds = new Set(next.map((x) => x.quote_id).filter(Boolean));
      next.push(...quoteRows.filter((q: any) => !existingQuoteIds.has(q.quote_id)));
    } else if (quotes.error) {
      console.warn("No se pudieron cargar quotes aprobadas:", quotes.error.message);
    }

    next.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    setDesignRequests(next);

    if (next.length === 0) {
      setMessage("No hay cotizaciones aprobadas ni solicitudes IA disponibles para producción.");
    } else {
      setMessage(`✅ ${next.length} proyecto(s)/cotización(es) disponibles para Producción.`);
    }
  }

  function normalizeModules(value: any): any[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  async function loadDesignRequestIntoProduction(request: AIDesignRequestRow) {
    let modules = normalizeModules(request.suggested_modules);

    // Si viene directo desde quotes, trae las partidas reales desde quote_items.
    if (request.source === "quote" && request.quote_id) {
      const { data, error } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", request.quote_id)
        .order("created_at", { ascending: true });

      if (error) {
        alert(`No pude cargar las partidas de esa cotización: ${error.message}`);
        return;
      }

      modules = data || [];
    }

    const renderUrl = await resolveDesignApprovedRenderUrl(request);

    const payload: PendingProductionPayload = {
      client_name: request.client_name || "Cliente general",
      project_name: request.project_name || "Proyecto desde cotización",
      quote_id: request.quote_id || undefined,
      render_image_url: renderUrl,
      approved_render_url: renderUrl,
      modules,
      approved_modules: modules,
      prompt: request.ai_prompt || "",
      notes: request.notes || request.ai_response || "",
      flow_status: "cotizacion_medicion_render_produccion",
      production_status: request.ai_status || "pendiente_bom",
    };

    setPendingPayload(payload);
    setMode("bom");
    setClientName(payload.client_name || "Cliente general");
    setProjectName(payload.project_name || "Proyecto desde cotización");

    // 1) Primero cargamos los módulos visuales como respaldo.
    const fallbackItems: ProductionItem[] = modules.map((module: any, index: number) => {
      const qty = Math.max(1, Number(module.quantity || module.cantidad || 1));
      return {
        id: `quote-module-${request.id}-${index}`,
        name: module.description || module.name || module.module_name || `Partida cotización ${index + 1}`,
        code: module.code || `COT-MOD-${index + 1}`,
        category: module.item_type || module.type || request.project_type || "Proyecto cotizado",
        unit: module.unit || "Unidad",
        stock: 9999,
        quantity: qty,
        unit_cost: Number(module.unit_cost || module.costo_unitario || 0),
        total_cost: Number(module.total_cost || 0),
        source: "bom",
      };
    });

    setItems(fallbackItems);

    const noteParts: string[] = [];
    noteParts.push(request.source === "quote" ? "=== COTIZACIÓN APROBADA CARGADA PARA PRODUCCIÓN ===" : "=== PROYECTO CARGADO DESDE COTIZACIÓN / IA DISEÑO ===");
    noteParts.push(`Cliente: ${payload.client_name}`);
    noteParts.push(`Proyecto: ${payload.project_name}`);
    noteParts.push(`Tipo: ${request.project_type || "N/A"}`);
    noteParts.push(`Cotización: ${request.quote_no || request.quote_id || "N/A"}`);
    noteParts.push(`Project ID: ${request.project_id || "N/A"}`);
    noteParts.push(`Estado IA: ${request.ai_status || "N/A"}`);
    noteParts.push(`Presupuesto: ${money(request.budget || 0)}`);
    noteParts.push(`Medidas: ${request.room_width || 0} x ${request.room_depth || 0} x ${request.room_height || 0} mm`);
    if (request.style) noteParts.push(`Estilo: ${request.style}`);
    if (request.color_palette) noteParts.push(`Material / color: ${request.color_palette}`);
    if (renderUrl) noteParts.push(`Render aprobado: ${renderUrl}`);

    if (modules.length) {
      noteParts.push("");
      noteParts.push(`PARTIDAS / MÓDULOS (${modules.length})`);
      modules.forEach((m: any, index: number) => {
        noteParts.push(
          `${index + 1}. ${m.description || m.name || m.module_name || `Módulo ${index + 1}`} | Cant: ${m.quantity || m.cantidad || 1} | Unidad: ${m.unit || "N/A"} | Costo: ${money(m.total_cost || 0)} | Precio: ${money(m.total_price || 0)}`
        );
      });
    }

    if (request.ai_prompt) {
      noteParts.push("");
      noteParts.push("PROMPT IA:");
      noteParts.push(request.ai_prompt);
    }

    if (request.notes || request.ai_response) {
      noteParts.push("");
      noteParts.push("NOTAS:");
      noteParts.push(request.notes || request.ai_response || "");
    }

    setNotes(noteParts.join("\n"));
    setMessage("🔄 Generando BOM modular con costos reales desde inventario...");

    // 2) Ahora conectamos el Production Engine real.
    try {
      const engineProject = {
        id: request.project_id || request.quote_id || request.id,
        name: payload.project_name,
        project_name: payload.project_name,
        client_name: payload.client_name,
        project_type: request.project_type || "centro_tv",
        type: request.project_type || "centro_tv",
        status: request.ai_status || "pendiente_bom",
        total: request.budget || 0,
        notes: noteParts.join("\n"),
        modules,
        approved_modules: modules,
        suggested_modules: modules,
      };

      const engineResult: any = await createProductionFromProject(engineProject);

      if (!engineResult?.success) {
        setMessage(`⚠️ Proyecto cargado, pero Production Engine falló: ${engineResult?.error || "Error desconocido"}`);
        return;
      }

      const enginePieces = Array.isArray(engineResult.pieces) ? engineResult.pieces : [];

      if (enginePieces.length === 0) {
        setMessage(
          engineResult.alreadyExists
            ? "⚠️ Este proyecto ya tenía orden creada. Si fue creada con costo RD$0.00, elimina esa orden vieja en Supabase y vuelve a cargar el proyecto."
            : "⚠️ Production Engine no generó piezas. Se dejaron las partidas originales para revisión manual."
        );
        return;
      }

      const nextItems: ProductionItem[] = enginePieces.map((piece: any, index: number) => {
        const qty = Math.max(1, Number(piece.quantity ?? piece.cantidad ?? 1));
        const materialName =
          piece.material_name ||
          piece.material ||
          piece.nombre_material ||
          piece.item_name ||
          "";
        const displayName =
          piece.product_name ||
          piece.nombre_producto ||
          piece.part_name ||
          piece.piece_name ||
          materialName ||
          `Pieza BOM ${index + 1}`;

        const realInventoryId =
          piece.inventory_item_id ||
          piece.product_id ||
          piece.material_id ||
          "";
        const matchedProduct = findInventoryProductForItem(
          {
            id: realInventoryId || piece.id || `piece-${index}`,
            inventory_item_id: realInventoryId || null,
            product_id: realInventoryId || null,
            material_id: realInventoryId || null,
            name: displayName,
            product_name: piece.product_name || displayName,
            item_name: piece.item_name || null,
            material: piece.material || null,
            material_name: materialName || null,
            code: piece.piece_code || piece.inventory_code || piece.code || "",
            category: piece.module_name || piece.category || piece.source || "BOM modular",
            unit: piece.unit || "Unidad",
            stock: Number(piece.stock ?? piece.stock_before ?? 0),
            quantity: qty,
            unit_cost: Number(piece.unit_cost ?? piece.costo_unitario ?? piece.unit_cost_real ?? 0),
            total_cost: 0,
            source: "bom",
          },
          products
        );
        const linkedInventoryId = matchedProduct?.id || realInventoryId || "";
        const unitCost = productCost(matchedProduct || ({} as InventoryProduct)) || Number(piece.unit_cost ?? piece.costo_unitario ?? piece.unit_cost_real ?? 0);
        const total = Number(piece.total_cost ?? piece.costo_total ?? piece.total_cost_real ?? qty * unitCost);

        const uiId = `${request.id}-bom-${index}-${linkedInventoryId || piece.piece_code || piece.product_name || piece.material_name || piece.nombre_producto || "pieza"}`;

        return {
          id: uiId,
          inventory_item_id: linkedInventoryId || null,
          product_id: linkedInventoryId || null,
          material_id: linkedInventoryId || null,
          production_order_id: piece.production_order_id || piece.order_id || null,
          order_id: piece.order_id || piece.production_order_id || null,
          name: displayName,
          product_name: piece.product_name || displayName,
          item_name: piece.item_name || null,
          material: piece.material || null,
          material_name: materialName || null,
          code:
            piece.piece_code ||
            piece.inventory_code ||
            piece.code ||
            `BOM-${index + 1}`,
          category:
            piece.module_name ||
            piece.category ||
            piece.source ||
            "BOM modular",
          unit: matchedProduct ? productUnit(matchedProduct) : piece.unit || "Unidad",
          stock: matchedProduct ? productStock(matchedProduct) : Number(piece.stock ?? piece.stock_before ?? 0),
          quantity: qty,
          unit_cost: unitCost,
          total_cost: total,
          source: "bom",

          // Datos técnicos para Optimización de Corte PRO
          part_name:
            piece.part_name ||
            piece.piece_name ||
            piece.nombre_pieza ||
            piece.product_name ||
            piece.nombre_producto ||
            piece.material_name ||
            `Pieza BOM ${index + 1}`,
          module_name:
            piece.module_name ||
            piece.modulo ||
            piece.category ||
            piece.source ||
            "Sin módulo",
          width_mm: Number(
            piece.width_mm ??
            piece.ancho_mm ??
            piece.width ??
            piece.ancho ??
            0
          ),
          height_mm: Number(
            piece.height_mm ??
            piece.alto_mm ??
            piece.length_mm ??
            piece.largo_mm ??
            piece.height ??
            piece.largo ??
            0
          ),
          thickness_mm: Number(
            piece.thickness_mm ??
            piece.grosor_mm ??
            piece.thickness ??
            piece.grosor ??
            18
          ),
          edge_top: Boolean(piece.edge_top ?? piece.canto_superior ?? false),
          edge_bottom: Boolean(piece.edge_bottom ?? piece.canto_inferior ?? false),
          edge_left: Boolean(piece.edge_left ?? piece.canto_izquierdo ?? false),
          edge_right: Boolean(piece.edge_right ?? piece.canto_derecho ?? false),
          edge_front: Boolean(piece.edge_front ?? piece.canto_frente ?? false),
          edge_back: Boolean(piece.edge_back ?? piece.canto_atras ?? false),
          allow_rotate: piece.allow_rotate !== false && piece.can_rotate !== false,
        };
      });

      setItems(nextItems);

      // ============================================================
      // PUENTE PRODUCCIÓN → CORTE INTELIGENTE / CNC
      // Guarda las piezas reales generadas por Production Engine para que
      // /corte pueda cargarlas y optimizarlas sin depender del estado React.
      // ============================================================
      if (typeof window !== "undefined") {
        const cuttingPayload = {
          source: "produccion_bom_pro",
          created_at: new Date().toISOString(),
          client_name: payload.client_name || "Cliente general",
          project_name: payload.project_name || "Proyecto desde cotización",
          quote_id: request.quote_id || null,
          ai_design_request_id: request.source === "ai" ? request.id : null,
          production_order_id:
            engineResult?.order?.id ||
            engineResult?.order?.production_order_id ||
            nextItems.find((item) => item.production_order_id)?.production_order_id ||
            null,
          order_code:
            engineResult?.order?.order_code ||
            engineResult?.order?.code ||
            null,
          render_image_url: renderUrl || null,
          pieces: nextItems
            .filter((item) => Number(item.width_mm || 0) > 0 && Number(item.height_mm || 0) > 0)
            .map((item, index) => ({
              id: item.id || `cut-piece-${index + 1}`,
              piece_code: item.code || `PZ-${index + 1}`,
              module_name: item.module_name || item.category || "Sin módulo",
              part_name: item.part_name || item.name || `Pieza ${index + 1}`,
              name: item.name || item.part_name || `Pieza ${index + 1}`,
              material_name: item.name || "Material sin nombre",
              inventory_item_id:
                item.inventory_item_id ||
                item.product_id ||
                item.material_id ||
                null,
              product_id: item.product_id || item.inventory_item_id || null,
              material_id: item.material_id || item.inventory_item_id || null,
              width_mm: Number(item.width_mm || 0),
              height_mm: Number(item.height_mm || 0),
              length_mm: Number(item.height_mm || 0),
              thickness_mm: Number(item.thickness_mm || 18),
              quantity: Number(item.quantity || 1),
              cantidad: Number(item.quantity || 1),
              edge_top: Boolean(item.edge_top),
              edge_bottom: Boolean(item.edge_bottom),
              edge_left: Boolean(item.edge_left),
              edge_right: Boolean(item.edge_right),
              edge_front: Boolean(item.edge_front),
              edge_back: Boolean(item.edge_back),
              allow_rotate: item.allow_rotate !== false,
              can_rotate: item.allow_rotate !== false,
              unit_cost: Number(item.unit_cost || 0),
              total_cost: Number(item.total_cost || 0),
              source: "production_order_items",
            })),
        };

        window.localStorage.setItem("rdwood_cutting_items", JSON.stringify(cuttingPayload));
        window.localStorage.setItem("rdwood_cutting_payload", JSON.stringify(cuttingPayload));
      }

      const linkedCount = nextItems.filter((x) => !!getRealInventoryId(x)).length;
      const unlinkedCount = nextItems.length - linkedCount;

      setMessage(
        unlinkedCount > 0
          ? `✅ BOM modular cargado con costos. Vinculados: ${linkedCount}/${nextItems.length}. Pendientes: ${unlinkedCount}.`
          : `✅ BOM modular cargado completo con costos reales. ${nextItems.length} pieza(s)/material(es).`
      );

      await loadOrders();
    } catch (error: any) {
      console.error("Error conectando Production Engine:", error);
      setMessage(`⚠️ Proyecto cargado, pero no se pudo generar BOM automático: ${error?.message || error}`);
    }
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setMessage(`Error cargando inventory: ${error.message}`);
      return;
    }

    setProducts((data || []) as InventoryProduct[]);
  }

  async function loadRecipes() {
    const { data, error } = await supabase
      .from("product_bom_recipes")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Ejecuta primero el SQL PRO TOTAL para crear product_bom_recipes.");
      setRecipes([]);
      return;
    }

    setRecipes((data || []) as Recipe[]);
  }

  async function loadOrders() {
    const { data } = await supabase
      .from("production_orders")
      .select("id, order_code, code, client_name, project_name, status, total_cost, created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    setOrders((data || []) as OrderRow[]);
  }

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.product_name, p.material, p.code, p.category, p.subcategory]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [products, search]);

  const totalUnits = items.reduce((acc, item) => acc + item.quantity, 0);
  const materialCost = items.reduce((acc, item) => acc + item.total_cost, 0);
  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) || null;
  const laborCost = mode === "bom" ? num(selectedRecipe?.labor_cost) * recipeUnits : newRecipeLabor;
  const overheadCost = mode === "bom" ? num(selectedRecipe?.overhead_cost) * recipeUnits : 0;
  const totalProductionCost = materialCost + laborCost + overheadCost;
  const saleValue = mode === "bom" ? num(selectedRecipe?.sale_price) * recipeUnits : newRecipeSalePrice;
  const profit = saleValue - totalProductionCost;
  const margin = saleValue > 0 ? (profit / saleValue) * 100 : 0;

  function addManualProduct(product: InventoryProduct) {
    const stock = productStock(product);
    if (stock <= 0) {
      alert(`No hay stock disponible para ${productName(product)}`);
      return;
    }

    const existing = items.find((i) => i.id === product.id);
    if (existing) {
      updateQuantity(product.id, existing.quantity + 1);
      return;
    }

    const unitCost = productCost(product);
    setItems((prev) => [
      ...prev,
      {
        id: product.id,
        inventory_item_id: product.id,
        product_id: product.id,
        material_id: product.id,
        name: productName(product),
        code: product.code || "",
        category: product.category || product.subcategory || "General",
        unit: productUnit(product),
        stock,
        quantity: 1,
        unit_cost: unitCost,
        total_cost: unitCost,
        source: mode,
      },
    ]);
  }

  function updateQuantity(id: string, quantity: number) {
    const safeQty = Math.max(0, Number(quantity || 0));
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const qty = Math.min(safeQty, item.stock);
        if (safeQty > item.stock) alert(`No puedes consumir más de ${item.stock} ${item.unit} de ${item.name}`);
        return { ...item, quantity: qty, total_cost: qty * item.unit_cost };
      })
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function linkMaterialToItem(itemId: string, inventoryId: string) {
    const product = products.find((p) => p.id === inventoryId);
    if (!product) return;

    const stock = productStock(product);
    const unitCost = productCost(product);
    const unit = productUnit(product);
    const name = productName(product);

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const qty = Math.max(0, Number(item.quantity || 0));
        return {
          ...item,
          inventory_item_id: product.id,
          product_id: product.id,
          material_id: product.id,
          code: product.code || item.code || "",
          category: product.category || product.subcategory || item.category || "General",
          unit,
          stock,
          unit_cost: unitCost,
          total_cost: qty * unitCost,
          name: item.name.includes(" · ")
            ? item.name
            : `${item.name} · ${name}`,
        };
      })
    );

    setMessage(`✅ Material vinculado: ${name}.`);
  }

  function clearMaterialLink(itemId: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          inventory_item_id: null,
          product_id: null,
          material_id: null,
        };
      })
    );
  }

  async function loadRecipeToOrder() {
    if (!selectedRecipeId) {
      alert("Selecciona una receta BOM.");
      return;
    }

    const units = Math.max(1, Number(recipeUnits || 1));
    const { data: bomItems, error } = await supabase
      .from("product_bom_items")
      .select("*")
      .eq("recipe_id", selectedRecipeId);

    if (error) {
      alert(`Error cargando BOM: ${error.message}`);
      return;
    }

    if (!bomItems || bomItems.length === 0) {
      alert("Esa receta no tiene materiales. Puedes crear una con el botón Guardar receta.");
      return;
    }

    const nextItems: ProductionItem[] = [];
    for (const bom of bomItems as BomItem[]) {
      const inv = products.find((p) => p.id === bom.material_id);
      if (!inv) continue;
      const baseQty = num(bom.quantity_required);
      const waste = num(bom.waste_percent);
      const required = Math.ceil(baseQty * units * (1 + waste / 100) * 100) / 100;
      const unitCost = productCost(inv) || num(bom.unit_cost);
      nextItems.push({
        id: inv.id,
        inventory_item_id: inv.id,
        product_id: inv.id,
        material_id: inv.id,
        name: productName(inv),
        code: inv.code || "",
        category: inv.category || inv.subcategory || "General",
        unit: productUnit(inv),
        stock: productStock(inv),
        quantity: required,
        unit_cost: unitCost,
        total_cost: required * unitCost,
        source: "bom",
      });
    }

    setMode("bom");
    setItems(nextItems);
    setMessage(`BOM cargado: ${selectedRecipe?.recipe_name || "receta"}`);
  }

  async function reserveInventoryForRequisition(inventoryId: string | null, requestedQty: number) {
    const product = products.find((p) => String(p.id) === String(inventoryId));
    if (!product) return { reservedQty: 0, missingQty: requestedQty };

    const available = productAvailable(product);
    const reservedQty = Math.max(0, Math.min(available, requestedQty));
    const missingQty = Math.max(0, requestedQty - reservedQty);

    if (reservedQty <= 0) {
      return { reservedQty: 0, missingQty };
    }

    const nextReserved = productReserved(product) + reservedQty;
    const { error } = await supabase
      .from("inventory")
      .update({
        reserved_stock: nextReserved,
        stock_reserved: nextReserved,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inventoryId);

    if (error) {
      console.warn("No se pudo reservar inventario. Se crea requisicion con faltante:", error.message);
      return { reservedQty: 0, missingQty: requestedQty };
    }

    return { reservedQty, missingQty };
  }

  async function createProductionOrderItems(orderId: string, orderCode: string, source: string) {
    const rows = items.map((item) => {
      const originalPiece: any = item as any;
      const realInventoryId = getRealInventoryId(item);
      const linkedProduct =
        products.find((p) => String(p.id) === String(realInventoryId)) ||
        findInventoryProductForItem(item, products);
      const linkedName = linkedProduct ? productName(linkedProduct) : itemMaterialName(item);
      const widthMm = Number(originalPiece.width_mm ?? originalPiece.ancho_mm ?? originalPiece.width ?? originalPiece.ancho ?? 0) || 0;
      const heightMm = Number(originalPiece.height_mm ?? originalPiece.alto_mm ?? originalPiece.length_mm ?? originalPiece.largo_mm ?? originalPiece.height ?? originalPiece.largo ?? 0) || 0;
      const thicknessMm = Number(originalPiece.thickness_mm ?? originalPiece.grosor_mm ?? originalPiece.thickness ?? originalPiece.grosor ?? 18) || 18;
      const partName = originalPiece.part_name || originalPiece.piece_name || originalPiece.nombre_pieza || item.name;
      const moduleName = originalPiece.module_name || originalPiece.modulo || originalPiece.category || "Sin modulo";

      return {
        production_order_id: orderId,
        order_id: orderId,
        product_name: item.name,
        material_name: linkedName,
        nombre_producto: item.name,
        part_name: partName,
        piece_name: partName,
        module_name: moduleName,
        width_mm: widthMm,
        height_mm: heightMm,
        thickness_mm: thicknessMm,
        edge_top: Boolean(originalPiece.edge_top ?? originalPiece.canto_superior ?? originalPiece.edge_back ?? false),
        edge_bottom: Boolean(originalPiece.edge_bottom ?? originalPiece.canto_inferior ?? originalPiece.edge_front ?? false),
        edge_left: Boolean(originalPiece.edge_left ?? originalPiece.canto_izquierdo ?? false),
        edge_right: Boolean(originalPiece.edge_right ?? originalPiece.canto_derecho ?? false),
        edge_front: Boolean(originalPiece.edge_front ?? originalPiece.canto_frente ?? originalPiece.edge_bottom ?? false),
        edge_back: Boolean(originalPiece.edge_back ?? originalPiece.canto_atras ?? originalPiece.edge_top ?? false),
        allow_rotate: originalPiece.allow_rotate !== false && originalPiece.can_rotate !== false,
        can_rotate: originalPiece.allow_rotate !== false && originalPiece.can_rotate !== false,
        unit: linkedProduct ? productUnit(linkedProduct) : item.unit,
        quantity: item.quantity,
        cantidad: item.quantity,
        unit_cost: linkedProduct ? productCost(linkedProduct) : item.unit_cost,
        costo_unitario: linkedProduct ? productCost(linkedProduct) : item.unit_cost,
        total_cost: item.total_cost,
        costo_total: item.total_cost,
        stock_before: linkedProduct ? productStock(linkedProduct) : item.stock,
        stock_after: linkedProduct ? productStock(linkedProduct) : item.stock,
        source,
        status: "pendiente_requisicion",
        notes: `Material vinculado en requisicion automatica. OP ${orderCode}.`,
      };
    });

    const first = await supabase.from("production_order_items").insert(rows);
    if (!first.error) return;

    const minimal = rows.map((row) => ({
      production_order_id: row.production_order_id,
      order_id: row.order_id,
      product_name: row.product_name,
      material_name: row.material_name,
      nombre_producto: row.nombre_producto,
      unit: row.unit,
      quantity: row.quantity,
      cantidad: row.cantidad,
      unit_cost: row.unit_cost,
      costo_unitario: row.costo_unitario,
      total_cost: row.total_cost,
      costo_total: row.costo_total,
      source: row.source,
      status: row.status,
      stock_before: row.stock_before,
      stock_after: row.stock_after,
    }));

    const second = await supabase.from("production_order_items").insert(minimal);
    if (second.error) throw second.error;
  }

  async function createWarehouseRequisitionForOrder(order: AnyRow, orderCode: string) {
    const lines = buildRequisitionLines(items, products);
    if (!lines.length) {
      throw new Error("No hay materiales para generar requisicion.");
    }

    const existing = await supabase
      .from("warehouse_requisitions")
      .select("id, code, requisition_no")
      .eq("production_order_id", order.id)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (existing.data?.id) return { req: existing.data, code: existing.data.code || existing.data.requisition_no, lines, alreadyExists: true };

    const code = `REQ-BOM-${String(orderCode).replace(/[^a-zA-Z0-9-]/g, "").slice(-12)}-${Date.now().toString().slice(-5)}`;
    const { data: reqData, error: reqError } = await supabase
      .from("warehouse_requisitions")
      .insert({
        code,
        requisition_no: code,
        type: "produccion_automatica",
        tipo: "produccion_automatica",
        request_type: "produccion_automatica",
        requisition_type: "produccion_automatica",
        department: "Produccion",
        departamento: "Produccion",
        requested_department: "Produccion",
        status: "pendiente_autorizacion",
        estado: "pendiente_autorizacion",
        production_order_id: order.id,
        project_id: order.project_id || null,
        project_name: projectName || order.project_name || "Proyecto de produccion",
        reason: `Requisicion automatica de materiales para ${orderCode}: planchas, cantos y herrajes consolidados desde BOM.`,
        urgency: "normal",
        requested_by_name: "Produccion",
        requested_by: "Produccion",
        reserved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (reqError || !reqData) throw reqError || new Error("No se pudo crear la requisicion.");

    const rows: any[] = [];
    for (const line of lines) {
      const reservation = await reserveInventoryForRequisition(line.inventoryId, line.qty);
      const hasInventory = !!line.inventoryId;
      rows.push({
        requisition_id: reqData.id,
        warehouse_requisition_id: reqData.id,
        inventory_id: line.inventoryId,
        product_id: line.inventoryId,
        product_name: line.name,
        item_name: line.name,
        material: line.name,
        qty_requested: line.qty,
        quantity_requested: line.qty,
        cantidad_solicitada: line.qty,
        qty_reserved: reservation.reservedQty,
        quantity_reserved: reservation.reservedQty,
        cantidad_reservada: reservation.reservedQty,
        qty_missing: reservation.missingQty,
        cantidad_faltante: reservation.missingQty,
        qty_approved: 0,
        qty_dispatched: 0,
        unit: line.unit,
        unidad: line.unit,
        status: !hasInventory ? "sin_match_inventario" : reservation.missingQty > 0 ? "reserva_parcial" : "reservada",
        estado: !hasInventory ? "sin_match_inventario" : reservation.missingQty > 0 ? "reserva_parcial" : "reservada",
        destination: "Produccion",
        destino: "Produccion",
        notes: `${line.note} ${hasInventory ? "" : "Sin match de inventario. "}Reservado: ${reservation.reservedQty}/${line.qty}. Faltante: ${reservation.missingQty}.`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const { error: itemError } = await supabase.from("warehouse_requisition_items").insert(rows);
    if (itemError) throw itemError;

    return { req: reqData, code, lines: rows, alreadyExists: false };
  }

  async function sendExistingOrderToRequisition(existingOrderId: string) {
    const response = await apiFetch("/api/warehouse-requisitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-from-order", productionOrderId: existingOrderId }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "No se pudo crear la requisicion.");
    }

    setMessage(
      payload.alreadyExists
        ? `La orden ${payload.orderCode} ya tiene requisicion: ${payload.code}.`
        : `Orden existente ${payload.orderCode} enviada a requisicion ${payload.code}. Reservado: ${payload.reserved}. Faltante: ${payload.missing}.`
    );
    await Promise.all([loadProducts(), loadOrders()]);
  }

  async function saveRecipeFromItems() {
    const name = newRecipeName.trim();
    if (!name) {
      alert("Escribe un nombre para la receta.");
      return;
    }
    if (items.length === 0) {
      alert("Agrega materiales antes de guardar receta.");
      return;
    }

    setProcessing(true);
    const code = `BOM-${Date.now()}`;
    const { data: recipe, error: recipeError } = await supabase
      .from("product_bom_recipes")
      .insert({
        recipe_code: code,
        recipe_name: name,
        product_name: name,
        category: "mueble",
        sale_price: newRecipeSalePrice || 0,
        labor_cost: newRecipeLabor || 0,
        overhead_cost: 0,
        notes,
        is_active: true,
      })
      .select("*")
      .single();

    if (recipeError || !recipe) {
      alert(`Error guardando receta: ${recipeError?.message || "sin respuesta"}`);
      setProcessing(false);
      return;
    }

    const realMaterialItems = items.filter((item) => isValidUuid(item.id));

    if (realMaterialItems.length === 0) {
      alert("La receta fue creada, pero esos módulos IA no son materiales de inventario. Agrega melamina, cantos y herrajes reales desde la lista de materiales para guardar el BOM.");
      setProcessing(false);
      await loadRecipes();
      setSelectedRecipeId(recipe.id);
      return;
    }

    const payload = realMaterialItems.map((item) => ({
      recipe_id: recipe.id,
      material_id: item.id,
      material_name: item.name,
      unit: item.unit,
      quantity_required: item.quantity,
      waste_percent: 0,
      unit_cost: item.unit_cost,
      total_cost: item.total_cost,
    }));

    const { error: itemsError } = await supabase.from("product_bom_items").insert(payload);
    if (itemsError) {
      alert(`Receta creada, pero error guardando materiales: ${itemsError.message}`);
      setProcessing(false);
      return;
    }

    setNewRecipeName("");
    setMessage(`Receta BOM creada: ${name}`);
    await loadRecipes();
    setSelectedRecipeId(recipe.id);
    setProcessing(false);
  }

  async function processProduction() {
    if (items.length === 0) {
      alert("Agrega materiales o carga una receta BOM.");
      return;
    }

    for (const item of items) {
      if (item.quantity <= 0) {
        alert(`Cantidad inválida para ${item.name}`);
        return;
      }

      // Si no hay stock suficiente, la requisicion marcara el faltante para Compras.
    }

    const existingOrderId = Array.from(
      new Set(items.map((item) => item.production_order_id || item.order_id).filter(Boolean))
    )[0] as string | undefined;

    if (existingOrderId) {
      setProcessing(true);
      try {
        await sendExistingOrderToRequisition(existingOrderId);
      } catch (error: any) {
        alert(`Error creando requisicion para la orden existente: ${error?.message || error}`);
      } finally {
        setProcessing(false);
      }
      return;
    }

    setProcessing(true);
    const orderCode = `OP-${Date.now()}`;
    const source = mode === "bom" ? "bom" : "manual";

    const { data: order, error: orderError } = await supabase
      .from("production_orders")
      .insert({
        order_code: orderCode,
        code: orderCode,
        client_name: clientName || "Cliente general",
        project_name: projectName || selectedRecipe?.recipe_name || "Proyecto de producción",
        source,
        status: "pendiente_requisicion",
        total_cost: totalProductionCost,
        total_material_cost: materialCost,
        other_cost: laborCost + overheadCost,
        total_sale_value: saleValue,
        profit,
        profit_percent: margin,
        notes: appendNote(notes, "Orden creada para requisicion automatica. No descuenta inventario hasta despacho de almacen."),
      })
      .select("*")
      .single();

    if (orderError || !order) {
      alert(`Error creando orden: ${orderError?.message || "sin respuesta"}`);
      setProcessing(false);
      return;
    }

    try {
      await createProductionOrderItems(order.id, orderCode, source);
      await sendExistingOrderToRequisition(order.id);
      setProcessing(false);
      return;

      for (const item of items) {
        const realInventoryId = getRealInventoryId(item);

        if (!realInventoryId) {
          throw new Error(
            `La pieza/material "${item.name}" no está vinculada a inventario real.`
          );
        }

        const rpc = await supabase.rpc("rdwood_consume_inventory", {
          p_item_id: realInventoryId,
          p_quantity: item.quantity,
          p_reference_type: "production_order",
          p_reference_id: order.id,
          p_origin: "production",
          p_project_name: projectName,
          p_note: `Consumo ${source} ${orderCode}`,
        });

        if (rpc.error) throw rpc.error;

        const result = Array.isArray(rpc.data) && rpc.data[0] ? rpc.data[0] : null;
        const stockBefore = num(result?.stock_before ?? item.stock);
        const stockAfter = num(result?.stock_after ?? item.stock - item.quantity);
        const unitCost = num(result?.unit_cost ?? item.unit_cost);
        const totalCost = num(result?.total_cost ?? item.total_cost);
        const dbName = result?.product_name || item.name;

        const originalPiece: any = item as any;

        const widthMm =
          Number(
            originalPiece.width_mm ??
              originalPiece.ancho_mm ??
              originalPiece.width ??
              originalPiece.ancho ??
              0
          ) || 0;

        const heightMm =
          Number(
            originalPiece.height_mm ??
              originalPiece.alto_mm ??
              originalPiece.length_mm ??
              originalPiece.largo_mm ??
              originalPiece.height ??
              originalPiece.largo ??
              0
          ) || 0;

        const thicknessMm =
          Number(
            originalPiece.thickness_mm ??
              originalPiece.grosor_mm ??
              originalPiece.thickness ??
              originalPiece.grosor ??
              18
          ) || 18;

        const partName =
          originalPiece.part_name ||
          originalPiece.piece_name ||
          originalPiece.nombre_pieza ||
          originalPiece.name ||
          dbName;

        const moduleName =
          originalPiece.module_name ||
          originalPiece.modulo ||
          originalPiece.category ||
          "Sin módulo";

        const { error: itemError } = await supabase.from("production_order_items").insert({
          production_order_id: order.id,
          order_id: order.id,

          product_id: realInventoryId,
          inventory_item_id: realInventoryId,
          material_id: realInventoryId,

          product_name: dbName,
          material_name: dbName,
          nombre_producto: dbName,

          // Campos para Corte Inteligente PRO
          part_name: partName,
          piece_name: partName,
          module_name: moduleName,
          width_mm: widthMm,
          height_mm: heightMm,
          thickness_mm: thicknessMm,

          edge_top: Boolean(
            originalPiece.edge_top ??
              originalPiece.canto_superior ??
              originalPiece.edge_back ??
              false
          ),
          edge_bottom: Boolean(
            originalPiece.edge_bottom ??
              originalPiece.canto_inferior ??
              originalPiece.edge_front ??
              false
          ),
          edge_left: Boolean(
            originalPiece.edge_left ??
              originalPiece.canto_izquierdo ??
              false
          ),
          edge_right: Boolean(
            originalPiece.edge_right ??
              originalPiece.canto_derecho ??
              false
          ),

          edge_front: Boolean(
            originalPiece.edge_front ??
              originalPiece.canto_frente ??
              originalPiece.edge_bottom ??
              false
          ),
          edge_back: Boolean(
            originalPiece.edge_back ??
              originalPiece.canto_atras ??
              originalPiece.edge_top ??
              false
          ),

          allow_rotate: originalPiece.allow_rotate !== false && originalPiece.can_rotate !== false,
          can_rotate: originalPiece.allow_rotate !== false && originalPiece.can_rotate !== false,

          unit: item.unit,
          quantity: item.quantity,
          cantidad: item.quantity,

          unit_cost: unitCost,
          costo_unitario: unitCost,

          total_cost: totalCost,
          costo_total: totalCost,

          stock_before: stockBefore,
          stock_after: stockAfter,

          source,
          status: "consumido",
        });

        if (itemError) throw itemError;
      }

      await supabase
        .from("production_orders")
        .update({
          status: "completed",
          notes: appendNote(notes, `✅ Producción completada y descontada: ${orderCode}`),
        })
        .eq("id", order.id);

      setMessage(`✅ Producción procesada: ${orderCode}. Inventario descontado y movimientos guardados.`);
      setItems([]);
      await Promise.all([loadProducts(), loadOrders()]);
    } catch (error: any) {
      await supabase
        .from("production_orders")
        .update({
          status: "pending_link_inventory",
          notes: appendNote(
            notes,
            `⚠️ Producción pendiente por inventario / vínculo. Error: ${error?.message || error}`
          ),
        })
        .eq("id", order.id);

      await loadOrders();

      alert(
        `Error procesando producción: ${error?.message || error}\n\n` +
          `La orden quedó en espera por inventario. Agrega stock o vincula el material y vuelve a intentar.`
      );
    }

    setProcessing(false);
  }

  async function retryPendingOrder(order: OrderRow) {
    setMessage(
      `🔄 Orden ${order.order_code || order.code || order.id.slice(0, 8)} está pendiente. ` +
        `Para reintentar con inventario nuevo, vuelve a cargar el proyecto y presiona Procesar producción.`
    );

    alert(
      "Esta orden quedó en espera. El flujo seguro ahora es:\n\n" +
        "1. Asegura que el inventario tenga stock suficiente.\n" +
        "2. Carga nuevamente el proyecto desde el selector.\n" +
        "3. Presiona Procesar producción y descontar inventario.\n\n" +
        "Así se recalcula el BOM con el inventario actualizado."
    );
  }


  return (
    <div className="min-h-screen w-full max-w-none overflow-x-hidden bg-[#020617] text-white">
      <div className="border-b border-slate-800/80 bg-[#020817] px-6 py-7 2xl:px-8">
        <div className="flex w-full max-w-none flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.45em] text-cyan-400">RD WOOD SYSTEM</p>
            <h1 className="mt-2 text-4xl font-black">Producción PRO</h1>
            <p className="text-sm text-slate-400">Producción manual + BOM automático con costos, stock y auditoría real.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 w-full max-w-none min-w-0">
            <TopStat label="Productos" value={products.length} />
            <TopStat label="Disponibles" value={products.filter((p) => productStock(p) > 0).length} accent="text-emerald-300" />
            <TopStat label="Materiales" value={items.length} />
            <TopStat label="Costo orden" value={money(totalProductionCost)} accent="text-emerald-300" />
          </div>
        </div>
      </div>

      <main className="w-full max-w-none px-4 py-5 sm:px-5 lg:px-6 2xl:px-8"><div className="grid w-full max-w-none gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(430px,0.85fr)] min-w-0">
        <section className="min-w-0 rounded-[28px] border border-cyan-900/40 bg-[#061126]/95 p-5 shadow-2xl shadow-cyan-950/10">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-blue-600/20 p-3 text-cyan-300"><Factory /></div>
              <div>
                <h2 className="text-2xl font-black">Materiales disponibles</h2>
                <p className="text-sm text-slate-400">Selecciona manualmente o carga una receta BOM.</p>
              </div>
            </div>
            <button onClick={refreshAll} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/60 bg-blue-600/20 px-4 py-3 font-black text-blue-100 hover:bg-blue-600/30 disabled:opacity-60">
              <RefreshCcw size={18} className={loading ? "animate-spin" : ""} /> Actualizar
            </button>
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_0.45fr] w-full max-w-none min-w-0">
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 font-bold outline-none focus:border-blue-500" placeholder="Buscar producto, código, categoría..." />
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-[#020617] p-1 w-full max-w-none min-w-0">
              <button onClick={() => setMode("bom")} className={`rounded-xl px-3 py-2 font-black ${mode === "bom" ? "bg-blue-600 text-white" : "text-slate-400"}`}>BOM Auto</button>
              <button onClick={() => setMode("manual")} className={`rounded-xl px-3 py-2 font-black ${mode === "manual" ? "bg-blue-600 text-white" : "text-slate-400"}`}>Manual</button>
            </div>
          </div>

          <div className="mb-5 rounded-3xl border border-cyan-500/20 bg-cyan-950/20 p-4">
            <div className="mb-3 flex items-center gap-2"><Sparkles className="text-cyan-300" /><h3 className="font-black">Producción automática por BOM</h3></div>
            <div className="grid gap-3 lg:grid-cols-[1fr_0.25fr_auto] w-full max-w-none min-w-0">
              <select value={selectedRecipeId} onChange={(e) => setSelectedRecipeId(e.target.value)} className="rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 font-bold outline-none">
                <option value="">Selecciona receta BOM...</option>
                {recipes.map((r) => <option key={r.id} value={r.id}>{r.recipe_name}</option>)}
              </select>
              <input type="number" min={1} value={recipeUnits} onChange={(e) => setRecipeUnits(Number(e.target.value))} className="rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 font-bold outline-none" placeholder="Unidades" />
              <button onClick={loadRecipeToOrder} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 font-black hover:bg-cyan-500"><PackagePlus size={18} /> Cargar BOM</button>
            </div>
          </div>

          <div className="mb-5 rounded-3xl border border-emerald-500/20 bg-emerald-950/10 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList className="text-emerald-300" />
              <h3 className="font-black">Proyectos enviados desde Cotización / IA Diseño</h3>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] w-full max-w-none min-w-0">
              <select
                value={selectedDesignRequestId}
                onChange={(e) => setSelectedDesignRequestId(e.target.value)}
                className="rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 font-bold outline-none"
              >
                <option value="">Selecciona proyecto aprobado...</option>
                {designRequests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {`${request.source === "quote" ? "COT" : "IA"} · ${request.quote_no || ""} · ${request.project_name || "Proyecto"} · ${request.client_name || "Cliente"} · ${request.ai_status || "sin estado"}`}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const request = designRequests.find((x) => x.id === selectedDesignRequestId);
                  if (!request) return alert("Selecciona un proyecto de Cotización / IA Diseño.");
                  void loadDesignRequestIntoProduction(request);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-black hover:bg-emerald-500"
              >
                <PackagePlus size={18} /> Cargar proyecto
              </button>
            </div>
            <p className="mt-3 text-xs font-bold text-slate-400">
              Esto lee quotes aprobadas y ai_design_requests. Producción no crea proyectos; solo carga la cotización/proyecto para preparar BOM real.
            </p>
          </div>

          <div className="max-h-[560px] w-full w-full overflow-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[780px] text-sm">
              <thead className="sticky top-0 bg-[#020617] text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Costo</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const stock = productStock(p);
                  return (
                    <tr key={p.id} className="border-t border-slate-800 hover:bg-blue-950/20">
                      <td className="px-4 py-3"><p className="font-black">{productName(p)}</p><p className="text-xs text-slate-500">{p.code || "SIN-CODIGO"}</p></td>
                      <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${stock <= 0 ? "bg-red-500/20 text-red-300" : stock <= 2 ? "bg-yellow-500/20 text-yellow-300" : "bg-emerald-500/15 text-emerald-300"}`}>{stock} {productUnit(p)}</span></td>
                      <td className="px-4 py-3 font-black">{money(productCost(p))}</td>
                      <td className="px-4 py-3 text-slate-300">{p.category || p.subcategory || "General"}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => addManualProduct(p)} disabled={stock <= 0 || productCost(p) <= 0} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 font-black hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400"><Plus size={16} /> Consumir</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="min-w-0 rounded-[28px] border border-cyan-900/40 bg-[#061126]/95 p-5 shadow-2xl shadow-cyan-950/10">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-cyan-600/20 p-3 text-cyan-300"><ClipboardList /></div>
              <div><h2 className="text-2xl font-black">Orden de producción</h2><p className="text-sm text-slate-400">Detalle real + costos + movimientos auditables.</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => void loadPendingFromIADesign()} className="rounded-2xl border border-emerald-500/40 bg-emerald-600/15 px-4 py-2 font-black text-emerald-200 hover:bg-emerald-600/25">Cargar IA</button>
              <button onClick={() => { setItems([]); setPendingPayload(null); setSelectedDesignRequestId(""); }} className="rounded-2xl border border-slate-700 px-4 py-2 font-black text-slate-300 hover:border-red-500 hover:text-red-300">Limpiar</button>
            </div>
          </div>

          {pendingPayload && (
            <div className="mb-4 rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-300">
                Render aprobado desde IA Diseño
              </p>

              <h3 className="mt-2 text-lg font-black text-white">
                {pendingPayload.project_name || "Proyecto IA Diseño"}
              </h3>

              <p className="text-sm text-slate-300">
                Cliente: {pendingPayload.client_name || "Cliente general"}
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Módulos aprobados: {(pendingPayload.approved_modules || pendingPayload.modules || []).length}
              </p>

              <p className="mt-1 text-sm font-bold text-amber-200">
                Estado: pendiente BOM · Producción maneja BOM, corte, canteo y ensamblaje.
              </p>

              {(pendingPayload.approved_render_url || pendingPayload.render_image_url) && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#020617]">
                  <img
                    src={pendingPayload.approved_render_url || pendingPayload.render_image_url}
                    alt="Render aprobado"
                    className="max-h-[260px] w-full object-contain"
                  />
                </div>
              )}

              {(pendingPayload.approved_render_url || pendingPayload.render_image_url) && (
                <a
                  href={pendingPayload.approved_render_url || pendingPayload.render_image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-500"
                >
                  Ver render aprobado
                </a>
              )}
            </div>
          )}

          <div className="mb-4 grid gap-3 md:grid-cols-2 w-full max-w-none min-w-0">
            <Input label="Cliente" value={clientName} onChange={setClientName} />
            <Input label="Tipo" value={mode} onChange={() => null} disabled />
            <div className="md:col-span-2"><Input label="Proyecto" value={projectName} onChange={setProjectName} /></div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="md:col-span-2 min-h-[88px] rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 font-bold outline-none focus:border-blue-500" placeholder="Comentario de producción, piezas, cliente, medidas..." />
          </div>

          <div className="mb-4 max-h-[390px] w-full space-y-3 overflow-auto pr-1">
            {items.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-[#020617] p-10 text-center text-slate-500"><Boxes className=" mb-3" /><p className="font-black text-slate-300">Orden vacía</p><p>Agrega materiales manuales o carga una receta BOM.</p></div>
            ) : items.map((item, index) => (
              <div key={`${item.id || "item"}-${index}-${(item as any).module_name || ""}-${(item as any).part_name || item.name || item.code || ""}`} className="rounded-3xl border border-slate-800 bg-[#020617] p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.code} · Disponible {item.stock} {item.unit} · {item.source.toUpperCase()}
                    </p>
                    {!getRealInventoryId(item) && (
                      <p className="mt-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-black text-amber-200">
                        Pendiente vincular a inventario real
                      </p>
                    )}
                  </div>
                  <button onClick={() => removeItem(item.id)} className="rounded-xl p-2 text-red-300 hover:bg-red-500/10"><Trash2 size={18} /></button>
                </div>

                <div className="mb-3 rounded-2xl border border-slate-800 bg-[#0b1220] p-3">
                  <label className="text-xs font-black uppercase text-slate-400">Material vinculado</label>
                  <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto] w-full max-w-none min-w-0">
                    <select
                      value={getRealInventoryId(item)}
                      onChange={(e) => {
                        if (e.target.value) linkMaterialToItem(item.id, e.target.value);
                        else clearMaterialLink(item.id);
                      }}
                      className="w-full rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400"
                    >
                      <option value="">Seleccionar material del inventario...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {productName(p)} · Stock {productStock(p)} {productUnit(p)} · {money(productCost(p))}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => clearMaterialLink(item.id)}
                      className="rounded-2xl border border-slate-700 px-4 py-3 text-xs font-black text-slate-300 hover:border-red-400 hover:text-red-200"
                    >
                      Quitar vínculo
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_1fr_0.8fr] w-full max-w-none min-w-0">
                  <div><label className="text-xs font-black uppercase text-slate-400">Cantidad</label><input type="number" min={0} max={item.stock} value={item.quantity} onChange={(e) => updateQuantity(item.id, Number(e.target.value))} className="mt-1 w-full rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 font-black outline-none focus:border-blue-500" /></div>
                  <div><label className="text-xs font-black uppercase text-slate-400">Costo unitario</label><div className="mt-1 rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 font-black">{money(item.unit_cost)}</div></div>
                  <div><label className="text-xs font-black uppercase text-slate-400">Total línea</label><div className="mt-1 rounded-2xl border border-slate-700 bg-[#020617] px-4 py-3 text-xl font-black text-emerald-300">{money(item.total_cost)}</div></div>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4 rounded-3xl border border-slate-800 bg-[#020617] p-4">
            <SummaryRow label="Materiales" value={items.length} />
            <SummaryRow label="Unidades" value={totalUnits} />
            <SummaryRow label="Costo materiales" value={money(materialCost)} />
            <SummaryRow label="Mano de obra / indirectos" value={money(laborCost + overheadCost)} />
            <div className="mt-3 border-t border-slate-800 pt-3"><SummaryRow label="Costo producción" value={money(totalProductionCost)} big /></div>
            {saleValue > 0 && <><SummaryRow label="Precio estimado" value={money(saleValue)} /><SummaryRow label="Utilidad estimada" value={`${money(profit)} · ${margin.toFixed(1)}%`} /></>}
          </div>

          <button onClick={processProduction} disabled={processing || items.length === 0} className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-4 font-black hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50"><Factory size={18} /> Crear orden y requisicion de materiales</button>

          <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 px-4 py-3 text-sm font-bold text-blue-100">{message}</div>

          <div className="mt-5 rounded-3xl border border-slate-800 bg-[#020617] p-4">
            <div className="mb-3 flex items-center gap-2"><Save className="text-emerald-300" /><h3 className="font-black">Crear receta BOM desde esta orden</h3></div>
            <div className="grid gap-3 md:grid-cols-3 w-full max-w-none min-w-0">
              <input value={newRecipeName} onChange={(e) => setNewRecipeName(e.target.value)} className="rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 font-bold outline-none" placeholder="Nombre receta: Cocina Premium" />
              <input type="number" value={newRecipeSalePrice} onChange={(e) => setNewRecipeSalePrice(Number(e.target.value))} className="rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 font-bold outline-none" placeholder="Precio venta" />
              <input type="number" value={newRecipeLabor} onChange={(e) => setNewRecipeLabor(Number(e.target.value))} className="rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 font-bold outline-none" placeholder="Mano obra" />
            </div>
            <button onClick={saveRecipeFromItems} disabled={processing || items.length === 0} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-600/15 px-4 py-3 font-black text-emerald-200 hover:bg-emerald-600/25 disabled:opacity-50"><Save size={18} /> Guardar receta BOM</button>
          </div>
        </section>
      </div></main>

      <div className="grid w-full max-w-none gap-5 px-6 pb-8 2xl:px-8 xl:grid-cols-2 min-w-0">
        <section className="rounded-[28px] border border-cyan-900/40 bg-[#061126]/95 p-5 shadow-2xl shadow-cyan-950/10">
          <div className="mb-4 flex items-center gap-2"><AlertTriangle className="text-yellow-300" /><h2 className="text-xl font-black">Regla del módulo</h2></div>
          <ol className="list-decimal space-y-2 pl-5 text-sm font-bold text-slate-300">
            <li>Produccion manual y BOM crean una requisicion automatica al almacen.</li>
            <li>Las planchas se estiman por area de piezas + merma antes de corte.</li>
            <li>Cantos y herrajes se consolidan por material para compras/almacen.</li>
            <li>El inventario se descuenta cuando almacen despacha la requisicion.</li>
            <li>La orden guarda detalle en production_order_items para corte y trazabilidad.</li>
          </ol>
        </section>

        <section className="rounded-[28px] border border-cyan-900/40 bg-[#061126]/95 p-5 shadow-2xl shadow-cyan-950/10">
          <div className="mb-4 flex items-center gap-2"><ClipboardList className="text-cyan-300" /><h2 className="text-xl font-black">Últimas órdenes</h2></div>
          <div className="max-h-[260px] w-full overflow-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="sticky top-0 bg-[#020617] text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">Orden</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Proyecto</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Costo</th></tr></thead>
              <tbody>{orders.map((o) => <tr key={o.id} className="border-t border-slate-800"><td className="px-4 py-3 font-black text-cyan-300">{o.order_code || o.code || o.id.slice(0, 8)}</td><td className="px-4 py-3">{o.client_name || "Cliente"}</td><td className="px-4 py-3">{o.project_name || "Proyecto"}</td><td className="px-4 py-3"><span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-black text-blue-200">{o.status || "en_proceso"}</span></td><td className="px-4 py-3 text-right font-black text-emerald-300">
                    <div>{money(o.total_cost)}</div>
                    {String(o.status || "").includes("pending") && (
                      <button
                        onClick={() => retryPendingOrder(o)}
                        className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-200 hover:bg-amber-500/20"
                      >
                        Reintentar
                      </button>
                    )}
                  </td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function TopStat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return <div className="min-w-[130px] rounded-3xl border border-slate-800 bg-[#020617] p-4"><p className="text-xs text-slate-400">{label}</p><p className={`mt-1 text-2xl font-black ${accent || "text-white"}`}>{value}</p></div>;
}

function Input({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return <label className="block"><span className="text-xs font-black uppercase text-slate-400">{label}</span><input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-700 bg-[#0f172a] px-4 py-3 font-bold outline-none focus:border-blue-500 disabled:opacity-70" /></label>;
}

function SummaryRow({ label, value, big }: { label: string; value: string | number; big?: boolean }) {
  return <div className="flex items-center justify-between py-1"><span className="text-sm font-bold text-slate-400">{label}</span><span className={`${big ? "text-3xl" : "text-base"} font-black ${big ? "text-emerald-300" : "text-white"}`}>{value}</span></div>;
}
