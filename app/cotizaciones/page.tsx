"use client";

/**
 * RD WOOD SYSTEM / SANTANA GROUP
 * MÓDULO DE COTIZACIONES ARTÍCULOS + SERVICIO CORTE/CANTEO/CNC PRO
 * Archivo: app/cotizaciones/page.tsx
 *
 * IMPORTANTE:
 * - Este módulo NO maneja cotización de proyectos.
 * - Cotización de proyectos queda separada en app/cotizador-automatico/page.tsx.
 *
 * Incluye:
 * - Venta de artículos desde inventario
 * - Servicio de corte / canteo / CNC para carpinteros o clientes externos
 * - Formulario industrial de despiece
 * - Cálculo automático de pies lineales de corte y metros lineales de canto
 * - PDF cliente
 * - PDF interno de orden de corte
 * - WhatsApp
 * - Conversión a venta
 *
 * Dependencias:
 * npm install jspdf jspdf-autotable lucide-react
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  Layers3,
  MessageCircle,
  Package,
  Plus,
  Printer,
  RefreshCcw,
  Ruler,
  Save,
  Scissors,
  Search,
  Send,
  Settings2,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/auditTrail";
import {
  ActionButton,
  CheckBox,
  EditableNumber,
  EmptyState,
  FieldLabel,
  InputDark,
  Kpi,
  MiniEdge,
  MiniStat,
  ModeButton,
  PanelDark,
  StatusBadge,
  TdDark,
  ThDark,
  TotalRow,
  TypeBadge,
} from "@/components/quotes/QuoteUiPrimitives";
import {
  BoardOptimizerPreview,
  QuoteAIControlPanel,
  ServiceConfiguration,
} from "@/components/quotes/CutServicePanels";
import { QuoteGlobalStyles } from "@/components/quotes/QuoteGlobalStyles";

const ITBIS_RATE = 0.18;
const DEFAULT_CUT_PRICE_PER_FT = 30;
const DEFAULT_EDGE_PRICE_PER_ML = 35;
const DEFAULT_CNC_PRICE = 0;
const MM_TO_FT = 0.00328084;
const MM_TO_M = 0.001;

type QuoteMode = "articulos" | "servicio";
type MaterialOwner = "cliente" | "rdwood";
type GrainDirection = "sin_veta" | "vertical" | "horizontal";
type BoardSize = "4x8" | "7x8" | "personalizada";

type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  address: string | null;
  status?: string | null;
};

type Product = {
  id: string;
  name?: string | null;
  product_name?: string | null;
  description?: string | null;
  category?: string | null;
  stock?: number | string | null;
  quantity?: number | string | null;
  price?: number | string | null;
  sale_price?: number | string | null;
  selling_price?: number | string | null;
  unit_price?: number | string | null;
  cost_price?: number | string | null;
  average_cost?: number | string | null;
};

type Quote = {
  id: string;
  created_at: string;
  quote_number: string | null;
  quote_type?: string | null;
  client_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_document: string | null;
  client_address: string | null;
  seller_name: string | null;
  subtotal: number | string | null;
  tax: number | string | null;
  total: number | string | null;
  cost_total: number | string | null;
  profit_total: number | string | null;
  margin: number | string | null;
  status: string | null;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  service_linear_feet?: number | string | null;
  service_edge_meters?: number | string | null;
  service_cnc_qty?: number | string | null;
  service_cut_price?: number | string | null;
  service_edge_price?: number | string | null;
  service_cnc_price?: number | string | null;
  service_material_owner?: string | null;
  service_board_type?: string | null;
  service_board_size?: string | null;
  service_board_width_mm?: number | string | null;
  service_board_height_mm?: number | string | null;
  service_thickness_mm?: number | string | null;
  service_color?: string | null;
  service_grain?: string | null;
  service_description?: string | null;
};

type QuoteItem = {
  id?: string;
  quote_id?: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
  cost_price: number;
  subtotal: number;
  profit: number;
  item_type?: "producto" | "servicio";
};

type CutPiece = {
  local_id: string;
  piece_name: string;
  length_mm: number;
  width_mm: number;
  quantity: number;
  edge_front: boolean;
  edge_back: boolean;
  edge_left: boolean;
  edge_right: boolean;
  cnc: boolean;
  observations: string;
};


type NestedPiece = {
  id: string;
  name: string;
  boardIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  color: string;
};

type NestingBoard = {
  index: number;
  width: number;
  height: number;
  pieces: NestedPiece[];
  usedArea: number;
  wastePercent: number;
};

type NestingResult = {
  boards: NestingBoard[];
  oversized: CutPiece[];
  totalPieces: number;
  placedPieces: number;
  usedArea: number;
  totalArea: number;
  wastePercent: number;
};

const NESTING_COLORS = [
  "#22d3ee",
  "#60a5fa",
  "#a78bfa",
  "#34d399",
  "#f59e0b",
  "#fb7185",
  "#f472b6",
  "#2dd4bf",
];

function canFitPiece(
  pieceW: number,
  pieceH: number,
  boardW: number,
  boardH: number,
) {
  return pieceW <= boardW && pieceH <= boardH;
}

function buildNestingLayout(
  pieces: CutPiece[],
  boardWidth: number,
  boardHeight: number,
  grain: GrainDirection,
): NestingResult {
  const width = Math.max(1, boardWidth);
  const height = Math.max(1, boardHeight);
  const allowRotate = grain === "sin_veta";
  const expanded = pieces.flatMap((piece) =>
    Array.from({ length: Math.max(1, piece.quantity) }, (_, copyIndex) => ({
      ...piece,
      local_id: `${piece.local_id}-${copyIndex + 1}`,
      quantity: 1,
    })),
  );

  const sorted = [...expanded].sort(
    (a, b) => b.length_mm * b.width_mm - a.length_mm * a.width_mm,
  );

  const oversized: CutPiece[] = [];
  const boards: Array<{
    index: number;
    cursorX: number;
    cursorY: number;
    rowHeight: number;
    pieces: NestedPiece[];
    usedArea: number;
  }> = [];

  function addBoard() {
    const board = {
      index: boards.length,
      cursorX: 0,
      cursorY: 0,
      rowHeight: 0,
      pieces: [] as NestedPiece[],
      usedArea: 0,
    };
    boards.push(board);
    return board;
  }

  function tryPlaceOnBoard(
    board: (typeof boards)[number],
    piece: CutPiece,
    color: string,
  ) {
    const options = [
      { width: piece.length_mm, height: piece.width_mm, rotated: false },
      ...(allowRotate && piece.length_mm !== piece.width_mm
        ? [{ width: piece.width_mm, height: piece.length_mm, rotated: true }]
        : []),
    ];

    for (const option of options) {
      if (!canFitPiece(option.width, option.height, width, height)) continue;

      if (board.cursorX + option.width <= width && board.cursorY + option.height <= height) {
        const nested: NestedPiece = {
          id: piece.local_id,
          name: piece.piece_name,
          boardIndex: board.index,
          x: board.cursorX,
          y: board.cursorY,
          width: option.width,
          height: option.height,
          rotated: option.rotated,
          color,
        };
        board.pieces.push(nested);
        board.cursorX += option.width;
        board.rowHeight = Math.max(board.rowHeight, option.height);
        board.usedArea += piece.length_mm * piece.width_mm;
        return true;
      }

      if (board.cursorY + board.rowHeight + option.height <= height) {
        board.cursorX = 0;
        board.cursorY += board.rowHeight;
        board.rowHeight = 0;

        const nested: NestedPiece = {
          id: piece.local_id,
          name: piece.piece_name,
          boardIndex: board.index,
          x: board.cursorX,
          y: board.cursorY,
          width: option.width,
          height: option.height,
          rotated: option.rotated,
          color,
        };
        board.pieces.push(nested);
        board.cursorX += option.width;
        board.rowHeight = Math.max(board.rowHeight, option.height);
        board.usedArea += piece.length_mm * piece.width_mm;
        return true;
      }
    }

    return false;
  }

  sorted.forEach((piece, index) => {
    const normalFits = canFitPiece(piece.length_mm, piece.width_mm, width, height);
    const rotatedFits = allowRotate && canFitPiece(piece.width_mm, piece.length_mm, width, height);

    if (!normalFits && !rotatedFits) {
      oversized.push(piece);
      return;
    }

    const color = NESTING_COLORS[index % NESTING_COLORS.length];
    let placed = false;

    for (const board of boards) {
      if (tryPlaceOnBoard(board, piece, color)) {
        placed = true;
        break;
      }
    }

    if (!placed) {
      const board = addBoard();
      tryPlaceOnBoard(board, piece, color);
    }
  });

  const finalBoards: NestingBoard[] = boards.map((board) => {
    const boardArea = width * height;
    const wastePercent = boardArea > 0 ? Math.max(0, 100 - (board.usedArea / boardArea) * 100) : 0;
    return {
      index: board.index,
      width,
      height,
      pieces: board.pieces,
      usedArea: board.usedArea,
      wastePercent,
    };
  });

  const usedArea = finalBoards.reduce((acc, board) => acc + board.usedArea, 0);
  const totalArea = finalBoards.length * width * height;

  return {
    boards: finalBoards,
    oversized,
    totalPieces: expanded.length,
    placedPieces: finalBoards.reduce((acc, board) => acc + board.pieces.length, 0),
    usedArea,
    totalArea,
    wastePercent: totalArea > 0 ? Math.max(0, 100 - (usedArea / totalArea) * 100) : 0,
  };
}

function toNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function percent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("es-DO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString("es-DO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clean(value: string) {
  return value.trim().toLowerCase();
}

function getProductName(p: Product) {
  return p.name || p.product_name || p.description || "Producto sin nombre";
}

function getProductStock(p: Product) {
  return toNumber(p.stock ?? p.quantity);
}

function getProductPrice(p: Product) {
  return (
    toNumber(p.price) ||
    toNumber(p.sale_price) ||
    toNumber(p.selling_price) ||
    toNumber(p.unit_price)
  );
}
function getProductCost(p: Product) {
  return toNumber(p.cost_price) || toNumber(p.average_cost);
}

function quoteNumber(mode: QuoteMode) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const t = String(now.getTime()).slice(-6);
  return mode === "servicio"
    ? `SER-${y}${m}${d}-${t}`
    : `COT-${y}${m}${d}-${t}`;
}


function getQuoteModeFromQuote(quote: Quote): QuoteMode {
  const explicitType = String((quote as any).quote_type || "").toLowerCase();
  if (explicitType === "servicio" || explicitType === "articulos") {
    return explicitType as QuoteMode;
  }

  const number = String(quote.quote_number || "").toUpperCase();
  if (number.startsWith("SER-") || number.includes("FAC-SER")) {
    return "servicio";
  }

  const notesText = String(quote.notes || "").toLowerCase();
  if (
    notesText.includes("pies corte") ||
    notesText.includes("ml canto") ||
    notesText.includes("corte/canteo") ||
    notesText.includes("servicio de corte")
  ) {
    return "servicio";
  }

  return "articulos";
}

function isCommercialModuleQuote(quote: Quote) {
  const row = quote as any;
  const explicitType = String(row.quote_type || "").toLowerCase();

  if (explicitType === "servicio" || explicitType === "articulos") {
    return true;
  }

  const hasProjectQuoteData =
    row.quote_no ||
    row.project_name ||
    row.project_type ||
    row.quote_mode ||
    row.measurement_id ||
    row.area_name ||
    row.total_price ||
    row.initial_60 ||
    row.delivery_20 ||
    row.final_20 ||
    row.material_preference ||
    row.color_preference ||
    row.hardware_preference;

  if (hasProjectQuoteData) {
    return false;
  }

  const quoteNumber = String(row.quote_number || "").toUpperCase();
  if (
    quoteNumber.startsWith("COT-") ||
    quoteNumber.startsWith("SER-") ||
    quoteNumber.startsWith("FAC-SER")
  ) {
    return true;
  }

  const hasServiceData =
    row.service_linear_feet ||
    row.service_edge_meters ||
    row.service_cnc_qty ||
    row.service_board_type ||
    row.service_description;

  if (hasServiceData) {
    return true;
  }

  return false;
}

function invoiceNumber(source?: string | null) {
  const base = source || `COT-${Date.now()}`;
  return base.replace("COT", "FAC").replace("SER", "FAC-SER");
}

function csvSafe(value: any) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

function downloadCSV(filename: string, rows: any[][]) {
  const csv = rows.map((row) => row.map(csvSafe).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getBoardDimensions(size: BoardSize, customW: string, customH: string) {
  if (size === "4x8") return { width: 1220, height: 2440 };
  if (size === "7x8") return { width: 2135, height: 2440 };
  return { width: toNumber(customW), height: toNumber(customH) };
}

function edgeMetersForPiece(piece: CutPiece) {
  const horizontalEdges = Number(piece.edge_front) + Number(piece.edge_back);
  const verticalEdges = Number(piece.edge_left) + Number(piece.edge_right);
  const totalMm =
    horizontalEdges * piece.length_mm + verticalEdges * piece.width_mm;
  return totalMm * MM_TO_M * piece.quantity;
}

function cutFeetForPiece(piece: CutPiece) {
  const perimeterMm = (piece.length_mm + piece.width_mm) * 2;
  return perimeterMm * MM_TO_FT * piece.quantity;
}


type AIInsightSeverity = "success" | "warning" | "danger" | "info";

type AIInsight = {
  id: string;
  severity: AIInsightSeverity;
  title: string;
  message: string;
  action?: string;
};

type QuoteAIInput = {
  mode: QuoteMode;
  clientName: string;
  finalCart: QuoteItem[];
  cart: QuoteItem[];
  products: Product[];
  subtotal: number;
  tax: number;
  total: number;
  costTotal: number;
  profitTotal: number;
  margin: number;
  serviceStats: {
    piecesTotal: number;
    cutFeet: number;
    edgeMeters: number;
    cncQty: number;
    estimatedBoards: number;
    wastePercent: number;
    total: number;
  };
  nestingResult: NestingResult;
  boardSize: BoardSize;
  grainDirection: GrainDirection;
};

function buildQuoteAIInsights(input: QuoteAIInput): AIInsight[] {
  const insights: AIInsight[] = [];
  const productMap = new Map(input.products.map((product) => [product.id, product]));

  if (!input.clientName.trim()) {
    insights.push({
      id: "missing-client",
      severity: "warning",
      title: "Cliente pendiente",
      message: "Completa el nombre del cliente antes de guardar o enviar la cotización.",
      action: "Agregar cliente",
    });
  }

  if (input.finalCart.length === 0) {
    insights.push({
      id: "empty-cart",
      severity: "info",
      title: "Cotización vacía",
      message: "Agrega artículos o carga el despiece del servicio para que la IA analice margen, stock y riesgos.",
      action: input.mode === "servicio" ? "Agregar despiece" : "Agregar productos",
    });
    return insights;
  }

  if (input.margin < 0) {
    insights.push({
      id: "negative-margin",
      severity: "danger",
      title: "Pérdida detectada",
      message: `La cotización está generando pérdida de ${money(Math.abs(input.profitTotal))}. Revisa precio, costo o descuento antes de enviar.`,
      action: "Revisar precios",
    });
  } else if (input.margin > 0 && input.margin < 18) {
    insights.push({
      id: "low-margin",
      severity: "warning",
      title: "Margen bajo",
      message: `Margen actual: ${percent(input.margin)}. Para operación sana, intenta subirlo por encima de 25%.`,
      action: "Recomendar precio",
    });
  } else if (input.margin >= 30) {
    insights.push({
      id: "healthy-margin",
      severity: "success",
      title: "Margen saludable",
      message: `Margen actual: ${percent(input.margin)} con utilidad estimada de ${money(input.profitTotal)}.`,
      action: "Listo para enviar",
    });
  }

  const zeroCostItems = input.finalCart.filter((item) => item.cost_price <= 0 && item.item_type !== "servicio");
  if (zeroCostItems.length > 0) {
    insights.push({
      id: "zero-cost",
      severity: "warning",
      title: "Costos incompletos",
      message: `${zeroCostItems.length} producto(s) no tienen costo. La utilidad puede verse falsa o inflada.`,
      action: "Actualizar costo",
    });
  }

  const belowCostItems = input.finalCart.filter(
    (item) => item.item_type !== "servicio" && item.cost_price > 0 && item.price < item.cost_price,
  );
  if (belowCostItems.length > 0) {
    insights.push({
      id: "below-cost",
      severity: "danger",
      title: "Venta por debajo del costo",
      message: `${belowCostItems.length} producto(s) tienen precio menor que su costo. Esto debe corregirse antes de facturar.`,
      action: "Corregir precio",
    });
  }

  const stockIssues = input.cart.filter((item) => {
    if (!item.product_id) return false;
    const product = productMap.get(item.product_id);
    if (!product) return false;
    return getProductStock(product) < item.quantity;
  });
  if (stockIssues.length > 0) {
    insights.push({
      id: "stock-risk",
      severity: "danger",
      title: "Stock insuficiente",
      message: `${stockIssues.length} producto(s) no tienen stock suficiente para cumplir esta cotización.`,
      action: "Revisar inventario",
    });
  }

  const lowStock = input.cart.filter((item) => {
    if (!item.product_id) return false;
    const product = productMap.get(item.product_id);
    if (!product) return false;
    const stock = getProductStock(product);
    return stock > 0 && stock <= 5;
  });
  if (lowStock.length > 0) {
    insights.push({
      id: "low-stock",
      severity: "warning",
      title: "Stock crítico",
      message: `${lowStock.length} producto(s) están en nivel bajo. Conviene preparar reposición antes de convertir a venta.`,
      action: "Sugerir compra",
    });
  }

  if (input.mode === "servicio") {
    if (input.serviceStats.piecesTotal === 0) {
      insights.push({
        id: "no-pieces",
        severity: "warning",
        title: "Despiece pendiente",
        message: "Agrega piezas para calcular corte, canteo, CNC y optimización de plancha.",
        action: "Agregar piezas",
      });
    }

    if (input.nestingResult.oversized.length > 0) {
      insights.push({
        id: "oversized-pieces",
        severity: "danger",
        title: "Piezas fuera de plancha",
        message: `${input.nestingResult.oversized.length} pieza(s) no caben en la plancha seleccionada. Cambia medida, plancha o divide la pieza.`,
        action: "Revisar medidas",
      });
    }

    if (input.nestingResult.boards.length > 0) {
      const utilization = 100 - input.nestingResult.wastePercent;
      if (input.nestingResult.wastePercent > 35) {
        insights.push({
          id: "high-waste",
          severity: "warning",
          title: "Merma alta",
          message: `Merma estimada: ${percent(input.nestingResult.wastePercent)}. Revisa orientación, plancha ${input.boardSize} o reordena piezas.`,
          action: "Optimizar plancha",
        });
      } else {
        insights.push({
          id: "good-nesting",
          severity: "success",
          title: "Optimización aceptable",
          message: `Aprovechamiento estimado: ${percent(utilization)} usando ${input.nestingResult.boards.length} plancha(s).`,
          action: "Generar orden corte",
        });
      }
    }

    if (input.grainDirection !== "sin_veta") {
      insights.push({
        id: "grain-lock",
        severity: "info",
        title: "Veta protegida",
        message: "La rotación está limitada por la dirección de veta. Esto puede aumentar merma, pero evita errores visuales en producción.",
        action: "Validar veta",
      });
    }
  }

  if (input.total > 0 && input.tax <= 0) {
    insights.push({
      id: "tax-check",
      severity: "warning",
      title: "ITBIS no calculado",
      message: "La cotización tiene total, pero no muestra ITBIS. Revisa la configuración fiscal.",
      action: "Revisar ITBIS",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "ready",
      severity: "success",
      title: "Cotización estable",
      message: "No detecté riesgos críticos. Puedes guardar, enviar o convertir a venta cuando el cliente confirme.",
      action: "Enviar cliente",
    });
  }

  return insights.slice(0, 8);
}

function getQuoteAIScore(insights: AIInsight[], margin: number, total: number) {
  if (total <= 0) return 0;
  let score = 78;
  score += Math.min(12, Math.max(0, margin - 20) * 0.5);
  score -= insights.filter((i) => i.severity === "danger").length * 22;
  score -= insights.filter((i) => i.severity === "warning").length * 9;
  score += insights.filter((i) => i.severity === "success").length * 4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default function CotizacionesArticulosServiciosProPage() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<QuoteMode>("articulos");

  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteItemsById, setQuoteItemsById] = useState<
    Record<string, QuoteItem[]>
  >({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchProduct, setSearchProduct] = useState("");
  const [searchQuote, setSearchQuote] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos");

  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientDocument, setClientDocument] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [sellerName, setSellerName] = useState("Ruben Santana");
  const [validUntil, setValidUntil] = useState(addDaysISO(15));
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(
    "Precios válidos hasta la fecha indicada. Cotización sujeta a disponibilidad. Los servicios de corte/canteo requieren medidas confirmadas por el cliente.",
  );

  const [materialOwner, setMaterialOwner] = useState<MaterialOwner>("cliente");
  const [boardType, setBoardType] = useState("Melamina");
  const [boardSize, setBoardSize] = useState<BoardSize>("4x8");
  const [boardWidthMm, setBoardWidthMm] = useState("1220");
  const [boardHeightMm, setBoardHeightMm] = useState("2440");
  const [thicknessMm, setThicknessMm] = useState("18");
  const [boardColor, setBoardColor] = useState("");
  const [grainDirection, setGrainDirection] =
    useState<GrainDirection>("sin_veta");
  const [cutPrice, setCutPrice] = useState(String(DEFAULT_CUT_PRICE_PER_FT));
  const [edgePrice, setEdgePrice] = useState(String(DEFAULT_EDGE_PRICE_PER_ML));
  const [cncPrice, setCncPrice] = useState(String(DEFAULT_CNC_PRICE));
  const [serviceDescription, setServiceDescription] = useState("");

  const [pieceName, setPieceName] = useState("");
  const [pieceLength, setPieceLength] = useState("");
  const [pieceWidth, setPieceWidth] = useState("");
  const [pieceQty, setPieceQty] = useState("1");
  const [edgeFront, setEdgeFront] = useState(false);
  const [edgeBack, setEdgeBack] = useState(false);
  const [edgeLeft, setEdgeLeft] = useState(false);
  const [edgeRight, setEdgeRight] = useState(false);
  const [pieceCnc, setPieceCnc] = useState(false);
  const [pieceObs, setPieceObs] = useState("");
  const [cutPieces, setCutPieces] = useState<CutPiece[]>([]);

  const [cart, setCart] = useState<QuoteItem[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    if (requestedMode === "servicio" || requestedMode === "articulos") {
      setMode(requestedMode);
    }
  }, [searchParams]);

  useEffect(() => {
    const dims = getBoardDimensions(boardSize, boardWidthMm, boardHeightMm);
    if (boardSize !== "personalizada") {
      setBoardWidthMm(String(dims.width));
      setBoardHeightMm(String(dims.height));
    }
  }, [boardSize]);

  const serviceStats = useMemo(() => {
    const piecesTotal = cutPieces.reduce((acc, p) => acc + p.quantity, 0);
    const cutFeet = cutPieces.reduce((acc, p) => acc + cutFeetForPiece(p), 0);
    const edgeMeters = cutPieces.reduce(
      (acc, p) => acc + edgeMetersForPiece(p),
      0,
    );
    const cncQty = cutPieces.reduce(
      (acc, p) => acc + (p.cnc ? p.quantity : 0),
      0,
    );
    const boardArea = toNumber(boardWidthMm) * toNumber(boardHeightMm);
    const piecesArea = cutPieces.reduce(
      (acc, p) => acc + p.length_mm * p.width_mm * p.quantity,
      0,
    );
    const estimatedBoards =
      boardArea > 0 ? Math.ceil(piecesArea / boardArea) : 0;
    const wastePercent =
      boardArea * estimatedBoards > 0
        ? Math.max(0, 100 - (piecesArea / (boardArea * estimatedBoards)) * 100)
        : 0;

    const cutAmount = cutFeet * toNumber(cutPrice);
    const edgeAmount = edgeMeters * toNumber(edgePrice);
    const cncAmount = cncQty * toNumber(cncPrice);

    return {
      piecesTotal,
      cutFeet,
      edgeMeters,
      cncQty,
      estimatedBoards,
      wastePercent,
      cutAmount,
      edgeAmount,
      cncAmount,
      total: cutAmount + edgeAmount + cncAmount,
    };
  }, [cutPieces, boardWidthMm, boardHeightMm, cutPrice, edgePrice, cncPrice]);

  const nestingResult = useMemo(() => {
    return buildNestingLayout(
      cutPieces,
      toNumber(boardWidthMm),
      toNumber(boardHeightMm),
      grainDirection,
    );
  }, [cutPieces, boardWidthMm, boardHeightMm, grainDirection]);

  const serviceItems = useMemo<QuoteItem[]>(() => {
    if (mode !== "servicio") return [];

    const items: QuoteItem[] = [];

    if (serviceStats.cutFeet > 0) {
      items.push({
        product_id: null,
        product_name: "Servicio de corte por despiece",
        quantity: Number(serviceStats.cutFeet.toFixed(2)),
        price: toNumber(cutPrice),
        cost_price: 0,
        subtotal: serviceStats.cutAmount,
        profit: serviceStats.cutAmount,
        item_type: "servicio",
      });
    }

    if (serviceStats.edgeMeters > 0) {
      items.push({
        product_id: null,
        product_name: "Servicio de canteo por despiece",
        quantity: Number(serviceStats.edgeMeters.toFixed(2)),
        price: toNumber(edgePrice),
        cost_price: 0,
        subtotal: serviceStats.edgeAmount,
        profit: serviceStats.edgeAmount,
        item_type: "servicio",
      });
    }

    if (serviceStats.cncQty > 0) {
      items.push({
        product_id: null,
        product_name: "Servicio CNC / perforación / mecanizado",
        quantity: serviceStats.cncQty,
        price: toNumber(cncPrice),
        cost_price: 0,
        subtotal: serviceStats.cncAmount,
        profit: serviceStats.cncAmount,
        item_type: "servicio",
      });
    }

    return items;
  }, [mode, serviceStats, cutPrice, edgePrice, cncPrice]);

  const finalCart = useMemo(() => {
    if (mode === "servicio") return serviceItems;
    return cart;
  }, [mode, cart, serviceItems]);

  async function loadData() {
    setLoading(true);

    try {
      const [clientsRes, productsRes, quotesRes, itemsRes] = await Promise.all([
        supabase
          .from("clients")
          .select("*")
          .order("full_name", { ascending: true }),
        supabase
          .from("products")
          .select("*")
          .order("name", { ascending: true }),
        supabase
          .from("quotes")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("quote_items")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (productsRes.error) throw productsRes.error;
      if (quotesRes.error) throw quotesRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setClients(clientsRes.data || []);
      setProducts(productsRes.data || []);
      setQuotes(quotesRes.data || []);

      const grouped: Record<string, QuoteItem[]> = {};
      (itemsRes.data || []).forEach((item: any) => {
        if (!grouped[item.quote_id]) grouped[item.quote_id] = [];
        grouped[item.quote_id].push({
          id: item.id,
          quote_id: item.quote_id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: toNumber(item.quantity),
          price: toNumber(item.price),
          cost_price: toNumber(item.cost_price),
          subtotal: toNumber(item.subtotal),
          profit: toNumber(item.profit),
          item_type: item.item_type || "producto",
        });
      });

      setQuoteItemsById(grouped);
    } catch (error: any) {
      alert("Error cargando cotizaciones: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const term = clean(searchProduct);
    return products.filter((p) => {
      const name = getProductName(p).toLowerCase();
      const category = (p.category || "").toLowerCase();
      return !term || name.includes(term) || category.includes(term);
    });
  }, [products, searchProduct]);

  const filteredQuotes = useMemo(() => {
    const term = clean(searchQuote);
    return quotes.filter((q) => {
      if (!isCommercialModuleQuote(q)) return false;

      const quoteType = getQuoteModeFromQuote(q);

      const matchesSearch =
        !term ||
        (q.quote_number || "").toLowerCase().includes(term) ||
        (q.client_name || "").toLowerCase().includes(term) ||
        (q.client_phone || "").toLowerCase().includes(term) ||
        (q.client_email || "").toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "todos" ||
        (q.status || "").toLowerCase() === statusFilter;
      const matchesType = typeFilter === "todos" || quoteType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [quotes, searchQuote, statusFilter, typeFilter]);

  const subtotal = useMemo(
    () => finalCart.reduce((acc, item) => acc + item.subtotal, 0),
    [finalCart],
  );
  const tax = subtotal * ITBIS_RATE;
  const total = subtotal + tax;
  const costTotal = useMemo(
    () =>
      finalCart.reduce((acc, item) => acc + item.cost_price * item.quantity, 0),
    [finalCart],
  );
  const profitTotal = subtotal - costTotal;
  const margin = subtotal > 0 ? (profitTotal / subtotal) * 100 : 0;

  const kpis = useMemo(() => {
    const totalQuotes = filteredQuotes.length;
    const totalAmount = filteredQuotes.reduce(
      (acc, q) => acc + toNumber(q.total),
      0,
    );
    const approved = filteredQuotes.filter(
      (q) => q.status === "aprobada" || q.status === "convertida",
    ).length;
    const pending = filteredQuotes.filter(
      (q) => q.status === "borrador" || q.status === "enviada",
    ).length;
    const expired = filteredQuotes.filter((q) => {
      if (!q.valid_until) return false;
      return (
        q.status !== "convertida" &&
        q.status !== "aprobada" &&
        new Date(q.valid_until) < new Date(todayISO())
      );
    }).length;

    return { totalQuotes, totalAmount, approved, pending, expired };
  }, [filteredQuotes]);

  const aiInsights = useMemo(
    () =>
      buildQuoteAIInsights({
        mode,
        clientName,
        finalCart,
        cart,
        products,
        subtotal,
        tax,
        total,
        costTotal,
        profitTotal,
        margin,
        serviceStats,
        nestingResult,
        boardSize,
        grainDirection,
      }),
    [
      mode,
      clientName,
      finalCart,
      cart,
      products,
      subtotal,
      tax,
      total,
      costTotal,
      profitTotal,
      margin,
      serviceStats,
      nestingResult,
      boardSize,
      grainDirection,
    ],
  );

  const aiScore = useMemo(
    () => getQuoteAIScore(aiInsights, margin, total),
    [aiInsights, margin, total],
  );

  function selectClient(id: string) {
    setClientId(id);
    const client = clients.find((c) => c.id === id);
    if (!client) return;

    setClientName(client.full_name || "");
    setClientPhone(client.phone || "");
    setClientEmail(client.email || "");
    setClientDocument(client.document || "");
    setClientAddress(client.address || "");
  }

  function addProduct(product: Product) {
    const productName = getProductName(product);
    const price = getProductPrice(product);
    const cost = getProductCost(product);

    if (price <= 0) {
      alert("Este producto no tiene precio de venta.");
      return;
    }

    const existing = cart.find((item) => item.product_id === product.id);
    if (existing) {
      changeQty(product.id, existing.quantity + 1);
      return;
    }

    const quantity = 1;
    setCart((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: productName,
        quantity,
        price,
        cost_price: cost,
        subtotal: price * quantity,
        profit: (price - cost) * quantity,
        item_type: "producto",
      },
    ]);
  }

  function recalc(item: QuoteItem, quantity: number, price = item.price) {
    const qty = Math.max(1, toNumber(quantity));
    const subtotal = qty * price;
    return {
      ...item,
      quantity: qty,
      price,
      subtotal,
      profit: subtotal - item.cost_price * qty,
    };
  }

  function changeQty(productId: string | null, qty: number) {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId ? recalc(item, qty) : item,
      ),
    );
  }

  function changePrice(productId: string | null, value: string) {
    const price = Math.max(0, toNumber(value));
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? recalc(item, item.quantity, price)
          : item,
      ),
    );
  }

  function removeItem(productId: string | null) {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  }

  function resetPieceForm() {
    setPieceName("");
    setPieceLength("");
    setPieceWidth("");
    setPieceQty("1");
    setEdgeFront(false);
    setEdgeBack(false);
    setEdgeLeft(false);
    setEdgeRight(false);
    setPieceCnc(false);
    setPieceObs("");
  }

  function addCutPiece() {
    const length = toNumber(pieceLength);
    const width = toNumber(pieceWidth);
    const quantity = Math.max(1, toNumber(pieceQty));

    if (!pieceName.trim()) {
      alert("Escribe el nombre de la pieza.");
      return;
    }

    if (length <= 0 || width <= 0) {
      alert("La pieza necesita largo y ancho en milímetros.");
      return;
    }

    setCutPieces((prev) => [
      ...prev,
      {
        local_id: uid(),
        piece_name: pieceName.trim(),
        length_mm: length,
        width_mm: width,
        quantity,
        edge_front: edgeFront,
        edge_back: edgeBack,
        edge_left: edgeLeft,
        edge_right: edgeRight,
        cnc: pieceCnc,
        observations: pieceObs.trim(),
      },
    ]);

    resetPieceForm();
  }

  function duplicatePiece(piece: CutPiece) {
    setCutPieces((prev) => [
      ...prev,
      { ...piece, local_id: uid(), piece_name: `${piece.piece_name} copia` },
    ]);
  }

  function removePiece(localId: string) {
    setCutPieces((prev) => prev.filter((p) => p.local_id !== localId));
  }

  function updatePiece(localId: string, patch: Partial<CutPiece>) {
    setCutPieces((prev) =>
      prev.map((p) => (p.local_id === localId ? { ...p, ...patch } : p)),
    );
  }

  function clearForm() {
    setSelectedQuote(null);
    setMode("articulos");
    setClientId("");
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setClientDocument("");
    setClientAddress("");
    setSellerName("Ruben Santana");
    setValidUntil(addDaysISO(15));
    setNotes("");
    setTerms(
      "Precios válidos hasta la fecha indicada. Cotización sujeta a disponibilidad. Los servicios de corte/canteo requieren medidas confirmadas por el cliente.",
    );
    setCart([]);
    setCutPieces([]);
    setMaterialOwner("cliente");
    setBoardType("Melamina");
    setBoardSize("4x8");
    setBoardWidthMm("1220");
    setBoardHeightMm("2440");
    setThicknessMm("18");
    setBoardColor("");
    setGrainDirection("sin_veta");
    setCutPrice(String(DEFAULT_CUT_PRICE_PER_FT));
    setEdgePrice(String(DEFAULT_EDGE_PRICE_PER_ML));
    setCncPrice(String(DEFAULT_CNC_PRICE));
    setServiceDescription("");
    resetPieceForm();
  }

  function validateQuote() {
    if (!clientName.trim()) {
      alert("Escribe o selecciona un cliente.");
      return false;
    }

    if (mode === "articulos" && finalCart.length === 0) {
      alert("Agrega productos a la cotización.");
      return false;
    }

    if (mode === "servicio" && cutPieces.length === 0) {
      alert("Agrega el despiece para calcular corte/canteo/CNC.");
      return false;
    }

    if (mode === "articulos") {
      const noCost = finalCart.find((item) => item.cost_price <= 0);
      if (noCost) {
        const ok = confirm(
          `El producto "${noCost.product_name}" no tiene costo. La utilidad no será real. ¿Continuar?`,
        );
        if (!ok) return false;
      }
    }

    return true;
  }

  function buildNotesPayload() {
    if (mode !== "servicio") return notes.trim() || null;

    const serviceLines = [
      notes.trim(),
      serviceDescription.trim(),
      `Material: ${materialOwner === "cliente" ? "suministrado por cliente" : "suministrado por RD Wood"}`,
      `Tablero: ${boardType} ${boardSize} ${boardWidthMm}x${boardHeightMm}mm, espesor ${thicknessMm}mm`,
      `Color: ${boardColor || "N/A"}`,
      `Veta: ${grainDirection}`,
      `Piezas: ${serviceStats.piecesTotal}`,
      `Pies corte: ${serviceStats.cutFeet.toFixed(2)}`,
      `ML canto: ${serviceStats.edgeMeters.toFixed(2)}`,
      `CNC: ${serviceStats.cncQty}`,
    ];

    return serviceLines.filter(Boolean).join("\n");
  }

  async function saveQuote(status = "borrador") {
    if (!validateQuote()) return;

    setSaving(true);

    try {
      // IMPORTANTE: este payload usa SOLO columnas base ya existentes en quotes.
      // Los datos técnicos del servicio se guardan dentro de notes y quote_items
      // para no romper el esquema actual ni crear columnas nuevas.
      const payload: any = {
        quote_number: selectedQuote?.quote_number || quoteNumber(mode),
        client_id: clientId || null,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim() || null,
        client_email: clientEmail.trim() || null,
        client_document: clientDocument.trim() || null,
        client_address: clientAddress.trim() || null,
        seller_name: sellerName.trim(),
        quote_type: mode,
        subtotal,
        tax,
        total,
        cost_total: costTotal,
        profit_total: profitTotal,
        margin,
        status,
        valid_until: validUntil || null,
        notes: buildNotesPayload(),
        terms: terms.trim() || null,
      };

      let quoteId = selectedQuote?.id;

      if (selectedQuote) {
        const { error } = await supabase
          .from("quotes")
          .update(payload)
          .eq("id", selectedQuote.id);
        if (error) throw error;

        const { error: deleteItemsError } = await supabase
          .from("quote_items")
          .delete()
          .eq("quote_id", selectedQuote.id);
        if (deleteItemsError) throw deleteItemsError;

        await safeDeleteCutPieces(selectedQuote.id);
      } else {
        const { data, error } = await supabase
          .from("quotes")
          .insert(payload)
          .select("id, quote_number")
          .maybeSingle();

        if (error) throw error;

        quoteId = data?.id;

        // Respaldo: si Supabase no devuelve el id por RLS/schema cache,
        // buscamos la cotización creada por su número antes de insertar items.
        if (!quoteId) {
          const { data: foundQuote, error: findError } = await supabase
            .from("quotes")
            .select("id")
            .eq("quote_number", payload.quote_number)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (findError) throw findError;
          quoteId = foundQuote?.id;
        }
      }

      if (!quoteId) {
        throw new Error("La cotización se guardó sin devolver ID. No se pueden guardar los productos hasta validar la tabla quotes.");
      }

      const finalQuoteId = String(quoteId);

      const itemsPayload = finalCart.map((item) => ({
        quote_id: finalQuoteId,
        product_id: item.product_id || null,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        cost_price: item.cost_price,
        subtotal: item.subtotal,
        profit: item.profit,
        item_type:
          item.item_type || (mode === "servicio" ? "servicio" : "producto"),
      }));

      if (itemsPayload.length > 0) {
        const { error: itemsError } = await supabase
          .from("quote_items")
          .insert(itemsPayload);
        if (itemsError) throw itemsError;
      }

      if (mode === "servicio") {
        await safeInsertCutPieces(finalQuoteId);
      }

      alert(
        status === "enviada"
          ? "Cotización guardada y marcada como enviada."
          : "Cotización guardada correctamente.",
      );
      clearForm();
      await loadData();
    } catch (error: any) {
      alert("Error guardando cotización: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function safeDeleteCutPieces(quoteId: string) {
    try {
      await supabase
        .from("quote_service_pieces")
        .delete()
        .eq("quote_id", quoteId);
    } catch {
      // Tabla opcional. Si no existe, el módulo sigue funcionando guardando resumen en notes.
    }
  }

  async function safeInsertCutPieces(quoteId: string) {
    try {
      const payload = cutPieces.map((p, index) => ({
        quote_id: quoteId,
        piece_index: index + 1,
        piece_name: p.piece_name,
        length_mm: p.length_mm,
        width_mm: p.width_mm,
        quantity: p.quantity,
        edge_front: p.edge_front,
        edge_back: p.edge_back,
        edge_left: p.edge_left,
        edge_right: p.edge_right,
        cnc: p.cnc,
        observations: p.observations || null,
      }));

      await supabase.from("quote_service_pieces").insert(payload);
    } catch {
      // Tabla opcional. Si no existe, no bloquea la cotización.
    }
  }

  function editQuote(quote: Quote) {
    const quoteMode = getQuoteModeFromQuote(quote);
    setSelectedQuote(quote);
    setMode(quoteMode);
    setClientId(quote.client_id || "");
    setClientName(quote.client_name || "");
    setClientPhone(quote.client_phone || "");
    setClientEmail(quote.client_email || "");
    setClientDocument(quote.client_document || "");
    setClientAddress(quote.client_address || "");
    setSellerName(quote.seller_name || "Ruben Santana");
    setValidUntil(quote.valid_until || addDaysISO(15));
    setNotes(quote.notes || "");
    setTerms(quote.terms || "");
    setMaterialOwner(
      (quote.service_material_owner as MaterialOwner) || "cliente",
    );
    setBoardType(quote.service_board_type || "Melamina");
    setBoardSize((quote.service_board_size as BoardSize) || "4x8");
    setBoardWidthMm(String(toNumber(quote.service_board_width_mm) || 1220));
    setBoardHeightMm(String(toNumber(quote.service_board_height_mm) || 2440));
    setThicknessMm(String(toNumber(quote.service_thickness_mm) || 18));
    setBoardColor(quote.service_color || "");
    setGrainDirection((quote.service_grain as GrainDirection) || "sin_veta");
    setCutPrice(
      String(toNumber(quote.service_cut_price) || DEFAULT_CUT_PRICE_PER_FT),
    );
    setEdgePrice(
      String(toNumber(quote.service_edge_price) || DEFAULT_EDGE_PRICE_PER_ML),
    );
    setCncPrice(String(toNumber(quote.service_cnc_price) || DEFAULT_CNC_PRICE));
    setServiceDescription(quote.service_description || "");
    setCart(quoteMode === "articulos" ? quoteItemsById[quote.id] || [] : []);
    setCutPieces([]);
  }

  async function deleteQuote(quote: Quote) {
    const ok = confirm(
      `¿Seguro que deseas eliminar la cotización ${quote.quote_number}?`,
    );
    if (!ok) return;

    try {
      await supabase.from("quote_items").delete().eq("quote_id", quote.id);
      await safeDeleteCutPieces(quote.id);
      const { error } = await supabase
        .from("quotes")
        .delete()
        .eq("id", quote.id);
      if (error) throw error;
      await loadData();
    } catch (error: any) {
      alert("Error eliminando cotización: " + error.message);
    }
  }

  function buildCurrentQuoteData(): Quote {
    return {
      id: selectedQuote?.id || "",
      created_at: new Date().toISOString(),
      quote_number: selectedQuote?.quote_number || quoteNumber(mode),
      quote_type: mode,
      client_id: clientId || null,
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail,
      client_document: clientDocument,
      client_address: clientAddress,
      seller_name: sellerName,
      subtotal,
      tax,
      total,
      cost_total: costTotal,
      profit_total: profitTotal,
      margin,
      status: "borrador",
      valid_until: validUntil,
      notes: buildNotesPayload(),
      terms,
      service_linear_feet: Number(serviceStats.cutFeet.toFixed(2)),
      service_edge_meters: Number(serviceStats.edgeMeters.toFixed(2)),
      service_cnc_qty: serviceStats.cncQty,
      service_cut_price: toNumber(cutPrice),
      service_edge_price: toNumber(edgePrice),
      service_cnc_price: toNumber(cncPrice),
      service_material_owner: materialOwner,
      service_board_type: boardType,
      service_board_size: boardSize,
      service_board_width_mm: toNumber(boardWidthMm),
      service_board_height_mm: toNumber(boardHeightMm),
      service_thickness_mm: toNumber(thicknessMm),
      service_color: boardColor,
      service_grain: grainDirection,
      service_description: serviceDescription,
    };
  }

  function generatePDF(quote?: Quote) {
    const data = quote || buildCurrentQuoteData();
    const quoteMode = data.quote_number?.startsWith("SER-") ? "servicio" : (data.quote_type || mode || "articulos") as QuoteMode;
    const items = quote ? quoteItemsById[quote.id] || [] : finalCart;

    if (!quote && !validateQuote()) return;

    const doc = new jsPDF("p", "mm", "letter");

    doc.setFillColor(2, 6, 23);
    doc.rect(0, 0, 216, 42, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text("RD WOOD SYSTEM", 14, 16);
    doc.setFontSize(10);
    doc.text("Santana Group / RD Wood Design", 14, 25);
    doc.text(
      quoteMode === "servicio"
        ? "Cotización de Corte / Canteo / CNC"
        : "Cotización de Venta de Artículos",
      14,
      32,
    );
    doc.setFontSize(13);
    doc.text("COTIZACIÓN", 158, 16);
    doc.setFontSize(10);
    doc.text(data.quote_number || "COTIZACIÓN", 158, 24);
    doc.text(`Fecha: ${formatDate(data.created_at)}`, 158, 31);
    doc.text(`Válida hasta: ${formatDate(data.valid_until)}`, 158, 37);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text("Datos del cliente", 14, 55);
    doc.setFontSize(10);
    doc.text(`Cliente: ${data.client_name || "Cliente general"}`, 14, 64);
    doc.text(`Teléfono: ${data.client_phone || "N/A"}`, 14, 71);
    doc.text(`Email: ${data.client_email || "N/A"}`, 14, 78);
    doc.text(`RNC/Cédula: ${data.client_document || "N/A"}`, 14, 85);
    doc.text(`Dirección: ${data.client_address || "N/A"}`, 14, 92);
    doc.text(`Vendedor: ${data.seller_name || "N/A"}`, 14, 99);

    if (quoteMode === "servicio") {
      doc.setFontSize(12);
      doc.text("Resumen técnico", 14, 111);
      doc.setFontSize(9);
      doc.text(
        `Material: ${data.service_material_owner === "cliente" ? "Cliente" : "RD Wood"}`,
        14,
        119,
      );
      doc.text(
        `Tablero: ${data.service_board_type || boardType} ${data.service_board_size || boardSize}`,
        70,
        119,
      );
      doc.text(
        `Medida: ${data.service_board_width_mm || boardWidthMm} x ${data.service_board_height_mm || boardHeightMm} mm`,
        14,
        126,
      );
      doc.text(
        `Espesor: ${data.service_thickness_mm || thicknessMm} mm`,
        70,
        126,
      );
      doc.text(`Color: ${data.service_color || boardColor || "N/A"}`, 105, 126);
      doc.text(`Veta: ${data.service_grain || grainDirection}`, 150, 126);
    }

    autoTable(doc, {
      startY: quoteMode === "servicio" ? 136 : 110,
      head: [
        [
          quoteMode === "servicio" ? "Servicio" : "Producto",
          "Cant.",
          "Precio",
          "Subtotal",
        ],
      ],
      body: items.map((item) => [
        item.product_name,
        item.quantity,
        money(item.price),
        money(item.subtotal),
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
    });

    let finalY = (doc as any).lastAutoTable?.finalY || 160;

    if (!quote && quoteMode === "servicio" && cutPieces.length > 0) {
      if (finalY > 170) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFontSize(12);
      doc.text("Despiece cotizado", 14, finalY + 12);

      autoTable(doc, {
        startY: finalY + 18,
        head: [["Pieza", "Largo", "Ancho", "Cant.", "Cantos", "CNC"]],
        body: cutPieces.map((p) => [
          p.piece_name,
          `${p.length_mm} mm`,
          `${p.width_mm} mm`,
          p.quantity,
          [
            p.edge_front ? "F" : "",
            p.edge_back ? "A" : "",
            p.edge_left ? "I" : "",
            p.edge_right ? "D" : "",
          ]
            .filter(Boolean)
            .join("/") || "—",
          p.cnc ? "Sí" : "No",
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42] },
        margin: { left: 14, right: 14 },
      });

      finalY = (doc as any).lastAutoTable?.finalY || finalY + 50;
    }

    if (finalY > 205) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(10);
    doc.text("Subtotal:", 130, finalY + 14);
    doc.text(money(toNumber(data.subtotal)), 194, finalY + 14, {
      align: "right",
    });
    doc.text("ITBIS 18%:", 130, finalY + 22);
    doc.text(money(toNumber(data.tax)), 194, finalY + 22, { align: "right" });

    doc.setTextColor(37, 99, 235);
    doc.setFontSize(14);
    doc.text("TOTAL:", 130, finalY + 34);
    doc.text(money(toNumber(data.total)), 194, finalY + 34, { align: "right" });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.text("Notas / condiciones:", 14, finalY + 50);
    const noteLines = doc.splitTextToSize(data.terms || "N/A", 180);
    doc.text(noteLines, 14, finalY + 58);
    doc.setFontSize(8);
    doc.text(
      "WhatsApp: +1 (809) 690-5636 | info.santanagroup@gmail.com",
      14,
      266,
    );

    doc.save(`${data.quote_number || "cotizacion"}.pdf`);
  }

  function generateCutOrderPDF() {
    if (mode !== "servicio") return;
    if (!validateQuote()) return;

    const code = selectedQuote?.quote_number || quoteNumber("servicio");
    const doc = new jsPDF("p", "mm", "letter");

    doc.setFillColor(2, 6, 23);
    doc.rect(0, 0, 216, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("ORDEN INTERNA DE CORTE", 14, 15);
    doc.setFontSize(10);
    doc.text("RD Wood System · Corte / Canteo / CNC", 14, 24);
    doc.text(code, 160, 15);
    doc.text(formatDateTime(new Date().toISOString()), 160, 24);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(`Cliente: ${clientName || "N/A"}`, 14, 50);
    doc.text(`Teléfono: ${clientPhone || "N/A"}`, 14, 58);
    doc.text(
      `Material: ${materialOwner === "cliente" ? "Cliente" : "RD Wood"}`,
      14,
      66,
    );
    doc.text(
      `Tablero: ${boardType} ${boardSize} · ${boardWidthMm}x${boardHeightMm}x${thicknessMm} mm`,
      14,
      74,
    );
    doc.text(`Color: ${boardColor || "N/A"} · Veta: ${grainDirection}`, 14, 82);

    autoTable(doc, {
      startY: 92,
      head: [
        [
          "#",
          "Pieza",
          "Largo",
          "Ancho",
          "Cant.",
          "Canto F",
          "Canto A",
          "Canto I",
          "Canto D",
          "CNC",
          "Obs.",
        ],
      ],
      body: cutPieces.map((p, i) => [
        i + 1,
        p.piece_name,
        p.length_mm,
        p.width_mm,
        p.quantity,
        p.edge_front ? "Sí" : "No",
        p.edge_back ? "Sí" : "No",
        p.edge_left ? "Sí" : "No",
        p.edge_right ? "Sí" : "No",
        p.cnc ? "Sí" : "No",
        p.observations || "—",
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42] },
      margin: { left: 8, right: 8 },
    });

    const y = (doc as any).lastAutoTable?.finalY || 210;
    doc.setFontSize(10);
    doc.text(`Piezas: ${serviceStats.piecesTotal}`, 14, y + 12);
    doc.text(`Pies corte: ${serviceStats.cutFeet.toFixed(2)}`, 55, y + 12);
    doc.text(`ML canto: ${serviceStats.edgeMeters.toFixed(2)}`, 105, y + 12);
    doc.text(`CNC: ${serviceStats.cncQty}`, 155, y + 12);
    doc.text("Firma supervisor: ______________________________", 14, 260);

    if (nestingResult.boards.length > 0) {
      doc.addPage();
      doc.setFillColor(2, 6, 23);
      doc.rect(0, 0, 216, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text("OPTIMIZADOR DE PLANCHA", 14, 14);
      doc.setFontSize(9);
      doc.text(`Planchas: ${nestingResult.boards.length} · Aprovechamiento: ${(100 - nestingResult.wastePercent).toFixed(1)}% · Merma: ${nestingResult.wastePercent.toFixed(1)}%`, 14, 22);
      doc.setTextColor(15, 23, 42);

      let yPos = 42;
      nestingResult.boards.slice(0, 3).forEach((board) => {
        if (yPos > 205) {
          doc.addPage();
          yPos = 22;
        }
        const previewW = 178;
        const previewH = Math.min(86, (previewW * board.height) / board.width);
        const xPos = 14;
        doc.setFontSize(10);
        doc.text(`Plancha ${board.index + 1} · ${board.width}x${board.height}mm · Merma ${board.wastePercent.toFixed(1)}%`, xPos, yPos - 4);
        doc.setDrawColor(15, 23, 42);
        doc.rect(xPos, yPos, previewW, previewH);
        board.pieces.forEach((piece, idx) => {
          const px = xPos + (piece.x / board.width) * previewW;
          const py = yPos + (piece.y / board.height) * previewH;
          const pw = Math.max(2, (piece.width / board.width) * previewW);
          const ph = Math.max(2, (piece.height / board.height) * previewH);
          const palette = [37, 99, 235, 6, 182, 212, 16, 185, 129, 245, 158, 11, 147, 51, 234];
          const offset = (idx % 5) * 3;
          doc.setFillColor(palette[offset], palette[offset + 1], palette[offset + 2]);
          doc.rect(px, py, pw, ph, "FD");
          if (pw > 16 && ph > 7) {
            doc.setFontSize(5);
            doc.setTextColor(255, 255, 255);
            doc.text(piece.name.slice(0, 16), px + 1, py + 4);
            doc.text(`${Math.round(piece.width)}x${Math.round(piece.height)}`, px + 1, py + 8);
            doc.setTextColor(15, 23, 42);
          }
        });
        yPos += previewH + 20;
      });

      if (nestingResult.boards.length > 3) {
        doc.setFontSize(9);
        doc.text(`Vista resumida: quedan ${nestingResult.boards.length - 3} planchas adicionales en pantalla del sistema.`, 14, yPos);
      }
    }

    doc.save(`orden-corte-${code}.pdf`);
  }

  function openWhatsApp(quote?: Quote) {
    const data = quote || buildCurrentQuoteData();
    const phone = (data.client_phone || "").replace(/\D/g, "");
    const tipo =
      (data.quote_number?.startsWith("SER-") || mode === "servicio")
        ? "servicio de corte/canteo/CNC"
        : "artículos";
    const text =
      `Hola ${data.client_name || ""}, le compartimos su cotización de ${tipo} RD Wood System.%0A` +
      `Cotización: ${data.quote_number || ""}%0A` +
      `Total: ${money(toNumber(data.total))}%0A` +
      `Gracias por preferirnos.`;

    const url = phone
      ? `https://wa.me/1${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  }

  async function convertToSale(quote: Quote) {
    const ok = confirm(`¿Convertir ${quote.quote_number} en venta?`);
    if (!ok) return;

    try {
      const generatedInvoiceNumber = invoiceNumber(quote.quote_number);
      const totalSale = toNumber(quote.total);
      const quoteMode = quote.quote_type === "servicio" ? "servicio_corte_canteo" : "articulos";

      const { data: sale, error } = await supabase
        .from("sales")
        .insert({
          client_id: quote.client_id,
          client_name: quote.client_name,
          client_phone: quote.client_phone,
          invoice_number: generatedInvoiceNumber,
          sale_no: generatedInvoiceNumber,
          project_name: quote.service_description || quote.quote_number || generatedInvoiceNumber,
          project_type: quoteMode,
          subtotal: toNumber(quote.subtotal),
          tax: toNumber(quote.tax),
          total: totalSale,
          cost_total: toNumber(quote.cost_total),
          profit_total: toNumber(quote.profit_total),
          payment_type: "contado",
          payment_method: "Caja Principal",
          payment_status: "Pendiente Caja",
          status: "pendiente_caja",
          workflow_status: "cotizacion_convertida_pendiente_caja_principal",
          amount_paid: 0,
          balance: totalSale,
        })
        .select()
        .single();

      if (error) throw error;

      const items = quoteItemsById[quote.id] || [];
      if (items.length > 0) {
        const { error: itemsError } = await supabase.from("sale_items").insert(
          items.map((item) => ({
            sale_id: sale.id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.price,
            cost_price: item.cost_price,
            subtotal: item.subtotal,
            profit: item.profit,
            item_type:
              item.item_type ||
              (getQuoteModeFromQuote(quote) === "servicio" ? "servicio" : "producto"),
          })),
        );

        if (itemsError) throw itemsError;
      }

      await writeAuditLog({
        module: "cotizaciones",
        action: "quote_converted_to_invoice_pending_cashier",
        entity_type: "sales",
        entity_id: sale.id,
        entity_name: generatedInvoiceNumber,
        new_data: {
          sale,
          quote_id: quote.id,
          quote_number: quote.quote_number,
          rule: "Cobro exclusivo por Caja Principal",
        },
        severity: "info",
      });

      await supabase
        .from("quotes")
        .update({ status: "convertida" })
        .eq("id", quote.id);
      window.open(`/pagos?sale_id=${sale.id}`, "_blank", "noopener,noreferrer");
      alert("Cotizacion convertida en factura pendiente. El cobro debe registrarse en Caja Principal.");
      await loadData();
    } catch (error: any) {
      alert("Error convirtiendo cotización: " + error.message);
    }
  }

  function exportCSV() {
    downloadCSV("cotizaciones_articulos_servicios_rdwood.csv", [
      [
        "Tipo",
        "Cotización",
        "Fecha",
        "Cliente",
        "Teléfono",
        "Estado",
        "Válida hasta",
        "Subtotal",
        "ITBIS",
        "Total",
        "Costo",
        "Ganancia",
        "Margen",
      ],
      ...filteredQuotes.map((q) => [
        getQuoteModeFromQuote(q),
        q.quote_number,
        formatDate(q.created_at),
        q.client_name,
        q.client_phone,
        q.status,
        formatDate(q.valid_until),
        q.subtotal,
        q.tax,
        q.total,
        q.cost_total,
        q.profit_total,
        q.margin,
      ]),
    ]);
  }

  function isExpired(q: Quote) {
    if (!q.valid_until) return false;
    if (q.status === "convertida" || q.status === "aprobada") return false;
    return new Date(q.valid_until) < new Date(todayISO());
  }

  return (
    <div className="min-h-screen bg-[#020617] pb-10 text-white">
      <div className="space-y-6 p-4 md:p-6">
        <section className="overflow-hidden rounded-[28px] border border-cyan-500/30 bg-gradient-to-r from-[#07111f] via-[#0f172a] to-[#12235a] p-5 shadow-2xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.35em] text-cyan-200">
                RD Wood System · Cotización Comercial
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
                Cotizaciones Comerciales PRO
              </h1>
              <p className="mt-2 max-w-4xl text-sm font-semibold text-slate-300">
                Un solo modulo para venta de articulos y servicios de corte/canteo.
                Selecciona el tipo de cotizacion dentro de esta pantalla.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ActionButton
                icon={<Printer size={17} />}
                label="PDF cliente"
                onClick={() => generatePDF()}
              />
              <ActionButton
                icon={<Scissors size={17} />}
                label="Orden corte"
                onClick={generateCutOrderPDF}
                disabled={mode !== "servicio"}
              />
              <ActionButton
                icon={<Download size={17} />}
                label="CSV"
                onClick={exportCSV}
              />
              <ActionButton
                icon={<RefreshCcw size={17} />}
                label={loading ? "Actualizando" : "Actualizar"}
                onClick={loadData}
                primary
              />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Kpi
            title="Cotizaciones"
            value={String(kpis.totalQuotes)}
            detail="Total filtrado"
            icon={<ClipboardList />}
            tone="blue"
          />
          <Kpi
            title="Monto"
            value={money(kpis.totalAmount)}
            detail="Valor cotizado"
            icon={<FileText />}
            tone="slate"
          />
          <Kpi
            title="Aprobadas"
            value={String(kpis.approved)}
            detail="Aprobadas/convertidas"
            icon={<CheckCircle2 />}
            tone="green"
          />
          <Kpi
            title="Pendientes"
            value={String(kpis.pending)}
            detail="Borrador/enviada"
            icon={<Send />}
            tone="purple"
          />
          <Kpi
            title="Vencidas"
            value={String(kpis.expired)}
            detail="Requieren seguimiento"
            icon={<AlertTriangle />}
            tone="red"
          />
        </section>

        <section className="rounded-[30px] border border-slate-800 bg-[#07111f] p-4 shadow-xl">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-slate-400">
            Tipo de cotización
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ModeButton
              active={mode === "articulos"}
              icon={<Package />}
              title="Venta de artículos"
              subtitle="Herrajes, tableros, cantos, accesorios y productos de inventario."
              onClick={() => {
                setMode("articulos");
                setCutPieces([]);
              }}
            />
            <ModeButton
              active={mode === "servicio"}
              icon={<Scissors />}
              title="Servicio Corte / Canteo / CNC"
              subtitle="Despiece técnico para carpinteros y clientes externos."
              onClick={() => {
                setMode("servicio");
                setCart([]);
              }}
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(620px,0.95fr)_minmax(520px,1.05fr)_380px]">
          <div className="space-y-6">
            <PanelDark
              title="Datos de la cotización"
              subtitle="Cliente, validez y condiciones comerciales"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel>Seleccionar cliente</FieldLabel>
                  <select
                    value={clientId}
                    onChange={(e) => selectClient(e.target.value)}
                    className="input-dark"
                  >
                    <option value="">Cliente manual / nuevo</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.full_name} - {client.phone || "Sin teléfono"}
                      </option>
                    ))}
                  </select>
                </div>

                <InputDark
                  label="Cliente"
                  value={clientName}
                  setValue={setClientName}
                  placeholder="Nombre del cliente"
                />
                <InputDark
                  label="Teléfono"
                  value={clientPhone}
                  setValue={setClientPhone}
                  placeholder="809..."
                />
                <InputDark
                  label="Email"
                  value={clientEmail}
                  setValue={setClientEmail}
                  placeholder="correo@email.com"
                />
                <InputDark
                  label="RNC/Cédula"
                  value={clientDocument}
                  setValue={setClientDocument}
                  placeholder="Documento"
                />
                <InputDark
                  label="Dirección"
                  value={clientAddress}
                  setValue={setClientAddress}
                  placeholder="Dirección"
                />
                <InputDark
                  label="Vendedor"
                  value={sellerName}
                  setValue={setSellerName}
                  placeholder="Vendedor"
                />
                <InputDark
                  label="Válida hasta"
                  value={validUntil}
                  setValue={setValidUntil}
                  type="date"
                  placeholder=""
                />

                <div className="md:col-span-2">
                  <FieldLabel>Notas internas</FieldLabel>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="textarea-dark h-16"
                    placeholder="Notas de seguimiento..."
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Condiciones comerciales</FieldLabel>
                  <textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    className="textarea-dark h-16"
                  />
                </div>
              </div>
            </PanelDark>

            {mode === "articulos" ? (
              <PanelDark
                title="Inventario disponible"
                subtitle="Agrega productos a la cotización"
              >
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-700 bg-[#020617] px-4 py-3">
                  <Search size={18} className="text-slate-400" />
                  <input
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full bg-transparent text-sm font-semibold outline-none"
                  />
                </div>

                <div className="max-h-[440px] overflow-auto rounded-2xl border border-slate-800 bg-[#020617]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-[#020617] text-slate-400">
                      <tr>
                        <ThDark>Producto</ThDark>
                        <ThDark>Stock</ThDark>
                        <ThDark>Precio</ThDark>
                        <ThDark>Costo</ThDark>
                        <ThDark>Agregar</ThDark>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr
                          key={product.id}
                          className="border-t border-slate-800 hover:bg-cyan-500/5"
                        >
                          <TdDark strong>
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-white">
                                {getProductName(product)}
                              </span>
                              <span className="truncate text-[11px] font-bold text-slate-500">
                                {product.category || "Sin categoría"}
                              </span>
                            </div>
                          </TdDark>
                          <TdDark>
                            <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-black text-emerald-300">
                              {getProductStock(product)}
                            </span>
                          </TdDark>
                          <TdDark strong>
                            {money(getProductPrice(product))}
                          </TdDark>
                          <TdDark>{money(getProductCost(product))}</TdDark>
                          <TdDark>
                            <button
                              type="button"
                              onClick={() => addProduct(product)}
                              className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 text-[11px] font-black text-slate-950 transition hover:bg-cyan-300"
                            >
                              <Plus size={14} />
                              Agregar
                            </button>
                          </TdDark>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PanelDark>
            ) : (
              <ServiceConfiguration
                materialOwner={materialOwner}
                setMaterialOwner={setMaterialOwner}
                boardType={boardType}
                setBoardType={setBoardType}
                boardSize={boardSize}
                setBoardSize={setBoardSize}
                boardWidthMm={boardWidthMm}
                setBoardWidthMm={setBoardWidthMm}
                boardHeightMm={boardHeightMm}
                setBoardHeightMm={setBoardHeightMm}
                thicknessMm={thicknessMm}
                setThicknessMm={setThicknessMm}
                boardColor={boardColor}
                setBoardColor={setBoardColor}
                grainDirection={grainDirection}
                setGrainDirection={setGrainDirection}
                cutPrice={cutPrice}
                setCutPrice={setCutPrice}
                edgePrice={edgePrice}
                setEdgePrice={setEdgePrice}
                cncPrice={cncPrice}
                setCncPrice={setCncPrice}
                serviceDescription={serviceDescription}
                setServiceDescription={setServiceDescription}
              />
            )}
          </div>

          <div className="space-y-6">
            {mode === "servicio" && (
              <PanelDark
                title="Formulario de despiece"
                subtitle="Agrega cada pieza con sus cantos y procesos"
              >
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                  <div className="lg:col-span-4">
                    <InputDark
                      label="Nombre pieza"
                      value={pieceName}
                      setValue={setPieceName}
                      placeholder="Ej: Lateral derecho"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <InputDark
                      label="Largo mm"
                      value={pieceLength}
                      setValue={setPieceLength}
                      type="number"
                      placeholder="500"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <InputDark
                      label="Ancho mm"
                      value={pieceWidth}
                      setValue={setPieceWidth}
                      type="number"
                      placeholder="450"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <InputDark
                      label="Cantidad"
                      value={pieceQty}
                      setValue={setPieceQty}
                      type="number"
                      placeholder="1"
                    />
                  </div>
                  <div className="lg:col-span-2 flex items-end">
                    <button
                      onClick={addCutPiece}
                      className="h-[46px] w-full rounded-2xl bg-cyan-400 text-sm font-black text-slate-950 hover:bg-cyan-300"
                    >
                      + Agregar
                    </button>
                  </div>

                  <div className="lg:col-span-12 grid grid-cols-2 gap-2 md:grid-cols-5">
                    <CheckBox
                      label="Canto frente"
                      checked={edgeFront}
                      setChecked={setEdgeFront}
                    />
                    <CheckBox
                      label="Canto atrás"
                      checked={edgeBack}
                      setChecked={setEdgeBack}
                    />
                    <CheckBox
                      label="Canto izq."
                      checked={edgeLeft}
                      setChecked={setEdgeLeft}
                    />
                    <CheckBox
                      label="Canto der."
                      checked={edgeRight}
                      setChecked={setEdgeRight}
                    />
                    <CheckBox
                      label="CNC / perforar"
                      checked={pieceCnc}
                      setChecked={setPieceCnc}
                    />
                  </div>

                  <div className="lg:col-span-12">
                    <FieldLabel>Observaciones de la pieza</FieldLabel>
                    <input
                      value={pieceObs}
                      onChange={(e) => setPieceObs(e.target.value)}
                      className="input-dark"
                      placeholder="Veta, perforación, ranura, canto especial..."
                    />
                  </div>
                </div>
              </PanelDark>
            )}

            <PanelDark
              title={
                mode === "servicio"
                  ? "Despiece técnico"
                  : "Detalle de cotización"
              }
              subtitle={
                mode === "servicio"
                  ? "Piezas, cantos, CNC y resumen automático"
                  : "Productos seleccionados, costo y utilidad"
              }
            >
              {mode === "servicio" ? (
                <div className="overflow-auto rounded-2xl border border-slate-800">
                  <table className="w-full min-w-[1150px] text-sm">
                    <thead className="bg-[#020617] text-slate-400">
                      <tr>
                        <ThDark>Pieza</ThDark>
                        <ThDark>Largo</ThDark>
                        <ThDark>Ancho</ThDark>
                        <ThDark>Cant.</ThDark>
                        <ThDark>Cantos</ThDark>
                        <ThDark>CNC</ThDark>
                        <ThDark>Corte ft</ThDark>
                        <ThDark>Canto ml</ThDark>
                        <ThDark>Obs.</ThDark>
                        <ThDark>&nbsp;</ThDark>
                      </tr>
                    </thead>
                    <tbody>
                      {cutPieces.map((piece) => (
                        <tr
                          key={piece.local_id}
                          className="border-t border-slate-800 hover:bg-cyan-500/5"
                        >
                          <TdDark strong>{piece.piece_name}</TdDark>
                          <TdDark>
                            <EditableNumber
                              value={piece.length_mm}
                              onChange={(v) =>
                                updatePiece(piece.local_id, { length_mm: v })
                              }
                            />
                          </TdDark>
                          <TdDark>
                            <EditableNumber
                              value={piece.width_mm}
                              onChange={(v) =>
                                updatePiece(piece.local_id, { width_mm: v })
                              }
                            />
                          </TdDark>
                          <TdDark>
                            <EditableNumber
                              value={piece.quantity}
                              onChange={(v) =>
                                updatePiece(piece.local_id, {
                                  quantity: Math.max(1, v),
                                })
                              }
                            />
                          </TdDark>
                          <TdDark>
                            <div className="flex flex-wrap gap-1">
                              <MiniEdge
                                label="F"
                                active={piece.edge_front}
                                onClick={() =>
                                  updatePiece(piece.local_id, {
                                    edge_front: !piece.edge_front,
                                  })
                                }
                              />
                              <MiniEdge
                                label="A"
                                active={piece.edge_back}
                                onClick={() =>
                                  updatePiece(piece.local_id, {
                                    edge_back: !piece.edge_back,
                                  })
                                }
                              />
                              <MiniEdge
                                label="I"
                                active={piece.edge_left}
                                onClick={() =>
                                  updatePiece(piece.local_id, {
                                    edge_left: !piece.edge_left,
                                  })
                                }
                              />
                              <MiniEdge
                                label="D"
                                active={piece.edge_right}
                                onClick={() =>
                                  updatePiece(piece.local_id, {
                                    edge_right: !piece.edge_right,
                                  })
                                }
                              />
                            </div>
                          </TdDark>
                          <TdDark>
                            <button
                              onClick={() =>
                                updatePiece(piece.local_id, { cnc: !piece.cnc })
                              }
                              className={
                                piece.cnc ? "badge-green" : "badge-slate"
                              }
                            >
                              {piece.cnc ? "Sí" : "No"}
                            </button>
                          </TdDark>
                          <TdDark>{cutFeetForPiece(piece).toFixed(2)}</TdDark>
                          <TdDark>
                            {edgeMetersForPiece(piece).toFixed(2)}
                          </TdDark>
                          <TdDark>{piece.observations || "—"}</TdDark>
                          <TdDark>
                            <div className="flex gap-2">
                              <button
                                onClick={() => duplicatePiece(piece)}
                                className="rounded-lg bg-slate-700 p-2 text-white hover:bg-slate-600"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => removePiece(piece.local_id)}
                                className="rounded-lg bg-red-500 p-2 text-white hover:bg-red-400"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </TdDark>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {cutPieces.length === 0 && (
                    <EmptyState text="Agrega piezas para calcular corte, canteo y CNC." />
                  )}
                </div>
              ) : (
                <div className="overflow-auto rounded-2xl border border-slate-800">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-[#020617] text-slate-400">
                      <tr>
                        <ThDark>Producto</ThDark>
                        <ThDark>Cant.</ThDark>
                        <ThDark>Precio</ThDark>
                        <ThDark>Costo</ThDark>
                        <ThDark>Subtotal</ThDark>
                        <ThDark>Ganancia</ThDark>
                        <ThDark>&nbsp;</ThDark>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item, index) => (
                        <tr
                          key={item.product_id || `${item.product_name}-${index}`}
                          className="border-t border-slate-800 hover:bg-cyan-500/5"
                        >
                          <TdDark strong>{item.product_name}</TdDark>
                          <TdDark>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                changeQty(
                                  item.product_id,
                                  toNumber(e.target.value),
                                )
                              }
                              className="mini-input"
                            />
                          </TdDark>
                          <TdDark>
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) =>
                                changePrice(item.product_id, e.target.value)
                              }
                              className="mini-input"
                            />
                          </TdDark>
                          <TdDark>{money(item.cost_price)}</TdDark>
                          <TdDark strong>{money(item.subtotal)}</TdDark>
                          <TdDark green>{money(item.profit)}</TdDark>
                          <TdDark>
                            <button
                              onClick={() => removeItem(item.product_id)}
                              className="rounded-xl bg-red-500 p-2 text-white hover:bg-red-400"
                            >
                              <Trash2 size={16} />
                            </button>
                          </TdDark>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {cart.length === 0 && (
                    <EmptyState text="Agrega productos para iniciar la cotización." />
                  )}
                </div>
              )}
            </PanelDark>

            {mode === "servicio" && (
              <BoardOptimizerPreview
                result={nestingResult}
                boardWidth={toNumber(boardWidthMm)}
                boardHeight={toNumber(boardHeightMm)}
                grainDirection={grainDirection}
              />
            )}
          </div>

          <aside className="space-y-6">
            <PanelDark
              title="Resumen automático"
              subtitle="Cálculo vivo de la cotización"
            >
              {mode === "servicio" && (
                <div className="mb-5 grid grid-cols-2 gap-3">
                  <MiniStat
                    label="Piezas"
                    value={String(serviceStats.piecesTotal)}
                  />
                  <MiniStat
                    label="Tableros est."
                    value={String(serviceStats.estimatedBoards)}
                  />
                  <MiniStat
                    label="Pies corte"
                    value={serviceStats.cutFeet.toFixed(2)}
                  />
                  <MiniStat
                    label="ML canto"
                    value={serviceStats.edgeMeters.toFixed(2)}
                  />
                  <MiniStat label="CNC" value={String(serviceStats.cncQty)} />
                  <MiniStat
                    label="Merma est."
                    value={percent(serviceStats.wastePercent)}
                  />
                </div>
              )}

              <div className="rounded-[28px] bg-[#020617] p-5 text-white ring-1 ring-slate-800">
                <TotalRow label="Subtotal" value={money(subtotal)} />
                <TotalRow label="ITBIS 18%" value={money(tax)} />
                <TotalRow label="Costo" value={money(costTotal)} />
                <TotalRow label="Ganancia" value={money(profitTotal)} green />
                <TotalRow label="Margen" value={percent(margin)} />
                <div className="mt-4 border-t border-slate-700 pt-4">
                  <TotalRow label="Total" value={money(total)} big />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3">
                <button
                  onClick={() => saveQuote("borrador")}
                  disabled={saving}
                  className="btn-cyan"
                >
                  <Save size={17} /> Guardar cotización
                </button>
                <button
                  onClick={() => saveQuote("enviada")}
                  disabled={saving}
                  className="btn-blue"
                >
                  <Send size={17} /> Guardar y enviar
                </button>
                <button onClick={() => generatePDF()} className="btn-purple">
                  <Printer size={17} /> PDF cliente
                </button>
                {mode === "servicio" && (
                  <button onClick={generateCutOrderPDF} className="btn-dark">
                    <Scissors size={17} /> Orden interna corte
                  </button>
                )}
                <button onClick={() => openWhatsApp()} className="btn-green">
                  <MessageCircle size={17} /> WhatsApp
                </button>
                <button onClick={clearForm} className="btn-red">
                  <X size={17} /> Limpiar
                </button>
              </div>
            </PanelDark>

            <QuoteAIControlPanel
              score={aiScore}
              insights={aiInsights}
              mode={mode}
              margin={margin}
              total={total}
              profitTotal={profitTotal}
              serviceBoards={nestingResult.boards.length}
              serviceWaste={nestingResult.wastePercent}
            />
          </aside>
        </section>

        <section className="mt-6">
          <PanelDark
            title="Historial de cotizaciones"
            subtitle="Artículos y servicios comerciales"
          >
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-[#020617] px-4 py-3 md:col-span-2">
                <Search size={18} className="text-slate-400" />
                <input
                  value={searchQuote}
                  onChange={(e) => setSearchQuote(e.target.value)}
                  placeholder="Buscar cotización, cliente, teléfono..."
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="input-dark"
              >
                <option value="todos">Todos los tipos</option>
                <option value="articulos">Artículos</option>
                <option value="servicio">Servicios</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-dark"
              >
                <option value="todos">Todos</option>
                <option value="borrador">Borrador</option>
                <option value="enviada">Enviada</option>
                <option value="aprobada">Aprobada</option>
                <option value="rechazada">Rechazada</option>
                <option value="convertida">Convertida</option>
              </select>
            </div>

            <div className="overflow-auto rounded-2xl border border-slate-800">
              <table className="w-full min-w-[1300px] text-sm">
                <thead className="bg-[#020617] text-slate-400">
                  <tr>
                    <ThDark>Fecha</ThDark>
                    <ThDark>Tipo</ThDark>
                    <ThDark>Cotización</ThDark>
                    <ThDark>Cliente</ThDark>
                    <ThDark>Válida</ThDark>
                    <ThDark>Estado</ThDark>
                    <ThDark>Total</ThDark>
                    <ThDark>Ganancia</ThDark>
                    <ThDark>Margen</ThDark>
                    <ThDark>Acciones</ThDark>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((quote) => (
                    <tr
                      key={quote.id}
                      className={`border-t border-slate-800 hover:bg-cyan-500/5 ${isExpired(quote) ? "bg-red-500/10" : ""}`}
                    >
                      <TdDark>{formatDate(quote.created_at)}</TdDark>
                      <TdDark>
                        <TypeBadge value={getQuoteModeFromQuote(quote)} />
                      </TdDark>
                      <TdDark strong>{quote.quote_number}</TdDark>
                      <TdDark>
                        <strong>{quote.client_name}</strong>
                        <p className="text-xs text-slate-500">
                          {quote.client_phone || "Sin teléfono"}
                        </p>
                      </TdDark>
                      <TdDark>{formatDate(quote.valid_until)}</TdDark>
                      <TdDark>
                        <StatusBadge
                          value={
                            isExpired(quote)
                              ? "vencida"
                              : quote.status || "borrador"
                          }
                        />
                      </TdDark>
                      <TdDark strong>{money(toNumber(quote.total))}</TdDark>
                      <TdDark green>
                        {money(toNumber(quote.profit_total))}
                      </TdDark>
                      <TdDark>{percent(toNumber(quote.margin))}</TdDark>
                      <TdDark>
                        <div className="flex gap-2">
                          <button
                            onClick={() => editQuote(quote)}
                            className="icon-btn bg-blue-600"
                            title="Editar"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => generatePDF(quote)}
                            className="icon-btn bg-purple-600"
                            title="PDF"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            onClick={() => openWhatsApp(quote)}
                            className="icon-btn bg-emerald-600"
                            title="WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </button>
                          <button
                            onClick={() => convertToSale(quote)}
                            className="icon-btn bg-slate-700"
                            title="Convertir a venta"
                          >
                            <ShoppingCart size={14} />
                          </button>
                          <button
                            onClick={() => deleteQuote(quote)}
                            className="icon-btn bg-red-600"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </TdDark>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredQuotes.length === 0 && (
                <EmptyState text="No hay cotizaciones con estos filtros." />
              )}
            </div>
          </PanelDark>
        </section>
      </div>

      <QuoteGlobalStyles />
    </div>
  );
}
