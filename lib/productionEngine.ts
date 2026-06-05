// lib/productionEngine.ts
// RD WOOD SYSTEM - Production Engine PRO
// BOM por módulos + vínculo automático con inventario real.
// REEMPLAZA COMPLETAMENTE ESTE ARCHIVO.
//
// IMPORTANTE:
// - Este motor genera BOM por módulo.
// - Busca artículos reales en inventory para costo e ID.
// - NO descuenta inventario al cargar proyecto.
// - El descuento real ocurre cuando haces clic en:
//   "Procesar producción y descontar inventario".

"use client";

import { supabase } from "@/lib/supabase";

export type ProjectLike = {
  id: string;
  name?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  project_type?: string | null;
  type?: string | null;
  status?: string | null;
  total?: number | null;
  amount?: number | null;
  price?: number | null;
  total_amount?: number | null;
  linear_feet?: number | null;
  notes?: string | null;

  modules?: ApprovedModule[];
  approved_modules?: ApprovedModule[];
  suggested_modules?: ApprovedModule[];
};

export type ApprovedModule = {
  id?: string;
  name?: string;
  module_name?: string;
  description?: string;
  type?: string;
  item_type?: string;
  quantity?: number;
  cantidad?: number;
  width_mm?: number;
  depth_mm?: number;
  height_mm?: number;
  material?: string;
  color?: string;
  edge?: string;
  notes?: string;
  unit?: string;
  total_cost?: number;
  total_price?: number;
};

type InventoryProduct = {
  id: string;
  code?: string | null;
  name?: string | null;
  product_name?: string | null;
  material?: string | null;
  category?: string | null;
  subcategory?: string | null;
  unit?: string | null;
  unidad?: string | null;
  stock?: number | null;
  quantity?: number | null;
  cost_price?: number | null;
  unit_cost?: number | null;
  purchase_cost?: number | null;
  sale_price?: number | null;
  unit_price?: number | null;
};


type ScrapMaterial = {
  id: string;
  inventory_item_id?: string | null;
  material_id?: string | null;
  parent_inventory_id?: string | null;
  code?: string | null;
  name?: string | null;
  material?: string | null;
  material_name?: string | null;
  color?: string | null;
  status?: string | null;
  source?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  length_mm?: number | null;
  ancho_mm?: number | null;
  largo_mm?: number | null;
  thickness_mm?: number | null;
  grosor_mm?: number | null;
  cost?: number | null;
  unit_cost?: number | null;
  tiene_veta?: boolean | null;
  grain_direction?: string | null;
  veta_direction?: string | null;
  created_at?: string | null;
};

type ScrapMatch = {
  scrap: ScrapMaterial;
  score: number;
  usableWidth: number;
  usableHeight: number;
  wasteM2: number;
};

type GeneratedPiece = {
  part_name: string;
  module_name: string;
  module_type: string;
  module_index: number;
  material_name: string;
  inventory_search: string;
  color: string;
  edge_name?: string;
  length: number;
  width: number;
  thickness: number;
  quantity: number;
  unit_price: number;
  is_cut_piece: boolean;
  grain_sensitive?: boolean;
  material_kind:
    | "melamina"
    | "fondo"
    | "canto"
    | "corredera"
    | "bisagra"
    | "soporte"
    | "tornillo"
    | "herrajes"
    | "retazo";
};

type LinkedPiece = GeneratedPiece & {
  scrap_id?: string | null;
  material_source?: "RETAZO" | "TABLERO" | "INVENTARIO";
  inventory_item_id: string | null;
  product_id: string | null;
  material_id: string | null;
  inventory_name: string | null;
  inventory_code: string | null;
  stock: number;
  unit: string;
  unit_cost_real: number;
  total_cost_real: number;
};

type ConsolidatedMaterial = {
  material_name: string;
  inventory_item_id: string | null;
  unit: string;
  quantity: number;
  estimated_cost: number;
};

const MELAMINE_WHITE_18 = "Melamina Blanco Alto Brillo 18mm 4x8";
const MELAMINE_BARDOLINO_18 = "Melamina Bardolino 18mm 7x8";
const MELAMINE_ROBLE_18 = "Melamina Roble Natural 18mm 7x8";
const MELAMINE_NEGRO_18 = "Melamina Negro Mate 18mm 7x8";
const MELAMINE_CAOBA_18 = "Melamina Caoba 18mm 7x8";
const EDGE_WHITE_22 = "Canto PVC Blanco 22mm 1mm";
const EDGE_BARDOLINO_22 = "Canto PVC Bardolino 22mm 1mm";
const EDGE_ROBLE_22 = "Canto PVC Roble 22mm 1mm";
const EDGE_CAOBA_22 = "Canto PVC Caoba 22mm 1mm";

function moneyNumber(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function firstText(...values: any[]) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function safeNumber(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function createCode(prefix: string) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 900000 + 100000);
  return `${prefix}-${y}${m}${day}-${random}`;
}

function projectName(project: ProjectLike) {
  return firstText(project.name, project.project_name, "Proyecto sin nombre");
}

function clientName(project: ProjectLike) {
  return firstText(project.client_name, project.customer_name, "Cliente sin nombre");
}

function projectTotal(project: ProjectLike) {
  return moneyNumber(project.total_amount ?? project.total ?? project.amount ?? project.price);
}

function normalizeText(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function moduleName(module: ApprovedModule, index: number) {
  return firstText(
    module.name,
    module.module_name,
    module.description,
    `Módulo ${index + 1}`
  );
}

function moduleType(module: ApprovedModule) {
  return firstText(module.type, module.item_type, module.name, module.description, "mueble");
}

function moduleQty(module: ApprovedModule) {
  return Math.max(1, safeNumber(module.quantity ?? module.cantidad, 1));
}

function moduleWidth(module: ApprovedModule, fallback = 1200) {
  return safeNumber(module.width_mm, fallback);
}

function moduleDepth(module: ApprovedModule, fallback = 450) {
  return safeNumber(module.depth_mm, fallback);
}

function moduleHeight(module: ApprovedModule, fallback = 720) {
  return safeNumber(module.height_mm, fallback);
}

function colorLabelFromText(value: any, fallback = "Bardolino") {
  const raw = normalizeText(value);

  if (raw.includes("bardolino") || raw.includes("baldolino") || raw.includes("madera") || raw.includes("wood")) {
    return "Bardolino";
  }

  if (raw.includes("blanco")) return "Blanco Alto Brillo";
  if (raw.includes("roble")) return "Roble";
  if (raw.includes("caoba")) return "Caoba";
  if (raw.includes("negro")) return "Negro";

  return fallback;
}

function materialForColor(color: any) {
  const label = colorLabelFromText(color);

  if (label === "Caoba") return MELAMINE_CAOBA_18;
  if (label === "Roble") return MELAMINE_ROBLE_18;
  if (label === "Blanco Alto Brillo") return MELAMINE_WHITE_18;
  if (label === "Negro") return MELAMINE_NEGRO_18;
  return MELAMINE_BARDOLINO_18;
}

function edgeForColor(color: any) {
  const label = colorLabelFromText(color);

  if (label === "Caoba") return EDGE_CAOBA_22;
  if (label === "Roble") return EDGE_ROBLE_22;
  if (label === "Blanco Alto Brillo") return EDGE_WHITE_22;
  return EDGE_BARDOLINO_22;
}

function colorFromMaterialName(value: any) {
  return colorLabelFromText(value, "");
}

function colorFromModule(module: ApprovedModule) {
  return colorLabelFromText(firstText(module.color, module.material, "Bardolino"));
}

function materialFromModule(module: ApprovedModule) {
  const material = firstText(module.material, "Melamina 18mm");
  const color = firstText(module.color, "Bardolino");
  const raw = normalizeText(`${material} ${color}`);

  if (raw.includes("caoba")) return MELAMINE_CAOBA_18;
  if (raw.includes("bardolino") || raw.includes("baldolino") || raw.includes("madera")) return MELAMINE_BARDOLINO_18;
  if (raw.includes("roble")) return MELAMINE_ROBLE_18;
  if (raw.includes("blanco")) return MELAMINE_WHITE_18;
  if (raw.includes("negro")) return MELAMINE_NEGRO_18;

  return MELAMINE_BARDOLINO_18;
}

function edgeFromModule(module: ApprovedModule) {
  const raw = normalizeText(`${module.edge || ""} ${module.color || ""}`);

  if (raw.includes("caoba")) return EDGE_CAOBA_22;
  if (raw.includes("bardolino") || raw.includes("baldolino") || raw.includes("madera")) return EDGE_BARDOLINO_22;
  if (raw.includes("blanco")) return EDGE_WHITE_22;
  if (raw.includes("roble")) return EDGE_ROBLE_22;

  return EDGE_BARDOLINO_22;
}

function estimatePieceCost(length: number, width: number, thickness = 18) {
  const areaM2 = Math.max(0.01, (Number(length || 0) * Number(width || 0)) / 1_000_000);
  const baseCostM2 = thickness <= 6 ? 650 : 1850;
  return Math.round(areaM2 * baseCostM2);
}

function addPiece(
  out: GeneratedPiece[],
  module: ApprovedModule,
  moduleIndex: number,
  partName: string,
  length: number,
  width: number,
  qty: number,
  options?: {
    material?: string;
    inventorySearch?: string;
    thickness?: number;
    unitPrice?: number;
    edge?: string;
    color?: string;
    isCutPiece?: boolean;
    grainSensitive?: boolean;
    materialKind?: GeneratedPiece["material_kind"];
  }
) {
  const modName = moduleName(module, moduleIndex);
  const modType = moduleType(module);
  const materialName = options?.material || materialFromModule(module);
  const color = options?.color || colorFromMaterialName(materialName) || colorFromModule(module);

  out.push({
    part_name: partName,
    module_name: modName,
    module_type: modType,
    module_index: moduleIndex,
    material_name: materialName,
    inventory_search: options?.inventorySearch || materialName,
    color,
    edge_name: options?.edge ?? edgeForColor(color),
    length: Math.round(length),
    width: Math.round(width),
    thickness: options?.thickness ?? 18,
    quantity: Math.max(1, Math.round(qty)),
    unit_price: options?.unitPrice ?? estimatePieceCost(length, width, options?.thickness ?? 18),
    is_cut_piece: options?.isCutPiece ?? true,
    grain_sensitive: options?.grainSensitive ?? true,
    material_kind: options?.materialKind || "melamina",
  });
}

function addHardware(
  out: GeneratedPiece[],
  module: ApprovedModule,
  moduleIndex: number,
  partName: string,
  qty: number,
  unitPrice: number,
  materialName: string,
  materialKind: GeneratedPiece["material_kind"]
) {
  const modName = moduleName(module, moduleIndex);
  const modType = moduleType(module);

  out.push({
    part_name: partName,
    module_name: modName,
    module_type: modType,
    module_index: moduleIndex,
    material_name: materialName,
    inventory_search: materialName,
    color: "",
    edge_name: "",
    length: 0,
    width: 0,
    thickness: 0,
    quantity: Math.max(1, Math.round(qty)),
    unit_price: unitPrice,
    is_cut_piece: false,
    grain_sensitive: false,
    material_kind: materialKind,
  });
}

function addEdgeBanding(
  out: GeneratedPiece[],
  module: ApprovedModule,
  moduleIndex: number,
  partName: string,
  meters: number,
  options?: {
    edge?: string;
    color?: string;
  }
) {
  const edge = options?.edge || edgeFromModule(module);
  const color = options?.color || colorFromMaterialName(edge) || colorFromModule(module);
  const modName = moduleName(module, moduleIndex);
  const modType = moduleType(module);

  out.push({
    part_name: partName,
    module_name: modName,
    module_type: modType,
    module_index: moduleIndex,
    material_name: edge,
    inventory_search: edge,
    color,
    edge_name: edge,
    length: 0,
    width: 0,
    thickness: 0,
    quantity: Math.max(0.1, Number(meters.toFixed(2))),
    unit_price: Math.round(meters * 35),
    is_cut_piece: false,
    grain_sensitive: false,
    material_kind: "canto",
  });
}

function perimeterMeters(length: number, width: number, qty = 1) {
  return ((Number(length || 0) + Number(width || 0)) * 2 * qty) / 1000;
}

function generatePiecesForModule(module: ApprovedModule, moduleIndex: number): GeneratedPiece[] {
  const out: GeneratedPiece[] = [];

  const name = normalizeText(moduleName(module, moduleIndex));
  const type = normalizeText(moduleType(module));
  const qtyModule = moduleQty(module);

  const w = moduleWidth(module, 1200);
  const d = moduleDepth(module, 450);
  const h = moduleHeight(module, 720);

  const material = materialFromModule(module);
  const fondoMaterial = "MDF Fondo 6mm 4x8";
  const tvExteriorMaterial = MELAMINE_BARDOLINO_18;
  const tvInteriorMaterial = MELAMINE_WHITE_18;
  const tvExteriorEdge = EDGE_BARDOLINO_22;
  const tvInteriorEdge = EDGE_WHITE_22;

  const isTvBase =
    name.includes("credenza") ||
    name.includes("modulo bajo") ||
    name.includes("base inferior") ||
    type.includes("base inferior");

  const isTvPanel = name.includes("panel") || type.includes("panel");

  const isShelf =
    name.includes("repisa") ||
    name.includes("biblioteca") ||
    name.includes("librero") ||
    type.includes("repisa");

  const isCloset = type.includes("closet") || name.includes("closet");

  const isKitchenBase =
    type.includes("cocina base") ||
    name.includes("modulos base") ||
    name.includes("modulo base");

  const isKitchenUpper =
    type.includes("aereo") ||
    type.includes("aereo") ||
    name.includes("aereo") ||
    name.includes("gabinete");

  const isKitchenTower =
    type.includes("torre") ||
    name.includes("torre") ||
    name.includes("despensa");

  for (let copy = 1; copy <= qtyModule; copy++) {
    const suffix = qtyModule > 1 ? ` #${copy}` : "";

    if (isTvBase) {
      const drawerCount = 3;
      const drawerFrontWidth = Math.max(100, Math.round(w / drawerCount) - 4);
      const drawerFrontHeight = Math.max(100, h - 80);

      addPiece(out, module, moduleIndex, `Lateral izquierdo${suffix}`, h, d, 1, { material: tvExteriorMaterial, color: "Bardolino", edge: tvExteriorEdge });
      addPiece(out, module, moduleIndex, `Lateral derecho${suffix}`, h, d, 1, { material: tvExteriorMaterial, color: "Bardolino", edge: tvExteriorEdge });
      addPiece(out, module, moduleIndex, `Piso${suffix}`, w, d, 1, { material: tvExteriorMaterial, color: "Bardolino", edge: tvExteriorEdge });
      addPiece(out, module, moduleIndex, `Techo${suffix}`, w, d, 1, { material: tvExteriorMaterial, color: "Bardolino", edge: tvExteriorEdge });
      addPiece(out, module, moduleIndex, `División interna${suffix}`, Math.max(100, h - 40), d, 2, { material: tvInteriorMaterial, color: "Blanco Alto Brillo", edge: tvInteriorEdge });
      for (let drawer = 1; drawer <= drawerCount; drawer++) {
        addPiece(out, module, moduleIndex, `Frente gaveta ${drawer}${suffix}`, drawerFrontWidth, drawerFrontHeight, 1, { material: tvExteriorMaterial, color: "Bardolino", edge: tvExteriorEdge });
      }
      addPiece(out, module, moduleIndex, `Fondo 6mm${suffix}`, Math.max(100, w - 20), Math.max(100, h - 20), 1, {
        material: fondoMaterial,
        inventorySearch: "MDF Fondo 6mm 4x8",
        thickness: 6,
        unitPrice: estimatePieceCost(w, h, 6),
        edge: "",
        materialKind: "fondo",
      });

      addEdgeBanding(out, module, moduleIndex, `Canto PVC Bardolino módulo bajo${suffix}`, perimeterMeters(w, d, 2) + perimeterMeters(h, d, 2), { edge: tvExteriorEdge, color: "Bardolino" });
      addEdgeBanding(out, module, moduleIndex, `Canto PVC Blanco divisiones internas${suffix}`, perimeterMeters(Math.max(100, h - 40), d, 2), { edge: tvInteriorEdge, color: "Blanco Alto Brillo" });
      addHardware(out, module, moduleIndex, `Correderas módulo bajo${suffix}`, drawerCount, 450, "Corredera Telescópica 45cm", "corredera");
      addHardware(out, module, moduleIndex, `Tornillos módulo bajo${suffix}`, 1, 150, "Tornillo 1 1/4", "tornillo");
      addHardware(out, module, moduleIndex, `Minifix módulo bajo${suffix}`, 1, 250, "Minifix", "herrajes");
      continue;
    }

    if (isTvPanel) {
      const sideWidth = Math.min(420, Math.max(180, Math.round(w * 0.14)));
      const railHeight = Math.min(180, Math.max(80, Math.round(h * 0.06)));
      const centerWidth = Math.max(100, w - sideWidth * 2);
      const centerHeight = Math.max(100, h - railHeight * 2);

      addPiece(out, module, moduleIndex, `Panel central blanco TV${suffix}`, centerHeight, centerWidth, 1, { material: tvInteriorMaterial, color: "Blanco Alto Brillo", edge: tvInteriorEdge });
      addPiece(out, module, moduleIndex, `Lateral decorativo izquierdo Bardolino${suffix}`, h, sideWidth, 1, { material: tvExteriorMaterial, color: "Bardolino", edge: tvExteriorEdge });
      addPiece(out, module, moduleIndex, `Lateral decorativo derecho Bardolino${suffix}`, h, sideWidth, 1, { material: tvExteriorMaterial, color: "Bardolino", edge: tvExteriorEdge });
      addPiece(out, module, moduleIndex, `Faja superior Bardolino${suffix}`, w, railHeight, 1, { material: tvExteriorMaterial, color: "Bardolino", edge: tvExteriorEdge });
      addPiece(out, module, moduleIndex, `Faja inferior Bardolino${suffix}`, w, railHeight, 1, { material: tvExteriorMaterial, color: "Bardolino", edge: tvExteriorEdge });
      addPiece(out, module, moduleIndex, `Listón refuerzo posterior${suffix}`, Math.max(100, w), 80, 2, { material: tvExteriorMaterial, color: "Bardolino", edge: tvExteriorEdge });
      addEdgeBanding(out, module, moduleIndex, `Canto PVC Blanco panel central TV${suffix}`, perimeterMeters(centerHeight, centerWidth, 1), { edge: tvInteriorEdge, color: "Blanco Alto Brillo" });
      addEdgeBanding(out, module, moduleIndex, `Canto PVC Bardolino marco TV${suffix}`, perimeterMeters(h, sideWidth, 2) + perimeterMeters(w, railHeight, 2), { edge: tvExteriorEdge, color: "Bardolino" });
      addHardware(out, module, moduleIndex, `Soportes panel TV${suffix}`, 1, 650, "Soporte 182-14", "soporte");
      continue;
    }

    if (isShelf) {
      addPiece(out, module, moduleIndex, `Lateral izquierdo biblioteca / repisa${suffix}`, h, d, 1, { material: tvInteriorMaterial, color: "Blanco Alto Brillo", edge: tvInteriorEdge });
      addPiece(out, module, moduleIndex, `Lateral derecho biblioteca / repisa${suffix}`, h, d, 1, { material: tvInteriorMaterial, color: "Blanco Alto Brillo", edge: tvInteriorEdge });
      addPiece(out, module, moduleIndex, `Tapa superior biblioteca / repisa${suffix}`, w, d, 1, { material: tvInteriorMaterial, color: "Blanco Alto Brillo", edge: tvInteriorEdge });
      addPiece(out, module, moduleIndex, `Tapa inferior biblioteca / repisa${suffix}`, w, d, 1, { material: tvInteriorMaterial, color: "Blanco Alto Brillo", edge: tvInteriorEdge });
      addPiece(out, module, moduleIndex, `Entrepaños biblioteca / repisa${suffix}`, Math.max(100, w - 36), d, 3, { material: tvInteriorMaterial, color: "Blanco Alto Brillo", edge: tvInteriorEdge });
      addEdgeBanding(out, module, moduleIndex, `Canto PVC Blanco biblioteca / repisa${suffix}`, perimeterMeters(w, d, 5), { edge: tvInteriorEdge, color: "Blanco Alto Brillo" });
      addHardware(out, module, moduleIndex, `Soportes repisas${suffix}`, 1, 250, "Soporte de Repisa", "soporte");
      continue;
    }

    if (isCloset) {
      addPiece(out, module, moduleIndex, `Lateral izquierdo closet${suffix}`, h, d, 1, { material });
      addPiece(out, module, moduleIndex, `Lateral derecho closet${suffix}`, h, d, 1, { material });
      addPiece(out, module, moduleIndex, `Piso closet${suffix}`, w, d, 1, { material });
      addPiece(out, module, moduleIndex, `Techo closet${suffix}`, w, d, 1, { material });
      addPiece(out, module, moduleIndex, `Entrepaños closet${suffix}`, Math.max(100, w - 36), d, 3, { material });
      addPiece(out, module, moduleIndex, `Fondo closet 6mm${suffix}`, Math.max(100, w - 20), Math.max(100, h - 20), 1, {
        material: fondoMaterial,
        inventorySearch: "MDF Fondo 6mm 4x8",
        thickness: 6,
        unitPrice: estimatePieceCost(w, h, 6),
        edge: "",
        materialKind: "fondo",
      });
      addEdgeBanding(out, module, moduleIndex, `Canto PVC closet${suffix}`, perimeterMeters(w, d, 5) + perimeterMeters(h, d, 2));
      addHardware(out, module, moduleIndex, `Tubo colgador closet${suffix}`, 1, 850, "Tubo ovalado cromado", "herrajes");
      addHardware(out, module, moduleIndex, `Soportes closet${suffix}`, 1, 250, "Soporte de Repisa", "soporte");
      continue;
    }

    if (isKitchenBase || isKitchenUpper || isKitchenTower) {
      addPiece(out, module, moduleIndex, `Lateral izquierdo cocina${suffix}`, h, d, 1, { material });
      addPiece(out, module, moduleIndex, `Lateral derecho cocina${suffix}`, h, d, 1, { material });
      addPiece(out, module, moduleIndex, `Piso cocina${suffix}`, w, d, 1, { material });
      addPiece(out, module, moduleIndex, `Techo cocina${suffix}`, w, d, 1, { material });
      addPiece(out, module, moduleIndex, `Entrepaño cocina${suffix}`, Math.max(100, w - 36), d, 1, { material });
      addPiece(out, module, moduleIndex, `Fondo cocina 6mm${suffix}`, Math.max(100, w - 20), Math.max(100, h - 20), 1, {
        material: fondoMaterial,
        inventorySearch: "MDF Fondo 6mm 4x8",
        thickness: 6,
        unitPrice: estimatePieceCost(w, h, 6),
        edge: "",
        materialKind: "fondo",
      });
      addEdgeBanding(out, module, moduleIndex, `Canto PVC cocina${suffix}`, perimeterMeters(w, d, 4) + perimeterMeters(h, d, 2));
      addHardware(out, module, moduleIndex, `Bisagras cocina${suffix}`, 2, 250, "Bisagra Cierre Suave", "bisagra");
      addHardware(out, module, moduleIndex, `Tornillos cocina${suffix}`, 1, 150, "Tornillo 1 1/4", "tornillo");
      continue;
    }

    addPiece(out, module, moduleIndex, `Lateral izquierdo${suffix}`, h, d, 1, { material });
    addPiece(out, module, moduleIndex, `Lateral derecho${suffix}`, h, d, 1, { material });
    addPiece(out, module, moduleIndex, `Piso${suffix}`, w, d, 1, { material });
    addPiece(out, module, moduleIndex, `Techo${suffix}`, w, d, 1, { material });
    addPiece(out, module, moduleIndex, `Fondo 6mm${suffix}`, Math.max(100, w - 20), Math.max(100, h - 20), 1, {
      material: fondoMaterial,
      inventorySearch: "MDF Fondo 6mm 4x8",
      thickness: 6,
      unitPrice: estimatePieceCost(w, h, 6),
      edge: "",
      materialKind: "fondo",
    });
    addEdgeBanding(out, module, moduleIndex, `Canto PVC general${suffix}`, perimeterMeters(w, d, 4) + perimeterMeters(h, d, 2));
    addHardware(out, module, moduleIndex, `Herrajes generales${suffix}`, 1, 450, "Herrajes varios", "herrajes");
  }

  return out;
}

function fallbackModulesFromProject(project: ProjectLike): ApprovedModule[] {
  const type = firstText(project.project_type, project.type, "centro_tv").toLowerCase();

  if (type.includes("cocina")) {
    return [
      { id: "base", name: "Módulos base", type: "Cocina base", quantity: 3, width_mm: 600, depth_mm: 560, height_mm: 720, material: "Melamina 18mm", color: "blanco", edge: "PVC 1mm visible" },
      { id: "aereo", name: "Gabinetes aéreos", type: "Cocina aéreo", quantity: 3, width_mm: 600, depth_mm: 330, height_mm: 700, material: "Melamina 18mm", color: "blanco", edge: "PVC 1mm visible" },
    ];
  }

  if (type.includes("closet")) {
    return [
      { id: "closet", name: "Módulo closet", type: "Closet", quantity: 1, width_mm: 1200, depth_mm: 550, height_mm: 2400, material: "Melamina 18mm", color: "blanco", edge: "PVC 1mm visible" },
    ];
  }

  return [
    { id: "modulo-bajo", name: "Credenza TV baja", type: "Base inferior", quantity: 1, width_mm: 1800, depth_mm: 450, height_mm: 650, material: "Melamina 18mm", color: "madera", edge: "PVC 1mm visible" },
    { id: "panel-tv", name: "Panel decorativo TV", type: "Panel pared", quantity: 1, width_mm: 2200, depth_mm: 80, height_mm: 2200, material: "Melamina 18mm", color: "madera", edge: "PVC 1mm visible" },
    { id: "repisas-tv", name: "Repisas / biblioteca", type: "Repisas", quantity: 2, width_mm: 700, depth_mm: 320, height_mm: 1800, material: "Melamina 18mm", color: "madera", edge: "PVC 1mm visible" },
  ];
}

function getModulesFromLocalStorage(project: ProjectLike): ApprovedModule[] {
  if (typeof window === "undefined") return [];

  const keys = ["rdwood_ia_design_approved", "rdwood_production_pending_bom"];

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const payload = JSON.parse(raw);
      const modules = payload?.approved_modules || payload?.modules || payload?.suggested_modules || [];

      if (!Array.isArray(modules) || modules.length === 0) continue;

      const quoteId = payload?.quote_id || payload?.quote?.id;
      const projectNameFromPayload = payload?.project_name || payload?.quote?.project_name;

      const sameQuote = quoteId && String(quoteId) === String(project.id);
      const sameProject =
        projectNameFromPayload &&
        String(projectNameFromPayload).toLowerCase().trim() ===
          String(project.project_name || project.name || "").toLowerCase().trim();

      if (sameQuote || sameProject || !String(project.id).startsWith("quote:")) {
        return modules;
      }
    } catch {
      // ignore
    }
  }

  return [];
}

function getApprovedModules(project: ProjectLike): ApprovedModule[] {
  const direct = project.approved_modules || project.modules || project.suggested_modules || [];
  if (Array.isArray(direct) && direct.length > 0) return direct;

  const fromLocal = getModulesFromLocalStorage(project);
  if (fromLocal.length > 0) return fromLocal;

  return fallbackModulesFromProject(project);
}

function inventoryDisplayName(item: InventoryProduct) {
  return firstText(item.name, item.product_name, item.material, item.code, "Artículo");
}

function inventoryStock(item: InventoryProduct) {
  return moneyNumber(item.stock ?? item.quantity);
}

function inventoryUnit(item: InventoryProduct) {
  return firstText(item.unit, item.unidad, "Unidad");
}

function inventoryCost(item: InventoryProduct) {
  return moneyNumber(item.cost_price ?? item.unit_cost ?? item.purchase_cost ?? item.unit_price ?? item.sale_price);
}

function scoreInventoryMatch(item: InventoryProduct, piece: GeneratedPiece) {
  const haystack = normalizeText(
    [
      item.code,
      item.name,
      item.product_name,
      item.material,
      item.category,
      item.subcategory,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const search = normalizeText(piece.inventory_search);
  const material = normalizeText(piece.material_name);
  const pieceColor = normalizeText(`${piece.color || ""} ${piece.material_name || ""} ${piece.inventory_search || ""}`);
  const productLooksWhite = haystack.includes("blanco");
  const productLooksBardolino = haystack.includes("bardolino") || haystack.includes("baldolino");

  let score = 0;

  if (!haystack) return 0;

  if (search && haystack.includes(search)) score += 100;
  if (material && haystack.includes(material)) score += 80;
  if ((pieceColor.includes("bardolino") || pieceColor.includes("baldolino")) && productLooksWhite) score -= 90;
  if (pieceColor.includes("blanco") && productLooksBardolino) score -= 90;

  if (piece.material_kind === "melamina") {
    if (haystack.includes("melamina")) score += 35;
    if (haystack.includes("18")) score += 15;
    if (haystack.includes("7x8")) score += 15;
    if (haystack.includes("4x8")) score += 10;
    if (normalizeText(piece.color).includes("bardolino") && haystack.includes("bardolino")) score += 40;
    if (normalizeText(piece.color).includes("roble") && haystack.includes("roble")) score += 40;
    if (normalizeText(piece.color).includes("blanco") && haystack.includes("blanco")) score += 40;
    if (normalizeText(piece.color).includes("caoba") && haystack.includes("caoba")) score += 40;
  }

  if (piece.material_kind === "fondo") {
    if (haystack.includes("mdf")) score += 40;
    if (haystack.includes("fondo")) score += 40;
    if (haystack.includes("6")) score += 15;
  }

  if (piece.material_kind === "canto") {
    if (haystack.includes("canto")) score += 45;
    if (haystack.includes("pvc")) score += 35;
    if (haystack.includes("22")) score += 15;
    if (normalizeText(piece.color).includes("bardolino") && haystack.includes("bardolino")) score += 35;
    if (normalizeText(piece.color).includes("roble") && haystack.includes("roble")) score += 35;
    if (normalizeText(piece.color).includes("blanco") && haystack.includes("blanco")) score += 35;
    if (normalizeText(piece.color).includes("caoba") && haystack.includes("caoba")) score += 35;
  }

  if (piece.material_kind === "corredera") {
    if (haystack.includes("corredera")) score += 80;
    if (haystack.includes("45")) score += 20;
  }

  if (piece.material_kind === "bisagra") {
    if (haystack.includes("bisagra")) score += 90;
    if (haystack.includes("suave") || haystack.includes("cierre")) score += 20;
  }

  if (piece.material_kind === "soporte") {
    if (haystack.includes("soporte")) score += 90;
  }

  if (piece.material_kind === "tornillo") {
    if (haystack.includes("tornillo")) score += 90;
    if (haystack.includes("1 1/4") || haystack.includes("114")) score += 20;
  }

  if (piece.material_kind === "herrajes") {
    if (haystack.includes("minifix")) score += 40;
    if (haystack.includes("herraje")) score += 20;
  }

  return score;
}


function scrapName(scrap: ScrapMaterial) {
  return firstText(
    scrap.name,
    scrap.material_name,
    scrap.material,
    scrap.code,
    "Retazo disponible"
  );
}

function scrapWidth(scrap: ScrapMaterial) {
  return moneyNumber(scrap.width_mm ?? scrap.ancho_mm);
}

function scrapHeight(scrap: ScrapMaterial) {
  return moneyNumber(scrap.height_mm ?? scrap.length_mm ?? scrap.largo_mm);
}

function scrapThickness(scrap: ScrapMaterial) {
  return moneyNumber(scrap.thickness_mm ?? scrap.grosor_mm) || 18;
}

function scrapCost(scrap: ScrapMaterial) {
  return moneyNumber(scrap.cost ?? scrap.unit_cost);
}

function scrapStatusAvailable(scrap: ScrapMaterial) {
  const status = normalizeText(scrap.status || "");
  if (!status) return true;
  return ["disponible", "available", "activo", "libre", "stock"].some((word) =>
    status.includes(word)
  );
}


function scrapMatchesColor(scrap: ScrapMaterial, piece: GeneratedPiece) {
  const haystack = normalizeText(
    [
      scrap.name,
      scrap.material_name,
      scrap.material,
      scrap.color,
      scrap.code,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const color = normalizeText(piece.color);
  const mat = normalizeText(piece.material_name);

  if (!color && !mat) return true;
  if (color && haystack.includes(color)) return true;

  const colorWords = ["bardolino", "roble", "blanco", "negro", "caoba", "gris", "nogal", "haya"];
  for (const word of colorWords) {
    if (color.includes(word) && haystack.includes(word)) return true;
    if (mat.includes(word) && haystack.includes(word)) return true;
  }

  return haystack.length < 8;
}

function scrapColorScore(scrap: ScrapMaterial, piece: GeneratedPiece) {
  const haystack = normalizeText(
    [scrap.name, scrap.material_name, scrap.material, scrap.color, scrap.code]
      .filter(Boolean)
      .join(" ")
  );

  const color = normalizeText(piece.color);
  const material = normalizeText(piece.material_name);

  if (!haystack) return 10;
  if (color && haystack.includes(color)) return 100;

  const colors = ["bardolino", "roble", "blanco", "negro", "caoba", "gris", "nogal", "haya"];
  for (const c of colors) {
    if ((color.includes(c) || material.includes(c)) && haystack.includes(c)) return 90;
  }

  if (scrapMatchesColor(scrap, piece)) return 40;
  return -120;
}

function scrapHasGrain(scrap: ScrapMaterial) {
  const text = normalizeText(
    [scrap.name, scrap.material_name, scrap.material, scrap.color, scrap.grain_direction, scrap.veta_direction]
      .filter(Boolean)
      .join(" ")
  );

  return Boolean(
    scrap.tiene_veta ||
      scrap.grain_direction ||
      scrap.veta_direction ||
      text.includes("veta") ||
      text.includes("bardolino") ||
      text.includes("roble") ||
      text.includes("nogal") ||
      text.includes("caoba")
  );
}

function pieceRequiresGrain(piece: GeneratedPiece) {
  const text = normalizeText([piece.part_name, piece.material_name, piece.color].join(" "));
  return Boolean(
    piece.grain_sensitive ||
      text.includes("bardolino") ||
      text.includes("roble") ||
      text.includes("nogal") ||
      text.includes("caoba") ||
      text.includes("veta")
  );
}

function scrapGrainScore(scrap: ScrapMaterial, piece: GeneratedPiece, rotated: boolean) {
  const requires = pieceRequiresGrain(piece);
  const hasScrapGrain = scrapHasGrain(scrap);

  if (!requires) return rotated ? 5 : 10;
  if (!hasScrapGrain) return -80;

  // Si la pieza es sensible a veta, penalizar rotación.
  if (rotated) return -200;

  return 90;
}

function scrapThicknessScore(scrap: ScrapMaterial, piece: GeneratedPiece) {
  const st = scrapThickness(scrap);
  const pt = moneyNumber(piece.thickness) || 18;
  const diff = Math.abs(st - pt);

  if (diff === 0) return 100;
  if (diff <= 1) return 70;
  if (diff <= 2) return 30;
  return -999;
}

function scrapFitsPiece(scrap: ScrapMaterial, piece: GeneratedPiece) {
  if (!piece.is_cut_piece) return null;

  const sw = scrapWidth(scrap);
  const sh = scrapHeight(scrap);
  const pw = moneyNumber(piece.width);
  const ph = moneyNumber(piece.length);

  if (sw <= 0 || sh <= 0 || pw <= 0 || ph <= 0) return null;

  const thicknessScore = scrapThicknessScore(scrap, piece);
  if (thicknessScore < 0) return null;

  const fitsNormal = pw <= sw && ph <= sh;
  const fitsRotated = ph <= sw && pw <= sh && !pieceRequiresGrain(piece);

  if (!fitsNormal && !fitsRotated) return null;

  const evaluate = (rotated: boolean) => {
    const pieceW = rotated ? ph : pw;
    const pieceH = rotated ? pw : ph;
    const scrapM2 = (sw * sh) / 1_000_000;
    const pieceM2 = (pieceW * pieceH) / 1_000_000;
    const wasteM2 = Math.max(0, scrapM2 - pieceM2);
    const wastePct = scrapM2 > 0 ? wasteM2 / scrapM2 : 1;

    let score = 0;
    score += 1000; // retazo prioritario
    score += scrapColorScore(scrap, piece);
    score += thicknessScore;
    score += scrapGrainScore(scrap, piece, rotated);
    score += Math.max(0, 400 - wastePct * 400);
    score += Math.max(0, 120 - wasteM2 * 60);

    // Preferir retazos más ajustados para no destruir piezas grandes.
    const leftoverW = Math.abs(sw - pieceW);
    const leftoverH = Math.abs(sh - pieceH);
    score += Math.max(0, 80 - (leftoverW + leftoverH) / 30);

    return {
      scrap,
      score,
      usableWidth: sw,
      usableHeight: sh,
      wasteM2,
      rotated,
      wastePct,
    } as ScrapMatch & { rotated: boolean; wastePct: number };
  };

  const candidates = [
    fitsNormal ? evaluate(false) : null,
    fitsRotated ? evaluate(true) : null,
  ].filter(Boolean) as Array<ScrapMatch & { rotated: boolean; wastePct: number }>;

  if (!candidates.length) return null;

  return candidates.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.01) return b.score - a.score;
    return a.wasteM2 - b.wasteM2;
  })[0];
}

async function loadAvailableScraps() {
  try {
    const { data, error } = await supabase
      .from("inventory_scraps")
      .select("*")
      .order("width_mm", { ascending: true });

    if (error) {
      console.warn("No se pudo cargar inventory_scraps:", error.message);
      return [] as ScrapMaterial[];
    }

    return ((data || []) as ScrapMaterial[]).filter(scrapStatusAvailable);
  } catch (error: any) {
    console.warn("inventory_scraps no disponible todavía:", error?.message || error);
    return [] as ScrapMaterial[];
  }
}

function findBestScrapForPiece(piece: GeneratedPiece, scraps: ScrapMaterial[], usedScrapIds: Set<string>) {
  if (!piece.is_cut_piece) return null;
  if (!["melamina", "fondo"].includes(piece.material_kind)) return null;

  let best: ScrapMatch | null = null;

  for (const scrap of scraps) {
    if (!scrap?.id || usedScrapIds.has(String(scrap.id))) continue;

    const match = scrapFitsPiece(scrap, piece);
    if (!match) continue;

    if (!best || match.score > best.score || (match.score === best.score && match.wasteM2 < best.wasteM2)) {
      best = match;
    }
  }

  return best;
}


async function loadInventoryProducts() {
  const { data, error } = await supabase
    .from("inventory")
    .select(
      "id, code, name, product_name, material, category, subcategory, unit, unidad, stock, quantity, cost_price, unit_cost, purchase_cost, sale_price, unit_price"
    );

  if (error) {
    console.warn("No se pudo cargar inventory para vincular BOM:", error.message);
    return [];
  }

  return (data || []) as InventoryProduct[];
}

async function linkPiecesToInventory(pieces: GeneratedPiece[]): Promise<LinkedPiece[]> {
  const inventory = await loadInventoryProducts();
  const scraps = await loadAvailableScraps();
  const usedScrapIds = new Set<string>();

  return pieces.map((piece) => {
    // 1) PRIMERO RETAZOS: solo para piezas cortables de melamina/fondo.
    const scrapMatch = findBestScrapForPiece(piece, scraps, usedScrapIds);

    if (scrapMatch?.scrap?.id) {
      usedScrapIds.add(String(scrapMatch.scrap.id));

      const unitCost = scrapCost(scrapMatch.scrap) || Math.max(0, Math.round(piece.unit_price * 0.25));

      return {
        ...piece,
        material_name: `RETAZO · ${scrapName(scrapMatch.scrap)}${(scrapMatch as any).rotated ? " · ROTADO" : ""}`,
        inventory_search: scrapName(scrapMatch.scrap),
        scrap_id: scrapMatch.scrap.id,
        material_source: "RETAZO",
        inventory_item_id:
          scrapMatch.scrap.inventory_item_id ||
          scrapMatch.scrap.material_id ||
          scrapMatch.scrap.parent_inventory_id ||
          null,
        product_id:
          scrapMatch.scrap.inventory_item_id ||
          scrapMatch.scrap.material_id ||
          scrapMatch.scrap.parent_inventory_id ||
          null,
        material_id:
          scrapMatch.scrap.inventory_item_id ||
          scrapMatch.scrap.material_id ||
          scrapMatch.scrap.parent_inventory_id ||
          null,
        inventory_name: `RETAZO · ${scrapName(scrapMatch.scrap)}${(scrapMatch as any).rotated ? " · ROTADO" : ""}`,
        inventory_code: scrapMatch.scrap.code || `RET-${String(scrapMatch.scrap.id).slice(0, 8)}`,
        stock: 1,
        unit: "pieza",
        unit_cost_real: unitCost,
        total_cost_real: unitCost * piece.quantity,
      };
    }

    // 2) SI NO HAY RETAZO, usar inventario normal.
    let best: InventoryProduct | null = null;
    let bestScore = 0;

    for (const item of inventory) {
      const score = scoreInventoryMatch(item, piece);
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    }

    const hasGoodMatch = best && bestScore >= 45;
    const unitCost = hasGoodMatch ? inventoryCost(best as InventoryProduct) : piece.unit_price;
    const unit = hasGoodMatch ? inventoryUnit(best as InventoryProduct) : piece.is_cut_piece ? "pieza" : "und";
    const stock = hasGoodMatch ? inventoryStock(best as InventoryProduct) : 0;

    return {
      ...piece,
      scrap_id: null,
      material_source: "INVENTARIO",
      inventory_item_id: hasGoodMatch ? (best as InventoryProduct).id : null,
      product_id: hasGoodMatch ? (best as InventoryProduct).id : null,
      material_id: hasGoodMatch ? (best as InventoryProduct).id : null,
      inventory_name: hasGoodMatch ? inventoryDisplayName(best as InventoryProduct) : null,
      inventory_code: hasGoodMatch ? (best as InventoryProduct).code || null : null,
      stock,
      unit,
      unit_cost_real: unitCost,
      total_cost_real: unitCost * piece.quantity,
    };
  });
}

function consolidateMaterials(pieces: LinkedPiece[]): ConsolidatedMaterial[] {
  const map = new Map<string, ConsolidatedMaterial>();

  for (const piece of pieces) {
    const key = piece.scrap_id ? `RETAZO:${piece.scrap_id}` : piece.inventory_item_id || piece.material_name || "Material sin nombre";
    const current =
      map.get(key) ||
      {
        material_name: piece.inventory_name || piece.material_name,
        inventory_item_id: piece.inventory_item_id,
        unit: piece.unit || (piece.is_cut_piece ? "pieza" : "und"),
        quantity: 0,
        estimated_cost: 0,
      };

    current.quantity += piece.quantity;
    current.estimated_cost += piece.total_cost_real;
    map.set(key, current);
  }

  return Array.from(map.values()).map((item) => ({
    ...item,
    quantity: Number(item.quantity.toFixed(3)),
    estimated_cost: Math.round(item.estimated_cost),
  }));
}

async function findExistingProductionOrder(projectId: string) {
  const { data, error } = await supabase
    .from("production_orders")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("No se pudo verificar orden existente:", error.message);
    return null;
  }

  return data;
}

function buildProductionOrderItem(orderId: string, projectId: string, piece: LinkedPiece) {
  const qty = moneyNumber(piece.quantity) || 1;
  const unitCost = moneyNumber(piece.unit_cost_real);
  const totalCost = qty * unitCost;

  /*
    NO insertamos inventory_item_id/product_id/material_id aquí.
    Motivo: tu BD tiene trigger que puede intentar descontar stock al insertar.
    Para el UI sí devolvemos esos IDs en pieces.
    Así el descuento ocurre solamente en processProduction().
  */
  return {
    production_order_id: orderId,
    order_id: orderId,

    product_name: `${piece.module_name} · ${piece.part_name}${piece.scrap_id ? " · RETAZO" : ""}`,
    material_name: piece.inventory_name || piece.material_name,
    nombre_producto: `${piece.module_name} · ${piece.part_name}${piece.scrap_id ? " · RETAZO" : ""}`,

    unit: piece.unit || (piece.is_cut_piece ? "pieza" : "und"),
    quantity: qty,
    cantidad: qty,

    unit_cost: unitCost,
    costo_unitario: unitCost,
    total_cost: totalCost,
    costo_total: totalCost,

    source: piece.scrap_id ? "bom_modular_retazo" : piece.inventory_item_id ? "bom_modular_linked" : "bom_modular_unlinked",
    status: piece.inventory_item_id || piece.scrap_id ? "pendiente_bom" : "pendiente_vincular",

    stock_before: null,
    stock_after: null,

    module_name: piece.module_name,
    part_name: piece.part_name,
    piece_name: piece.part_name,

    // CAMPOS CRÍTICOS PARA CORTE INTELIGENTE / CNC
    // En este sistema length = largo/alto de la pieza y width = ancho de la pieza.
    // Corte lee width_mm y height_mm; por eso también guardamos esos campos aquí.
    width_mm: piece.width || null,
    height_mm: piece.length || null,
    thickness_mm: piece.thickness || null,

    // Compatibilidad con versiones anteriores.
    length: piece.length || null,
    width: piece.width || null,
    thickness: piece.thickness || null,

    edge_name: piece.edge_name || "",
    edge_front: Boolean(piece.edge_name && piece.is_cut_piece),
    edge_back: false,
    edge_left: false,
    edge_right: false,
    allow_rotate: piece.grain_sensitive ? false : true,
    can_rotate: piece.grain_sensitive ? false : true,
  };
}

async function insertOrderItemsSafe(items: any[]) {
  const first = await supabase.from("production_order_items").insert(items);
  if (!first.error) return;

  const message = String(first.error.message || "");

  if (
    message.includes("schema cache") ||
    message.includes("column") ||
    message.includes("Could not find")
  ) {
    const minimal = items.map((item) => ({
      production_order_id: item.production_order_id,
      order_id: item.order_id,
      product_name: item.product_name,
      material_name: item.material_name,
      nombre_producto: item.nombre_producto,
      unit: item.unit,
      quantity: item.quantity,
      cantidad: item.cantidad,
      unit_cost: item.unit_cost,
      costo_unitario: item.costo_unitario,
      total_cost: item.total_cost,
      costo_total: item.costo_total,
      source: item.source,
      status: item.status,
      stock_before: null,
      stock_after: null,
    }));

    const second = await supabase.from("production_order_items").insert(minimal);
    if (second.error) throw second.error;
    return;
  }

  throw first.error;
}

/*
  Si ya existe una orden para el proyecto, necesitamos devolver piezas reales al UI
  para que no quede en cero ni vacío.
*/
async function loadExistingOrderItemsForUI(orderId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("production_order_items")
    .select("*")
    .or(`production_order_id.eq.${orderId},order_id.eq.${orderId}`);

  if (error) {
    console.warn("No se pudieron leer piezas existentes:", error.message);
    return [];
  }

  return data || [];
}


// ============================================================
// FASE 2 – DESCUENTO AUTOMÁTICO Y AJUSTE DEL RETAZO
// Estas funciones se usan cuando la producción/corte confirma consumo.
// ============================================================

export type ScrapConsumptionPiece = {
  scrap_id?: string | null;
  production_order_id?: string | null;
  order_id?: string | null;
  project_name?: string | null;
  part_name?: string | null;
  module_name?: string | null;
  width?: number | null;
  length?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  length_mm?: number | null;
  thickness?: number | null;
  thickness_mm?: number | null;
  material_name?: string | null;
  quantity?: number | null;
};

function usedPieceWidthMm(piece: ScrapConsumptionPiece) {
  return moneyNumber(piece.width_mm ?? piece.width);
}

function usedPieceHeightMm(piece: ScrapConsumptionPiece) {
  return moneyNumber(piece.height_mm ?? piece.length_mm ?? piece.length);
}

function usedPieceThicknessMm(piece: ScrapConsumptionPiece) {
  return moneyNumber(piece.thickness_mm ?? piece.thickness) || 18;
}

function minimumUsefulScrapAreaM2() {
  // Menos de 0.08 m² normalmente no conviene guardar.
  return 0.08;
}

function minimumUsefulScrapSideMm() {
  // Retazos menores de 180mm de lado suelen ser poco útiles.
  return 180;
}

function buildRemainingScrapsFromCut(scrap: ScrapMaterial, piece: ScrapConsumptionPiece) {
  const sw = scrapWidth(scrap);
  const sh = scrapHeight(scrap);
  const pw = usedPieceWidthMm(piece);
  const ph = usedPieceHeightMm(piece);
  const thickness = usedPieceThicknessMm(piece);

  if (sw <= 0 || sh <= 0 || pw <= 0 || ph <= 0) return [];

  // Simulación simple tipo guillotina:
  // - Retazo derecho: ancho sobrante x alto pieza
  // - Retazo inferior: ancho total x alto sobrante
  const rightW = Math.max(0, sw - pw);
  const rightH = Math.min(sh, ph);

  const bottomW = sw;
  const bottomH = Math.max(0, sh - ph);

  const baseName = scrapName(scrap);
  const color = scrap.color || "";
  const material = scrap.material_name || scrap.material || baseName;
  const parentInventoryId =
    scrap.inventory_item_id || scrap.material_id || scrap.parent_inventory_id || null;

  const candidates = [
    {
      name: `${baseName} · sobrante lateral`,
      width_mm: rightW,
      height_mm: rightH,
    },
    {
      name: `${baseName} · sobrante inferior`,
      width_mm: bottomW,
      height_mm: bottomH,
    },
  ];

  return candidates
    .map((candidate) => {
      const area = (candidate.width_mm * candidate.height_mm) / 1_000_000;
      return {
        ...candidate,
        area,
      };
    })
    .filter(
      (candidate) =>
        candidate.area >= minimumUsefulScrapAreaM2() &&
        candidate.width_mm >= minimumUsefulScrapSideMm() &&
        candidate.height_mm >= minimumUsefulScrapSideMm()
    )
    .map((candidate) => ({
      inventory_item_id: parentInventoryId,
      material_id: parentInventoryId,
      parent_inventory_id: parentInventoryId,
      code: `RET-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      name: candidate.name,
      material,
      material_name: material,
      color,
      width_mm: Math.round(candidate.width_mm),
      height_mm: Math.round(candidate.height_mm),
      length_mm: Math.round(candidate.height_mm),
      ancho_mm: Math.round(candidate.width_mm),
      largo_mm: Math.round(candidate.height_mm),
      thickness_mm: thickness,
      grosor_mm: thickness,
      cost: 0,
      unit_cost: 0,
      status: "disponible",
      notes: `Creado automáticamente por consumo del retazo ${scrap.id}. Pieza usada: ${piece.module_name || ""} · ${piece.part_name || ""}`,
    }));
}

export async function consumeScrapAndCreateRemainders(piece: ScrapConsumptionPiece) {
  if (!piece?.scrap_id) {
    return {
      ok: false,
      skipped: true,
      reason: "La pieza no tiene scrap_id.",
    };
  }

  const { data: scrap, error: scrapError } = await supabase
    .from("inventory_scraps")
    .select("*")
    .eq("id", piece.scrap_id)
    .maybeSingle();

  if (scrapError) throw scrapError;

  if (!scrap) {
    return {
      ok: false,
      skipped: true,
      reason: "El retazo no existe.",
    };
  }

  const remainders = buildRemainingScrapsFromCut(scrap as ScrapMaterial, piece);
  const reference =
    piece.production_order_id ||
    piece.order_id ||
    piece.project_name ||
    `PROD-${Date.now()}`;

  const { error: updateError } = await supabase
    .from("inventory_scraps")
    .update({
      status: "usado",
      used_reference: String(reference),
      used_at: new Date().toISOString(),
      notes: [
        scrap.notes || "",
        `Usado automáticamente en ${reference}. Pieza: ${piece.module_name || ""} · ${piece.part_name || ""}. Medida usada: ${usedPieceWidthMm(piece)} x ${usedPieceHeightMm(piece)} mm.`,
      ]
        .filter(Boolean)
        .join("\n"),
    })
    .eq("id", piece.scrap_id);

  if (updateError) throw updateError;

  if (remainders.length > 0) {
    const { error: insertError } = await supabase
      .from("inventory_scraps")
      .insert(remainders);

    if (insertError) throw insertError;
  }

  return {
    ok: true,
    scrap_id: piece.scrap_id,
    created_remainders: remainders.length,
    remainders,
  };
}

export async function consumeScrapsFromProductionPieces(pieces: ScrapConsumptionPiece[]) {
  const results = [];

  for (const piece of pieces || []) {
    if (!piece?.scrap_id) continue;

    try {
      const result = await consumeScrapAndCreateRemainders(piece);
      results.push(result);
    } catch (error: any) {
      results.push({
        ok: false,
        scrap_id: piece.scrap_id,
        error: error?.message || String(error),
      });
    }
  }

  return {
    ok: results.every((r: any) => r.ok || r.skipped),
    processed: results.length,
    results,
  };
}


export async function createProductionFromProject(project: ProjectLike) {
  if (!project?.id) {
    return {
      success: false,
      error: "El proyecto no tiene ID. No se puede enviar a producción.",
    };
  }

  try {
    const existingOrder = await findExistingProductionOrder(project.id);

    if (existingOrder?.id) {
      const existingPieces = await loadExistingOrderItemsForUI(existingOrder.id);

      return {
        success: true,
        alreadyExists: true,
        order: existingOrder,
        pieces: existingPieces,
        totalOrderCost: Number(existingOrder.total_cost || 0),
        saleTotal: projectTotal(project),
        message: "Este proyecto ya tiene orden de producción.",
      };
    }

    const code = createCode("PRO");
    const projectLabel = projectName(project);
    const clientLabel = clientName(project);
    const saleTotal = projectTotal(project);

    const modules = getApprovedModules(project);
    const generatedPieces = modules.flatMap((module, index) => generatePiecesForModule(module, index));
    const linkedPieces = await linkPiecesToInventory(generatedPieces);
    const consolidated = consolidateMaterials(linkedPieces);

    const totalOrderCost = linkedPieces.reduce(
      (sum, piece) => sum + moneyNumber(piece.quantity) * moneyNumber(piece.unit_cost_real),
      0
    );

    const retazoCount = linkedPieces.filter((p) => p.scrap_id).length;
    const linkedCount = linkedPieces.filter((p) => p.inventory_item_id || p.scrap_id).length;
    const unlinkedCount = linkedPieces.length - linkedCount;

    const notes = [
      `Orden BOM modular creada desde proyecto ${projectLabel}.`,
      `Cliente: ${clientLabel}.`,
      `Módulos aprobados: ${modules.length}.`,
      `Piezas generadas: ${linkedPieces.length}.`,
      `Vinculadas a inventario/retazos: ${linkedCount}.`,
      `Retazos sugeridos: ${retazoCount}.`,
      `Pendientes de vincular: ${unlinkedCount}.`,
      `No descuenta inventario hasta procesar producción.`,
      "",
      "=== MÓDULOS ===",
      ...modules.map((m, i) => {
        const pieces = linkedPieces.filter((p) => p.module_index === i);
        const cost = pieces.reduce((s, p) => s + p.quantity * p.unit_cost_real, 0);
        const linked = pieces.filter((p) => p.inventory_item_id).length;
        return `${i + 1}. ${moduleName(m, i)} | Tipo: ${moduleType(m)} | Cant: ${moduleQty(m)} | Piezas: ${pieces.length} | Vinculadas: ${linked}/${pieces.length} | Costo: RD$${Math.round(cost).toLocaleString("en-US")}`;
      }),
      "",
      "=== CONSOLIDADO MATERIAL ===",
      ...consolidated.map(
        (m) => `${m.material_name}: ${m.quantity} ${m.unit} | RD$${m.estimated_cost.toLocaleString("en-US")}`
      ),
    ].join("\n");

    const { data: order, error: orderError } = await supabase
      .from("production_orders")
      .insert({
        project_id: project.id,
        code,
        order_code: code,
        source: "bom_modular",
        status: "pending",
        project_name: projectLabel,
        client_name: clientLabel,
        total_cost: 0,
        total_material_cost: 0,
        notes,
      })
      .select("*")
      .single();

    if (orderError) throw orderError;
    if (!order) throw new Error("No se pudo crear la orden de producción.");

    const itemsToInsert = linkedPieces.map((piece) => buildProductionOrderItem(order.id, project.id, piece));
    await insertOrderItemsSafe(itemsToInsert);

    const { error: updateOrderError } = await supabase
      .from("production_orders")
      .update({
        total_cost: totalOrderCost,
        total_material_cost: totalOrderCost,
        status: unlinkedCount > 0 ? "pending_link_inventory" : "pending",
        notes,
      })
      .eq("id", order.id);

    if (updateOrderError) {
      console.warn("Orden creada, pero no se pudo actualizar total:", updateOrderError.message);
    }

    try {
      await supabase
        .from("projects")
        .update({
          status: "production",
          production_status: "production",
          production_order_id: order.id,
        })
        .eq("id", project.id);
    } catch (optionalError) {
      console.warn("Actualización opcional de projects no aplicada:", optionalError);
    }

    /*
      Esto es lo que usa ProduccionBomProClient para pintar costo real y permitir consumo:
      pieces[] trae inventory_item_id/product_id/material_id, pero production_order_items NO,
      para evitar descuento prematuro por triggers.
    */
    const uiPieces = linkedPieces.map((piece, index) => ({
      production_order_id: order.id,
      order_id: order.id,

      inventory_item_id: piece.inventory_item_id,
      product_id: piece.product_id,
      material_id: piece.material_id,
      scrap_id: piece.scrap_id || null,
      material_source: piece.material_source || "INVENTARIO",

      product_name: `${piece.module_name} · ${piece.part_name}${piece.scrap_id ? " · RETAZO" : ""}`,
      material_name: piece.inventory_name || piece.material_name,
      nombre_producto: `${piece.module_name} · ${piece.part_name}${piece.scrap_id ? " · RETAZO" : ""}`,

      module_name: piece.module_name,
      part_name: piece.part_name,
      piece_code: `PZ-${index + 1}`,

      unit: piece.unit,
      quantity: piece.quantity,
      cantidad: piece.quantity,

      unit_cost: piece.unit_cost_real,
      costo_unitario: piece.unit_cost_real,
      total_cost: piece.total_cost_real,
      costo_total: piece.total_cost_real,

      stock: piece.stock,
      stock_before: piece.stock,
      stock_after: piece.stock,

      source: piece.scrap_id ? "bom_retazo" : piece.inventory_item_id ? "bom" : "bom_unlinked",
      status: piece.inventory_item_id || piece.scrap_id ? "pendiente_bom" : "pendiente_vincular",

      length: piece.length || null,
      width: piece.width || null,
      thickness: piece.thickness || null,
      edge_name: piece.edge_name || "",
    }));

    return {
      success: true,
      alreadyExists: false,
      order: {
        ...order,
        total_cost: totalOrderCost,
      },
      modules,
      pieces: uiPieces,
      generatedPieces,
      linkedPieces,
      consolidatedMaterials: consolidated,
      linkedCount,
      retazoCount,
      unlinkedCount,
      totalOrderCost,
      saleTotal,
      message:
        unlinkedCount > 0
          ? `BOM modular generado con ${linkedCount}/${linkedPieces.length} piezas vinculadas. Revisa las pendientes.`
          : "BOM modular generado y vinculado al inventario correctamente.",
    };
  } catch (error: any) {
    console.error(
      "Error createProductionFromProject:",
      JSON.stringify(error, null, 2)
    );

    return {
      success: false,
      error: error?.message || "Error generando BOM modular.",
      rawError: error,
    };
  }
}
