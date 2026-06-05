"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  ImageIcon,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UploadCloud,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { registerOperationalCompensationEvents } from "@/lib/rrhh/operational-compensation";

type InstallationAssignment = {
  id?: string;
  order_code: string;
  module_name: string;
  project_name?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  installer_1_name?: string | null;
  installer_1_phone?: string | null;
  installer_2_name?: string | null;
  installer_2_phone?: string | null;
  assignment_status?: string | null;
  qa_status?: string | null;
  notes?: string | null;
  installed_at?: string | null;
  updated_at?: string | null;
};

type InstallationHandoff = {
  id?: string;
  order_code: string;
  module_name: string;
  client_name?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  project_name?: string | null;
  handoff_status?: string | null;
  delivered_by?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  gps_accuracy?: number | null;
  notes?: string | null;
  delivered_at?: string | null;
  created_at?: string | null;
};

type InstallationEvent = {
  id?: string;
  order_code: string;
  module_name: string;
  event_type?: string | null;
  event_status?: string | null;
  team_name?: string | null;
  installer_1_name?: string | null;
  installer_2_name?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  gps_accuracy?: number | null;
  photo_url?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type InstallScan = {
  id?: string;
  order_code?: string | null;
  project_id?: string | null;
  module_code?: string | null;
  module_name?: string | null;
  qr_value?: string | null;
  installer_name?: string | null;
  installer_1_name?: string | null;
  installer_2_name?: string | null;
  scan_status?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  installed_at?: string | null;
  created_at?: string | null;
};

type VerificationReport = {
  id: string;
  project_id?: string | null;
  order_code?: string | null;
  module_name?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  qa_supervisor?: string | null;
  installer_1?: string | null;
  installer_2?: string | null;
  driver_name?: string | null;
  vehicle?: string | null;
  status?: string | null;
  score?: number | null;
  checklist?: Record<string, boolean> | null;
  notes?: string | null;
  supervisor_signature?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type VerificationIssue = {
  id: string;
  report_id?: string | null;
  project_id?: string | null;
  order_code?: string | null;
  module_name?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  category: string;
  description: string;
  severity: string;
  assigned_to?: string | null;
  assigned_role?: string | null;
  due_date?: string | null;
  status: string;
  corrective_action?: string | null;
  qa_notes?: string | null;
  created_by?: string | null;
  closed_by?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type IssuePhoto = {
  id: string;
  issue_id: string;
  photo_url: string;
  photo_type?: string | null;
  description?: string | null;
  created_at?: string | null;
};

type GeneralPhoto = {
  id: string;
  report_id?: string | null;
  project_id?: string | null;
  order_code?: string | null;
  module_name?: string | null;
  photo_url: string;
  photo_type?: string | null;
  notes?: string | null;
  uploaded_by?: string | null;
  created_at?: string | null;
};

type QaModule = {
  key: string;
  project_id: string;
  order_code: string;
  module_name: string;
  project_name: string;
  client_name: string;
  client_phone: string;
  client_address: string;
  installer_1: string;
  installer_2: string;
  team_name: string;
  driver_name: string;
  driver_phone: string;
  vehicle: string;
  gpsText: string;
  installed_at: string;
  assignment?: InstallationAssignment | null;
  handoff?: InstallationHandoff | null;
  scans: InstallScan[];
  events: InstallationEvent[];
  report?: VerificationReport | null;
  issues: VerificationIssue[];
  photos: GeneralPhoto[];
  status: string;
  score: number;
};

const CHECKLIST = [
  "Nivelación correcta",
  "Puertas alineadas",
  "Correderas funcionando",
  "Herrajes completos",
  "Silicón aplicado",
  "Canteos perfectos",
  "Escuadre correcto",
  "Limpieza final",
  "Protección retirada",
  "Cliente conforme",
];

function checklistForModule(module?: QaModule | null) {
  if (!module) return CHECKLIST;

  const text = normalizeForCompare(`${module.module_name} ${module.project_name}`);
  const excluded = new Set<string>();

  if (text.includes("panel") || text.includes("decorativo") || text.includes("repisa") || text.includes("repisas")) {
    excluded.add("Puertas alineadas");
    excluded.add("Correderas funcionando");
  }

  if (text.includes("panel") || text.includes("decorativo")) {
    excluded.add("Herrajes completos");
  }

  return CHECKLIST.filter((item) => !excluded.has(item));
}

const ISSUE_CATEGORIES = [
  "Nivelación",
  "Puertas",
  "Correderas",
  "Herrajes",
  "Canteo",
  "Terminación",
  "Limpieza",
  "Medidas",
  "Daño material",
  "Cliente",
  "Otro",
];

const SEVERITIES = ["baja", "media", "alta", "critica"];
const ISSUE_STATUS = ["pendiente", "en_correccion", "corregido", "cerrado", "rechazado"];

function clean(value: any) {
  return String(value ?? "").trim();
}

function firstText(...values: any[]) {
  for (const value of values) {
    const t = clean(value);
    if (t && t !== "null" && t !== "undefined") return t;
  }
  return "";
}

function keyFor(orderCode: string, moduleName: string) {
  return `${orderCode || "SIN-ORDEN"}__${moduleName || "SIN-MODULO"}`;
}

function normalize(value?: string | null) {
  return clean(value).toLowerCase() || "pendiente";
}

function statusLabel(value?: string | null) {
  const s = normalize(value);
  const map: Record<string, string> = {
    pendiente_qa: "Pendiente QA",
    en_revision: "En revisión",
    observado: "Observado",
    rechazado: "Rechazado",
    retrabajo: "Retrabajo",
    aprobado: "Aprobado",
    liberado_entrega_final: "Liberado entrega final",
  };
  return map[s] || s.replaceAll("_", " ");
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

function severityClass(severity: string) {
  if (severity === "critica") return "border-red-500/30 bg-red-500/15 text-red-300";
  if (severity === "alta") return "border-orange-500/30 bg-orange-500/15 text-orange-300";
  if (severity === "media") return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  return "border-cyan-500/30 bg-cyan-500/15 text-cyan-300";
}

function statusClass(status: string) {
  if (status === "cerrado") return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
  if (status === "corregido") return "border-blue-500/30 bg-blue-500/15 text-blue-300";
  if (status === "en_correccion") return "border-purple-500/30 bg-purple-500/15 text-purple-300";
  if (status === "rechazado") return "border-red-500/30 bg-red-500/15 text-red-300";
  return "border-amber-500/30 bg-amber-500/15 text-amber-300";
}

function phoneClean(value: string) {
  let phone = clean(value).replace(/\D/g, "");
  if (phone.length === 10) phone = `1${phone}`;
  return phone;
}

function isUuid(value?: string | null) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value));
}

function nullableUuid(value?: string | null) {
  const v = clean(value);
  return isUuid(v) ? v : null;
}

function meaningfulText(value?: string | null) {
  const v = clean(value);
  const normalized = normalizeForCompare(v);
  if (["cliente", "proyecto", "sin telefono", "sin direccion", "sin equipo"].includes(normalized)) return "";
  return v;
}

function resolveProjectUuidFromRows(params: { orderCode: string; projectName: string; clientName: string; lookupRows: any[] }) {
  const { orderCode, projectName, clientName, lookupRows } = params;
  const candidates = [
    ...lookupRows.filter((row) => rowMatchesOrder(row, orderCode)),
    ...lookupRows.filter((row) => rowMatchesProjectOrClient(row, projectName, clientName)),
  ];

  for (const row of candidates) {
    const found = firstText(row?.project_id, row?.project_uuid, row?.furniture_project_id, row?.id);
    if (isUuid(found)) return found;
  }
  return "";
}

function fallbackQaProjectUuid(module: {
  project_id?: string | null;
  scans?: Array<{ id?: string | null }>;
  assignment?: { id?: string | null } | null;
  handoff?: { id?: string | null } | null;
  events?: Array<{ id?: string | null }>;
}) {
  return firstText(
    nullableUuid(module.project_id),
    nullableUuid(module.scans?.[0]?.id),
    nullableUuid(module.assignment?.id),
    nullableUuid(module.handoff?.id),
    nullableUuid(module.events?.[0]?.id)
  );
}

function qaModuleGroupKey(module: QaModule) {
  return [
    normalizeForCompare(module.client_name || "cliente"),
    normalizeForCompare(module.project_name || "proyecto"),
    normalizeForCompare(module.module_name),
  ].join("__");
}

function qaModuleTimestamp(module: QaModule) {
  const dates = [
    module.report?.updated_at,
    module.assignment?.updated_at,
    module.installed_at,
    module.handoff?.delivered_at,
    ...module.scans.map((scan) => scan.installed_at || scan.created_at),
    ...module.events.map((event) => event.created_at),
  ]
    .map((value) => (value ? new Date(value).getTime() : 0))
    .filter((value) => Number.isFinite(value));

  return Math.max(0, ...dates);
}

function qaModuleCompleteness(module: QaModule) {
  return [
    module.client_name,
    module.client_phone,
    module.client_address,
    module.team_name,
    module.installer_1,
    module.installer_2,
    module.driver_name,
    module.vehicle,
    module.project_id,
  ].filter((value) => Boolean(meaningfulText(value))).length + module.photos.length + module.scans.length;
}

function dedupeQaModules(modules: QaModule[]) {
  const best = new Map<string, QaModule>();

  for (const module of modules) {
    const key = qaModuleGroupKey(module);
    const current = best.get(key);
    if (!current) {
      best.set(key, module);
      continue;
    }

    const moduleScore = qaModuleCompleteness(module);
    const currentScore = qaModuleCompleteness(current);
    if (
      moduleScore > currentScore ||
      (moduleScore === currentScore && qaModuleTimestamp(module) > qaModuleTimestamp(current))
    ) {
      best.set(key, module);
    }
  }

  return Array.from(best.values());
}

async function safeLoadTable(tableName: string) {
  try {
    const { data, error } = await supabase.from(tableName).select("*").limit(1000);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}


function normalizeForCompare(value: any) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

function rowText(row: any, keys: string[]) {
  if (!row) return "";
  return firstText(...keys.map((key) => row?.[key]));
}

function rowMatchesOrder(row: any, orderCode: string) {
  const target = normalizeForCompare(orderCode);
  if (!target || !row) return false;

  const values = [
    row.order_code,
    row.code,
    row.production_code,
    row.production_order_code,
    row.work_order_code,
    row.order_number,
    row.order_id,
    row.production_order_id,
    row.project_id,
    row.id,
  ].map(normalizeForCompare);

  return values.some((value) => value && (value === target || value.includes(target) || target.includes(value)));
}

function rowMatchesProjectOrClient(row: any, projectName: string, clientName: string) {
  if (!row) return false;

  const project = normalizeForCompare(projectName);
  const client = normalizeForCompare(clientName);

  const rowProject = normalizeForCompare(
    row.project_name || row.project || row.project_title || row.name || row.title || row.area || row.description
  );

  const rowClient = normalizeForCompare(
    row.client_name || row.customer_name || row.customer || row.nombre_cliente || row.name || row.nombre || row.full_name
  );

  return Boolean(
    (project && rowProject && (rowProject.includes(project) || project.includes(rowProject))) ||
      (client && rowClient && (rowClient.includes(client) || client.includes(rowClient)))
  );
}

function resolveBestClientInfo(params: {
  orderCode: string;
  projectName: string;
  clientName: string;
  currentPhone: string;
  currentAddress: string;
  lookupRows: any[];
}) {
  const { orderCode, projectName, clientName, currentPhone, currentAddress, lookupRows } = params;

  const orderRows = lookupRows.filter((row) => rowMatchesOrder(row, orderCode));
  const softRows = lookupRows.filter((row) => rowMatchesProjectOrClient(row, projectName, clientName));
  const singleContractFallback = lookupRows.filter((row) => row?.__source === "project_contracts");
  const shouldUseSingleContractFallback =
    !meaningfulText(projectName) && !meaningfulText(clientName) && singleContractFallback.length === 1;
  const candidates = [...orderRows, ...softRows, ...(shouldUseSingleContractFallback ? singleContractFallback : [])];

  const resolvedClient = firstText(
    meaningfulText(clientName),
    ...candidates.map((row) =>
      rowText(row, [
        "client_name",
        "customer_name",
        "customer",
        "nombre_cliente",
        "name",
        "nombre",
        "full_name",
      ])
    )
  );

  const resolvedProject = firstText(
    meaningfulText(projectName),
    ...candidates.map((row) =>
      rowText(row, ["project_name", "project", "project_title", "title", "name", "area", "description"])
    )
  );

  const resolvedPhone = firstText(
    meaningfulText(currentPhone),
    ...candidates.map((row) =>
      rowText(row, [
        "client_phone",
        "phone",
        "telefono",
        "tel",
        "mobile",
        "whatsapp",
        "contact_phone",
        "customer_phone",
        "phone_number",
        "celular",
      ])
    )
  );

  const resolvedAddress = firstText(
    meaningfulText(currentAddress),
    ...candidates.map((row) =>
      rowText(row, [
        "client_address",
        "address",
        "direccion",
        "location",
        "location_text",
        "address_text",
        "project_address",
        "installation_address",
        "delivery_address",
        "site_address",
        "ubicacion",
      ])
    )
  );

  return {
    client_name: resolvedClient || clientName || "Cliente",
    project_name: resolvedProject || projectName || "Proyecto",
    client_phone: resolvedPhone,
    client_address: resolvedAddress,
  };
}

async function uploadFile(pathPrefix: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${pathPrefix}/${Date.now()}-${safeName}.${ext}`;
  const { error } = await supabase.storage.from("project-files").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  const { data } = supabase.storage.from("project-files").getPublicUrl(path);
  return data.publicUrl;
}

export default function VerificacionQaProPage() {
  const [assignments, setAssignments] = useState<InstallationAssignment[]>([]);
  const [handoffs, setHandoffs] = useState<InstallationHandoff[]>([]);
  const [installationEvents, setInstallationEvents] = useState<InstallationEvent[]>([]);
  const [scans, setScans] = useState<InstallScan[]>([]);
  const [reports, setReports] = useState<VerificationReport[]>([]);
  const [issues, setIssues] = useState<VerificationIssue[]>([]);
  const [issuePhotos, setIssuePhotos] = useState<IssuePhoto[]>([]);
  const [generalPhotos, setGeneralPhotos] = useState<GeneralPhoto[]>([]);
  const [lookupRows, setLookupRows] = useState<any[]>([]);

  const [selectedKey, setSelectedKey] = useState("");
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("todos");
  const [qaSupervisor, setQaSupervisor] = useState("Supervisor QA");
  const [qaNotes, setQaNotes] = useState("");
  const [signature, setSignature] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [photoType, setPhotoType] = useState("qa_general");
  const [photoNotes, setPhotoNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [issueForm, setIssueForm] = useState({
    category: "Terminación",
    description: "",
    severity: "media",
    assigned_to: "Equipo de instalación",
    due_date: "",
    corrective_action: "",
  });

  const generalPhotoRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");
    try {
      const [
        assignmentRows,
        handoffRows,
        eventRows,
        scanRows,
        reportRows,
        issueRows,
        issuePhotoRows,
        generalPhotoRows,
        assemblyRows,
        pieceRows,
        transportRows,
        productionRows,
        quoteRows,
        contractRows,
        clientRows,
        designRows,
        projectRows,
      ] = await Promise.all([
        safeLoadTable("installation_assignments"),
        safeLoadTable("installation_handoffs"),
        safeLoadTable("installation_module_events"),
        safeLoadTable("project_installation_scans"),
        safeLoadTable("verification_reports"),
        safeLoadTable("verification_issues"),
        safeLoadTable("verification_issue_photos"),
        safeLoadTable("verification_general_photos"),
        safeLoadTable("assembly_module_checks"),
        safeLoadTable("piece_labels"),
        safeLoadTable("transport_module_events"),
        safeLoadTable("production_orders"),
        safeLoadTable("quotes"),
        safeLoadTable("project_contracts"),
        safeLoadTable("clients"),
        safeLoadTable("ai_design_requests"),
        safeLoadTable("furniture_projects"),
      ]);

      setAssignments(assignmentRows as InstallationAssignment[]);
      setHandoffs(handoffRows as InstallationHandoff[]);
      setInstallationEvents(eventRows as InstallationEvent[]);
      setScans(scanRows as InstallScan[]);
      setReports(reportRows as VerificationReport[]);
      setIssues(issueRows as VerificationIssue[]);
      setIssuePhotos(issuePhotoRows as IssuePhoto[]);
      setGeneralPhotos(generalPhotoRows as GeneralPhoto[]);
      setLookupRows([
        ...(assemblyRows as any[]),
        ...(pieceRows as any[]),
        ...(transportRows as any[]),
        ...(productionRows as any[]),
        ...(quoteRows as any[]),
        ...(contractRows as any[]).map((row) => ({ ...row, __source: "project_contracts" })),
        ...(clientRows as any[]),
        ...(designRows as any[]),
        ...(projectRows as any[]),
      ]);
    } catch (error: any) {
      setMessage(`⚠️ Error cargando Verificación: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  }

  const modules = useMemo<QaModule[]>(() => {
    const map = new Map<string, QaModule>();

    function ensure(order_code: string, module_name: string) {
      const key = keyFor(order_code, module_name);
      if (!map.has(key)) {
        map.set(key, {
          key,
          project_id: "",
          order_code,
          module_name,
          project_name: "Proyecto",
          client_name: "Cliente",
          client_phone: "",
          client_address: "",
          installer_1: "",
          installer_2: "",
          team_name: "",
          driver_name: "",
          driver_phone: "",
          vehicle: "",
          gpsText: "—",
          installed_at: "",
          scans: [],
          events: [],
          issues: [],
          photos: [],
          status: "pendiente_qa",
          score: 0,
        });
      }
      return map.get(key)!;
    }

    assignments.forEach((a) => {
      const m = ensure(a.order_code, a.module_name);
      m.assignment = a;
      m.project_name = firstText(a.project_name, m.project_name);
      m.client_name = firstText(a.client_name, m.client_name);
      m.client_phone = firstText(a.client_phone, m.client_phone);
      m.client_address = firstText(a.client_address, m.client_address);
      m.installer_1 = firstText(a.installer_1_name, m.installer_1);
      m.installer_2 = firstText(a.installer_2_name, m.installer_2);
      m.team_name = firstText(a.team_name, m.team_name);
      m.installed_at = firstText(a.installed_at, m.installed_at);
    });

    handoffs.forEach((h) => {
      const m = ensure(h.order_code, h.module_name);
      m.handoff = h;
      m.project_name = firstText(h.project_name, m.project_name);
      m.client_name = firstText(h.client_name, m.client_name);
      m.client_phone = firstText(h.client_phone, m.client_phone);
      m.client_address = firstText(h.client_address, m.client_address);
      m.driver_name = firstText(h.driver_name, h.delivered_by, m.driver_name);
      m.driver_phone = firstText(h.driver_phone, m.driver_phone);
      m.vehicle = firstText(h.vehicle, m.vehicle);
      m.gpsText = h.gps_lat && h.gps_lng ? `${Number(h.gps_lat).toFixed(6)}, ${Number(h.gps_lng).toFixed(6)}` : m.gpsText;
    });

    installationEvents.forEach((ev) => {
      const m = ensure(ev.order_code, ev.module_name);
      m.events.push(ev);
      m.team_name = firstText(ev.team_name, m.team_name);
      m.installer_1 = firstText(ev.installer_1_name, m.installer_1);
      m.installer_2 = firstText(ev.installer_2_name, m.installer_2);
    });

    scans.forEach((scan) => {
      const order = firstText(scan.order_code, scan.module_code?.split("-PZ-")[0]);
      const module = firstText(scan.module_name, scan.qr_value, "Sin módulo");
      if (!order) return;
      const m = ensure(order, module);
      m.project_id = firstText(scan.project_id, m.project_id);
      m.scans.push(scan);
      m.installer_1 = firstText(scan.installer_1_name, scan.installer_name, m.installer_1);
      m.installer_2 = firstText(scan.installer_2_name, m.installer_2);
      m.team_name = firstText(scan.installer_name, m.team_name);
      m.installed_at = firstText(scan.installed_at, scan.created_at, m.installed_at);
    });

    reports.forEach((r) => {
      const order = firstText(r.order_code);
      const module = firstText(r.module_name, "General");
      if (!order) return;
      const m = ensure(order, module);
      m.project_id = firstText(r.project_id, m.project_id);
      m.report = r;
      m.project_name = firstText(r.project_name, m.project_name);
      m.client_name = firstText(r.client_name, m.client_name);
      m.client_phone = firstText(r.client_phone, m.client_phone);
      m.client_address = firstText(r.client_address, m.client_address);
      m.installer_1 = firstText(r.installer_1, m.installer_1);
      m.installer_2 = firstText(r.installer_2, m.installer_2);
      m.driver_name = firstText(r.driver_name, m.driver_name);
      m.vehicle = firstText(r.vehicle, m.vehicle);
      m.status = r.status || m.status;
      m.score = Number(r.score || 0);
    });

    issues.forEach((issue) => {
      const order = firstText(issue.order_code);
      const module = firstText(issue.module_name, "General");
      if (!order) return;
      const m = ensure(order, module);
      m.project_id = firstText(issue.project_id, m.project_id);
      m.issues.push(issue);
    });

    generalPhotos.forEach((photo) => {
      const order = firstText(photo.order_code);
      const module = firstText(photo.module_name, "General");
      if (!order) return;
      const m = ensure(order, module);
      m.project_id = firstText(photo.project_id, m.project_id);
      m.photos.push(photo);
    });

    map.forEach((m) => {
      const resolved = resolveBestClientInfo({
        orderCode: m.order_code,
        projectName: m.project_name,
        clientName: m.client_name,
        currentPhone: m.client_phone,
        currentAddress: m.client_address,
        lookupRows,
      });

      m.project_name = resolved.project_name;
      m.client_name = resolved.client_name;
      m.client_phone = resolved.client_phone;
      m.client_address = resolved.client_address;

      const relatedRows = lookupRows.filter(
        (row) =>
          rowMatchesOrder(row, m.order_code) &&
          (!row?.module_name || normalizeForCompare(row.module_name) === normalizeForCompare(m.module_name))
      );

      m.team_name = firstText(
        meaningfulText(m.team_name),
        ...relatedRows.map((row) => rowText(row, ["team_name", "installer_name", "crew_name", "installation_team"]))
      );
      m.driver_name = firstText(
        meaningfulText(m.driver_name),
        ...relatedRows.map((row) => rowText(row, ["driver_name", "delivered_by", "chofer", "driver"]))
      );
      m.driver_phone = firstText(
        meaningfulText(m.driver_phone),
        ...relatedRows.map((row) => rowText(row, ["driver_phone", "chofer_phone", "driver_tel", "driver_mobile"]))
      );
      m.vehicle = firstText(
        meaningfulText(m.vehicle),
        ...relatedRows.map((row) => rowText(row, ["vehicle", "vehicle_plate", "plate", "truck", "camion"]))
      );

      if (!isUuid(m.project_id)) {
        m.project_id = resolveProjectUuidFromRows({
          orderCode: m.order_code,
          projectName: m.project_name,
          clientName: m.client_name,
          lookupRows,
        });
      }
      if (!isUuid(m.project_id)) {
        m.project_id = fallbackQaProjectUuid(m);
      }
    });

    const q = search.trim().toLowerCase();
    const baseList = Array.from(map.values()).filter((m) => orderFilter === "todos" || m.order_code === orderFilter);
    const visibleList = orderFilter === "todos" ? dedupeQaModules(baseList) : baseList;

    return visibleList
      .filter((m) => {
        if (!q) return true;
        return `${m.order_code} ${m.module_name} ${m.project_name} ${m.client_name} ${m.client_phone} ${m.client_address} ${m.team_name}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const aApproved = a.status === "aprobado" || a.status === "liberado_entrega_final" ? 1 : 0;
        const bApproved = b.status === "aprobado" || b.status === "liberado_entrega_final" ? 1 : 0;
        return aApproved - bApproved || a.order_code.localeCompare(b.order_code);
      });
  }, [assignments, handoffs, installationEvents, scans, reports, issues, generalPhotos, lookupRows, orderFilter, search]);

  const orders = useMemo(
    () =>
      Array.from(
        new Set(
          [...assignments, ...handoffs, ...installationEvents, ...scans, ...reports, ...issues, ...generalPhotos]
            .map((row: any) => firstText(row.order_code))
            .filter(Boolean)
        )
      ).sort(),
    [assignments, handoffs, installationEvents, scans, reports, issues, generalPhotos]
  );
  const selected = modules.find((m) => m.key === selectedKey) || modules[0] || null;

  useEffect(() => {
    if (!selectedKey && modules[0]?.key) setSelectedKey(modules[0].key);
  }, [modules, selectedKey]);

  useEffect(() => {
    if (!selected) return;
    const checklist = selected.report?.checklist || {};
    setChecked(checklist);
    setQaSupervisor(selected.report?.qa_supervisor || "Supervisor QA");
    setQaNotes(selected.report?.notes || "");
    setSignature(selected.report?.supervisor_signature || "");
  }, [selected?.key]);

  const selectedChecklist = useMemo(() => checklistForModule(selected), [selected]);

  const currentScore = useMemo(() => {
    const baseScore = Math.round((selectedChecklist.filter((item) => checked[item]).length / selectedChecklist.length) * 100);
    const openIssues = (selected?.issues || []).filter((i) => i.status !== "cerrado");
    const penalty = openIssues.reduce((acc, issue) => {
      if (issue.severity === "critica") return acc + 25;
      if (issue.severity === "alta") return acc + 15;
      if (issue.severity === "media") return acc + 8;
      return acc + 3;
    }, 0);
    return Math.max(0, baseScore - penalty);
  }, [checked, selected?.issues, selectedChecklist]);

  const selectedOpenIssues = (selected?.issues || []).filter((i) => i.status !== "cerrado");
  const selectedClosedIssues = (selected?.issues || []).filter((i) => i.status === "cerrado");
  const canApprove = Boolean(selected && currentScore >= 95 && selectedOpenIssues.length === 0 && selectedChecklist.every((i) => checked[i]));

  const stats = useMemo(() => {
    const total = modules.length;
    const approved = modules.filter((m) => ["aprobado", "liberado_entrega_final"].includes(normalize(m.status))).length;
    const rejected = modules.filter((m) => ["rechazado", "observado", "retrabajo"].includes(normalize(m.status))).length;
    const pending = Math.max(0, total - approved - rejected);
    const allIssues = issues.length;
    const open = issues.filter((i) => i.status !== "cerrado").length;
    const avg = total ? Math.round(modules.reduce((a, m) => a + Number(m.score || 0), 0) / total) : 0;
    return { total, approved, rejected, pending, allIssues, open, avg };
  }, [modules, issues]);

  async function ensureReport(module: QaModule) {
    if (module.report?.id) return module.report;
    const resolvedProjectId = fallbackQaProjectUuid(module);
    const { data, error } = await supabase
      .from("verification_reports")
      .insert({
        project_id: resolvedProjectId,
        order_code: module.order_code,
        module_name: module.module_name,
        project_name: module.project_name,
        client_name: module.client_name,
        client_phone: module.client_phone || null,
        client_address: module.client_address || null,
        installer_1: module.installer_1 || null,
        installer_2: module.installer_2 || null,
        driver_name: module.driver_name || null,
        vehicle: module.vehicle || null,
        qa_supervisor: qaSupervisor,
        status: "en_revision",
        qa_status: "en_revision",
        score: currentScore,
        checklist: checked,
        notes: qaNotes || null,
        supervisor_signature: signature || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as VerificationReport;
  }

  async function saveVerification(statusOverride?: string) {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const report = await ensureReport(selected);
      const status = statusOverride || (canApprove ? "aprobado" : selectedOpenIssues.length ? "observado" : "en_revision");
      const payload: any = {
        qa_supervisor: qaSupervisor,
        score: currentScore,
        checklist: checked,
        notes: qaNotes || null,
        supervisor_signature: signature || null,
        status,
        qa_status: status === "aprobado" || status === "liberado_entrega_final" ? "approved" : status,
        updated_at: new Date().toISOString(),
      };
      if (status === "aprobado" || status === "liberado_entrega_final") payload.approved_at = new Date().toISOString();
      if (status === "rechazado" || status === "retrabajo" || status === "observado") payload.rejected_at = new Date().toISOString();

      const { error } = await supabase.from("verification_reports").update(payload).eq("id", report.id);
      if (error) throw error;

      if (status === "aprobado" || status === "liberado_entrega_final") {
        await releaseToFinalDelivery(selected);
        await registerOperationalCompensationEvents({
          supabase,
          orderCode: selected.order_code,
          moduleName: selected.module_name,
          projectName: selected.project_name,
          sourceModule: "verificacion",
          participants: [
            {
              name: qaSupervisor || "Supervisor QA",
              roleKey: "verificacion",
              department: "Verificacion",
              position: "Verificador QA",
            },
          ],
          notes: `QA aprobado con score ${currentScore}%.`,
        });
      }
      if (["rechazado", "retrabajo", "observado"].includes(status)) {
        await sendBackToInstallation(selected);
      }

      await loadData();
      setMessage(status === "aprobado" || status === "liberado_entrega_final" ? "✅ QA aprobado. Liberado para Entrega Final." : "✅ Verificación QA guardada.");
    } catch (error: any) {
      alert(`Error guardando QA: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  async function releaseToFinalDelivery(module: QaModule) {
    try {
      await supabase
        .from("installation_assignments")
        .update({ qa_status: "aprobado", assignment_status: "liberado_entrega_final", updated_at: new Date().toISOString() })
        .eq("order_code", module.order_code)
        .eq("module_name", module.module_name);
    } catch {}
    try {
      await supabase.from("installation_module_events").insert({
        order_code: module.order_code,
        module_name: module.module_name,
        event_type: "qa_aprobado",
        event_status: "liberado_entrega_final",
        team_name: module.team_name || null,
        installer_1_name: module.installer_1 || null,
        installer_2_name: module.installer_2 || null,
        notes: `QA aprobado por ${qaSupervisor}. Score ${currentScore}%.`,
      });
    } catch {}
  }

  async function sendBackToInstallation(module: QaModule) {
    try {
      await supabase
        .from("installation_assignments")
        .update({ qa_status: "rechazado", assignment_status: "retrabajo", updated_at: new Date().toISOString() })
        .eq("order_code", module.order_code)
        .eq("module_name", module.module_name);
    } catch {}
    try {
      await supabase.from("installation_module_events").insert({
        order_code: module.order_code,
        module_name: module.module_name,
        event_type: "qa_rechazado",
        event_status: "retrabajo_instalacion",
        team_name: module.team_name || null,
        installer_1_name: module.installer_1 || null,
        installer_2_name: module.installer_2 || null,
        notes: `QA observado por ${qaSupervisor}. Debe volver a instalación.`,
      });
    } catch {}
  }

  async function createIssue() {
    if (!selected) return;
    if (!issueForm.description.trim()) {
      alert("Describe la observación QA.");
      return;
    }
    setSaving(true);
    try {
      const report = await ensureReport(selected);
      const resolvedProjectId = fallbackQaProjectUuid(selected);
      const { error } = await supabase.from("verification_issues").insert({
        report_id: report.id,
        project_id: resolvedProjectId,
        order_code: selected.order_code,
        module_name: selected.module_name,
        project_name: selected.project_name,
        client_name: selected.client_name,
        category: issueForm.category,
        description: issueForm.description,
        severity: issueForm.severity,
        assigned_to: issueForm.assigned_to || selected.team_name || "Equipo de instalación",
        assigned_role: "instalacion",
        due_date: issueForm.due_date || null,
        status: "pendiente",
        corrective_action: issueForm.corrective_action || null,
        created_by: qaSupervisor,
        qa_notes: "Creado desde Verificación QA PRO",
      });
      if (error) throw error;
      await sendBackToInstallation(selected);
      setIssueForm({ category: "Terminación", description: "", severity: "media", assigned_to: "Equipo de instalación", due_date: "", corrective_action: "" });
      await loadData();
      setMessage("✅ Observación creada y módulo devuelto a instalación.");
    } catch (error: any) {
      alert(`Error creando observación: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  async function updateIssueStatus(issue: VerificationIssue, status: string) {
    setSaving(true);
    try {
      const payload: any = { status, updated_at: new Date().toISOString() };
      if (status === "cerrado") {
        payload.closed_by = qaSupervisor;
        payload.closed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("verification_issues").update(payload).eq("id", issue.id);
      if (error) throw error;
      await loadData();
    } catch (error: any) {
      alert(error?.message || error);
    } finally {
      setSaving(false);
    }
  }

  async function uploadIssuePhoto(issue: VerificationIssue, file: File) {
    if (!selected) return;
    setSaving(true);
    try {
      const report = await ensureReport(selected);
      const resolvedProjectId = fallbackQaProjectUuid(selected);
      const url = await uploadFile(`qa-observaciones/${selected.order_code}/${issue.id}`, file);
      const { error } = await supabase.from("verification_issue_photos").insert({
        issue_id: issue.id,
        report_id: report.id,
        project_id: resolvedProjectId,
        photo_url: url,
        photo_type: issue.status === "corregido" ? "correccion" : "defecto",
        file_name: file.name,
        description: `Evidencia QA - ${issue.category}`,
        uploaded_by: qaSupervisor,
      });
      if (error) throw error;
      await loadData();
    } catch (error: any) {
      alert(`Error subiendo foto: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  async function uploadGeneralPhoto(file?: File | null) {
    if (!selected || !file) return;
    setSaving(true);
    try {
      const report = await ensureReport(selected);
      const resolvedProjectId = fallbackQaProjectUuid(selected);
      const url = await uploadFile(`qa-general/${selected.order_code}/${selected.module_name}`, file);
      const { error } = await supabase.from("verification_general_photos").insert({
        report_id: report.id,
        project_id: resolvedProjectId,
        order_code: selected.order_code,
        module_name: selected.module_name,
        photo_url: url,
        photo_type: photoType,
        notes: photoNotes || null,
        uploaded_by: qaSupervisor,
      });
      if (error) throw error;
      setPhotoNotes("");
      await loadData();
      setMessage("✅ Evidencia QA subida.");
    } catch (error: any) {
      alert(`Error subiendo evidencia: ${error?.message || error}`);
    } finally {
      setSaving(false);
      if (generalPhotoRef.current) generalPhotoRef.current.value = "";
    }
  }

  function openWhatsApp(module: QaModule) {
    const phone = phoneClean(module.client_phone);
    if (!phone) {
      alert("Este cliente no tiene teléfono registrado.");
      return;
    }
    const text = `Hola ${module.client_name}, somos RD Wood System.\n\nSu proyecto está en verificación final de calidad.\n\nOrden: ${module.order_code}\nProyecto: ${module.project_name}\nMódulo: ${module.module_name}\nEstado QA: ${statusLabel(module.status)}\nScore QA: ${currentScore}%\n\nNotas: ${qaNotes || "Sin notas"}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-5 text-white md:px-8">
      <div className="mx-auto max-w-[1800px]">
        <section className="rounded-[32px] border border-cyan-500/25 bg-gradient-to-br from-slate-950 via-[#07111f] to-blue-950 p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                QA FINAL · VERIFICACIÓN INDUSTRIAL
              </div>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Verificación Campo QA PRO</h1>
              <p className="mt-2 max-w-4xl text-sm font-semibold text-slate-300">
                Control final después de instalación: cliente, equipo instalador, transporte, evidencias, incidencias y liberación a entrega final.
              </p>
            </div>
            <button onClick={loadData} disabled={loading} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase text-slate-950 disabled:opacity-60">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              Actualizar
            </button>
          </div>
        </section>

        {message ? <div className="mt-4 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm font-black text-cyan-100">{message}</div> : null}

        <section className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-7">
          <Stat title="Módulos" value={stats.total} />
          <Stat title="Pendientes" value={stats.pending} />
          <Stat title="Aprobados" value={stats.approved} />
          <Stat title="Rechazados" value={stats.rejected} />
          <Stat title="Incidencias" value={stats.allIssues} />
          <Stat title="Abiertas" value={stats.open} danger={stats.open > 0} />
          <Stat title="Score prom." value={`${stats.avg}%`} />
        </section>

        <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[520px_1fr_480px]">
          <aside className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Módulos a verificar</h2>
                <p className="text-sm text-slate-400">Llegan desde Instalación.</p>
              </div>
              <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-black outline-none">
                <option value="todos">Todas las órdenes</option>
                {orders.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="relative mt-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, módulo, orden..." className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-4 pl-12 pr-4 text-sm font-black outline-none focus:border-cyan-400" />
            </div>

            <div className="mt-4 max-h-[780px] space-y-3 overflow-auto pr-2">
              {loading ? <div className="p-8 text-center text-slate-400">Cargando...</div> : modules.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-500">No hay módulos instalados para verificar.</div>
              ) : modules.map((m) => (
                <button key={m.key} onClick={() => setSelectedKey(m.key)} className={["w-full rounded-2xl border p-4 text-left transition", selected?.key === m.key ? "border-cyan-400 bg-cyan-400/10" : "border-slate-800 bg-slate-950 hover:border-cyan-400/40"].join(" ")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-cyan-300">{m.order_code}</div>
                      <div className="mt-1 text-lg font-black">{m.module_name}</div>
                      <div className="mt-1 text-xs text-slate-400">{m.project_name}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                        <span className="rounded-full bg-slate-900 px-2 py-1">{m.client_name}</span>
                        <span className="rounded-full bg-slate-900 px-2 py-1">{m.team_name || "Sin equipo"}</span>
                        <span className="rounded-full bg-slate-900 px-2 py-1">Fotos: {m.photos.length + m.scans.filter((s) => s.photo_url).length}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusPill status={m.status} />
                      <span className="text-sm font-black text-cyan-300">{m.score || 0}%</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{m.issues.filter((i) => i.status !== "cerrado").length} abiertas</span>
                    <ArrowRight className="text-cyan-300" size={18} />
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5">
            {!selected ? (
              <div className="flex min-h-[700px] flex-col items-center justify-center text-center">
                <ShieldCheck className="text-slate-700" size={90} />
                <h2 className="mt-5 text-3xl font-black">Selecciona un módulo</h2>
                <p className="mt-2 max-w-md text-sm text-slate-400">Verás cliente, equipo, transporte, fotos, checklist y aprobación final.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-cyan-300">{selected.order_code}</div>
                    <h2 className="mt-1 text-3xl font-black">{selected.module_name}</h2>
                    <p className="text-sm text-slate-400">{selected.project_name}</p>
                  </div>
                  <div className={["rounded-2xl border px-5 py-4 text-center", canApprove ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"].join(" ")}>
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400">Score QA</div>
                    <div className="mt-1 text-4xl font-black">{currentScore}%</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <InfoBox icon={<UserRound size={16} />} label="Cliente" value={selected.client_name} />
                  <InfoBox icon={<Phone size={16} />} label="Teléfono" value={selected.client_phone || "Sin teléfono"} />
                  <InfoBox icon={<MapPin size={16} />} label="Dirección" value={selected.client_address || "Sin dirección"} />
                  <InfoBox icon={<Wrench size={16} />} label="Equipo" value={selected.team_name || "Sin equipo"} />
                  <InfoBox icon={<UserRound size={16} />} label="Instalador 1" value={selected.installer_1 || "—"} />
                  <InfoBox icon={<UserRound size={16} />} label="Instalador 2" value={selected.installer_2 || "—"} />
                  <InfoBox icon={<Truck size={16} />} label="Chofer" value={selected.driver_name || "No registrado"} />
                  <InfoBox icon={<Truck size={16} />} label="Vehículo" value={selected.vehicle || "No registrado"} />
                </div>

                {selectedOpenIssues.length > 0 && (
                  <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-black text-red-100">
                    <AlertTriangle className="mr-2 inline" size={18} />
                    Entrega final bloqueada: existen {selectedOpenIssues.length} observación(es) abiertas.
                  </div>
                )}

                <div className="mt-6">
                  <h3 className="flex items-center gap-2 text-2xl font-black"><ClipboardCheck className="text-cyan-300" /> Checklist QA industrial</h3>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {selectedChecklist.map((item) => (
                      <label key={item} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                        <input type="checkbox" checked={!!checked[item]} onChange={(e) => setChecked({ ...checked, [item]: e.target.checked })} className="h-5 w-5" />
                        <span className="font-black">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Input label="Supervisor QA" value={qaSupervisor} onChange={setQaSupervisor} />
                  <Input label="Firma supervisor" value={signature} onChange={setSignature} />
                  <Select label="Estado manual" value={selected.report?.status || "en_revision"} options={["pendiente_qa", "en_revision", "observado", "retrabajo", "rechazado", "aprobado", "liberado_entrega_final"]} onChange={(v) => saveVerification(v)} />
                </div>

                <Textarea label="Notas generales QA" value={qaNotes} onChange={setQaNotes} />

                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <button onClick={() => saveVerification()} disabled={saving} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-cyan-400 px-5 py-4 text-sm font-black uppercase text-slate-950 disabled:opacity-50">
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Guardar QA
                  </button>
                  <button onClick={() => saveVerification("retrabajo")} disabled={saving} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-amber-400 px-5 py-4 text-sm font-black uppercase text-slate-950 disabled:opacity-50">
                    <ShieldAlert size={18} />
                    Devolver a instalación
                  </button>
                  <button onClick={() => saveVerification("aprobado")} disabled={saving || !canApprove} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black uppercase text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                    <CheckCircle2 size={18} />
                    Aprobar entrega final
                  </button>
                </div>

                <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-5">
                  <h3 className="flex items-center gap-2 text-xl font-black"><Camera className="text-cyan-300" /> Evidencias QA</h3>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[0.6fr_1fr_auto]">
                    <select value={photoType} onChange={(e) => setPhotoType(e.target.value)} className="rounded-2xl border border-slate-700 bg-[#020617] px-4 py-3 text-sm font-black outline-none">
                      <option value="qa_general">General</option>
                      <option value="error">Error</option>
                      <option value="correccion">Corrección</option>
                      <option value="cliente">Cliente</option>
                      <option value="firma">Firma</option>
                    </select>
                    <input value={photoNotes} onChange={(e) => setPhotoNotes(e.target.value)} placeholder="Nota de evidencia..." className="rounded-2xl border border-slate-700 bg-[#020617] px-4 py-3 text-sm font-black outline-none" />
                    <button onClick={() => generalPhotoRef.current?.click()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 font-black text-slate-950 disabled:opacity-50">
                      <UploadCloud size={18} /> Subir
                    </button>
                    <input ref={generalPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => uploadGeneralPhoto(e.target.files?.[0])} />
                  </div>
                  <PhotoGrid photos={[...selected.photos.map((p) => ({ id: p.id, url: p.photo_url, label: p.photo_type || "QA" })), ...selected.scans.filter((s) => s.photo_url).map((s, i) => ({ id: `${s.id || i}`, url: s.photo_url || "", label: s.module_name || "Instalación" }))]} />
                </div>
              </>
            )}
          </section>

          <aside className="space-y-5">
            <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5">
              <h2 className="text-2xl font-black">Nueva observación</h2>
              <p className="text-sm text-slate-400">No conformidad asignada al equipo instalador.</p>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <Select label="Categoría" value={issueForm.category} options={ISSUE_CATEGORIES} onChange={(v) => setIssueForm({ ...issueForm, category: v })} />
                <Select label="Severidad" value={issueForm.severity} options={SEVERITIES} onChange={(v) => setIssueForm({ ...issueForm, severity: v })} />
                <Textarea label="Descripción del problema" value={issueForm.description} onChange={(v) => setIssueForm({ ...issueForm, description: v })} />
                <Input label="Responsable" value={issueForm.assigned_to} onChange={(v) => setIssueForm({ ...issueForm, assigned_to: v })} />
                <Input label="Fecha compromiso" type="date" value={issueForm.due_date} onChange={(v) => setIssueForm({ ...issueForm, due_date: v })} />
                <Textarea label="Acción correctiva sugerida" value={issueForm.corrective_action} onChange={(v) => setIssueForm({ ...issueForm, corrective_action: v })} />
              </div>
              <button onClick={createIssue} disabled={saving || !selected} className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-amber-400 px-5 py-4 text-sm font-black uppercase text-slate-950 disabled:opacity-40">
                <FileWarning size={18} /> Crear observación
              </button>
            </div>

            <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-5">
              <h2 className="text-2xl font-black">Observaciones QA</h2>
              <p className="text-sm text-slate-400">Abiertas, corrección y cierre.</p>
              <div className="mt-4 max-h-[760px] space-y-4 overflow-auto pr-2">
                {!selected ? <Empty /> : selected.issues.length === 0 ? <Empty /> : selected.issues.map((issue) => (
                  <div key={issue.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-white">{issue.category}</div>
                        <div className="mt-1 text-xs text-slate-500">{issue.module_name || selected.module_name}</div>
                      </div>
                      <div className="flex flex-col gap-2 text-right">
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${severityClass(issue.severity)}`}>{issue.severity}</span>
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusClass(issue.status)}`}>{issue.status.replace("_", " ")}</span>
                      </div>
                    </div>
                    <p className="mt-3 rounded-xl bg-slate-900 p-3 text-sm font-semibold text-slate-200">{issue.description}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-slate-900 p-3"><div className="font-black uppercase text-slate-500">Responsable</div><div className="mt-1 font-bold">{issue.assigned_to || "Instalación"}</div></div>
                      <div className="rounded-xl bg-slate-900 p-3"><div className="font-black uppercase text-slate-500">Compromiso</div><div className="mt-1 font-bold">{issue.due_date || "Sin fecha"}</div></div>
                    </div>
                    {issue.corrective_action ? <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs font-semibold text-cyan-100">Acción: {issue.corrective_action}</div> : null}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <select value={issue.status} onChange={(e) => updateIssueStatus(issue, e.target.value)} className="rounded-xl border border-slate-700 bg-[#020617] px-3 py-3 text-xs font-black outline-none focus:border-cyan-400">
                        {ISSUE_STATUS.map((s) => <option key={s} value={s}>{s.replace("_", " ").toUpperCase()}</option>)}
                      </select>
                      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-3 text-xs font-black text-cyan-100">
                        <Camera size={14} /> Foto
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadIssuePhoto(issue, file); e.currentTarget.value = ""; }} />
                      </label>
                    </div>
                    <IssuePhotos issueId={issue.id} photos={issuePhotos} />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const s = normalize(status);
  const ok = ["aprobado", "liberado_entrega_final"].includes(s);
  const bad = ["rechazado", "observado", "retrabajo"].includes(s);
  return (
    <span className={["rounded-full border px-3 py-1 text-[10px] font-black uppercase", ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : bad ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"].join(" ")}>{statusLabel(status)}</span>
  );
}

function Stat({ title, value, danger }: { title: string; value: string | number; danger?: boolean }) {
  return (
    <div className={`rounded-[24px] border p-5 shadow-2xl shadow-black/30 ${danger ? "border-red-500/30 bg-red-500/10" : "border-slate-800 bg-[#07111f]"}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{title}</div>
      <div className="mt-3 text-3xl font-black text-white">{value}</div>
    </div>
  );
}

function InfoBox({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">{icon}{label}</div>
      <div className="mt-2 text-sm font-black text-white">{value || "—"}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400">
        {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ").toUpperCase()}</option>)}
      </select>
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="mt-4">
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>
      <textarea value={value} rows={4} onChange={(event) => onChange(event.target.value)} className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
    </div>
  );
}

function PhotoGrid({ photos }: { photos: { id: string; url: string; label: string }[] }) {
  if (!photos.length) return <div className="mt-4 rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">Sin evidencias todavía.</div>;
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {photos.map((photo) => (
        <a key={photo.id} href={photo.url} target="_blank" className="overflow-hidden rounded-2xl border border-slate-800 bg-[#020617]">
          <img src={photo.url} alt={photo.label} className="h-28 w-full object-cover" />
          <div className="truncate p-2 text-xs font-black text-cyan-300">{photo.label}</div>
        </a>
      ))}
    </div>
  );
}

function IssuePhotos({ issueId, photos }: { issueId: string; photos: IssuePhoto[] }) {
  const list = photos.filter((p) => p.issue_id === issueId);
  if (!list.length) return null;
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {list.map((p) => (
        <a key={p.id} href={p.photo_url} target="_blank" className="overflow-hidden rounded-xl border border-slate-800">
          <img src={p.photo_url} alt="Observación QA" className="h-20 w-full object-cover" />
        </a>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
      <ShieldCheck className="mx-auto text-slate-700" size={60} />
      <h3 className="mt-3 text-xl font-black">Sin observaciones</h3>
      <p className="mt-1 text-sm text-slate-400">Este módulo no tiene no conformidades.</p>
    </div>
  );
}
