"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  Download,
  Drill,
  FileCode2,
  Gauge,
  HardDriveDownload,
  Layers3,
  Loader2,
  PlayCircle,
  RefreshCcw,
  RotateCcw,
  Ruler,
  Search,
  Settings2,
  Timer,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type CNCJob = {
  id: string;
  code?: string | null;
  project_name?: string | null;
  module_name?: string | null;
  material_name?: string | null;
  pieces_count?: number | null;
  program_name?: string | null;
  machine_name?: string | null;
  tool_name?: string | null;
  estimated_time_min?: number | null;
  real_time_min?: number | null;
  status?: string | null;
  priority?: string | null;
  operator_name?: string | null;
  created_at?: string | null;
};

type CNCToolReal = {
  id: string;
  tool_name?: string | null;
  tool_type?: string | null;
  diameter?: number | null;
  cut_length?: number | null;
  total_length?: number | null;
  shank?: number | null;
  material?: string | null;
  feed_rate?: number | null;
  plunge_rate?: number | null;
  spindle_speed?: number | null;
  step_down?: number | null;
  notes?: string | null;
};

type CNCProgram = {
  id: string;
  job_id?: string | null;
  production_order_id?: string | null;
  program_name?: string | null;
  file_type?: string | null;
  file_url?: string | null;
  gcode?: string | null;
  machine_name?: string | null;
  post_processor?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProductionOrder = {
  id: string;
  code?: string | null;
  status?: string | null;
};

type CuttingPiece = {
  id: string;
  production_order_id?: string | null;
  name?: string | null;
  material_name?: string | null;
  width?: number | null;
  height?: number | null;
  length?: number | null;
  quantity?: number | null;
};

const statusLabel: Record<string, string> = {
  pendiente: "Pendiente",
  programado: "Programado",
  en_proceso: "En proceso",
  completado: "Completado",
  revision: "Revisión",
};

const statusClass: Record<string, string> = {
  pendiente: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  programado: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  en_proceso: "border-blue-400/30 bg-blue-400/10 text-blue-200",
  completado: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  revision: "border-violet-400/30 bg-violet-400/10 text-violet-200",
};

const priorityClass: Record<string, string> = {
  normal: "border-slate-400/20 bg-slate-400/10 text-slate-200",
  alta: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  critica: "border-red-400/30 bg-red-400/10 text-red-200",
};

const fallbackJobs: CNCJob[] = [
  {
    id: "demo-1",
    code: "CNC-DEMO-001",
    project_name: "Cocina Modular Premium",
    module_name: "Módulo inferior fregadero",
    material_name: "Melamina RH Blanco 18mm",
    pieces_count: 14,
    program_name: "COCINA_INF_FREGADERO_001.nc",
    machine_name: "CNC Router Principal",
    tool_name: "E220-COMPRESSION-1/4",
    estimated_time_min: 38,
    real_time_min: null,
    status: "programado",
    priority: "alta",
    operator_name: "Operador CNC",
  },
];

const fallbackTools: CNCToolReal[] = [
  {
    id: "demo-tool-1",
    tool_name: "E220-COMPRESSION-1/4",
    tool_type: "compression",
    diameter: 6.35,
    cut_length: 31.75,
    total_length: 76.2,
    shank: 6.35,
    material: "melamina",
    feed_rate: 4500,
    plunge_rate: 1800,
    spindle_speed: 18000,
    step_down: 6,
    notes: "BROCA REAL RD WOOD",
  },
];

function formatMinutes(value?: number | null) {
  if (!value) return "-";
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function safeStatus(value?: string | null) {
  return value || "pendiente";
}

function formatNumber(value?: number | null, suffix = "") {
  if (value === null || value === undefined) return "-";
  return `${Number(value).toLocaleString("es-DO")}${suffix}`;
}

function toolDisplayName(tool?: CNCToolReal | null) {
  if (!tool) return "Herramienta CNC";
  return tool.tool_name || `Herramienta ${tool.diameter || ""}mm`;
}

function getErrorMessage(error: any) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return error.message || error.details || JSON.stringify(error);
}

function cleanFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
}

function generateGCode(job: CNCJob, tool: CNCToolReal, pieces: CuttingPiece[]) {
  const programNumber = (job.code || "CNC-0001").replace(/\D/g, "").slice(-4).padStart(4, "0");
  const rpm = Number(tool.spindle_speed || 18000);
  const feed = Number(tool.feed_rate || 4500);
  const plunge = Number(tool.plunge_rate || 1800);
  const stepDown = Number(tool.step_down || 6);
  const safeZ = 12;
  const cutZ = -Math.abs(stepDown);
  const toolName = toolDisplayName(tool);

  const selectedPieces = pieces.length
    ? pieces.slice(0, 20)
    : [
        { id: "demo-a", name: "Lateral A", width: 600, height: 300, quantity: 1 },
        { id: "demo-b", name: "Lateral B", width: 600, height: 300, quantity: 1 },
        { id: "demo-c", name: "Base", width: 800, height: 500, quantity: 1 },
      ];

  const lines: string[] = [];
  lines.push("%");
  lines.push(`O${programNumber}`);
  lines.push("(RD WOOD SYSTEM - MECANIZADO PRO)");
  lines.push(`(PROYECTO: ${job.project_name || "SIN PROYECTO"})`);
  lines.push(`(MODULO: ${job.module_name || "SIN MODULO"})`);
  lines.push(`(HERRAMIENTA: ${toolName})`);
  lines.push(`(MATERIAL: ${job.material_name || tool.material || "NO DEFINIDO"})`);
  lines.push("G21 (MILIMETROS)");
  lines.push("G90 (ABSOLUTO)");
  lines.push("G17 (PLANO XY)");
  lines.push("G40 G49 G80");
  lines.push(`S${rpm} M03`);
  lines.push(`G0 Z${safeZ}`);
  lines.push("");

  let originX = 0;
  let originY = 0;
  let index = 1;

  for (const piece of selectedPieces) {
    const qty = Math.max(1, Number(piece.quantity || 1));
    const width = Number(piece.width || piece.length || 600);
    const height = Number(piece.height || 300);

    for (let q = 1; q <= qty; q++) {
      const x0 = originX;
      const y0 = originY;
      const x1 = x0 + width;
      const y1 = y0 + height;

      lines.push(`(PIEZA ${index}: ${piece.name || "SIN NOMBRE"} ${width}x${height}mm)`);
      lines.push(`G0 X${x0.toFixed(2)} Y${y0.toFixed(2)} Z${safeZ}`);
      lines.push(`G1 Z${cutZ} F${plunge}`);
      lines.push(`G1 X${x1.toFixed(2)} Y${y0.toFixed(2)} F${feed}`);
      lines.push(`G1 X${x1.toFixed(2)} Y${y1.toFixed(2)}`);
      lines.push(`G1 X${x0.toFixed(2)} Y${y1.toFixed(2)}`);
      lines.push(`G1 X${x0.toFixed(2)} Y${y0.toFixed(2)}`);
      lines.push(`G0 Z${safeZ}`);
      lines.push("");

      originX += width + 30;
      if (originX > 2400) {
        originX = 0;
        originY += height + 30;
      }
      index += 1;
    }
  }

  lines.push("M05");
  lines.push("G0 Z25");
  lines.push("G0 X0 Y0");
  lines.push("M30");
  lines.push("%");

  return lines.join("\n");
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function MecanizadoPage() {
  const [jobs, setJobs] = useState<CNCJob[]>([]);
  const [tools, setTools] = useState<CNCToolReal[]>([]);
  const [programs, setPrograms] = useState<CNCProgram[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [cuttingPieces, setCuttingPieces] = useState<CuttingPiece[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | string>("todos");
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedJob, setSelectedJob] = useState<CNCJob | null>(null);
  const [generatedCode, setGeneratedCode] = useState("");
  const [generatedName, setGeneratedName] = useState("");
  const [savingProgram, setSavingProgram] = useState(false);
  const [startingCNC, setStartingCNC] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [startedJobIds, setStartedJobIds] = useState<string[]>([]);

  async function loadData() {
    setLoading(true);
    setErrorMessage("");
    try {
      const [jobsRes, toolsRes, programsRes, ordersRes, piecesRes] = await Promise.all([
        supabase.from("cnc_jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("cnc_tools").select("*").order("diameter", { ascending: true }),
        supabase.from("cnc_programs").select("*").order("created_at", { ascending: false }),
        supabase.from("production_orders").select("id, code, status").limit(50),
        supabase.from("cutting_pieces").select("*").limit(250),
      ]);

      const errors = [jobsRes.error, toolsRes.error, programsRes.error, ordersRes.error, piecesRes.error].filter(Boolean);
      if (errors.length) setErrorMessage(errors.map(getErrorMessage).join(" | "));

      const realJobs = (jobsRes.data || []) as CNCJob[];
      const realToolsRaw = (toolsRes.data || []) as CNCToolReal[];

      const realTools = realToolsRaw.filter((tool) => {
        return tool.tool_name || tool.diameter || tool.feed_rate || tool.spindle_speed || tool.notes;
      });

      setJobs(realJobs.length ? realJobs : fallbackJobs);
      setTools(realTools.length ? realTools : fallbackTools);
      setPrograms((programsRes.data || []) as CNCProgram[]);
      setProductionOrders((ordersRes.data || []) as ProductionOrder[]);
      setCuttingPieces((piecesRes.data || []) as CuttingPiece[]);
      setUsingDemo(!realJobs.length || !realTools.length);
    } catch (err: any) {
      setJobs(fallbackJobs);
      setTools(fallbackTools);
      setPrograms([]);
      setProductionOrders([]);
      setCuttingPieces([]);
      setUsingDemo(true);
      setErrorMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesStatus = status === "todos" || safeStatus(job.status) === status;
      const text = `${job.code || ""} ${job.project_name || ""} ${job.module_name || ""} ${job.material_name || ""} ${job.program_name || ""} ${job.tool_name || ""}`.toLowerCase();
      return matchesStatus && text.includes(query.toLowerCase());
    });
  }, [jobs, query, status]);

  const totalPieces = jobs.reduce((acc, job) => acc + Number(job.pieces_count || 0), 0);
  const totalReal = jobs.reduce((acc, job) => acc + Number(job.real_time_min || 0), 0);
  const primaryTool = tools[0];

  const metrics = [
    { label: "Trabajos CNC", value: jobs.length, icon: Cpu, detail: "Órdenes de mecanizado" },
    { label: "Piezas", value: totalPieces || cuttingPieces.length, icon: Layers3, detail: "Piezas detectadas" },
    { label: "Programas", value: programs.length, icon: FileCode2, detail: "Archivos generados" },
    { label: "Herramientas", value: tools.length, icon: Drill, detail: "Brocas reales" },
  ];

  async function saveProgram(job: CNCJob, fileName: string, gcode: string) {
    setSavingProgram(true);
    setErrorMessage("");

    try {
      const { error } = await supabase.from("cnc_programs").insert({
        job_id: job.id?.startsWith("demo") ? null : job.id,
        program_name: fileName,
        file_type: "nc",
        file_url: null,
        gcode,
        status: "generado",
        notes: "Programa generado desde Mecanizado PRO",
      });

      if (error) {
        setErrorMessage(getErrorMessage(error));
      } else {
        setSuccessMessage(`Programa guardado en cnc_programs: ${fileName}`);
        await loadData();
      }
    } catch (err: any) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setSavingProgram(false);
    }
  }

  async function handleGenerateProgram(job?: CNCJob) {
    const activeJob = job || selectedJob || filteredJobs[0] || jobs[0] || fallbackJobs[0];
    const tool = tools.find((item) => item.tool_name === activeJob.tool_name) || primaryTool || fallbackTools[0];

    const codeBase = cleanFileName(activeJob.code || activeJob.project_name || "RDWOOD_CNC");
    const fileName = `${codeBase}_${Date.now()}.nc`;
    const gcode = generateGCode(activeJob, tool, cuttingPieces);

    setSelectedJob(activeJob);
    setGeneratedName(fileName);
    setGeneratedCode(gcode);
    setSuccessMessage(`Programa generado: ${fileName}`);

    await saveProgram(activeJob, fileName, gcode);
  }

  function handleDownloadProgram() {
    if (!generatedCode) {
      handleGenerateProgram();
      return;
    }
    downloadTextFile(generatedName || "RDWOOD_CNC.nc", generatedCode);
  }

  async function handleStartCNC(job?: CNCJob) {
    setStartingCNC(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const activeJob = job || selectedJob || filteredJobs[0] || jobs[0] || null;

      let lastProgram: CNCProgram | null = null;

      if (activeJob && !activeJob.id.startsWith("demo")) {
        const byJob = programs.find((program) => program.job_id === activeJob.id);
        if (byJob) lastProgram = byJob;
      }

      if (!lastProgram && generatedName) {
        const byName = programs.find((program) => program.program_name === generatedName);
        if (byName) lastProgram = byName;
      }

      if (!lastProgram) {
        lastProgram = programs[0] || null;
      }

      if (!lastProgram) {
        setErrorMessage("No hay programas CNC generados. Primero presiona “Generar programa”.");
        return;
      }

      const { error: programError } = await supabase
        .from("cnc_programs")
        .update({
          status: "enviado",
          notes: "Programa enviado a CNC desde Mecanizado PRO",
          updated_at: new Date().toISOString(),
        })
        .eq("id", lastProgram.id);

      if (programError) throw programError;

      if (lastProgram.job_id) {
        const { error: jobError } = await supabase
          .from("cnc_jobs")
          .update({
            status: "en_proceso",
            updated_at: new Date().toISOString(),
          })
          .eq("id", lastProgram.job_id);

        if (jobError) throw jobError;
      } else if (activeJob && !activeJob.id.startsWith("demo")) {
        const { error: jobError } = await supabase
          .from("cnc_jobs")
          .update({
            status: "en_proceso",
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeJob.id);

        if (jobError) throw jobError;
      }

      if (activeJob?.id) {
        setStartedJobIds((prev) => Array.from(new Set([...prev, activeJob.id])));
      }

      setSuccessMessage(`Programa enviado a CNC correctamente: ${lastProgram.program_name || "programa CNC"}`);
      await loadData();
    } catch (err: any) {
      setErrorMessage(`Error al iniciar CNC: ${getErrorMessage(err)}`);
    } finally {
      setStartingCNC(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#030712] text-slate-100">
      <div className="mx-auto max-w-[1500px] space-y-7 p-5 md:p-8">
        <section className="overflow-hidden rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-950 to-blue-950/30 shadow-2xl shadow-cyan-950/20">
          <div className="grid gap-6 p-6 md:grid-cols-[1.35fr_.85fr] md:p-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-200">
                <Database className="h-4 w-4" />
                Fase 4B · Iniciar CNC activo
              </div>

              <div>
                <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                  Mecanizado PRO
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
                  Genera programas CNC `.nc`, guarda el registro en `cnc_programs`, permite descarga local,
                  envía el programa a CNC y cambia el trabajo a estado en proceso.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={loadData} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20">
                  <RefreshCcw className="h-4 w-4" />
                  Refrescar datos
                </button>

                <button onClick={() => handleGenerateProgram()} disabled={savingProgram} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-60">
                  {savingProgram ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode2 className="h-4 w-4" />}
                  Generar programa
                </button>

                <button onClick={handleDownloadProgram} className="inline-flex items-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm font-black text-blue-100 transition hover:bg-blue-400/20">
                  <Download className="h-4 w-4" />
                  Descargar .nc
                </button>

                <button onClick={() => handleStartCNC()} disabled={startingCNC} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-60">
                  {startingCNC ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                  Iniciar CNC
                </button>
              </div>

              {usingDemo && (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                  <strong>Nota:</strong> hay datos demo en trabajos o herramientas porque alguna tabla está vacía.
                </div>
              )}

              {successMessage && (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                  <strong>OK:</strong> {successMessage}
                </div>
              )}

              {errorMessage && (
                <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
                  <strong>Error detectado:</strong> {errorMessage}
                </div>
              )}
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-200">
                  <Box className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Flujo conectado</p>
                  <h2 className="text-xl font-black text-white">Producción → Corte → CNC</h2>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm">
                {[
                  [`Órdenes producción: ${productionOrders.length}`, Layers3],
                  [`Piezas corte: ${cuttingPieces.length}`, Ruler],
                  [`Programas CNC: ${programs.length}`, FileCode2],
                  [`Herramientas CNC: ${tools.length}`, Drill],
                ].map(([label, Icon]: any) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                    <Icon className="h-5 w-5 text-cyan-300" />
                    <span className="font-semibold text-slate-200">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="rounded-[24px] border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20">
                <div className="flex items-center justify-between">
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-3xl font-black text-white">{metric.value}</span>
                </div>
                <p className="mt-4 text-sm font-black text-slate-300">{metric.label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{metric.detail}</p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_440px]">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Cola real de mecanizado</h2>
                <p className="text-sm text-slate-500">Selecciona un trabajo, genera su archivo CNC e inicia el proceso.</p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50">
                  <option value="todos">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="programado">Programado</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="completado">Completado</option>
                  <option value="revision">Revisión</option>
                </select>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar proyecto, módulo o programa..." className="w-full rounded-2xl border border-white/10 bg-slate-900 px-11 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50 md:w-80" />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-[24px] border border-white/10 bg-slate-900/60">
                <div className="flex items-center gap-3 text-cyan-100">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Cargando datos CNC...
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredJobs.map((job) => {
                  const st = startedJobIds.includes(job.id) ? "en_proceso" : safeStatus(job.status);
                  const priority = job.priority || "normal";
                  const active = selectedJob?.id === job.id;

                  return (
                    <article key={job.id} className={`rounded-[22px] border bg-gradient-to-br from-slate-900 to-slate-950 p-4 transition ${active ? "border-cyan-300/60" : "border-white/10 hover:border-cyan-300/30"}`}>
                      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">{job.code || "SIN-CODIGO"}</span>
                            <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass[st] || statusClass.pendiente}`}>{statusLabel[st] || st}</span>
                            <span className={`rounded-full border px-3 py-1 text-xs font-black ${priorityClass[priority] || priorityClass.normal}`}>Prioridad {priority}</span>
                          </div>

                          <div>
                            <h3 className="text-lg font-black text-white">{job.project_name || "Proyecto sin nombre"}</h3>
                            <p className="text-sm text-slate-400">{job.module_name || "Módulo sin especificar"}</p>
                          </div>

                          <div className="grid gap-2 text-xs font-semibold text-slate-500 md:grid-cols-2 xl:grid-cols-4">
                            <span className="inline-flex items-center gap-1"><Layers3 className="h-4 w-4" />{Number(job.pieces_count || 0)} piezas</span>
                            <span className="inline-flex items-center gap-1"><FileCode2 className="h-4 w-4" />{job.program_name || "Sin programa"}</span>
                            <span className="inline-flex items-center gap-1"><Drill className="h-4 w-4" />{job.tool_name || toolDisplayName(primaryTool)}</span>
                            <span className="inline-flex items-center gap-1"><Timer className="h-4 w-4" />Est. {formatMinutes(job.estimated_time_min)}</span>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-slate-400">
                            <strong className="text-slate-200">Material:</strong> {job.material_name || "No definido"} ·{" "}
                            <strong className="text-slate-200">Máquina:</strong> {job.machine_name || "CNC Router Principal"} ·{" "}
                            <strong className="text-slate-200">Operador:</strong> {job.operator_name || "Sin asignar"} ·{" "}
                            <strong className="text-slate-200">Real:</strong> {formatMinutes(job.real_time_min)}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:flex-col">
                          <button onClick={() => setSelectedJob(job)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 hover:bg-white/10">
                            Seleccionar
                          </button>
                          <button onClick={() => handleGenerateProgram(job)} className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100 hover:bg-cyan-400/20">
                            Generar .nc
                          </button>
                          <button onClick={handleDownloadProgram} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-400/20">
                            Descargar
                          </button>
                          <button onClick={() => handleStartCNC(job)} disabled={startingCNC || startedJobIds.includes(job.id)} className="rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-sm font-black text-blue-100 hover:bg-blue-400/20 disabled:opacity-60">
                            {startingCNC ? "Iniciando..." : startedJobIds.includes(job.id) ? "CNC iniciado" : "Iniciar CNC"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white">Herramientas CNC reales</h2>
                  <p className="mt-1 text-sm text-slate-500">Parámetros usados para generar G-code.</p>
                </div>
                <Settings2 className="h-6 w-6 text-cyan-200" />
              </div>

              <div className="mt-5 space-y-3">
                {tools.map((tool) => (
                  <div key={tool.id} className="rounded-[22px] border border-white/10 bg-slate-900/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-cyan-200">{tool.tool_type || "tool"}</p>
                        <h3 className="mt-1 font-black text-white">{toolDisplayName(tool)}</h3>
                        <p className="mt-1 text-xs text-slate-500">{tool.material ? `Material: ${tool.material}` : "Material no definido"}</p>
                      </div>
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-black text-emerald-200">
                        {tool.spindle_speed ? "Lista" : "Revisar"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-400">
                      <span className="rounded-xl bg-black/20 px-3 py-2">Ø {formatNumber(tool.diameter, " mm")}</span>
                      <span className="rounded-xl bg-black/20 px-3 py-2">Corte {formatNumber(tool.cut_length, " mm")}</span>
                      <span className="rounded-xl bg-black/20 px-3 py-2">Feed {formatNumber(tool.feed_rate, " mm/min")}</span>
                      <span className="rounded-xl bg-black/20 px-3 py-2">Plunge {formatNumber(tool.plunge_rate, " mm/min")}</span>
                      <span className="rounded-xl bg-black/20 px-3 py-2">RPM {formatNumber(tool.spindle_speed)}</span>
                      <span className="rounded-xl bg-black/20 px-3 py-2">Step {formatNumber(tool.step_down, " mm")}</span>
                    </div>

                    {tool.notes && (
                      <div className="mt-3 rounded-xl border border-cyan-400/10 bg-cyan-400/5 px-3 py-2 text-xs font-semibold text-cyan-100/80">
                        {tool.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
              <h2 className="text-xl font-black text-white">Programa generado</h2>
              <p className="mt-1 text-sm text-slate-500">{generatedName || "Aún no se ha generado archivo .nc"}</p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["RPM", formatNumber(primaryTool?.spindle_speed), Gauge],
                  ["Feed", formatNumber(primaryTool?.feed_rate, " mm/min"), RotateCcw],
                  ["Step Down", formatNumber(primaryTool?.step_down, " mm"), Clock3],
                  ["Real", formatMinutes(totalReal), CheckCircle2],
                ].map(([label, value, Icon]: any) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <Icon className="h-5 w-5 text-cyan-200" />
                    <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-black text-white">{value}</p>
                  </div>
                ))}
              </div>

              <pre className="mt-4 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-xs leading-5 text-cyan-100">
                {generatedCode || "Presiona “Generar programa” para ver el G-code aquí."}
              </pre>

              <button onClick={handleDownloadProgram} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-400/20">
                <HardDriveDownload className="h-4 w-4" />
                Descargar programa .nc
              </button>

              <button onClick={() => handleStartCNC()} disabled={startingCNC} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm font-black text-blue-100 hover:bg-blue-400/20 disabled:opacity-60">
                {startingCNC ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                {startingCNC ? "Enviando a CNC..." : "Iniciar CNC"}
              </button>

              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-200" />
                  <div>
                    <p className="font-black text-amber-100">Validación necesaria</p>
                    <p className="mt-1 text-xs leading-5 text-amber-100/70">
                      Antes de enviar a la CNC real, valida postprocesador, origen, sujeción, diámetro y profundidad.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
