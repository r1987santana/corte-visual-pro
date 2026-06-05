"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Archive,
  Armchair,
  Bath,
  Boxes,
  Cuboid,
  DollarSign,
  DoorOpen,
  Download,
  Eye,
  Layers3,
  PanelTop,
  Plus,
  Printer,
  RefreshCcw,
  Rotate3D,
  Save,
  Scissors,
  Search,
  Table2,
  Trash2,
  Tv,
  Wand2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Material = {
  id: string;
  name?: string | null;
  material?: string | null;
  product_name?: string | null;
  category?: string | null;
  grupo?: string | null;
  subgroup?: string | null;
  subgrupo?: string | null;
  unit?: string | null;
  unidad?: string | null;
  stock?: number | null;
  stock_qty?: number | null;
  unit_cost?: number | null;
  cost?: number | null;
  purchase_cost?: number | null;
  cost_price?: number | null;
  sale_price?: number | null;
  unit_price?: number | null;
  price?: number | null;
};

type Project = {
  id: string;
  name?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  client?: string | null;
  project_type?: string | null;
  type?: string | null;
  material_id?: string | null;
  material_name?: string | null;
  edge_material_id?: string | null;
  edge_name?: string | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  code?: string | null;
  created_at?: string | null;
};

type Module = {
  id: string;
  project_id?: string | null;
  name?: string | null;
  module_name?: string | null;
  type?: string | null;
  module_type?: string | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  quantity?: number | null;
  doors?: number | null;
  drawers?: number | null;
  shelves?: number | null;
  template_type?: string | null;
  position_index?: number | null;
  zone?: string | null;
  notes?: string | null;
};

type Part = {
  id: string;
  project_id?: string | null;
  module_id?: string | null;
  part_name?: string | null;
  material_name?: string | null;
  length?: number | null;
  width?: number | null;
  thickness?: number | null;
  qty?: number | null;
  quantity?: number | null;
  edge_front?: boolean | null;
  edge_back?: boolean | null;
  edge_left?: boolean | null;
  edge_right?: boolean | null;
  grain_direction?: string | null;
  notes?: string | null;
  part_type?: string | null;
  can_rotate?: boolean | null;
};

type LayoutPiece = Part & {
  source_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  sheetNo: number;
  error?: string | null;
};

const num = (v: any) => Number(v || 0);
const fmt = (n: any, d = 2) => Number(n || 0).toFixed(d);
const money = (n: any) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 2 }).format(Number(n || 0));

function matName(m?: Material | null) {
  return m?.name || m?.material || m?.product_name || "Material no definido";
}
function matStock(m?: Material | null) {
  return num(m?.stock_qty ?? m?.stock);
}
function matCost(m?: Material | null) {
  return num(m?.unit_cost ?? m?.cost ?? m?.purchase_cost ?? m?.cost_price);
}
function matPrice(m?: Material | null) {
  return num(m?.sale_price ?? m?.unit_price ?? m?.price);
}
function projectName(p?: Project | null) {
  return p?.name || p?.project_name || "Proyecto sin nombre";
}
function moduleName(m?: Module | null) {
  return m?.name || m?.module_name || "Módulo";
}
function moduleType(m?: Module | null) {
  return m?.type || m?.module_type || "base";
}
function mm2(l: number, w: number, q = 1) {
  return (l * w * q) / 1_000_000;
}
function edgeMl(p: Part) {
  const q = num(p.qty || p.quantity || 1);
  const l = num(p.length);
  const w = num(p.width);
  let total = 0;
  if (p.edge_front) total += l;
  if (p.edge_back) total += l;
  if (p.edge_left) total += w;
  if (p.edge_right) total += w;
  return (total * q) / 1000;
}
function normalizeMaterial(row: any): Material {
  return {
    id: row.id,
    name: row.name ?? row.material ?? row.product_name ?? row.nombre,
    material: row.material,
    product_name: row.product_name,
    category: row.category ?? row.grupo,
    grupo: row.grupo,
    subgroup: row.subgroup ?? row.subgrupo,
    subgrupo: row.subgrupo,
    unit: row.unit ?? row.unidad,
    unidad: row.unidad,
    stock: row.stock,
    stock_qty: row.stock_qty,
    unit_cost: row.unit_cost,
    cost: row.cost,
    purchase_cost: row.purchase_cost,
    cost_price: row.cost_price,
    sale_price: row.sale_price,
    unit_price: row.unit_price,
    price: row.price,
  };
}

function part(
  project_id: string,
  module_id: string,
  name: string,
  material_name: string,
  length: number,
  width: number,
  qty = 1,
  edges: Partial<Pick<Part, "edge_front" | "edge_back" | "edge_left" | "edge_right">> = {},
  part_type = "panel",
  can_rotate = true,
  grain_direction = "vertical"
): Omit<Part, "id"> {
  return {
    project_id,
    module_id,
    part_name: name,
    material_name,
    length,
    width,
    thickness: 18,
    qty,
    edge_front: !!edges.edge_front,
    edge_back: !!edges.edge_back,
    edge_left: !!edges.edge_left,
    edge_right: !!edges.edge_right,
    grain_direction,
    part_type,
    can_rotate,
  };
}

function piecesForModule(projectId: string, mod: Module, material: string): Omit<Part, "id">[] {
  const id = mod.id;
  const w = num(mod.width || 600);
  const h = num(mod.height || 720);
  const d = num(mod.depth || 560);
  const q = Math.max(1, num(mod.quantity || 1));
  const t = moduleType(mod).toLowerCase();
  const doors = num(mod.doors || 0);
  const drawers = num(mod.drawers || 0);
  const shelves = num(mod.shelves || 0);
  const arr: Omit<Part, "id">[] = [];

  const addBox = (prefix: string) => {
    arr.push(part(projectId, id, `${prefix} - Lateral izquierdo`, material, h, d, q, { edge_front: true }, "lateral", false));
    arr.push(part(projectId, id, `${prefix} - Lateral derecho`, material, h, d, q, { edge_front: true }, "lateral", false));
    arr.push(part(projectId, id, `${prefix} - Tapa superior`, material, Math.max(0, w - 36), d, q, { edge_front: true }, "tapa", true, "horizontal"));
    arr.push(part(projectId, id, `${prefix} - Tapa inferior`, material, Math.max(0, w - 36), d, q, { edge_front: true }, "tapa", true, "horizontal"));
    arr.push(part(projectId, id, `${prefix} - Travesaño frontal`, material, Math.max(0, w - 36), 100, q, { edge_front: true }, "travesano", true, "horizontal"));
    arr.push(part(projectId, id, `${prefix} - Travesaño trasero`, material, Math.max(0, w - 36), 100, q, {}, "travesano", true, "horizontal"));
    if (shelves > 0) arr.push(part(projectId, id, `${prefix} - Entrepaño / repisa`, material, Math.max(0, w - 36), Math.max(0, d - 20), shelves * q, { edge_front: true }, "repisa", true, "horizontal"));
    if (doors > 0) arr.push(part(projectId, id, `${prefix} - Puerta`, material, Math.max(250, h - 4), Math.max(100, w / doors - 3), doors * q, { edge_front: true, edge_back: true, edge_left: true, edge_right: true }, "puerta", false));
    if (drawers > 0) {
      arr.push(part(projectId, id, `${prefix} - Frente gaveta`, material, Math.max(100, w - 6), 180, drawers * q, { edge_front: true, edge_back: true, edge_left: true, edge_right: true }, "frente_gaveta", false));
      arr.push(part(projectId, id, `${prefix} - Lateral gaveta`, material, Math.max(250, d - 80), 130, drawers * 2 * q, { edge_front: true }, "gaveta", true, "horizontal"));
      arr.push(part(projectId, id, `${prefix} - Fondo gaveta`, material, Math.max(100, w - 90), Math.max(200, d - 110), drawers * q, {}, "fondo_gaveta", true, "horizontal"));
    }
  };

  if (t.includes("closet")) {
    arr.push(part(projectId, id, "Closet - Costado izquierdo", material, h, d, q, { edge_front: true }, "costado", false));
    arr.push(part(projectId, id, "Closet - Costado derecho", material, h, d, q, { edge_front: true }, "costado", false));
    arr.push(part(projectId, id, "Closet - Techo", material, Math.max(0, w - 36), d, q, { edge_front: true }, "techo", true, "horizontal"));
    arr.push(part(projectId, id, "Closet - Piso", material, Math.max(0, w - 36), d, q, { edge_front: true }, "piso", true, "horizontal"));
    arr.push(part(projectId, id, "Closet - División vertical", material, h - 36, d, q, { edge_front: true }, "division", false));
    arr.push(part(projectId, id, "Closet - Repisas", material, Math.max(300, w / 2 - 36), d - 20, Math.max(2, shelves) * q, { edge_front: true }, "repisa", true, "horizontal"));
    arr.push(part(projectId, id, "Closet - Puerta", material, h - 8, Math.max(250, w / Math.max(2, doors || 2) - 4), Math.max(2, doors || 2) * q, { edge_front: true, edge_back: true, edge_left: true, edge_right: true }, "puerta", false));
    return arr;
  }
  if (t.includes("aereo") || t.includes("aéreo")) {
    addBox("Aéreo");
    return arr;
  }
  if (t.includes("torre") || t.includes("despensa")) {
    addBox("Torre");
    arr.push(part(projectId, id, "Torre - División central", material, Math.max(0, h - 36), Math.max(0, d - 20), q, { edge_front: true }, "division", false));
    return arr;
  }
  if (t.includes("gavetero")) {
    addBox("Gavetero");
    if (drawers < 1) arr.push(part(projectId, id, "Gavetero - Frente gaveta extra", material, Math.max(100, w - 6), 180, 3 * q, { edge_front: true, edge_back: true, edge_left: true, edge_right: true }, "frente_gaveta", false));
    return arr;
  }
  if (t.includes("repisa")) {
    arr.push(part(projectId, id, "Repisa - Panel horizontal", material, w, d, Math.max(1, shelves || 3) * q, { edge_front: true, edge_left: true, edge_right: true }, "repisa", true, "horizontal"));
    arr.push(part(projectId, id, "Repisa - Laterales", material, h, d, 2 * q, { edge_front: true }, "lateral", false));
    return arr;
  }
  if (t.includes("isla")) {
    addBox("Isla");
    arr.push(part(projectId, id, "Isla - Panel decorativo posterior", material, w, h, q, { edge_front: true, edge_back: true, edge_left: true, edge_right: true }, "panel", false));
    return arr;
  }
  if (t.includes("panel")) {
    arr.push(part(projectId, id, "Panel decorativo", material, h, w, q, { edge_front: true, edge_back: true, edge_left: true, edge_right: true }, "panel", false));
    return arr;
  }

  addBox("Base");
  return arr;
}

const templateSets = [
  { key: "cocina", label: "Cocina automática", icon: Wand2 },
  { key: "tv", label: "Mueble TV", icon: Tv },
  { key: "closet", label: "Closet", icon: DoorOpen },
  { key: "vanity", label: "Vanity / Baño", icon: Bath },
  { key: "aereos", label: "Gabinetes aéreos", icon: Archive },
  { key: "gavetero", label: "Gavetero", icon: Boxes },
  { key: "panel", label: "Panel decorativo", icon: PanelTop },
  { key: "isla", label: "Isla", icon: Table2 },
  { key: "torre", label: "Torre / Despensa", icon: Armchair },
];

function buildTemplate(project: Project, kind: string): Omit<Module, "id">[] {
  const W = num(project.width || 3000);
  const H = num(project.height || 2400);
  const D = num(project.depth || 600);
  const project_id = project.id;
  const q = (name: string, type: string, width: number, height: number, depth: number, doors = 2, drawers = 0, shelves = 1, idx = 1, zone = "general"): Omit<Module, "id"> => ({
    project_id,
    name,
    module_name: name,
    type,
    module_type: type,
    width,
    height,
    depth,
    quantity: 1,
    doors,
    drawers,
    shelves,
    template_type: kind,
    position_index: idx,
    zone,
    notes: "Generado automáticamente por RD Wood System",
  });

  if (kind === "tv") {
    return [
      q("Mueble TV bajo 1", "base", 900, 450, 420, 2, 0, 1, 1, "inferior"),
      q("Mueble TV bajo 2", "gavetero", 900, 450, 420, 0, 2, 0, 2, "inferior"),
      q("Mueble TV bajo 3", "base", 900, 450, 420, 2, 0, 1, 3, "inferior"),
      q("Panel TV central", "panel", Math.min(W, 2400), Math.min(H, 1800), 18, 0, 0, 0, 4, "pared"),
      q("Repisa flotante superior", "repisa", Math.min(W, 2200), 250, 280, 0, 0, 1, 5, "superior"),
    ];
  }
  if (kind === "closet") {
    return [
      q("Closet cuerpo izquierdo", "closet", Math.max(700, W / 3), Math.min(H, 2400), D, 2, 2, 4, 1, "izquierda"),
      q("Closet cuerpo central", "closet", Math.max(700, W / 3), Math.min(H, 2400), D, 2, 3, 5, 2, "centro"),
      q("Closet cuerpo derecho", "closet", Math.max(700, W / 3), Math.min(H, 2400), D, 2, 2, 4, 3, "derecha"),
      q("Maletero superior", "aereo", W, 420, D, 4, 0, 1, 4, "superior"),
    ];
  }
  if (kind === "vanity") return [q("Vanity base lavabo", "base", Math.min(W, 900), 720, 520, 2, 1, 1, 1), q("Espejo panel", "panel", Math.min(W, 900), 900, 18, 0, 0, 0, 2)];
  if (kind === "aereos") return Array.from({ length: Math.max(2, Math.floor(W / 700)) }, (_, i) => q(`Aéreo ${i + 1}`, "aereo", 700, 720, 320, 2, 0, 1, i + 1));
  if (kind === "gavetero") return [q("Gavetero industrial", "gavetero", 700, 720, 560, 0, 4, 0, 1)];
  if (kind === "panel") return [q("Panel decorativo pared", "panel", Math.min(W, 2400), Math.min(H, 2400), 18, 0, 0, 0, 1)];
  if (kind === "isla") return [q("Isla central", "isla", 1800, 900, 900, 2, 3, 1, 1)];
  if (kind === "torre") return [q("Torre despensa", "torre", 600, Math.min(H, 2200), 560, 2, 2, 5, 1)];

  const nBases = Math.max(1, Math.floor(W / 600));
  const mods: Omit<Module, "id">[] = [];
  for (let i = 0; i < nBases; i++) mods.push(q(`Base ${i + 1}`, i % 3 === 1 ? "gavetero" : "base", 600, 720, 560, i % 3 === 1 ? 0 : 2, i % 3 === 1 ? 3 : 0, 1, i + 1));
  const nA = Math.max(1, Math.floor(W / 700));
  for (let i = 0; i < nA; i++) mods.push(q(`Aéreo ${i + 1}`, "aereo", Math.min(700, W / nA), 720, 320, 2, 0, 1, nBases + i + 1));
  mods.push(q("Torre despensa", "torre", 600, Math.min(H, 2200), 560, 2, 2, 4, mods.length + 1));
  return mods;
}

function optimizeParts(parts: Part[], sheetW: number, sheetH: number, kerf: number, respectGrain: boolean): LayoutPiece[] {
  const expanded: LayoutPiece[] = [];
  parts.forEach((p) => {
    const qty = Math.max(1, Math.round(num(p.qty || p.quantity || 1)));
    for (let i = 0; i < qty; i++) expanded.push({ ...p, source_id: p.id, id: `${p.id}__copy_${i}`, x: 0, y: 0, w: num(p.length), h: num(p.width), rotated: false, sheetNo: 0, error: null });
  });

  expanded.sort((a, b) => b.w * b.h - a.w * a.h);
  const sheets = [{ sheetNo: 1, cursorX: 0, cursorY: 0, rowH: 0 }];

  function orientations(p: LayoutPiece) {
    const original = { w: num(p.length), h: num(p.width), rotated: false };
    const rotated = { w: num(p.width), h: num(p.length), rotated: true };
    const mustRespectGrain =
      respectGrain &&
      (p.can_rotate === false ||
        p.grain_direction === "vertical" ||
        ["puerta", "lateral", "costado", "panel", "division", "frente_gaveta"].includes(String(p.part_type || "")));
    if (mustRespectGrain) return [original];
    return [original, rotated].sort((a, b) => Number(b.w <= sheetW && b.h <= sheetH) - Number(a.w <= sheetW && a.h <= sheetH));
  }

  const fits = (w: number, h: number) => w <= sheetW && h <= sheetH;

  for (const p of expanded) {
    let placed = false;
    for (const option of orientations(p)) {
      if (!fits(option.w, option.h)) continue;
      for (const s of sheets) {
        if (s.cursorX + option.w <= sheetW && s.cursorY + option.h <= sheetH) {
          Object.assign(p, { x: s.cursorX, y: s.cursorY, w: option.w, h: option.h, rotated: option.rotated, sheetNo: s.sheetNo });
          s.cursorX += option.w + kerf;
          s.rowH = Math.max(s.rowH, option.h + kerf);
          placed = true;
          break;
        }
        const newRowY = s.cursorY + s.rowH;
        if (option.w <= sheetW && newRowY + option.h <= sheetH) {
          Object.assign(p, { x: 0, y: newRowY, w: option.w, h: option.h, rotated: option.rotated, sheetNo: s.sheetNo });
          s.cursorX = option.w + kerf;
          s.cursorY = newRowY;
          s.rowH = option.h + kerf;
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    if (!placed) {
      const valid = orientations(p).find((o) => fits(o.w, o.h));
      const next = sheets.length + 1;
      if (!valid) {
        Object.assign(p, { x: 0, y: 0, w: Math.min(num(p.length), sheetW), h: Math.min(num(p.width), sheetH), rotated: false, sheetNo: next, error: `PIEZA NO CABE EN HOJA ${sheetW}x${sheetH}` });
        sheets.push({ sheetNo: next, cursorX: sheetW, cursorY: sheetH, rowH: sheetH });
      } else {
        Object.assign(p, { x: 0, y: 0, w: valid.w, h: valid.h, rotated: valid.rotated, sheetNo: next });
        sheets.push({ sheetNo: next, cursorX: valid.w + kerf, cursorY: 0, rowH: valid.h + kerf });
      }
    }
  }
  return expanded.filter((p) => p.sheetNo > 0);
}

export default function MueblesPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [tab, setTab] = useState<"crear" | "despiece" | "optimizacion" | "costos" | "vista3d">("crear");
  const [loading, setLoading] = useState(false);
  const [searchProject, setSearchProject] = useState("");
  const [sheetFormat, setSheetFormat] = useState("4x8");
  const [kerf, setKerf] = useState(4);
  const [respectGrain, setRespectGrain] = useState(true);
  const [viewRotX, setViewRotX] = useState(-18);
  const [viewRotY, setViewRotY] = useState(-32);
  const [viewZoom, setViewZoom] = useState(1);
  const [form, setForm] = useState({ name: "Cocina moderna", client: "Cliente General", type: "Cocina", material_id: "", edge_material_id: "", width: 3000, height: 2400, depth: 600 });
  const [modForm, setModForm] = useState({ name: "Módulo base", type: "base", width: 600, height: 720, depth: 560, quantity: 1, doors: 2, drawers: 0, shelves: 1 });

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;
  const selectedMaterial = materials.find((m) => m.id === (selectedProject?.material_id || form.material_id)) || null;
  const projectModules = modules.filter((m) => m.project_id === selectedProjectId);
  const projectParts = parts.filter((p) => p.project_id === selectedProjectId);
  const materialOptions = useMemo(() => materials.filter((m) => `${matName(m)} ${m.category || ""} ${m.grupo || ""}`.toLowerCase().match(/melamina|mdf|fondo/)), [materials]);
  const edgeOptions = useMemo(() => materials.filter((m) => `${matName(m)} ${m.category || ""} ${m.grupo || ""}`.toLowerCase().match(/canto|pvc/)), [materials]);
  const sheet = sheetFormat === "7x8" ? { w: 2135, h: 2440, label: "7x8 - 2135 x 2440 mm" } : { w: 1220, h: 2440, label: "4x8 - 1220 x 2440 mm" };
  const layout = useMemo(() => optimizeParts(projectParts, sheet.w, sheet.h, kerf, respectGrain), [projectParts, sheet.w, sheet.h, kerf, respectGrain]);
  const sheetCount = Math.max(0, ...layout.map((p) => p.sheetNo));
  const totalArea = projectParts.reduce((s, p) => s + mm2(num(p.length), num(p.width), num(p.qty || 1)), 0);
  const totalEdge = projectParts.reduce((s, p) => s + edgeMl(p), 0);
  const sheetArea = (sheet.w * sheet.h) / 1_000_000;
  const hojasEstimadas = sheetArea ? totalArea / sheetArea : 0;
  const costoMaterial = hojasEstimadas * matCost(selectedMaterial);
  const precioSugerido = costoMaterial > 0 ? costoMaterial / 0.35 : hojasEstimadas * matPrice(selectedMaterial);

  async function cargar() {
    setLoading(true);
    try {
      const [inv1, inv2, proy, mods, pts] = await Promise.all([
        supabase.from("inventory_items").select("*").order("name", { ascending: true }),
        supabase.from("inventory").select("*").order("material", { ascending: true }),
        supabase.from("furniture_projects").select("*").order("created_at", { ascending: false }),
        supabase.from("furniture_modules").select("*").order("position_index", { ascending: true }),
        supabase.from("furniture_parts").select("*").order("created_at", { ascending: false }),
      ]);
      const mats = [...((inv1.data || []) as any[]).map(normalizeMaterial), ...((inv2.data || []) as any[]).map(normalizeMaterial)];
      setMaterials(mats);
      setProjects((proy.data || []) as Project[]);
      setModules((mods.data || []) as Module[]);
      setParts((pts.data || []) as Part[]);
      if (!form.material_id && mats[0]?.id) {
        const main = mats.find((m) => matName(m).toLowerCase().match(/mdf|melamina/)) || mats[0];
        const edge = mats.find((m) => matName(m).toLowerCase().includes("canto")) || mats[0];
        setForm((f) => ({ ...f, material_id: main.id, edge_material_id: edge.id }));
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  async function crearProyecto() {
    const material = materials.find((m) => m.id === form.material_id);
    const edge = materials.find((m) => m.id === form.edge_material_id);
    const payload = { name: form.name, project_name: form.name, client_name: form.client, client: form.client, type: form.type, project_type: form.type, material_id: form.material_id || null, material_name: matName(material), edge_material_id: form.edge_material_id || null, edge_name: matName(edge), width: num(form.width), height: num(form.height), depth: num(form.depth), code: `MUE-${Date.now()}`, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from("furniture_projects").insert(payload).select("*").single();
    if (error) return alert("Error guardando proyecto: " + error.message);
    setSelectedProjectId(data.id);
    alert("Proyecto creado correctamente.");
    await cargar();
  }
  async function agregarModulo() {
    if (!selectedProjectId) return alert("Selecciona un proyecto primero.");
    const payload = { project_id: selectedProjectId, name: modForm.name, module_name: modForm.name, type: modForm.type, module_type: modForm.type, width: num(modForm.width), height: num(modForm.height), depth: num(modForm.depth), quantity: num(modForm.quantity), doors: num(modForm.doors), drawers: num(modForm.drawers), shelves: num(modForm.shelves), template_type: "manual", position_index: projectModules.length + 1, zone: "manual", notes: "Módulo manual" };
    const { error } = await supabase.from("furniture_modules").insert(payload);
    if (error) return alert("Error agregando módulo: " + error.message);
    await cargar();
  }
  async function crearPlantilla(kind: string) {
    if (!selectedProject) return alert("Selecciona un proyecto.");
    const rows = buildTemplate(selectedProject, kind);
    const { error } = await supabase.from("furniture_modules").insert(rows);
    if (error) return alert("Error creando plantilla: " + error.message);
    alert(`Plantilla creada: ${rows.length} módulos.`);
    await cargar();
  }
  async function borrarModulo(id: string) { await supabase.from("furniture_modules").delete().eq("id", id); await cargar(); }
  async function borrarProyecto(id: string) {
    if (!confirm("¿Eliminar proyecto y datos relacionados?")) return;
    await supabase.from("furniture_parts").delete().eq("project_id", id);
    await supabase.from("furniture_modules").delete().eq("project_id", id);
    await supabase.from("furniture_projects").delete().eq("id", id);
    setSelectedProjectId("");
    await cargar();
  }
  async function generarDespiece() {
    if (!selectedProject) return alert("Selecciona un proyecto.");
    if (projectModules.length === 0) return alert("Crea módulos primero.");
    await supabase.from("furniture_parts").delete().eq("project_id", selectedProject.id);
    const material = selectedProject.material_name || matName(selectedMaterial);
    const rows = projectModules.flatMap((m) => piecesForModule(selectedProject.id, m, material));
    const { error } = await supabase.from("furniture_parts").insert(rows);
    if (error) return alert("Error generando despiece: " + error.message);
    alert(`Despiece generado: ${rows.reduce((s, p) => s + num(p.qty || 1), 0)} piezas.`);
    await cargar();
    setTab("despiece");
  }
  async function guardarOptimizacion() {
    if (!selectedProject) return alert("Selecciona un proyecto.");
    if (layout.length === 0) return alert("Primero genera el despiece.");
    const sheetsPayload = Array.from({ length: sheetCount }, (_, i) => ({ id: uuidv4(), project_id: selectedProject.id, sheet_name: `Hoja ${i + 1}`, sheet_format: sheet.label, sheet_width: sheet.w, sheet_height: sheet.h, sheet_width_mm: sheet.w, sheet_height_mm: sheet.h, thickness: 18, material_name: selectedProject.material_name || matName(selectedMaterial), waste_percent: 0, created_at: new Date().toISOString() }));
    const { data: createdSheets, error: sheetError } = await supabase.from("cutting_sheets").insert(sheetsPayload).select("*");
    if (sheetError) return alert("Error guardando optimización: " + sheetError.message);
    const items = layout.map((p) => ({ id: uuidv4(), sheet_id: createdSheets?.[p.sheetNo - 1]?.id, part_id: p.source_id, x: p.x, y: p.y, rotated: p.rotated, created_at: new Date().toISOString() })).filter((x) => x.sheet_id && x.part_id);
    const { error } = await supabase.from("cutting_layout_parts").insert(items);
    if (error) return alert("Error guardando optimización: " + error.message);
    alert("Optimización guardada correctamente.");
  }
  async function generarOrdenProduccion() {
    if (!selectedProject) return alert("Selecciona un proyecto.");
    if (projectParts.length === 0) return alert("Primero genera el despiece.");
    const orderCode = `OP-${Date.now()}`;
    const totalPieces = projectParts.reduce((s, p) => s + num(p.qty || p.quantity || 1), 0);
    const { data: order, error: orderError } = await supabase.from("production_orders").insert({ id: uuidv4(), code: orderCode, order_code: orderCode, project_id: selectedProject.id, source: "manual", status: "pendiente", total_pieces: totalPieces, created_at: new Date().toISOString() }).select("*").single();
    if (orderError) return alert("Error creando orden: " + orderError.message);
    const unitCost = matCost(selectedMaterial);
    const rows = projectParts.map((p) => {
      const quantity = num(p.qty || p.quantity || 1);
      const mod = projectModules.find((m) => m.id === p.module_id);
      return { id: uuidv4(), order_id: order.id, production_order_id: order.id, project_id: selectedProject.id, part_id: p.id, part_name: p.part_name || "Pieza", model_name: mod?.module_name || mod?.name || "", module_name: mod?.module_name || mod?.name || "", material_id: selectedProject.material_id || null, material_name: p.material_name || selectedProject.material_name || matName(selectedMaterial), length: num(p.length), width: num(p.width), thickness: num(p.thickness || 18), quantity, unit_cost: unitCost, total_cost: mm2(num(p.length), num(p.width), quantity) * unitCost, status: "pendiente", created_at: new Date().toISOString() };
    });
    const { error: itemError } = await supabase.from("production_order_items").insert(rows);
    if (itemError) return alert("Error creando piezas de producción: " + itemError.message);
    alert(`Orden de producción creada correctamente: ${orderCode}`);
  }
  function exportCSV() {
    const header = ["pieza", "material", "largo", "ancho", "espesor", "cantidad", "cantos", "m2", "nota"];
    const rows = projectParts.map((p) => [p.part_name, p.material_name, p.length, p.width, p.thickness, p.qty, [p.edge_front ? "Frente" : "", p.edge_back ? "Atrás" : "", p.edge_left ? "Izq" : "", p.edge_right ? "Der" : ""].filter(Boolean).join(" / ") || "N/A", fmt(mm2(num(p.length), num(p.width), num(p.qty || 1)), 3), p.notes || ""]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `despiece-${projectName(selectedProject).replaceAll(" ", "-")}.csv`;
    a.click();
  }

  const filteredProjects = projects.filter((p) => `${projectName(p)} ${p.client_name || p.client || ""} ${p.code || ""}`.toLowerCase().includes(searchProject.toLowerCase()));

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <section className="mx-auto max-w-[1600px] space-y-5">
        <div className="rounded-[28px] bg-[#020617] p-6 text-white shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.45em] text-cyan-300">RD WOOD SYSTEM · CARPINTERÍA MUNDIAL · DESPIECE + CORTE + COSTOS + 3D</p>
              <h1 className="mt-2 text-4xl font-black">Muebles PRO Industrial</h1>
              <p className="mt-2 text-sm text-slate-300">Módulos, despiece, veta/beta, optimización visual, costeo y vista 3D interactiva.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={cargar} className="rounded-2xl bg-white px-5 py-3 font-black text-slate-950"><RefreshCcw className={`mr-2 inline h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</button>
              <button onClick={() => window.print()} className="rounded-2xl bg-white px-5 py-3 font-black text-slate-950"><Printer className="mr-2 inline h-4 w-4" />Imprimir</button>
              <button onClick={exportCSV} className="rounded-2xl bg-white px-5 py-3 font-black text-slate-950"><Download className="mr-2 inline h-4 w-4" />CSV</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          {[["Proyectos", projects.length, Layers3], ["Módulos", projectModules.length, Boxes], ["Piezas", projectParts.reduce((s, p) => s + num(p.qty || 1), 0), Cuboid], ["Hojas reales", sheetCount, Scissors], ["Canto", `${fmt(totalEdge)} ml`, PanelTop], ["Precio sugerido", money(precioSugerido), DollarSign]].map(([label, value, Icon]: any) => (
            <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase text-slate-500">{label}</p><div className="rounded-2xl bg-blue-50 p-3 text-blue-600"><Icon className="h-5 w-5" /></div></div><p className="mt-3 text-3xl font-black">{value}</p></div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {[["crear", "Crear / Módulos"], ["despiece", "Despiece"], ["optimizacion", "Optimización"], ["costos", "Costos CEO"], ["vista3d", "Vista 3D"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k as any)} className={`rounded-2xl px-5 py-3 text-sm font-black ${tab === k ? "bg-[#020617] text-white" : "bg-white text-slate-800 border border-slate-200"}`}>{label}</button>
          ))}
        </div>

        {tab === "crear" && <div className="grid gap-5 xl:grid-cols-2">
          <Card title="Crear proyecto">
            <div className="grid gap-4"><Input label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} /><Input label="Cliente" value={form.client} onChange={(v) => setForm({ ...form, client: v })} />
              <label className="grid gap-2 text-xs font-black uppercase text-slate-500">Tipo<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-2xl border border-slate-300 p-3 text-base font-bold normal-case text-slate-950"><option>Cocina</option><option>Mueble TV</option><option>Closet</option><option>Vanity</option><option>Oficina</option><option>Otro</option></select></label>
              <label className="grid gap-2 text-xs font-black uppercase text-slate-500">Material principal<select value={form.material_id} onChange={(e) => setForm({ ...form, material_id: e.target.value })} className="rounded-2xl border border-slate-300 p-3 text-base font-bold normal-case text-slate-950">{[...materialOptions, ...materials.filter((m) => !materialOptions.includes(m))].map((m) => <option key={m.id} value={m.id}>{matName(m)} · Stock {matStock(m)}</option>)}</select></label>
              <label className="grid gap-2 text-xs font-black uppercase text-slate-500">Canto / tapacanto<select value={form.edge_material_id} onChange={(e) => setForm({ ...form, edge_material_id: e.target.value })} className="rounded-2xl border border-slate-300 p-3 text-base font-bold normal-case text-slate-950">{[...edgeOptions, ...materials.filter((m) => !edgeOptions.includes(m))].map((m) => <option key={m.id} value={m.id}>{matName(m)} · Stock {matStock(m)}</option>)}</select></label>
              <div className="grid grid-cols-3 gap-3"><Input label="Ancho mm" value={form.width} type="number" onChange={(v) => setForm({ ...form, width: Number(v) })} /><Input label="Alto mm" value={form.height} type="number" onChange={(v) => setForm({ ...form, height: Number(v) })} /><Input label="Prof. mm" value={form.depth} type="number" onChange={(v) => setForm({ ...form, depth: Number(v) })} /></div>
              <button onClick={crearProyecto} className="rounded-2xl bg-[#020617] p-4 font-black text-white"><Save className="mr-2 inline h-4 w-4" />Guardar proyecto</button>
            </div>
          </Card>
          <Card title="Proyectos de muebles"><div className="flex items-center gap-2 rounded-2xl border border-slate-300 px-3"><Search className="h-4 w-4 text-slate-400" /><input value={searchProject} onChange={(e) => setSearchProject(e.target.value)} placeholder="Buscar proyecto, cliente, código..." className="w-full p-3 outline-none" /></div><div className="mt-4 max-h-80 space-y-2 overflow-auto">{filteredProjects.map((p) => <button key={p.id} onClick={() => setSelectedProjectId(p.id)} className={`w-full rounded-2xl border p-4 text-left ${selectedProjectId === p.id ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`}><div className="flex items-start justify-between"><div><p className="font-black">{projectName(p)}</p><p className="text-xs text-slate-500">{p.code || "Sin código"} · {p.project_type || p.type || "Proyecto"} · {num(p.width)} x {num(p.height)} x {num(p.depth)} mm</p><p className="text-xs text-slate-500">{p.client_name || p.client}</p></div><span onClick={(e) => { e.stopPropagation(); borrarProyecto(p.id); }} className="rounded-xl bg-red-50 p-2 text-red-600"><Trash2 className="h-4 w-4" /></span></div></button>)}</div></Card>
          <Card title="Biblioteca automática PRO"><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{templateSets.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => crearPlantilla(key)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left font-black hover:bg-blue-50"><Icon className="mb-2 h-5 w-5 text-blue-600" />{label}</button>)}</div></Card>
          <Card title="Módulos del proyecto"><button onClick={generarDespiece} className="w-full rounded-2xl bg-[#020617] p-4 font-black text-white"><Wand2 className="mr-2 inline h-4 w-4" />Generar despiece</button><div className="mt-4 max-h-80 space-y-2 overflow-auto rounded-2xl border border-slate-200 p-3">{projectModules.length === 0 && <p className="py-10 text-center font-bold text-slate-400">No hay módulos agregados.</p>}{projectModules.map((m) => <div key={m.id} className="rounded-2xl bg-slate-50 p-3"><div className="flex justify-between gap-3"><div><p className="font-black">{moduleName(m)}</p><p className="text-xs text-slate-500">{moduleType(m)} · {num(m.width)} x {num(m.height)} x {num(m.depth)} mm · Cant. {num(m.quantity || 1)}</p></div><button onClick={() => borrarModulo(m.id)} className="rounded-xl bg-red-50 p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div></div>)}</div></Card>
          <Card title="Crear módulo manual"><div className="grid gap-3 md:grid-cols-4"><Input label="Nombre módulo" value={modForm.name} onChange={(v) => setModForm({ ...modForm, name: v })} /><label className="grid gap-2 text-xs font-black uppercase text-slate-500">Tipo módulo<select value={modForm.type} onChange={(e) => setModForm({ ...modForm, type: e.target.value })} className="rounded-2xl border border-slate-300 p-3 text-base font-bold normal-case text-slate-950"><option value="base">Base</option><option value="aereo">Aéreo</option><option value="torre">Torre</option><option value="closet">Closet</option><option value="gavetero">Gavetero</option><option value="repisa">Repisa</option><option value="isla">Isla</option><option value="panel">Panel</option></select></label><Input label="Ancho" value={modForm.width} type="number" onChange={(v) => setModForm({ ...modForm, width: Number(v) })} /><Input label="Alto" value={modForm.height} type="number" onChange={(v) => setModForm({ ...modForm, height: Number(v) })} /><Input label="Prof." value={modForm.depth} type="number" onChange={(v) => setModForm({ ...modForm, depth: Number(v) })} /><Input label="Cant." value={modForm.quantity} type="number" onChange={(v) => setModForm({ ...modForm, quantity: Number(v) })} /><Input label="Puertas" value={modForm.doors} type="number" onChange={(v) => setModForm({ ...modForm, doors: Number(v) })} /><Input label="Gavetas" value={modForm.drawers} type="number" onChange={(v) => setModForm({ ...modForm, drawers: Number(v) })} /><Input label="Repisas" value={modForm.shelves} type="number" onChange={(v) => setModForm({ ...modForm, shelves: Number(v) })} /></div><button onClick={agregarModulo} className="mt-4 w-full rounded-2xl bg-blue-600 p-4 font-black text-white"><Plus className="mr-2 inline h-4 w-4" />Agregar módulo</button></Card>
        </div>}

        {tab === "despiece" && <Card title="Despiece automático PRO"><Summary items={[["Piezas", projectParts.reduce((s, p) => s + num(p.qty || 1), 0)], ["Área", `${fmt(totalArea)} m²`], ["Canto", `${fmt(totalEdge)} ml`], ["Hojas estimadas", fmt(hojasEstimadas)]]} /><Table parts={projectParts} /></Card>}

        {tab === "optimizacion" && <div className="grid gap-5 lg:grid-cols-[360px_1fr]"><Card title="Optimización de corte PRO"><label className="grid gap-2 text-xs font-black uppercase text-slate-500">Formato de hoja<select value={sheetFormat} onChange={(e) => setSheetFormat(e.target.value)} className="rounded-2xl border border-slate-300 p-3 text-base font-bold normal-case text-slate-950"><option value="4x8">4x8 - 1220 x 2440 mm</option><option value="7x8">7x8 - 2135 x 2440 mm</option></select></label><Input label="Kerf / Disco mm" value={kerf} type="number" onChange={(v) => setKerf(Number(v))} /><label className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-300 p-3 text-sm font-black"><input type="checkbox" checked={respectGrain} onChange={(e) => setRespectGrain(e.target.checked)} />Respetar dirección de veta / beta</label><button onClick={guardarOptimizacion} className="mt-3 w-full rounded-2xl bg-[#020617] p-4 font-black text-white">Guardar optimización</button></Card><Card title="Corte visual industrial"><div className="space-y-6">{Array.from({ length: sheetCount }, (_, i) => i + 1).map((n) => { const pcs = layout.filter((p) => p.sheetNo === n); const used = pcs.reduce((s, p) => s + p.w * p.h, 0); const rawUsePercent = (used / (sheet.w * sheet.h)) * 100; const usePercent = Math.min(rawUsePercent, 100); const hasError = rawUsePercent > 100 || pcs.some((p) => p.error); const scale = Math.min(1, 760 / sheet.w); return <div key={n} className="rounded-2xl bg-slate-50 p-4"><div className="mb-2 flex justify-between text-sm font-black"><span>Hoja {n} · {sheet.label}</span><span className={hasError ? "text-red-600" : ""}>Uso {fmt(usePercent)}% {hasError ? "· REVISAR PIEZAS" : ""}</span></div><div className="relative border-2 border-slate-900 bg-blue-50" style={{ width: sheet.w * scale, height: sheet.h * scale }}>{pcs.map((p) => <div key={`${p.id}-${p.x}-${p.y}`} className={`absolute overflow-hidden border p-1 text-[10px] font-bold ${p.error ? "border-red-600 bg-red-100 text-red-700" : "border-blue-600 bg-blue-100"}`} style={{ left: p.x * scale, top: p.y * scale, width: p.w * scale, height: p.h * scale }} title={`${p.part_name} ${p.w}x${p.h}`}>{p.part_name}<br />{Math.round(p.w)}x{Math.round(p.h)} {p.rotated ? "↻" : ""}</div>)}</div></div>; })}{layout.length === 0 && <p className="py-20 text-center font-bold text-slate-400">Primero genera el despiece.</p>}</div></Card></div>}

        {tab === "costos" && <div className="grid gap-5 lg:grid-cols-2"><Card title="Costeo CEO"><Summary items={[["Material", selectedProject?.material_name || matName(selectedMaterial)], ["Formato hoja", sheet.label], ["Área piezas", `${fmt(totalArea)} m²`], ["Hojas reales", sheetCount], ["Hojas estimadas", fmt(hojasEstimadas)], ["Costo material", money(costoMaterial)], ["Precio sugerido", money(precioSugerido)]]} /><button onClick={generarOrdenProduccion} className="mt-4 w-full rounded-2xl bg-green-600 p-4 font-black text-white">Generar orden de producción</button></Card><Card title="Etiquetas por pieza"><div className="grid max-h-[600px] grid-cols-2 gap-3 overflow-auto">{projectParts.slice(0, 40).map((p) => <div key={p.id} className="rounded-2xl border border-dashed border-slate-400 bg-white p-3"><p className="text-xs font-black uppercase">RD Wood System</p><p className="mt-1 font-black">{p.part_name}</p><p className="text-xs">Material: {p.material_name}</p><p className="text-xs">Medida: {num(p.length)} x {num(p.width)} x {num(p.thickness)}</p><p className="text-xs">Cant: {num(p.qty || 1)}</p><p className="text-xs">Proyecto: {projectName(selectedProject)}</p></div>)}</div></Card></div>}

        {tab === "vista3d" && <Card title="Vista 3D PRO interactiva"><div className="mb-4 grid gap-3 md:grid-cols-4"><button onClick={() => { setViewRotX(-18); setViewRotY(-32); setViewZoom(1); }} className="rounded-2xl bg-slate-950 p-3 font-black text-white"><Rotate3D className="mr-2 inline h-4 w-4" />Vista inicial</button><Input label="Rotación X" type="number" value={viewRotX} onChange={(v) => setViewRotX(Number(v))} /><Input label="Rotación Y" type="number" value={viewRotY} onChange={(v) => setViewRotY(Number(v))} /><Input label="Zoom" type="number" value={viewZoom} onChange={(v) => setViewZoom(Number(v))} /></div><div className="relative min-h-[620px] overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-b from-slate-100 via-white to-slate-200 p-8"><div className="absolute left-6 top-6 rounded-2xl bg-white/80 px-4 py-3 text-xs font-black shadow"><Eye className="mr-2 inline h-4 w-4 text-blue-600" />Usa Rotación X/Y y Zoom para girar el mueble.</div><div className="absolute left-1/2 top-1/2" style={{ perspective: "1800px", transform: `translate(-50%, -50%) scale(${Math.max(0.4, viewZoom)})` }}><div className="relative" style={{ transformStyle: "preserve-3d", transform: `rotateX(${viewRotX}deg) rotateY(${viewRotY}deg)`, width: 1000, height: 420 }}><div className="absolute left-0 top-[320px] h-[34px] w-[1050px] rounded-[50%] bg-black/10 blur-xl" style={{ transform: "translateZ(-120px)" }} />{projectModules.map((m, index) => { const w = Math.max(80, num(m.width) / 3.5); const h = Math.max(80, num(m.height) / 5.5); const d = Math.max(70, num(m.depth) / 4.5); const x = index * (w + 22); const y = 320 - h; return <Cabinet3D key={m.id} x={x} y={y} w={w} h={h} d={d} name={moduleName(m)} doors={num(m.doors)} drawers={num(m.drawers)} shelves={num(m.shelves)} type={moduleType(m)} />; })}{projectModules.length === 0 && <div className="absolute left-[360px] top-[180px] rounded-3xl bg-white p-8 text-center font-black text-slate-400 shadow">Agrega módulos para ver la vista 3D.</div>}</div></div></div></Card>}
      </section>
    </main>
  );
}

function Cabinet3D({ x, y, w, h, d, name, doors, drawers, shelves, type }: { x: number; y: number; w: number; h: number; d: number; name: string; doors: number; drawers: number; shelves: number; type: string }) {
  const doorCount = Math.max(doors, type.toLowerCase().includes("closet") ? 2 : 0);
  const drawerCount = Math.max(drawers, 0);
  const shelfCount = Math.max(shelves, 0);
  return <div className="absolute" style={{ left: x, top: y, width: w, height: h, transformStyle: "preserve-3d", transform: `translateZ(${d / 2}px)` }}>
    <Face className="bg-gradient-to-br from-amber-100 to-amber-200 border-amber-900/60" style={{ width: w, height: h, transform: `translateZ(${d / 2}px)` }}><div className="absolute inset-2 rounded-xl border border-amber-900/20 bg-[repeating-linear-gradient(90deg,rgba(120,53,15,0.10)_0px,rgba(120,53,15,0.10)_1px,transparent_1px,transparent_14px)]" />{doorCount > 0 && Array.from({ length: doorCount }).map((_, i) => <div key={i} className="absolute bottom-4 top-4 rounded-lg border border-amber-900/40 bg-amber-50/50 shadow-inner" style={{ left: 10 + (i * (w - 20)) / doorCount, width: (w - 20) / doorCount - 4 }}><div className="absolute right-2 top-1/2 h-8 w-1 rounded-full bg-amber-900/40" /></div>)}{drawerCount > 0 && Array.from({ length: drawerCount }).map((_, i) => <div key={i} className="absolute left-4 right-4 rounded-lg border border-amber-900/40 bg-amber-50/60 shadow-inner" style={{ bottom: 12 + i * 42, height: 34 }}><div className="absolute left-1/2 top-3 h-1 w-12 -translate-x-1/2 rounded-full bg-amber-900/40" /></div>)}{shelfCount > 0 && doorCount === 0 && Array.from({ length: Math.min(shelfCount, 6) }).map((_, i) => <div key={i} className="absolute left-3 right-3 h-1 bg-amber-900/40" style={{ top: ((i + 1) * h) / (Math.min(shelfCount, 6) + 1) }} />)}<div className="absolute bottom-1 left-2 right-2 truncate rounded bg-white/60 px-2 py-1 text-[10px] font-black text-slate-800">{name}</div></Face>
    <Face className="bg-gradient-to-r from-amber-200 to-amber-300 border-amber-900/50" style={{ width: d, height: h, transform: `rotateY(90deg) translateZ(${w - d / 2}px)` }} />
    <Face className="bg-gradient-to-l from-amber-200 to-amber-300 border-amber-900/50" style={{ width: d, height: h, transform: `rotateY(90deg) translateZ(${-d / 2}px)` }} />
    <Face className="bg-gradient-to-b from-amber-100 to-amber-300 border-amber-900/50" style={{ width: w, height: d, transform: `rotateX(90deg) translateZ(${d / 2}px)` }} />
    <Face className="bg-gradient-to-t from-amber-200 to-amber-400 border-amber-900/50" style={{ width: w, height: d, transform: `rotateX(90deg) translateZ(${d / 2 - h}px)` }} />
  </div>;
}
function Face({ className, style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) { return <div className={`absolute left-0 top-0 overflow-hidden rounded-xl border shadow-xl ${className || ""}`} style={{ backfaceVisibility: "visible", ...style }}>{children}</div>; }
function Input({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: string) => void; type?: string }) { return <label className="grid gap-2 text-xs font-black uppercase text-slate-500">{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-2xl border border-slate-300 p-3 text-base font-bold normal-case text-slate-950 outline-none focus:border-blue-500" /></label>; }
function Card({ title, children }: { title: string; children: ReactNode }) { return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-2xl font-black">{title}</h2>{children}</div>; }
function Summary({ items }: { items: [string, any][] }) { return <div className="grid gap-3 md:grid-cols-4">{items.map(([k, v]) => <div key={k} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">{k}</p><p className="mt-1 text-lg font-black">{v}</p></div>)}</div>; }
function Table({ parts }: { parts: Part[] }) { return <div className="mt-4 overflow-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="p-3">Pieza</th><th className="p-3">Material</th><th className="p-3">Largo</th><th className="p-3">Ancho</th><th className="p-3">Espesor</th><th className="p-3">Cant.</th><th className="p-3">Cantos</th><th className="p-3">M²</th><th className="p-3">Nota</th></tr></thead><tbody>{parts.map((p) => <tr key={p.id} className="border-t border-slate-200"><td className="p-3 font-black">{p.part_name}</td><td className="p-3">{p.material_name}</td><td className="p-3">{num(p.length)} mm</td><td className="p-3">{num(p.width)} mm</td><td className="p-3">{num(p.thickness)} mm</td><td className="p-3 font-black">{num(p.qty || 1)}</td><td className="p-3">{[p.edge_front ? "Frente" : "", p.edge_back ? "Atrás" : "", p.edge_left ? "Izq" : "", p.edge_right ? "Der" : ""].filter(Boolean).join(" / ") || "N/A"}</td><td className="p-3">{fmt(mm2(num(p.length), num(p.width), num(p.qty || 1)), 3)}</td><td className="p-3">{p.notes || "—"}</td></tr>)}{parts.length === 0 && <tr><td className="p-10 text-center font-bold text-slate-400" colSpan={9}>No hay piezas generadas.</td></tr>}</tbody></table></div>; }
