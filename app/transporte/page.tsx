"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  Send,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import SignaturePad from "@/components/SignaturePad";
import {
  contractPaymentSummary,
  matchContractToProject,
  moneyDop,
  type CajaContract,
  type CajaPayment,
  type ContractPaymentSummary,
} from "@/lib/cajaPrincipal";
import { registerOperationalCompensationEvents } from "@/lib/rrhh/operational-compensation";

type AssemblyModuleCheck = {
  id?: string;
  order_code: string;
  module_name: string;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  client_address?: string | null;
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

type PieceLabel = {
  id: string;
  label_code: string;
  order_code: string;
  production_order_id?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  client_address?: string | null;
  location_text?: string | null;
  address_text?: string | null;
  project_name?: string | null;
  module_name?: string | null;
  piece_name?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  thickness_mm?: number | null;
  material_name?: string | null;
  current_status?: string | null;
  updated_at?: string | null;
};

type TransportEvent = {
  id?: string;
  order_code: string;
  module_name: string;
  client_name?: string | null;
  project_name?: string | null;
  driver_id?: string | null;
  vehicle_id?: string | null;
  event_type: "carga" | "salida" | "en_ruta" | "entrega_instalacion";
  event_status?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle?: string | null;
  location_text?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  gps_accuracy?: number | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type TransportPhoto = {
  id?: string;
  order_code: string;
  module_name: string;
  photo_url: string;
  photo_type?: string | null;
  uploaded_by?: string | null;
  notes?: string | null;
  created_at?: string | null;
};



type LogisticsVehicle = {
  id: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  vehicle_type?: string | null;
  color?: string | null;
  capacity_notes?: string | null;
  insurance_expiration?: string | null;
  registration_expiration?: string | null;
  status?: string | null;
  notes?: string | null;
};

type LogisticsDriver = {
  id: string;
  full_name: string;
  phone?: string | null;
  document_id?: string | null;
  license_number?: string | null;
  license_expiration?: string | null;
  assigned_vehicle_id?: string | null;
  status?: string | null;
  emergency_contact?: string | null;
  notes?: string | null;
};

type TransportModule = {
  key: string;
  order_code: string;
  module_name: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  client_address: string;
  project_name: string;
  check?: AssemblyModuleCheck | null;
  pieces: PieceLabel[];
  events: TransportEvent[];
  photos: TransportPhoto[];
  totalPieces: number;
  latestEvent?: TransportEvent | null;
  status: string;
  statusLabel: string;
  contract?: CajaContract | null;
  payment?: ContractPaymentSummary | null;
};

const EVENT_LABELS: Record<string, string> = {
  pendiente: "Pendiente despacho",
  carga: "Cargando",
  salida: "Salida registrada",
  en_ruta: "En ruta",
  entrega_instalacion: "Entregado a instalación",
};

const TRANSPORT_READY_PIECE_STATES = new Set([
  "empacada",
  "carga_transporte",
  "salida_transporte",
  "en_transporte",
  "transportada",
  "instalada",
  "entregada",
]);

function nowIso() {
  return new Date().toISOString();
}

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value?: string | null) {
  return clean(value).toLowerCase() || "pendiente";
}

function isDelivery20Released(contract?: CajaContract | null) {
  const status = normalize(contract?.status);
  return (
    status.includes("delivery_20_pagado") ||
    status.includes("despacho_liberado") ||
    status.includes("liberado_transporte") ||
    status.includes("delivery_20_paid")
  );
}

function normalizeDeliveryPayment(contract?: CajaContract | null, payment?: ContractPaymentSummary | null) {
  if (!contract || !payment || !isDelivery20Released(contract) || payment.deliveryCovered) return payment;

  return {
    ...payment,
    deliveryPaid: Math.max(payment.deliveryPaid, payment.deliveryRequired),
    deliveryDue: 0,
    deliveryCovered: true,
    paidApplied: Math.max(payment.paidApplied, payment.credit + payment.initialPaid + payment.deliveryRequired + payment.finalPaid),
    balance: Math.max(payment.total - (payment.credit + payment.initialPaid + payment.deliveryRequired + payment.finalPaid), 0),
    stageTotals: {
      ...payment.stageTotals,
      delivery_20: Math.max(payment.stageTotals.delivery_20, payment.deliveryRequired),
    },
  };
}

function isPieceReadyForTransport(piece?: PieceLabel | null) {
  return TRANSPORT_READY_PIECE_STATES.has(normalize(piece?.current_status));
}

const DARK_SELECT_CLASS =
  "w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400";

const DARK_SELECT_INLINE_STYLE = {
  colorScheme: "dark",
  backgroundColor: "#020617",
  color: "#ffffff",
} as const;

const DARK_OPTION_CLASS = "bg-slate-950 text-white";
const DARK_OPTION_INLINE_STYLE = { backgroundColor: "#020617", color: "#ffffff" } as const;

function uniqueKey(orderCode: string, moduleName: string) {
  return `${orderCode || "SIN-ORDEN"}__${moduleName || "SIN-MODULO"}`;
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

function phoneClean(value: string) {
  let phone = clean(value).replace(/\D/g, "");
  if (phone.length === 10) phone = `1${phone}`;
  return phone;
}

function isDateExpired(value?: string | null) {
  if (!value) return false;
  const d = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function vehicleDisplay(vehicle?: LogisticsVehicle | null) {
  if (!vehicle) return "";
  const detail = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  return [vehicle.plate, detail].filter(Boolean).join(" · ");
}

function isDriverUsable(driver?: LogisticsDriver | null) {
  const status = normalize(driver?.status);
  return Boolean(driver?.id) && !["inactivo", "suspendido"].includes(status) && !isDateExpired(driver?.license_expiration);
}

function isVehicleUsable(vehicle?: LogisticsVehicle | null) {
  const status = normalize(vehicle?.status);
  return Boolean(vehicle?.id) && !["mantenimiento", "inactivo"].includes(status) && !isDateExpired(vehicle?.insurance_expiration) && !isDateExpired(vehicle?.registration_expiration);
}


function firstText(...values: any[]) {
  for (const value of values) {
    const text = clean(value);
    if (text && text !== "null" && text !== "undefined") return text;
  }
  return "";
}

function rowText(row: any, keys: string[]) {
  if (!row) return "";
  return firstText(...keys.map((key) => row?.[key]));
}

function normalizeForCompare(value: any) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
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
    row.id,
  ].map(normalizeForCompare);

  return values.some((value) => value && (value === target || value.includes(target) || target.includes(value)));
}

function rowMatchesProjectOrClient(row: any, projectName: string, clientName: string) {
  if (!row) return false;
  const project = normalizeForCompare(projectName);
  const client = normalizeForCompare(clientName);
  const rowProject = normalizeForCompare(
    row.project_name || row.project || row.name || row.title || row.area || row.description
  );
  const rowClient = normalizeForCompare(
    row.client_name || row.customer_name || row.customer || row.name || row.nombre || row.full_name
  );

  return Boolean(
    (project && rowProject && (rowProject.includes(project) || project.includes(rowProject))) ||
      (client && rowClient && (rowClient.includes(client) || client.includes(rowClient)))
  );
}

function resolveClientInfo(params: {
  orderCode: string;
  moduleName: string;
  check?: AssemblyModuleCheck | null;
  pieces: PieceLabel[];
  lookupRows: any[];
}) {
  const { orderCode, check, pieces, lookupRows } = params;
  const firstPiece: any = pieces[0] || {};

  const baseClient = firstText(check?.client_name, firstPiece.client_name);
  const baseProject = firstText(check?.project_name, firstPiece.project_name);

  const orderRows = lookupRows.filter((row) => rowMatchesOrder(row, orderCode));
  const softRows = lookupRows.filter((row) => rowMatchesProjectOrClient(row, baseProject, baseClient));
  const candidates = [...orderRows, ...softRows];

  const client_name = firstText(
    baseClient,
    ...candidates.map((row) => rowText(row, ["client_name", "customer_name", "customer", "nombre_cliente", "name", "nombre", "full_name"]))
  );

  const project_name = firstText(
    baseProject,
    ...candidates.map((row) => rowText(row, ["project_name", "project", "project_title", "title", "name", "area", "description"]))
  );

  const client_phone = firstText(
    check?.client_phone,
    firstPiece.client_phone,
    ...candidates.map((row) => rowText(row, ["client_phone", "phone", "telefono", "tel", "mobile", "whatsapp", "contact_phone", "customer_phone"]))
  );

  const client_email = firstText(
    check?.client_email,
    firstPiece.client_email,
    ...candidates.map((row) => rowText(row, ["client_email", "email", "customer_email", "contact_email"]))
  );

  const client_address = firstText(
    check?.client_address,
    firstPiece.client_address,
    firstPiece.location_text,
    firstPiece.address_text,
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
    client_name: client_name || "Cliente",
    project_name: project_name || "Proyecto",
    client_phone,
    client_email,
    client_address,
  };
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

function getLatestEvent(events: TransportEvent[]) {
  return (
    [...events].sort((a, b) => {
      const da = new Date(a.created_at || a.updated_at || 0).getTime();
      const db = new Date(b.created_at || b.updated_at || 0).getTime();
      return db - da;
    })[0] || null
  );
}

async function uploadTransportPhoto(orderCode: string, moduleName: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const safeModule = moduleName.replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  const path = `transporte/${orderCode}/${safeModule}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("project-files").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });

  if (error) throw error;

  const { data } = supabase.storage.from("project-files").getPublicUrl(path);
  return data.publicUrl;
}

async function uploadTransportSignature(orderCode: string, moduleName: string, signatureDataUrl: string) {
  const safeModule = moduleName.replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  const path = `transporte/${orderCode}/${safeModule}/firma-recepcion-${Date.now()}.png`;
  const response = await fetch(signatureDataUrl);
  const blob = await response.blob();

  const { error } = await supabase.storage.from("project-files").upload(path, blob, {
    upsert: true,
    contentType: "image/png",
  });

  if (error) throw error;

  const { data } = supabase.storage.from("project-files").getPublicUrl(path);
  return data.publicUrl;
}

function buildReceiverNotes(params: {
  receiverName: string;
  receiverDocument: string;
  receiverPhone: string;
  receiverRole: string;
  baseNotes: string;
}) {
  const lines = [
    "Recepcion de mercancia",
    `Recibido por: ${params.receiverName}`,
    params.receiverDocument ? `Documento: ${params.receiverDocument}` : "",
    params.receiverPhone ? `Telefono: ${params.receiverPhone}` : "",
    params.receiverRole ? `Relacion/cargo: ${params.receiverRole}` : "",
    "Firma virtual capturada.",
    params.baseNotes ? `Notas: ${params.baseNotes}` : "",
  ];

  return lines.filter(Boolean).join("\n");
}

export default function TransportePage() {
  const [checks, setChecks] = useState<AssemblyModuleCheck[]>([]);
  const [pieces, setPieces] = useState<PieceLabel[]>([]);
  const [events, setEvents] = useState<TransportEvent[]>([]);
  const [photos, setPhotos] = useState<TransportPhoto[]>([]);
  const [lookupRows, setLookupRows] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<LogisticsDriver[]>([]);
  const [vehicles, setVehicles] = useState<LogisticsVehicle[]>([]);
  const [contracts, setContracts] = useState<CajaContract[]>([]);
  const [clientPayments, setClientPayments] = useState<CajaPayment[]>([]);

  const [selectedKey, setSelectedKey] = useState("");
  const [orderFilter, setOrderFilter] = useState("todos");
  const [search, setSearch] = useState("");

  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [driverName, setDriverName] = useState("Chofer / Transporte");
  const [driverPhone, setDriverPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [locationText, setLocationText] = useState("");
  const [notes, setNotes] = useState("");
  const [photoNotes, setPhotoNotes] = useState("");
  const [photoType, setPhotoType] = useState("carga");
  const [receiverName, setReceiverName] = useState("");
  const [receiverDocument, setReceiverDocument] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverRole, setReceiverRole] = useState("Cliente / encargado");
  const [receiverSignature, setReceiverSignature] = useState("");

  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsMessage, setGpsMessage] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadData();
    getGps();
  }, []);

  async function getGps() {
    setGpsMessage("");

    if (!navigator.geolocation) {
      setGpsMessage("GPS no disponible en este navegador.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };

        setGps(next);
        setGpsMessage(`GPS capturado: ${next.lat.toFixed(6)}, ${next.lng.toFixed(6)}`);
      },
      (err) => setGpsMessage(`GPS no disponible: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const [
        checksRes,
        piecesRes,
        eventsRes,
        photosRes,
        driversRows,
        vehiclesRows,
        productionRows,
        quoteRows,
        clientRows,
        designRows,
        projectRows,
        contractRows,
        paymentRows,
      ] = await Promise.all([
        supabase.from("assembly_module_checks").select("*").order("updated_at", { ascending: false }),
        supabase.from("piece_labels").select("*").order("created_at", { ascending: false }),
        supabase.from("transport_module_events").select("*").order("created_at", { ascending: false }),
        supabase.from("transport_module_photos").select("*").order("created_at", { ascending: false }),
        safeLoadTable("logistics_drivers"),
        safeLoadTable("logistics_vehicles"),
        safeLoadTable("production_orders"),
        safeLoadTable("quotes"),
        safeLoadTable("clients"),
        safeLoadTable("ai_design_requests"),
        safeLoadTable("furniture_projects"),
        safeLoadTable("project_contracts"),
        safeLoadTable("client_payments"),
      ]);

      if (checksRes.error) throw checksRes.error;
      if (piecesRes.error) throw piecesRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (photosRes.error) throw photosRes.error;

      setChecks((checksRes.data || []) as AssemblyModuleCheck[]);
      setPieces((piecesRes.data || []) as PieceLabel[]);
      setEvents((eventsRes.data || []) as TransportEvent[]);
      setPhotos((photosRes.data || []) as TransportPhoto[]);
      setDrivers((driversRows || []) as LogisticsDriver[]);
      setVehicles((vehiclesRows || []) as LogisticsVehicle[]);
      setContracts((contractRows || []) as CajaContract[]);
      setClientPayments((paymentRows || []) as CajaPayment[]);
      setLookupRows([...(productionRows as any[]), ...(quoteRows as any[]), ...(clientRows as any[]), ...(designRows as any[]), ...(projectRows as any[])]);
    } catch (error: any) {
      console.error(error);
      setMessage(`⚠️ Error cargando transporte: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  }

  const modules = useMemo<TransportModule[]>(() => {
    const readyChecks = checks.filter((check) => {
      const status = normalize(check.assembly_status);
      const qa = normalize(check.qa_status);
      return status === "listo_transporte" || status === "entregado_instalacion" || qa === "aprobado";
    });

    const seenKeys = new Set<string>();

    const buildModule = (check: AssemblyModuleCheck, preloadedPieces?: PieceLabel[]): TransportModule => {
      const orderCode = check.order_code || "SIN-ORDEN";
      const moduleName = check.module_name || "Sin módulo";
      const key = uniqueKey(orderCode, moduleName);
      seenKeys.add(key);

      const modulePieces = preloadedPieces || pieces.filter(
        (piece) => piece.order_code === orderCode && (piece.module_name || "Sin módulo") === moduleName
      );

      const moduleEvents = events.filter(
        (event) => event.order_code === orderCode && (event.module_name || "Sin módulo") === moduleName
      );

      const modulePhotos = photos.filter(
        (photo) => photo.order_code === orderCode && (photo.module_name || "Sin módulo") === moduleName
      );

      const latestEvent = getLatestEvent(moduleEvents);
      const currentStatus: string = latestEvent?.event_type || normalize(check.assembly_status);
      const statusLabel =
        currentStatus === "listo_transporte" ? "Listo para cargar" : EVENT_LABELS[currentStatus] || currentStatus;

      const clientInfo = resolveClientInfo({
        orderCode,
        moduleName,
        check,
        pieces: modulePieces,
        lookupRows,
      });
      const linkedContract = matchContractToProject(
        {
          orderCode,
          clientName: clientInfo.client_name,
          clientPhone: clientInfo.client_phone,
          projectName: clientInfo.project_name,
        },
        contracts
      );
      const payment = linkedContract
        ? normalizeDeliveryPayment(linkedContract, contractPaymentSummary(linkedContract, clientPayments))
        : null;

      return {
        key,
        order_code: orderCode,
        module_name: moduleName,
        client_name: clientInfo.client_name,
        client_phone: clientInfo.client_phone,
        client_email: clientInfo.client_email,
        client_address: clientInfo.client_address,
        project_name: clientInfo.project_name,
        check,
        pieces: modulePieces,
        events: moduleEvents,
        photos: modulePhotos,
        totalPieces: modulePieces.length,
        latestEvent,
        status: currentStatus,
        statusLabel,
        contract: linkedContract,
        payment,
      };
    };

    const list = readyChecks.map((check) => buildModule(check));

    const piecesByModule = new Map<string, PieceLabel[]>();
    for (const piece of pieces) {
      const orderCode = piece.order_code || "SIN-ORDEN";
      const moduleName = piece.module_name || "Sin mÃ³dulo";
      const key = uniqueKey(orderCode, moduleName);
      if (seenKeys.has(key)) continue;
      if (!piecesByModule.has(key)) piecesByModule.set(key, []);
      piecesByModule.get(key)!.push(piece);
    }

    for (const modulePieces of piecesByModule.values()) {
      if (!modulePieces.length || !modulePieces.every(isPieceReadyForTransport)) continue;

      const firstPiece = modulePieces[0];
      const fallbackCheck: AssemblyModuleCheck = {
        order_code: firstPiece.order_code || "SIN-ORDEN",
        module_name: firstPiece.module_name || "Sin mÃ³dulo",
        client_name: firstPiece.client_name || null,
        client_phone: firstPiece.client_phone || null,
        client_email: firstPiece.client_email || null,
        client_address: firstPiece.client_address || firstPiece.location_text || firstPiece.address_text || null,
        project_name: firstPiece.project_name || null,
        assembly_status: "listo_transporte",
        qa_status: "aprobado",
      };

      list.push(buildModule(fallbackCheck, modulePieces));
    }

    const q = search.trim().toLowerCase();

    return list
      .filter((m) => orderFilter === "todos" || m.order_code === orderFilter)
      .filter((m) => {
        if (!q) return true;
        const text = `${m.order_code} ${m.module_name} ${m.client_name} ${m.client_phone} ${m.client_address} ${m.project_name}`.toLowerCase();
        return text.includes(q);
      })
      .sort((a, b) => {
        const deliveredA = a.status === "entrega_instalacion" ? 1 : 0;
        const deliveredB = b.status === "entrega_instalacion" ? 1 : 0;
        return deliveredA - deliveredB || a.order_code.localeCompare(b.order_code);
      });
  }, [checks, pieces, events, photos, lookupRows, contracts, clientPayments, orderFilter, search]);

  const vehicleById = useMemo(() => {
    const map = new Map<string, LogisticsVehicle>();
    vehicles.forEach((v) => v.id && map.set(v.id, v));
    return map;
  }, [vehicles]);

  const driverById = useMemo(() => {
    const map = new Map<string, LogisticsDriver>();
    drivers.forEach((d) => d.id && map.set(d.id, d));
    return map;
  }, [drivers]);

  const availableDrivers = useMemo(
    () => drivers.filter((driver) => isDriverUsable(driver)),
    [drivers]
  );

  const availableVehicles = useMemo(
    () => vehicles.filter((vehicle) => isVehicleUsable(vehicle)),
    [vehicles]
  );

  const selectedDriver = selectedDriverId ? driverById.get(selectedDriverId) || null : null;
  const selectedVehicle = selectedVehicleId ? vehicleById.get(selectedVehicleId) || null : null;

  const orders = useMemo(() => Array.from(new Set(modules.map((m) => m.order_code))).sort(), [modules]);

  const selectedModule = modules.find((m) => m.key === selectedKey) || modules[0] || null;

  useEffect(() => {
    if (!selectedKey && modules[0]?.key) setSelectedKey(modules[0].key);
  }, [modules, selectedKey]);

  useEffect(() => {
    if (!selectedModule) return;

    const latest = selectedModule.latestEvent;

    setSelectedDriverId(latest?.driver_id || selectedDriverId || "");
    setSelectedVehicleId(latest?.vehicle_id || selectedVehicleId || "");
    setDriverName(latest?.driver_name || driverName || "Chofer / Transporte");
    setDriverPhone(latest?.driver_phone || driverPhone || "");
    setVehicle(latest?.vehicle || vehicle || "");
    setLocationText(latest?.location_text || locationText || selectedModule.client_address || "");
    setNotes(latest?.notes || notes || "");
    setReceiverName("");
    setReceiverDocument("");
    setReceiverPhone(selectedModule.client_phone || "");
    setReceiverRole("Cliente / encargado");
    setReceiverSignature("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModule?.key]);

  useEffect(() => {
    if (!selectedDriver) return;

    setDriverName(selectedDriver.full_name || "Chofer / Transporte");
    setDriverPhone(selectedDriver.phone || "");

    if (selectedDriver.assigned_vehicle_id && !selectedVehicleId) {
      const assigned = vehicleById.get(selectedDriver.assigned_vehicle_id);
      if (assigned && isVehicleUsable(assigned)) {
        setSelectedVehicleId(assigned.id);
        setVehicle(vehicleDisplay(assigned));
      }
    }
  }, [selectedDriverId, selectedDriver, selectedVehicleId, vehicleById]);

  useEffect(() => {
    if (!selectedVehicle) return;
    setVehicle(vehicleDisplay(selectedVehicle));
  }, [selectedVehicleId, selectedVehicle]);

  const stats = useMemo(() => {
    const total = modules.length;
    const cargar = modules.filter((m) => m.status === "listo_transporte").length;
    const enRuta = modules.filter((m) => ["carga", "salida", "en_ruta"].includes(m.status)).length;
    const entregados = modules.filter((m) => m.status === "entrega_instalacion").length;
    const fotos = photos.length;

    return { total, cargar, enRuta, entregados, fotos };
  }, [modules, photos.length]);

  const deliveryPaymentCleared = Boolean(
    selectedModule?.payment?.deliveryCovered || isDelivery20Released(selectedModule?.contract)
  );

  async function saveTransportEvent(module: TransportModule, eventType: TransportEvent["event_type"], statusText?: string) {
    setSaving(true);
    setMessage("");

    try {
      const finalDestination = locationText || module.client_address;
      const requiresDeliveryPayment = ["carga", "en_ruta", "entrega_instalacion"].includes(eventType);

      if (requiresDeliveryPayment && !module.contract) {
        alert(
          "No encontre un contrato vinculado para validar el 20% de entrega. " +
            "Vincula el proyecto/contrato o registra el cobro en Caja Principal antes de cargar."
        );
        setSaving(false);
        return;
      }

      if (requiresDeliveryPayment && module.payment && !module.payment.deliveryCovered && !isDelivery20Released(module.contract)) {
        alert(
          `Caja Principal debe cobrar el 20% de entrega/transporte antes de mover este proyecto.\n\n` +
            `Pendiente: ${moneyDop(module.payment.deliveryDue)}\n` +
            `Contrato: ${module.contract?.contract_code || "sin codigo"}`
        );
        setSaving(false);
        return;
      }

      if (!selectedDriver || !isDriverUsable(selectedDriver)) {
        alert("Selecciona un chofer activo, con licencia vigente, antes de continuar.");
        setSaving(false);
        return;
      }

      if (!selectedVehicle || !isVehicleUsable(selectedVehicle)) {
        alert("Selecciona un vehículo disponible, con seguro/matrícula vigente, antes de continuar.");
        setSaving(false);
        return;
      }

      if (["en_ruta", "entrega_instalacion"].includes(eventType) && !finalDestination) {
        alert("Falta la dirección/destino del cliente. Completa la ubicación antes de continuar.");
        setSaving(false);
        return;
      }

      if (eventType === "entrega_instalacion" && !gps) {
        alert("Captura el GPS antes de entregar a instalación.");
        setSaving(false);
        return;
      }

      const isDelivery = eventType === "entrega_instalacion";
      const cleanReceiverName = clean(receiverName);
      const cleanReceiverDocument = clean(receiverDocument);
      const cleanReceiverPhone = clean(receiverPhone);
      const cleanReceiverRole = clean(receiverRole);

      if (isDelivery && !cleanReceiverName) {
        alert("Escribe el nombre de quien recibe la mercancia antes de entregar.");
        setSaving(false);
        return;
      }

      if (isDelivery && !receiverSignature) {
        alert("Captura la firma virtual de quien recibe antes de entregar.");
        setSaving(false);
        return;
      }

      const receiverNotes = isDelivery
        ? buildReceiverNotes({
            receiverName: cleanReceiverName,
            receiverDocument: cleanReceiverDocument,
            receiverPhone: cleanReceiverPhone,
            receiverRole: cleanReceiverRole,
            baseNotes: notes,
          })
        : notes || "";

      const signatureUrl = isDelivery
        ? await uploadTransportSignature(module.order_code, module.module_name, receiverSignature)
        : "";

      const payload = {
        order_code: module.order_code,
        module_name: module.module_name,
        client_name: module.client_name,
        project_name: module.project_name,
        driver_id: selectedDriver?.id || null,
        vehicle_id: selectedVehicle?.id || null,
        event_type: eventType,
        event_status: statusText || EVENT_LABELS[eventType] || eventType,
        driver_name: driverName || null,
        driver_phone: driverPhone || null,
        vehicle: vehicle || null,
        location_text: finalDestination || null,
        gps_lat: gps?.lat || null,
        gps_lng: gps?.lng || null,
        gps_accuracy: gps?.accuracy || null,
        notes: receiverNotes || null,
        updated_at: nowIso(),
      };

      const { error } = await supabase.from("transport_module_events").insert(payload);
      if (error) throw error;

      if (signatureUrl) {
        const { error: signatureError } = await supabase.from("transport_module_photos").insert({
          order_code: module.order_code,
          module_name: module.module_name,
          photo_url: signatureUrl,
          photo_type: "firma_recepcion",
          uploaded_by: cleanReceiverName,
          notes: receiverNotes,
        });

        if (signatureError) throw signatureError;

        await supabase.from("piece_tracking_history").insert({
          piece_code: `${module.order_code}-${module.module_name}`,
          label_code: `${module.order_code}-${module.module_name}`,
          order_code: module.order_code,
          piece_name: module.module_name,
          module_name: module.module_name,
          previous_status: module.status,
          new_status: "firma_recepcion",
          department: "Transporte",
          operator_name: driverName || "Chofer / Transporte",
          notes: receiverNotes,
          photo_url: signatureUrl,
          payload: {
            receiver_name: cleanReceiverName,
            receiver_document: cleanReceiverDocument || null,
            receiver_phone: cleanReceiverPhone || null,
            receiver_role: cleanReceiverRole || null,
            source: "transporte_receiver_signature",
          },
          scanned_at: nowIso(),
          device_name: "Campo / Transporte",
          scan_source: "transport_signature",
        });
      }

      await updateLogisticsAvailability(eventType);

      const pieceStatus =
        eventType === "entrega_instalacion"
          ? "instalada"
          : eventType === "en_ruta"
          ? "en_transporte"
          : eventType === "salida"
          ? "salida_transporte"
          : "carga_transporte";

      await updatePiecesAndHistory(module, pieceStatus, eventType);

      if (eventType === "entrega_instalacion") {
        await markDeliveredToInstallation(module);
        await registerOperationalCompensationEvents({
          supabase,
          orderCode: module.order_code,
          moduleName: module.module_name,
          projectName: module.project_name,
          sourceModule: "transporte",
          pieces: module.pieces,
          participants: [
            {
              name: driverName || selectedDriver?.full_name || "Chofer / Transporte",
              roleKey: "transporte_maestro",
              department: "Transporte",
              position: "Chofer / Transporte Maestro",
            },
          ],
          notes: "Modulo transportado y entregado con firma de recepcion.",
        });
      }

      await loadData();

      setMessage(
        eventType === "entrega_instalacion" ? "✅ Módulo entregado a instalación." : "✅ Evento de transporte guardado."
      );
    } catch (error: any) {
      console.error(error);
      alert(`Error guardando transporte: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  }


  async function updateLogisticsAvailability(eventType: TransportEvent["event_type"]) {
    if (!selectedDriverId && !selectedVehicleId) return;

    const driverStatus = eventType === "entrega_instalacion" ? "activo" : "en ruta";
    const vehicleStatus = eventType === "entrega_instalacion" ? "disponible" : "en ruta";

    const updates: Promise<any>[] = [];

    if (selectedDriverId) {
      updates.push(
        Promise.resolve(
          supabase
            .from("logistics_drivers")
            .update({ status: driverStatus, updated_at: nowIso() })
            .eq("id", selectedDriverId)
        )
      );
    }

    if (selectedVehicleId) {
      updates.push(
        Promise.resolve(
          supabase
            .from("logistics_vehicles")
            .update({ status: vehicleStatus, updated_at: nowIso() })
            .eq("id", selectedVehicleId)
        )
      );
    }

    await Promise.all(updates);
  }

  async function updatePiecesAndHistory(module: TransportModule, newStatus: string, eventType: string) {
    const ids = module.pieces.map((piece) => piece.id);

    if (ids.length > 0) {
      const { error } = await supabase
        .from("piece_labels")
        .update({ current_status: newStatus, updated_at: nowIso() })
        .in("id", ids);

      if (error) throw error;
    }

    if (module.pieces.length > 0) {
      const rows = module.pieces.map((piece) => ({
        piece_code: piece.label_code,
        label_code: piece.label_code,
        order_code: module.order_code,
        production_order_id: piece.production_order_id || null,
        piece_name: piece.piece_name || "",
        module_name: module.module_name,
        previous_status: piece.current_status || "pendiente",
        new_status: newStatus,
        department: "Transporte",
        operator_name: driverName || "Chofer / Transporte",
        notes: notes || `${EVENT_LABELS[eventType] || eventType}. Vehículo: ${vehicle || "N/A"}`,
        payload: {
          order_code: module.order_code,
          module_name: module.module_name,
          gps,
          vehicle,
          vehicle_id: selectedVehicleId || null,
          driver_id: selectedDriverId || null,
          driver_phone: driverPhone,
          source: "transporte_pro",
        },
        scanned_at: nowIso(),
        device_name: "Campo / Transporte",
        scan_source: "transport_module",
      }));

      const { error } = await supabase.from("piece_tracking_history").insert(rows);
      if (error) throw error;
    }
  }

  async function markDeliveredToInstallation(module: TransportModule) {
    try {
      await supabase
        .from("assembly_module_checks")
        .update({ assembly_status: "entregado_instalacion", updated_at: nowIso() })
        .eq("order_code", module.order_code)
        .eq("module_name", module.module_name);
    } catch {}

    try {
      await supabase
        .from("production_orders")
        .update({ status: "installation_pending", updated_at: nowIso() })
        .eq("order_code", module.order_code);
    } catch {}

    try {
      await supabase.from("installation_handoffs").insert({
        order_code: module.order_code,
        module_name: module.module_name,
        client_name: module.client_name,
        project_name: module.project_name,
        handoff_status: "pendiente_instalacion",
        delivered_by: driverName || "Chofer / Transporte",
        driver_id: selectedDriverId || null,
        vehicle_id: selectedVehicleId || null,
        vehicle: vehicle || null,
        gps_lat: gps?.lat || null,
        gps_lng: gps?.lng || null,
        gps_accuracy: gps?.accuracy || null,
        notes: notes || null,
        delivered_at: nowIso(),
      });
    } catch {}
  }

  async function handlePhotoChange(file?: File | null) {
    if (!file || !selectedModule) return;

    setSaving(true);
    setMessage("");

    try {
      const url = await uploadTransportPhoto(selectedModule.order_code, selectedModule.module_name, file);

      const { error } = await supabase.from("transport_module_photos").insert({
        order_code: selectedModule.order_code,
        module_name: selectedModule.module_name,
        photo_url: url,
        photo_type: photoType,
        uploaded_by: driverName || "Chofer / Transporte",
        notes: photoNotes || null,
      });

      if (error) throw error;

      await supabase.from("piece_tracking_history").insert({
        piece_code: `${selectedModule.order_code}-${selectedModule.module_name}`,
        label_code: `${selectedModule.order_code}-${selectedModule.module_name}`,
        order_code: selectedModule.order_code,
        piece_name: selectedModule.module_name,
        module_name: selectedModule.module_name,
        previous_status: selectedModule.status,
        new_status: `foto_${photoType}`,
        department: "Transporte",
        operator_name: driverName || "Chofer / Transporte",
        notes: photoNotes || `Foto de ${photoType} subida en transporte.`,
        photo_url: url,
        payload: { gps, photo_type: photoType, source: "transporte_photo" },
        scanned_at: nowIso(),
        device_name: "Campo / Transporte",
        scan_source: "transport_photo",
      });

      setPhotoNotes("");
      await loadData();
      setMessage("✅ Foto de transporte guardada.");
    } catch (error: any) {
      console.error(error);
      alert(`Error subiendo foto: ${error?.message || error}`);
    } finally {
      setSaving(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function openWhatsApp(module: TransportModule) {
    const phone = phoneClean(module.client_phone);
    if (!phone) {
      alert("Este cliente no tiene teléfono registrado. Completa teléfono desde CRM/Cotización o agrega el dato en el origen del proyecto.");
      return;
    }

    const maps = gps ? `https://maps.google.com/?q=${gps.lat},${gps.lng}` : "GPS no capturado";

    const text = `Hola ${module.client_name}, somos RD Wood System.

Su proyecto está en fase de transporte.

Orden: ${module.order_code}
Proyecto: ${module.project_name}
Módulo: ${module.module_name}
Estado: ${module.statusLabel}
Dirección registrada: ${module.client_address || locationText || "Sin dirección registrada"}
Ubicación GPS del equipo: ${maps}

Notas: ${notes || "Sin notas"}`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="rounded-[32px] border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 p-8 shadow-2xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
              RD WOOD SYSTEM · LOGÍSTICA INDUSTRIAL
            </p>

            <h1 className="mt-3 text-5xl font-black tracking-tight">Transporte y Entrega PRO</h1>

            <p className="mt-3 max-w-4xl text-sm text-slate-300">
              Carga desde Ensamblado, GPS del chofer, fotos de carga/entrega y handoff directo a Instalación.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 font-black text-slate-950 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
            ACTUALIZAR
          </button>
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <Stat title="Módulos" value={stats.total} />
        <Stat title="Listos carga" value={stats.cargar} />
        <Stat title="En transporte" value={stats.enRuta} />
        <Stat title="Fotos" value={stats.fotos} />
        <Stat title="Entregados instalación" value={stats.entregados} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Módulos para despacho</h2>
              <p className="mt-1 text-sm text-slate-400">Aparecen módulos liberados desde Ensamblado o empacados en trazabilidad.</p>
            </div>

            <select
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value)}
              style={DARK_SELECT_INLINE_STYLE}
              className={DARK_SELECT_CLASS}
            >
              <option value="todos" className={DARK_OPTION_CLASS} style={DARK_OPTION_INLINE_STYLE}>Todas las órdenes</option>
              {orders.map((order) => (
                <option key={order} value={order} className={DARK_OPTION_CLASS} style={DARK_OPTION_INLINE_STYLE}>
                  {order}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
            <Search size={18} className="text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar orden, cliente, módulo..."
              className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="mt-5 space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-slate-800 p-8 text-center text-slate-400">Cargando transporte...</div>
            ) : modules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                No hay módulos listos para transporte.
              </div>
            ) : (
              modules.map((module) => (
                <button
                  key={module.key}
                  onClick={() => setSelectedKey(module.key)}
                  className={[
                    "w-full rounded-3xl border p-5 text-left transition",
                    selectedModule?.key === module.key
                      ? "border-cyan-400 bg-cyan-500/10"
                      : "border-slate-800 bg-slate-950 hover:border-cyan-500/40",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{module.order_code}</div>

                      <h3 className="mt-2 text-xl font-black">{module.module_name}</h3>

                      <p className="mt-1 text-sm text-slate-400">{module.project_name}</p>

                      <p className="text-sm text-slate-500">{module.client_name}</p>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1">
                          <Phone size={12} /> {module.client_phone || "Sin teléfono"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1">
                          <MapPin size={12} /> {module.client_address || "Sin dirección"}
                        </span>
                      </div>
                    </div>

                    <span className="rounded-full bg-slate-800 px-4 py-2 text-xs font-black uppercase text-cyan-300">
                      {module.statusLabel}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-slate-400">{module.totalPieces} piezas · {module.photos.length} fotos</span>
                    <ArrowRight size={20} className="text-cyan-300" />
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5">
          {!selectedModule ? (
            <div className="flex min-h-[620px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950 text-center text-slate-500">
              <Truck size={76} />
              <h3 className="mt-5 text-2xl font-black text-white">Selecciona un módulo</h3>
              <p className="mt-2 text-sm">Selecciona un módulo listo para transporte.</p>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Módulo seleccionado</p>

                  <h2 className="mt-2 text-3xl font-black">{selectedModule.module_name}</h2>

                  <p className="mt-1 text-sm text-slate-400">{selectedModule.project_name}</p>

                  <p className="text-sm text-slate-500">
                    {selectedModule.client_name} · {selectedModule.order_code}
                  </p>
                </div>

                <span className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-cyan-300">
                  {selectedModule.statusLabel}
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5">
                <h3 className="flex items-center gap-2 text-xl font-black text-white">
                  <UserRound size={20} />
                  Datos del cliente / destino
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <InfoBox icon={<UserRound size={16} />} label="Cliente" value={selectedModule.client_name} />
                  <InfoBox icon={<Phone size={16} />} label="Teléfono" value={selectedModule.client_phone || "Sin teléfono registrado"} />
                  <InfoBox icon={<PackageCheck size={16} />} label="Proyecto" value={selectedModule.project_name} />
                  <InfoBox icon={<MapPin size={16} />} label="Dirección / destino" value={selectedModule.client_address || locationText || "Sin dirección registrada"} />
                </div>
              </div>

              <div className={`mt-5 rounded-2xl border p-5 ${deliveryPaymentCleared ? "border-emerald-400/30 bg-emerald-500/10" : "border-amber-400/35 bg-amber-500/10"}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Caja Principal</p>
                    <h3 className="mt-2 text-xl font-black text-white">20% requerido antes de transporte</h3>
                    <p className="mt-1 text-sm font-bold text-slate-300">
                      {selectedModule.contract
                        ? `${selectedModule.contract.contract_code || "Contrato"} - ${selectedModule.contract.client_name || selectedModule.client_name}`
                        : "Contrato no vinculado para validar cobro."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      selectedModule.contract?.id &&
                      window.open(`/pagos?contract_id=${selectedModule.contract.id}&stage=delivery_20`, "_blank", "noopener,noreferrer")
                    }
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                    disabled={!selectedModule.contract?.id}
                  >
                    Ir a Caja Principal
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <InfoBox icon={<Wallet size={16} />} label="Requerido" value={selectedModule.payment ? moneyDop(selectedModule.payment.deliveryRequired) : "Sin contrato"} />
                  <InfoBox icon={<CheckCircle2 size={16} />} label="Pagado" value={selectedModule.payment ? moneyDop(selectedModule.payment.deliveryPaid) : "RD$0.00"} />
                  <InfoBox icon={<Clock size={16} />} label="Pendiente" value={selectedModule.payment ? moneyDop(selectedModule.payment.deliveryDue) : "No validado"} />
                  <InfoBox icon={<PackageCheck size={16} />} label="Estado despacho" value={deliveryPaymentCleared ? "Liberado para cargar" : "Bloqueado por Caja"} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <button
                  onClick={() => saveTransportEvent(selectedModule, "carga")}
                  disabled={saving || !deliveryPaymentCleared}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-4 font-black text-slate-950 disabled:opacity-50"
                >
                  <PackageCheck size={18} />
                  Cargar
                </button>

                <button
                  onClick={() => saveTransportEvent(selectedModule, "en_ruta")}
                  disabled={saving || !deliveryPaymentCleared}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-4 font-black text-white disabled:opacity-50"
                >
                  <Truck size={18} />
                  En ruta
                </button>

                <button
                  onClick={() => saveTransportEvent(selectedModule, "entrega_instalacion")}
                  disabled={saving || !deliveryPaymentCleared}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-slate-950 disabled:opacity-50"
                >
                  <CheckCircle2 size={18} />
                  Entregar instalación
                </button>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <h3 className="flex items-center gap-2 text-xl font-black">
                  <Truck size={20} />
                  Datos de transporte
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="Chofer"
                    value={selectedDriverId}
                    onChange={setSelectedDriverId}
                    icon={<UserRound size={16} />}
                    options={availableDrivers.map((driver) => ({
                      value: driver.id,
                      label: `${driver.full_name} · ${driver.phone || "Sin teléfono"}`,
                    }))}
                    placeholder="Selecciona chofer activo"
                  />

                  <SelectField
                    label="Vehículo"
                    value={selectedVehicleId}
                    onChange={setSelectedVehicleId}
                    icon={<Truck size={16} />}
                    options={availableVehicles.map((item) => ({
                      value: item.id,
                      label: `${item.plate} · ${[item.brand, item.model].filter(Boolean).join(" ") || item.vehicle_type || "vehículo"}`,
                    }))}
                    placeholder="Selecciona vehículo disponible"
                  />

                  <Input label="Teléfono chofer" value={driverPhone} onChange={setDriverPhone} icon={<Phone size={16} />} />
                  <Input label="Destino / ubicación" value={locationText} onChange={setLocationText} icon={<MapPin size={16} />} />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <InfoBox
                    icon={<UserRound size={16} />}
                    label="Chofer seleccionado"
                    value={selectedDriver ? `${selectedDriver.full_name} · Licencia ${selectedDriver.license_number || "N/A"}` : "Sin chofer seleccionado"}
                  />
                  <InfoBox
                    icon={<Truck size={16} />}
                    label="Vehículo seleccionado"
                    value={selectedVehicle ? `${vehicleDisplay(selectedVehicle)} · ${selectedVehicle.capacity_notes || "Sin capacidad registrada"}` : "Sin vehículo seleccionado"}
                  />
                </div>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas de carga, ruta o entrega..."
                  className="mt-4 min-h-[110px] w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400"
                />

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
                    <p className="font-black text-cyan-300">GPS</p>
                    <p className="mt-1">
                      {gps
                        ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)} · ±${Math.round(gps.accuracy || 0)}m`
                        : gpsMessage || "GPS no capturado"}
                    </p>
                  </div>

                  <button onClick={getGps} className="rounded-2xl bg-white px-5 py-4 font-black text-slate-950">
                    Capturar GPS
                  </button>

                  <button
                    onClick={() => openWhatsApp(selectedModule)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white"
                  >
                    <Send size={18} />
                    WhatsApp cliente
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-xl font-black text-white">
                      <CheckCircle2 size={20} />
                      Firma virtual de recepcion
                    </h3>
                    <p className="mt-1 text-sm font-bold text-emerald-100">
                      Requerida para entregar instalacion.
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase text-emerald-300">
                    {receiverSignature ? "Firma lista" : "Pendiente firma"}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Input label="Recibido por" value={receiverName} onChange={setReceiverName} icon={<UserRound size={16} />} />
                  <Input label="Documento / cedula" value={receiverDocument} onChange={setReceiverDocument} icon={<PackageCheck size={16} />} />
                  <Input label="Telefono receptor" value={receiverPhone} onChange={setReceiverPhone} icon={<Phone size={16} />} />
                  <Input label="Cargo / relacion" value={receiverRole} onChange={setReceiverRole} icon={<UserRound size={16} />} />
                </div>

                <div className="mt-4">
                  <SignaturePad onSave={setReceiverSignature} height={180} />
                </div>

                {receiverSignature ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                    <div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-950 p-3">
                      <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                        Firma capturada
                      </p>
                      <img src={receiverSignature} alt="Firma de recepcion" className="h-24 w-full rounded-xl bg-slate-900 object-contain" />
                    </div>

                    <button
                      type="button"
                      onClick={() => setReceiverSignature("")}
                      className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4 font-black text-white hover:border-emerald-400"
                    >
                      Borrar firma
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => saveTransportEvent(selectedModule, "entrega_instalacion")}
                  disabled={saving || !deliveryPaymentCleared}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-slate-950 shadow-lg shadow-emerald-950/30 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  Guardar entrega con firma
                </button>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <h3 className="flex items-center gap-2 text-xl font-black">
                  <Camera size={20} />
                  Evidencias de transporte
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-[0.6fr_1fr]">
                  <select
                    value={photoType}
                    onChange={(e) => setPhotoType(e.target.value)}
                    style={DARK_SELECT_INLINE_STYLE}
                    className={DARK_SELECT_CLASS}
                  >
                    <option value="carga" className={DARK_OPTION_CLASS} style={DARK_OPTION_INLINE_STYLE}>Foto carga</option>
                    <option value="salida" className={DARK_OPTION_CLASS} style={DARK_OPTION_INLINE_STYLE}>Foto salida</option>
                    <option value="ruta" className={DARK_OPTION_CLASS} style={DARK_OPTION_INLINE_STYLE}>Foto ruta</option>
                    <option value="entrega" className={DARK_OPTION_CLASS} style={DARK_OPTION_INLINE_STYLE}>Foto entrega obra</option>
                  </select>

                  <input
                    value={photoNotes}
                    onChange={(e) => setPhotoNotes(e.target.value)}
                    placeholder="Nota de la foto..."
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400"
                  />
                </div>

                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={saving}
                  className="mt-4 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-500/50 bg-cyan-500/10 px-5 py-8 text-center font-black text-cyan-200 disabled:opacity-50"
                >
                  <Camera size={28} />
                  <span className="mt-2">Tomar foto / subir evidencia</span>
                  <span className="mt-1 text-xs text-slate-400">En celular abre cámara trasera.</span>
                </button>

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handlePhotoChange(e.target.files?.[0])}
                />

                {selectedModule.photos.length > 0 ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {selectedModule.photos.map((photo) => (
                      <a
                        key={photo.id || photo.photo_url}
                        href={photo.photo_url}
                        target="_blank"
                        className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
                      >
                        <img
                          src={photo.photo_url}
                          alt={photo.photo_type === "firma_recepcion" ? "Firma de recepcion" : "Foto transporte"}
                          className={[
                            "h-48 w-full bg-slate-950",
                            photo.photo_type === "firma_recepcion" ? "object-contain p-3" : "object-cover",
                          ].join(" ")}
                        />

                        <div className="p-4">
                          <p className="text-sm font-black text-cyan-300">
                            {photo.photo_type === "firma_recepcion" ? "Firma recepcion" : photo.photo_type || "transporte"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">{photo.notes || "Sin nota"}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
                    Sin fotos de transporte.
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <h3 className="flex items-center gap-2 text-xl font-black">
                  <Clock size={20} />
                  Historial transporte
                </h3>

                <div className="mt-4 space-y-3">
                  {selectedModule.events.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
                      Sin eventos registrados.
                    </div>
                  ) : (
                    selectedModule.events.map((event) => (
                      <div key={event.id || `${event.event_type}-${event.created_at}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-black text-cyan-300">{EVENT_LABELS[event.event_type] || event.event_type}</p>
                          <p className="text-xs text-slate-500">{formatDate(event.created_at)}</p>
                        </div>

                        <p className="mt-2 text-sm text-slate-400">
                          {event.driver_name || "Chofer"} · {event.vehicle || "Vehículo N/A"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">{event.notes || "Sin notas"}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
      <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{title}</div>
      <div className="mt-4 text-3xl font-black text-white">{value}</div>
    </div>
  );
}


function InfoBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
        {icon ? icon : null}
        {label}
      </div>
      <div className="mt-2 text-sm font-black text-white">{value || "—"}</div>
    </div>
  );
}


function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  icon?: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>

      <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 focus-within:border-cyan-400">
        {icon ? <div className="text-cyan-300">{icon}</div> : null}

        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={DARK_SELECT_INLINE_STYLE}
          className="w-full bg-slate-900 text-sm font-bold text-white outline-none"
        >
          <option value="" className={DARK_OPTION_CLASS} style={DARK_OPTION_INLINE_STYLE}>{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value} className={DARK_OPTION_CLASS} style={DARK_OPTION_INLINE_STYLE}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>

      <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 focus-within:border-cyan-400">
        {icon ? <div className="text-cyan-300">{icon}</div> : null}

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-500"
        />
      </div>
    </div>
  );
}
