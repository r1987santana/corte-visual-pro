"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  History,
  ImageIcon,
  Loader2,
  MapPin,
  PackageCheck,
  PenLine,
  QrCode,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  UploadCloud,
  UserRound,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type PieceLabel = {
  id: string;
  label_code: string;
  order_code: string;
  production_order_id?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
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

type InstallationReport = {
  id: string;
  report_code: string;
  order_code: string;
  production_order_id?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  project_name?: string | null;
  installer_name?: string | null;
  assistant_name?: string | null;
  installation_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  gps_accuracy?: number | null;
  address_text?: string | null;
  checklist?: any;
  notes?: string | null;
  client_observations?: string | null;
  status?: string | null;
  total_pieces?: number | null;
  installed_pieces?: number | null;
  delivered_pieces?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type InstallationPhoto = {
  id: string;
  report_id?: string | null;
  order_code: string;
  label_code?: string | null;
  photo_url: string;
  photo_type?: string | null;
  description?: string | null;
  uploaded_by?: string | null;
  created_at?: string | null;
};

type TrackingEvent = {
  id: string;
  label_code?: string | null;
  order_code?: string | null;
  piece_name?: string | null;
  module_name?: string | null;
  previous_status?: string | null;
  new_status: string;
  department?: string | null;
  operator_name?: string | null;
  notes?: string | null;
  photo_url?: string | null;
  created_at?: string | null;
  scanned_at?: string | null;
};

const CHECKLIST = [
  { key: "medidas_verificadas", label: "Medidas verificadas en obra" },
  { key: "piezas_completas", label: "Piezas completas recibidas" },
  { key: "nivelacion", label: "Nivelación correcta" },
  { key: "herrajes_funcionando", label: "Herrajes funcionando" },
  { key: "limpieza_final", label: "Limpieza final realizada" },
  { key: "cliente_revisa", label: "Cliente revisa y acepta" },
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
  return clean(value).toLowerCase() || "pendiente";
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

export default function InstalacionMobileProPage() {
  const [manualCode, setManualCode] = useState("");
  const [piece, setPiece] = useState<PieceLabel | null>(null);
  const [orderPieces, setOrderPieces] = useState<PieceLabel[]>([]);
  const [history, setHistory] = useState<TrackingEvent[]>([]);
  const [report, setReport] = useState<InstallationReport | null>(null);
  const [photos, setPhotos] = useState<InstallationPhoto[]>([]);
  const [installerName, setInstallerName] = useState("Instalador Principal");
  const [assistantName, setAssistantName] = useState("");
  const [notes, setNotes] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [photoType, setPhotoType] = useState<"before" | "after" | "issue">("after");
  const [signerName, setSignerName] = useState("");
  const [signerDocument, setSignerDocument] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<any>(null);
  const signatureRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    getGps();
    return () => stopCamera();
  }, []);

  const installedCount = useMemo(
    () =>
      orderPieces.filter((p) =>
        ["instalada", "entregada"].includes(normalizeStatus(p.current_status))
      ).length,
    [orderPieces]
  );

  const deliveredCount = useMemo(
    () => orderPieces.filter((p) => normalizeStatus(p.current_status) === "entregada").length,
    [orderPieces]
  );

  const progress = useMemo(() => {
    if (!orderPieces.length) return 0;
    return Math.round((installedCount / orderPieces.length) * 100);
  }, [installedCount, orderPieces.length]);

  async function getGps() {
    setWarning("");

    if (!navigator.geolocation) {
      setWarning("Este dispositivo no permite GPS desde el navegador.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => setWarning("GPS no disponible: " + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function loadPieceByCode(input: string) {
    const labelCode = parseQrText(input);
    if (!labelCode) {
      setMessage("Escribe o escanea una etiqueta QR.");
      return;
    }

    setLoading(true);
    setMessage("");
    setWarning("");

    const { data, error } = await supabase
      .from("piece_labels")
      .select("*")
      .ilike("label_code", labelCode)
      .maybeSingle();

    if (error) {
      setMessage("Error buscando pieza: " + error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setMessage("No encontré la pieza: " + labelCode);
      setLoading(false);
      return;
    }

    const currentPiece = data as PieceLabel;
    setPiece(currentPiece);
    setManualCode(currentPiece.label_code);
    setSignerName(currentPiece.client_name || "");
    setNotes("");

    await Promise.all([
      loadOrderPieces(currentPiece.order_code),
      loadHistory(currentPiece.label_code),
      loadOrCreateReport(currentPiece),
    ]);

    setLoading(false);
  }

  async function loadOrderPieces(orderCode: string) {
    const { data, error } = await supabase
      .from("piece_labels")
      .select("*")
      .eq("order_code", orderCode)
      .order("module_name", { ascending: true });

    if (!error) setOrderPieces((data || []) as PieceLabel[]);
  }

  async function loadHistory(labelCode: string) {
    const { data, error } = await supabase
      .from("piece_tracking_history")
      .select("*")
      .or(`label_code.eq.${labelCode},piece_code.eq.${labelCode}`)
      .order("created_at", { ascending: false });

    if (!error) setHistory((data || []) as TrackingEvent[]);
  }

  async function loadPhotos(reportId: string) {
    const { data, error } = await supabase
      .from("installation_photos")
      .select("*")
      .eq("report_id", reportId)
      .order("created_at", { ascending: false });

    if (!error) setPhotos((data || []) as InstallationPhoto[]);
  }

  async function loadOrCreateReport(currentPiece: PieceLabel) {
    const orderCode = currentPiece.order_code;

    const existing = await supabase
      .from("installation_reports")
      .select("*")
      .eq("order_code", orderCode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing.data) {
      const currentReport = existing.data as InstallationReport;
      setReport(currentReport);
      setInstallerName(currentReport.installer_name || installerName);
      setAssistantName(currentReport.assistant_name || "");
      setChecklist(currentReport.checklist || {});
      setClientNotes(currentReport.client_observations || "");
      setNotes(currentReport.notes || "");
      await loadPhotos(currentReport.id);
      return currentReport;
    }

    const totalPiecesResult = await supabase
      .from("piece_labels")
      .select("id", { count: "exact", head: true })
      .eq("order_code", orderCode);

    const insertPayload = {
      order_code: orderCode,
      production_order_id: currentPiece.production_order_id || null,
      client_name: currentPiece.client_name || "",
      client_phone: currentPiece.client_phone || "",
      project_name: currentPiece.project_name || "",
      installer_name: installerName,
      assistant_name: assistantName,
      gps_lat: gps?.lat || null,
      gps_lng: gps?.lng || null,
      gps_accuracy: gps?.accuracy || null,
      status: "en_instalacion",
      total_pieces: totalPiecesResult.count || 0,
      installed_pieces: installedCount || 0,
      delivered_pieces: deliveredCount || 0,
      checklist: {},
      notes: "",
      client_observations: "",
    };

    const { data, error } = await supabase
      .from("installation_reports")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      setMessage("Pieza encontrada, pero no pude crear reporte: " + error.message);
      return null;
    }

    setReport(data as InstallationReport);
    await loadPhotos((data as InstallationReport).id);
    return data as InstallationReport;
  }

  async function updatePieceStatus(status: "instalada" | "entregada") {
    if (!piece) return;

    setSaving(true);
    setMessage("");

    const previousStatus = normalizeStatus(piece.current_status);

    const { error: labelError } = await supabase
      .from("piece_labels")
      .update({
        current_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("label_code", piece.label_code);

    if (labelError) {
      setMessage("Error actualizando pieza: " + labelError.message);
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
      new_status: status,
      department: "instalacion",
      operator_name: installerName || "Instalador",
      notes:
        notes ||
        `Instalación móvil FASE 38: ${STATUS_LABELS[previousStatus] || previousStatus} → ${
          STATUS_LABELS[status] || status
        }`,
      payload: {
        label_code: piece.label_code,
        order_code: piece.order_code,
        report_id: report?.id || null,
        gps,
        source: "fase_38_instalacion_mobile",
      },
      scanned_at: new Date().toISOString(),
      device_name: "Mobile / Instalación",
      scan_source: "installation_mobile",
    });

    if (historyError) {
      setMessage("Pieza actualizada, pero falló historial: " + historyError.message);
      setSaving(false);
      return;
    }

    await refreshAfterChange(piece.order_code, piece.label_code);
    setPiece({ ...piece, current_status: status, updated_at: new Date().toISOString() });
    setMessage(`✅ Pieza ${piece.label_code} marcada como ${STATUS_LABELS[status]}`);
    setSaving(false);
  }

  async function refreshAfterChange(orderCode: string, labelCode: string) {
    await Promise.all([loadOrderPieces(orderCode), loadHistory(labelCode)]);
    await updateReportCounts(orderCode);
  }

  async function updateReportCounts(orderCode: string) {
    if (!report) return;

    const { data } = await supabase
      .from("piece_labels")
      .select("current_status")
      .eq("order_code", orderCode);

    const rows = (data || []) as PieceLabel[];
    const installed = rows.filter((p) =>
      ["instalada", "entregada"].includes(normalizeStatus(p.current_status))
    ).length;
    const delivered = rows.filter((p) => normalizeStatus(p.current_status) === "entregada").length;

    const { data: updated } = await supabase
      .from("installation_reports")
      .update({
        installer_name: installerName,
        assistant_name: assistantName,
        gps_lat: gps?.lat || null,
        gps_lng: gps?.lng || null,
        gps_accuracy: gps?.accuracy || null,
        checklist,
        notes,
        client_observations: clientNotes,
        total_pieces: rows.length,
        installed_pieces: installed,
        delivered_pieces: delivered,
        updated_at: new Date().toISOString(),
      })
      .eq("id", report.id)
      .select()
      .single();

    if (updated) setReport(updated as InstallationReport);
  }

  async function uploadPhoto(file: File) {
    if (!piece || !report) {
      setMessage("Primero escanea una pieza.");
      return;
    }

    setSaving(true);
    setMessage("");

    const ext = file.name.split(".").pop() || "jpg";
    const path = `instalacion/${piece.order_code}/${piece.label_code}/${Date.now()}-${photoType}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("project-files")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      setMessage("Error subiendo foto: " + uploadError.message);
      setSaving(false);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("project-files").getPublicUrl(path);
    const url = publicUrl.publicUrl;

    const { error: photoError } = await supabase.from("installation_photos").insert({
      report_id: report.id,
      order_code: piece.order_code,
      label_code: piece.label_code,
      photo_url: url,
      photo_type: photoType,
      description: notes || `Foto ${photoType} de instalación`,
      gps_lat: gps?.lat || null,
      gps_lng: gps?.lng || null,
      uploaded_by: installerName || "Instalador",
    });

    if (photoError) {
      setMessage("Foto subida, pero falló registro: " + photoError.message);
      setSaving(false);
      return;
    }

    await supabase.from("piece_tracking_history").insert({
      piece_code: piece.label_code,
      label_code: piece.label_code,
      order_code: piece.order_code,
      production_order_id: piece.production_order_id || null,
      piece_name: piece.piece_name || "",
      module_name: piece.module_name || "",
      previous_status: normalizeStatus(piece.current_status),
      new_status: normalizeStatus(piece.current_status),
      department: "evidencia_foto",
      operator_name: installerName || "Instalador",
      notes: `Foto ${photoType} subida desde instalación móvil.`,
      photo_url: url,
      payload: { report_id: report.id, photo_type: photoType, gps },
      scanned_at: new Date().toISOString(),
      device_name: "Mobile / Instalación",
      scan_source: "installation_photo",
    });

    await loadPhotos(report.id);
    await loadHistory(piece.label_code);
    setMessage("✅ Foto subida y registrada con trazabilidad.");
    setSaving(false);
  }

  async function finalizeDelivery() {
    if (!piece || !report) {
      setMessage("Primero escanea una pieza.");
      return;
    }

    const signatureData = getSignatureData();
    if (!signerName.trim()) {
      setMessage("Escribe el nombre de quien firma.");
      return;
    }

    if (!signatureData) {
      setMessage("Falta la firma del cliente.");
      return;
    }

    setSaving(true);
    setMessage("");

    await updateReportCounts(piece.order_code);

    const { error: signatureError } = await supabase.from("delivery_signatures").insert({
      report_id: report.id,
      order_code: piece.order_code,
      signer_name: signerName,
      signer_document: signerDocument,
      signature_data: signatureData,
      acceptance_text:
        "El cliente confirma recepción, instalación y entrega satisfactoria del proyecto.",
      gps_lat: gps?.lat || null,
      gps_lng: gps?.lng || null,
    });

    if (signatureError) {
      setMessage("Error guardando firma: " + signatureError.message);
      setSaving(false);
      return;
    }

    const { error: reportError } = await supabase
      .from("installation_reports")
      .update({
        status: "entregado",
        end_time: new Date().toISOString(),
        installer_name: installerName,
        assistant_name: assistantName,
        notes,
        client_observations: clientNotes,
        checklist,
        gps_lat: gps?.lat || null,
        gps_lng: gps?.lng || null,
        gps_accuracy: gps?.accuracy || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", report.id);

    if (reportError) {
      setMessage("Firma guardada, pero falló reporte: " + reportError.message);
      setSaving(false);
      return;
    }

    await markAllInstalledAsDelivered();
    await generateDeliveryPdf(signatureData);

    setMessage("✅ Entrega final registrada con firma, GPS y acta PDF.");
    setSaving(false);
  }

  async function markAllInstalledAsDelivered() {
    if (!piece || !report) return;

    const targets = orderPieces.filter((p) =>
      ["instalada", "transportada", "empacada", "ensamblada", "cnc"].includes(
        normalizeStatus(p.current_status)
      )
    );

    for (const p of targets) {
      await supabase
        .from("piece_labels")
        .update({
          current_status: "entregada",
          updated_at: new Date().toISOString(),
        })
        .eq("label_code", p.label_code);

      await supabase.from("piece_tracking_history").insert({
        piece_code: p.label_code,
        label_code: p.label_code,
        order_code: p.order_code,
        production_order_id: p.production_order_id || null,
        piece_name: p.piece_name || "",
        module_name: p.module_name || "",
        previous_status: normalizeStatus(p.current_status),
        new_status: "entregada",
        department: "entrega_cliente",
        operator_name: installerName || "Instalador",
        notes: "Entrega final registrada desde FASE 38.",
        payload: { report_id: report.id, gps },
        scanned_at: new Date().toISOString(),
        device_name: "Mobile / Instalación",
        scan_source: "installation_delivery",
      });
    }

    await refreshAfterChange(piece.order_code, piece.label_code);
  }

  async function generateDeliveryPdf(signatureData: string) {
    if (!piece || !report) return;

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });

    const w = doc.internal.pageSize.getWidth();
    let y = 44;

    doc.setFillColor(2, 6, 23);
    doc.rect(0, 0, w, 90, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("RD WOOD SYSTEM", 40, 40);
    doc.setFontSize(15);
    doc.text("ACTA DE INSTALACIÓN Y ENTREGA", 40, 66);

    y = 120;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Reporte: ${report.report_code}`, 40, y);
    y += 22;
    doc.text(`Orden: ${piece.order_code}`, 40, y);
    y += 22;
    doc.text(`Cliente: ${piece.client_name || report.client_name || ""}`, 40, y);
    y += 22;
    doc.text(`Proyecto: ${piece.project_name || report.project_name || ""}`, 40, y);
    y += 22;
    doc.text(`Instalador: ${installerName}`, 40, y);
    y += 22;
    doc.text(`Fecha: ${formatDate(new Date().toISOString())}`, 40, y);
    y += 22;
    doc.text(`GPS: ${gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : "No disponible"}`, 40, y);

    y += 36;
    doc.setFontSize(14);
    doc.text("Resumen de piezas", 40, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total piezas: ${orderPieces.length}`, 40, y);
    doc.text(`Instaladas: ${installedCount}`, 180, y);
    doc.text(`Entregadas: ${deliveredCount}`, 320, y);

    y += 34;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Checklist", 40, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    CHECKLIST.forEach((item) => {
      doc.text(`${checklist[item.key] ? "✓" : "□"} ${item.label}`, 50, y);
      y += 18;
    });

    y += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Observaciones", 40, y);
    y += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(notes || "Sin observaciones internas.", w - 80), 40, y);
    y += 52;
    doc.text(doc.splitTextToSize(clientNotes || "Sin observaciones del cliente.", w - 80), 40, y);

    y += 70;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Firma del cliente", 40, y);
    y += 10;
    doc.addImage(signatureData, "PNG", 40, y, 220, 90);
    y += 110;
    doc.setFontSize(10);
    doc.text(`Firmado por: ${signerName}`, 40, y);
    if (signerDocument) doc.text(`Documento: ${signerDocument}`, 260, y);

    doc.save(`${piece.order_code}_acta_instalacion_entrega.pdf`);
  }

  function getSignatureData() {
    const canvas = signatureRef.current;
    if (!canvas) return "";

    const blank = document.createElement("canvas");
    blank.width = canvas.width;
    blank.height = canvas.height;

    if (canvas.toDataURL() === blank.toDataURL()) return "";
    return canvas.toDataURL("image/png");
  }

  function clearSignature() {
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function startDrawing(e: any) {
    drawingRef.current = true;
    draw(e);
  }

  function stopDrawing() {
    drawingRef.current = false;
    const ctx = signatureRef.current?.getContext("2d");
    ctx?.beginPath();
  }

  function draw(e: any) {
    if (!drawingRef.current || !signatureRef.current) return;

    const canvas = signatureRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;

    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  async function startCamera() {
    setWarning("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setWarning("Este navegador no permite cámara.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      startBarcodeLoop();
    } catch (error: any) {
      setWarning("No se pudo activar cámara: " + (error?.message || error));
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

  function startBarcodeLoop() {
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);

    scanTimerRef.current = setInterval(async () => {
      try {
        const BarcodeDetectorClass = (window as any).BarcodeDetector;
        if (!BarcodeDetectorClass) {
          setWarning("Tu navegador no tiene BarcodeDetector. Usa entrada manual o Chrome/Edge actualizado.");
          return;
        }

        const detector = new BarcodeDetectorClass({ formats: ["qr_code", "code_128", "code_39"] });

        if (!videoRef.current || videoRef.current.readyState < 2) return;

        const codes = await detector.detect(videoRef.current);
        if (!codes?.length) return;

        const raw = clean(codes[0]?.rawValue);
        const labelCode = parseQrText(raw);
        if (!labelCode) return;

        setManualCode(labelCode);
        await loadPieceByCode(labelCode);
        stopCamera();
      } catch (error) {
        console.warn("Scanner error", error);
      }
    }, 800);
  }

  return (
    <main className="min-h-screen bg-[#020617] px-3 py-4 text-white md:px-8">
      <div className="mx-auto max-w-[1600px]">
        <section className="rounded-[30px] border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-[#07111f] to-blue-950 p-5 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.32em] text-cyan-300">
                FASE 38 · Instalación Mobile PRO
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
                Instalación y Entrega PRO
              </h1>
              <p className="mt-3 max-w-4xl text-sm font-semibold text-slate-300 md:text-base">
                QR, fotos, GPS, checklist, firma del cliente y acta PDF.
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
                Trazabilidad
              </a>
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-4 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm font-black text-cyan-100">
            {message}
          </div>
        )}

        {warning && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-sm font-black text-amber-100">
            ⚠️ {warning}
          </div>
        )}

        <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[440px_1fr]">
          <div className="space-y-5">
            <Panel title="Escaneo QR" subtitle="Cámara o código manual." icon={<QrCode />}>
              <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
                <video
                  ref={videoRef}
                  className={["aspect-video w-full object-cover", cameraActive ? "block" : "hidden"].join(" ")}
                  muted
                  playsInline
                />

                {!cameraActive && (
                  <div className="flex aspect-video flex-col items-center justify-center p-6 text-center">
                    <Smartphone className="text-slate-700" size={60} />
                    <h3 className="mt-3 text-xl font-black">Cámara detenida</h3>
                    <p className="mt-1 text-sm text-slate-400">Activa cámara o escribe el código.</p>
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-3">
                <input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadPieceByCode(manualCode);
                  }}
                  placeholder="LBL-TEST-001"
                  className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-[#020617] px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => loadPieceByCode(manualCode)}
                  className="rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-950 hover:bg-cyan-100"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                </button>
              </div>
            </Panel>

            <Panel title="Equipo / GPS" subtitle="Datos auditables de campo." icon={<MapPin />}>
              <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Instalador</label>
              <input
                value={installerName}
                onChange={(e) => setInstallerName(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-400"
              />

              <label className="mt-4 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Ayudante</label>
              <input
                value={assistantName}
                onChange={(e) => setAssistantName(e.target.value)}
                placeholder="Opcional"
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-400"
              />

              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">GPS</div>
                <div className="mt-2 text-sm font-black text-white">
                  {gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : "No disponible"}
                </div>
                <button
                  type="button"
                  onClick={getGps}
                  className="mt-3 rounded-xl border border-slate-700 px-4 py-2 text-xs font-black hover:border-cyan-400"
                >
                  Actualizar GPS
                </button>
              </div>
            </Panel>

            <Panel title="Avance de orden" subtitle="Resumen de piezas del proyecto." icon={<PackageCheck />}>
              <div className="grid grid-cols-3 gap-3">
                <MiniStat title="Total" value={orderPieces.length} />
                <MiniStat title="Instaladas" value={installedCount} />
                <MiniStat title="Entregadas" value={deliveredCount} />
              </div>
              <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-950">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-2 text-right text-xs font-black text-emerald-300">{progress}% instalado</div>
            </Panel>
          </div>

          <div className="space-y-5">
            {!piece ? (
              <div className="flex min-h-[720px] flex-col items-center justify-center rounded-[30px] border border-dashed border-slate-700 bg-[#07111f] p-8 text-center">
                <QrCode className="text-slate-700" size={90} />
                <h2 className="mt-6 text-3xl font-black">Escanea una pieza</h2>
                <p className="mt-2 max-w-md text-sm font-semibold text-slate-400">
                  El sistema cargará la orden, fotos, checklist y firma de entrega.
                </p>
              </div>
            ) : (
              <>
                <Panel title="Pieza / Proyecto" subtitle="Datos cargados desde QR." icon={<BadgeCheck />}>
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <InfoBox title="Etiqueta" value={piece.label_code} />
                    <InfoBox title="Estado" value={STATUS_LABELS[normalizeStatus(piece.current_status)] || normalizeStatus(piece.current_status)} />
                    <InfoBox title="Orden" value={piece.order_code} />
                    <InfoBox title="Cliente" value={piece.client_name || "—"} />
                    <InfoBox title="Proyecto" value={piece.project_name || "—"} />
                    <InfoBox title="Módulo" value={piece.module_name || "—"} />
                    <InfoBox title="Pieza" value={piece.piece_name || "—"} />
                    <InfoBox
                      title="Medida"
                      value={`${Number(piece.width_mm || 0)} x ${Number(piece.height_mm || 0)} x ${Number(piece.thickness_mm || 18)} mm`}
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => updatePieceStatus("instalada")}
                      disabled={saving}
                      className="rounded-2xl bg-cyan-400 px-5 py-5 text-sm font-black uppercase text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
                    >
                      Marcar pieza instalada
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePieceStatus("entregada")}
                      disabled={saving}
                      className="rounded-2xl bg-emerald-500 px-5 py-5 text-sm font-black uppercase text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                    >
                      Marcar pieza entregada
                    </button>
                  </div>
                </Panel>

                <Panel title="Fotos de instalación" subtitle="Antes, después o incidencia." icon={<ImageIcon />}>
                  <div className="grid grid-cols-3 gap-3">
                    {(["before", "after", "issue"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPhotoType(type)}
                        className={[
                          "rounded-2xl border px-4 py-3 text-sm font-black",
                          photoType === type
                            ? "border-cyan-400 bg-cyan-400/20 text-cyan-100"
                            : "border-slate-700 bg-slate-950 text-slate-300",
                        ].join(" ")}
                      >
                        {type === "before" ? "Antes" : type === "after" ? "Después" : "Incidencia"}
                      </button>
                    ))}
                  </div>

                  <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-cyan-400/40 bg-cyan-400/10 px-5 py-6 text-sm font-black text-cyan-100 hover:bg-cyan-400/20">
                    <UploadCloud size={22} />
                    Tomar/Subir foto
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadPhoto(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>

                  {photos.length > 0 && (
                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                      {photos.map((photo) => (
                        <a
                          key={photo.id}
                          href={photo.photo_url}
                          target="_blank"
                          className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950"
                        >
                          <img src={photo.photo_url} alt="Foto instalación" className="h-32 w-full object-cover" />
                          <div className="p-3 text-xs font-black uppercase text-slate-300">
                            {photo.photo_type || "foto"}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="Checklist / Observaciones" subtitle="Validación final de instalación." icon={<ClipboardCheck />}>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {CHECKLIST.map((item) => (
                      <label
                        key={item.key}
                        className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4"
                      >
                        <input
                          type="checkbox"
                          checked={!!checklist[item.key]}
                          onChange={(e) => setChecklist({ ...checklist, [item.key]: e.target.checked })}
                          className="h-5 w-5"
                        />
                        <span className="text-sm font-black text-white">{item.label}</span>
                      </label>
                    ))}
                  </div>

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observaciones internas de instalación..."
                    className="mt-4 h-28 w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm font-semibold text-white outline-none focus:border-cyan-400"
                  />
                  <textarea
                    value={clientNotes}
                    onChange={(e) => setClientNotes(e.target.value)}
                    placeholder="Observaciones del cliente..."
                    className="mt-4 h-28 w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm font-semibold text-white outline-none focus:border-cyan-400"
                  />

                  <button
                    type="button"
                    onClick={() => piece && updateReportCounts(piece.order_code)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-5 py-4 text-sm font-black uppercase text-cyan-100 hover:bg-cyan-400/20"
                  >
                    <Save size={18} />
                    Guardar avance del reporte
                  </button>
                </Panel>

                <Panel title="Firma y entrega final" subtitle="Acta de entrega PDF con firma digital." icon={<PenLine />}>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Nombre de quien firma"
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-400"
                    />
                    <input
                      value={signerDocument}
                      onChange={(e) => setSignerDocument(e.target.value)}
                      placeholder="Cédula / Documento opcional"
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950 p-3">
                    <canvas
                      ref={signatureRef}
                      width={900}
                      height={260}
                      className="h-44 w-full rounded-xl bg-[#020617]"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    <div className="mt-3 flex justify-between gap-3">
                      <button
                        type="button"
                        onClick={clearSignature}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-xs font-black hover:border-red-400"
                      >
                        <Trash2 size={14} />
                        Limpiar firma
                      </button>
                      <span className="text-xs font-semibold text-slate-500">Firma del cliente</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={finalizeDelivery}
                    disabled={saving}
                    className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-6 py-5 text-sm font-black uppercase text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                    Finalizar entrega y generar acta PDF
                  </button>
                </Panel>

                <Panel title="Historial de la pieza" subtitle="Últimos eventos auditables." icon={<History />}>
                  <div className="space-y-3">
                    {history.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
                        Sin historial todavía.
                      </div>
                    ) : (
                      history.map((event) => (
                        <div key={event.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-black text-white">
                                {STATUS_LABELS[normalizeStatus(event.new_status)] || event.new_status}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {formatDate(event.scanned_at || event.created_at)}
                              </div>
                            </div>
                            <span className="rounded-full bg-cyan-500/15 px-3 py-2 text-xs font-black uppercase text-cyan-300">
                              {event.department || "evento"}
                            </span>
                          </div>
                          <div className="mt-3 text-xs font-semibold text-slate-300">{event.notes || "Sin nota"}</div>
                          {event.photo_url && (
                            <img src={event.photo_url} alt="Evidencia" className="mt-3 h-32 rounded-xl object-cover" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </Panel>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5 shadow-2xl shadow-black/30">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="text-sm font-semibold text-slate-400">{subtitle}</p>
        </div>
        <div className="text-cyan-300">{icon}</div>
      </div>
      {children}
    </section>
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

function MiniStat({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}
