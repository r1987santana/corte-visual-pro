"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardList,
  Loader2,
  PackageCheck,
  QrCode,
  RefreshCw,
  Save,
  Search,
  Smartphone,
  StopCircle,
  User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ProductionOrderItemAI = {
  id: string;
  production_order_id: string;
  item_type?: string | null;
  item_name?: string | null;
  material?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  depth_mm?: number | null;
  quantity?: number | null;
  unit?: string | null;
  status?: string | null;
  qr_code?: string | null;
};

type ProductionOrderAI = {
  id: string;
  order_code: string;
  project_name?: string | null;
  client_name?: string | null;
  project_type?: string | null;
  status?: string | null;
};

type TrackingRow = {
  id: string;
  production_order_id?: string | null;
  part_id?: string | null;
  current_status?: string | null;
  last_scanned_at?: string | null;
  last_scanned_by?: string | null;
  notes?: string | null;
};

const STATUS_OPTIONS = [
  "pendiente",
  "cortada",
  "canteada",
  "perforada",
  "ensamblada",
  "instalada",
  "entregada",
];

function n(value: any): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normal(value: any): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function statusLabel(status?: string | null): string {
  const s = normal(status);
  if (s === "pendiente") return "Pendiente";
  if (s === "cortada" || s === "cortado") return "Cortada";
  if (s === "canteada" || s === "canteado") return "Canteada";
  if (s === "perforada" || s === "perforado") return "Perforada";
  if (s === "ensamblada" || s === "ensamblado") return "Ensamblada";
  if (s === "instalada" || s === "instalado") return "Instalada";
  if (s === "entregada" || s === "entregado") return "Entregada";
  if (s === "faltante") return "Faltante";
  return status || "Pendiente";
}

function statusClass(status?: string | null): string {
  const s = normal(status);
  if (s.includes("entreg") || s.includes("instal")) return "border-emerald-400 bg-emerald-500/20 text-emerald-200";
  if (s.includes("ensam") || s.includes("perfor") || s.includes("cant") || s.includes("cort")) return "border-cyan-400 bg-cyan-500/20 text-cyan-200";
  if (s.includes("faltante")) return "border-red-400 bg-red-500/20 text-red-200";
  return "border-amber-400 bg-amber-500/20 text-amber-200";
}

function parseQr(value: string): any | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    const lines = raw.split("\n").map((x) => x.trim()).filter(Boolean);
    const obj: any = { raw };
    lines.forEach((line) => {
      const idx = line.indexOf(":");
      if (idx > -1) {
        const key = line.slice(0, idx).trim().toLowerCase();
        obj[key] = line.slice(idx + 1).trim();
      }
    });
    return obj;
  }
}

function qrOrderCode(parsed: any): string {
  return parsed?.order_code || parsed?.op || parsed?.orden || parsed?.["orden"] || "";
}

function qrPieceName(parsed: any): string {
  return parsed?.piece || parsed?.pieza || parsed?.part_name || parsed?.item || parsed?.["pieza"] || "";
}

function qrProject(parsed: any): string {
  return parsed?.project || parsed?.proyecto || parsed?.project_name || parsed?.["proyecto"] || "";
}

function qrMaterial(parsed: any): string {
  return parsed?.material || parsed?.material_name || parsed?.["material"] || "";
}

function qrWidth(parsed: any): number {
  return n(parsed?.width_mm || parsed?.width || parsed?.ancho || parsed?.["ancho"]);
}

function qrHeight(parsed: any): number {
  return n(parsed?.height_mm || parsed?.height || parsed?.alto || parsed?.["alto"]);
}

function shortDate(value?: string | null): string {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("es-DO");
  } catch {
    return "-";
  }
}

export default function TallerMobilePage() {
  const [operatorName, setOperatorName] = useState("");
  const [qrText, setQrText] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("cortada");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [item, setItem] = useState<ProductionOrderItemAI | null>(null);
  const [order, setOrder] = useState<ProductionOrderAI | null>(null);
  const [tracking, setTracking] = useState<TrackingRow | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [lastScan, setLastScan] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const parsedQr = useMemo(() => parseQr(qrText), [qrText]);

  async function stopCamera() {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setCameraActive(false);
  }

  async function startCamera() {
    setCameraError("");

    try {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;

      if (!BarcodeDetectorClass) {
        setCameraError("Este navegador no soporta BarcodeDetector. Usa lector QR normal y pega el texto aquí.");
        return;
      }

      const detector = new BarcodeDetectorClass({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);

      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;

        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length > 0) {
            const value = codes[0]?.rawValue || "";
            if (value && value !== lastScan) {
              setLastScan(value);
              setQrText(value);
              await stopCamera();
              setTimeout(() => searchByQr(value), 150);
            }
          }
        } catch {
          // Sin lectura en este frame.
        }
      }, 700);
    } catch (error: any) {
      setCameraError(error?.message || "No se pudo abrir la cámara.");
      await stopCamera();
    }
  }

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  async function loadTracking(foundItem: ProductionOrderItemAI, parsed: any) {
    try {
      const { data, error } = await supabase
        .from("piece_tracking")
        .select("*")
        .eq("part_id", foundItem.id)
        .maybeSingle();

      if (!error && data) {
        setTracking(data as TrackingRow);
        return;
      }

      const { data: inserted } = await supabase
        .from("piece_tracking")
        .insert({
          production_order_id: foundItem.production_order_id,
          part_id: foundItem.id,
          qr_code: foundItem.qr_code || qrText || JSON.stringify(parsed),
          project_name: qrProject(parsed) || order?.project_name || "",
          part_name: foundItem.item_name || qrPieceName(parsed),
          material_name: foundItem.material || qrMaterial(parsed),
          width: n(foundItem.width_mm) || qrWidth(parsed),
          height: n(foundItem.height_mm) || qrHeight(parsed),
          thickness: n(foundItem.depth_mm),
          current_status: foundItem.status || "pendiente",
          last_scanned_at: new Date().toISOString(),
          last_scanned_by: operatorName || "Operador",
          notes: "",
        })
        .select("*")
        .single();

      if (inserted) setTracking(inserted as TrackingRow);
    } catch {
      // No bloquea si la tabla de tracking todavía no existe.
    }
  }

  async function searchByQr(value = qrText) {
    const parsed = parseQr(value);

    if (!parsed) {
      alert("Escanea o pega un QR válido.");
      return;
    }

    const orderCode = qrOrderCode(parsed);
    const pieceName = qrPieceName(parsed);

    try {
      setLoading(true);
      setItem(null);
      setOrder(null);
      setTracking(null);

      let foundOrder: ProductionOrderAI | null = null;

      if (orderCode) {
        const { data: orderData, error: orderError } = await supabase
          .from("production_orders_ai")
          .select("*")
          .eq("order_code", orderCode)
          .maybeSingle();

        if (orderError) throw orderError;
        foundOrder = (orderData || null) as ProductionOrderAI | null;
        setOrder(foundOrder);
      }

      let foundItem: ProductionOrderItemAI | null = null;

      if (foundOrder?.id && pieceName) {
        const { data, error } = await supabase
          .from("production_order_ai_items")
          .select("*")
          .eq("production_order_id", foundOrder.id)
          .ilike("item_name", `%${pieceName}%`)
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        foundItem = (data || null) as ProductionOrderItemAI | null;
      }

      if (!foundItem && pieceName) {
        const { data, error } = await supabase
          .from("production_order_ai_items")
          .select("*")
          .ilike("item_name", `%${pieceName}%`)
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        foundItem = (data || null) as ProductionOrderItemAI | null;
      }

      if (!foundItem) {
        const lookup = pieceName || orderCode || qrProject(parsed);
        const { data, error } = await supabase
          .from("production_order_ai_items")
          .select("*")
          .ilike("qr_code", `%${lookup}%`)
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        foundItem = (data || null) as ProductionOrderItemAI | null;
      }

      if (!foundItem) {
        throw new Error("No encontré la pieza. Verifica que la OP fue creada y que el QR pertenece a esa orden.");
      }

      setItem(foundItem);

      if (!foundOrder && foundItem.production_order_id) {
        const { data: orderData } = await supabase
          .from("production_orders_ai")
          .select("*")
          .eq("id", foundItem.production_order_id)
          .maybeSingle();

        setOrder((orderData || null) as ProductionOrderAI | null);
      }

      await loadTracking(foundItem, parsed);
    } catch (error: any) {
      alert(error?.message || "Error buscando QR.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshOrderProgress(orderId: string) {
    try {
      const { data } = await supabase
        .from("production_order_ai_items")
        .select("status")
        .eq("production_order_id", orderId);

      const rows = data || [];
      if (!rows.length) return;

      const allDone = rows.every((x: any) => {
        const s = normal(x.status);
        return s.includes("instalada") || s.includes("entregada") || s.includes("terminada");
      });

      const anyStarted = rows.some((x: any) => {
        const s = normal(x.status);
        return s.includes("cort") || s.includes("cant") || s.includes("perfor") || s.includes("ensam") || s.includes("instal") || s.includes("entreg");
      });

      const newStatus = allDone ? "terminada" : anyStarted ? "en_produccion" : "pendiente";

      await supabase.from("production_orders_ai").update({ status: newStatus }).eq("id", orderId);
    } catch {
      // No bloquea.
    }
  }

  async function saveStatus() {
    if (!item) {
      alert("Primero busca una pieza con el QR.");
      return;
    }

    try {
      setSaving(true);

      const previousStatus = item.status || "pendiente";

      const { error: itemError } = await supabase
        .from("production_order_ai_items")
        .update({ status: selectedStatus })
        .eq("id", item.id);

      if (itemError) throw itemError;

      setItem({ ...item, status: selectedStatus });

      if (tracking?.id) {
        await supabase
          .from("piece_tracking")
          .update({
            current_status: selectedStatus,
            last_scanned_at: new Date().toISOString(),
            last_scanned_by: operatorName || "Operador",
            notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tracking.id);

        await supabase.from("piece_tracking_history").insert({
          tracking_id: tracking.id,
          previous_status: previousStatus,
          new_status: selectedStatus,
          scanned_by: operatorName || "Operador",
          notes,
        });

        setTracking({
          ...tracking,
          current_status: selectedStatus,
          last_scanned_at: new Date().toISOString(),
          last_scanned_by: operatorName || "Operador",
          notes,
        });
      }

      if (item.production_order_id) {
        await refreshOrderProgress(item.production_order_id);
      }

      alert(`✅ Pieza actualizada a: ${statusLabel(selectedStatus)}`);
    } catch (error: any) {
      alert(error?.message || "Error guardando estado.");
    } finally {
      setSaving(false);
    }
  }

  function clearAll() {
    setQrText("");
    setNotes("");
    setItem(null);
    setOrder(null);
    setTracking(null);
    setLastScan("");
  }

  return (
    <main className="min-h-screen bg-[#020817] text-white px-4 py-5">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="rounded-[28px] border border-cyan-900/60 bg-[#07111f] p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-700 bg-cyan-500/10 px-3 py-1 text-cyan-300 text-xs font-black tracking-[0.25em]">
                <Smartphone size={14} /> FASE 13
              </div>
              <h1 className="mt-3 text-3xl font-black">Taller Mobile QR</h1>
              <p className="mt-1 text-sm text-slate-400">
                Escaneo de piezas, estados y trazabilidad desde celular o tablet.
              </p>
            </div>
            <QrCode className="text-cyan-300" size={42} />
          </div>
        </section>

        <section className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
          <label className="text-[11px] uppercase tracking-[0.25em] text-slate-400 font-black flex items-center gap-2">
            <User size={14} /> Operador
          </label>
          <input
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
            placeholder="Nombre del operador..."
            className="mt-2 w-full h-12 rounded-2xl bg-[#030817] border border-slate-800 px-4 outline-none focus:border-cyan-500"
          />
        </section>

        <section className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-black flex items-center gap-2">
              <Camera className="text-cyan-300" /> Escanear QR
            </h2>

            {cameraActive ? (
              <button onClick={stopCamera} className="h-10 px-4 rounded-xl bg-red-600 font-black flex items-center gap-2">
                <StopCircle size={16} /> PARAR
              </button>
            ) : (
              <button onClick={startCamera} className="h-10 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-black flex items-center gap-2">
                <Camera size={16} /> CÁMARA
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#030817] overflow-hidden">
            <video ref={videoRef} className={`w-full ${cameraActive ? "block" : "hidden"}`} playsInline muted />
            {!cameraActive && (
              <div className="h-40 flex flex-col items-center justify-center text-slate-500">
                <QrCode size={42} />
                <div className="mt-2 text-sm">Cámara apagada</div>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-200 text-sm">
              {cameraError}
            </div>
          )}

          <label className="mt-5 text-[11px] uppercase tracking-[0.25em] text-slate-400 font-black flex items-center gap-2">
            <ClipboardList size={14} /> QR manual
          </label>

          <textarea
            value={qrText}
            onChange={(e) => setQrText(e.target.value)}
            placeholder="Pega aquí el texto del QR si usas el lector del celular..."
            className="mt-2 w-full h-28 rounded-2xl bg-[#030817] border border-slate-800 p-4 text-sm outline-none focus:border-cyan-500"
          />

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={() => searchByQr()}
              disabled={loading}
              className="h-12 rounded-2xl bg-cyan-600 hover:bg-cyan-500 font-black flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              BUSCAR
            </button>

            <button onClick={clearAll} className="h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 font-black flex items-center justify-center gap-2">
              <RefreshCw size={18} />
              LIMPIAR
            </button>
          </div>
        </section>

        {parsedQr && (
          <section className="rounded-3xl border border-slate-800 bg-[#07111f] p-5 shadow-2xl">
            <h2 className="text-xl font-black mb-3">Datos leídos del QR</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-[#030817] border border-slate-800 p-3">
                <div className="text-slate-500 font-black text-xs">OP</div>
                <div className="font-black">{qrOrderCode(parsedQr) || "-"}</div>
              </div>

              <div className="rounded-2xl bg-[#030817] border border-slate-800 p-3">
                <div className="text-slate-500 font-black text-xs">Proyecto</div>
                <div className="font-black">{qrProject(parsedQr) || "-"}</div>
              </div>

              <div className="rounded-2xl bg-[#030817] border border-slate-800 p-3 sm:col-span-2">
                <div className="text-slate-500 font-black text-xs">Pieza</div>
                <div className="font-black">{qrPieceName(parsedQr) || "-"}</div>
              </div>

              <div className="rounded-2xl bg-[#030817] border border-slate-800 p-3">
                <div className="text-slate-500 font-black text-xs">Material</div>
                <div className="font-black">{qrMaterial(parsedQr) || "-"}</div>
              </div>

              <div className="rounded-2xl bg-[#030817] border border-slate-800 p-3">
                <div className="text-slate-500 font-black text-xs">Medidas</div>
                <div className="font-black">{qrWidth(parsedQr)} x {qrHeight(parsedQr)} mm</div>
              </div>
            </div>
          </section>
        )}

        {item ? (
          <section className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-black">{item.item_name}</h2>
                <p className="text-slate-400 text-sm">
                  {order?.order_code || "OP"} · {order?.project_name || "Proyecto"}
                </p>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>
                {statusLabel(item.status)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-5">
              <div className="rounded-2xl bg-[#030817] border border-slate-800 p-3">
                <div className="text-slate-500 font-black text-xs">Tipo</div>
                <div className="font-black">{item.item_type || "-"}</div>
              </div>

              <div className="rounded-2xl bg-[#030817] border border-slate-800 p-3">
                <div className="text-slate-500 font-black text-xs">Material</div>
                <div className="font-black">{item.material || "-"}</div>
              </div>

              <div className="rounded-2xl bg-[#030817] border border-slate-800 p-3">
                <div className="text-slate-500 font-black text-xs">Medidas</div>
                <div className="font-black">{n(item.width_mm)} x {n(item.height_mm)} x {n(item.depth_mm)} mm</div>
              </div>

              <div className="rounded-2xl bg-[#030817] border border-slate-800 p-3">
                <div className="text-slate-500 font-black text-xs">Cantidad</div>
                <div className="font-black">{n(item.quantity).toFixed(2)} {item.unit}</div>
              </div>
            </div>

            <label className="text-[11px] uppercase tracking-[0.25em] text-slate-400 font-black">Nuevo estado</label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`h-11 rounded-2xl border text-xs font-black ${
                    selectedStatus === status
                      ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                      : "border-slate-800 bg-[#030817] text-slate-300"
                  }`}
                >
                  {statusLabel(status)}
                </button>
              ))}
            </div>

            <label className="mt-5 text-[11px] uppercase tracking-[0.25em] text-slate-400 font-black block">Notas</label>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: pieza cortada OK, canteo pendiente, daño en esquina..."
              className="mt-2 w-full h-24 rounded-2xl bg-[#030817] border border-slate-800 p-4 text-sm outline-none focus:border-cyan-500"
            />

            <button
              onClick={saveStatus}
              disabled={saving}
              className="mt-4 w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-600 hover:scale-[1.01] transition font-black flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              GUARDAR ESTADO
            </button>
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-800 bg-[#07111f] p-6 text-center text-slate-500">
            <PackageCheck className="mx-auto mb-3" size={42} />
            <div className="font-black">Escanea una pieza para comenzar.</div>
          </section>
        )}

        {tracking && (
          <section className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
            <h2 className="text-xl font-black flex items-center gap-2 mb-3">
              <CheckCircle2 className="text-cyan-300" /> Último seguimiento
            </h2>

            <div className="rounded-2xl bg-[#030817] border border-slate-800 p-4 text-sm">
              <div><b>Estado:</b> {statusLabel(tracking.current_status)}</div>
              <div><b>Operador:</b> {tracking.last_scanned_by || "-"}</div>
              <div><b>Fecha:</b> {shortDate(tracking.last_scanned_at)}</div>
              <div><b>Notas:</b> {tracking.notes || "-"}</div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100 text-sm">
          <div className="flex gap-3">
            <AlertTriangle className="shrink-0" />
            <div>
              <b>Nota:</b> Para cámara real en móvil se recomienda HTTPS. En localhost puedes usar lector QR normal y pegar el texto leído.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
