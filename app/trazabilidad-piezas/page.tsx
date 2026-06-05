"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Factory,
  Filter,
  Loader2,
  PackageCheck,
  QrCode,
  RefreshCw,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type PieceLabel = {
  id: string;
  label_code: string;
  order_code: string;
  production_order_id?: string | null;
  client_name?: string | null;
  project_name?: string | null;
  module_name?: string | null;
  piece_name?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  thickness_mm?: number | null;
  material_name?: string | null;
  edge_detail?: string | null;
  quantity?: number | null;
  current_status?: string | null;
  qr_payload?: any;
  created_at?: string | null;
  updated_at?: string | null;
};

type PieceTrackingEvent = {
  id: string;
  piece_code?: string | null;
  label_code?: string | null;
  order_code?: string | null;
  production_order_id?: string | null;
  piece_name?: string | null;
  module_name?: string | null;
  previous_status?: string | null;
  new_status: string;
  department?: string | null;
  operator_name?: string | null;
  notes?: string | null;
  payload?: any;
  scanned_by?: string | null;
  scanned_at?: string | null;
  created_at?: string | null;
};

type EnrichedPiece = PieceLabel & {
  current_status: string;
  last_event?: PieceTrackingEvent | null;
  history: PieceTrackingEvent[];
};

type ModuleGroup = {
  key: string;
  order_code: string;
  production_order_id?: string | null;
  client_name: string;
  project_name: string;
  module_name: string;
  pieces: EnrichedPiece[];
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
  readyForAssembly: number;
  progress: number;
  statusLabel: string;
  lastEvent?: PieceTrackingEvent | null;
};

const STATUS_FLOW = [
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

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_corte: "En corte",
  cortada: "Cortada",
  canteada: "Canteada",
  perforada: "Perforada",
  cnc: "CNC",
  ensamblada: "Ensamblada",
  empacada: "Empacada",
  transportada: "Transportada",
  instalada: "Instalada",
  entregada: "Entregada",
};

const PROCESS_STATES = new Set([
  "en_corte",
  "cortada",
  "canteada",
  "perforada",
  "cnc",
  "ensamblada",
  "empacada",
  "transportada",
]);

const READY_ASSEMBLY_STATES = new Set([
  "cortada",
  "canteada",
  "perforada",
  "cnc",
  "ensamblada",
  "empacada",
  "transportada",
  "instalada",
  "entregada",
]);

function normalizeStatus(status?: string | null) {
  const value = String(status || "pendiente").trim().toLowerCase();
  if (!value) return "pendiente";
  return value;
}

function statusIndex(status?: string | null) {
  const normalized = normalizeStatus(status);
  const index = STATUS_FLOW.indexOf(normalized);
  return index >= 0 ? index : 0;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
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

function moduleKey(orderCode?: string | null, moduleName?: string | null) {
  return `${orderCode || "SIN-ORDEN"}__${moduleName || "Sin módulo"}`;
}

export default function TrazabilidadPiezasPage() {
  const [labels, setLabels] = useState<PieceLabel[]>([]);
  const [events, setEvents] = useState<PieceTrackingEvent[]>([]);
  const [selectedModuleKey, setSelectedModuleKey] = useState<string>("");
  const [selectedLabel, setSelectedLabel] = useState<EnrichedPiece | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [bulkToolsOpen, setBulkToolsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [orderFilter, setOrderFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const { data: labelData, error: labelError } = await supabase
      .from("piece_labels")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: eventData, error: eventError } = await supabase
      .from("piece_tracking_history")
      .select("*")
      .order("created_at", { ascending: false });

    if (labelError) setMessage(`Error leyendo piece_labels: ${labelError.message}`);
    if (eventError) setMessage(`Error leyendo piece_tracking_history: ${eventError.message}`);

    setLabels((labelData || []) as PieceLabel[]);
    setEvents((eventData || []) as PieceTrackingEvent[]);
    setLoading(false);
  }

  const labelCodeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const label of labels) {
      const code = label.label_code || "";
      if (!code) continue;
      counts.set(code, (counts.get(code) || 0) + 1);
    }
    return counts;
  }, [labels]);

  const eventMap = useMemo(() => {
    const map = new Map<string, PieceTrackingEvent[]>();

    for (const event of events) {
      const payload = (event.payload || {}) as Record<string, any>;
      const key = payload.piece_label_id || event.label_code || event.piece_code || "";
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }

    for (const [key, list] of map.entries()) {
      map.set(
        key,
        [...list].sort((a, b) => {
          const da = new Date(a.scanned_at || a.created_at || 0).getTime();
          const db = new Date(b.scanned_at || b.created_at || 0).getTime();
          return db - da;
        })
      );
    }

    return map;
  }, [events]);

  const enrichedLabels = useMemo<EnrichedPiece[]>(() => {
    return labels.map((label) => {
      const codeIsUnique = (labelCodeCounts.get(label.label_code || "") || 0) <= 1;
      const history = eventMap.get(label.id) || (codeIsUnique ? eventMap.get(label.label_code) : []) || [];
      const lastEvent = history[0] || null;
      const currentStatus = normalizeStatus(label.current_status || lastEvent?.new_status || "pendiente");

      return {
        ...label,
        current_status: currentStatus,
        last_event: lastEvent,
        history,
      };
    });
  }, [labels, eventMap, labelCodeCounts]);

  const orders = useMemo(() => {
    const set = new Set<string>();
    enrichedLabels.forEach((label) => {
      if (label.order_code) set.add(label.order_code);
    });
    return Array.from(set).sort();
  }, [enrichedLabels]);

  const filteredLabels = useMemo(() => {
    const term = search.trim().toLowerCase();

    return enrichedLabels.filter((label) => {
      const status = normalizeStatus(label.current_status);
      const matchesStatus = statusFilter === "todos" || status === normalizeStatus(statusFilter);
      const matchesOrder = orderFilter === "todos" || label.order_code === orderFilter;

      const matchesSearch =
        !term ||
        [
          label.label_code,
          label.order_code,
          label.client_name,
          label.project_name,
          label.module_name,
          label.piece_name,
          label.material_name,
          label.edge_detail,
          label.last_event?.operator_name,
          label.last_event?.department,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);

      return matchesStatus && matchesOrder && matchesSearch;
    });
  }, [enrichedLabels, search, statusFilter, orderFilter]);

  const moduleGroups = useMemo<ModuleGroup[]>(() => {
    const map = new Map<string, ModuleGroup>();

    for (const piece of filteredLabels) {
      const key = moduleKey(piece.order_code, piece.module_name);

      if (!map.has(key)) {
        map.set(key, {
          key,
          order_code: piece.order_code || "SIN-ORDEN",
          production_order_id: piece.production_order_id || null,
          client_name: piece.client_name || "Cliente general",
          project_name: piece.project_name || "",
          module_name: piece.module_name || "Sin módulo",
          pieces: [],
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
          readyForAssembly: 0,
          progress: 0,
          statusLabel: "Pendiente",
          lastEvent: null,
        });
      }

      map.get(key)!.pieces.push(piece);
    }

    const groups = Array.from(map.values()).map((group) => {
      group.pieces.sort((a, b) => String(a.label_code || "").localeCompare(String(b.label_code || ""), "es"));
      group.total = group.pieces.length;
      group.pending = group.pieces.filter((p) => normalizeStatus(p.current_status) === "pendiente").length;
      group.inProcess = group.pieces.filter((p) => PROCESS_STATES.has(normalizeStatus(p.current_status))).length;
      group.cut = group.pieces.filter((p) => ["cortada", "canteada", "perforada", "cnc", "ensamblada", "empacada", "transportada", "instalada", "entregada"].includes(normalizeStatus(p.current_status))).length;
      group.edged = group.pieces.filter((p) => ["canteada", "perforada", "cnc", "ensamblada", "empacada", "transportada", "instalada", "entregada"].includes(normalizeStatus(p.current_status))).length;
      group.drilled = group.pieces.filter((p) => ["perforada", "cnc", "ensamblada", "empacada", "transportada", "instalada", "entregada"].includes(normalizeStatus(p.current_status))).length;
      group.cnc = group.pieces.filter((p) => ["cnc", "ensamblada", "empacada", "transportada", "instalada", "entregada"].includes(normalizeStatus(p.current_status))).length;
      group.assembled = group.pieces.filter((p) => ["ensamblada", "empacada", "transportada", "instalada", "entregada"].includes(normalizeStatus(p.current_status))).length;
      group.packed = group.pieces.filter((p) => ["empacada", "transportada", "instalada", "entregada"].includes(normalizeStatus(p.current_status))).length;
      group.transported = group.pieces.filter((p) => ["transportada", "instalada", "entregada"].includes(normalizeStatus(p.current_status))).length;
      group.installed = group.pieces.filter((p) => ["instalada", "entregada"].includes(normalizeStatus(p.current_status))).length;
      group.delivered = group.pieces.filter((p) => normalizeStatus(p.current_status) === "entregada").length;
      group.readyForAssembly = group.pieces.filter((p) => READY_ASSEMBLY_STATES.has(normalizeStatus(p.current_status))).length;

      const totalScore = group.pieces.reduce((acc, p) => acc + statusIndex(p.current_status), 0);
      const maxScore = Math.max(1, group.total * (STATUS_FLOW.length - 1));
      group.progress = Math.round((totalScore / maxScore) * 100);

      const allDelivered = group.delivered === group.total && group.total > 0;
      const allInstalled = group.installed === group.total && group.total > 0;
      const allTransported = group.transported === group.total && group.total > 0;
      const allPacked = group.packed === group.total && group.total > 0;
      const allAssembled = group.assembled === group.total && group.total > 0;
      const readyAssembly = group.readyForAssembly === group.total && group.total > 0;

      if (allDelivered) group.statusLabel = "Entregado";
      else if (allInstalled) group.statusLabel = "Instalado";
      else if (allTransported) group.statusLabel = "Transportado";
      else if (allPacked) group.statusLabel = "Empacado";
      else if (allAssembled) group.statusLabel = "Ensamblado";
      else if (readyAssembly) group.statusLabel = "Listo ensamblado";
      else if (group.inProcess > 0) group.statusLabel = "En proceso";
      else group.statusLabel = "Pendiente";

      const allEvents = group.pieces
        .flatMap((p) => p.history || [])
        .sort((a, b) => {
          const da = new Date(a.scanned_at || a.created_at || 0).getTime();
          const db = new Date(b.scanned_at || b.created_at || 0).getTime();
          return db - da;
        });

      group.lastEvent = allEvents[0] || null;
      return group;
    });

    return groups.sort((a, b) => a.order_code.localeCompare(b.order_code, "es") || a.module_name.localeCompare(b.module_name, "es"));
  }, [filteredLabels]);

  const selectedModule = moduleGroups.find((m) => m.key === selectedModuleKey) || moduleGroups[0] || null;

  useEffect(() => {
    if (!selectedModuleKey && moduleGroups[0]?.key) {
      setSelectedModuleKey(moduleGroups[0].key);
      setExpandedModules((prev) => ({ ...prev, [moduleGroups[0].key]: true }));
    }
  }, [moduleGroups, selectedModuleKey]);

  const selectedHistory = useMemo(() => {
    if (!selectedLabel) return [];
    const codeIsUnique = (labelCodeCounts.get(selectedLabel.label_code || "") || 0) <= 1;
    return eventMap.get(selectedLabel.id) || (codeIsUnique ? eventMap.get(selectedLabel.label_code) : []) || [];
  }, [selectedLabel, eventMap, labelCodeCounts]);

  const selectedModuleHistory = useMemo(() => {
    if (!selectedModule) return [];

    return selectedModule.pieces
      .flatMap((piece) => piece.history || [])
      .sort((a, b) => {
        const da = new Date(a.scanned_at || a.created_at || 0).getTime();
        const db = new Date(b.scanned_at || b.created_at || 0).getTime();
        return db - da;
      })
      .slice(0, 40);
  }, [selectedModule]);

  const stats = useMemo(() => {
    const total = enrichedLabels.length;
    const delivered = enrichedLabels.filter((l) => normalizeStatus(l.current_status) === "entregada").length;
    const installed = enrichedLabels.filter((l) => normalizeStatus(l.current_status) === "instalada").length;
    const inProcess = enrichedLabels.filter((l) => PROCESS_STATES.has(normalizeStatus(l.current_status))).length;
    const pending = enrichedLabels.filter((l) => normalizeStatus(l.current_status) === "pendiente").length;

    return {
      total,
      modules: moduleGroups.length,
      pending,
      inProcess,
      installed,
      delivered,
      events: events.length,
    };
  }, [enrichedLabels, moduleGroups.length, events.length]);

  function toggleModule(key: string) {
    setExpandedModules((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function selectModule(module: ModuleGroup) {
    setSelectedModuleKey(module.key);
    setExpandedModules((prev) => ({ ...prev, [module.key]: true }));
    setBulkToolsOpen(false);
    setSelectedLabel(null);
  }

  function selectPiece(module: ModuleGroup, piece: EnrichedPiece) {
    setSelectedModuleKey(module.key);
    setExpandedModules((prev) => ({ ...prev, [module.key]: true }));
    setBulkToolsOpen(false);
    setSelectedLabel(piece);
  }

  async function changeSelectedStatus(nextStatus: string) {
    if (!selectedLabel) return;

    const pieceId = selectedLabel.id;
    const previousStatus = normalizeStatus(selectedLabel.current_status);
    const labelCode = selectedLabel.label_code;

    setMessage("");

    const { error: labelError } = await supabase
      .from("piece_labels")
      .update({ current_status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", pieceId);

    if (labelError) {
      setMessage(`Error actualizando pieza: ${labelError.message}`);
      return;
    }

    const { error: historyError } = await supabase.from("piece_tracking_history").insert({
      piece_code: labelCode,
      label_code: labelCode,
      order_code: selectedLabel.order_code,
      production_order_id: selectedLabel.production_order_id || null,
      piece_name: selectedLabel.piece_name || "",
      module_name: selectedLabel.module_name || "",
      previous_status: previousStatus,
      new_status: nextStatus,
      department: nextStatus,
      operator_name: "Sistema / Supervisor",
      notes: `Cambio manual desde Dashboard FASE 36: ${previousStatus} -> ${nextStatus}`,
      payload: { piece_label_id: pieceId, label_code: labelCode, order_code: selectedLabel.order_code, source: "fase_36_dashboard_modular" },
      scanned_at: new Date().toISOString(),
    });

    if (historyError) {
      setMessage(`Pieza actualizada, pero falló historial: ${historyError.message}`);
      await loadData();
      return;
    }

    setMessage(`✅ Pieza ${labelCode} actualizada a ${STATUS_LABELS[nextStatus] || nextStatus}`);
    await loadData();
    setSelectedLabel((prev) => (prev ? { ...prev, current_status: nextStatus, updated_at: new Date().toISOString() } : prev));
  }

  async function changeModuleStatus(module: ModuleGroup, nextStatus: string) {
    const ok = window.confirm(`¿Cambiar TODAS las piezas del módulo "${module.module_name}" a ${STATUS_LABELS[nextStatus] || nextStatus}?`);
    if (!ok) return;

    setMessage("");

    const ids = module.pieces.map((p) => p.id);
    const now = new Date().toISOString();

    const { error: labelError } = await supabase
      .from("piece_labels")
      .update({ current_status: nextStatus, updated_at: now })
      .in("id", ids);

    if (labelError) {
      setMessage(`Error actualizando módulo: ${labelError.message}`);
      return;
    }

    const historyRows = module.pieces.map((piece) => ({
      piece_code: piece.label_code,
      label_code: piece.label_code,
      order_code: piece.order_code,
      production_order_id: piece.production_order_id || null,
      piece_name: piece.piece_name || "",
      module_name: piece.module_name || module.module_name,
      previous_status: normalizeStatus(piece.current_status),
      new_status: nextStatus,
      department: `modulo_${nextStatus}`,
      operator_name: "Sistema / Supervisor",
      notes: `Cambio masivo por módulo desde Dashboard FASE 36: ${module.module_name}`,
      payload: {
        piece_label_id: piece.id,
        label_code: piece.label_code,
        order_code: piece.order_code,
        module_name: module.module_name,
        source: "fase_36_dashboard_module_group",
      },
      scanned_at: now,
    }));

    const { error: historyError } = await supabase.from("piece_tracking_history").insert(historyRows);

    if (historyError) {
      setMessage(`Módulo actualizado, pero falló historial: ${historyError.message}`);
      await loadData();
      return;
    }

    setMessage(`✅ Módulo ${module.module_name} actualizado a ${STATUS_LABELS[nextStatus] || nextStatus}`);
    await loadData();
  }

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-[1900px]">
        <section className="rounded-[34px] border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-[#07111f] to-blue-950 p-7 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
                FASE 36 · Dashboard de Trazabilidad Modular
              </div>

              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">Trazabilidad de Piezas PRO</h1>

              <p className="mt-3 max-w-4xl text-sm font-semibold text-slate-300 md:text-base">
                Agrupado por módulo: piezas, avance, estados, historial y control QR industrial.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase text-slate-950 hover:bg-cyan-100"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              Actualizar
            </button>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm font-black text-cyan-100">
            {message}
          </div>
        )}

        <section className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-7">
          <StatCard title="Módulos" value={stats.modules} icon={<Boxes />} />
          <StatCard title="Piezas" value={stats.total} icon={<QrCode />} />
          <StatCard title="Pendientes" value={stats.pending} icon={<Clock3 />} />
          <StatCard title="En proceso" value={stats.inProcess} icon={<Factory />} />
          <StatCard title="Instaladas" value={stats.installed} icon={<PackageCheck />} />
          <StatCard title="Entregadas" value={stats.delivered} icon={<CheckCircle2 />} />
          <StatCard title="Eventos" value={stats.events} icon={<Activity />} />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_560px]">
          <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5 shadow-2xl shadow-black/30">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-2xl font-black">Módulos registrados</h2>
                <p className="text-sm font-semibold text-slate-400">
                  Agrupa desde <code>piece_labels</code> por <code>order_code</code> + <code>module_name</code>.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar módulo, pieza, orden, cliente..."
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-4 pl-12 pr-4 text-sm font-black text-white outline-none focus:border-cyan-400 md:w-[360px]"
                  />
                </div>

                <select
                  value={orderFilter}
                  onChange={(e) => setOrderFilter(e.target.value)}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-400"
                >
                  <option value="todos">Todas las órdenes</option>
                  {orders.map((order) => (
                    <option key={order} value={order}>{order}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-400"
                >
                  <option value="todos">Todos los estados</option>
                  {STATUS_FLOW.map((status) => (
                    <option key={status} value={status}>{STATUS_LABELS[status] || status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-3xl border border-slate-800">
              <div className="grid grid-cols-[42px_1.3fr_0.9fr_0.8fr_0.8fr_140px] gap-0 bg-slate-950 px-4 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                <div></div><div>Módulo / Proyecto</div><div>Orden / Cliente</div><div>Avance</div><div>Resumen</div><div className="text-right">Estado</div>
              </div>

              {loading ? (
                <div className="flex h-80 items-center justify-center"><Loader2 className="animate-spin text-cyan-300" size={50} /></div>
              ) : moduleGroups.length === 0 ? (
                <div className="flex h-80 flex-col items-center justify-center text-center">
                  <Boxes className="text-slate-700" size={64} />
                  <h3 className="mt-4 text-2xl font-black">Sin módulos</h3>
                  <p className="mt-2 text-sm text-slate-400">Genera etiquetas QR desde Optimización de Corte.</p>
                </div>
              ) : (
                <div className="max-h-[780px] overflow-y-auto">
                  {moduleGroups.map((module) => {
                    const expanded = Boolean(expandedModules[module.key]);
                    const active = selectedModule?.key === module.key;

                    return (
                      <div key={module.key} className="border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => selectModule(module)}
                          className={["grid w-full grid-cols-[42px_1.3fr_0.9fr_0.8fr_0.8fr_140px] items-center gap-0 px-4 py-4 text-left transition", active ? "bg-cyan-500/10" : "bg-[#07111f] hover:bg-slate-900/70"].join(" ")}
                        >
                          <div>
                            <span
                              onClick={(e) => { e.stopPropagation(); toggleModule(module.key); }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-cyan-300 hover:border-cyan-400"
                            >
                              {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </span>
                          </div>

                          <div>
                            <div className="text-base font-black text-white">{module.module_name}</div>
                            <div className="mt-1 truncate text-xs font-semibold text-slate-400">{module.project_name || "Proyecto"}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <MiniMetric label="Piezas" value={module.total} />
                              <MiniMetric label="Listas" value={`${module.readyForAssembly}/${module.total}`} />
                            </div>
                          </div>

                          <div>
                            <div className="text-sm font-black text-cyan-300">{module.order_code}</div>
                            <div className="mt-1 text-xs font-semibold text-slate-400">{module.client_name}</div>
                          </div>

                          <div>
                            <div className="flex items-center gap-3">
                              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-800">
                                <div className="h-full rounded-full bg-cyan-400" style={{ width: `${module.progress}%` }} />
                              </div>
                              <span className="w-12 text-right text-sm font-black text-cyan-300">{module.progress}%</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">Último: {formatDate(module.lastEvent?.scanned_at || module.lastEvent?.created_at)}</div>
                          </div>

                          <div>
                            <div className="grid grid-cols-2 gap-1 text-[11px] font-bold text-slate-300">
                              <span>Corte: {module.cut}/{module.total}</span>
                              <span>Canto: {module.edged}/{module.total}</span>
                              <span>Perf.: {module.drilled}/{module.total}</span>
                              <span>Arm.: {module.assembled}/{module.total}</span>
                            </div>
                          </div>

                          <div className="text-right"><StatusPill value={module.statusLabel} /></div>
                        </button>

                        {expanded && (
                          <div className="border-t border-slate-800 bg-slate-950/50 px-4 py-3">
                            <div className="grid grid-cols-[1.25fr_0.9fr_0.8fr_0.8fr_120px] bg-slate-950 px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                              <div>Pieza</div><div>Medida</div><div>Material</div><div>Último evento</div><div className="text-right">Estado</div>
                            </div>

                            {module.pieces.map((piece) => (
                              <button
                                key={piece.id}
                                type="button"
                                onClick={() => selectPiece(module, piece)}
                                className={["grid w-full grid-cols-[1.25fr_0.9fr_0.8fr_0.8fr_120px] items-center border-t border-slate-800 px-3 py-3 text-left transition", selectedLabel?.id === piece.id ? "bg-cyan-500/10" : "hover:bg-slate-900"].join(" ")}
                              >
                                <div><div className="text-sm font-black text-cyan-300">{piece.label_code}</div><div className="mt-1 text-sm font-black text-white">{piece.piece_name || "Pieza"}</div></div>
                                <div className="text-xs font-bold text-slate-300">{Number(piece.width_mm || 0)} x {Number(piece.height_mm || 0)} x {Number(piece.thickness_mm || 18)} mm</div>
                                <div><div className="truncate text-xs font-bold text-slate-300">{piece.material_name || "Material"}</div><div className="mt-1 truncate text-xs text-slate-500">{piece.edge_detail || "Canto N/D"}</div></div>
                                <div><div className="text-xs font-black text-white">{piece.last_event?.department || "Sin evento"}</div><div className="mt-1 text-[11px] text-slate-500">{formatDate(piece.last_event?.created_at || piece.updated_at)}</div></div>
                                <div className="text-right"><StatusPill value={piece.current_status} /></div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5 shadow-2xl shadow-black/30">
            {!selectedModule ? (
              <div className="flex min-h-[760px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
                <Filter className="text-slate-700" size={70} />
                <h3 className="mt-5 text-2xl font-black">Selecciona un módulo</h3>
                <p className="mt-2 max-w-sm text-sm text-slate-400">Verás resumen del módulo, piezas internas, historial y cambios de estado.</p>
              </div>
            ) : (
              <div>
                <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Módulo seleccionado</div>
                      <h2 className="mt-2 text-3xl font-black">{selectedModule.module_name}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-300">{selectedModule.project_name || "Proyecto"}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{selectedModule.client_name} · {selectedModule.order_code}</p>
                    </div>
                    <QrCode className="text-cyan-300" size={44} />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <InfoBox title="Piezas" value={`${selectedModule.total}`} />
                    <InfoBox title="Avance" value={`${selectedModule.progress}%`} />
                    <InfoBox title="Pendientes" value={`${selectedModule.pending}`} />
                    <InfoBox title="Listas ensamblado" value={`${selectedModule.readyForAssembly}/${selectedModule.total}`} />
                    <InfoBox title="Instaladas" value={`${selectedModule.installed}/${selectedModule.total}`} />
                    <InfoBox title="Estado" value={selectedModule.statusLabel} />
                  </div>
                </div>

                {!selectedLabel && (
                  <div className="mt-5 rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                    <div className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Actualizar una sola pieza</div>
                    <h3 className="mt-2 text-xl font-black">Selecciona una pieza del modulo</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-300">
                      Abre el modulo en la tabla y toca la pieza exacta. Entonces apareceran los botones "Solo pieza".
                    </p>
                  </div>
                )}

                <div className="mt-5 rounded-3xl border border-amber-500/20 bg-amber-950/20 p-5">
                  <h3 className="text-xl font-black">Actualizar módulo completo</h3>
                  <p className="mt-1 text-sm text-slate-400">Accion masiva: aplica un estado a todas las piezas internas del modulo.</p>
                  <button
                    type="button"
                    onClick={() => setBulkToolsOpen((open) => !open)}
                    className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100 transition hover:border-amber-300/70"
                  >
                    {bulkToolsOpen ? "Ocultar acciones Todo" : "Mostrar acciones Todo"}
                  </button>

                  {bulkToolsOpen && <div className="mt-4 grid grid-cols-2 gap-3">
                    {STATUS_FLOW.map((status) => (
                      <button key={status} type="button" onClick={() => changeModuleStatus(selectedModule, status)} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100 transition hover:border-amber-300/70">
                        Todo: {STATUS_LABELS[status] || status}
                      </button>
                    ))}
                  </div>}
                </div>

                {selectedLabel && (
                  <div className="mt-5 rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                    <div className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Pieza seleccionada</div>
                    <h3 className="mt-2 text-2xl font-black">{selectedLabel.label_code}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-300">{selectedLabel.piece_name || "Pieza"}</p>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <InfoBox title="Estado" value={STATUS_LABELS[normalizeStatus(selectedLabel.current_status)] || selectedLabel.current_status || "pendiente"} />
                      <InfoBox title="Medida" value={`${Number(selectedLabel.width_mm || 0)} x ${Number(selectedLabel.height_mm || 0)} x ${Number(selectedLabel.thickness_mm || 18)} mm`} />
                      <InfoBox title="Material" value={selectedLabel.material_name || "—"} />
                      <InfoBox title="Canto" value={selectedLabel.edge_detail || "—"} />
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {STATUS_FLOW.map((status) => (
                        <button key={status} type="button" onClick={() => changeSelectedStatus(status)} className={["rounded-2xl border px-4 py-3 text-sm font-black transition", normalizeStatus(selectedLabel.current_status) === status ? "border-cyan-400 bg-cyan-400/20 text-cyan-100" : "border-slate-700 bg-[#020617] text-slate-300 hover:border-cyan-400/50"].join(" ")}>
                          Solo pieza: {STATUS_LABELS[status] || status}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-950 p-5">
                  <h3 className="text-xl font-black">{selectedLabel ? "Timeline de pieza" : "Timeline del módulo"}</h3>
                  <p className="mt-1 text-sm text-slate-400">Historial auditable completo por QR.</p>

                  <div className="mt-5 max-h-[520px] space-y-4 overflow-auto pr-1">
                    {(selectedLabel ? selectedHistory : selectedModuleHistory).length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">Sin eventos todavía.</div>
                    ) : (
                      (selectedLabel ? selectedHistory : selectedModuleHistory).map((event) => (
                        <div key={event.id} className="rounded-2xl border border-slate-800 bg-[#020617] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-black text-white">{STATUS_LABELS[normalizeStatus(event.new_status)] || event.new_status}</div>
                              <div className="mt-1 text-xs font-semibold text-slate-500">{formatDate(event.scanned_at || event.created_at)}</div>
                              <div className="mt-1 text-xs font-bold text-cyan-300">{event.label_code || event.piece_code}</div>
                            </div>
                            <StatusPill value={event.new_status} />
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-xl bg-slate-900 p-3"><div className="font-black uppercase text-slate-500">Depto.</div><div className="mt-1 font-bold text-slate-200">{event.department || "—"}</div></div>
                            <div className="rounded-xl bg-slate-900 p-3"><div className="font-black uppercase text-slate-500">Operador</div><div className="mt-1 font-bold text-slate-200">{event.operator_name || "—"}</div></div>
                          </div>

                          {event.notes && <p className="mt-3 rounded-xl bg-slate-900 p-3 text-xs font-semibold text-slate-300">{event.notes}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-[26px] border border-slate-800 bg-[#07111f] p-5 shadow-2xl shadow-black/30">
      <div className="flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{title}</div>
        <div className="text-cyan-300">{icon}</div>
      </div>
      <div className="mt-4 text-3xl font-black text-white">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
      {label}: <span className="text-cyan-300">{value}</span>
    </span>
  );
}

function StatusPill({ value }: { value?: string | null }) {
  const status = normalizeStatus(value);
  const label = STATUS_LABELS[status] || value || status;
  const isDone = ["instalada", "entregada", "entregado", "instalado"].includes(status);
  const isProcess = PROCESS_STATES.has(status) || ["en proceso", "en_proceso", "listo ensamblado", "listo_transporte"].includes(status);

  return (
    <span className={["inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-[11px] font-black uppercase", isDone ? "bg-emerald-500/15 text-emerald-300" : isProcess ? "bg-cyan-500/15 text-cyan-300" : "bg-slate-700/40 text-slate-300"].join(" ")}>
      {isDone ? <CheckCircle2 size={13} /> : isProcess ? <BadgeCheck size={13} /> : <Clock3 size={13} />}
      {label}
    </span>
  );
}

function InfoBox({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-2 truncate text-sm font-black text-white">{value}</div>
    </div>
  );
}
