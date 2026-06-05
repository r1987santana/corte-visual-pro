"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Camera,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  Factory,
  ImagePlus,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { registerOperationalCompensationEvents } from "@/lib/rrhh/operational-compensation";

type PieceLabel = {
  id: string;
  label_code: string;
  order_code: string;
  production_order_id?: string | null;
  project_name: string | null;
  client_name: string | null;
  module_name: string | null;
  piece_name: string | null;
  material_name: string | null;
  width_mm: number | null;
  height_mm: number | null;
  thickness_mm: number | null;
  current_status: string | null;
  assembled_at?: string | null;
  assembly_operator?: string | null;
  created_at?: string | null;
};

type AssemblyCheck = {
  id?: string;
  order_code: string;
  module_name: string;
  client_name?: string | null;
  project_name?: string | null;
  checklist?: Record<string, boolean> | null;
  qa_status?: string | null;
  assembly_status?: string | null;
  operator_name?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AssemblyPhoto = {
  id: string;
  order_code: string;
  module_name: string;
  photo_url: string;
  photo_type?: string | null;
  uploaded_by?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type ModuleGroup = {
  key: string;
  module_name: string;
  order_code: string;
  client_name: string;
  project_name: string;
  production_order_id?: string | null;
  pieces: PieceLabel[];
  check?: AssemblyCheck | null;
  photos: AssemblyPhoto[];
  total: number;
  ready: number;
  assembled: number;
  pending: number;
  progress: number;
  canAssemble: boolean;
  statusLabel: string;
};

const CHECK_ITEMS = [
  { key: "hardware_ready", label: "Herrajes completos" },
  { key: "minifix_installed", label: "Minifix / tarugos instalados" },
  { key: "edges_checked", label: "Cantos revisados" },
  { key: "holes_checked", label: "Perforaciones verificadas" },
  { key: "squared", label: "Módulo escuadrado" },
  { key: "cleaned", label: "Limpieza final" },
  { key: "qa_visual", label: "QA visual aprobado" },
  { key: "ready_transport", label: "Listo para transporte" },
];

const READY_STATES = new Set([
  "cortada",
  "canteada",
  "perforada",
  "cnc",
  "lista",
  "optimizada",
  "pendiente",
]);

const ASSEMBLED_STATES = new Set([
  "ensamblada",
  "listo_transporte",
  "transporte",
  "instalada",
  "entregada",
]);

function normalizedStatus(value?: string | null) {
  return String(value || "pendiente").trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function percent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniqueKey(orderCode: string, moduleName: string) {
  return `${orderCode || "SIN-ORDEN"}__${moduleName || "SIN-MODULO"}`;
}

export default function EnsambladoPage() {
  const [pieces, setPieces] = useState<PieceLabel[]>([]);
  const [checks, setChecks] = useState<AssemblyCheck[]>([]);
  const [photos, setPhotos] = useState<AssemblyPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [orderFilter, setOrderFilter] = useState<string>("todos");
  const [operatorName, setOperatorName] = useState<string>("Supervisor Ensamblado");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [photoNotes, setPhotoNotes] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const [piecesRes, checksRes, photosRes] = await Promise.all([
        supabase
          .from("piece_labels")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("assembly_module_checks")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("assembly_module_photos")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (piecesRes.error) throw piecesRes.error;
      if (checksRes.error) throw checksRes.error;
      if (photosRes.error) throw photosRes.error;

      setPieces((piecesRes.data || []) as PieceLabel[]);
      setChecks((checksRes.data || []) as AssemblyCheck[]);
      setPhotos((photosRes.data || []) as AssemblyPhoto[]);
    } catch (error: any) {
      console.error(error);
      setMessage(`⚠️ Error cargando ensamblado: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const orders = useMemo(() => {
    return Array.from(new Set(pieces.map((p) => p.order_code).filter(Boolean))).sort();
  }, [pieces]);

  const modules = useMemo<ModuleGroup[]>(() => {
    const grouped = new Map<string, ModuleGroup>();

    pieces.forEach((piece) => {
      const orderCode = piece.order_code || "SIN-ORDEN";
      const moduleName = piece.module_name || "Sin módulo";
      const key = uniqueKey(orderCode, moduleName);

      if (!grouped.has(key)) {
        const check = checks.find(
          (c) => c.order_code === orderCode && c.module_name === moduleName
        );

        grouped.set(key, {
          key,
          module_name: moduleName,
          order_code: orderCode,
          client_name: piece.client_name || "Cliente",
          project_name: piece.project_name || "Proyecto",
          production_order_id: piece.production_order_id || null,
          pieces: [],
          check: check || null,
          photos: photos.filter((p) => p.order_code === orderCode && p.module_name === moduleName),
          total: 0,
          ready: 0,
          assembled: 0,
          pending: 0,
          progress: 0,
          canAssemble: false,
          statusLabel: "Pendiente",
        });
      }

      grouped.get(key)!.pieces.push(piece);
    });

    const list = Array.from(grouped.values()).map((module) => {
      module.total = module.pieces.length;
      module.assembled = module.pieces.filter((p) => ASSEMBLED_STATES.has(normalizedStatus(p.current_status))).length;
      module.ready = module.pieces.filter((p) => {
        const st = normalizedStatus(p.current_status);
        return READY_STATES.has(st) || ASSEMBLED_STATES.has(st);
      }).length;
      module.pending = Math.max(module.total - module.ready, 0);
      module.progress = module.total > 0 ? percent((module.assembled / module.total) * 100) : 0;
      module.canAssemble = module.total > 0 && module.ready === module.total;

      const assemblyStatus = normalizedStatus(module.check?.assembly_status);
      const qaStatus = normalizedStatus(module.check?.qa_status);

      if (assemblyStatus === "listo_transporte") module.statusLabel = "Listo transporte";
      else if (assemblyStatus === "ensamblado") module.statusLabel = "Ensamblado";
      else if (qaStatus === "aprobado") module.statusLabel = "QA aprobado";
      else if (module.assembled > 0) module.statusLabel = "En proceso";
      else if (module.canAssemble) module.statusLabel = "Listo para ensamblar";
      else module.statusLabel = "Pendiente piezas";

      return module;
    });

    return list
      .filter((m) => orderFilter === "todos" || m.order_code === orderFilter)
      .sort((a, b) => a.order_code.localeCompare(b.order_code) || a.module_name.localeCompare(b.module_name));
  }, [pieces, checks, photos, orderFilter]);

  const selectedModule = modules.find((m) => m.key === selectedKey) || modules[0] || null;

  useEffect(() => {
    if (!selectedKey && modules[0]?.key) setSelectedKey(modules[0].key);
  }, [modules, selectedKey]);

  const totalOrders = new Set(modules.map((m) => m.order_code)).size;
  const totalModules = modules.length;
  const assembledModules = modules.filter((m) => normalizedStatus(m.check?.assembly_status) === "ensamblado" || normalizedStatus(m.check?.assembly_status) === "listo_transporte").length;
  const readyTransport = modules.filter((m) => normalizedStatus(m.check?.assembly_status) === "listo_transporte").length;
  const globalProgress = totalModules > 0 ? percent(modules.reduce((acc, m) => acc + m.progress, 0) / totalModules) : 0;

  async function upsertModuleCheck(module: ModuleGroup, patch: Partial<AssemblyCheck>) {
    const current = module.check;
    const payload: AssemblyCheck = {
      order_code: module.order_code,
      module_name: module.module_name,
      client_name: module.client_name,
      project_name: module.project_name,
      checklist: current?.checklist || {},
      qa_status: current?.qa_status || "pendiente_qa",
      assembly_status: current?.assembly_status || "pendiente",
      operator_name: operatorName || current?.operator_name || "Supervisor Ensamblado",
      notes: current?.notes || "",
      ...patch,
      updated_at: nowIso(),
    };

    const { error } = await supabase
      .from("assembly_module_checks")
      .upsert(payload, { onConflict: "order_code,module_name" });

    if (error) throw error;
  }

  async function startAssembly(module: ModuleGroup) {
    setSaving(true);
    try {
      await upsertModuleCheck(module, {
        assembly_status: "en_ensamblado",
        started_at: module.check?.started_at || nowIso(),
      });

      await insertHistory(module, "en_ensamblado", "Inicio de ensamblado del módulo");
      await loadData();
      setMessage("✅ Ensamblado iniciado.");
    } catch (error: any) {
      alert(error?.message || error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleChecklist(module: ModuleGroup, key: string) {
    setSaving(true);
    try {
      const current = module.check?.checklist || {};
      const nextChecklist = {
        ...current,
        [key]: !Boolean(current[key]),
      };

      await upsertModuleCheck(module, {
        checklist: nextChecklist,
      });

      await loadData();
    } catch (error: any) {
      alert(error?.message || error);
    } finally {
      setSaving(false);
    }
  }

  async function markModuleAssembled(module: ModuleGroup) {
    if (!module.canAssemble) {
      alert("Este módulo todavía tiene piezas sin completar en QR/Trazabilidad.");
      return;
    }

    const ok = confirm(`¿Marcar como ensamblado el módulo ${module.module_name}?`);
    if (!ok) return;

    setSaving(true);

    try {
      const ids = module.pieces.map((p) => p.id);
      const time = nowIso();

      const { error: pieceError } = await supabase
        .from("piece_labels")
        .update({
          current_status: "ensamblada",
          assembled_at: time,
          assembly_operator: operatorName || "Supervisor Ensamblado",
        })
        .in("id", ids);

      if (pieceError) throw pieceError;

      await upsertModuleCheck(module, {
        assembly_status: "ensamblado",
        qa_status: "pendiente_qa",
        finished_at: time,
      });

      await insertHistory(module, "ensamblada", "Módulo ensamblado correctamente");
      await registerOperationalCompensationEvents({
        supabase,
        orderCode: module.order_code,
        moduleName: module.module_name,
        projectName: module.project_name,
        sourceModule: "ensamblado",
        pieces: module.pieces,
        participants: [
          {
            name: operatorName || "Supervisor Ensamblado",
            roleKey: "ensamble_maestro",
            department: "Ensamblado",
            position: "Ensamblador Maestro",
          },
        ],
        notes: "Modulo ensamblado y limpieza registrada.",
      });
      await updateProductionAssemblyStatus(module.order_code);
      await loadData();
      setMessage("✅ Módulo ensamblado y registrado.");
    } catch (error: any) {
      console.error(error);
      alert(error?.message || error);
    } finally {
      setSaving(false);
    }
  }

  async function approveQA(module: ModuleGroup) {
    setSaving(true);
    try {
      await upsertModuleCheck(module, {
        qa_status: "aprobado",
        assembly_status: module.check?.assembly_status || "ensamblado",
      });

      await insertHistory(module, "qa_aprobado", "QA del módulo aprobado");
      await loadData();
      setMessage("✅ QA aprobado.");
    } catch (error: any) {
      alert(error?.message || error);
    } finally {
      setSaving(false);
    }
  }

  async function rejectQA(module: ModuleGroup) {
    const reason = prompt("Motivo del rechazo QA:", module.check?.notes || "");
    if (reason === null) return;

    setSaving(true);
    try {
      await upsertModuleCheck(module, {
        qa_status: "rechazado",
        assembly_status: "correccion",
        notes: reason,
      });

      await insertHistory(module, "qa_rechazado", reason || "QA rechazado");
      await loadData();
      setMessage("⚠️ QA rechazado y enviado a corrección.");
    } catch (error: any) {
      alert(error?.message || error);
    } finally {
      setSaving(false);
    }
  }

  async function markReadyTransport(module: ModuleGroup) {
    const checklist = module.check?.checklist || {};
    const missing = CHECK_ITEMS.filter((c) => !checklist[c.key]).map((c) => c.label);

    if (missing.length > 0) {
      alert(`Faltan checklist:\n${missing.join("\n")}`);
      return;
    }

    if (normalizedStatus(module.check?.qa_status) !== "aprobado") {
      alert("Primero debes aprobar QA.");
      return;
    }

    setSaving(true);
    try {
      await upsertModuleCheck(module, {
        assembly_status: "listo_transporte",
        qa_status: "aprobado",
        finished_at: module.check?.finished_at || nowIso(),
      });

      await insertHistory(module, "listo_transporte", "Módulo liberado para logística/transporte");
      await updateProductionAssemblyStatus(module.order_code);
      await loadData();
      setMessage("✅ Módulo listo para transporte.");
    } catch (error: any) {
      alert(error?.message || error);
    } finally {
      setSaving(false);
    }
  }

  async function insertHistory(module: ModuleGroup, newStatus: string, notes: string) {
    const rows = module.pieces.map((piece) => ({
      piece_code: piece.label_code,
      label_code: piece.label_code,
      order_code: module.order_code,
      production_order_id: piece.production_order_id || module.production_order_id || null,
      piece_name: piece.piece_name,
      module_name: module.module_name,
      previous_status: piece.current_status || "pendiente",
      new_status: newStatus,
      department: "Ensamblado",
      operator_name: operatorName || "Supervisor Ensamblado",
      notes,
      scanned_at: nowIso(),
    }));

    const { error } = await supabase.from("piece_tracking_history").insert(rows);
    if (error) throw error;
  }

  async function updateProductionAssemblyStatus(orderCode: string) {
    const relatedModules = modules.filter((m) => m.order_code === orderCode);
    const allReady = relatedModules.length > 0 && relatedModules.every((m) => normalizedStatus(m.check?.assembly_status) === "listo_transporte");
    const hasAssembly = relatedModules.some((m) => ["ensamblado", "listo_transporte", "en_ensamblado"].includes(normalizedStatus(m.check?.assembly_status)));

    try {
      await supabase
        .from("production_orders")
        .update({
          assembly_status: allReady ? "listo_transporte" : hasAssembly ? "en_ensamblado" : "pendiente",
          assembly_completed_at: allReady ? nowIso() : null,
        })
        .eq("order_code", orderCode);
    } catch {
      // No rompe el flujo si la tabla usa otro código o no existe el campo en algún entorno.
    }
  }

  async function addPhoto(module: ModuleGroup) {
    if (!photoUrl.trim()) {
      alert("Pega la URL de la foto del módulo.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("assembly_module_photos").insert({
        order_code: module.order_code,
        module_name: module.module_name,
        photo_url: photoUrl.trim(),
        photo_type: "ensamblado",
        uploaded_by: operatorName || "Supervisor Ensamblado",
        notes: photoNotes || null,
      });

      if (error) throw error;
      setPhotoUrl("");
      setPhotoNotes("");
      await loadData();
      setMessage("✅ Foto agregada al módulo.");
    } catch (error: any) {
      alert(error?.message || error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-blue-800 via-cyan-700 to-emerald-500 p-6 shadow-2xl">
        <p className="text-xs font-black tracking-[0.35em] text-cyan-100">RD WOOD SYSTEM</p>
        <h1 className="mt-2 text-4xl font-black">Ensamblado Industrial PRO</h1>
        <p className="mt-2 max-w-4xl text-sm text-white/85">
          Checklist, fotos, QA, tiempos y liberación automática hacia logística / instalación.
        </p>
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <Metric title="Órdenes" value={totalOrders} icon={<Factory size={20} />} />
        <Metric title="Módulos" value={totalModules} icon={<PackageCheck size={20} />} />
        <Metric title="Armados" value={assembledModules} icon={<ClipboardCheck size={20} />} />
        <Metric title="Listos transporte" value={readyTransport} icon={<Truck size={20} />} />
        <Metric title="Avance" value={`${globalProgress}%`} icon={<Clock size={20} />} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Módulos de ensamblado</h2>
              <p className="mt-1 text-sm text-slate-400">Agrupados automáticamente desde QR/Trazabilidad.</p>
            </div>

            <div className="flex gap-2">
              <select
                value={orderFilter}
                onChange={(e) => setOrderFilter(e.target.value)}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold"
              >
                <option value="todos">Todas las órdenes</option>
                {orders.map((order) => (
                  <option key={order} value={order}>{order}</option>
                ))}
              </select>

              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                Actualizar
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <label className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Operario / Supervisor</label>
            <input
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-bold outline-none focus:border-cyan-400"
              placeholder="Nombre del responsable"
            />
          </div>

          <div className="mt-5 space-y-4">
            {loading && (
              <div className="rounded-2xl border border-slate-800 p-8 text-center text-slate-400">Cargando módulos...</div>
            )}

            {!loading && modules.length === 0 && (
              <div className="rounded-2xl border border-slate-800 p-8 text-center text-slate-400">No hay módulos disponibles.</div>
            )}

            {modules.map((module) => (
              <button
                key={module.key}
                onClick={() => setSelectedKey(module.key)}
                className={`w-full rounded-2xl border p-5 text-left transition ${
                  selectedModule?.key === module.key
                    ? "border-cyan-400 bg-cyan-500/10"
                    : "border-slate-800 bg-slate-950 hover:border-cyan-500/60"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black">{module.module_name}</h3>
                    <p className="mt-1 text-sm text-slate-400">{module.project_name}</p>
                    <p className="text-sm text-slate-500">{module.client_name}</p>
                  </div>

                  <div className="rounded-2xl bg-slate-800 px-4 py-3 text-right">
                    <p className="text-xs text-slate-400">Estado</p>
                    <p className="text-sm font-black text-cyan-300">{module.statusLabel}</p>
                  </div>
                </div>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${module.progress}%` }} />
                </div>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-slate-400">{module.assembled} / {module.total} ensambladas · {module.ready} listas</span>
                  <span className="font-black text-cyan-400">{module.order_code}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
          {!selectedModule ? (
            <div className="flex min-h-[500px] items-center justify-center text-center text-slate-500">Selecciona un módulo.</div>
          ) : (
            <ModuleDetail
              module={selectedModule}
              saving={saving}
              operatorName={operatorName}
              photoUrl={photoUrl}
              photoNotes={photoNotes}
              setPhotoUrl={setPhotoUrl}
              setPhotoNotes={setPhotoNotes}
              onStart={() => startAssembly(selectedModule)}
              onToggleChecklist={(key) => toggleChecklist(selectedModule, key)}
              onAssemble={() => markModuleAssembled(selectedModule)}
              onApproveQA={() => approveQA(selectedModule)}
              onRejectQA={() => rejectQA(selectedModule)}
              onReadyTransport={() => markReadyTransport(selectedModule)}
              onAddPhoto={() => addPhoto(selectedModule)}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function ModuleDetail({
  module,
  saving,
  photoUrl,
  photoNotes,
  setPhotoUrl,
  setPhotoNotes,
  onStart,
  onToggleChecklist,
  onAssemble,
  onApproveQA,
  onRejectQA,
  onReadyTransport,
  onAddPhoto,
}: {
  module: ModuleGroup;
  saving: boolean;
  operatorName: string;
  photoUrl: string;
  photoNotes: string;
  setPhotoUrl: (v: string) => void;
  setPhotoNotes: (v: string) => void;
  onStart: () => void;
  onToggleChecklist: (key: string) => void;
  onAssemble: () => void;
  onApproveQA: () => void;
  onRejectQA: () => void;
  onReadyTransport: () => void;
  onAddPhoto: () => void;
}) {
  const checklist = module.check?.checklist || {};
  const qaStatus = normalizedStatus(module.check?.qa_status);
  const assemblyStatus = normalizedStatus(module.check?.assembly_status);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Módulo seleccionado</p>
          <h2 className="mt-2 text-3xl font-black">{module.module_name}</h2>
          <p className="mt-1 text-sm text-slate-400">{module.project_name}</p>
          <p className="text-sm text-slate-500">{module.client_name} · {module.order_code}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <Badge label="Progreso" value={`${module.progress}%`} />
          <Badge label="QA" value={qaStatus.replace("_", " ")} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ActionButton icon={<Clock size={18} />} label="Iniciar" onClick={onStart} disabled={saving || assemblyStatus === "en_ensamblado"} />
        <ActionButton icon={<PackageCheck size={18} />} label="Marcar ensamblado" onClick={onAssemble} disabled={saving} />
        <ActionButton icon={<Truck size={18} />} label="Listo transporte" onClick={onReadyTransport} disabled={saving} />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-5">
        <h3 className="flex items-center gap-2 text-xl font-black"><ClipboardCheck size={20} /> Checklist técnico</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {CHECK_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => onToggleChecklist(item.key)}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold ${
                checklist[item.key]
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-800 bg-slate-900 text-slate-300"
              }`}
            >
              {checklist[item.key] ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-5">
        <h3 className="flex items-center gap-2 text-xl font-black"><ShieldCheck size={20} /> Control QA</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <button onClick={onApproveQA} disabled={saving} className="rounded-2xl bg-emerald-500 px-5 py-4 font-black text-slate-950">Aprobar QA</button>
          <button onClick={onRejectQA} disabled={saving} className="rounded-2xl bg-rose-500 px-5 py-4 font-black text-white">Rechazar QA</button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-5">
        <h3 className="flex items-center gap-2 text-xl font-black">
          <ImagePlus size={20} /> Fotos del ensamblado
        </h3>

        <div className="mt-4 grid gap-3">
          <label className="rounded-2xl border border-dashed border-cyan-500/40 bg-cyan-500/10 p-5 text-center transition hover:bg-cyan-500/20">
            <div className="flex flex-col items-center gap-2">
              <Camera size={34} className="text-cyan-300" />
              <span className="text-base font-black text-cyan-100">Tomar foto / subir evidencia</span>
              <span className="text-xs text-slate-400">En celular o tablet abrirá la cámara trasera.</span>
            </div>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                try {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  const safeOrder = String(module.order_code || "SIN-ORDEN")
                    .replace(/\s+/g, "-")
                    .replace(/[^\w-]/g, "");

                  const safeModule = String(module.module_name || "SIN-MODULO")
                    .replace(/\s+/g, "-")
                    .replace(/[^\w-]/g, "");

                  const ext = file.name.split(".").pop() || "jpg";
                  const fileName = `ensamblado/${safeOrder}/${safeModule}-${Date.now()}.${ext}`;

                  const { error: uploadError } = await supabase.storage
                    .from("project-photos")
                    .upload(fileName, file, {
                      cacheControl: "3600",
                      upsert: true,
                    });

                  if (uploadError) {
                    alert(
                      `No pude subir la foto. Verifica que exista el bucket project-photos en Supabase Storage.\n\n${uploadError.message}`
                    );
                    return;
                  }

                  const { data } = supabase.storage
                    .from("project-photos")
                    .getPublicUrl(fileName);

                  setPhotoUrl(data.publicUrl);
                } catch (error: any) {
                  console.error(error);
                  alert(error?.message || error);
                }
              }}
            />
          </label>

          {photoUrl ? (
            <div className="overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-900">
              <img src={photoUrl} alt="Foto de ensamblado" className="h-72 w-full object-cover" />
              <div className="p-3 text-xs text-cyan-200">Foto cargada. Agrega una nota y presiona Guardar foto.</div>
            </div>
          ) : null}

          <textarea
            value={photoNotes}
            onChange={(e) => setPhotoNotes(e.target.value)}
            placeholder="Nota técnica de la foto: módulo armado, observación QA, detalle pendiente..."
            className="min-h-[110px] rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-400"
          />

          <button
            onClick={onAddPhoto}
            disabled={saving || !photoUrl}
            className="rounded-2xl bg-cyan-500 px-5 py-4 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar foto en el módulo
          </button>
        </div>

        {module.photos.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {module.photos.map((photo) => (
              <a key={photo.id} href={photo.photo_url} target="_blank" className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <img src={photo.photo_url} alt="Evidencia de ensamblado" className="h-44 w-full object-cover" />
                <div className="p-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-cyan-300"><Camera size={16} /> Evidencia</div>
                  <p className="mt-1 text-xs text-slate-400">{photo.notes || "Sin nota"}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{photo.uploaded_by || "Supervisor"}</p>
                </div>
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-5">
        <h3 className="text-xl font-black">Piezas del módulo</h3>
        <div className="mt-4 max-h-[360px] space-y-3 overflow-auto pr-1">
          {module.pieces.map((piece) => (
            <div key={piece.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-black text-cyan-300">{piece.label_code}</h4>
                  <p className="font-bold">{piece.piece_name}</p>
                  <p className="text-sm text-slate-400">{piece.width_mm} × {piece.height_mm} × {piece.thickness_mm} mm</p>
                  <p className="text-xs text-slate-500">{piece.material_name}</p>
                </div>
                <div className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-black uppercase text-cyan-300">{piece.current_status || "pendiente"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ title, value, icon }: { title: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between text-cyan-300">{icon}<span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">{title}</span></div>
      <h2 className="mt-4 text-4xl font-black">{value}</h2>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-950 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-cyan-300">{value}</p>
    </div>
  );
}

function ActionButton({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-4 font-black text-slate-950 disabled:opacity-50">
      {icon}
      {label}
    </button>
  );
}
