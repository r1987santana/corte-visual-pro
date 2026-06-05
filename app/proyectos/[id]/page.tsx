"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import {
  ArrowLeft,
  Boxes,
  Calculator,
  ClipboardList,
  Hammer,
  Loader2,
  Package,
  PencilRuler,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  User,
  Wallet,
  Clock,
  Ruler,
  Layers,
  X,
  Wand2,
  Scissors,
  FileSpreadsheet,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type Project = {
  id: string;
  code?: string | null;
  project_code?: string | null;
  client_name?: string | null;
  phone?: string | null;
  project_name?: string | null;
  name?: string | null;
  project_type?: string | null;
  type?: string | null;
  status?: string | null;
  sale_total?: number | null;
  total?: number | null;
  sale_amount?: number | null;
  sale_price?: number | null;
  total_sale?: number | null;
  budgeted_price?: number | null;
  final_price?: number | null;
  approved_amount?: number | null;
  estimated_cost?: number | null;
  cost_total?: number | null;
  total_cost?: number | null;
  real_cost?: number | null;
  cost?: number | null;
  material_cost?: number | null;
  profit?: number | null;
  estimated_profit?: number | null;
  utility_amount?: number | null;
  profit_percent?: number | null;
  amount_paid?: number | null;
  paid_amount?: number | null;
  down_payment?: number | null;
  initial_payment?: number | null;
  balance_due?: number | null;
  balance?: number | null;
  pending_balance?: number | null;
  quote_id?: string | null;
  progress?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

type ProjectModule = {
  id: string;
  project_id: string;
  module_name?: string | null;
  name?: string | null;
  module_type?: string | null;
  type?: string | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  quantity?: number | null;
  material?: string | null;
  material_name?: string | null;
  color?: string | null;
  estimated_cost?: number | null;
  sale_price?: number | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type ModuleItem = {
  id: string;
  project_id: string;
  module_id: string;
  item_name: string;
  item_type?: string | null;
  material_name?: string | null;
  length?: number | null;
  width?: number | null;
  thickness?: number | null;
  quantity?: number | null;
  edge_front?: boolean | null;
  edge_back?: boolean | null;
  edge_left?: boolean | null;
  edge_right?: boolean | null;
  edge_band?: string | null;
  unit_cost?: number | null;
  total_cost?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

type CncLayout = {
  id: string;
  project_id: string;
  material?: string | null;
  board_type?: string | null;
  board_width?: number | null;
  board_height?: number | null;
  total_area?: number | null;
  used_area?: number | null;
  waste_area?: number | null;
  efficiency?: number | null;
  total_boards?: number | null;
  created_at?: string | null;
};

type CncLayoutItem = {
  id: string;
  layout_id: string;
  project_id: string;
  module_item_id?: string | null;
  sheet_number?: number | null;
  item_name?: string | null;
  material_name?: string | null;
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
  quantity?: number | null;
  rotated?: boolean | null;
  created_at?: string | null;
};

type ModuleForm = {
  module_name: string;
  module_type: string;
  width: string;
  height: string;
  depth: string;
  quantity: string;
  material: string;
  color: string;
  estimated_cost: string;
  sale_price: string;
  notes: string;
};

const money = (v?: number | null) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(Number(v || 0));

const date = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("es-DO") : "—";

const moduleTypes = [
  { value: "base", label: "Base" },
  { value: "aereo", label: "Aéreo" },
  { value: "torre", label: "Torre" },
  { value: "isla", label: "Isla" },
  { value: "closet", label: "Closet" },
  { value: "vanity", label: "Vanity" },
  { value: "gavetero", label: "Gavetero" },
  { value: "repisa", label: "Repisa" },
  { value: "otro", label: "Otro" },
];

const boardFormats = [
  { code: "4X8", name: "Hoja 4x8", width: 1220, height: 2440, area: (1220 * 2440) / 1000000 },
  { code: "7X8", name: "Hoja 7x8", width: 2140, height: 2440, area: (2140 * 2440) / 1000000 },
];


function n(v: any) {
  return Number(v || 0);
}

function pieceCost(length: number, width: number, qty: number) {
  const areaM2 = (length * width * qty) / 1000000;
  const estimatedSheetCostM2 = 1250; // base editable luego desde inventario
  return Math.round(areaM2 * estimatedSheetCostM2);
}

function hardwareCost(qty: number, unit: number) {
  return Math.round(qty * unit);
}

function generateItemsForModule(module: ProjectModule): Omit<ModuleItem, "id" | "created_at">[] {
  const project_id = module.project_id;
  const module_id = module.id;
  const moduleName = module.module_name || module.name || "Módulo";
  const type = String(module.module_type || module.type || "base");
  const width = n(module.width);
  const height = n(module.height);
  const depth = n(module.depth);
  const thickness = 18;
  const material = module.material || module.material_name || "Melamina 18mm";
  const qtyModule = Math.max(1, n(module.quantity) || 1);

  const parts: Omit<ModuleItem, "id" | "created_at">[] = [];

  const addPiece = (
    item_name: string,
    length: number,
    pieceWidth: number,
    quantity: number,
    edges: Partial<ModuleItem> = {},
    notes = ""
  ) => {
    const totalQty = quantity * qtyModule;
    const unitCost = pieceCost(length, pieceWidth, totalQty) / Math.max(totalQty, 1);
    parts.push({
      project_id,
      module_id,
      item_name,
      item_type: "pieza",
      material_name: material,
      length,
      width: pieceWidth,
      thickness,
      quantity: totalQty,
      unit_cost: Math.round(unitCost),
      total_cost: Math.round(unitCost * totalQty),
      edge_band: "PVC 1mm",
      notes,
      edge_front: false,
      edge_back: false,
      edge_left: false,
      edge_right: false,
      ...edges,
    });
  };

  const addHardware = (item_name: string, quantity: number, unit_cost: number, notes = "") => {
    const totalQty = quantity * qtyModule;
    parts.push({
      project_id,
      module_id,
      item_name,
      item_type: "herraje",
      material_name: item_name,
      length: 0,
      width: 0,
      thickness: 0,
      quantity: totalQty,
      unit_cost,
      total_cost: hardwareCost(totalQty, unit_cost),
      edge_band: null,
      notes,
    });
  };

  if (type === "base" || type === "gavetero" || type === "vanity") {
    addPiece(`${moduleName} - Lateral izquierdo`, depth, height, 1, { edge_front: true });
    addPiece(`${moduleName} - Lateral derecho`, depth, height, 1, { edge_front: true });
    addPiece(`${moduleName} - Piso`, width, depth, 1, { edge_front: true });
    addPiece(`${moduleName} - Techo/amarre`, width, depth, 1, { edge_front: true });
    addPiece(`${moduleName} - Fondo`, width, height, 1, {}, "Fondo estimado");
    addPiece(`${moduleName} - Puerta izquierda`, height, width / 2, 1, {
      edge_front: true,
      edge_back: true,
      edge_left: true,
      edge_right: true,
    });
    addPiece(`${moduleName} - Puerta derecha`, height, width / 2, 1, {
      edge_front: true,
      edge_back: true,
      edge_left: true,
      edge_right: true,
    });
    addHardware("Bisagra Cierre Suave", 4, 221.43);
    addHardware("Tornillos ensamblaje", 24, 2.5);
  } else if (type === "aereo") {
    addPiece(`${moduleName} - Lateral izquierdo`, depth, height, 1, { edge_front: true });
    addPiece(`${moduleName} - Lateral derecho`, depth, height, 1, { edge_front: true });
    addPiece(`${moduleName} - Piso`, width, depth, 1, { edge_front: true });
    addPiece(`${moduleName} - Techo`, width, depth, 1, { edge_front: true });
    addPiece(`${moduleName} - Fondo`, width, height, 1);
    addPiece(`${moduleName} - Puerta izquierda`, height, width / 2, 1, {
      edge_front: true,
      edge_back: true,
      edge_left: true,
      edge_right: true,
    });
    addPiece(`${moduleName} - Puerta derecha`, height, width / 2, 1, {
      edge_front: true,
      edge_back: true,
      edge_left: true,
      edge_right: true,
    });
    addHardware("Bisagra Cierre Suave", 4, 221.43);
    addHardware("Soporte aéreo", 2, 125);
  } else if (type === "torre" || type === "closet") {
    addPiece(`${moduleName} - Lateral izquierdo`, depth, height, 1, { edge_front: true });
    addPiece(`${moduleName} - Lateral derecho`, depth, height, 1, { edge_front: true });
    addPiece(`${moduleName} - Piso`, width, depth, 1, { edge_front: true });
    addPiece(`${moduleName} - Techo`, width, depth, 1, { edge_front: true });
    addPiece(`${moduleName} - División/repisa 1`, width, depth, 1, { edge_front: true });
    addPiece(`${moduleName} - División/repisa 2`, width, depth, 1, { edge_front: true });
    addPiece(`${moduleName} - Puerta izquierda`, height, width / 2, 1, {
      edge_front: true,
      edge_back: true,
      edge_left: true,
      edge_right: true,
    });
    addPiece(`${moduleName} - Puerta derecha`, height, width / 2, 1, {
      edge_front: true,
      edge_back: true,
      edge_left: true,
      edge_right: true,
    });
    addHardware("Bisagra Cierre Suave", 6, 221.43);
    addHardware("Tornillos ensamblaje", 36, 2.5);
  } else if (type === "isla") {
    addPiece(`${moduleName} - Lateral izquierdo`, depth, height, 1, { edge_front: true });
    addPiece(`${moduleName} - Lateral derecho`, depth, height, 1, { edge_front: true });
    addPiece(`${moduleName} - Frente`, width, height, 1, { edge_front: true });
    addPiece(`${moduleName} - Trasera`, width, height, 1, { edge_front: true });
    addPiece(`${moduleName} - Piso`, width, depth, 1, { edge_front: true });
    addPiece(`${moduleName} - Refuerzo superior`, width, depth, 1, { edge_front: true });
    addHardware("Pata niveladora", 6, 55);
    addHardware("Tornillos ensamblaje", 40, 2.5);
  } else {
    addPiece(`${moduleName} - Pieza principal`, width, height, 1, {
      edge_front: true,
      edge_back: true,
      edge_left: true,
      edge_right: true,
    });
    addHardware("Tornillos ensamblaje", 12, 2.5);
  }

  return parts;
}

export default function ProyectoDetallePage() {
  const params = useParams();
  const id = params?.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [modules, setModules] = useState<ProjectModule[]>([]);
  const [items, setItems] = useState<ModuleItem[]>([]);
  const [cncLayouts, setCncLayouts] = useState<CncLayout[]>([]);
  const [cncLayoutItems, setCncLayoutItems] = useState<CncLayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingModule, setSavingModule] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [openModule, setOpenModule] = useState(false);

  const [form, setForm] = useState<ModuleForm>({
    module_name: "",
    module_type: "base",
    width: "",
    height: "",
    depth: "",
    quantity: "1",
    material: "Melamina 18mm",
    color: "",
    estimated_cost: "",
    sale_price: "",
    notes: "",
  });

  const [selectedBoard, setSelectedBoard] = useState("4X8");
  const [toolSpacing, setToolSpacing] = useState(8);
  const [wastePercent, setWastePercent] = useState("12");
  const [sheetCost4x8, setSheetCost4x8] = useState("2500");
  const [sheetCost7x8, setSheetCost7x8] = useState("5200");

  async function loadAll() {
    if (!id) return;

    setLoading(true);
    setError("");

    const [projectRes, modulesRes, itemsRes, cncLayoutsRes, cncItemsRes] = await Promise.all([
      supabase.from("furniture_projects").select("*").eq("id", id).single(),
      supabase.from("project_modules").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("project_module_items").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("cnc_layouts").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("cnc_layout_items").select("*").eq("project_id", id).order("sheet_number", { ascending: true }),
    ]);

    if (projectRes.error) {
      setError(projectRes.error.message);
      setProject(null);
    } else {
      setProject(projectRes.data as Project);
    }

    if (modulesRes.error) {
      setError((old) => old || modulesRes.error.message);
      setModules([]);
    } else {
      setModules((modulesRes.data || []) as ProjectModule[]);
    }

    if (itemsRes.error) {
      setError((old) => old || itemsRes.error.message);
      setItems([]);
    } else {
      setItems((itemsRes.data || []) as ModuleItem[]);
    }

    if (cncLayoutsRes.error) {
      setCncLayouts([]);
    } else {
      setCncLayouts((cncLayoutsRes.data || []) as CncLayout[]);
    }

    if (cncItemsRes.error) {
      setCncLayoutItems([]);
    } else {
      setCncLayoutItems((cncItemsRes.data || []) as CncLayoutItem[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, [id]);

  const metrics = useMemo(() => {
    const ventaProyecto = Number(
      project?.sale_amount ??
        project?.sale_price ??
        project?.total_sale ??
        project?.budgeted_price ??
        project?.final_price ??
        project?.approved_amount ??
        project?.sale_total ??
        project?.total ??
        0
    );

    const costoProyecto = Number(
      project?.estimated_cost ??
        project?.total_cost ??
        project?.cost_total ??
        project?.real_cost ??
        project?.cost ??
        project?.material_cost ??
        0
    );

    const utilidadProyecto = Number(
      project?.estimated_profit ??
        project?.profit ??
        project?.utility_amount ??
        ventaProyecto - costoProyecto
    );

    const costoItems = items.reduce((sum, item) => sum + n(item.total_cost), 0);
    const ventaModulos = modules.reduce((sum, m) => sum + n(m.sale_price) * Math.max(1, n(m.quantity) || 1), 0);

    const venta = ventaModulos > 0 ? ventaModulos : ventaProyecto;
    const costo = costoItems > 0 ? costoItems : costoProyecto;
    const utilidad = ventaModulos > 0 || costoItems > 0 ? venta - costo : utilidadProyecto;

    return {
      venta,
      costo,
      utilidad,
      avance: Number(project?.progress || 0),
      modulos: modules.length,
      items: items.length,
      amountPaid: Number(project?.amount_paid ?? project?.paid_amount ?? project?.down_payment ?? project?.initial_payment ?? 0),
      balance: Number(project?.balance_due ?? project?.balance ?? project?.pending_balance ?? Math.max(venta - Number(project?.amount_paid || 0), 0)),
    };
  }, [project, modules, items]);

  const boardEstimate = useMemo(() => {
    const format = boardFormats.find((b) => b.code === selectedBoard) || boardFormats[0];
    const waste = Number(wastePercent || 0);
    const sheetCost = selectedBoard === "7X8" ? Number(sheetCost7x8 || 0) : Number(sheetCost4x8 || 0);

    const pieceItems = items.filter(
      (item) =>
        String(item.item_type || "pieza") === "pieza" &&
        n(item.length) > 0 &&
        n(item.width) > 0
    );

    const totalArea = pieceItems.reduce(
      (sum, item) => sum + (n(item.length) * n(item.width) * Math.max(1, n(item.quantity) || 1)) / 1000000,
      0
    );

    const requiredArea = totalArea * (1 + waste / 100);
    const sheetsNeeded = requiredArea > 0 ? Math.ceil(requiredArea / format.area) : 0;
    const usedArea = sheetsNeeded * format.area;
    const wasteArea = Math.max(0, usedArea - totalArea);
    const efficiency = usedArea > 0 ? (totalArea / usedArea) * 100 : 0;

    return {
      format,
      pieceCount: pieceItems.length,
      totalArea,
      requiredArea,
      sheetsNeeded,
      wasteArea,
      efficiency,
      estimatedCost: sheetsNeeded * sheetCost,
      sheetCost,
    };
  }, [items, selectedBoard, wastePercent, sheetCost4x8, sheetCost7x8]);

  async function recalcProject(nextItems: ModuleItem[] = items) {
    const costo = nextItems.reduce((sum, item) => sum + n(item.total_cost), 0);
    const ventaModulos = modules.reduce((sum, m) => sum + n(m.sale_price) * Math.max(1, n(m.quantity) || 1), 0);

    const ventaBase = Number(
      project?.sale_amount ??
        project?.sale_price ??
        project?.total_sale ??
        project?.budgeted_price ??
        project?.final_price ??
        project?.approved_amount ??
        project?.sale_total ??
        project?.total ??
        0
    );

    const venta = ventaModulos > 0 ? ventaModulos : ventaBase;
    const utilidad = venta - costo;

    async function safeProjectUpdate(field: string, value: any) {
      try {
        await supabase.from("furniture_projects").update({ [field]: value }).eq("id", id);
      } catch (err) {
        console.warn("Campo no aplicado en furniture_projects:", field, err);
      }
    }

    const updates: Record<string, any> = {
      estimated_cost: costo,
      total_cost: costo,
      cost_total: costo,
      real_cost: costo,
      cost: costo,
      profit: utilidad,
      estimated_profit: utilidad,
      utility_amount: utilidad,
      sale_amount: venta,
      sale_price: venta,
      total_sale: venta,
      sale_total: venta,
      total: venta,
      final_price: venta,
      approved_amount: venta,
    };

    for (const [field, value] of Object.entries(updates)) {
      await safeProjectUpdate(field, value);
    }

    setProject((prev) =>
      prev
        ? {
            ...prev,
            estimated_cost: costo,
            total_cost: costo,
            cost_total: costo,
            real_cost: costo,
            cost: costo,
            profit: utilidad,
            estimated_profit: utilidad,
            utility_amount: utilidad,
            sale_amount: venta,
            sale_price: venta,
            total_sale: venta,
            sale_total: venta,
            total: venta,
            final_price: venta,
            approved_amount: venta,
          }
        : prev
    );
  }

  async function createModule() {
    if (!form.module_name.trim()) {
      alert("Escribe el nombre del módulo.");
      return;
    }

    setSavingModule(true);
    setError("");

    const quantity = Number(form.quantity || 1);
    const estimated_cost = Number(form.estimated_cost || 0);
    const sale_price = Number(form.sale_price || 0);

    const payload: Record<string, any> = {
      project_id: id,
      module_name: form.module_name,
      name: form.module_name,
      module_type: form.module_type,
      type: form.module_type,
      width: Number(form.width || 0),
      height: Number(form.height || 0),
      depth: Number(form.depth || 0),
      quantity,
      material: form.material || null,
      material_name: form.material || null,
      color: form.color || null,
      estimated_cost,
      sale_price,
      status: "pendiente",
      notes: form.notes || null,
    };

    const { data, error } = await supabase
      .from("project_modules")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      setError(error.message);
      alert(`Error creando módulo: ${error.message}`);
    } else {
      setModules((prev) => [data as ProjectModule, ...prev]);
      setOpenModule(false);
      setForm({
        module_name: "",
        module_type: "base",
        width: "",
        height: "",
        depth: "",
        quantity: "1",
        material: "Melamina 18mm",
        color: "",
        estimated_cost: "",
        sale_price: "",
        notes: "",
      });
      alert("✅ Módulo agregado correctamente.");
    }

    setSavingModule(false);
  }

  async function deleteModule(moduleId: string) {
    const ok = confirm("¿Seguro que quieres eliminar este módulo y sus piezas?");
    if (!ok) return;

    const { error } = await supabase.from("project_modules").delete().eq("id", moduleId);

    if (error) {
      alert(`Error eliminando módulo: ${error.message}`);
      return;
    }

    const nextModules = modules.filter((m) => m.id !== moduleId);
    const nextItems = items.filter((i) => i.module_id !== moduleId);
    setModules(nextModules);
    setItems(nextItems);
    await recalcProject(nextItems);
  }

  async function generateBOMForModule(module: ProjectModule) {
    setGenerating(true);
    setError("");

    await supabase.from("project_module_items").delete().eq("module_id", module.id);

    const generated = generateItemsForModule(module);
    const { data, error } = await supabase
      .from("project_module_items")
      .insert(generated)
      .select("*");

    if (error) {
      setError(error.message);
      alert(`Error generando BOM: ${error.message}`);
    } else {
      const withoutOld = items.filter((item) => item.module_id !== module.id);
      const nextItems = [...(data as ModuleItem[]), ...withoutOld];
      setItems(nextItems);
      await recalcProject(nextItems);
      alert("✅ BOM generado para el módulo.");
    }

    setGenerating(false);
  }

  async function generateAllBOM() {
    if (modules.length === 0) {
      alert("Agrega módulos primero.");
      return;
    }

    const ok = confirm("Esto regenerará las piezas/BOM de todos los módulos. ¿Continuar?");
    if (!ok) return;

    setGenerating(true);
    setError("");

    await supabase.from("project_module_items").delete().eq("project_id", id);

    const allGenerated = modules.flatMap((m) => generateItemsForModule(m));

    const { data, error } = await supabase
      .from("project_module_items")
      .insert(allGenerated)
      .select("*");

    if (error) {
      setError(error.message);
      alert(`Error generando BOM general: ${error.message}`);
    } else {
      const nextItems = (data || []) as ModuleItem[];
      setItems(nextItems);
      await recalcProject(nextItems);
      alert("✅ BOM automático generado para todo el proyecto.");
    }

    setGenerating(false);
  }


  async function generateCncLayout() {
    if (items.length === 0) {
      alert("Genera BOM primero.");
      return;
    }

    const format = boardFormats.find((b) => b.code === selectedBoard) || boardFormats[0];
    const kerf = Math.max(3, Number(toolSpacing || 8));
    const boardW = Number(format.width || 0);
    const boardH = Number(format.height || 0);

    if (!boardW || !boardH) {
      alert("Formato de tablero inválido.");
      return;
    }

    const pieceItems = items.filter(
      (item) =>
        String(item.item_type || "pieza").toLowerCase() === "pieza" &&
        n(item.length) > 0 &&
        n(item.width) > 0
    );

    if (pieceItems.length === 0) {
      alert("No hay piezas de tablero para optimizar.");
      return;
    }

    type ExpandedPiece = {
      source: ModuleItem;
      name: string;
      material: string;
      thickness: number;
      rawW: number;
      rawH: number;
      area: number;
      grain: "vertical" | "horizontal" | "libre";
      edgeLabel: string;
      colorClass: string;
    };

    type Rect = {
      x: number;
      y: number;
      w: number;
      h: number;
    };

    type Placement = Rect & {
      rectIndex: number;
      rotated: boolean;
      score: number;
    };

    type PlacedPiece = Omit<CncLayoutItem, "id" | "created_at">;

    function getGrain(item: ModuleItem): "vertical" | "horizontal" | "libre" {
      const name = String(item.item_name || "").toLowerCase();

      if (
        name.includes("puerta") ||
        name.includes("lateral") ||
        name.includes("frente") ||
        name.includes("visible")
      ) {
        return "vertical";
      }

      if (name.includes("piso") || name.includes("techo") || name.includes("amarre")) {
        return "horizontal";
      }

      return "libre";
    }

    function getEdgeLabel(item: ModuleItem) {
      const edges: string[] = [];
      if (item.edge_front) edges.push("F");
      if (item.edge_back) edges.push("B");
      if (item.edge_left) edges.push("L");
      if (item.edge_right) edges.push("R");
      return edges.length ? edges.join("/") : "—";
    }

    function getPieceColorClass(item: ModuleItem) {
      const name = String(item.item_name || "").toLowerCase();

      if (name.includes("puerta")) return "bg-emerald-500/25 border-emerald-300/70 text-emerald-50";
      if (name.includes("lateral")) return "bg-cyan-500/25 border-cyan-300/70 text-cyan-50";
      if (name.includes("piso") || name.includes("techo")) return "bg-blue-500/25 border-blue-300/70 text-blue-50";
      if (name.includes("fondo")) return "bg-violet-500/25 border-violet-300/70 text-violet-50";

      return "bg-sky-500/20 border-sky-300/60 text-sky-50";
    }

    const expanded: ExpandedPiece[] = [];

    pieceItems.forEach((item) => {
      const qty = Math.max(1, Math.round(n(item.quantity) || 1));
      const material = item.material_name || "Material sin nombre";
      const thickness = n(item.thickness) || 18;

      for (let i = 0; i < qty; i++) {
        const rawW = n(item.length);
        const rawH = n(item.width);

        expanded.push({
          source: item,
          name: qty > 1 ? `${item.item_name} #${i + 1}` : item.item_name,
          material,
          thickness,
          rawW,
          rawH,
          area: rawW * rawH,
          grain: getGrain(item),
          edgeLabel: getEdgeLabel(item),
          colorClass: getPieceColorClass(item),
        });
      }
    });

    const groups = new Map<string, ExpandedPiece[]>();

    expanded.forEach((piece) => {
      const key = `${piece.material} | ${piece.thickness}mm`;
      const current = groups.get(key) || [];
      current.push(piece);
      groups.set(key, current);
    });

    function fits(pieceW: number, pieceH: number, rect: Rect) {
      return pieceW <= rect.w && pieceH <= rect.h;
    }

    function normalizeFreeRects(rects: Rect[]) {
      const clean = rects
        .filter((r) => r.w > 20 && r.h > 20)
        .map((r) => ({
          x: Math.max(0, r.x),
          y: Math.max(0, r.y),
          w: Math.max(0, Math.min(r.w, boardW - r.x)),
          h: Math.max(0, Math.min(r.h, boardH - r.y)),
        }))
        .filter((r) => r.w > 20 && r.h > 20);

      return clean.filter((a, index) => {
        return !clean.some((b, bIndex) => {
          if (index === bIndex) return false;
          return (
            a.x >= b.x &&
            a.y >= b.y &&
            a.x + a.w <= b.x + b.w &&
            a.y + a.h <= b.y + b.h
          );
        });
      });
    }

    function rectsOverlap(a: Rect, b: Rect) {
      return !(
        a.x + a.w <= b.x ||
        b.x + b.w <= a.x ||
        a.y + a.h <= b.y ||
        b.y + b.h <= a.y
      );
    }

    function splitFreeRect(free: Rect, used: Rect): Rect[] {
      if (!rectsOverlap(free, used)) return [free];

      const result: Rect[] = [];

      const freeRight = free.x + free.w;
      const freeBottom = free.y + free.h;
      const usedRight = used.x + used.w;
      const usedBottom = used.y + used.h;

      if (used.x > free.x) {
        result.push({
          x: free.x,
          y: free.y,
          w: used.x - free.x - kerf,
          h: free.h,
        });
      }

      if (usedRight < freeRight) {
        result.push({
          x: usedRight + kerf,
          y: free.y,
          w: freeRight - usedRight - kerf,
          h: free.h,
        });
      }

      if (used.y > free.y) {
        result.push({
          x: free.x,
          y: free.y,
          w: free.w,
          h: used.y - free.y - kerf,
        });
      }

      if (usedBottom < freeBottom) {
        result.push({
          x: free.x,
          y: usedBottom + kerf,
          w: free.w,
          h: freeBottom - usedBottom - kerf,
        });
      }

      return result;
    }

    function choosePlacement(piece: ExpandedPiece, freeRects: Rect[]): Placement | null {
      let best: Placement | null = null;

      freeRects.forEach((rect, rectIndex) => {
        const orientations =
          piece.grain === "vertical"
            ? [{ w: piece.rawW, h: piece.rawH, rotated: false }]
            : piece.grain === "horizontal"
              ? [{ w: piece.rawH, h: piece.rawW, rotated: true }]
              : [
                  { w: piece.rawW, h: piece.rawH, rotated: false },
                  { w: piece.rawH, h: piece.rawW, rotated: true },
                ];

        orientations.forEach((o) => {
          if (!fits(o.w, o.h, rect)) return;

          const leftoverW = rect.w - o.w;
          const leftoverH = rect.h - o.h;
          const shortSide = Math.min(leftoverW, leftoverH);
          const longSide = Math.max(leftoverW, leftoverH);

          const score =
            shortSide * 1000000 +
            longSide * 1000 +
            rect.y * 10 +
            rect.x;

          if (!best || score < best.score) {
            best = {
              rectIndex,
              x: rect.x,
              y: rect.y,
              w: o.w,
              h: o.h,
              rotated: o.rotated,
              score,
            };
          }
        });
      });

      return best;
    }

    function createEmptySheet() {
      return {
        freeRects: [{ x: 0, y: 0, w: boardW, h: boardH }] as Rect[],
        placed: [] as PlacedPiece[],
      };
    }

    function packGroup(groupPieces: ExpandedPiece[], groupKey: string) {
      const sheets = [createEmptySheet()];

      const sorted = [...groupPieces].sort((a, b) => {
        const maxA = Math.max(a.rawW, a.rawH);
        const maxB = Math.max(b.rawW, b.rawH);
        if (maxB !== maxA) return maxB - maxA;
        return b.area - a.area;
      });

      sorted.forEach((piece) => {
        const canFitBoard =
          piece.grain === "vertical"
            ? piece.rawW <= boardW && piece.rawH <= boardH
            : piece.grain === "horizontal"
              ? piece.rawH <= boardW && piece.rawW <= boardH
              : (piece.rawW <= boardW && piece.rawH <= boardH) ||
                (piece.rawH <= boardW && piece.rawW <= boardH);

        if (!canFitBoard) {
          const lastSheet = sheets[sheets.length - 1];
          lastSheet.placed.push({
            layout_id: "",
            project_id: id,
            module_item_id: piece.source.id,
            sheet_number: sheets.length,
            item_name: `NO CABE EN ${selectedBoard}: ${piece.name}`,
            material_name: piece.material,
            x: 0,
            y: 0,
            width: piece.rawW,
            height: piece.rawH,
            quantity: 1,
            rotated: false,
          });
          return;
        }

        let placed = false;

        for (let sheetIndex = 0; sheetIndex < sheets.length; sheetIndex++) {
          const sheet = sheets[sheetIndex];
          const placement = choosePlacement(piece, sheet.freeRects);

          if (!placement) continue;

          const usedRect: Rect = {
            x: placement.x,
            y: placement.y,
            w: placement.w,
            h: placement.h,
          };

          const insideBoard =
            usedRect.x >= 0 &&
            usedRect.y >= 0 &&
            usedRect.x + usedRect.w <= boardW &&
            usedRect.y + usedRect.h <= boardH;

          const collides = sheet.placed.some((p) =>
            rectsOverlap(
              { x: Number(p.x || 0), y: Number(p.y || 0), w: Number(p.width || 0), h: Number(p.height || 0) },
              usedRect
            )
          );

          if (!insideBoard || collides) continue;

          sheet.placed.push({
            layout_id: "",
            project_id: id,
            module_item_id: piece.source.id,
            sheet_number: sheetIndex + 1,
            item_name: piece.name,
            material_name: piece.material,
            x: usedRect.x,
            y: usedRect.y,
            width: usedRect.w,
            height: usedRect.h,
            quantity: 1,
            rotated: placement.rotated,
          });

          let newFree: Rect[] = [];

          sheet.freeRects.forEach((free) => {
            newFree.push(...splitFreeRect(free, usedRect));
          });

          sheet.freeRects = normalizeFreeRects(newFree);
          placed = true;
          break;
        }

        if (!placed) {
          const newSheet = createEmptySheet();
          const placement = choosePlacement(piece, newSheet.freeRects);

          if (placement) {
            const usedRect: Rect = {
              x: placement.x,
              y: placement.y,
              w: placement.w,
              h: placement.h,
            };

            newSheet.placed.push({
              layout_id: "",
              project_id: id,
              module_item_id: piece.source.id,
              sheet_number: sheets.length + 1,
              item_name: piece.name,
              material_name: piece.material,
              x: usedRect.x,
              y: usedRect.y,
              width: usedRect.w,
              height: usedRect.h,
              quantity: 1,
              rotated: placement.rotated,
            });

            let newFree: Rect[] = [];
            newSheet.freeRects.forEach((free) => {
              newFree.push(...splitFreeRect(free, usedRect));
            });
            newSheet.freeRects = normalizeFreeRects(newFree);
          }

          sheets.push(newSheet);
        }
      });

      const placed = sheets.flatMap((sheet, index) =>
        sheet.placed.map((p) => ({
          ...p,
          sheet_number: index + 1,
        }))
      );

      return placed;
    }

    setGenerating(true);
    setError("");

    await supabase.from("cnc_layout_items").delete().eq("project_id", id);
    await supabase.from("cnc_layouts").delete().eq("project_id", id);

    const createdLayouts: CncLayout[] = [];
    const createdItems: CncLayoutItem[] = [];

    for (const [groupKey, groupPieces] of Array.from(groups.entries())) {
      const placed = packGroup(groupPieces, groupKey);

      const totalBoards = Math.max(1, Math.max(...placed.map((p) => Number(p.sheet_number || 1))));
      const totalArea = groupPieces.reduce((sum, p) => sum + p.area / 1000000, 0);
      const usedArea = totalBoards * format.area;
      const wasteArea = Math.max(0, usedArea - totalArea);
      const efficiency = usedArea > 0 ? (totalArea / usedArea) * 100 : 0;

      const { data: layout, error: layoutError } = await supabase
        .from("cnc_layouts")
        .insert({
          project_id: id,
          material: groupKey,
          board_type: selectedBoard,
          board_width: boardW,
          board_height: boardH,
          total_area: Number(totalArea.toFixed(4)),
          used_area: Number(usedArea.toFixed(4)),
          waste_area: Number(wasteArea.toFixed(4)),
          efficiency: Number(efficiency.toFixed(2)),
          total_boards: totalBoards,
        })
        .select("*")
        .single();

      if (layoutError) {
        setGenerating(false);
        setError(layoutError.message);
        alert(`Error creando layout CNC: ${layoutError.message}`);
        return;
      }

      const rows = placed.map((p) => ({ ...p, layout_id: layout.id }));

      const { data: inserted, error: itemsError } = await supabase
        .from("cnc_layout_items")
        .insert(rows)
        .select("*");

      if (itemsError) {
        setGenerating(false);
        setError(itemsError.message);
        alert(`Error creando piezas CNC: ${itemsError.message}`);
        return;
      }

      createdLayouts.push(layout as CncLayout);
      createdItems.push(...((inserted || []) as CncLayoutItem[]));
    }

    setCncLayouts(createdLayouts);
    setCncLayoutItems(createdItems);
    setGenerating(false);

    const boards = createdLayouts.reduce((sum, l) => sum + Number(l.total_boards || 0), 0);
    const avgEfficiency =
      createdLayouts.length > 0
        ? createdLayouts.reduce((sum, l) => sum + Number(l.efficiency || 0), 0) / createdLayouts.length
        : 0;

    alert(`✅ CNC PRO creado: ${boards} hoja(s) · ${avgEfficiency.toFixed(1)}% eficiencia promedio`);
  }

  function downloadTextFile(filename: string, content: string, mime = "text/plain") {
    const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function csvValue(value: any) {
    const safe = String(value ?? "").replace(/"/g, '""');
    return `"${safe}"`;
  }

  function exportCncCsv() {
    if (cncLayoutItems.length === 0) {
      alert("Primero genera el mapa CNC.");
      return;
    }

    const headers = [
      "Proyecto",
      "Codigo",
      "Hoja",
      "Material",
      "Pieza",
      "X",
      "Y",
      "Ancho",
      "Alto",
      "Rotada",
      "Cantidad",
    ];

    const rows = cncLayoutItems.map((item) => [
      project?.project_name || (project as any)?.name || "Proyecto",
      (project as any)?.project_code || (project as any)?.code || id,
      item.sheet_number || 1,
      item.material_name || "",
      item.item_name || "",
      Number(item.x || 0),
      Number(item.y || 0),
      Number(item.width || 0),
      Number(item.height || 0),
      item.rotated ? "SI" : "NO",
      Number(item.quantity || 1),
    ]);

    const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
    downloadTextFile(`RDWOOD_CNC_${(project as any)?.project_code || id}.csv`, csv, "text/csv");
  }

  function exportCncLabelsCsv() {
    if (cncLayoutItems.length === 0) {
      alert("Primero genera el mapa CNC.");
      return;
    }

    const headers = [
      "Etiqueta",
      "Proyecto",
      "Cliente",
      "Hoja",
      "Pieza",
      "Material",
      "Medida",
      "Rotacion",
      "QR_Data",
    ];

    const rows = cncLayoutItems.map((item, index) => {
      const label = `LBL-${String(index + 1).padStart(4, "0")}`;
      const medida = `${Number(item.width || 0)} x ${Number(item.height || 0)} mm`;
      const qr = `${(project as any)?.project_code || id}|${item.sheet_number || 1}|${item.item_name || ""}|${medida}`;
      return [
        label,
        project?.project_name || (project as any)?.name || "Proyecto",
        project?.client_name || "Cliente",
        item.sheet_number || 1,
        item.item_name || "",
        item.material_name || "",
        medida,
        item.rotated ? "ROTADA" : "NORMAL",
        qr,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
    downloadTextFile(`RDWOOD_ETIQUETAS_${(project as any)?.project_code || id}.csv`, csv, "text/csv");
  }

  function exportCncCutListTxt() {
    if (cncLayoutItems.length === 0) {
      alert("Primero genera el mapa CNC.");
      return;
    }

    const lines: string[] = [];
    lines.push("RD WOOD SYSTEM - ORDEN CNC");
    lines.push("=====================================");
    lines.push(`Proyecto: ${project?.project_name || (project as any)?.name || "Proyecto"}`);
    lines.push(`Cliente: ${project?.client_name || "Cliente"}`);
    lines.push(`Código: ${(project as any)?.project_code || (project as any)?.code || id}`);
    lines.push(`Fecha: ${new Date().toLocaleString("es-DO")}`);
    lines.push("");

    cncLayouts.forEach((layout) => {
      lines.push(`MATERIAL: ${layout.material || "Material"}`);
      lines.push(`FORMATO: ${layout.board_type || selectedBoard} | HOJAS: ${layout.total_boards || 0} | EFICIENCIA: ${Number(layout.efficiency || 0).toFixed(1)}%`);
      lines.push("-------------------------------------");

      const itemsLayout = cncLayoutItems
        .filter((item) => item.layout_id === layout.id)
        .sort((a, b) => Number(a.sheet_number || 1) - Number(b.sheet_number || 1));

      itemsLayout.forEach((item, index) => {
        lines.push(
          `${index + 1}. Hoja ${item.sheet_number || 1} | ${item.item_name || ""} | ${Number(item.width || 0)} x ${Number(item.height || 0)} mm | X:${Number(item.x || 0)} Y:${Number(item.y || 0)} | ${item.rotated ? "ROTADA" : "NORMAL"}`
        );
      });

      lines.push("");
    });

    downloadTextFile(`RDWOOD_ORDEN_CNC_${(project as any)?.project_code || id}.txt`, lines.join("\n"));
  }

  function qrUrl(value: string) {
    return `https://quickchart.io/qr?size=180&text=${encodeURIComponent(value)}`;
  }

  function printCncQrLabels() {
    if (cncLayoutItems.length === 0) {
      alert("Primero genera el mapa CNC.");
      return;
    }

    const projectCode = (project as any)?.project_code || (project as any)?.code || id;
    const projectName = project?.project_name || (project as any)?.name || "Proyecto";
    const clientName = project?.client_name || "Cliente";

    const html = `
      <html>
        <head>
          <title>Etiquetas QR RD WOOD</title>
          <style>
            @page {
              size: Letter;
              margin: 10mm;
            }

            body {
              font-family: Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
            }

            .sheet {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
            }

            .label {
              border: 2px solid #0f172a;
              border-radius: 10px;
              padding: 10px;
              min-height: 170px;
              display: grid;
              grid-template-columns: 110px 1fr;
              gap: 10px;
              page-break-inside: avoid;
              background: #ffffff;
            }

            .qr {
              width: 105px;
              height: 105px;
              border: 1px solid #cbd5e1;
              padding: 4px;
            }

            .brand {
              font-size: 11px;
              font-weight: 900;
              letter-spacing: 1.5px;
              color: #0f172a;
              margin-bottom: 4px;
            }

            .piece {
              font-size: 13px;
              font-weight: 900;
              margin-bottom: 6px;
              color: #020617;
            }

            .row {
              font-size: 10.5px;
              margin-bottom: 3px;
              line-height: 1.25;
            }

            .row b {
              font-weight: 900;
            }

            .code {
              margin-top: 6px;
              padding: 4px 6px;
              background: #e2e8f0;
              border-radius: 6px;
              font-size: 10px;
              font-weight: 900;
            }

            .cut {
              margin-top: 5px;
              font-size: 11px;
              font-weight: 900;
              color: #0369a1;
            }
          </style>
        </head>

        <body>
          <div class="sheet">
            ${cncLayoutItems
              .map((item, index) => {
                const labelCode = `LBL-${String(index + 1).padStart(4, "0")}`;
                const medida = `${Number(item.width || 0)} x ${Number(item.height || 0)} mm`;
                const qrData = [
                  `RDWOOD`,
                  `PROYECTO:${projectCode}`,
                  `CLIENTE:${clientName}`,
                  `PIEZA:${item.item_name || ""}`,
                  `MATERIAL:${item.material_name || ""}`,
                  `MEDIDA:${medida}`,
                  `HOJA:${item.sheet_number || 1}`,
                  `X:${Number(item.x || 0)}`,
                  `Y:${Number(item.y || 0)}`,
                  `ROTADA:${item.rotated ? "SI" : "NO"}`,
                  `ETIQUETA:${labelCode}`,
                ].join("|");

                return `
                  <div class="label">
                    <div>
                      <img class="qr" src="${qrUrl(qrData)}" />
                      <div class="code">${labelCode}</div>
                    </div>

                    <div>
                      <div class="brand">RD WOOD SYSTEM</div>
                      <div class="piece">${item.item_name || ""}</div>

                      <div class="row"><b>Proyecto:</b> ${projectName}</div>
                      <div class="row"><b>Cliente:</b> ${clientName}</div>
                      <div class="row"><b>Material:</b> ${item.material_name || ""}</div>
                      <div class="row"><b>Medida:</b> ${medida}</div>
                      <div class="row"><b>Hoja:</b> ${item.sheet_number || 1}</div>
                      <div class="row"><b>Posición:</b> X:${Number(item.x || 0)} / Y:${Number(item.y || 0)}</div>
                      <div class="row"><b>Rotación:</b> ${item.rotated ? "ROTADA" : "NORMAL"}</div>

                      <div class="cut">CORTE CNC · PRODUCCIÓN</div>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </body>
      </html>
    `;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();

    setTimeout(() => {
      win.print();
    }, 800);
  }

  function printCncReport() {
    if (cncLayoutItems.length === 0) {
      alert("Primero genera el mapa CNC.");
      return;
    }

    function groupBySheet(items: CncLayoutItem[]) {
      const map = new Map<number, CncLayoutItem[]>();
      items.forEach((item) => {
        const sheet = Number(item.sheet_number || 1);
        const list = map.get(sheet) || [];
        list.push(item);
        map.set(sheet, list);
      });

      return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
    }

    function buildCutSteps(items: CncLayoutItem[]) {
      const sorted = [...items].sort((a, b) => {
        const ay = Number(a.y || 0);
        const by = Number(b.y || 0);
        if (ay !== by) return ay - by;
        return Number(a.x || 0) - Number(b.x || 0);
      });

      const rows: string[] = [];
      const usedY = new Set<number>();

      sorted.forEach((item) => {
        const y = Math.round(Number(item.y || 0));
        if (!usedY.has(y)) {
          usedY.add(y);
          rows.push(`Corte horizontal inicial/franja en Y=${y}mm`);
        }

        rows.push(
          `Cortar pieza: ${item.item_name || ""} | ${Number(item.width || 0)} x ${Number(item.height || 0)}mm | Posición X:${Number(item.x || 0)} Y:${Number(item.y || 0)} | ${item.rotated ? "ROTADA" : "NORMAL"}`
        );
      });

      return rows;
    }

    const projectCode = (project as any)?.project_code || (project as any)?.code || id;
    const projectName = project?.project_name || (project as any)?.name || "Proyecto";
    const clientName = project?.client_name || "Cliente";

    const html = `
      <html>
        <head>
          <title>RD WOOD CNC - Guía de Corte</title>
          <style>
            @page {
              size: Letter;
              margin: 9mm;
            }

            * {
              box-sizing: border-box;
            }

            body {
              font-family: Arial, sans-serif;
              padding: 0;
              color: #0f172a;
              font-size: 11px;
            }

            h1 {
              margin: 0 0 4px;
              font-size: 24px;
              letter-spacing: 0.5px;
            }

            h2 {
              margin: 16px 0 8px;
              font-size: 16px;
              background: #0f172a;
              color: white;
              padding: 8px 10px;
              border-radius: 6px;
            }

            h3 {
              margin: 12px 0 6px;
              font-size: 14px;
              color: #0369a1;
            }

            .top {
              display: grid;
              grid-template-columns: 1.4fr 1fr;
              gap: 10px;
              margin-bottom: 12px;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 10px;
            }

            .brand {
              font-weight: 900;
              letter-spacing: 2px;
              color: #0f172a;
            }

            .meta {
              line-height: 1.4;
              color: #334155;
            }

            .alert {
              border: 2px solid #0369a1;
              background: #e0f2fe;
              color: #0c4a6e;
              padding: 8px 10px;
              border-radius: 8px;
              font-weight: 800;
              margin: 10px 0;
            }

            .sheet-page {
              page-break-inside: avoid;
              margin-bottom: 18px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
              font-size: 10px;
            }

            th, td {
              border: 1px solid #94a3b8;
              padding: 5px;
              text-align: left;
              vertical-align: top;
            }

            th {
              background: #e2e8f0;
              color: #0f172a;
              font-weight: 900;
            }

            .cut-plan {
              display: grid;
              grid-template-columns: 1.1fr 1fr;
              gap: 10px;
              align-items: start;
            }

            .board {
              position: relative;
              width: 100%;
              border: 2px solid #0f172a;
              background: #f8fafc;
              overflow: hidden;
              border-radius: 8px;
            }

            .piece {
              position: absolute;
              border: 1px solid #0284c7;
              background: #bae6fd;
              color: #0f172a;
              overflow: hidden;
              padding: 2px;
              font-size: 7px;
              font-weight: 900;
            }

            .steps {
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 8px;
              background: #f8fafc;
            }

            .steps ol {
              margin: 6px 0 0 18px;
              padding: 0;
            }

            .steps li {
              margin-bottom: 5px;
              line-height: 1.3;
            }

            .badge {
              display: inline-block;
              padding: 3px 7px;
              border-radius: 999px;
              background: #dbeafe;
              color: #1e40af;
              font-weight: 900;
              font-size: 10px;
            }

            .note {
              margin-top: 8px;
              font-size: 10px;
              color: #475569;
              line-height: 1.35;
            }

            .footer {
              margin-top: 12px;
              padding-top: 8px;
              border-top: 1px solid #cbd5e1;
              color: #64748b;
              font-size: 9px;
            }
          </style>
        </head>

        <body>
          <div class="top">
            <div>
              <div class="brand">RD WOOD SYSTEM</div>
              <h1>GUÍA DE CORTE CNC / ESCUADRADORA</h1>
              <div class="meta">
                Proyecto: <b>${projectName}</b><br/>
                Cliente: <b>${clientName}</b><br/>
                Código: <b>${projectCode}</b><br/>
                Fecha: ${new Date().toLocaleString("es-DO")}
              </div>
            </div>

            <div class="alert">
              USO OPERADOR: cortar por hoja. Primero revisar formato, material, veta y medida. Luego ejecutar cortes por franjas y piezas según la secuencia.
            </div>
          </div>

          ${cncLayouts
            .map((layout) => {
              const itemsLayout = cncLayoutItems.filter((item) => item.layout_id === layout.id);
              const boardW = Number(layout.board_width || 1220);
              const boardH = Number(layout.board_height || 2440);
              const sheets = groupBySheet(itemsLayout);

              return `
                <h2>
                  ${layout.material || "Material"}
                  <span class="badge">${layout.board_type || selectedBoard}</span>
                  <span class="badge">${layout.total_boards || 0} hoja(s)</span>
                  <span class="badge">${Number(layout.efficiency || 0).toFixed(1)}% eficiencia</span>
                </h2>

                ${sheets
                  .map(([sheetNo, sheetItems]) => {
                    const steps = buildCutSteps(sheetItems);
                    const scale = 100 / boardW;

                    return `
                      <div class="sheet-page">
                        <h3>Hoja ${sheetNo} · Formato ${boardW} x ${boardH} mm</h3>

                        <div class="cut-plan">
                          <div>
                            <div
                              class="board"
                              style="aspect-ratio:${boardW}/${boardH};"
                            >
                              ${sheetItems
                                .map((item, index) => {
                                  const left = Number(item.x || 0) * scale;
                                  const top = Number(item.y || 0) * scale;
                                  const width = Number(item.width || 0) * scale;
                                  const height = Number(item.height || 0) * scale;

                                  return `
                                    <div
                                      class="piece"
                                      style="
                                        left:${left}%;
                                        top:${top}%;
                                        width:${Math.max(width, 3)}%;
                                        height:${Math.max(height, 3)}%;
                                      "
                                    >
                                      ${index + 1}. ${item.item_name || ""}<br/>
                                      ${Number(item.width || 0)}x${Number(item.height || 0)}
                                    </div>
                                  `;
                                })
                                .join("")}
                            </div>

                            <div class="note">
                              Mapa visual para referencia. Las medidas reales están en la tabla y secuencia. Confirmar veta antes de cortar.
                            </div>
                          </div>

                          <div class="steps">
                            <b>Secuencia sugerida para operador:</b>
                            <ol>
                              ${steps.map((step) => `<li>${step}</li>`).join("")}
                            </ol>
                          </div>
                        </div>

                        <table>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Pieza</th>
                              <th>Medida final</th>
                              <th>X / Y</th>
                              <th>Rotación</th>
                              <th>Material</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${sheetItems
                              .map(
                                (item, index) => `
                                  <tr>
                                    <td>${index + 1}</td>
                                    <td><b>${item.item_name || ""}</b></td>
                                    <td>${Number(item.width || 0)} x ${Number(item.height || 0)} mm</td>
                                    <td>X:${Number(item.x || 0)} / Y:${Number(item.y || 0)}</td>
                                    <td>${item.rotated ? "ROTADA" : "NORMAL"}</td>
                                    <td>${item.material_name || ""}</td>
                                  </tr>
                                `
                              )
                              .join("")}
                          </tbody>
                        </table>
                      </div>
                    `;
                  })
                  .join("")}
              `;
            })
            .join("")}

          <div class="footer">
            RD WOOD SYSTEM · Reporte generado automáticamente. Validar medidas antes de producción final.
          </div>
        </body>
      </html>
    `;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();

    setTimeout(() => {
      win.print();
    }, 700);
  }

  async function generateProductionOrder() {
    try {
      if (items.length === 0) {
        alert("Genera BOM primero.");
        return;
      }

      const ok = confirm("¿Crear orden de producción con todas las piezas/BOM generadas?");
      if (!ok) return;

      setGenerating(true);
      setError("");

      const orderCode = `OP-${Date.now()}`;
      const totalCost = items.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);

      const { data: order, error: orderError } = await supabase
        .from("production_orders")
        .insert({
          project_id: id,
          order_code: orderCode,
          code: orderCode,
          order_number: orderCode,
          project_name: project?.project_name || (project as any)?.name || "Proyecto",
          client_name: project?.client_name || "Cliente General",
          project_type: project?.project_type || project?.type || "proyecto",
          source: "project_bom",
          status: "pendiente",
          estado: "pendiente",
          total_items: items.length,
          total_cost: totalCost,
          costo_total: totalCost,
          total: totalCost,
          notes: `Generada automáticamente desde proyecto ${(project as any)?.project_code || (project as any)?.code || id}`,
        })
        .select("*")
        .single();

      if (orderError) {
        setError(orderError.message);
        alert(`Error creando orden: ${orderError.message}`);
        setGenerating(false);
        return;
      }

      const productionItems = items.map((item) => ({
        production_order_id: order.id,
        order_id: order.id,
        project_id: item.project_id,
        module_id: item.module_id,
        item_name: item.item_name,
        product_name: item.item_name,
        part_name: item.item_name,
        piece_name: item.item_name,
        material_name: item.material_name,
        length: item.length || 0,
        width: item.width || 0,
        thickness: item.thickness || 18,
        quantity: item.quantity || 1,
        cantidad: item.quantity || 1,
        unit_cost: item.unit_cost || 0,
        costo_unitario: item.unit_cost || 0,
        total_cost: item.total_cost || 0,
        costo_total: item.total_cost || 0,
        total: item.total_cost || 0,
        status: "pendiente",
      }));

      const { error: itemsError } = await supabase
        .from("production_order_items")
        .insert(productionItems);

      if (itemsError) {
        setError(itemsError.message);
        alert(`Error insertando piezas: ${itemsError.message}`);
        setGenerating(false);
        return;
      }

      await supabase
        .from("furniture_projects")
        .update({
          status: "en_produccion",
          progress: Math.max(Number(project?.progress || 0), 25),
        })
        .eq("id", id);

      setProject((prev) =>
        prev
          ? {
              ...prev,
              status: "en_produccion",
              progress: Math.max(Number(prev.progress || 0), 25),
            }
          : prev
      );

      alert(`✅ Producción creada: ${orderCode}`);
      setGenerating(false);
    } catch (err: any) {
      setGenerating(false);
      alert(err?.message || "Error creando producción");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <Loader2 className="animate-spin text-cyan-400" size={50} />
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="min-h-screen bg-[#020617] p-10 text-white">
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8">
          <h1 className="text-3xl font-black text-red-300">Error cargando proyecto</h1>
          <p className="mt-4 text-red-200">{error || "Proyecto no encontrado"}</p>
          <Link href="/proyectos" className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-white px-6 py-4 font-black text-slate-900">
            <ArrowLeft size={18} />
            Volver
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="mx-auto max-w-[1700px] px-6 py-6">
        <div className="relative overflow-hidden rounded-[34px] border border-blue-500/20 bg-gradient-to-br from-[#020617] via-[#07152f] to-[#1234d8] p-8 shadow-2xl shadow-blue-950/40">
          <div className="absolute right-[-100px] top-[-100px] h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Link href="/proyectos" className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-blue-100">
                <ArrowLeft size={18} />
                Volver a proyectos
              </Link>

              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.45em] text-yellow-300">
                <Sparkles size={18} />
                RD WOOD SYSTEM
              </div>

              <h1 className="mt-5 text-5xl font-black tracking-tight">{project.project_name || project.name}</h1>

              <div className="mt-4 flex flex-wrap gap-3">
                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/15 px-5 py-2 text-sm font-black text-cyan-300">
                  {project.project_type || project.type}
                </span>
                <span className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-black">
                  {project.status || "prospecto"}
                </span>
                <span className="rounded-full bg-white/10 px-5 py-2 text-sm font-black text-blue-100">
                  {project.project_code || project.code}
                </span>
              </div>

              <p className="mt-6 max-w-3xl text-base text-blue-100">
                {project.notes || "Proyecto CEO RD Wood System"}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={loadAll} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-900 shadow-2xl">
                <RefreshCw size={18} />
                Actualizar
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 font-bold text-red-200">
            {error}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card title="Venta" value={money(metrics.venta)} icon={<Wallet />} />
          <Card title="Utilidad" value={money(metrics.utilidad)} icon={<Sparkles />} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Panel title="Cliente" icon={<User />}>
            <Info label="Cliente" value={project.client_name || "Cliente General"} />
            <Info label="Teléfono" value={project.phone || "No registrado"} />
            <Info label="Fecha" value={date(project.created_at)} />
          </Panel>

          <Panel title="Producción" icon={<Hammer />}>
            <ButtonPro icon={<ClipboardList />} onClick={generateProductionOrder}>Generar producción</ButtonPro>
            <ButtonPro icon={<Package />}>Materiales</ButtonPro>
          </Panel>

          <Panel title="Diseño" icon={<PencilRuler />}>
            <ButtonPro onClick={() => setOpenModule(true)} icon={<Plus />}>Agregar módulo</ButtonPro>
            <ButtonPro>Render IA</ButtonPro>
            <ButtonPro>Exportar PDF</ButtonPro>
          </Panel>
        </div>

        <div className="mt-6 rounded-[30px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between gap-5">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-slate-400">Avance general del proyecto</div>
              <div className="mt-3 text-4xl font-black">{metrics.avance}%</div>
            </div>
            <Clock className="text-cyan-300" size={45} />
          </div>
          <div className="mt-6 h-5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400" style={{ width: `${metrics.avance}%` }} />
          </div>
        </div>

        <div className="mt-6 rounded-[30px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
          <HeaderBlock
            label="Módulos del proyecto"
            title="Motor de módulos PRO"
            description="Medidas, materiales, costos y venta por módulo."
            action={
              <button onClick={() => setOpenModule(true)} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-4 text-sm font-black text-white shadow-xl shadow-blue-950/50">
                <Plus size={20} />
                Agregar módulo
              </button>
            }
          />

          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <div className="overflow-auto">
              <table className="w-full min-w-[1150px] text-left">
                <thead className="bg-[#020617] text-xs uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Módulo</th>
                    <th className="px-5 py-4">Tipo</th>
                    <th className="px-5 py-4">Medidas</th>
                    <th className="px-5 py-4">Material</th>
                    <th className="px-5 py-4 text-right">Cant.</th>
                    <th className="px-5 py-4 text-right">Costo</th>
                    <th className="px-5 py-4 text-right">Venta</th>
                    <th className="px-5 py-4">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-slate-400">No hay módulos todavía.</td>
                    </tr>
                  ) : (
                    modules.map((m) => {
                      const name = m.module_name || m.name || "Módulo sin nombre";
                      const type = m.module_type || m.type || "base";
                      const qty = Math.max(1, n(m.quantity) || 1);
                      const cost = n(m.estimated_cost) * qty;
                      const sale = n(m.sale_price) * qty;

                      return (
                        <tr key={m.id} className="border-t border-slate-800 hover:bg-blue-500/5">
                          <td className="px-5 py-4">
                            <div className="font-black text-white">{name}</div>
                            <div className="mt-1 text-xs text-slate-500">{m.notes || "—"}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="rounded-xl bg-blue-600/15 px-3 py-2 text-xs font-black uppercase text-blue-300">{type}</span>
                          </td>
                          <td className="px-5 py-4 text-sm font-bold text-slate-300">
                            <div className="flex items-center gap-2">
                              <Ruler size={15} className="text-slate-500" />
                              {n(m.width)} x {n(m.height)} x {n(m.depth)} mm
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-200">{m.material || m.material_name || "—"}</div>
                            <div className="text-xs text-slate-500">{m.color || "Sin color"}</div>
                          </td>
                          <td className="px-5 py-4 text-right font-black">{qty}</td>
                          <td className="px-5 py-4 text-right font-black text-orange-300">{money(cost)}</td>
                          <td className="px-5 py-4 text-right font-black text-emerald-300">{money(sale)}</td>
                          <td className="px-5 py-4">
                            <button onClick={() => deleteModule(m.id)} className="rounded-xl bg-red-500/10 p-3 text-red-300 hover:bg-red-500/20">
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </section>

      {openModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-[30px] border border-blue-500/20 bg-[#07111f] p-6 shadow-2xl shadow-blue-950/50">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-3xl font-black">Agregar módulo</h2>
                <p className="mt-2 text-sm font-medium text-slate-400">
                  Crea un módulo con medidas, material, costo y venta.
                </p>
              </div>
              <button onClick={() => setOpenModule(false)} className="rounded-2xl bg-slate-800 p-3 text-slate-300">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Nombre módulo">
                <input className="input-pro" value={form.module_name} onChange={(e) => setForm({ ...form, module_name: e.target.value })} placeholder="Base fregadero, torre horno..." />
              </Field>
              <Field label="Tipo">
                <select className="input-pro" value={form.module_type} onChange={(e) => setForm({ ...form, module_type: e.target.value })}>
                  {moduleTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Cantidad">
                <input className="input-pro" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </Field>
              <Field label="Ancho mm">
                <input className="input-pro" type="number" value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} placeholder="800" />
              </Field>
              <Field label="Alto mm">
                <input className="input-pro" type="number" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} placeholder="720" />
              </Field>
              <Field label="Profundidad mm">
                <input className="input-pro" type="number" value={form.depth} onChange={(e) => setForm({ ...form, depth: e.target.value })} placeholder="560" />
              </Field>
              <Field label="Material">
                <input className="input-pro" value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="Melamina 18mm" />
              </Field>
              <Field label="Color">
                <input className="input-pro" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Roble, Blanco, Gris..." />
              </Field>
              <Field label="Costo unitario">
                <input className="input-pro" type="number" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} placeholder="8500" />
              </Field>
              <Field label="Venta unidad">
                <input className="input-pro" type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} placeholder="15000" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Notas">
                  <input className="input-pro" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Puertas, gavetas, herrajes, observaciones..." />
                </Field>
              </div>
            </div>

            <button onClick={createModule} disabled={savingModule} className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-7 py-4 text-sm font-black text-white shadow-xl shadow-blue-950/50 disabled:opacity-60">
              {savingModule ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
              Guardar módulo PRO
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input-pro {
          width: 100%;
          border-radius: 16px;
          border: 1px solid rgb(51 65 85);
          background: #0f172a;
          padding: 14px 16px;
          color: white;
          font-weight: 800;
          outline: none;
        }
        .input-pro::placeholder {
          color: rgb(100 116 139);
        }
        .input-pro:focus {
          border-color: rgb(59 130 246);
        }
      `}</style>
    </main>
  );
}

function HeaderBlock({ label, title, description, action }: { label: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</div>
        <h2 className="mt-2 text-3xl font-black">{title}</h2>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b1628] p-4">
      <div className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}


function Card({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</div>
          <div className="mt-5 text-4xl font-black">{value}</div>
        </div>
        <div className="rounded-2xl bg-blue-500/15 p-4 text-blue-300">{icon}</div>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-blue-600/15 p-4 text-blue-300">{icon}</div>
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</div>
        </div>
      </div>
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b1628] p-4">
      <div className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-black text-white">{value}</div>
    </div>
  );
}

function ButtonPro({ children, icon, onClick }: { children: React.ReactNode; icon?: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-center gap-3 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-[#0f172a] to-[#102b5c] px-5 py-4 text-sm font-black text-white transition hover:scale-[1.01]">
      {icon}
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">{label}</div>
      {children}
    </label>
  );
}
