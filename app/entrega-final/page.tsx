"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Download,
  FileSignature,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Star,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type DeliverySource = {
  id: string;
  report_id?: string | null;
  project_id?: string | null;
  order_code?: string | null;
  module_name?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  client_document?: string | null;
  document_number?: string | null;
  document?: string | null;
  qa_status?: string | null;
  status?: string | null;
  score?: number | null;
  qa_score?: number | null;
  approved_for_delivery?: boolean | null;
  supervisor_signature?: string | null;
  qa_supervisor?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
};

type DeliveryReport = {
  id: string;
  delivery_code?: string | null;
  project_id?: string | null;
  verification_report_id?: string | null;
  order_code?: string | null;
  module_name?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  delivered_by?: string | null;
  received_by?: string | null;
  client_document?: string | null;
  delivery_status?: string | null;
  final_status?: string | null;
  satisfaction_score?: number | null;
  client_comments?: string | null;
  internal_notes?: string | null;
  warranty_terms?: string | null;
  warranty_code?: string | null;
  warranty_start_at?: string | null;
  warranty_end_at?: string | null;
  signed_at?: string | null;
  closed_at?: string | null;
  delivered_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type DeliveryPhoto = {
  id: string;
  delivery_report_id: string;
  project_id?: string | null;
  order_code?: string | null;
  module_name?: string | null;
  photo_url: string;
  photo_type?: string | null;
  file_name?: string | null;
  description?: string | null;
};

type DeliverySignature = {
  id?: string;
  delivery_report_id?: string | null;
  signer_name?: string | null;
  signer_document?: string | null;
  signature_data?: string | null;
  acceptance_text?: string | null;
  created_at?: string | null;
};

const CHECKLIST = [
  "Cliente recibió el proyecto completo",
  "Proyecto limpio y terminado",
  "Herrajes y puertas funcionando",
  "Cliente recibió orientación de uso",
  "Garantía explicada",
  "Fotos finales cargadas",
];

const COMPANY_LEGAL_NAME = "RDSS Santana Group";

function safe(value: any, fallback = "—") {
  const txt = String(value ?? "").trim();
  return txt || fallback;
}

function empty(value: any) {
  const txt = String(value ?? "").trim();
  if (!txt || txt === "null" || txt === "undefined") return "";
  return txt;
}

function missingColumn(message?: string) {
  const match = String(message || "").match(/'([^']+)' column/);
  return match?.[1] || "";
}

async function insertCompatible(table: string, payload: Record<string, any>) {
  const next = { ...payload };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { error } = await supabase.from(table).insert(next);
    if (!error) return;

    const column = missingColumn(error.message);
    if (!column || !(column in next)) throw error;
    delete next[column];
  }

  throw new Error(`No pude insertar en ${table}: demasiadas columnas incompatibles.`);
}

async function updateCompatible(table: string, idColumn: string, idValue: string, payload: Record<string, any>) {
  const next = { ...payload };

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const { error } = await supabase.from(table).update(next).eq(idColumn, idValue);
    if (!error) return;

    const column = missingColumn(error.message);
    if (!column || !(column in next)) throw error;
    delete next[column];
  }

  throw new Error(`No pude actualizar ${table}: demasiadas columnas incompatibles.`);
}

function n(value: any) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function phoneClean(value: string) {
  let phone = empty(value).replace(/\D/g, "");
  if (phone.length === 10) phone = `1${phone}`;
  return phone;
}

function getProjectId(source?: DeliverySource | null) {
  const id = empty(source?.project_id);
  return id || null;
}

function sourceKey(source: DeliverySource) {
  return source.report_id || source.id || `${source.order_code}-${source.module_name}`;
}

function sourceOrder(source?: DeliverySource | null) {
  return safe(source?.order_code, "SIN-ORDEN");
}

function sourceName(source?: DeliverySource | null) {
  return safe(source?.project_name, "Proyecto sin nombre");
}

function sourceModule(source?: DeliverySource | null) {
  return safe(source?.module_name, "General");
}

function sourceClient(source?: DeliverySource | null) {
  return safe(source?.client_name, "Cliente general");
}

function sourcePhone(source?: DeliverySource | null) {
  return empty(source?.client_phone);
}

function sourceAddress(source?: DeliverySource | null) {
  return safe(source?.client_address, "Sin dirección");
}

function sourceDocument(source?: DeliverySource | null) {
  return empty(source?.client_document || source?.document_number || source?.document);
}

function legalDeliveredBy(value?: string | null) {
  const current = empty(value);
  return !current || normalizeLookup(current) === "rd wood system" ? COMPANY_LEGAL_NAME : current;
}

function normalizeLookup(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function sameLookup(left: any, right: any) {
  const a = normalizeLookup(left);
  const b = normalizeLookup(right);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

async function resolveClientDocument(source?: DeliverySource | null) {
  const direct = sourceDocument(source);
  if (direct) return direct;

  const clientName = sourceClient(source);
  const projectName = sourceName(source);
  const orderCode = sourceOrder(source);

  for (const table of ["quotes", "project_contracts", "clients"]) {
    try {
      const { data, error } = await supabase.from(table).select("*").limit(1000);
      if (error) continue;

      const match = (data || []).find((row: any) => {
        const rowClient = row.client_name || row.customer_name || row.name;
        const rowProject = row.project_name || row.project || row.title;
        const rowOrder = row.order_code || row.production_order_code || row.production_code;
        return (
          (sameLookup(rowClient, clientName) && (sameLookup(rowProject, projectName) || !rowProject || projectName === "Proyecto sin nombre")) ||
          (orderCode !== "SIN-ORDEN" && rowOrder === orderCode)
        );
      });

      const doc = empty(match?.client_document || match?.document_number || match?.document || match?.client_document_number);
      if (doc) return doc;
    } catch {
      // Sigue buscando en la próxima fuente disponible.
    }
  }

  return "";
}

function todayText() {
  return new Date().toLocaleString("es-DO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function makeDeliveryCode(report?: DeliveryReport | null) {
  if (report?.delivery_code) return report.delivery_code;
  const base = report?.id ? report.id.slice(0, 6) : Math.random().toString(16).slice(2, 8);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `DEL-${stamp}-${base}`;
}

function warrantyWindow() {
  const start = new Date();
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

async function resolveContractForDelivery(source?: DeliverySource | null) {
  const { data, error } = await supabase.from("project_contracts").select("*").limit(1000);
  if (error) return null;

  const clientName = sourceClient(source);
  const projectName = sourceName(source);
  return (
    (data || []).find((row: any) => sameLookup(row.client_name, clientName) && sameLookup(row.project_name, projectName)) ||
    null
  );
}

async function activateCommercialClose(source: DeliverySource, deliveryReport: DeliveryReport) {
  const contract = await resolveContractForDelivery(source);
  if (!contract) return { finalDue: 0, warrantyCode: makeDeliveryCode(deliveryReport), warranty: warrantyWindow() };

  const total = n(contract.total_amount || contract.total_price);
  const credit = n(contract.credit_applied);
  const final20 = n(contract.final_20) || total * 0.2;
  const finalPaid = n(contract.final_paid);
  const finalDue = Math.max(final20 - credit - finalPaid, 0);
  const warranty = warrantyWindow();
  const warrantyCode = contract.contract_code || makeDeliveryCode(deliveryReport);
  const status = finalDue > 0 ? "entregado_final_pendiente_pago" : "entregado_final_pagado";
  const now = new Date().toISOString();

  const contractPayload = {
    status,
    final_due: finalDue,
    balance: finalDue,
    balance_due: finalDue,
    warranty_status: "activa",
    warranty_code: warrantyCode,
    warranty_start_at: warranty.startIso,
    warranty_end_at: warranty.endIso,
    warranty_expires_at: warranty.endIso,
    delivered_at: now,
    final_delivered_at: now,
    updated_at: now,
  };

  await updateCompatible("project_contracts", "id", contract.id, contractPayload);

  if (contract.quote_id) {
    await updateCompatible("quotes", "id", contract.quote_id, {
      status,
      contract_status: status,
      balance: finalDue,
      balance_due: finalDue,
      warranty_status: "activa",
      warranty_code: warrantyCode,
      warranty_start_at: warranty.startIso,
      warranty_end_at: warranty.endIso,
      warranty_expires_at: warranty.endIso,
      updated_at: now,
    });
  }

  return { finalDue, warrantyCode, warranty };
}

export default function EntregaFinalDigitalPage() {
  const [sources, setSources] = useState<DeliverySource[]>([]);
  const [selected, setSelected] = useState<DeliverySource | null>(null);
  const [report, setReport] = useState<DeliveryReport | null>(null);
  const [photos, setPhotos] = useState<DeliveryPhoto[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [deliveredBy, setDeliveredBy] = useState(COMPANY_LEGAL_NAME);
  const [receivedBy, setReceivedBy] = useState("");
  const [clientDocument, setClientDocument] = useState("");
  const [satisfaction, setSatisfaction] = useState(5);
  const [clientComments, setClientComments] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [clientSignature, setClientSignature] = useState("");
  const [representativeSignature, setRepresentativeSignature] = useState("");
  const [drawingTarget, setDrawingTarget] = useState<"client" | "representative" | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const clientCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const representativeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const checklistDone = CHECKLIST.filter((x) => checked[x]).length;
  const firstPhoto = photos[0]?.photo_url || "";
  const canClose =
    !!selected &&
    !!report &&
    checklistDone === CHECKLIST.length &&
    !!clientSignature &&
    !!representativeSignature &&
    photos.length > 0 &&
    !!receivedBy &&
    !!clientDocument;

  const filteredSources = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return sources;
    return sources.filter((p) =>
      `${sourceOrder(p)} ${sourceName(p)} ${sourceModule(p)} ${sourceClient(p)} ${sourcePhone(p)} ${sourceAddress(p)}`
        .toLowerCase()
        .includes(q)
    );
  }, [sources, search]);

  const dashboard = useMemo(() => {
    return {
      proyectos: sources.length,
      fotos: photos.length,
      checklist: `${checklistDone}/${CHECKLIST.length}`,
      estado: report?.delivery_status || report?.final_status || "pendiente",
    };
  }, [sources.length, photos.length, checklistDone, report?.delivery_status, report?.final_status]);

  useEffect(() => {
    loadReadyForDelivery();
    getGps();
  }, []);

  useEffect(() => {
    setTimeout(() => {
      initCanvas("client", clientSignature);
      initCanvas("representative", representativeSignature);
    }, 80);
  }, [selected?.id, report?.id, clientSignature, representativeSignature]);

  function getGps() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function loadReadyForDelivery() {
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("verification_reports")
        .select("*")
        .or("qa_status.eq.approved,qa_status.eq.aprobado,status.eq.aprobado,status.eq.liberado_entrega_final,status.eq.entregado_final,approved_for_delivery.eq.true")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage("No pude cargar desde Verificación QA: " + error.message);
        setSources([]);
      } else {
        const cleaned = (data || [])
          .filter((r: any) => empty(r.order_code) && empty(r.order_code) !== "00000000")
          .map((r: any) => ({
            ...r,
            report_id: r.id,
          })) as DeliverySource[];
        setSources(cleaned);
      }
    } catch (error: any) {
      setMessage("Error cargando entrega final: " + (error?.message || error));
      setSources([]);
    }

    setLoading(false);
  }

  async function selectSource(source: DeliverySource) {
    setSelected(source);
    setMessage("");
    setPhotos([]);
    setChecked({});
    setClientSignature("");
    setRepresentativeSignature("");
    setReceivedBy(sourceClient(source));
    setDeliveredBy(COMPANY_LEGAL_NAME);
    setClientDocument(await resolveClientDocument(source));
    setClientComments("");
    setInternalNotes("");
    await loadOrCreateReport(source);
  }

  async function loadOrCreateReport(source: DeliverySource) {
    setLoading(true);

    const projectId = getProjectId(source);
    const verificationReportId = source.report_id || source.id;

    let existing = await supabase
      .from("final_delivery_reports")
      .select("*")
      .eq("verification_report_id", verificationReportId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existing.data && source.order_code) {
      existing = await supabase
        .from("final_delivery_reports")
        .select("*")
        .eq("order_code", source.order_code)
        .eq("module_name", sourceModule(source))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    if (existing.data) {
      const current = existing.data as DeliveryReport;
      const resolvedDocument = current.client_document || (await resolveClientDocument(source));
      setReport(current);
      setDeliveredBy(legalDeliveredBy(current.delivered_by));
      setReceivedBy(current.received_by || sourceClient(source));
      setClientDocument(resolvedDocument);
      setSatisfaction(current.satisfaction_score || 5);
      setClientComments(current.client_comments || "");
      setInternalNotes(current.internal_notes || "");
      await loadPhotos(current.id);
      await loadChecklist(current.id);
      await loadSignatures(current.id);
      setLoading(false);
      return;
    }

    const resolvedDocument = await resolveClientDocument(source);
    const payload: any = {
      verification_report_id: verificationReportId,
      project_id: projectId,
      order_code: sourceOrder(source),
      module_name: sourceModule(source),
      project_name: sourceName(source),
      client_name: sourceClient(source),
      client_phone: sourcePhone(source) || null,
      client_address: sourceAddress(source),
      delivered_by: COMPANY_LEGAL_NAME,
      received_by: sourceClient(source),
      client_document: resolvedDocument || null,
      delivery_status: "pendiente",
      final_status: "pendiente",
      satisfaction_score: 5,
      warranty_terms: `Garantía según política comercial de ${COMPANY_LEGAL_NAME}.`,
      gps_lat: gps?.lat || null,
      gps_lng: gps?.lng || null,
      gps_accuracy: gps?.accuracy || null,
    };

    const { data, error } = await supabase.from("final_delivery_reports").insert(payload).select().single();

    if (error) {
      setMessage("No pude crear acta: " + error.message);
      setLoading(false);
      return;
    }

    setReport(data as DeliveryReport);
    setLoading(false);
  }

  async function loadPhotos(reportId: string) {
    const { data } = await supabase
      .from("final_delivery_photos")
      .select("*")
      .eq("delivery_report_id", reportId)
      .order("created_at", { ascending: false });

    setPhotos((data || []) as DeliveryPhoto[]);
  }

  async function loadChecklist(reportId: string) {
    try {
      const { data } = await supabase
        .from("final_delivery_checklist")
        .select("*")
        .eq("delivery_report_id", reportId);

      const next: Record<string, boolean> = {};
      (data || []).forEach((row: any) => {
        const item = empty(row.item_name);
        if (item) next[item] = !!row.completed;
      });
      setChecked(next);
    } catch {
      setChecked({});
    }
  }

  async function loadSignatures(reportId: string) {
    try {
      const { data } = await supabase
        .from("final_delivery_signatures")
        .select("*")
        .eq("delivery_report_id", reportId)
        .order("created_at", { ascending: false });

      let client = "";
      let rep = "";
      (data || []).forEach((row: DeliverySignature) => {
        const text = `${row.acceptance_text || ""} ${row.signer_name || ""}`.toLowerCase();
        if (!rep && (text.includes("representante") || text.includes("entrega") || text.includes("rd wood"))) {
          rep = row.signature_data || "";
        } else if (!client) {
          client = row.signature_data || "";
        }
      });
      setClientSignature(client);
      setRepresentativeSignature(rep);
    } catch {
      setClientSignature("");
      setRepresentativeSignature("");
    }
  }

  async function uploadPhoto(file: File) {
    if (!selected || !report) {
      setMessage("Selecciona un proyecto primero.");
      return;
    }

    setSaving(true);
    setMessage("");

    const ext = file.name.split(".").pop() || "jpg";
    const path = `entrega-final/${sourceOrder(selected)}/${report.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("project-files").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "image/jpeg",
    });

    if (uploadError) {
      setMessage("Error subiendo foto: " + uploadError.message);
      setSaving(false);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("project-files").getPublicUrl(path);

    try {
      await insertCompatible("final_delivery_photos", {
        delivery_report_id: report.id,
        project_id: getProjectId(selected),
        order_code: sourceOrder(selected),
        module_name: sourceModule(selected),
        photo_url: publicUrl.publicUrl,
        photo_type: "final",
        file_name: file.name,
        description: "Foto final del proyecto entregado",
        uploaded_by: deliveredBy,
      });
      setMessage("Foto final subida.");
    } catch (error: any) {
      setMessage("Foto subida, pero fallo registro: " + error.message);
    }

    await loadPhotos(report.id);
    setSaving(false);
  }

  function getCanvas(target: "client" | "representative") {
    return target === "client" ? clientCanvasRef.current : representativeCanvasRef.current;
  }

  function initCanvas(target: "client" | "representative", image?: string) {
    const canvas = getCanvas(target);
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";

    if (image) {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = image;
    }
  }

  function getPoint(e: any, target: "client" | "representative") {
    const canvas = getCanvas(target);
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0];
    return {
      x: (touch?.clientX ?? e.clientX) - rect.left,
      y: (touch?.clientY ?? e.clientY) - rect.top,
    };
  }

  function startDraw(e: any, target: "client" | "representative") {
    e.preventDefault();
    setDrawingTarget(target);
    const canvas = getCanvas(target);
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const p = getPoint(e, target);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function moveDraw(e: any, target: "client" | "representative") {
    if (drawingTarget !== target) return;
    e.preventDefault();
    const canvas = getCanvas(target);
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const p = getPoint(e, target);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function endDraw(target: "client" | "representative") {
    if (drawingTarget !== target) return;
    setDrawingTarget(null);
    const canvas = getCanvas(target);
    if (!canvas) return;
    const data = canvas.toDataURL("image/png");
    if (target === "client") setClientSignature(data);
    else setRepresentativeSignature(data);
  }

  function clearSignature(target: "client" | "representative") {
    const canvas = getCanvas(target);
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    if (target === "client") setClientSignature("");
    else setRepresentativeSignature("");
  }

  async function saveChecklistRows(reportId: string) {
    await supabase.from("final_delivery_checklist").delete().eq("delivery_report_id", reportId);

    for (const item of CHECKLIST) {
      const base: any = {
        delivery_report_id: reportId,
        project_id: getProjectId(selected),
        order_code: sourceOrder(selected),
        module_name: sourceModule(selected),
        item_name: item,
        completed: !!checked[item],
      };
      await insertCompatible("final_delivery_checklist", base);
    }
  }

  async function saveSignatures(reportId: string) {
    await supabase.from("final_delivery_signatures").delete().eq("delivery_report_id", reportId);

    if (clientSignature) {
      await insertCompatible("final_delivery_signatures", {
        delivery_report_id: reportId,
        project_id: getProjectId(selected),
        order_code: sourceOrder(selected),
        module_name: sourceModule(selected),
        signer_name: receivedBy || sourceClient(selected),
        signer_document: clientDocument || null,
        signature_data: clientSignature,
        acceptance_text: "Firma cliente: confirma recepción conforme del proyecto.",
        gps_lat: gps?.lat || null,
        gps_lng: gps?.lng || null,
      });
    }

    if (representativeSignature) {
      await insertCompatible("final_delivery_signatures", {
        delivery_report_id: reportId,
        project_id: getProjectId(selected),
        order_code: sourceOrder(selected),
        module_name: sourceModule(selected),
        signer_name: deliveredBy || COMPANY_LEGAL_NAME,
        signer_document: null,
        signature_data: representativeSignature,
        acceptance_text: "Firma representante: entregó el proyecto al cliente.",
        gps_lat: gps?.lat || null,
        gps_lng: gps?.lng || null,
      });
    }
  }

  async function saveDraft(status = "firmado") {
    if (!selected || !report) {
      setMessage("Selecciona un proyecto.");
      return false;
    }

    setSaving(true);
    setMessage("");

    try {
      const payload: any = {
        delivered_by: legalDeliveredBy(deliveredBy),
        received_by: receivedBy || sourceClient(selected),
        client_document: clientDocument || null,
        satisfaction_score: satisfaction,
        client_comments: clientComments || null,
        internal_notes: internalNotes || null,
        delivery_status: status,
        final_status: status,
        gps_lat: gps?.lat || null,
        gps_lng: gps?.lng || null,
        gps_accuracy: gps?.accuracy || null,
        signed_at: clientSignature || representativeSignature ? new Date().toISOString() : report.signed_at || null,
        updated_at: new Date().toISOString(),
        checklist_completed: checklistDone,
        checklist_total: CHECKLIST.length,
      };

      if (status === "cerrado" || status === "entregado") {
        const warranty = warrantyWindow();
        payload.closed_at = new Date().toISOString();
        payload.delivered_at = new Date().toISOString();
        payload.delivery_closed = true;
        payload.signed_by_client = !!clientSignature;
        payload.qa_approved = true;
        payload.warranty_code = makeDeliveryCode(report);
        payload.warranty_start_at = warranty.startIso;
        payload.warranty_end_at = warranty.endIso;
        payload.warranty_status = "activa";
        payload.warranty_terms = `Garantía limitada de 12 meses sobre fabricación e instalación. Activa desde ${warranty.start.toLocaleDateString("es-DO")} hasta ${warranty.end.toLocaleDateString("es-DO")}.`;
      }

      const { error } = await supabase.from("final_delivery_reports").update(payload).eq("id", report.id);
      if (error) throw error;

      await saveChecklistRows(report.id);
      await saveSignatures(report.id);

      await loadOrCreateReport(selected);
      setMessage("✅ Acta de entrega guardada correctamente.");
      setSaving(false);
      return true;
    } catch (error: any) {
      setMessage("Error guardando acta: " + (error?.message || error));
      setSaving(false);
      return false;
    }
  }

  async function closeProject() {
    if (!selected || !report) return;

    if (!canClose) {
      setMessage("Para cerrar necesitas checklist completo, foto final, firma cliente, firma representante, nombre de quien recibe y documento del cliente.");
      return;
    }

    setSaving(true);

    const saved = await saveDraft("cerrado");
    if (!saved) {
      setSaving(false);
      return;
    }

    try {
      await supabase
        .from("verification_reports")
        .update({
          status: "entregado_final",
          qa_status: "entregado_final",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selected.report_id || selected.id);
    } catch {}

    try {
      await supabase
        .from("installation_assignments")
        .update({ assignment_status: "entregado_final", updated_at: new Date().toISOString() })
        .eq("order_code", sourceOrder(selected))
        .eq("module_name", sourceModule(selected));
    } catch {}

    const commercialClose = await activateCommercialClose(selected, report);
    const finalMessage = commercialClose.finalDue > 0
      ? ` Proyecto entregado. Pendiente final: RD$${commercialClose.finalDue.toLocaleString("es-DO")} después de descontar el abono RD$5,000. Garantía activa por 1 año.`
      : " Proyecto entregado, pago final cubierto y garantía activa por 1 año.";

    setMessage("✅ Entrega final cerrada." + finalMessage);
    await loadOrCreateReport(selected);
    await loadReadyForDelivery();
    setSaving(false);
  }

  async function saveAndPrint() {
    const ok = await saveDraft(report?.delivery_status || "firmado");
    if (ok) setTimeout(() => window.print(), 350);
  }

  function openWhatsAppClient() {
    if (!selected) return;
    const phone = phoneClean(sourcePhone(selected));
    if (!phone) {
      alert("Este cliente no tiene teléfono registrado.");
      return;
    }

    const photoText = firstPhoto ? `\nFoto final: ${firstPhoto}` : "";
    const text = `Hola ${sourceClient(selected)}, somos ${COMPANY_LEGAL_NAME}.\n\nSu proyecto fue entregado satisfactoriamente.\n\nOrden: ${sourceOrder(selected)}\nProyecto: ${sourceName(selected)}\nMódulo: ${sourceModule(selected)}\nGarantía: activa desde el cierre.${photoText}\n\nGracias por confiar en nosotros.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 8mm;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            min-height: auto !important;
            background: white !important;
            overflow: visible !important;
          }

          body * {
            visibility: hidden !important;
          }

          #print-acta,
          #print-acta * {
            visibility: visible !important;
          }

          #print-acta {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: #0f172a !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 11px !important;
            line-height: 1.22 !important;
          }

          .screen-only {
            display: none !important;
          }

          .print-page {
            width: 100% !important;
            min-height: auto !important;
            page-break-after: always !important;
            break-after: page !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }

          .print-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .print-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .print-card {
            border: 2px solid #111827 !important;
            border-radius: 16px !important;
            padding: 10px !important;
            margin-bottom: 9px !important;
            background: white !important;
            overflow: hidden !important;
          }

          .print-title {
            font-size: 30px !important;
            line-height: 1 !important;
            font-weight: 900 !important;
            margin: 4px 0 4px !important;
            letter-spacing: -1px !important;
          }

          .print-kicker {
            font-size: 10px !important;
            font-weight: 900 !important;
            letter-spacing: 5px !important;
            color: #334155 !important;
            text-transform: uppercase !important;
          }

          .print-grid-2 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
          }

          .print-grid-3 {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 10px !important;
          }

          .print-field {
            border: 2px solid #111827 !important;
            border-radius: 12px !important;
            padding: 8px !important;
            min-height: 42px !important;
          }

          .print-label {
            font-size: 8px !important;
            font-weight: 900 !important;
            letter-spacing: 4px !important;
            color: #334155 !important;
            text-transform: uppercase !important;
          }

          .print-value {
            margin-top: 4px !important;
            font-size: 11px !important;
            font-weight: 900 !important;
            color: #0f172a !important;
          }

          .print-status {
            border: 2px solid #111827 !important;
            border-radius: 16px !important;
            padding: 12px 20px !important;
            font-size: 18px !important;
            font-weight: 900 !important;
            text-align: center !important;
          }

          .print-checklist {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 7px !important;
            margin-top: 8px !important;
          }

          .print-check-item {
            border: 2px solid #111827 !important;
            border-radius: 10px !important;
            padding: 7px 8px !important;
            min-height: 32px !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            font-size: 10px !important;
            font-weight: 900 !important;
          }

          .print-check-box {
            width: 17px !important;
            height: 17px !important;
            border: 2px solid #111827 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 14px !important;
            line-height: 1 !important;
            color: #0f766e !important;
            flex: 0 0 auto !important;
          }

          .print-signatures {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 14px !important;
          }

          .print-sign-box {
            border: 2px solid #111827 !important;
            border-radius: 16px !important;
            padding: 10px !important;
            min-height: 150px !important;
          }

          .print-sign-image {
            width: 100% !important;
            height: 82px !important;
            object-fit: contain !important;
            border: 2px solid #111827 !important;
            border-radius: 10px !important;
            background: white !important;
            display: block !important;
          }

          .print-sign-name {
            border-top: 2px solid #111827 !important;
            margin-top: 8px !important;
            padding-top: 6px !important;
            text-align: center !important;
            font-size: 10px !important;
            font-weight: 900 !important;
          }

          .print-photo {
            width: 100% !important;
            max-height: 245px !important;
            object-fit: cover !important;
            border: 2px solid #111827 !important;
            border-radius: 12px !important;
            display: block !important;
          }

          .print-footer {
            border-top: 3px solid #111827 !important;
            margin-top: 10px !important;
            padding-top: 8px !important;
            font-size: 9px !important;
            font-weight: 800 !important;
          }
        }
      `}</style>

      <div className="screen-only px-4 py-5 md:px-8">
        <div className="mx-auto max-w-[1600px]">
          <section className="rounded-[30px] border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-[#07111f] to-blue-950 p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                  FASE 41 · ENTREGA FINAL DIGITAL
                </div>
                <h1 className="mt-4 text-4xl font-black md:text-6xl">Entrega Final Digital PRO</h1>
                <p className="mt-2 text-sm font-semibold text-slate-300">Acta limpia, doble firma digital, checklist validado y cierre definitivo.</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={loadReadyForDelivery} className="inline-flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-black uppercase text-slate-950">
                  <RefreshCw size={18} /> Actualizar
                </button>
                <button onClick={saveAndPrint} disabled={!selected || !report || saving} className="inline-flex items-center gap-3 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-5 py-4 text-sm font-black uppercase text-cyan-100 disabled:opacity-40">
                  <Download size={18} /> Guardar + imprimir
                </button>
                <button onClick={openWhatsAppClient} disabled={!selected} className="inline-flex items-center gap-3 rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black uppercase text-slate-950 disabled:opacity-40">
                  WhatsApp cliente
                </button>
              </div>
            </div>
          </section>

          {message && (
            <div className="mt-4 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm font-black text-cyan-100">
              {message}
            </div>
          )}

          <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat title="Proyectos" value={dashboard.proyectos} />
            <MiniStat title="Fotos finales" value={dashboard.fotos} />
            <MiniStat title="Checklist" value={dashboard.checklist} />
            <MiniStat title="Estado" value={dashboard.estado} />
          </section>

          <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[430px_1fr_420px]">
            <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5">
              <h2 className="text-2xl font-black">Proyectos listos</h2>
              <p className="text-sm text-slate-400">Liberados por Verificación QA.</p>

              <div className="relative mt-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar proyecto, cliente..."
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-4 pl-12 pr-4 text-sm font-black outline-none focus:border-cyan-400"
                />
              </div>

              <div className="mt-4 max-h-[760px] space-y-3 overflow-auto pr-2">
                {loading && <div className="p-6 text-center text-slate-400">Cargando...</div>}
                {!loading && filteredSources.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm font-bold text-slate-400">
                    No hay proyectos liberados por QA para entrega final.
                  </div>
                )}
                {filteredSources.map((p) => (
                  <button
                    key={sourceKey(p)}
                    onClick={() => selectSource(p)}
                    className={[
                      "w-full rounded-2xl border p-4 text-left transition",
                      selected && sourceKey(selected) === sourceKey(p)
                        ? "border-cyan-400 bg-cyan-400/10"
                        : "border-slate-800 bg-slate-950 hover:border-cyan-400/40",
                    ].join(" ")}
                  >
                    <div className="text-xs font-black uppercase tracking-widest text-cyan-300">{sourceOrder(p)}</div>
                    <div className="mt-1 text-lg font-black">{sourceModule(p)}</div>
                    <div className="mt-1 text-xs text-slate-400">{sourceName(p)}</div>
                    <div className="mt-2 text-xs text-slate-400">{sourceClient(p)} · {sourcePhone(p) || "Sin teléfono"}</div>
                    <div className="mt-3 text-xs font-black text-emerald-300">QA aprobado · {Number(p.qa_score || p.score || 100)}%</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5">
              {!selected ? (
                <div className="flex min-h-[650px] flex-col items-center justify-center text-center">
                  <FileSignature className="text-slate-700" size={90} />
                  <h2 className="mt-5 text-3xl font-black">Selecciona un proyecto</h2>
                  <p className="mt-2 max-w-md text-sm text-slate-400">Aquí se genera el acta final de entrega.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-cyan-300">{COMPANY_LEGAL_NAME.toUpperCase()}</div>
                      <h2 className="mt-1 text-3xl font-black">Acta de Entrega Final</h2>
                      <p className="text-sm text-slate-400">Documento de recepción conforme, garantía y cierre.</p>
                    </div>
                    <span className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm font-black uppercase text-emerald-300">
                      {report?.delivery_status || "pendiente"}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <ReadBox label="Orden" value={sourceOrder(selected)} />
                    <ReadBox label="Módulo" value={sourceModule(selected)} />
                    <ReadBox label="Proyecto" value={sourceName(selected)} />
                    <ReadBox label="Estado QA" value={`Aprobado · ${Number(selected.qa_score || selected.score || 100)}%`} />
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-xs font-black uppercase tracking-widest text-cyan-300">Cliente</div>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <ReadBox label="Nombre" value={sourceClient(selected)} />
                      <ReadBox label="Teléfono" value={sourcePhone(selected) || "Sin teléfono"} />
                      <ReadBox label="Dirección" value={sourceAddress(selected)} />
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-widest text-cyan-300">Foto final</div>
                        <p className="mt-1 text-sm font-semibold text-slate-300">Evidencia visual del proyecto entregado.</p>
                      </div>
                      <span className={["rounded-full px-3 py-1 text-xs font-black uppercase", firstPhoto ? "bg-emerald-400 text-slate-950" : "bg-rose-500/15 text-rose-300"].join(" ")}>
                        {firstPhoto ? "Cargada" : "Pendiente"}
                      </span>
                    </div>
                    {firstPhoto ? (
                      <a href={firstPhoto} target="_blank" className="mt-4 block overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-950">
                        <img src={firstPhoto} alt="Foto final del proyecto" className="h-72 w-full object-cover" />
                      </a>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center text-sm font-black text-slate-400">
                        Sube la foto final para completar el acta y anexarla al WhatsApp del cliente.
                      </div>
                    )}
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-xs font-black uppercase tracking-widest text-cyan-300">Recepción</div>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Input label="Entregado por" value={deliveredBy} onChange={setDeliveredBy} />
                      <Input label="Recibido por" value={receivedBy} onChange={setReceivedBy} />
                      <Input label="Documento cliente" value={clientDocument} onChange={setClientDocument} />
                      <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-500">Satisfacción</div>
                        <div className="mt-3 flex gap-2">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} onClick={() => setSatisfaction(n)}>
                              <Star className={n <= satisfaction ? "fill-amber-300 text-amber-300" : "text-slate-600"} size={24} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-widest text-cyan-300">Checklist de entrega</h3>
                      <span className="rounded-full bg-emerald-300 px-3 py-1 text-sm font-black text-slate-950">{checklistDone}/{CHECKLIST.length}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {CHECKLIST.map((item) => (
                        <label key={item} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3">
                          <input type="checkbox" checked={!!checked[item]} onChange={(e) => setChecked({ ...checked, [item]: e.target.checked })} className="h-5 w-5 accent-cyan-400" />
                          <span className="text-sm font-black">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <textarea value={clientComments} onChange={(e) => setClientComments(e.target.value)} className="mt-5 h-24 w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-400" placeholder="Comentarios del cliente..." />
                  <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} className="mt-3 h-20 w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-400" placeholder="Notas internas..." />

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <SignaturePad
                      title="Firma del cliente"
                      subtitle={receivedBy || sourceClient(selected)}
                      canvasRef={clientCanvasRef}
                      onStart={(e) => startDraw(e, "client")}
                      onMove={(e) => moveDraw(e, "client")}
                      onEnd={() => endDraw("client")}
                      onClear={() => clearSignature("client")}
                    />
                    <SignaturePad
                      title="Firma representante"
                      subtitle={deliveredBy || COMPANY_LEGAL_NAME}
                      canvasRef={representativeCanvasRef}
                      onStart={(e) => startDraw(e, "representative")}
                      onMove={(e) => moveDraw(e, "representative")}
                      onEnd={() => endDraw("representative")}
                      onClear={() => clearSignature("representative")}
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button onClick={() => saveDraft("firmado")} disabled={saving} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-cyan-400 px-5 py-4 text-sm font-black uppercase text-slate-950 disabled:opacity-50">
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      Guardar acta
                    </button>

                    <button onClick={closeProject} disabled={saving || !canClose} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black uppercase text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                      <CheckCircle2 size={18} />
                      Cerrar proyecto
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-5">
              <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5">
                <h2 className="text-2xl font-black">Evidencia final</h2>
                <p className="text-sm text-slate-400">Foto del proyecto terminado.</p>

                <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-5 py-5 text-sm font-black text-cyan-100">
                  <UploadCloud size={20} />
                  Subir foto final
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

                <div className="mt-4 grid grid-cols-1 gap-3">
                  {photos.map((p) => (
                    <a key={p.id} href={p.photo_url} target="_blank" className="overflow-hidden rounded-2xl border border-slate-800">
                      <img src={p.photo_url} alt="Foto final" className="h-52 w-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5">
                <h2 className="text-2xl font-black">Condición de cierre</h2>
                <div className="mt-4 space-y-3">
                  <Condition ok={checklistDone === CHECKLIST.length} label="Checklist completo" />
                  <Condition ok={photos.length > 0} label="Al menos una foto final" />
                  <Condition ok={!!clientSignature} label="Firma del cliente" />
                  <Condition ok={!!representativeSignature} label="Firma representante" />
                  <Condition ok={!!receivedBy} label="Nombre de quien recibe" />
                  <Condition ok={!!clientDocument} label="Documento del cliente" />
                </div>

                {gps && (
                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs font-bold text-slate-300">
                    GPS: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} ± {Math.round(gps.accuracy || 0)}m
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      <div id="print-acta" className="hidden">
        {selected && (
          <>
            <div className="print-page">
              <div className="print-avoid" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #111827", paddingBottom: 10, marginBottom: 10 }}>
                <div>
                  <div className="print-kicker">{COMPANY_LEGAL_NAME.toUpperCase()}</div>
                  <div className="print-title">Acta de Entrega Final</div>
                  <div style={{ fontWeight: 700 }}>Documento de recepción conforme, garantía y cierre definitivo del proyecto.</div>
                  <div style={{ marginTop: 12, fontWeight: 900 }}>Fecha: {todayText()} &nbsp;&nbsp;&nbsp; Acta: {makeDeliveryCode(report)}</div>
                </div>
                <div className="print-status">{String(report?.delivery_status || "FIRMADO").toUpperCase()}</div>
              </div>

              <div className="print-grid-2 print-avoid">
                <PrintField label="Orden" value={sourceOrder(selected)} />
                <PrintField label="Módulo" value={sourceModule(selected)} />
              </div>
              <div className="print-avoid" style={{ marginTop: 9 }}>
                <PrintField label="Proyecto" value={sourceName(selected)} />
              </div>
              <div className="print-avoid" style={{ marginTop: 9, maxWidth: "50%" }}>
                <PrintField label="Estado QA" value={`Aprobado · ${Number(selected.qa_score || selected.score || 100)}%`} />
              </div>

              <div className="print-card print-avoid" style={{ marginTop: 12 }}>
                <div className="print-kicker" style={{ marginBottom: 8 }}>Cliente</div>
                <div className="print-grid-3">
                  <PrintField label="Nombre" value={sourceClient(selected)} />
                  <PrintField label="Teléfono" value={sourcePhone(selected) || "Sin teléfono"} />
                  <PrintField label="Dirección" value={sourceAddress(selected)} />
                </div>
              </div>

              <div className="print-card print-avoid">
                <div className="print-kicker" style={{ marginBottom: 8 }}>Recepción</div>
                <div className="print-grid-2">
                  <PrintField label="Entregado por" value={legalDeliveredBy(deliveredBy)} />
                  <PrintField label="Recibido por" value={receivedBy || sourceClient(selected)} />
                  <PrintField label="Documento cliente" value={clientDocument || "—"} />
                  <PrintField label="Satisfacción" value={`${satisfaction}/5`} />
                </div>
                <div style={{ marginTop: 9 }}>
                  <PrintField label="Garantía" value={`Activa desde cierre · QA ${Number(selected.qa_score || selected.score || 100)}%`} />
                </div>
              </div>

              <div className="print-card print-avoid">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div className="print-kicker">Checklist de entrega</div>
                  <div style={{ border: "2px solid #111827", borderRadius: 999, padding: "5px 12px", fontSize: 14, fontWeight: 900, background: checklistDone === CHECKLIST.length ? "#bbf7d0" : "white" }}>
                    {checklistDone}/{CHECKLIST.length}
                  </div>
                </div>
                <div className="print-checklist">
                  {CHECKLIST.map((item) => (
                    <div className="print-check-item" key={item}>
                      <span className="print-check-box">{checked[item] ? "✓" : ""}</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="print-page">
              <div className="print-card print-avoid">
                <div className="print-kicker" style={{ marginBottom: 8 }}>Comentarios del cliente</div>
                <div style={{ border: "2px solid #111827", borderRadius: 12, minHeight: 56, padding: 10, fontWeight: 900 }}>
                  {clientComments || "—"}
                </div>
              </div>

              <div className="print-signatures print-avoid">
                <div className="print-sign-box">
                  <div className="print-kicker" style={{ textAlign: "center", marginBottom: 8 }}>Firma del cliente</div>
                  {clientSignature ? <img src={clientSignature} className="print-sign-image" alt="Firma del cliente" /> : <div className="print-sign-image" />}
                  <div className="print-sign-name">{receivedBy || sourceClient(selected)}</div>
                </div>
                <div className="print-sign-box">
                  <div className="print-kicker" style={{ textAlign: "center", marginBottom: 8 }}>Firma representante</div>
                  {representativeSignature ? <img src={representativeSignature} className="print-sign-image" alt="Firma representante" /> : <div className="print-sign-image" />}
                  <div className="print-sign-name">{legalDeliveredBy(deliveredBy)}</div>
                </div>
              </div>

              <div className="print-card print-avoid" style={{ marginTop: 12 }}>
                <div className="print-kicker" style={{ marginBottom: 8 }}>Evidencias finales</div>
                {firstPhoto ? <img src={firstPhoto} className="print-photo" alt="Foto final" /> : <div style={{ fontWeight: 900 }}>Sin foto final</div>}
                <div style={{ marginTop: 5, fontWeight: 900, fontSize: 10 }}>Foto final del proyecto entregado</div>
              </div>

              <div className="print-footer print-avoid">
                <div>{COMPANY_LEGAL_NAME} · Entrega Final Digital PRO</div>
                {gps && <div>GPS cierre: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} ± {Math.round(gps.accuracy || 0)}m</div>}
                <div>Este documento confirma recepción conforme del proyecto indicado y activa la garantía según la política comercial vigente.</div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function MiniStat({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07111f] p-4">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</div>
      <div className="mt-2 truncate text-2xl font-black">{value}</div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block rounded-2xl border border-slate-700 bg-slate-950 p-4">
      <div className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full bg-transparent text-sm font-black outline-none" />
    </label>
  );
}

function ReadBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
      <div className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-black">{value || "—"}</div>
    </div>
  );
}

function PrintField({ label, value }: { label: string; value: string }) {
  return (
    <div className="print-field">
      <div className="print-label">{label}</div>
      <div className="print-value">{value || "—"}</div>
    </div>
  );
}

function Condition({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <span className="text-sm font-black">{label}</span>
      {ok ? <BadgeCheck className="text-emerald-300" /> : <XCircle className="text-red-300" />}
    </div>
  );
}

function SignaturePad({
  title,
  subtitle,
  canvasRef,
  onStart,
  onMove,
  onEnd,
  onClear,
}: {
  title: string;
  subtitle: string;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onStart: (e: any) => void;
  onMove: (e: any) => void;
  onEnd: () => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xl font-black">{title}</h3>
        <button onClick={onClear} className="rounded-xl border border-red-500/30 px-3 py-2 text-xs font-black text-red-300">
          Limpiar
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={onStart}
        onMouseMove={onMove}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        className="h-40 w-full rounded-xl border border-slate-300 bg-white touch-none"
      />
      <div className="mt-3 border-t border-slate-700 pt-2 text-center text-xs font-black uppercase text-slate-200">
        {subtitle || "—"}
      </div>
    </div>
  );
}
