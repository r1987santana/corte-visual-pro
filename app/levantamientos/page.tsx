"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  ImagePlus,
  Loader2,
  MapPin,
  RefreshCcw,
  Ruler,
  Save,
  Search,
  Sparkles,
  UploadCloud,
  User,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type AnyRow = any;

type AiModule = {
  module_name: string;
  module_type: string;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  position_x_mm: number;
  position_y_mm: number;
  notes: string;
};

type AiOption = {
  id: string;
  name: string;
  level: string;
  summary: string;
  fabricable: boolean;
  technical_notes: string[];
  modules: AiModule[];
};

const PROJECT_TYPES = [
  { value: "cocina", label: "Cocina" },
  { value: "closet", label: "Closet" },
  { value: "mueble_tv", label: "Mueble TV" },
  { value: "oficina", label: "Oficina" },
  { value: "bano", label: "Baño" },
  { value: "panel", label: "Panel decorativo" },
  { value: "general", label: "General" },
];

const STYLE_OPTIONS = [
  "Moderno minimalista",
  "Lujo premium",
  "Económico funcional",
  "Madera cálida",
  "Negro / nogal",
  "Blanco alto brillo",
];

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function mmToM(v: any) {
  return n(v) / 1000;
}

function mToFt(v: any) {
  return n(v) * 3.28084;
}

function clientName(c: AnyRow) {
  return c?.name || c?.full_name || c?.nombre || "Cliente sin nombre";
}

function clientPhone(c: AnyRow) {
  return c?.phone || c?.telefono || c?.whatsapp || "";
}

function clientAddress(c: AnyRow) {
  return c?.address || c?.direccion || "";
}

function fmtDate(v: any) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("es-DO");
  } catch {
    return String(v);
  }
}


function money(value: any) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function openVisitIncomeReceipt(params: {
  incomeCode: string;
  clientName: string;
  clientPhone?: string;
  measurementCode: string;
  projectName: string;
  projectType: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
}) {
  const now = new Date().toLocaleString("es-DO");
  const html = `
    <html>
      <head>
        <title>RECIBO ${params.incomeCode}</title>
        <style>
          body { margin: 0; padding: 22px; font-family: Arial, sans-serif; color: #111; background: #fff; }
          .page { max-width: 880px; margin: 0 auto; }
          .copy { border: 1.5px solid #111; border-radius: 16px; padding: 18px; margin-bottom: 18px; page-break-inside: avoid; }
          .copy.client { border-color: #005c99; }
          .copy.cash { border-color: #078a4f; }
          .top { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
          .brand { letter-spacing: 5px; color: #005c99; font-weight: 900; font-size: 11px; }
          h1 { margin: 6px 0 0; font-size: 24px; }
          .stamp { border-radius: 999px; padding: 7px 12px; font-size: 11px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; background: #f3f7fb; color: #005c99; border: 1px solid #b7d7ee; white-space: nowrap; }
          .copy.cash .stamp { background: #effaf4; color: #078a4f; border-color: #9bd7b8; }
          .muted { color: #555; margin-top: 5px; font-size: 12px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; margin-top: 14px; }
          .field { border-bottom: 1px solid #e5e5e5; padding-bottom: 7px; }
          .label { font-weight: 900; color: #555; text-transform: uppercase; font-size: 10px; letter-spacing: 0.08em; }
          .value { margin-top: 3px; font-weight: 800; font-size: 13px; }
          .amount { margin-top: 14px; border-radius: 14px; background: #f6f8fb; border: 1px solid #ddd; padding: 14px; display: flex; justify-content: space-between; align-items: center; }
          .total { font-size: 28px; font-weight: 900; color: #078a4f; }
          .note { margin-top: 12px; padding: 10px 12px; border-left: 4px solid #005c99; background: #f3f7fb; font-size: 12px; line-height: 1.35; }
          .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; margin-top: 30px; }
          .line { border-top: 1px solid #111; padding-top: 7px; text-align: center; font-size: 12px; }
          .cut { text-align: center; color: #777; font-size: 11px; margin: 6px 0 18px; }
          @media print { body { padding: 8mm; } .copy { margin-bottom: 10mm; } .cut { margin: 2mm 0 6mm; } }
        </style>
      </head>
      <body>
        <div class="page">
          ${["COPIA CLIENTE", "SOPORTE CAJA"].map((copyLabel, index) => `
            <section class="copy ${index === 0 ? "client" : "cash"}">
              <div class="top">
                <div>
                  <div class="brand">RD WOOD SYSTEM / SANTANA GROUP</div>
                  <h1>RECIBO DE INGRESO</h1>
                  <p class="muted">Pago de visita técnica / levantamiento inicial.</p>
                </div>
                <div class="stamp">${copyLabel}</div>
              </div>

              <div class="grid">
                <div class="field"><div class="label">Código ingreso</div><div class="value">${params.incomeCode}</div></div>
                <div class="field"><div class="label">Fecha</div><div class="value">${now}</div></div>
                <div class="field"><div class="label">Cliente</div><div class="value">${params.clientName || "-"}</div></div>
                <div class="field"><div class="label">Teléfono</div><div class="value">${params.clientPhone || "-"}</div></div>
                <div class="field"><div class="label">Levantamiento</div><div class="value">${params.measurementCode || "-"}</div></div>
                <div class="field"><div class="label">Proyecto</div><div class="value">${params.projectName || "-"}</div></div>
                <div class="field"><div class="label">Tipo</div><div class="value">${params.projectType || "-"}</div></div>
                <div class="field"><div class="label">Método de pago</div><div class="value">${params.paymentMethod || "Efectivo"}</div></div>
                <div class="field"><div class="label">Referencia</div><div class="value">${params.reference || "-"}</div></div>
                <div class="field"><div class="label">Concepto</div><div class="value">Visita técnica / levantamiento / render inicial</div></div>
              </div>

              <div class="amount">
                <div class="label">Monto recibido</div>
                <div class="total">${money(params.amount)}</div>
              </div>

              <div class="note">
                Este ingreso queda registrado y rastreable para el cuadre diario de caja. Este monto se acredita a la cotización final según las condiciones comerciales aprobadas.
              </div>

              <div class="sign">
                <div class="line">Cliente / Pagador</div>
                <div class="line">Caja / RD Wood System</div>
              </div>
            </section>
            ${index === 0 ? `<div class="cut">✂ cortar aquí — copia cliente arriba / soporte caja abajo</div>` : ""}
          `).join("")}
        </div>
        <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 500); };</script>
      </body>
    </html>
  `;

  const win = window.open("", "_blank", "width=900,height=900");
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    alert("El levantamiento fue guardado, pero el navegador bloqueó el recibo. Permite popups para imprimir el recibo de ingreso.");
  }
}

function statusClass(status: string) {
  const s = String(status || "").toLowerCase();
  if (s.includes("render")) return "border-purple-400/30 bg-purple-400/10 text-purple-100";
  if (s.includes("cotiz")) return "border-blue-400/30 bg-blue-400/10 text-blue-100";
  if (s.includes("aprob")) return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  if (s.includes("pend")) return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-slate-400/20 bg-slate-400/10 text-slate-200";
}

function agendaEventIdFromMeasurement(item: AnyRow) {
  return (
    item?.calendar_event_id ||
    item?.agenda_event_id ||
    item?.visit_calendar_event_id ||
    item?.real_space_json?.agenda_event_id ||
    item?.real_space_json?.calendar_event_id ||
    null
  );
}

function isPaidAgendaVisit(item: AnyRow) {
  return (
    item?.event_type === "medida" &&
    (item?.payment_status === "pagado" ||
      item?.status === "medicion_pagada" ||
      Number(item?.amount_paid || 0) > 0 ||
      Boolean(item?.payment_reference))
  );
}

function normalizeOptionModules(modules: AiModule[], optionId: string) {
  return modules.map((m, index) => ({
    module_code: `${optionId.toUpperCase()}-${index + 1}`,
    module_name: m.module_name,
    module_type: m.module_type,
    width_mm: m.width_mm,
    height_mm: m.height_mm,
    depth_mm: m.depth_mm,
    position_x_mm: m.position_x_mm,
    position_y_mm: m.position_y_mm,
    material_preference: null,
    color_preference: null,
    hardware_preference: null,
    notes: m.notes,
    ai_generated: true,
    selected_for_render: true,
    approved_by_client: false,
    status: "ia_option_selected",
  }));
}

function buildAiDesignPromptFromMeasurement(item: AnyRow, option: AiOption) {
  const real = item.real_space_json || {};
  const modulesText = option.modules
    .map((m, i) => `${i + 1}. ${m.module_name}: ${m.width_mm}mm ancho x ${m.depth_mm}mm profundidad x ${m.height_mm}mm alto. Tipo: ${m.module_type}. Posición X ${m.position_x_mm}mm, Y ${m.position_y_mm}mm. ${m.notes}`)
    .join("\n");

  return [
    "RD WOOD SYSTEM · Render IA desde levantamiento real.",
    "Objetivo: generar un render profesional fabricable para aprobación visual del cliente.",
    `Cliente: ${item.client_name || "Cliente"}.`,
    `Proyecto: ${item.project_name || "Proyecto"}.`,
    `Tipo: ${item.project_type || "general"}.`,
    `Espacio real: pared ${n(real.wall_width_mm || item.width_mm)}mm ancho x ${n(real.ceiling_height_mm || item.ceiling_height_mm || item.height_mm)}mm alto x ${n(real.available_depth_mm || item.depth_mm)}mm profundidad disponible.`,
    `Estilo solicitado: ${real.style_preference || "moderno"}.`,
    `Material preferido: ${item.material_preference || real.material_preference || "Melamina 18mm"}.`,
    `Color preferido: ${item.color_preference || real.color_preference || "Por definir"}.`,
    `Herrajes preferidos: ${item.hardware_preference || real.hardware_preference || "Herrajes cierre suave"}.`,
    `Luces / iluminacion: ${real.lighting_preference || "Sin luces especificadas"}.`,
    `Tiradores: ${real.handle_preference || "Por definir"}.`,
    `Sistema de apertura: ${real.opening_system || "Por definir"}.`,
    `Notas electricas: ${real.electrical_notes || "Sin notas electricas"}.`,
    `Necesidades del cliente: ${item.customer_requests || real.customer_needs || "No especificadas"}.`,
    `Obstáculos / condiciones: ${real.obstacles_notes || "Sin obstáculos reportados"}.`,
    `Opción seleccionada: ${option.name}. ${option.summary}`,
    "",
    "Módulos reales obligatorios para el render:",
    modulesText,
    "",
    "Reglas técnicas:",
    "- Respetar las medidas reales del espacio.",
    "- No inventar módulos fuera del espacio disponible.",
    "- Diseño fabricable en melamina / paneles modulares.",
    "- Mantener proporciones reales para cotización y producción.",
    "- Esta etapa es solo aprobación visual antes de cotización.",
  ].join("\n");
}

function generateSmartOptions(params: {
  projectType: string;
  wallWidth: number;
  wallHeight: number;
  depth: number;
  preferredStyle: string;
  needs: string;
  material: string;
  color: string;
}): AiOption[] {
  const wallWidth = Math.max(0, params.wallWidth);
  const wallHeight = Math.max(0, params.wallHeight);
  const depth = Math.max(18, params.depth || 400);
  const usableWidth = Math.max(0, wallWidth - 120);
  const usableHeight = Math.max(0, wallHeight - 150);

  if (params.projectType === "mueble_tv") {
    const baseW = Math.min(2200, Math.max(1600, usableWidth * 0.68));
    const baseH = Math.min(800, Math.max(500, usableHeight * 0.28));
    const panelW = Math.min(2100, Math.max(1500, usableWidth * 0.62));
    const panelH = Math.min(1500, Math.max(1100, usableHeight * 0.50));
    const towerW = usableWidth >= 2800 ? Math.min(550, usableWidth - baseW - 220) : 0;

    return [
      {
        id: "opcion_funcional",
        name: "Opción 1 · Funcional económica",
        level: "Económica",
        summary: "Mueble TV limpio, cajonera flotante y panel central fabricable con bajo consumo de material.",
        fabricable: wallWidth >= 1800 && wallHeight >= 2200,
        technical_notes: [
          "Ideal para controlar costo y mantener buena estética.",
          "Mantiene circulación visual y evita sobrecargar la pared.",
          "Preparado para render y cotización automática.",
        ],
        modules: [
          {
            module_name: "Cajonera flotante TV",
            module_type: "tv_base",
            width_mm: Math.round(baseW),
            height_mm: Math.round(baseH),
            depth_mm: Math.round(Math.min(depth, 450)),
            position_x_mm: Math.round((wallWidth - baseW) / 2),
            position_y_mm: Math.round(wallHeight - baseH - 250),
            notes: "Base flotante con puertas o gavetas según herraje disponible.",
          },
          {
            module_name: "Panel decorativo central",
            module_type: "tv_panel",
            width_mm: Math.round(panelW),
            height_mm: Math.round(panelH),
            depth_mm: 18,
            position_x_mm: Math.round((wallWidth - panelW) / 2),
            position_y_mm: Math.round(520),
            notes: "Panel para TV con pase de cables y preparación eléctrica.",
          },
        ],
      },
      {
        id: "opcion_premium",
        name: "Opción 2 · Moderna premium",
        level: "Premium",
        summary: "Diseño balanceado con cajonera, panel central, repisa vertical y detalle decorativo.",
        fabricable: wallWidth >= 2400 && wallHeight >= 2400,
        technical_notes: [
          "Mejor presencia visual para sala principal.",
          "Combina almacenamiento bajo con módulo vertical.",
          "Buena opción para LED indirecto y textura decorativa.",
        ],
        modules: [
          {
            module_name: "Cajonera flotante premium",
            module_type: "tv_base",
            width_mm: Math.round(Math.min(2300, usableWidth * 0.70)),
            height_mm: 650,
            depth_mm: Math.round(Math.min(depth, 450)),
            position_x_mm: Math.round((wallWidth - Math.min(2300, usableWidth * 0.70)) / 2),
            position_y_mm: Math.round(wallHeight - 900),
            notes: "Base flotante con gavetas push o cierre suave.",
          },
          {
            module_name: "Panel TV premium",
            module_type: "tv_panel",
            width_mm: Math.round(Math.min(2050, usableWidth * 0.62)),
            height_mm: Math.round(Math.min(1450, usableHeight * 0.52)),
            depth_mm: 18,
            position_x_mm: Math.round((wallWidth - Math.min(2050, usableWidth * 0.62)) / 2),
            position_y_mm: 500,
            notes: "Panel principal con canalización interna.",
          },
          ...(towerW > 280
            ? [
                {
                  module_name: "Repisa vertical lateral",
                  module_type: "vertical_shelf",
                  width_mm: Math.round(towerW),
                  height_mm: Math.round(Math.min(2200, usableHeight)),
                  depth_mm: Math.round(Math.min(depth, 380)),
                  position_x_mm: Math.round(wallWidth - towerW - 80),
                  position_y_mm: 350,
                  notes: "Repisa lateral para decoración y almacenamiento ligero.",
                },
              ]
            : []),
        ],
      },
      {
        id: "opcion_lujo",
        name: "Opción 3 · Lujo alto impacto",
        level: "Lujo",
        summary: "Composición de pared completa con panel protagonista, base flotante extendida y repisas decorativas.",
        fabricable: wallWidth >= 3000 && wallHeight >= 2600,
        technical_notes: [
          "Requiere validación precisa de electricidad y soporte de TV.",
          "Mayor consumo de material, pero mayor valor comercial.",
          "Ideal para vender propuesta premium al cliente.",
        ],
        modules: [
          {
            module_name: "Base flotante extendida",
            module_type: "tv_base",
            width_mm: Math.round(Math.min(2600, usableWidth * 0.82)),
            height_mm: 700,
            depth_mm: Math.round(Math.min(depth, 480)),
            position_x_mm: Math.round((wallWidth - Math.min(2600, usableWidth * 0.82)) / 2),
            position_y_mm: Math.round(wallHeight - 920),
            notes: "Base extendida con almacenamiento oculto.",
          },
          {
            module_name: "Panel decorativo alto impacto",
            module_type: "tv_panel",
            width_mm: Math.round(Math.min(2200, usableWidth * 0.68)),
            height_mm: Math.round(Math.min(1650, usableHeight * 0.58)),
            depth_mm: 18,
            position_x_mm: Math.round((wallWidth - Math.min(2200, usableWidth * 0.68)) / 2),
            position_y_mm: 420,
            notes: "Panel con textura, ranuras o combinación de color.",
          },
          {
            module_name: "Repisas superiores decorativas",
            module_type: "decorative_shelves",
            width_mm: Math.round(Math.min(1200, usableWidth * 0.36)),
            height_mm: 280,
            depth_mm: 250,
            position_x_mm: Math.round(wallWidth - Math.min(1200, usableWidth * 0.36) - 120),
            position_y_mm: 320,
            notes: "Repisas livianas para decoración.",
          },
        ],
      },
      {
        id: "opcion_produccion",
        name: "Opción 4 · Producción eficiente",
        level: "Producción",
        summary: "Alternativa fabricable con piezas más rectas, menos desperdicio y ejecución rápida.",
        fabricable: wallWidth >= 1800 && wallHeight >= 2200,
        technical_notes: [
          "Pensada para optimizar corte y canteo.",
          "Reduce variaciones decorativas sin perder presencia visual.",
          "Buena opción si el cliente prioriza tiempo de entrega y control de costo.",
        ],
        modules: [
          {
            module_name: "Base modular eficiente",
            module_type: "tv_base",
            width_mm: Math.round(Math.min(2100, usableWidth * 0.64)),
            height_mm: 560,
            depth_mm: Math.round(Math.min(depth, 420)),
            position_x_mm: Math.round((wallWidth - Math.min(2100, usableWidth * 0.64)) / 2),
            position_y_mm: Math.round(wallHeight - 820),
            notes: "Base de fabricación rápida con frentes alineados.",
          },
          {
            module_name: "Panel limpio optimizado",
            module_type: "tv_panel",
            width_mm: Math.round(Math.min(1850, usableWidth * 0.58)),
            height_mm: Math.round(Math.min(1350, usableHeight * 0.48)),
            depth_mm: 18,
            position_x_mm: Math.round((wallWidth - Math.min(1850, usableWidth * 0.58)) / 2),
            position_y_mm: 520,
            notes: "Panel recto para reducir cortes especiales.",
          },
        ],
      },
    ];
  }

  return [
    {
      id: "opcion_funcional",
      name: "Opción 1 · Funcional",
      level: "Económica",
      summary: "Distribución práctica basada en el espacio real medido.",
      fabricable: wallWidth > 0 && wallHeight > 0,
      technical_notes: ["Se genera con medidas reales del levantamiento.", "Lista para revisión de diseño."],
      modules: [
        {
          module_name: "Módulo principal",
          module_type: params.projectType,
          width_mm: Math.round(Math.min(usableWidth, 2200)),
          height_mm: Math.round(Math.min(usableHeight, 2200)),
          depth_mm: Math.round(depth),
          position_x_mm: 60,
          position_y_mm: 300,
          notes: "Módulo base propuesto por IA según espacio real.",
        },
      ],
    },
    {
      id: "opcion_premium",
      name: "Opción 2 · Premium",
      level: "Premium",
      summary: "Distribución con mejor estética y más aprovechamiento del espacio.",
      fabricable: wallWidth > 0 && wallHeight > 0,
      technical_notes: ["Requiere validación visual con fotos.", "Preparada para render."],
      modules: [
        {
          module_name: "Módulo premium principal",
          module_type: params.projectType,
          width_mm: Math.round(Math.min(usableWidth * 0.8, 2600)),
          height_mm: Math.round(Math.min(usableHeight, 2400)),
          depth_mm: Math.round(depth),
          position_x_mm: 80,
          position_y_mm: 260,
          notes: "Propuesta premium generada con proporciones reales.",
        },
      ],
    },
    {
      id: "opcion_lujo",
      name: "Opción 3 · Lujo",
      level: "Lujo",
      summary: "Propuesta de mayor impacto visual para presentar al cliente.",
      fabricable: wallWidth > 0 && wallHeight > 0,
      technical_notes: ["Mayor consumo de material.", "Ideal para propuesta comercial alta."],
      modules: [
        {
          module_name: "Composición lujo",
          module_type: params.projectType,
          width_mm: Math.round(Math.min(usableWidth * 0.9, 3000)),
          height_mm: Math.round(Math.min(usableHeight, 2600)),
          depth_mm: Math.round(depth),
          position_x_mm: 60,
          position_y_mm: 220,
          notes: "Composición de alto impacto para render IA.",
        },
      ],
    },
    {
      id: "opcion_produccion",
      name: "Opción 4 · Producción eficiente",
      level: "Producción",
      summary: "Propuesta enfocada en fabricar rápido, con piezas simples y bajo desperdicio.",
      fabricable: wallWidth > 0 && wallHeight > 0,
      technical_notes: ["Optimizada para corte y canteo.", "Recomendada cuando el cliente prioriza tiempo y costo."],
      modules: [
        {
          module_name: "Módulo optimizado",
          module_type: params.projectType,
          width_mm: Math.round(Math.min(usableWidth * 0.72, 2400)),
          height_mm: Math.round(Math.min(usableHeight * 0.85, 2300)),
          depth_mm: Math.round(depth),
          position_x_mm: 70,
          position_y_mm: 260,
          notes: "Diseño eficiente para producción con menor complejidad.",
        },
      ],
    },
  ];
}

export default function LevantamientoDigitalProPage() {
  const [clients, setClients] = useState<AnyRow[]>([]);
  const [measurements, setMeasurements] = useState<AnyRow[]>([]);
  const [agendaVisits, setAgendaVisits] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<AnyRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [query, setQuery] = useState("");

  const [selectedAgendaEventId, setSelectedAgendaEventId] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectType, setProjectType] = useState("mueble_tv");
  const [projectName, setProjectName] = useState("");
  const [areaName, setAreaName] = useState("");

  const [wallWidthMm, setWallWidthMm] = useState("");
  const [ceilingHeightMm, setCeilingHeightMm] = useState("");
  const [availableDepthMm, setAvailableDepthMm] = useState("");
  const [linearMm, setLinearMm] = useState("");

  const [hasPlumbing, setHasPlumbing] = useState(false);
  const [hasElectricity, setHasElectricity] = useState(false);
  const [hasGas, setHasGas] = useState(false);
  const [needsDemolition, setNeedsDemolition] = useState(false);

  const [materialPreference, setMaterialPreference] = useState("");
  const [colorPreference, setColorPreference] = useState("");
  const [hardwarePreference, setHardwarePreference] = useState("");
  const [lightingPreference, setLightingPreference] = useState("");
  const [handlePreference, setHandlePreference] = useState("");
  const [openingSystem, setOpeningSystem] = useState("");
  const [electricalNotes, setElectricalNotes] = useState("");
  const [stylePreference, setStylePreference] = useState("Moderno minimalista");

  const [obstaclesNotes, setObstaclesNotes] = useState("");
  const [customerNeeds, setCustomerNeeds] = useState("");
  const [technicalNotes, setTechnicalNotes] = useState("");
  const [notes, setNotes] = useState("");

  const [photoUrl, setPhotoUrl] = useState("");
  const [photoTitle, setPhotoTitle] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const selectedClient = useMemo(
    () => clients.find((c) => String(c.id) === String(clientId)) || null,
    [clients, clientId]
  );

  const selectedAgendaVisit = useMemo(
    () => agendaVisits.find((event) => String(event.id) === String(selectedAgendaEventId)) || null,
    [agendaVisits, selectedAgendaEventId]
  );

  const availableAgendaVisits = useMemo(() => {
    const usedVisitIds = new Set(
      measurements
        .map((measurement) => agendaEventIdFromMeasurement(measurement))
        .filter(Boolean)
        .map(String)
    );

    return agendaVisits.filter((event) => {
      if (!isPaidAgendaVisit(event)) return false;
      if (usedVisitIds.has(String(event.id)) && String(event.id) !== String(selectedAgendaEventId)) return false;
      if (clientId && event.client_id && String(event.client_id) !== String(clientId)) return false;
      return true;
    });
  }, [agendaVisits, measurements, clientId, selectedAgendaEventId]);

  const wallWidthM = useMemo(() => mmToM(wallWidthMm), [wallWidthMm]);
  const ceilingHeightM = useMemo(() => mmToM(ceilingHeightMm), [ceilingHeightMm]);
  const availableDepthM = useMemo(() => mmToM(availableDepthMm), [availableDepthMm]);
  const lengthMeters = useMemo(() => {
    return n(linearMm) > 0 ? mmToM(linearMm) : mmToM(wallWidthMm);
  }, [linearMm, wallWidthMm]);

  const linearFeet = useMemo(() => mToFt(lengthMeters), [lengthMeters]);
  const squareMeters = useMemo(() => wallWidthM * ceilingHeightM, [wallWidthM, ceilingHeightM]);

  const filteredMeasurements = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return measurements;

    return measurements.filter((m) => {
      const text = `${m.code || ""} ${m.client_name || ""} ${m.project_name || ""} ${m.project_type || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [measurements, query]);

  const stats = useMemo(() => {
    return {
      total: measurements.length,
      pendientes: measurements.filter((m) => String(m.status || m.estado || "").includes("pendiente")).length,
      conOpciones: measurements.filter((m) => Array.isArray(m.real_space_json?.ai_options) && m.real_space_json.ai_options.length > 0).length,
      listosRender: measurements.filter((m) => Boolean(m.ready_for_render)).length,
      visitasPagadas: agendaVisits.filter(isPaidAgendaVisit).length,
    };
  }, [measurements, agendaVisits]);

  async function loadData() {
    setLoading(true);

    const [clientsRes, measurementsRes, agendaRes] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("field_measurements").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("calendar_events").select("*").eq("event_type", "medida").order("start_at", { ascending: false }).limit(1000),
    ]);

    if (clientsRes.error) alert("Clientes: " + clientsRes.error.message);
    if (measurementsRes.error) alert("Levantamientos: " + measurementsRes.error.message);
    if (agendaRes.error) alert("Agenda: " + agendaRes.error.message);

    setClients(clientsRes.data || []);
    setMeasurements(measurementsRes.data || []);
    setAgendaVisits(agendaRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setSelectedAgendaEventId("");
    setClientId("");
    setProjectType("mueble_tv");
    setProjectName("");
    setAreaName("");
    setWallWidthMm("");
    setCeilingHeightMm("");
    setAvailableDepthMm("");
    setLinearMm("");
    setHasPlumbing(false);
    setHasElectricity(false);
    setHasGas(false);
    setNeedsDemolition(false);
    setMaterialPreference("");
    setColorPreference("");
    setHardwarePreference("");
    setLightingPreference("");
    setHandlePreference("");
    setOpeningSystem("");
    setElectricalNotes("");
    setStylePreference("Moderno minimalista");
    setObstaclesNotes("");
    setCustomerNeeds("");
    setTechnicalNotes("");
    setNotes("");
    setPhotoUrl("");
    setPhotoTitle("");
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPhotoFiles([]);
    setPhotoPreviews([]);
  }

  function handleSelectAgendaVisit(id: string) {
    setSelectedAgendaEventId(id);

    const visit = agendaVisits.find((event) => String(event.id) === String(id));
    if (!visit) return;

    if (visit.client_id) setClientId(String(visit.client_id));
    if (!projectName.trim()) setProjectName(visit.title || `Levantamiento ${visit.client_name || ""}`.trim());
    if (!areaName.trim() && visit.address) setAreaName(visit.address);
  }

  function handleSelectClient(id: string) {
    setClientId(id);

    if (!selectedAgendaEventId) return;
    const visit = agendaVisits.find((event) => String(event.id) === String(selectedAgendaEventId));
    if (visit?.client_id && String(visit.client_id) !== String(id)) setSelectedAgendaEventId("");
  }

  function handlePhotoFiles(files: FileList | null) {
    if (!files?.length) return;

    const incoming = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!incoming.length) {
      alert("Solo puedes cargar imágenes.");
      return;
    }

    const limited = [...photoFiles, ...incoming].slice(0, 12);
    const previews = limited.map((file) => URL.createObjectURL(file));

    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPhotoFiles(limited);
    setPhotoPreviews(previews);
  }

  function removePhoto(index: number) {
    const nextFiles = photoFiles.filter((_, i) => i !== index);
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPhotoFiles(nextFiles);
    setPhotoPreviews(nextFiles.map((file) => URL.createObjectURL(file)));
  }

  async function uploadPhotosForMeasurement(measurementId: string, clientIdValue: string) {
    const uploaded: Array<{ title: string; url: string; path: string }> = [];

    for (let index = 0; index < photoFiles.length; index += 1) {
      const file = photoFiles[index];
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${measurementId}/${Date.now()}_${index + 1}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("field-measurement-photos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("field-measurement-photos")
        .getPublicUrl(filePath);

      const publicUrl = publicData.publicUrl;

      uploaded.push({
        title: file.name,
        url: publicUrl,
        path: filePath,
      });

      await supabase.from("field_measurement_photos").insert({
        measurement_id: measurementId,
        client_id: clientIdValue,
        title: file.name,
        url: publicUrl,
        photo_url: publicUrl,
        notes: "Foto cargada desde cámara/galería.",
        sort_order: index + 1,
        created_at: new Date().toISOString(),
      });
    }

    return uploaded;
  }

  function buildRealSpacePayload(extra?: Partial<Record<string, any>>) {
    return {
      capture_mode: "real_space_only",
      wall_width_mm: n(wallWidthMm),
      ceiling_height_mm: n(ceilingHeightMm),
      available_depth_mm: n(availableDepthMm),
      linear_mm: n(linearMm) || n(wallWidthMm),
      style_preference: stylePreference,
      obstacles_notes: obstaclesNotes.trim(),
      customer_needs: customerNeeds.trim(),
      material_preference: materialPreference.trim(),
      color_preference: colorPreference.trim(),
      hardware_preference: hardwarePreference.trim(),
      lighting_preference: lightingPreference.trim(),
      handle_preference: handlePreference.trim(),
      opening_system: openingSystem.trim(),
      electrical_notes: electricalNotes.trim(),
      conditions: {
        has_plumbing: hasPlumbing,
        has_electricity: hasElectricity,
        has_gas: hasGas,
        needs_demolition: needsDemolition,
      },
      ...extra,
    };
  }

  async function handleCreate() {
    if (!selectedAgendaVisit) {
      alert("Selecciona una visita pagada por Caja Principal antes de guardar el levantamiento.");
      return;
    }

    if (!isPaidAgendaVisit(selectedAgendaVisit)) {
      alert("La visita seleccionada aun no tiene pago confirmado por Caja Principal.");
      return;
    }

    if (!clientId) {
      alert("Selecciona un cliente.");
      return;
    }

    if (!projectName.trim()) {
      alert("Escribe el nombre del levantamiento/proyecto.");
      return;
    }

    if (n(wallWidthMm) <= 0 || n(ceilingHeightMm) <= 0) {
      alert("Registra el ancho de la pared y la altura del techo.");
      return;
    }

    setSaving(true);

    const code = `LEV-${Date.now().toString().slice(-10)}`;
    const client = selectedClient;

    const manualUrlPhotos = photoUrl.trim()
      ? [{ title: photoTitle.trim() || "Foto principal", url: photoUrl.trim(), path: "manual_url" }]
      : [];

    const agendaPaymentAmount = Number(selectedAgendaVisit.amount_paid || selectedAgendaVisit.measurement_fee || 5000);
    const agendaPaymentReference = selectedAgendaVisit.payment_reference || selectedAgendaVisit.reference || selectedAgendaVisit.id;

    const realSpace = buildRealSpacePayload({
      agenda_event_id: selectedAgendaVisit.id,
      agenda_payment_amount: agendaPaymentAmount,
      agenda_payment_reference: agendaPaymentReference,
      agenda_visit_start_at: selectedAgendaVisit.start_at || null,
      agenda_visit_status: selectedAgendaVisit.status || null,
    });

    const { data, error } = await supabase
      .from("field_measurements")
      .insert({
        code,
        measurement_no: code,

        client_id: clientId,
        client_name: clientName(client),
        client_phone: clientPhone(client),
        client_address: clientAddress(client),

        project_type: projectType,
        project_name: projectName.trim(),
        area_name: areaName.trim() || null,

        status: "pendiente_opciones_ia",
        estado: "pendiente_opciones_ia",

        width_mm: n(wallWidthMm),
        height_mm: n(ceilingHeightMm),
        depth_mm: n(availableDepthMm),
        length_mm: n(linearMm) || n(wallWidthMm),
        ceiling_height_mm: n(ceilingHeightMm),
        measurement_unit: "mm",

        width_m: wallWidthM,
        height_m: ceilingHeightM,
        depth_m: availableDepthM,
        length_m: lengthMeters,
        linear_feet: linearFeet,
        square_meters: squareMeters,
        ceiling_height_m: ceilingHeightM,

        has_plumbing: hasPlumbing,
        has_electricity: hasElectricity,
        has_gas: hasGas,
        needs_demolition: needsDemolition,

        material_preference: materialPreference.trim() || null,
        color_preference: colorPreference.trim() || null,
        hardware_preference: hardwarePreference.trim() || null,

        notes: notes.trim() || null,
        technical_notes: technicalNotes.trim() || null,
        customer_requests: customerNeeds.trim() || null,

        photo_urls: manualUrlPhotos,
        photos: manualUrlPhotos,

        visit_fee_amount: agendaPaymentAmount,
        visit_fee_currency: "DOP",
        visit_fee_paid: true,
        visit_fee_reference: agendaPaymentReference,

        ai_measurement_ready: true,
        ready_for_render: false,
        render_status: "pendiente_opciones_ia",
        real_space_json: realSpace,

        measurements: {
          wall_width_mm: n(wallWidthMm),
          ceiling_height_mm: n(ceilingHeightMm),
          available_depth_mm: n(availableDepthMm),
          linear_mm: n(linearMm) || n(wallWidthMm),
          wall_width_m: wallWidthM,
          ceiling_height_m: ceilingHeightM,
          available_depth_m: availableDepthM,
          linear_feet: linearFeet,
          square_meters: squareMeters,
        },

        created_by_name: "Usuario sistema",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      setSaving(false);
      alert(error.message);
      return;
    }

    let uploadedPhotos: Array<{ title: string; url: string; path: string }> = [];

    try {
      uploadedPhotos = await uploadPhotosForMeasurement(data.id, clientId);
    } catch (uploadError: any) {
      setSaving(false);
      alert("El levantamiento fue creado, pero falló la carga de fotos: " + (uploadError?.message || JSON.stringify(uploadError)));
      await loadData();
      return;
    }

    if (photoUrl.trim()) {
      await supabase.from("field_measurement_photos").insert({
        measurement_id: data.id,
        client_id: clientId,
        title: photoTitle.trim() || "Foto principal",
        url: photoUrl.trim(),
        photo_url: photoUrl.trim(),
        notes: "Foto agregada por URL manual.",
        sort_order: uploadedPhotos.length + 1,
        created_at: new Date().toISOString(),
      });
    }

    if (uploadedPhotos.length || photoUrl.trim()) {
      const finalPhotos = [...uploadedPhotos, ...manualUrlPhotos];

      await supabase
        .from("field_measurements")
        .update({
          photo_urls: finalPhotos,
          photos: finalPhotos,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
    }

    const { error: agendaUpdateError } = await supabase
      .from("calendar_events")
      .update({ status: "levantamiento_realizado" })
      .eq("id", selectedAgendaVisit.id);

    if (agendaUpdateError) {
      console.warn("No se pudo actualizar la visita en Agenda:", agendaUpdateError.message);
    }

    setSaving(false);
    resetForm();
    await loadData();
    alert(`Levantamiento guardado y vinculado al pago de Agenda: ${agendaPaymentReference}`);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar levantamiento?")) return;
    const { error } = await supabase.from("field_measurements").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setSelected(null);
    await loadData();
  }

  async function generateOptionsForMeasurement(item: AnyRow) {
    setGenerating(true);

    const real = item.real_space_json || {};
    const options = generateSmartOptions({
      projectType: item.project_type || "general",
      wallWidth: n(real.wall_width_mm || item.width_mm),
      wallHeight: n(real.ceiling_height_mm || item.ceiling_height_mm || item.height_mm),
      depth: n(real.available_depth_mm || item.depth_mm || 400),
      preferredStyle: real.style_preference || item.style_preference || "",
      needs: real.customer_needs || item.customer_requests || "",
      material: item.material_preference || "",
      color: item.color_preference || "",
    });

    const nextRealSpace = {
      ...(item.real_space_json || {}),
      ai_options: options,
      ai_generated_at: new Date().toISOString(),
      ai_engine: "rdwood_spatial_rules_v1",
    };

    const { error } = await supabase
      .from("field_measurements")
      .update({
        real_space_json: nextRealSpace,
        status: "opciones_ia_generadas",
        estado: "opciones_ia_generadas",
        render_status: "opciones_ia_generadas",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    setGenerating(false);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
    const updated = { ...item, real_space_json: nextRealSpace, status: "opciones_ia_generadas" };
    setSelected(updated);
  }

  async function selectOptionForRender(item: AnyRow, option: AiOption) {
    if (!confirm(`¿Seleccionar "${option.name}" para pasar a Render IA?`)) return;

    setGenerating(true);

    const modulesToInsert = normalizeOptionModules(option.modules, option.id).map((m) => ({
      ...m,
      measurement_id: item.id,
      client_id: item.client_id,
      project_id: item.project_id || null,
      quote_id: item.quote_id || null,
      material_preference: item.material_preference || null,
      color_preference: item.color_preference || null,
      hardware_preference: item.hardware_preference || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    await supabase
      .from("field_measurement_modules")
      .delete()
      .eq("measurement_id", item.id)
      .eq("ai_generated", true);

    const insertRes = await supabase.from("field_measurement_modules").insert(modulesToInsert);

    if (insertRes.error) {
      setGenerating(false);
      alert(insertRes.error.message);
      return;
    }

    const aiPrompt = buildAiDesignPromptFromMeasurement(item, option);
    const photos = Array.isArray(item.photos) ? item.photos : [];

    const aiPayload: AnyRow = {
      measurement_id: item.id,
      quote_id: item.quote_id || null,
      client_id: item.client_id || null,
      client_name: item.client_name || null,
      phone: item.client_phone || null,
      project_name: item.project_name || "Proyecto desde levantamiento",
      project_type: item.project_type || "general",
      area_name: item.area_name || null,
      room_width: n(item.real_space_json?.wall_width_mm || item.width_mm),
      room_height: n(item.real_space_json?.ceiling_height_mm || item.ceiling_height_mm || item.height_mm),
      room_depth: n(item.real_space_json?.available_depth_mm || item.depth_mm),
      style: item.real_space_json?.style_preference || "moderno",
      color_palette: item.color_preference || item.real_space_json?.color_preference || "Por definir",
      material_preference: item.material_preference || item.real_space_json?.material_preference || null,
      hardware_preference: item.hardware_preference || item.real_space_json?.hardware_preference || null,
      customer_requests: item.customer_requests || item.real_space_json?.customer_needs || null,
      technical_notes: [
        item.technical_notes,
        item.real_space_json?.obstacles_notes ? `Obstáculos: ${item.real_space_json.obstacles_notes}` : null,
        item.real_space_json?.lighting_preference ? `Luces: ${item.real_space_json.lighting_preference}` : null,
        item.real_space_json?.handle_preference ? `Tiradores: ${item.real_space_json.handle_preference}` : null,
        item.real_space_json?.opening_system ? `Apertura: ${item.real_space_json.opening_system}` : null,
        item.real_space_json?.electrical_notes ? `Notas electricas: ${item.real_space_json.electrical_notes}` : null,
        `Opción IA seleccionada: ${option.name}`,
      ].filter(Boolean).join("\n"),
      budget: 0,
      photos,
      suggested_modules: option.modules.map((m) => ({
        id: `${option.id}-${m.module_type}-${m.module_name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: m.module_name,
        type: m.module_type,
        quantity: 1,
        width_mm: m.width_mm,
        depth_mm: m.depth_mm,
        height_mm: m.height_mm,
        material: item.material_preference || "Melamina 18mm",
        color: item.color_preference || item.real_space_json?.color_preference || "Por definir",
        edge: "PVC 1mm visible",
        notes: m.notes,
        position_x_mm: m.position_x_mm,
        position_y_mm: m.position_y_mm,
      })),
      selected_ai_option: option,
      ai_prompt: aiPrompt,
      status: "pendiente_render",
      ai_status: "pendiente_render",
      source: "field_measurements",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const aiRes = await supabase
      .from("ai_design_requests")
      .insert(aiPayload)
      .select("*")
      .single();

    if (aiRes.error) {
      setGenerating(false);
      alert("No se pudo crear la solicitud IA: " + aiRes.error.message);
      return;
    }

    const nextRealSpace = {
      ...(item.real_space_json || {}),
      selected_ai_option: option,
      selected_ai_option_id: option.id,
      ai_design_request_id: aiRes.data?.id || null,
      selected_for_render_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("field_measurements")
      .update({
        real_space_json: nextRealSpace,
        ai_design_request_id: aiRes.data?.id || null,
        ready_for_render: true,
        status: "listo_para_render",
        estado: "listo_para_render",
        render_status: "listo_para_render",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    setGenerating(false);

    if (error) {
      alert(error.message);
      return;
    }

    localStorage.setItem("rdwood_measurement_ready_for_ai_render", JSON.stringify({
      measurement_id: item.id,
      ai_design_request_id: aiRes.data?.id,
      selected_option: option,
      project_name: item.project_name,
      client_name: item.client_name,
    }));

    await loadData();
    setSelected({ ...item, real_space_json: nextRealSpace, ready_for_render: true, status: "listo_para_render" });

    const go = confirm("Opción seleccionada y solicitud IA creada. ¿Abrir Render IA ahora?");
    if (go) window.location.href = "/ia-diseno";
  }

  return (
    <main className="min-h-screen bg-[#020817] p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-cyan-900/60 bg-gradient-to-br from-[#07111f] to-[#101b3f] p-8 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-black tracking-[0.35em] text-cyan-300">
                <ClipboardList className="h-4 w-4" />
                LEVANTAMIENTO · ESPACIO REAL → OPCIONES IA
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
                Levantamiento Digital PRO
              </h1>
              <p className="mt-2 max-w-4xl text-slate-300">
                Aquí solo se mide el espacio real. La IA genera opciones funcionales y fabricables según las dimensiones, fotos y necesidades del cliente.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/agenda" className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 font-black text-white hover:bg-white/10">
                <ArrowLeft className="h-5 w-5" />
                Volver a Agenda
              </Link>

              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-white px-6 font-black text-slate-950 transition hover:scale-[1.02] disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCcw size={20} />}
                Actualizar
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Levantamientos</p>
            <h2 className="mt-2 text-3xl font-black">{stats.total}</h2>
          </div>
          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Visitas pagadas</p>
            <h2 className="mt-2 text-3xl font-black text-emerald-300">{stats.visitasPagadas}</h2>
          </div>
          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Pendientes</p>
            <h2 className="mt-2 text-3xl font-black text-amber-300">{stats.pendientes}</h2>
          </div>
          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Con opciones IA</p>
            <h2 className="mt-2 text-3xl font-black text-purple-300">{stats.conOpciones}</h2>
          </div>
          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Listos render</p>
            <h2 className="mt-2 text-3xl font-black text-emerald-300">{stats.listosRender}</h2>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[.95fr_1.35fr]">
          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-6 shadow-2xl shadow-black/25">
            <h2 className="mb-5 text-2xl font-black">Nuevo levantamiento</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                  <CalendarDays className="h-4 w-4" />
                  Visita pagada por Caja Principal
                </span>
                <select value={selectedAgendaEventId} onChange={(e) => handleSelectAgendaVisit(e.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400">
                  <option value="">Seleccionar visita pagada</option>
                  {availableAgendaVisits.map((event) => (
                    <option key={event.id} value={event.id}>
                      {fmtDate(event.start_at)} - {event.client_name || "Cliente"} - {event.title || "Medida"} - {money(event.amount_paid || event.measurement_fee || 5000)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedAgendaVisit ? (
                <div className="md:col-span-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
                  <div className="flex items-center gap-2 font-black">
                    <CreditCard className="h-4 w-4" />
                    Pago confirmado por Caja Principal: {money(selectedAgendaVisit.amount_paid || selectedAgendaVisit.measurement_fee || 5000)}
                  </div>
                  <p className="mt-1 text-emerald-100/80">
                    Referencia: {selectedAgendaVisit.payment_reference || "sin referencia"} · Visita: {fmtDate(selectedAgendaVisit.start_at)}
                  </p>
                </div>
              ) : (
                <div className="md:col-span-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  Primero registra en Caja Principal el pago fijo de RD$5,000. Solo esas visitas pasan a levantamiento.
                </div>
              )}

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Cliente</span>
                <select value={clientId} onChange={(e) => handleSelectClient(e.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400">
                  <option value="">Seleccionar cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{clientName(c)}</option>
                  ))}
                </select>
              </label>

              {selectedClient ? (
                <div className="md:col-span-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                  <p className="font-black">{clientName(selectedClient)}</p>
                  <p className="mt-1 text-cyan-100/80">{clientPhone(selectedClient)}</p>
                  <p className="text-cyan-100/80">{clientAddress(selectedClient)}</p>
                </div>
              ) : null}

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Tipo de proyecto</span>
                <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400">
                  {PROJECT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Área</span>
                <input value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="Ej: Sala principal" className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Nombre del levantamiento</span>
                <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Ej: Levantamiento Villa Ruben El Farallón" className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
              </label>

              <div className="md:col-span-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">1. Medidas reales del espacio</p>
                <p className="mt-1 text-xs text-cyan-100/70">No registres módulos aquí. Solo la realidad física del lugar.</p>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Ancho pared real (mm)</span>
                <input type="number" value={wallWidthMm} onChange={(e) => setWallWidthMm(e.target.value)} placeholder="Ej: 3220" className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Altura techo real (mm)</span>
                <input type="number" value={ceilingHeightMm} onChange={(e) => setCeilingHeightMm(e.target.value)} placeholder="Ej: 2900" className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Profundidad disponible (mm)</span>
                <input type="number" value={availableDepthMm} onChange={(e) => setAvailableDepthMm(e.target.value)} placeholder="Ej: 400" className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Largo lineal útil (mm)</span>
                <input type="number" value={linearMm} onChange={(e) => setLinearMm(e.target.value)} placeholder="Si aplica; si no, usa ancho pared" className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
              </label>

              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 md:col-span-2">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Cálculo rápido</p>
                <p className="mt-2 text-sm text-slate-300">Ancho pared: <b className="text-white">{wallWidthM.toFixed(3)} m</b></p>
                <p className="text-sm text-slate-300">Altura techo: <b className="text-white">{ceilingHeightM.toFixed(3)} m</b></p>
                <p className="text-sm text-slate-300">Profundidad: <b className="text-white">{availableDepthM.toFixed(3)} m</b></p>
                <p className="text-sm text-slate-300">Pies lineales: <b className="text-white">{linearFeet.toFixed(2)}</b></p>
                <p className="text-sm text-slate-300">Área pared: <b className="text-white">{squareMeters.toFixed(2)} m²</b></p>
              </div>

              <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
                {[
                  ["Plomería", hasPlumbing, setHasPlumbing],
                  ["Electricidad", hasElectricity, setHasElectricity],
                  ["Gas", hasGas, setHasGas],
                  ["Demolición", needsDemolition, setNeedsDemolition],
                ].map(([label, value, setter]: any) => (
                  <label key={label} className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3">
                    <span className="font-black text-slate-200">{label}</span>
                    <input type="checkbox" checked={value} onChange={(e) => setter(e.target.checked)} className="h-5 w-5" />
                  </label>
                ))}
              </div>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Estilo deseado</span>
                <select value={stylePreference} onChange={(e) => setStylePreference(e.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400">
                  {STYLE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>

              <div className="md:col-span-2 rounded-3xl border border-cyan-900/50 bg-slate-950/70 p-4">
                <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Acabados y componentes</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={materialPreference} onChange={(e) => setMaterialPreference(e.target.value)} placeholder="Material: melamina, roble, MDF..." className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
                  <input value={colorPreference} onChange={(e) => setColorPreference(e.target.value)} placeholder="Color / combinacion" className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
                  <input value={hardwarePreference} onChange={(e) => setHardwarePreference(e.target.value)} placeholder="Herrajes: bisagras, correderas, soportes" className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
                  <input value={lightingPreference} onChange={(e) => setLightingPreference(e.target.value)} placeholder="Luces: LED calida, neutra, ubicacion" className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
                  <input value={handlePreference} onChange={(e) => setHandlePreference(e.target.value)} placeholder="Tiradores / sin tiradores / push" className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
                  <input value={openingSystem} onChange={(e) => setOpeningSystem(e.target.value)} placeholder="Sistema apertura: push, soft close, abatible" className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
                  <textarea value={electricalNotes} onChange={(e) => setElectricalNotes(e.target.value)} rows={2} placeholder="Notas electricas: tomas, canaletas, interruptores, transformador" className="md:col-span-2 resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
                </div>
              </div>

              <textarea value={obstaclesNotes} onChange={(e) => setObstaclesNotes(e.target.value)} rows={3} placeholder="Obstáculos: ventanas, puertas, columnas, tomacorrientes, TV, aire, desniveles..." className="md:col-span-2 resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
              <textarea value={customerNeeds} onChange={(e) => setCustomerNeeds(e.target.value)} rows={3} placeholder="Necesidades del cliente: almacenamiento, TV 85, LED, muchos cajones, repisas, minimalista..." className="md:col-span-2 resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />

              <div className="space-y-3 md:col-span-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Fotos del espacio real</span>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-5 text-center transition hover:bg-cyan-400/20">
                    <Camera className="mb-2 h-7 w-7 text-cyan-200" />
                    <span className="text-sm font-black text-cyan-100">Tomar foto</span>
                    <span className="mt-1 text-xs text-cyan-100/70">Abre la cámara en móvil/tablet</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={(e) => handlePhotoFiles(e.target.files)}
                      className="hidden"
                    />
                  </label>

                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-950 px-4 py-5 text-center transition hover:border-cyan-400/40">
                    <UploadCloud className="mb-2 h-7 w-7 text-slate-200" />
                    <span className="text-sm font-black text-white">Cargar desde galería</span>
                    <span className="mt-1 text-xs text-slate-500">Puedes seleccionar varias fotos</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handlePhotoFiles(e.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>

                {photoPreviews.length ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    {photoPreviews.map((preview, index) => (
                      <div key={preview} className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
                        <img src={preview} alt={`Foto ${index + 1}`} className="h-28 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute right-2 top-2 rounded-full bg-red-600/80 p-1 text-white hover:bg-red-500"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                        <p className="truncate px-3 py-2 text-xs text-slate-400">{photoFiles[index]?.name}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-5 text-center text-sm text-slate-500">
                    No hay fotos seleccionadas todavía.
                  </div>
                )}

                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Opcional: agregar foto por URL</p>
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                    <input value={photoTitle} onChange={(e) => setPhotoTitle(e.target.value)} placeholder="Título foto URL" className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
                    <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
                  </div>
                </div>
              </div>

              <textarea value={technicalNotes} onChange={(e) => setTechnicalNotes(e.target.value)} rows={3} placeholder="Notas técnicas internas" className="md:col-span-2 resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notas generales" className="md:col-span-2 resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" />

              <button onClick={handleCreate} disabled={saving} className="md:col-span-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 py-4 font-black text-white transition hover:from-cyan-400 hover:to-blue-500 disabled:opacity-60">
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Guardar espacio real
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-6 shadow-2xl shadow-black/25">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black">Levantamientos</h2>
                <p className="text-sm text-slate-500">Luego de guardar, genera opciones IA del espacio real.</p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-11 py-3 outline-none focus:border-cyan-400 md:w-[260px]" />
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-10 text-center text-slate-400">
                <Loader2 className="mx-auto mb-3 animate-spin" />
                Cargando levantamientos...
              </div>
            ) : filteredMeasurements.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-10 text-center text-slate-400">
                No hay levantamientos registrados.
              </div>
            ) : (
              <div className="max-h-[900px] space-y-3 overflow-auto pr-2">
                {filteredMeasurements.map((m) => (
                  <article key={m.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4 hover:border-cyan-400/40">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-200">{m.code || "LEV"}</span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(m.status || m.estado)}`}>{m.status || m.estado}</span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">{m.project_type}</span>
                        </div>

                        <h3 className="mt-3 text-lg font-black text-white">{m.project_name}</h3>

                        <div className="mt-2 space-y-1 text-sm text-slate-400">
                          <p className="flex items-center gap-2"><User className="h-4 w-4" />{m.client_name}</p>
                          <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{m.client_address || "-"}</p>
                          <p className="flex items-center gap-2"><Ruler className="h-4 w-4" />Pared {n(m.width_mm).toFixed(0)} x {n(m.ceiling_height_mm || m.height_mm).toFixed(0)} mm · {n(m.linear_feet).toFixed(2)} ft</p>
                          {m.real_space_json?.agenda_payment_reference || m.visit_fee_reference ? (
                            <p className="flex items-center gap-2 text-emerald-300"><CreditCard className="h-4 w-4" />Agenda: {m.real_space_json?.agenda_payment_reference || m.visit_fee_reference}</p>
                          ) : null}
                          <p className="text-xs text-slate-600">Creado: {fmtDate(m.created_at)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 md:flex-col">
                        <button onClick={() => setSelected(m)} className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100 hover:bg-cyan-400/20">
                          Ver detalle
                        </button>
                        <button onClick={() => generateOptionsForMeasurement(m)} disabled={generating} className="rounded-xl border border-purple-400/20 bg-purple-400/10 px-4 py-2 text-sm font-black text-purple-100 hover:bg-purple-400/20 disabled:opacity-60">
                          IA opciones
                        </button>
                        <button onClick={() => handleDelete(m.id)} className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-black text-red-100 hover:bg-red-400/20">
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {selected ? (
          <section className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-6 shadow-2xl shadow-black/25">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Detalle del levantamiento</h2>
                <p className="text-sm text-slate-500">{selected.code} · {selected.client_name}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-xl bg-red-600/20 p-3 text-red-300 hover:bg-red-600/30">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Cliente</p>
                <p className="mt-2 font-black">{selected.client_name}</p>
                <p className="text-sm text-slate-400">{selected.client_phone}</p>
                <p className="text-sm text-slate-400">{selected.client_address}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Espacio real</p>
                <p className="mt-2 text-sm text-slate-300">Pared: {n(selected.width_mm).toFixed(0)} mm</p>
                <p className="text-sm text-slate-300">Altura techo: {n(selected.ceiling_height_mm || selected.height_mm).toFixed(0)} mm</p>
                <p className="text-sm text-slate-300">Profundidad: {n(selected.depth_mm).toFixed(0)} mm</p>
                <p className="text-sm text-slate-300">Lineal: {n(selected.linear_feet).toFixed(2)} ft</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Preferencias</p>
                <p className="mt-2 text-sm text-slate-300">Estilo: {selected.real_space_json?.style_preference || "-"}</p>
                <p className="text-sm text-slate-300">Material: {selected.material_preference || "-"}</p>
                <p className="text-sm text-slate-300">Color: {selected.color_preference || "-"}</p>
                <p className="text-sm text-slate-300">Herrajes: {selected.hardware_preference || "-"}</p>
                <p className="text-sm text-slate-300">Luces: {selected.real_space_json?.lighting_preference || "-"}</p>
                <p className="text-sm text-slate-300">Tiradores: {selected.real_space_json?.handle_preference || "-"}</p>
                <p className="text-sm text-slate-300">Apertura: {selected.real_space_json?.opening_system || "-"}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 md:col-span-1">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Condiciones</p>
                <p className="mt-2 text-sm text-slate-300">Plomería: {selected.has_plumbing ? "Sí" : "No"}</p>
                <p className="text-sm text-slate-300">Electricidad: {selected.has_electricity ? "Sí" : "No"}</p>
                <p className="text-sm text-slate-300">Gas: {selected.has_gas ? "Sí" : "No"}</p>
                <p className="text-sm text-slate-300">Demolición: {selected.needs_demolition ? "Sí" : "No"}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 md:col-span-2">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Necesidades / obstáculos / notas</p>
                <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{selected.customer_requests || "-"}</p>
                <p className="mt-3 text-sm text-slate-300 whitespace-pre-wrap">{selected.real_space_json?.obstacles_notes || ""}</p>
                <p className="mt-3 text-sm text-slate-300 whitespace-pre-wrap">{selected.real_space_json?.electrical_notes || ""}</p>
                <p className="mt-3 text-sm text-slate-300 whitespace-pre-wrap">{selected.technical_notes || ""}</p>
                <p className="mt-3 text-sm text-slate-300 whitespace-pre-wrap">{selected.notes || ""}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => generateOptionsForMeasurement(selected)} disabled={generating} className="inline-flex items-center gap-2 rounded-2xl border border-purple-400/20 bg-purple-400/10 px-5 py-3 text-sm font-black text-purple-100 hover:bg-purple-400/20 disabled:opacity-60">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                Generar opciones IA
              </button>

              {selected.ready_for_render ? (
                <Link href="/ia-diseno" className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-400/20">
                  <CheckCircle2 className="h-4 w-4" />
                  Ir a Render IA
                </Link>
              ) : null}
            </div>

            {Array.isArray(selected.real_space_json?.ai_options) && selected.real_space_json.ai_options.length ? (
              <div className="mt-6 rounded-3xl border border-purple-400/20 bg-purple-500/10 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-200" />
                  <h3 className="text-xl font-black text-purple-100">Opciones IA fabricables</h3>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  {selected.real_space_json.ai_options.map((option: AiOption) => (
                    <article key={option.id} className="rounded-2xl border border-purple-400/20 bg-slate-950 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-300">{option.level}</p>
                          <h4 className="mt-1 text-lg font-black text-white">{option.name}</h4>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${option.fabricable ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-red-400/30 bg-red-400/10 text-red-200"}`}>
                          {option.fabricable ? "Fabricable" : "Revisar"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-slate-300">{option.summary}</p>

                      <div className="mt-4 space-y-2">
                        {option.modules.map((m, index) => (
                          <div key={`${option.id}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                            <p className="font-black text-cyan-100">{m.module_name}</p>
                            <p className="text-xs text-slate-400">
                              {m.width_mm} x {m.height_mm} x {m.depth_mm} mm
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">Posición: X {m.position_x_mm} · Y {m.position_y_mm}</p>
                          </div>
                        ))}
                      </div>

                      <ul className="mt-4 space-y-1 text-xs text-slate-400">
                        {option.technical_notes.map((note) => (
                          <li key={note}>• {note}</li>
                        ))}
                      </ul>

                      <button onClick={() => selectOptionForRender(selected, option)} disabled={generating || !option.fabricable} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-600 px-4 py-3 text-sm font-black text-white hover:from-purple-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
                        <ImagePlus className="h-4 w-4" />
                        Seleccionar para Render IA
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {Array.isArray(selected.photos) && selected.photos.length ? (
              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Fotos</p>
                <div className="grid gap-3 md:grid-cols-4">
                  {selected.photos.map((photo: any, index: number) => (
                    <a key={`${photo.url}-${index}`} href={photo.url} target="_blank" className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
                      <img src={photo.url} alt={photo.title || `Foto ${index + 1}`} className="h-28 w-full object-cover" />
                      <p className="truncate px-3 py-2 text-xs text-slate-400">{photo.title || `Foto ${index + 1}`}</p>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
