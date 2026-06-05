"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock3,
  Factory,
  History,
  Keyboard,
  Loader2,
  PackageCheck,
  QrCode,
  RefreshCw,
  Save,
  ScanLine,
  Search,
  ShieldCheck,
  Smartphone,
  Truck,
  UserRound,
  X,
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
  scanned_at?: string | null;
  created_at?: string | null;
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

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalizeStatus(value?: string | null) {
  const status = clean(value).toLowerCase();
  return status || "pendiente";
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

function parseQrText(raw: string) {
  const text = clean(raw);
  if (!text) return "";

  try {
    const json = JSON.parse(text);
    return clean(
      json.label_code ||
        json.piece_code ||
        json.code ||
        json.label ||
        json.pieza ||
        json.piece ||
        text
    );
  } catch {
    const match =
      text.match(/label_code["']?\s*[:=]\s*["']?([A-Z0-9\-_]+)/i) ||
      text.match(/piece_code["']?\s*[:=]\s*["']?([A-Z0-9\-_]+)/i) ||
      text.match(/(LBL-[A-Z0-9\-_]+)/i) ||
      text.match(/(OP-[A-Z0-9\-_]+-PZ-\d+)/i);

    return clean(match?.[1] || text);
  }
}

export default function QRScannerPage() {
  const [manualCode, setManualCode] = useState("");
  const [piece, setPiece] = useState<PieceLabel | null>(null);
  const [history, setHistory] = useState<PieceTrackingEvent[]>([]);
  const [nextStatus, setNextStatus] = useState("canteada");
  const [operatorName, setOperatorName] = useState("Operador Planta");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [lastScan, setLastScan] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const currentStatus = normalizeStatus(piece?.current_status);

  const nextRecommended = useMemo(() => {
    const index = STATUS_FLOW.indexOf(currentStatus);
    if (index >= 0 && index < STATUS_FLOW.length - 1) {
      return STATUS_FLOW[index + 1];
    }
    return "entregada";
  }, [currentStatus]);

  useEffect(() => {
    if (piece) setNextStatus(nextRecommended);
  }, [piece, nextRecommended]);

  async function loadPieceByCode(input: string) {
    const labelCode = parseQrText(input);

    if (!labelCode) {
      setMessage("Escribe o escanea un código de etiqueta.");
      return;
    }

    setLoading(true);
    setMessage("");
    setPiece(null);
    setHistory([]);

    const { data, error } = await supabase
      .from("piece_labels")
      .select("*")
      .ilike("label_code", labelCode)
      .maybeSingle();

    if (error) {
      setMessage(`Error buscando pieza: ${error.message}`);
      setLoading(false);
      return;
    }

    if (!data) {
      setMessage(`No encontré la pieza: ${labelCode}`);
      setLoading(false);
      return;
    }

    setPiece(data as PieceLabel);
    setManualCode((data as PieceLabel).label_code);
    await loadHistory((data as PieceLabel).label_code);
    setLoading(false);
  }

  async function loadHistory(labelCode: string) {
    const { data, error } = await supabase
      .from("piece_tracking_history")
      .select("*")
      .or(`label_code.eq.${labelCode},piece_code.eq.${labelCode}`)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Pieza encontrada, pero falló historial: ${error.message}`);
      return;
    }

    setHistory((data || []) as PieceTrackingEvent[]);
  }

  async function saveStatus() {
    if (!piece) return;

    setSaving(true);
    setMessage("");

    const previousStatus = normalizeStatus(piece.current_status);
    const newStatus = normalizeStatus(nextStatus);

    const { error: labelError } = await supabase
      .from("piece_labels")
      .update({
        current_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("label_code", piece.label_code);

    if (labelError) {
      setMessage(`Error actualizando pieza: ${labelError.message}`);
      setSaving(false);
      return;
    }

    const { error: historyError } = await supabase.from("piece_tracking_history").insert({
      piece_code: piece.label_code,
      label_code: piece.label_code,
      order_code: piece.order_code,
      production_order_id: piece.production_order_id || null,
      piece_name: piece.piece_name || "",
      module_name: piece.module_name || "",
      previous_status: previousStatus,
      new_status: newStatus,
      department: newStatus,
      operator_name: operatorName || "Operador Planta",
      notes:
        notes ||
        `Escaneo QR FASE 37: ${STATUS_LABELS[previousStatus] || previousStatus} → ${
          STATUS_LABELS[newStatus] || newStatus
        }`,
      payload: {
        label_code: piece.label_code,
        order_code: piece.order_code,
        source: "fase_37_qr_scanner",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      },
      scanned_at: new Date().toISOString(),
      device_name: "Web / Cámara",
      scan_source: "qr_scanner",
    });

    if (historyError) {
      setMessage(`Pieza actualizada, pero falló historial: ${historyError.message}`);
      setSaving(false);
      return;
    }

    const updatedPiece = { ...piece, current_status: newStatus, updated_at: new Date().toISOString() };
    setPiece(updatedPiece);
    await loadHistory(piece.label_code);
    setNotes("");
    setMessage(`✅ ${piece.label_code} actualizada a ${STATUS_LABELS[newStatus] || newStatus}`);
    setSaving(false);
  }

  async function startCamera() {
    setCameraError("");
    setMessage("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Este navegador no permite usar cámara. Usa Chrome o Edge.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      startNativeDetectorLoop();
    } catch (error: any) {
      setCameraError(error?.message || "No se pudo activar la cámara.");
    }
  }

  function stopCamera() {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  function startNativeDetectorLoop() {
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);

    scanTimerRef.current = setInterval(async () => {
      try {
        const BarcodeDetectorClass = (window as any).BarcodeDetector;

        if (!BarcodeDetectorClass) {
          setCameraError(
            "Tu navegador no tiene BarcodeDetector. Usa entrada manual o Chrome/Edge actualizado."
          );
          return;
        }

        const detector = new BarcodeDetectorClass({
          formats: ["qr_code", "code_128", "code_39"],
        });

        if (!videoRef.current || videoRef.current.readyState < 2) return;

        const codes = await detector.detect(videoRef.current);

        if (!codes?.length) return;

        const raw = clean(codes[0]?.rawValue);
        if (!raw || raw === lastScan) return;

        setLastScan(raw);
        const labelCode = parseQrText(raw);
        setManualCode(labelCode);
        await loadPieceByCode(labelCode);
        stopCamera();
      } catch (error: any) {
        console.warn("QR scan error:", error);
      }
    }, 800);
  }

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-5 text-white md:px-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="rounded-[32px] border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-[#07111f] to-blue-950 p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.34em] text-cyan-300">
                FASE 37 · Escáner QR en tiempo real
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
                Escáner QR de Producción
              </h1>
              <p className="mt-3 max-w-4xl text-sm font-semibold text-slate-300 md:text-base">
                Escanea etiquetas Zebra, actualiza estados y registra historial auditable por pieza.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={cameraActive ? stopCamera : startCamera}
                className="inline-flex items-center gap-3 rounded-2xl bg-cyan-400 px-5 py-4 text-sm font-black uppercase text-slate-950 hover:bg-cyan-300"
              >
                <Camera size={18} />
                {cameraActive ? "Detener cámara" : "Activar cámara"}
              </button>

              <a
                href="/trazabilidad-piezas"
                className="inline-flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4 text-sm font-black uppercase text-white hover:border-cyan-400"
              >
                <History size={18} />
                Ver trazabilidad
              </a>
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm font-black text-cyan-100">
            {message}
          </div>
        )}

        {cameraError && (
          <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-sm font-black text-amber-100">
            ⚠️ {cameraError}
          </div>
        )}

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[520px_1fr]">
          <div className="space-y-6">
            <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5 shadow-2xl shadow-black/30">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Captura QR</h2>
                  <p className="text-sm font-semibold text-slate-400">
                    Cámara o entrada manual.
                  </p>
                </div>
                <ScanLine className="text-cyan-300" size={44} />
              </div>

              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
                <video
                  ref={videoRef}
                  className={[
                    "aspect-video w-full object-cover",
                    cameraActive ? "block" : "hidden",
                  ].join(" ")}
                  muted
                  playsInline
                />

                {!cameraActive && (
                  <div className="flex aspect-video flex-col items-center justify-center p-6 text-center">
                    <Smartphone className="text-slate-700" size={70} />
                    <h3 className="mt-4 text-xl font-black">Cámara detenida</h3>
                    <p className="mt-2 text-sm text-slate-400">
                      Activa cámara o escribe el código manualmente.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-950 p-4">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Código manual / QR
                </label>
                <div className="mt-3 flex gap-3">
                  <div className="relative flex-1">
                    <Keyboard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") loadPieceByCode(manualCode);
                      }}
                      placeholder="LBL-TEST-001"
                      className="w-full rounded-2xl border border-slate-700 bg-[#020617] py-4 pl-12 pr-4 text-sm font-black text-white outline-none focus:border-cyan-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => loadPieceByCode(manualCode)}
                    className="rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-950 hover:bg-cyan-100"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5 shadow-2xl shadow-black/30">
              <h2 className="text-2xl font-black">Operador</h2>
              <p className="text-sm font-semibold text-slate-400">
                Este dato queda guardado en el historial.
              </p>

              <input
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-400"
                placeholder="Nombre del operador"
              />
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5 shadow-2xl shadow-black/30">
            {!piece ? (
              <div className="flex min-h-[680px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
                <QrCode className="text-slate-700" size={90} />
                <h2 className="mt-6 text-3xl font-black">Escanea una pieza</h2>
                <p className="mt-2 max-w-md text-sm font-semibold text-slate-400">
                  El sistema mostrará los datos de la pieza y permitirá cambiar su estado.
                </p>
              </div>
            ) : (
              <div>
                <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                        Pieza escaneada
                      </div>
                      <h2 className="mt-2 text-4xl font-black">{piece.label_code}</h2>
                      <p className="mt-1 text-lg font-black text-white">{piece.piece_name}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-300">{piece.module_name}</p>
                    </div>
                    <StatusPill value={piece.current_status} />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <InfoBox title="Orden" value={piece.order_code} />
                    <InfoBox title="Cliente" value={piece.client_name || "—"} />
                    <InfoBox title="Proyecto" value={piece.project_name || "—"} />
                    <InfoBox
                      title="Medida"
                      value={`${Number(piece.width_mm || 0)} x ${Number(piece.height_mm || 0)} x ${Number(piece.thickness_mm || 18)} mm`}
                    />
                    <InfoBox title="Material" value={piece.material_name || "—"} />
                    <InfoBox title="Canto" value={piece.edge_detail || "—"} />
                    <InfoBox title="Cantidad" value={String(piece.quantity || 1)} />
                    <InfoBox title="Actualizado" value={formatDate(piece.updated_at)} />
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-950 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-black">Actualizar estado</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Estado recomendado:{" "}
                        <span className="font-black text-cyan-300">
                          {STATUS_LABELS[nextRecommended] || nextRecommended}
                        </span>
                      </p>
                    </div>
                    <ShieldCheck className="text-emerald-300" size={40} />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {STATUS_FLOW.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setNextStatus(status)}
                        className={[
                          "rounded-2xl border px-4 py-4 text-sm font-black transition",
                          nextStatus === status
                            ? "border-cyan-400 bg-cyan-400/20 text-cyan-100"
                            : "border-slate-700 bg-[#020617] text-slate-300 hover:border-cyan-400/50",
                        ].join(" ")}
                      >
                        {STATUS_LABELS[status] || status}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-5 h-28 w-full rounded-2xl border border-slate-700 bg-[#020617] p-4 text-sm font-semibold text-white outline-none focus:border-cyan-400"
                    placeholder="Nota opcional del proceso..."
                  />

                  <button
                    type="button"
                    onClick={saveStatus}
                    disabled={saving}
                    className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-6 py-5 text-sm font-black uppercase text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Guardar estado auditable
                  </button>
                </div>

                <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-950 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black">Historial reciente</h3>
                    <button
                      type="button"
                      onClick={() => loadHistory(piece.label_code)}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-black hover:border-cyan-400"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {history.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
                        Sin historial todavía.
                      </div>
                    ) : (
                      history.map((event) => (
                        <div key={event.id} className="rounded-2xl border border-slate-800 bg-[#020617] p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-black text-white">
                                {STATUS_LABELS[normalizeStatus(event.new_status)] || event.new_status}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {formatDate(event.scanned_at || event.created_at)}
                              </div>
                            </div>
                            <StatusPill value={event.new_status} />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded-xl bg-slate-900 p-3">
                              <div className="font-black uppercase text-slate-500">Depto.</div>
                              <div className="mt-1 font-bold text-slate-200">{event.department || "—"}</div>
                            </div>
                            <div className="rounded-xl bg-slate-900 p-3">
                              <div className="font-black uppercase text-slate-500">Operador</div>
                              <div className="mt-1 font-bold text-slate-200">{event.operator_name || "—"}</div>
                            </div>
                          </div>
                          {event.notes && (
                            <p className="mt-3 rounded-xl bg-slate-900 p-3 text-xs font-semibold text-slate-300">
                              {event.notes}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusPill({ value }: { value?: string | null }) {
  const status = normalizeStatus(value);
  const done = ["instalada", "entregada"].includes(status);
  const process = ["en_corte", "cortada", "canteada", "perforada", "cnc", "ensamblada", "empacada", "transportada"].includes(status);

  return (
    <span
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-[11px] font-black uppercase tracking-wide",
        done
          ? "bg-emerald-500/15 text-emerald-300"
          : process
            ? "bg-cyan-500/15 text-cyan-300"
            : "bg-slate-700/40 text-slate-300",
      ].join(" ")}
    >
      {done ? <CheckCircle2 size={14} /> : process ? <BadgeCheck size={14} /> : <Clock3 size={14} />}
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function InfoBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-2 truncate text-sm font-black text-white">{value}</div>
    </div>
  );
}
