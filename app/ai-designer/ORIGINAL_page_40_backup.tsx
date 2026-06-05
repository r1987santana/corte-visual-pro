"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Download,
  Eye,
  Factory,
  Image as ImageIcon,
  Layers,
  Loader2,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Scissors,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type DesignRequest = {
  id: string;
  request_code?: string | null;
  client_name?: string | null;
  phone?: string | null;
  project_name?: string | null;
  project_type?: string | null;
  width?: number | null;
  depth?: number | null;
  height?: number | null;
  style?: string | null;
  colors?: string | null;
  budget?: number | null;
  image_url?: string | null;
  notes?: string | null;
  status?: string | null;
  selected_variant_id?: string | null;
  created_at?: string | null;
};

type Variant = {
  id: string;
  request_id?: string | null;
  variant_key?: string | null;
  variant_name?: string | null;
  design_concept?: string | null;
  prompt?: string | null;
  image_url?: string | null;
  selected?: boolean | null;
  status?: string | null;
  estimated_cost?: number | null;
  estimated_sale?: number | null;
  estimated_profit?: number | null;
};

type ModuleRow = {
  id: string;
  request_id?: string | null;
  variant_id?: string | null;
  module_name?: string | null;
  module_type?: string | null;
  width?: number | null;
  depth?: number | null;
  height?: number | null;
  material?: string | null;
  edge_material?: string | null;
  quantity?: number | null;
  unit_cost?: number | null;
  sale_price?: number | null;
};

type PartRow = {
  id: string;
  request_id?: string | null;
  variant_id?: string | null;
  module_id?: string | null;
  part_name?: string | null;
  part_type?: string | null;
  material?: string | null;
  edge_material?: string | null;
  length?: number | null;
  width?: number | null;
  thickness?: number | null;
  quantity?: number | null;
  edge_l1?: boolean | null;
  edge_l2?: boolean | null;
  edge_w1?: boolean | null;
  edge_w2?: boolean | null;
  cnc_notes?: string | null;
};

const PROJECT_TYPES = ["centro_tv", "cocina", "closet", "vanity", "oficina", "mueble_comercial"];
const STYLES = ["moderno", "minimalista", "luxury", "industrial", "organico", "clasico"];
const MATERIALS = [
  "Melamina Blanca 18mm",
  "Melamina Blanco Alto Brillo 18mm",
  "Melamina Bardolino 18mm",
  "Melamina Roble 18mm",
  "Melamina Negra 18mm",
  "MDF Fondo 6mm 4x8",
];
const EDGES = ["Canto PVC Blanco 22mm", "Canto PVC Negro 22mm", "Canto PVC Roble 22mm", "Canto PVC Bardolino 22mm"];

function money(value: any) {
  const n = Number(value || 0);
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function mm(value: any) {
  return `${Number(value || 0).toLocaleString("es-DO")} mm`;
}

function placeholderRender(style: string, type: string) {
  const label = encodeURIComponent(`RD WOOD ${type} ${style}`);
  return `https://placehold.co/900x650/0b1220/22d3ee?text=${label}`;
}

export default function AIDesignerPage() {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<DesignRequest[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [selected, setSelected] = useState<DesignRequest | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [form, setForm] = useState<Partial<DesignRequest>>({
    client_name: "",
    phone: "",
    project_name: "Proyecto IA",
    project_type: "centro_tv",
    width: 2000,
    depth: 400,
    height: 2200,
    style: "moderno",
    colors: "blanco / madera / negro",
    budget: 0,
    image_url: "",
    notes: "Centro TV con 2 puertas grandes, 1 puerta pequeña, 4 gavetas, repisas, panel decorativo y LED.",
    status: "borrador",
  });

  useEffect(() => {
    loadAll();
  }, []);

  const currentVariants = variants.filter((v) => v.request_id === selected?.id);
  const currentModules = modules.filter((m) => m.request_id === selected?.id);
  const currentParts = parts.filter((p) => p.request_id === selected?.id);

  const totals = useMemo(() => {
    const cost = currentModules.reduce((s, m) => s + Number(m.unit_cost || 0) * Number(m.quantity || 1), 0);
    const sale = currentModules.reduce((s, m) => s + Number(m.sale_price || 0) * Number(m.quantity || 1), 0);
    const profit = sale - cost;
    const sheets = Math.max(1, Math.ceil(currentParts.reduce((s, p) => s + (Number(p.length || 0) * Number(p.width || 0) * Number(p.quantity || 1)), 0) / (2440 * 1220)));
    return { cost, sale, profit, sheets, parts: currentParts.length, modules: currentModules.length };
  }, [currentModules, currentParts]);

  async function loadAll() {
    setLoading(true);
    try {
      const [r, v, m, p] = await Promise.all([
        supabase.from("ai_design_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("ai_design_variants").select("*").order("created_at", { ascending: false }),
        supabase.from("ai_design_modules").select("*").order("created_at", { ascending: false }),
        supabase.from("ai_design_parts").select("*").order("created_at", { ascending: false }),
      ]);
      if (r.error) throw r.error;
      if (v.error) throw v.error;
      if (m.error) throw m.error;
      if (p.error) throw p.error;
      setRequests((r.data || []) as DesignRequest[]);
      setVariants((v.data || []) as Variant[]);
      setModules((m.data || []) as ModuleRow[]);
      setParts((p.data || []) as PartRow[]);
      if (!selected && r.data?.[0]) setSelected(r.data[0] as DesignRequest);
    } catch (e: any) {
      alert(e?.message || "Error cargando IA Designer. Ejecuta SQL de Fase 19.");
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setForm({
      client_name: "",
      phone: "",
      project_name: "Proyecto IA",
      project_type: "centro_tv",
      width: 2000,
      depth: 400,
      height: 2200,
      style: "moderno",
      colors: "blanco / madera / negro",
      budget: 0,
      image_url: "",
      notes: "Centro TV con 2 puertas grandes, 1 puerta pequeña, 4 gavetas, repisas, panel decorativo y LED.",
      status: "borrador",
    });
    setShowForm(true);
  }

  async function saveRequest() {
    try {
      const { data: code } = await supabase.rpc("generate_ai_design_request_code");
      const { data, error } = await supabase
        .from("ai_design_requests")
        .insert({
          ...form,
          request_code: code || `AID-${Date.now()}`,
        })
        .select("*")
        .single();
      if (error) throw error;
      setShowForm(false);
      setSelected(data as DesignRequest);
      await loadAll();
    } catch (e: any) {
      alert(e?.message || "Error guardando solicitud.");
    }
  }

  function buildPrompt(req: DesignRequest, variantName: string, concept: string) {
    return `Create a professional realistic interior render for RD WOOD SYSTEM.
Project type: ${req.project_type}
Project name: ${req.project_name}
Client: ${req.client_name || "Cliente general"}
Real dimensions: ${req.width}mm width x ${req.depth}mm depth x ${req.height}mm height.
Style: ${req.style}
Color palette: ${req.colors}
Variant: ${variantName}
Concept: ${concept}
Client notes: ${req.notes}
Design must be manufacturable with real 18mm melamine panels, CNC-ready modules, realistic hardware, correct proportions, warm LED lighting, premium finish, commercial presentation.`;
  }

  async function generateVariants() {
    if (!selected) return alert("Selecciona una solicitud.");
    setGenerating(true);
    try {
      const concepts = [
        ["A", "Propuesta A - Comercial Premium", "Diseño comercial premium con simetría, gavetas bajas, panel central ranurado y repisas con LED."],
        ["B", "Propuesta B - Luxury Cálida", "Diseño luxury con madera protagonista, iluminación cálida, laterales limpios y composición elegante."],
        ["C", "Propuesta C - Industrial Moderna", "Diseño moderno industrial con contraste negro, madera y blanco, líneas rectas y detalles sobrios."],
        ["D", "Propuesta D - Orgánica Europea", "Diseño orgánico europeo con formas suaves, balance visual y tonos cálidos."],
        ["E", "Propuesta E - High-End Italiana", "Diseño high-end italiano, minimalista, limpio y de alto valor percibido."],
      ];

      const rows = concepts.map(([key, name, concept]) => {
        const prompt = buildPrompt(selected, name, concept);
        return {
          request_id: selected.id,
          variant_key: key,
          variant_name: name,
          design_concept: concept,
          prompt,
          image_url: placeholderRender(String(selected.style), `${selected.project_type}-${key}`),
          status: "render_generado",
          estimated_cost: 0,
          estimated_sale: 0,
          estimated_profit: 0,
        };
      });

      await supabase.from("ai_design_variants").delete().eq("request_id", selected.id);
      const { error } = await supabase.from("ai_design_variants").insert(rows);
      if (error) throw error;
      await supabase.from("ai_design_requests").update({ status: "variantes_generadas" }).eq("id", selected.id);
      await loadAll();
    } catch (e: any) {
      alert(e?.message || "Error generando variantes.");
    } finally {
      setGenerating(false);
    }
  }

  async function selectVariant(v: Variant) {
    if (!selected) return;
    try {
      await supabase.from("ai_design_variants").update({ selected: false }).eq("request_id", selected.id);
      const { error } = await supabase.from("ai_design_variants").update({ selected: true }).eq("id", v.id);
      if (error) throw error;
      await supabase.from("ai_design_requests").update({ selected_variant_id: v.id, status: "variante_aprobada" }).eq("id", selected.id);
      await loadAll();
    } catch (e: any) {
      alert(e?.message || "Error seleccionando variante.");
    }
  }

  async function generateProduction() {
    if (!selected) return alert("Selecciona solicitud.");
    const variant = currentVariants.find((v) => v.selected) || currentVariants[0];
    if (!variant) return alert("Primero genera y selecciona una variante.");

    try {
      await supabase.from("ai_design_modules").delete().eq("request_id", selected.id);
      await supabase.from("ai_design_parts").delete().eq("request_id", selected.id);

      const W = Number(selected.width || 2000);
      const D = Number(selected.depth || 400);
      const H = Number(selected.height || 2200);
      const mat = MATERIALS[0];
      const edge = EDGES[0];

      const moduleRows = [
        { module_name: "Credenza TV baja", module_type: "tv_credenza", width: W, depth: D, height: 440, material: mat, edge_material: edge, quantity: 1, unit_cost: 14500, sale_price: 26825 },
        { module_name: "Panel decorativo TV", module_type: "tv_panel", width: W, depth: 80, height: H, material: mat, edge_material: edge, quantity: 1, unit_cost: 9500, sale_price: 17575 },
        { module_name: "Repisas flotantes TV", module_type: "tv_shelves", width: 700, depth: 300, height: 40, material: mat, edge_material: edge, quantity: 3, unit_cost: 2200, sale_price: 4070 },
      ];

      const inserted = await supabase
        .from("ai_design_modules")
        .insert(moduleRows.map((m) => ({ ...m, request_id: selected.id, variant_id: variant.id })))
        .select("*");
      if (inserted.error) throw inserted.error;

      const modByType: Record<string, any> = {};
      (inserted.data || []).forEach((m) => (modByType[m.module_type] = m));

      const partsRows: any[] = [];
      const cred = modByType["tv_credenza"];
      const panel = modByType["tv_panel"];
      const shelves = modByType["tv_shelves"];

      if (cred) {
        partsRows.push(
          part(selected.id, variant.id, cred.id, "Credenza TV baja - Piso", "piso", mat, edge, D, W, 1, true),
          part(selected.id, variant.id, cred.id, "Credenza TV baja - Techo", "techo", mat, edge, D, W, 1, true),
          part(selected.id, variant.id, cred.id, "Credenza TV baja - Lateral izquierdo", "lateral", mat, edge, D, 440, 1, true),
          part(selected.id, variant.id, cred.id, "Credenza TV baja - Lateral derecho", "lateral", mat, edge, D, 440, 1, true),
          part(selected.id, variant.id, cred.id, "Credenza TV baja - Puerta grande abatible", "puerta", mat, edge, 420, 420, 2, true),
          part(selected.id, variant.id, cred.id, "Credenza TV baja - Puerta pequeña abatible", "puerta", mat, edge, 420, 440, 1, true),
          part(selected.id, variant.id, cred.id, "Credenza TV baja - Frente gaveta", "gaveta", mat, edge, 120, 720, 4, true),
          part(selected.id, variant.id, cred.id, "Credenza TV baja - División vertical", "division", mat, edge, D, 404, 2, true)
        );
      }

      if (panel) {
        partsRows.push(
          part(selected.id, variant.id, panel.id, "Panel decorativo TV - Panel principal ranurado", "panel", mat, edge, W, H, 1, false),
          part(selected.id, variant.id, panel.id, "Panel decorativo TV - Refuerzo horizontal superior", "refuerzo", mat, edge, 80, W, 1, true),
          part(selected.id, variant.id, panel.id, "Panel decorativo TV - Refuerzo horizontal inferior", "refuerzo", mat, edge, 80, W, 1, true)
        );
      }

      if (shelves) {
        partsRows.push(
          part(selected.id, variant.id, shelves.id, "Repisas flotantes TV - Repisa flotante", "repisa", mat, edge, 300, 700, 3, true)
        );
      }

      const { error: pError } = await supabase.from("ai_design_parts").insert(partsRows);
      if (pError) throw pError;

      const cost = moduleRows.reduce((s, m) => s + m.unit_cost * m.quantity, 0);
      const sale = moduleRows.reduce((s, m) => s + m.sale_price * m.quantity, 0);

      await supabase.from("ai_design_variants").update({
        estimated_cost: cost,
        estimated_sale: sale,
        estimated_profit: sale - cost,
      }).eq("id", variant.id);

      await supabase.from("ai_design_requests").update({ status: "produccion_generada" }).eq("id", selected.id);

      await loadAll();
      alert("✅ Diseño convertido en módulos, piezas CNC y BOM.");
    } catch (e: any) {
      alert(e?.message || "Error generando producción.");
    }
  }

  function part(request_id: string, variant_id: string, module_id: string, part_name: string, part_type: string, material: string, edge_material: string, length: number, width: number, quantity: number, edgeAll: boolean) {
    return {
      request_id,
      variant_id,
      module_id,
      part_name,
      part_type,
      material,
      edge_material,
      length,
      width,
      thickness: 18,
      quantity,
      edge_l1: edgeAll,
      edge_l2: edgeAll,
      edge_w1: edgeAll,
      edge_w2: edgeAll,
      cnc_notes: "Generado por IA Designer Fase 19",
    };
  }

  function printPack() {
    if (!selected) return;
    const html = `
      <html><head><title>${selected.request_code}</title>
      <style>
      body{font-family:Arial;margin:28px;color:#111}.brand{letter-spacing:8px;color:#005c99;font-weight:900}
      h1{margin:6px 0}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.box{border:1px solid #111;border-radius:12px;padding:12px;margin:10px 0}
      table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#07111f;color:white;text-align:left;padding:8px}td{border:1px solid #ddd;padding:7px}
      </style></head><body>
      <div class="brand">RD WOOD SYSTEM</div>
      <h1>Pack IA Diseño + Producción</h1>
      <p><b>Solicitud:</b> ${selected.request_code || ""} · <b>Cliente:</b> ${selected.client_name || ""}</p>
      <div class="grid">
        <div class="box"><b>Costo</b><br>${money(totals.cost)}</div>
        <div class="box"><b>Venta</b><br>${money(totals.sale)}</div>
        <div class="box"><b>Utilidad</b><br>${money(totals.profit)}</div>
        <div class="box"><b>Hojas</b><br>${totals.sheets}</div>
      </div>
      <h2>Módulos</h2>
      <table><thead><tr><th>Módulo</th><th>Tipo</th><th>Medidas</th><th>Material</th><th>Costo</th><th>Venta</th></tr></thead><tbody>
      ${currentModules.map(m => `<tr><td>${m.module_name}</td><td>${m.module_type}</td><td>${m.width} x ${m.depth} x ${m.height}</td><td>${m.material}</td><td>${money(m.unit_cost)}</td><td>${money(m.sale_price)}</td></tr>`).join("")}
      </tbody></table>
      <h2>Piezas CNC</h2>
      <table><thead><tr><th>Pieza</th><th>Material</th><th>Largo</th><th>Ancho</th><th>Cant.</th><th>Canto</th></tr></thead><tbody>
      ${currentParts.map(p => `<tr><td>${p.part_name}</td><td>${p.material}</td><td>${p.length}</td><td>${p.width}</td><td>${p.quantity}</td><td>${p.edge_material}</td></tr>`).join("")}
      </tbody></table>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  function exportCSV() {
    const rows = [["Pieza","Material","Largo","Ancho","Espesor","Cantidad","Canto","Notas"]];
    currentParts.forEach(p => rows.push([
      p.part_name || "", p.material || "", String(p.length || 0), String(p.width || 0), String(p.thickness || 18), String(p.quantity || 1), p.edge_material || "", p.cnc_notes || ""
    ]));
    const csv = rows.map(r => r.map(x => `"${String(x).replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${selected?.request_code || "ai-design"}-cnc.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteRequest(req: DesignRequest) {
    if (!confirm(`Eliminar ${req.request_code}?`)) return;
    const { error } = await supabase.from("ai_design_requests").delete().eq("id", req.id);
    if (error) return alert(error.message);
    setSelected(null);
    loadAll();
  }

  return (
    <main className="min-h-screen bg-[#020817] text-white px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-cyan-900/60 bg-gradient-to-br from-[#07111f] to-[#111b38] p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-700 bg-cyan-500/10 px-3 py-1 text-cyan-300 text-xs font-black tracking-[0.25em]">
                <Sparkles size={14} /> FASE 19
              </div>
              <h1 className="mt-4 text-4xl lg:text-5xl font-black">IA Diseñador Automático</h1>
              <p className="text-slate-300 mt-2">Foto + medidas → variantes, render conceptual, módulos, CNC, BOM, costo y venta.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={loadAll} className="h-12 px-5 rounded-2xl bg-white text-slate-950 font-black flex items-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>} Actualizar
              </button>
              <button onClick={openNew} className="h-12 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 font-black flex items-center gap-2">
                <Plus size={18}/> Nueva Solicitud
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Kpi icon={<BrainCircuit />} label="Solicitudes" value={requests.length} />
          <Kpi icon={<Eye />} label="Variantes" value={currentVariants.length} />
          <Kpi icon={<Layers />} label="Módulos" value={totals.modules} />
          <Kpi icon={<Scissors />} label="Piezas CNC" value={totals.parts} />
          <Kpi icon={<CircleDollarSign />} label="Venta" value={money(totals.sale)} />
          <Kpi icon={<Package />} label="Hojas" value={totals.sheets} />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[330px_1fr] gap-4">
          <div className="rounded-[30px] border border-cyan-900/50 bg-[#07111f] p-4 shadow-2xl">
            <h2 className="text-xl font-black mb-3 flex items-center gap-2"><ClipboardList className="text-cyan-300"/> Solicitudes</h2>
            <div className="space-y-3 max-h-[650px] overflow-auto pr-1">
              {requests.map(req => (
                <button key={req.id} onClick={()=>setSelected(req)} className={`w-full text-left rounded-2xl border p-3 ${selected?.id===req.id ? "border-cyan-500 bg-cyan-500/10" : "border-slate-800 bg-[#030817]"}`}>
                  <div className="text-cyan-300 text-xs font-black">{req.request_code}</div>
                  <div className="font-black">{req.project_name || "Proyecto IA"}</div>
                  <div className="text-xs text-slate-400">{req.client_name || "Cliente general"} · {req.project_type}</div>
                  <div className="text-xs text-slate-400">{mm(req.width)} x {mm(req.depth)} x {mm(req.height)}</div>
                  <div className="mt-2 rounded-full bg-slate-800 px-2 py-1 inline-block text-[10px] font-black">{req.status}</div>
                </button>
              ))}
              {!requests.length && <div className="text-slate-500 text-center p-8 font-black">Sin solicitudes todavía.</div>}
            </div>
          </div>

          <div className="space-y-4">
            {selected ? (
              <>
                <section className="rounded-[30px] border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div>
                      <div className="text-cyan-300 text-xs font-black tracking-[0.2em]">{selected.request_code}</div>
                      <h2 className="text-3xl font-black">{selected.project_name}</h2>
                      <p className="text-slate-400">{selected.client_name || "Cliente general"} · {selected.project_type} · {selected.style}</p>
                      <p className="text-slate-300 mt-2">{selected.notes}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={generateVariants} disabled={generating} className="btn-main bg-gradient-to-r from-cyan-500 to-blue-600">
                        {generating ? <Loader2 className="animate-spin"/> : <Wand2/>} Generar variantes
                      </button>
                      <button onClick={generateProduction} className="btn-main bg-emerald-600"><Factory/> Generar producción</button>
                      <button onClick={printPack} className="btn-main bg-slate-700"><Printer/> Imprimir pack</button>
                      <button onClick={exportCSV} className="btn-main bg-slate-700"><Download/> CSV CNC</button>
                      <button onClick={()=>deleteRequest(selected)} className="btn-main bg-red-700"><Trash2/> Eliminar</button>
                    </div>
                  </div>
                </section>

                <section className="rounded-[30px] border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
                  <h2 className="text-2xl font-black mb-4 flex items-center gap-2"><ImageIcon className="text-cyan-300"/> Variantes IA A/B/C/D/E</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {currentVariants.map(v => (
                      <div key={v.id} className={`rounded-3xl border overflow-hidden bg-[#030817] ${v.selected ? "border-emerald-500" : "border-slate-800"}`}>
                        <img src={v.image_url || placeholderRender("moderno","render")} className="w-full h-44 object-cover" />
                        <div className="p-4">
                          <div className="flex justify-between gap-2">
                            <h3 className="font-black">{v.variant_name}</h3>
                            {v.selected && <span className="text-emerald-300"><CheckCircle2 size={18}/></span>}
                          </div>
                          <p className="text-xs text-slate-400 mt-2 min-h-[46px]">{v.design_concept}</p>
                          <div className="grid grid-cols-3 gap-2 mt-3">
                            <Mini label="Costo" value={money(v.estimated_cost)} tone="amber"/>
                            <Mini label="Venta" value={money(v.estimated_sale)} tone="cyan"/>
                            <Mini label="Util." value={money(v.estimated_profit)} tone="emerald"/>
                          </div>
                          <button onClick={()=>selectVariant(v)} className="mt-3 w-full h-10 rounded-2xl bg-emerald-600 font-black">Seleccionar</button>
                        </div>
                      </div>
                    ))}
                    {!currentVariants.length && <div className="col-span-full text-center text-slate-500 p-10 font-black">Genera variantes para iniciar.</div>}
                  </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                  <Kpi icon={<CircleDollarSign/>} label="Costo" value={money(totals.cost)} />
                  <Kpi icon={<CircleDollarSign/>} label="Venta" value={money(totals.sale)} />
                  <Kpi icon={<Sparkles/>} label="Utilidad" value={money(totals.profit)} />
                  <Kpi icon={<Package/>} label="Hojas estimadas" value={totals.sheets} />
                </section>

                <section className="rounded-[30px] border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl overflow-auto">
                  <h2 className="text-2xl font-black mb-4 flex items-center gap-2"><Layers className="text-cyan-300"/> Módulos generados</h2>
                  <table className="w-full text-sm">
                    <thead className="bg-[#0a1627]"><tr><th className="p-3 text-left">Módulo</th><th className="p-3 text-left">Tipo</th><th className="p-3 text-left">Medidas</th><th className="p-3 text-left">Material</th><th className="p-3 text-left">Canto</th><th className="p-3 text-left">Costo</th><th className="p-3 text-left">Venta</th></tr></thead>
                    <tbody>
                      {currentModules.map(m => <tr key={m.id} className="border-t border-slate-800"><td className="p-3 font-black">{m.module_name}</td><td className="p-3">{m.module_type}</td><td className="p-3">{m.width} x {m.depth} x {m.height}</td><td className="p-3">{m.material}</td><td className="p-3">{m.edge_material}</td><td className="p-3 text-amber-300">{money(m.unit_cost)}</td><td className="p-3 text-emerald-300">{money(m.sale_price)}</td></tr>)}
                      {!currentModules.length && <tr><td colSpan={7} className="p-8 text-center text-slate-500 font-black">Sin módulos todavía.</td></tr>}
                    </tbody>
                  </table>
                </section>

                <section className="rounded-[30px] border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl overflow-auto">
                  <h2 className="text-2xl font-black mb-4 flex items-center gap-2"><Scissors className="text-cyan-300"/> Piezas CNC generadas</h2>
                  <table className="w-full text-sm">
                    <thead className="bg-[#0a1627]"><tr><th className="p-3 text-left">Pieza</th><th className="p-3 text-left">Tipo</th><th className="p-3 text-left">Material</th><th className="p-3 text-left">Largo</th><th className="p-3 text-left">Ancho</th><th className="p-3 text-left">Cant.</th><th className="p-3 text-left">Canto</th></tr></thead>
                    <tbody>
                      {currentParts.map(p => <tr key={p.id} className="border-t border-slate-800"><td className="p-3 font-black">{p.part_name}</td><td className="p-3">{p.part_type}</td><td className="p-3">{p.material}</td><td className="p-3">{p.length}</td><td className="p-3">{p.width}</td><td className="p-3">{p.quantity}</td><td className="p-3">{p.edge_material}</td></tr>)}
                      {!currentParts.length && <tr><td colSpan={7} className="p-8 text-center text-slate-500 font-black">Sin piezas todavía.</td></tr>}
                    </tbody>
                  </table>
                </section>
              </>
            ) : (
              <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-16 text-center text-slate-500 font-black">Selecciona o crea una solicitud.</div>
            )}
          </div>
        </section>
      </div>

      {showForm && (
        <Modal title="Nueva solicitud de diseño IA" onClose={()=>setShowForm(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Cliente"><input className="input" value={form.client_name || ""} onChange={e=>setForm({...form, client_name:e.target.value})}/></Field>
            <Field label="Teléfono"><input className="input" value={form.phone || ""} onChange={e=>setForm({...form, phone:e.target.value})}/></Field>
            <Field label="Nombre proyecto"><input className="input" value={form.project_name || ""} onChange={e=>setForm({...form, project_name:e.target.value})}/></Field>
            <Field label="Tipo proyecto"><select className="input" value={form.project_type || "centro_tv"} onChange={e=>setForm({...form, project_type:e.target.value})}>{PROJECT_TYPES.map(x=><option key={x} value={x}>{x}</option>)}</select></Field>
            <Field label="Ancho mm"><input type="number" className="input" value={form.width || 0} onChange={e=>setForm({...form, width:Number(e.target.value)})}/></Field>
            <Field label="Profundidad mm"><input type="number" className="input" value={form.depth || 0} onChange={e=>setForm({...form, depth:Number(e.target.value)})}/></Field>
            <Field label="Alto mm"><input type="number" className="input" value={form.height || 0} onChange={e=>setForm({...form, height:Number(e.target.value)})}/></Field>
            <Field label="Estilo"><select className="input" value={form.style || "moderno"} onChange={e=>setForm({...form, style:e.target.value})}>{STYLES.map(x=><option key={x} value={x}>{x}</option>)}</select></Field>
            <Field label="Colores"><input className="input" value={form.colors || ""} onChange={e=>setForm({...form, colors:e.target.value})}/></Field>
            <Field label="Presupuesto"><input type="number" className="input" value={form.budget || 0} onChange={e=>setForm({...form, budget:Number(e.target.value)})}/></Field>
            <Field label="URL imagen / foto del espacio" full><input className="input" value={form.image_url || ""} onChange={e=>setForm({...form, image_url:e.target.value})}/></Field>
            <Field label="Notas técnicas" full><textarea className="textarea" value={form.notes || ""} onChange={e=>setForm({...form, notes:e.target.value})}/></Field>
          </div>
          <button onClick={saveRequest} className="mt-5 w-full h-13 rounded-2xl bg-cyan-600 font-black flex items-center justify-center gap-2"><Save/> Guardar solicitud</button>
        </Modal>
      )}

      <style jsx global>{`
        .input{width:100%;height:46px;border-radius:14px;border:1px solid #243247;background:#030817;padding:0 14px;outline:none;color:white}
        .input:focus{border-color:#06b6d4}
        .textarea{width:100%;min-height:100px;border-radius:14px;border:1px solid #243247;background:#030817;padding:12px 14px;outline:none;color:white}
        .textarea:focus{border-color:#06b6d4}
        .btn-main{min-height:46px;border-radius:16px;padding:0 14px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:8px}
      `}</style>
    </main>
  );
}

function Kpi({ icon, label, value }: { icon: any; label: string; value: any }) {
  return <div className="rounded-3xl border border-slate-800 bg-[#07111f] p-4 shadow-xl"><div className="flex items-center justify-between"><div className="text-slate-400 text-xs font-black uppercase tracking-[0.22em]">{label}</div><div className="rounded-2xl bg-cyan-500/10 text-cyan-300 p-2">{icon}</div></div><div className="mt-3 text-2xl font-black">{value}</div></div>;
}

function Mini({ label, value, tone }: { label: string; value: any; tone: "cyan" | "emerald" | "amber" }) {
  const classes: any = { cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200", emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200", amber: "border-amber-500/30 bg-amber-500/10 text-amber-200" };
  return <div className={`rounded-xl border p-2 ${classes[tone]}`}><div className="text-[9px] uppercase tracking-[0.15em] font-black opacity-80">{label}</div><div className="text-xs font-black mt-1">{value}</div></div>;
}

function Field({ label, children, full }: { label: string; children: any; full?: boolean }) {
  return <label className={full ? "md:col-span-2" : ""}><div className="text-[11px] uppercase tracking-[0.22em] text-slate-400 font-black mb-2">{label}</div>{children}</label>;
}

function Modal({ title, children, onClose }: { title: string; children: any; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-3xl border border-cyan-900/60 bg-[#07111f] p-5 shadow-2xl"><div className="flex items-center justify-between gap-3 mb-5"><h2 className="text-2xl font-black">{title}</h2><button onClick={onClose} className="h-10 w-10 rounded-2xl bg-slate-800 flex items-center justify-center"><X size={18}/></button></div>{children}</div></div>;
}
