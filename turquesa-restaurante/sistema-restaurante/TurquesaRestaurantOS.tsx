"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  AlertTriangle,
  Activity,
  Banknote,
  Bell,
  Bot,
  Brain,
  CalendarClock,
  ChefHat,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Cpu,
  CreditCard,
  Database,
  FileDown,
  Gauge,
  History,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Printer,
  Radar,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Table2,
  UserRound,
  UsersRound,
  WalletCards,
  Wifi,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/saas/auth-client";
import {
  freshDemoSnapshot,
  type TurquesaInventoryItem,
  type TurquesaInventoryTrend,
  type TurquesaKitchenTicket,
  type TurquesaMenuItem,
  type TurquesaOrderItem,
  type TurquesaPurchaseRequest,
  type TurquesaPurchaseRequestItem,
  type TurquesaRecipeIngredient,
  type TurquesaReservation,
  type TurquesaSnapshot,
  type TurquesaTable,
  type TurquesaTableStatus,
  type TurquesaWifiLead,
} from "@/lib/turquesa/restaurant-data";
import {
  buildTurquesaPrintJobs,
  turquesaPrintDocumentHtml,
  TURQUESA_PRINTER_STATIONS,
  type TurquesaPrintJob,
  type TurquesaPrintLogEntry,
  type TurquesaPrinterStationKey,
} from "./restaurant-printing";
import styles from "./TurquesaRestaurantOS.module.css";

type ViewKey =
  | "operacion"
  | "pos"
  | "cocina"
  | "impresoras"
  | "reservas"
  | "inventario"
  | "compras"
  | "contabilidad"
  | "ai"
  | "reportes"
  | "configuracion"
  | "usuarios"
  | "auditoria"
  | "cierre";
type PaymentMethod = "cash" | "card" | "transfer";
type WifiLeadStatus = "nuevo" | "promocion" | "cliente" | "no_contactar";
type ReservationFormState = {
  time: string;
  name: string;
  guests: string;
  note: string;
};
type ClosureFormState = {
  countedCash: string;
  notes: string;
};

type OperationPayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  warning?: string;
  snapshot?: TurquesaSnapshot;
};

type TurquesaAIRecommendation = {
  area: string;
  priority: "ok" | "watch" | "urgent";
  title: string;
  text: string;
  action: string;
};

type TurquesaAIDiagnostic = {
  area: "cocina" | "caja" | "inventario" | "reservas" | "wifi" | "impresoras";
  status: "ok" | "watch" | "urgent";
  score: number;
  metric: string;
  finding: string;
  action: string;
};

type TurquesaAIDecision = {
  id: string;
  area: string;
  title: string;
  summary: string;
  risk: "low" | "medium" | "high" | "critical";
  status: "draft" | "pending" | "approved";
  actionLabel: string;
};

type TurquesaAIEvent = {
  id: string;
  area: string;
  title: string;
  summary: string;
  severity: "info" | "success" | "warning" | "danger" | "critical";
  riskScore: number;
  createdAt: string;
};

type TurquesaAIResult = {
  ok: boolean;
  provider: "openai_responses" | "local_rules";
  model?: string;
  summary: string;
  riskLevel: "normal" | "atencion" | "critico";
  riskScore: number;
  recommendations: TurquesaAIRecommendation[];
  diagnostics: TurquesaAIDiagnostic[];
  decisions: TurquesaAIDecision[];
  events: TurquesaAIEvent[];
  guardrails: string[];
  watchlist: string[];
  nextActions: string[];
  assistantReply?: string;
  error?: string;
};

type TurquesaAIPayload = {
  ok?: boolean;
  error?: string;
  ai?: TurquesaAIResult;
};

type TurquesaAIChatMessage = {
  role: "assistant" | "user";
  content: string;
  at: string;
};

const views: Array<{ key: ViewKey; label: string; icon: React.ReactNode }> = [
  { key: "operacion", label: "Operacion", icon: <LayoutDashboard size={18} /> },
  { key: "pos", label: "POS", icon: <ReceiptText size={18} /> },
  { key: "cocina", label: "Cocina", icon: <ChefHat size={18} /> },
  { key: "impresoras", label: "Impresoras", icon: <Printer size={18} /> },
  { key: "reservas", label: "Reservas", icon: <CalendarClock size={18} /> },
  { key: "inventario", label: "Inventario", icon: <Package size={18} /> },
  { key: "compras", label: "Compras", icon: <ShoppingBag size={18} /> },
  { key: "contabilidad", label: "Contabilidad", icon: <WalletCards size={18} /> },
  { key: "ai", label: "AI", icon: <Bot size={18} /> },
  { key: "reportes", label: "Reportes", icon: <FileDown size={18} /> },
  { key: "configuracion", label: "Configuracion", icon: <Settings size={18} /> },
  { key: "usuarios", label: "Usuarios", icon: <UsersRound size={18} /> },
  { key: "auditoria", label: "Auditoria", icon: <History size={18} /> },
  { key: "cierre", label: "Cierre", icon: <Banknote size={18} /> },
];

const paymentMethods: Array<{ key: PaymentMethod; label: string }> = [
  { key: "card", label: "Tarjeta" },
  { key: "cash", label: "Efectivo" },
  { key: "transfer", label: "Transferencia" },
];

const currency = (value: number) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(value);

function formatShortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
}

function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-DO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function tableTone(status: TurquesaTableStatus) {
  if (status === "free") return styles.free;
  if (status === "reserved") return styles.reserved;
  if (status === "attention") return styles.attention;
  return styles.open;
}

function statusLabel(status: TurquesaTableStatus) {
  if (status === "free") return "Libre";
  if (status === "reserved") return "Reservada";
  if (status === "attention") return "Atencion";
  return "Abierta";
}

function purchaseStatusLabel(status: TurquesaPurchaseRequest["status"]) {
  if (status === "received") return "Recibida";
  if (status === "approved") return "Aprobada";
  if (status === "requested") return "Solicitada";
  if (status === "cancelled") return "Cancelada";
  return "Borrador";
}

function ticketLabel(status: TurquesaKitchenTicket["status"]) {
  if (status === "new") return "Nueva";
  if (status === "ready") return "Lista";
  return "En cocina";
}

function buildStarterOrder(menuItems: TurquesaMenuItem[]) {
  return [menuItems[1], menuItems[5]].filter(Boolean).map((item) => ({ ...item, qty: item.id === menuItems[5]?.id ? 2 : 1 }));
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "operacion local sin base conectada";
}

function paymentLabel(method: PaymentMethod) {
  return paymentMethods.find((item) => item.key === method)?.label || "Tarjeta";
}

function aiRiskLabel(risk?: TurquesaAIResult["riskLevel"]) {
  if (risk === "critico") return "Critico";
  if (risk === "atencion") return "Atencion";
  return "Normal";
}

function aiProviderLabel(ai?: TurquesaAIResult | null) {
  if (!ai) return "Listo";
  if (ai.provider === "openai_responses") return ai.model ? `OpenAI ${ai.model}` : "OpenAI";
  return "Reglas locales";
}

function menuThumbTone(item: TurquesaMenuItem) {
  const text = `${item.name} ${item.category} ${item.station}`.toLowerCase();
  if (text.includes("langosta")) return "lobster";
  if (text.includes("ceviche")) return "ceviche";
  if (text.includes("tostones") || text.includes("entrada") || text.includes("fritura")) return "fritter";
  if (text.includes("mojito")) return "mojito";
  if (text.includes("coctel") || text.includes("atardecer") || text.includes("bar")) return "cocktail";
  if (text.includes("flan")) return "dessert";
  if (text.includes("arroz") || text.includes("pescado")) return "seafood";
  return "plate";
}

function inventoryTrend(onHand: number, min: number): TurquesaInventoryTrend {
  if (onHand < min) return "critico";
  if (min > 0 && onHand <= min * 1.25) return "bajo";
  return "ok";
}

function shiftPaidTotal(shift: TurquesaSnapshot["shift"]) {
  const detailTotal = (shift.cashSales || 0) + (shift.cardSales || 0) + (shift.transferSales || 0);
  return Math.round(detailTotal || shift.cashOpen || 0);
}

function expectedShiftCash(shift: TurquesaSnapshot["shift"]) {
  return Math.round(shift.expectedCashDrawer || (shift.openingCash || 0) + (shift.cashSales || 0));
}

function formNumber(value: string) {
  const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Array<string | number>>) {
  return `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
}

function inventoryValue(inventory: TurquesaInventoryItem[]) {
  return inventory.reduce((sum, item) => sum + item.onHand * item.avgCost, 0);
}

function formatQty(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function recipeStep(unit: string) {
  return unit === "bot" ? 0.01 : 0.05;
}

function applyDemoInventoryConsumption(
  inventory: TurquesaInventoryItem[],
  orderItems: TurquesaOrderItem[],
  recipeIngredients: TurquesaRecipeIngredient[]
) {
  const needed = new Map<string, number>();
  orderItems.forEach((orderItem) => {
    const recipe = recipeIngredients.filter((ingredient) => ingredient.menuItem === orderItem.name);
    recipe.forEach((ingredient) => {
      needed.set(
        ingredient.ingredient,
        Math.round(((needed.get(ingredient.ingredient) || 0) + ingredient.qty * orderItem.qty) * 1000) / 1000
      );
    });
  });

  const lines: Array<{ item: string; qty: number; unit: string; shortage: number }> = [];
  const nextInventory = inventory.map((item) => {
    const qty = needed.get(item.item) || 0;
    if (!qty) return item;

    const onHand = Math.max(0, Math.round((item.onHand - qty) * 1000) / 1000);
    lines.push({
      item: item.item,
      qty,
      unit: item.unit,
      shortage: Math.max(0, Math.round((qty - item.onHand) * 1000) / 1000),
    });

    return {
      ...item,
      onHand,
      trend: inventoryTrend(onHand, item.min),
    };
  });

  return { inventory: nextInventory, lines };
}

function consumptionSummary(lines: Array<{ item: string; qty: number; unit: string; shortage: number }>) {
  if (!lines.length) return "Sin receta enlazada todavia.";
  const visible = lines
    .slice(0, 3)
    .map((line) => `${line.item} -${formatQty(line.qty)} ${line.unit}`)
    .join(", ");
  const extra = lines.length > 3 ? ` y ${lines.length - 3} mas` : "";
  const shortage = lines.some((line) => line.shortage > 0) ? " Hay consumo sobre stock disponible." : "";
  return `Inventario descontado: ${visible}${extra}.${shortage}`;
}

function suggestedPurchaseItems(inventory: TurquesaInventoryItem[]): TurquesaPurchaseRequestItem[] {
  return inventory
    .filter((item) => item.trend === "critico" || item.trend === "bajo")
    .map((item) => {
      const target = Math.max(item.min * 2, item.onHand + 1);
      const qty = Math.max(1, Math.ceil(target - item.onHand));
      const unitCost = item.avgCost || 250;

      return {
        item: item.item,
        qty,
        unit: item.unit,
        supplier: item.supplier || "Proveedor por definir",
        estimatedCost: Math.round(qty * unitCost),
      };
    });
}

function purchaseTotal(items: TurquesaPurchaseRequestItem[]) {
  return items.reduce((sum, item) => sum + item.estimatedCost, 0);
}

export default function TurquesaRestaurantOS() {
  const [activeView, setActiveView] = useState<ViewKey>("operacion");
  const [snapshot, setSnapshot] = useState<TurquesaSnapshot>(() => freshDemoSnapshot());
  const [selectedTableId, setSelectedTableId] = useState("t3");
  const [search, setSearch] = useState("");
  const [selectedRecipeMenu, setSelectedRecipeMenu] = useState("Ceviche Turquesa");
  const [order, setOrder] = useState<TurquesaOrderItem[]>(() => buildStarterOrder(freshDemoSnapshot().menuItems));
  const [message, setMessage] = useState("Turno abierto. Cocina y caja sincronizadas.");
  const [syncing, setSyncing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<TurquesaAIResult | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMessages, setAiMessages] = useState<TurquesaAIChatMessage[]>(() => [
    {
      role: "assistant",
      content: "Turquesa AI listo. Puedo analizar cocina, caja, inventario, reservas, Wi-Fi, impresoras y preparar decisiones supervisadas.",
      at: new Date().toISOString(),
    },
  ]);
  const [printLog, setPrintLog] = useState<TurquesaPrintLogEntry[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [reservationForm, setReservationForm] = useState<ReservationFormState>({
    time: "20:00",
    name: "",
    guests: "2",
    note: "",
  });
  const [closureForm, setClosureForm] = useState<ClosureFormState>({
    countedCash: String(expectedShiftCash(freshDemoSnapshot().shift)),
    notes: "",
  });

  const tables = snapshot.tables;
  const menuItems = snapshot.menuItems;
  const tickets = snapshot.kitchenTickets;
  const reservations = snapshot.reservations;
  const inventory = snapshot.inventory;
  const recipeIngredients = snapshot.recipeIngredients;
  const purchaseRequests = snapshot.purchaseRequests;
  const wifiLeads = snapshot.wifiLeads;

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) || tables[0],
    [selectedTableId, tables]
  );
  const orderSubtotal = order.reduce((sum, item) => sum + item.price * item.qty, 0);
  const serviceFee = orderSubtotal * 0.1;
  const tax = orderSubtotal * 0.18;
  const orderTotal = orderSubtotal + serviceFee + tax;
  const payableTotal = selectedTable ? Math.round(selectedTable.total + orderTotal) : Math.round(orderTotal);
  const openTables = tables.filter((table) => table.status === "open" || table.status === "attention").length;
  const kitchenReady = tickets.filter((ticket) => ticket.status === "ready").length;
  const expectedCash = expectedShiftCash(snapshot.shift);
  const countedCash = formNumber(closureForm.countedCash || String(expectedCash));
  const closeDifference = Math.round((countedCash - expectedCash) * 100) / 100;
  const suggestedPurchase = useMemo(() => suggestedPurchaseItems(inventory), [inventory]);
  const printJobs = useMemo(
    () => buildTurquesaPrintJobs(tickets, menuItems, snapshot.generatedAt),
    [tickets, menuItems, snapshot.generatedAt]
  );
  const pendingPrintJobs = useMemo(
    () => printJobs.filter((job) => !printLog.some((entry) => entry.jobId === job.id)),
    [printJobs, printLog]
  );
  const filteredMenu = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return menuItems;
    return menuItems.filter((item) => `${item.name} ${item.category} ${item.station}`.toLowerCase().includes(needle));
  }, [menuItems, search]);

  const applySnapshot = useCallback((nextSnapshot: TurquesaSnapshot) => {
    setSnapshot(nextSnapshot);
    setMessage(nextSnapshot.message || "Operacion Turquesa sincronizada.");
    setSelectedTableId((current) => {
      if (nextSnapshot.tables.some((table) => table.id === current)) return current;
      return nextSnapshot.tables[0]?.id || current;
    });
    setOrder((current) => (current.length ? current : buildStarterOrder(nextSnapshot.menuItems)));
  }, []);

  const loadSnapshot = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await apiFetch("/api/turquesa-restaurante/operacion", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as OperationPayload;
      if (!response.ok || !payload.ok || !payload.snapshot) {
        throw new Error(payload.error || payload.warning || "No se pudo cargar Turquesa Restaurante.");
      }
      applySnapshot(payload.snapshot);
    } catch (error) {
      applySnapshot(freshDemoSnapshot(`Modo demo: ${errorMessage(error)}`));
    } finally {
      setSyncing(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    setClosureForm((current) => {
      if (current.countedCash) return current;
      return { ...current, countedCash: String(expectedShiftCash(snapshot.shift)) };
    });
  }, [snapshot.shift.id, snapshot.shift.expectedCashDrawer]);

  useEffect(() => {
    if (recipeIngredients.some((item) => item.menuItem === selectedRecipeMenu)) return;
    setSelectedRecipeMenu(recipeIngredients[0]?.menuItem || menuItems[0]?.name || "");
  }, [menuItems, recipeIngredients, selectedRecipeMenu]);

  async function postOperation(body: Record<string, unknown>) {
    const response = await apiFetch("/api/turquesa-restaurante/operacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as OperationPayload;
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Operacion Turquesa no disponible.");
    if (payload.snapshot) applySnapshot(payload.snapshot);
    return payload;
  }

  async function runTurquesaAI(question = "Analiza el turno actual y prioriza acciones.", mode: "analysis" | "chat" = "analysis") {
    const cleanQuestion = question.trim() || "Analiza el turno actual y prioriza acciones.";
    setActiveView("ai");
    setAiLoading(true);
    if (mode === "chat") {
      setAiMessages((current) => [
        ...current,
        { role: "user", content: cleanQuestion, at: new Date().toISOString() },
      ]);
    }
    try {
      const response = await apiFetch("/api/turquesa-restaurante/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot, question: cleanQuestion }),
      });
      const payload = (await response.json().catch(() => ({}))) as TurquesaAIPayload;
      if (!response.ok || !payload.ok || !payload.ai) throw new Error(payload.error || "Turquesa AI no disponible.");
      setAiResult(payload.ai);
      if (mode === "chat") {
        setAiMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: payload.ai?.assistantReply || payload.ai?.summary || "Analisis generado.",
            at: new Date().toISOString(),
          },
        ]);
      }
      setMessage(
        payload.ai.provider === "openai_responses"
          ? "Turquesa AI genero analisis con OpenAI."
          : "Turquesa AI uso reglas locales para el analisis."
      );
    } catch (error) {
      setMessage(`Turquesa AI no pudo analizar ahora: ${errorMessage(error)}.`);
    } finally {
      setAiLoading(false);
    }
  }

  function askTurquesaAI(question: string) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || aiLoading) return;
    setAiPrompt("");
    void runTurquesaAI(cleanQuestion, "chat");
  }

  function markPrinted(jobs: TurquesaPrintJob[], mode: TurquesaPrintLogEntry["mode"]) {
    const printedAt = new Date().toISOString();
    setPrintLog((current) => {
      const retained = current.filter((entry) => !jobs.some((job) => job.id === entry.jobId));
      return [
        ...jobs.map((job) => ({
          jobId: job.id,
          ticketId: job.ticketId,
          stationKey: job.stationKey,
          printedAt,
          copies: job.copies,
          mode,
        })),
        ...retained,
      ].slice(0, 80);
    });
  }

  function openPrintWindow(jobs: TurquesaPrintJob[], mode: TurquesaPrintLogEntry["mode"]) {
    if (!jobs.length) {
      setActiveView("impresoras");
      setMessage("No hay tickets pendientes para imprimir.");
      return;
    }

    const win = window.open("", "_blank", "width=420,height=720");
    if (!win) {
      setActiveView("impresoras");
      setMessage("El navegador bloqueo la ventana de impresion. Permite popups para imprimir tickets.");
      return;
    }

    win.document.open();
    win.document.write(turquesaPrintDocumentHtml(jobs, snapshot.restaurant.name));
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 350);

    markPrinted(jobs, mode);
    setActiveView("impresoras");
    setMessage(`${jobs.length} ticket(s) enviados a impresion para ${jobs.map((job) => job.stationName).join(", ")}.`);
  }

  function printJob(job: TurquesaPrintJob) {
    const alreadyPrinted = printLog.some((entry) => entry.jobId === job.id);
    openPrintWindow([job], alreadyPrinted ? "reprint" : "print");
  }

  function printTicket(ticketId: string) {
    const jobs = printJobs.filter((job) => job.ticketId === ticketId);
    openPrintWindow(jobs, jobs.some((job) => printLog.some((entry) => entry.jobId === job.id)) ? "reprint" : "bundle");
  }

  function printPending(stationKey?: TurquesaPrinterStationKey) {
    const jobs = stationKey ? pendingPrintJobs.filter((job) => job.stationKey === stationKey) : pendingPrintJobs;
    openPrintWindow(jobs, "bundle");
  }

  function exportTurnReport() {
    const paidTotal = shiftPaidTotal(snapshot.shift);
    const openTablesNow = tables.filter((table) => table.status === "open" || table.status === "attention");
    const openBalance = openTablesNow.reduce((sum, table) => sum + table.total, 0);
    const criticalInventory = inventory.filter((item) => item.trend === "critico");
    const lowInventory = inventory.filter((item) => item.trend === "bajo");
    const suggestedItems = suggestedPurchaseItems(inventory);
    const generatedAt = new Date();
    const rows: Array<Array<string | number>> = [
      ["Turquesa Restaurante OS", "Reporte de turno"],
      ["Generado", generatedAt.toLocaleString("es-DO")],
      ["Turno", snapshot.shift.label],
      ["Estado", snapshot.shift.status],
      [],
      ["Resumen", "Valor"],
      ["Venta cobrada", paidTotal],
      ["Saldo en mesas abiertas", openBalance],
      ["Ventas proyectadas", snapshot.shift.projectedSales],
      ["Mesas abiertas", openTablesNow.length],
      ["Tickets KDS", tickets.length],
      ["Reservas", reservations.length],
      ["Leads Wi-Fi", wifiLeads.length],
      [],
      ["Pagos", "Monto", "Participacion"],
      ["Efectivo", snapshot.shift.cashSales, percent(snapshot.shift.cashSales, paidTotal)],
      ["Tarjeta", snapshot.shift.cardSales, percent(snapshot.shift.cardSales, paidTotal)],
      ["Transferencia", snapshot.shift.transferSales, percent(snapshot.shift.transferSales, paidTotal)],
      [],
      ["Inventario", "Cantidad"],
      ["Criticos", criticalInventory.length],
      ["Bajos", lowInventory.length],
      ["Valor inventario", Math.round(inventoryValue(inventory))],
      ["Compra sugerida", purchaseTotal(suggestedItems)],
      [],
      ["Items criticos/bajos", "Disponible", "Minimo", "Costo promedio", "Proveedor"],
      ...inventory
        .filter((item) => item.trend === "critico" || item.trend === "bajo")
        .map((item) => [item.item, `${item.onHand} ${item.unit}`, `${item.min} ${item.unit}`, item.avgCost, item.supplier]),
      [],
      ["Ultimas solicitudes", "Estado", "Prioridad", "Total"],
      ...purchaseRequests.map((request) => [request.code, purchaseStatusLabel(request.status), request.priority, request.total]),
    ];

    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `turquesa-reporte-turno-${generatedAt.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setActiveView("reportes");
    setMessage("Reporte CSV generado para gerencia.");
  }

  function addItem(item: TurquesaMenuItem) {
    setOrder((current) => {
      const existing = current.find((row) => row.id === item.id);
      if (existing) return current.map((row) => (row.id === item.id ? { ...row, qty: row.qty + 1 } : row));
      return [...current, { ...item, qty: 1 }];
    });
    if (selectedTable) setMessage(`${item.name} agregado a ${selectedTable.label}.`);
  }

  function changeQty(id: string, delta: number) {
    setOrder((current) =>
      current
        .map((item) => (item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item))
        .filter((item) => item.qty > 0)
    );
  }

  function sendToKitchenLocal(reason: string) {
    if (!selectedTable) return;
    const consumption = applyDemoInventoryConsumption(inventory, order, recipeIngredients);
    const nextTicket: TurquesaKitchenTicket = {
      id: `K-${Math.floor(120 + Math.random() * 80)}`,
      table: selectedTable.label,
      items: order.map((item) => `${item.qty}x ${item.name}`),
      station: "Mixta",
      minutes: 0,
      status: "new",
    };
    const nextMessage = `Modo demo: comanda enviada localmente para ${selectedTable.label}. ${consumptionSummary(consumption.lines)} ${reason}`;
    setSnapshot((current) => ({
      ...current,
      source: "demo",
      message: nextMessage,
      generatedAt: new Date().toISOString(),
      inventory: applyDemoInventoryConsumption(current.inventory, order, current.recipeIngredients).inventory,
      tables: current.tables.map((table) =>
        table.id === selectedTable.id
          ? {
              ...table,
              status: table.status === "free" ? "open" : table.status,
              total: Math.round(table.total + orderTotal),
              minutes: table.minutes || 1,
            }
          : table
      ),
      kitchenTickets: [nextTicket, ...current.kitchenTickets],
    }));
    setOrder([]);
    setActiveView("cocina");
    setMessage(nextMessage);
  }

  async function sendToKitchen() {
    if (!selectedTable) return;
    if (!order.length) {
      setMessage("No hay items para enviar a cocina.");
      return;
    }
    setSyncing(true);
    try {
      const payload = await postOperation({
        action: "send_to_kitchen",
        tableLabel: selectedTable.label,
        serverName: selectedTable.server,
        items: order,
      });
      setOrder([]);
      setActiveView("cocina");
      setMessage(payload.message || `Comanda enviada a cocina para ${selectedTable.label}.`);
    } catch (error) {
      sendToKitchenLocal(errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  function advanceTicketLocal(id: string, reason: string) {
    setSnapshot((current) => {
      const ticket = current.kitchenTickets.find((item) => item.id === id);
      const nextStatus = ticket?.status === "new" ? "cooking" : ticket?.status === "cooking" ? "ready" : "served";
      const nextMessage =
        nextStatus === "served"
          ? `Modo demo: ticket ${id} servido localmente. ${reason}`
          : `Modo demo: ticket ${id} actualizado localmente. ${reason}`;

      return {
        ...current,
        source: "demo",
        message: nextMessage,
        generatedAt: new Date().toISOString(),
        kitchenTickets:
          nextStatus === "served"
            ? current.kitchenTickets.filter((item) => item.id !== id)
            : current.kitchenTickets.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      status: nextStatus,
                      minutes: nextStatus === "cooking" ? Math.max(1, item.minutes) : item.minutes,
                    }
                  : item
              ),
      };
    });
  }

  async function advanceTicket(id: string) {
    setSyncing(true);
    try {
      const payload = await postOperation({ action: "advance_ticket", ticketId: id });
      setMessage(payload.message || `Ticket ${id} actualizado.`);
    } catch (error) {
      advanceTicketLocal(id, errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  function chargeSelectedTableLocal(reason: string) {
    if (!selectedTable) return;
    if (payableTotal <= 0) {
      setMessage(`No hay balance para cobrar en ${selectedTable.label}.`);
      return;
    }

    const nextMessage = `Modo demo: pago ${paymentLabel(paymentMethod).toLowerCase()} registrado para ${selectedTable.label}. ${reason}`;
    setSnapshot((current) => ({
      ...current,
      source: "demo",
      message: nextMessage,
      generatedAt: new Date().toISOString(),
      shift: (() => {
        const cashSales = Math.round((current.shift.cashSales + (paymentMethod === "cash" ? payableTotal : 0)) * 100) / 100;
        const cardSales = Math.round((current.shift.cardSales + (paymentMethod === "card" ? payableTotal : 0)) * 100) / 100;
        const transferSales = Math.round((current.shift.transferSales + (paymentMethod === "transfer" ? payableTotal : 0)) * 100) / 100;
        const cashOpen = Math.round(cashSales + cardSales + transferSales);

        return {
          ...current.shift,
          cashSales,
          cardSales,
          transferSales,
          cashOpen,
          expectedCashDrawer: Math.round((current.shift.openingCash + cashSales) * 100) / 100,
          projectedSales: Math.max(current.shift.projectedSales, cashOpen),
        };
      })(),
      tables: current.tables.map((table) =>
        table.id === selectedTable.id
          ? {
              ...table,
              status: "free",
              server: "Libre",
              total: 0,
              minutes: 0,
            }
          : table
      ),
    }));
    setOrder([]);
    setActiveView("cierre");
    setMessage(nextMessage);
  }

  async function chargeSelectedTable() {
    if (!selectedTable) return;
    if (payableTotal <= 0) {
      setMessage(`No hay balance para cobrar en ${selectedTable.label}.`);
      return;
    }

    setSyncing(true);
    try {
      const payload = await postOperation({
        action: "close_order",
        tableLabel: selectedTable.label,
        method: paymentMethod,
        amount: payableTotal,
      });
      setOrder([]);
      setActiveView("cierre");
      setMessage(payload.message || `Pago registrado para ${selectedTable.label}.`);
    } catch (error) {
      chargeSelectedTableLocal(errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  function createReservationLocal(reason: string) {
    const guestName = reservationForm.name.trim();
    if (!guestName) {
      setMessage("Escribe el nombre de la reserva.");
      return;
    }

    const guests = Math.max(1, Number(reservationForm.guests || 2));
    const nextReservation: TurquesaReservation = {
      time: reservationForm.time || "8:00 PM",
      name: guestName,
      guests,
      area: selectedTable?.zone || "Salon",
      note: reservationForm.note.trim() || "Turquesa OS",
    };
    const nextMessage = `Modo demo: reserva creada para ${guestName}. ${reason}`;
    setSnapshot((current) => ({
      ...current,
      source: "demo",
      message: nextMessage,
      generatedAt: new Date().toISOString(),
      reservations: [...current.reservations, nextReservation],
    }));
    setReservationForm({ time: "20:00", name: "", guests: "2", note: "" });
    setActiveView("reservas");
    setMessage(nextMessage);
  }

  async function createReservation() {
    const guestName = reservationForm.name.trim();
    if (!guestName) {
      setMessage("Escribe el nombre de la reserva.");
      return;
    }

    setSyncing(true);
    try {
      const payload = await postOperation({
        action: "create_reservation",
        guestName,
        time: reservationForm.time,
        pax: Number(reservationForm.guests || 2),
        note: reservationForm.note,
        tableLabel: selectedTable?.label,
      });
      setReservationForm({ time: "20:00", name: "", guests: "2", note: "" });
      setActiveView("reservas");
      setMessage(payload.message || `Reserva creada para ${guestName}.`);
    } catch (error) {
      createReservationLocal(errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  function adjustInventoryLocal(itemName: string, delta: number, reason: string) {
    const nextMessage = `Modo demo: inventario ajustado ${itemName} ${delta > 0 ? "+" : ""}${delta}. ${reason}`;
    setSnapshot((current) => ({
      ...current,
      source: "demo",
      message: nextMessage,
      generatedAt: new Date().toISOString(),
      inventory: current.inventory.map((item) => {
        if (item.item !== itemName) return item;
        const onHand = Math.max(0, Math.round((item.onHand + delta) * 1000) / 1000);
        return {
          ...item,
          onHand,
          trend: inventoryTrend(onHand, item.min),
        };
      }),
    }));
    setActiveView("inventario");
    setMessage(nextMessage);
  }

  async function adjustInventory(itemName: string, delta: number) {
    setSyncing(true);
    try {
      const payload = await postOperation({
        action: "adjust_inventory",
        itemName,
        delta,
        reason: delta > 0 ? "Entrada rapida desde Turquesa OS" : "Consumo/merma rapida desde Turquesa OS",
      });
      setActiveView("inventario");
      setMessage(payload.message || `${itemName} ajustado.`);
    } catch (error) {
      adjustInventoryLocal(itemName, delta, errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  function updateInventoryCostLocal(itemName: string, nextCost: number, reason: string) {
    const safeCost = Math.max(0, Math.round(nextCost * 100) / 100);
    const nextMessage = `Modo demo: costo ${itemName} ajustado a ${currency(safeCost)}. ${reason}`;
    setSnapshot((current) => ({
      ...current,
      source: "demo",
      message: nextMessage,
      generatedAt: new Date().toISOString(),
      inventory: current.inventory.map((item) =>
        item.item === itemName
          ? {
              ...item,
              avgCost: safeCost,
            }
          : item
      ),
    }));
    setActiveView("inventario");
    setMessage(nextMessage);
  }

  async function updateInventoryCost(item: TurquesaInventoryItem, delta: number) {
    const nextCost = Math.max(0, Math.round((item.avgCost + delta) * 100) / 100);
    setActiveView("inventario");
    setSyncing(true);
    try {
      const payload = await postOperation({
        action: "update_inventory_cost",
        itemName: item.item,
        avgCost: nextCost,
        supplier: item.supplier,
      });
      setMessage(payload.message || `Costo ${item.item} actualizado.`);
    } catch (error) {
      updateInventoryCostLocal(item.item, nextCost, errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  function createPurchaseRequestLocal(reason: string) {
    const items = suggestedPurchaseItems(inventory);
    if (!items.length) {
      setMessage("Inventario estable. No hay compra sugerida para preparar.");
      setActiveView("inventario");
      return;
    }

    const requestCode = `COMP-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const nextRequest: TurquesaPurchaseRequest = {
      id: `local-${Date.now()}`,
      code: requestCode,
      status: "draft",
      priority: items.some((item) => inventory.find((row) => row.item === item.item)?.trend === "critico") ? "urgent" : "normal",
      total: purchaseTotal(items),
      items,
      createdAt: new Date().toISOString(),
    };
    const nextMessage = `Modo demo: ${requestCode} preparada con ${items.length} item(s). ${reason}`;
    setSnapshot((current) => ({
      ...current,
      source: "demo",
      message: nextMessage,
      generatedAt: new Date().toISOString(),
      purchaseRequests: [nextRequest, ...current.purchaseRequests].slice(0, 5),
    }));
    setActiveView("inventario");
    setMessage(nextMessage);
  }

  async function createPurchaseRequest() {
    setActiveView("inventario");
    if (!suggestedPurchase.length) {
      setMessage("Inventario estable. No hay compra sugerida para preparar.");
      return;
    }

    setSyncing(true);
    try {
      const payload = await postOperation({
        action: "create_purchase_request",
        reason: "Compra sugerida desde Turquesa OS",
      });
      setMessage(payload.message || "Solicitud de compra preparada.");
    } catch (error) {
      createPurchaseRequestLocal(errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  function updateRecipeIngredientLocal(recipe: TurquesaRecipeIngredient, nextQty: number, reason: string) {
    const safeQty = Math.max(0.01, Math.round(nextQty * 1000) / 1000);
    const nextMessage = `Modo demo: receta ${recipe.menuItem} / ${recipe.ingredient} ajustada a ${formatQty(safeQty)} ${recipe.unit}. ${reason}`;
    setSnapshot((current) => ({
      ...current,
      source: "demo",
      message: nextMessage,
      generatedAt: new Date().toISOString(),
      recipeIngredients: current.recipeIngredients.map((item) =>
        item.id === recipe.id
          ? {
              ...item,
              qty: safeQty,
            }
          : item
      ),
    }));
    setActiveView("inventario");
    setMessage(nextMessage);
  }

  async function updateRecipeIngredient(recipe: TurquesaRecipeIngredient, delta: number) {
    const nextQty = Math.max(0.01, Math.round((recipe.qty + delta) * 1000) / 1000);
    setActiveView("inventario");
    setSyncing(true);
    try {
      const payload = await postOperation({
        action: "update_recipe_ingredient",
        recipeId: recipe.id,
        menuItemName: recipe.menuItem,
        ingredientName: recipe.ingredient,
        quantity: nextQty,
      });
      setMessage(payload.message || `Receta ${recipe.menuItem} actualizada.`);
    } catch (error) {
      updateRecipeIngredientLocal(recipe, nextQty, errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  function receivePurchaseRequestLocal(request: TurquesaPurchaseRequest, reason: string) {
    const nextMessage = `Modo demo: ${request.code} recibida. Inventario actualizado. ${reason}`;
    setSnapshot((current) => ({
      ...current,
      source: "demo",
      message: nextMessage,
      generatedAt: new Date().toISOString(),
      inventory: current.inventory.map((item) => {
        const receivedItem = request.items.find((row) => row.item === item.item);
        if (!receivedItem) return item;

        const onHand = Math.max(0, Math.round((item.onHand + receivedItem.qty) * 1000) / 1000);
        return {
          ...item,
          onHand,
          trend: inventoryTrend(onHand, item.min),
        };
      }),
      purchaseRequests: current.purchaseRequests.map((row) =>
        row.id === request.id
          ? {
              ...row,
              status: "received",
            }
          : row
      ),
    }));
    setActiveView("inventario");
    setMessage(nextMessage);
  }

  async function receivePurchaseRequest(request: TurquesaPurchaseRequest) {
    if (request.status === "received" || request.status === "cancelled") {
      setMessage(`${request.code} ya no esta pendiente de recepcion.`);
      return;
    }

    setActiveView("inventario");
    setSyncing(true);
    try {
      const payload = await postOperation({
        action: "receive_purchase_request",
        requestId: request.id,
        requestCode: request.code,
        notes: "Recepcion desde Turquesa OS",
      });
      setMessage(payload.message || `${request.code} recibida. Inventario actualizado.`);
    } catch (error) {
      receivePurchaseRequestLocal(request, errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  function updateWifiLeadLocal(fullName: string, status: WifiLeadStatus, reason: string) {
    const nextMessage = `Modo demo: ${fullName} marcado como ${status}. ${reason}`;
    setSnapshot((current) => ({
      ...current,
      source: "demo",
      message: nextMessage,
      generatedAt: new Date().toISOString(),
      wifiLeads: current.wifiLeads.map((lead) => (lead.name === fullName ? { ...lead, status } : lead)),
    }));
    setActiveView("reservas");
    setMessage(nextMessage);
  }

  async function updateWifiLead(fullName: string, status: WifiLeadStatus) {
    setSyncing(true);
    try {
      const payload = await postOperation({
        action: "update_wifi_lead",
        fullName,
        status,
      });
      setMessage(payload.message || `${fullName} actualizado.`);
    } catch (error) {
      updateWifiLeadLocal(fullName, status, errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  function activeTableLabels() {
    return tables
      .filter((table) => table.status === "open" || table.status === "attention")
      .map((table) => table.label);
  }

  function closeShiftLocal(reason: string) {
    const activeTables = activeTableLabels();
    setActiveView("cierre");
    if (activeTables.length) {
      setMessage(`No cierro aun: mesas abiertas ${activeTables.join(", ")}. Cobra o libera esas cuentas primero.`);
      return;
    }

    const counted = formNumber(closureForm.countedCash || String(expectedCash));
    const difference = Math.round((counted - expectedCash) * 100) / 100;
    const nextMessage = `Modo demo: cierre preparado. Diferencia ${currency(difference)}. ${reason}`;
    setSnapshot((current) => ({
      ...current,
      source: "demo",
      message: nextMessage,
      generatedAt: new Date().toISOString(),
      shift: {
        ...current.shift,
        status: "closed",
        closedAt: new Date().toISOString(),
        countedCash: counted,
        cashDifference: difference,
      },
    }));
    setMessage(nextMessage);
  }

  async function closeShift() {
    const activeTables = activeTableLabels();
    setActiveView("cierre");
    if (activeTables.length) {
      setMessage(`No se puede cerrar: mesas abiertas ${activeTables.join(", ")}. Cierra esas cuentas primero.`);
      return;
    }

    setSyncing(true);
    try {
      const payload = await postOperation({
        action: "close_shift",
        countedCash: formNumber(closureForm.countedCash || String(expectedCash)),
        notes: closureForm.notes,
      });
      setMessage(payload.message || `Turno cerrado. Diferencia ${currency(closeDifference)}.`);
    } catch (error) {
      closeShiftLocal(errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  const commandModeViews: ViewKey[] = ["ai", "compras", "contabilidad", "configuracion", "usuarios", "auditoria"];
  const isCommandMode = commandModeViews.includes(activeView);

  if (!selectedTable) {
    return (
      <main className={styles.shell}>
        <section className={styles.workspace}>
          <div className={styles.emptyState}>Turquesa Restaurante esta preparando el turno.</div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/brand/turquesa-logo-transparent.png" alt="Turquesa Restaurante" />
          <div>
            <strong>Turquesa OS</strong>
            <span>Restaurant management</span>
          </div>
        </div>

        <nav className={styles.nav} aria-label="Modulos Turquesa">
          {views.map((view) => (
            <button
              key={view.key}
              className={activeView === view.key ? styles.navActive : ""}
              onClick={() => {
                if (view.key === "ai" && !aiResult && !aiLoading) {
                  void runTurquesaAI();
                  return;
                }
                setActiveView(view.key);
              }}
              type="button"
            >
              {view.icon}
              <span>{view.label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.sideSummary}>
          <span>{snapshot.shift.label}</span>
          <strong>{currency(snapshot.shift.projectedSales)}</strong>
          <p>Ventas proyectadas con {openTables} mesas activas.</p>
          <Link href="/dashboard-ceo" className={styles.returnLink}>
            Volver al ERP RDSS
          </Link>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topTitle}>
            <button type="button" className={styles.iconButton} aria-label="Menu principal">
              <Menu size={22} />
            </button>
            <div>
              <h1>Turquesa Restaurante OS</h1>
              <p>Mesas, comandas, cocina, caja, inventario, AI, usuarios y auditoria en una sola operacion.</p>
            </div>
          </div>
          <div className={styles.topActions}>
            <div className={styles.topStatus}>
              <i aria-hidden />
              <div>
                <strong>Turno activo</strong>
                <span>{selectedTable.server} / {selectedTable.label}</span>
              </div>
            </div>
            <div className={styles.topStatus}>
              <CalendarClock size={18} />
              <div>
                <strong>21 Jun 2026</strong>
                <span>Domingo</span>
              </div>
            </div>
            <div className={styles.topStatus}>
              <Clock3 size={18} />
              <div>
                <strong>12:45 PM</strong>
                <span>Bayahibe</span>
              </div>
            </div>
            <button type="button" className={styles.ghostButton} onClick={loadSnapshot} disabled={syncing}>
              <RefreshCw size={17} className={syncing ? styles.spin : undefined} /> {syncing ? "Sincronizando" : "Sincronizar"}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                setActiveView("cierre");
                setMessage("Cierre preparado: caja, propina, ITBIS y ventas listos para cuadrar.");
              }}
            >
              Cerrar turno <ArrowRight size={17} />
            </button>
          </div>
        </header>

        <div className={styles.statusRail}>
          <Metric icon={<Table2 />} label="Mesas activas" value={`${openTables}/${tables.length || 0}`} note={`${reservations.length} reservas proximas`} />
          <Metric icon={<ChefHat />} label="Cocina" value={`${tickets.length}`} note={`${kitchenReady} listas para servir`} />
          <Metric icon={<WalletCards />} label="Caja abierta" value={currency(snapshot.shift.cashOpen)} note="Efectivo + tarjetas" />
          <Metric icon={<Wifi />} label="Clientes Wi-Fi" value={`${wifiLeads.length}`} note="Leads capturados hoy" />
        </div>

        <div className={styles.alertBar}>
          <Bell size={17} />
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("Inventario revisado. Lista de compras actualizada.")}>
            Revisar alertas
          </button>
        </div>

        {activeView !== "operacion" && !isCommandMode ? (
          <ModuleFocus
            activeView={activeView}
            selectedTable={selectedTable}
            tables={tables}
            tickets={tickets}
            reservations={reservations}
            inventory={inventory}
            wifiLeads={wifiLeads}
            payableTotal={payableTotal}
            paymentMethod={paymentMethod}
            cashOpen={snapshot.shift.cashOpen}
            projectedSales={snapshot.shift.projectedSales}
            aiResult={aiResult}
            aiLoading={aiLoading}
            printJobs={printJobs}
            pendingPrintJobs={pendingPrintJobs}
            onSetView={setActiveView}
            onMessage={setMessage}
            onSendToKitchen={() => void sendToKitchen()}
            onCharge={() => void chargeSelectedTable()}
            onCloseShift={() => void closeShift()}
            onCreatePurchaseRequest={() => void createPurchaseRequest()}
            onAdvanceTicket={(id) => void advanceTicket(id)}
            onExportReport={exportTurnReport}
            onRunAI={() => void runTurquesaAI()}
            onPrintPending={() => printPending()}
          />
        ) : null}

        <section
          className={`${styles.mainGrid} ${isCommandMode ? styles.aiModeGrid : ""}`}
        >
          <div className={styles.leftStack}>
            <Panel
              title="Mapa de mesas"
              action={`${selectedTable.zone} / ${selectedTable.seats} pax`}
              icon={<Table2 size={20} />}
            >
              <div className={styles.tableMap}>
                <span className={`${styles.mapZone} ${styles.mapZoneTerrace}`}>Terraza mar</span>
                <span className={`${styles.mapZone} ${styles.mapZoneSalon}`}>Salon principal</span>
                <span className={`${styles.mapZone} ${styles.mapZoneBar}`}>Bar</span>
                <span className={`${styles.mapZone} ${styles.mapZoneVip}`}>Privado VIP</span>
                <span className={styles.mapServiceLine} />
                <span className={`${styles.mapPlant} ${styles.mapPlantOne}`} />
                <span className={`${styles.mapPlant} ${styles.mapPlantTwo}`} />
                <span className={`${styles.mapPlant} ${styles.mapPlantThree}`} />
                <span className={`${styles.mapStation} ${styles.mapStationHost}`}>Host</span>
                <span className={`${styles.mapStation} ${styles.mapStationKitchen}`}>Cocina</span>
                {tables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => setSelectedTableId(table.id)}
                    className={`${styles.tableTile} ${styles[`tablePos_${table.id}`] || ""} ${tableTone(table.status)} ${
                      selectedTableId === table.id ? styles.selectedTable : ""
                    }`}
                  >
                    <span className={styles.tableLabel}>{table.label}</span>
                    <strong>{statusLabel(table.status)}</strong>
                    <small>{table.status === "free" ? `${table.seats} pax` : currency(table.total)}</small>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="POS rapido" action={selectedTable.label} icon={<ReceiptText size={20} />}>
              <div className={styles.posHeader}>
                <div className={styles.searchBox}>
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar plato, bebida o estacion"
                  />
                </div>
                <button type="button" className={styles.smallButton} onClick={() => setMessage("Modo propina revisado: 10% incluido.")}>
                  <Sparkles size={16} /> Propina 10%
                </button>
              </div>
              <div className={styles.menuGrid}>
                {filteredMenu.map((item) => {
                  const thumbTone = menuThumbTone(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      className={`${styles.menuItem} ${styles[`menuItem_${thumbTone}`] || ""}`}
                    >
                      <i className={`${styles.menuThumb} ${styles[`menuThumb_${thumbTone}`] || ""}`} aria-hidden />
                      <span>{item.category}</span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.station} / {item.prep} min
                      </small>
                      <b>{currency(item.price)}</b>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className={styles.centerStack}>
            {activeView === "operacion" ? (
              <Panel title="Comandas activas" action={`${tickets.length} tickets`} icon={<ClipboardList size={20} />}>
                <ActiveOrdersPanel tables={tables} tickets={tickets} onSelectTable={setSelectedTableId} onOpenPOS={() => setActiveView("pos")} />
              </Panel>
            ) : (
              <Panel title={`Comanda ${selectedTable.label}`} action={selectedTable.server} icon={<ClipboardList size={20} />}>
                <div className={styles.orderMeta}>
                  <div>
                    <span>{statusLabel(selectedTable.status)}</span>
                    <strong>{selectedTable.zone}</strong>
                  </div>
                  <div>
                    <span>Tiempo</span>
                    <strong>{selectedTable.minutes || 0} min</strong>
                  </div>
                </div>

                <div className={styles.orderList}>
                  {order.length ? (
                    order.map((item) => (
                      <div className={styles.orderRow} key={item.id}>
                        <div>
                          <strong>{item.name}</strong>
                          <span>
                            {currency(item.price)} / {item.station}
                          </span>
                        </div>
                        <div className={styles.qtyControl}>
                          <button type="button" onClick={() => changeQty(item.id, -1)} aria-label={`Quitar ${item.name}`}>
                            <Minus size={14} />
                          </button>
                          <b>{item.qty}</b>
                          <button type="button" onClick={() => changeQty(item.id, 1)} aria-label={`Agregar ${item.name}`}>
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyState}>Selecciona items del menu para iniciar la comanda.</div>
                  )}
                </div>

                <div className={styles.totals}>
                  <Line label="Subtotal" value={currency(orderSubtotal)} />
                  <Line label="10% servicio" value={currency(serviceFee)} />
                  <Line label="ITBIS" value={currency(tax)} />
                  {selectedTable.total > 0 ? <Line label="Cuenta mesa" value={currency(selectedTable.total)} /> : null}
                  <Line label="Total a cobrar" value={currency(payableTotal)} strong />
                </div>

                <div className={styles.methodGrid} aria-label="Metodo de pago">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.key}
                      type="button"
                      onClick={() => setPaymentMethod(method.key)}
                      className={paymentMethod === method.key ? styles.methodActive : ""}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>

                <div className={styles.actionGrid}>
                  <button type="button" className={styles.primaryButton} onClick={sendToKitchen} disabled={syncing}>
                    Enviar cocina
                  </button>
                  <button type="button" className={styles.ghostButton} onClick={() => void chargeSelectedTable()} disabled={syncing}>
                    Cobrar {paymentLabel(paymentMethod)}
                  </button>
                </div>
              </Panel>
            )}

            <Panel title="Cocina en vivo" action="KDS" icon={<ChefHat size={20} />}>
              <div className={styles.ticketList}>
                {tickets.map((ticket) => (
                  <div className={`${styles.ticket} ${styles[ticket.status]}`} key={ticket.id}>
                    <div className={styles.ticketTop}>
                      <strong>
                        {ticket.id} / {ticket.table}
                      </strong>
                      <span>{ticketLabel(ticket.status)}</span>
                    </div>
                    <p>{ticket.items.join(", ")}</p>
                    <div className={styles.ticketFooter}>
                      <small>
                        {ticket.station} / {ticket.minutes} min
                      </small>
                      <div className={styles.ticketActions}>
                        <button type="button" onClick={() => printTicket(ticket.id)}>
                          Imprimir
                        </button>
                        <button type="button" onClick={() => void advanceTicket(ticket.id)} disabled={syncing}>
                          Avanzar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className={styles.rightStack}>
            {activeView === "operacion" ? (
              <Panel title="AI Co-pilot" action={aiProviderLabel(aiResult)} icon={<Brain size={20} />}>
                <AICopilotMiniPanel
                  ai={aiResult}
                  loading={aiLoading}
                  tables={tables}
                  tickets={tickets}
                  inventory={inventory}
                  reservations={reservations}
                  onAnalyze={() => void runTurquesaAI()}
                  onOpenAI={() => setActiveView("ai")}
                />
              </Panel>
            ) : null}

            {activeView === "operacion" ? (
              <Panel title="Resumen del dia" action="Dia" icon={<Gauge size={20} />}>
                <DaySummaryPanel
                  shift={snapshot.shift}
                  tables={tables}
                  reservations={reservations}
                  inventory={inventory}
                  wifiLeads={wifiLeads}
                />
              </Panel>
            ) : null}

            {activeView === "cierre" ? (
              <Panel title="Cierre de turno" action={snapshot.shift.status === "closed" ? "Cerrado" : "Caja"} icon={<Banknote size={20} />}>
                <ShiftClosePanel
                  shift={snapshot.shift}
                  openTables={tables.filter((table) => table.status === "open" || table.status === "attention")}
                  countedCash={closureForm.countedCash}
                  notes={closureForm.notes}
                  onChange={setClosureForm}
                  onClose={() => void closeShift()}
                  disabled={syncing}
                />
              </Panel>
            ) : null}

            {activeView === "inventario" ? (
              <Panel title="Compra sugerida" action={`${suggestedPurchase.length} item(s)`} icon={<ShoppingBag size={20} />}>
                <PurchaseRequestPanel
                  suggestedItems={suggestedPurchase}
                  purchaseRequests={purchaseRequests}
                  onCreate={() => void createPurchaseRequest()}
                  onReceive={(request) => void receivePurchaseRequest(request)}
                  disabled={syncing}
                />
              </Panel>
            ) : null}

            {activeView === "inventario" ? (
              <Panel title="Recetas" action={`${recipeIngredients.length} insumos`} icon={<ChefHat size={20} />}>
                <RecipeManagerPanel
                  menuItems={menuItems}
                  recipeIngredients={recipeIngredients}
                  selectedMenu={selectedRecipeMenu}
                  onSelectMenu={setSelectedRecipeMenu}
                  onAdjust={(recipe, delta) => void updateRecipeIngredient(recipe, delta)}
                  disabled={syncing}
                />
              </Panel>
            ) : null}

            {activeView === "inventario" ? (
              <Panel title="Proveedores" action={`${inventory.length} costos`} icon={<WalletCards size={20} />}>
                <SupplierCostPanel inventory={inventory} onAdjustCost={(item, delta) => void updateInventoryCost(item, delta)} disabled={syncing} />
              </Panel>
            ) : null}

            {activeView === "impresoras" ? (
              <Panel title="Impresoras" action={`${pendingPrintJobs.length} pendientes`} icon={<Printer size={20} />}>
                <PrinterControlPanel
                  jobs={printJobs}
                  printLog={printLog}
                  onPrintJob={printJob}
                  onPrintPending={printPending}
                />
              </Panel>
            ) : null}

            {activeView === "compras" ? (
              <Panel title="Compras y proveedores" action={`${purchaseRequests.length} solicitudes`} icon={<ShoppingBag size={20} />}>
                <PurchasesCommandPanel
                  inventory={inventory}
                  suggestedItems={suggestedPurchase}
                  purchaseRequests={purchaseRequests}
                  onCreate={() => void createPurchaseRequest()}
                  onReceive={(request) => void receivePurchaseRequest(request)}
                  onAdjustCost={(item, delta) => void updateInventoryCost(item, delta)}
                  disabled={syncing}
                />
              </Panel>
            ) : null}

            {activeView === "contabilidad" ? (
              <Panel title="Contabilidad del restaurante" action={snapshot.shift.status === "closed" ? "Cerrado" : "Turno abierto"} icon={<WalletCards size={20} />}>
                <AccountingCommandPanel
                  snapshot={snapshot}
                  tables={tables}
                  purchaseRequests={purchaseRequests}
                  suggestedItems={suggestedPurchase}
                  countedCash={closureForm.countedCash}
                  notes={closureForm.notes}
                  onChangeClosure={setClosureForm}
                  onClose={() => void closeShift()}
                  onExport={exportTurnReport}
                  disabled={syncing}
                />
              </Panel>
            ) : null}

            {activeView === "ai" ? (
              <Panel title="Turquesa AI Command Center" action={aiProviderLabel(aiResult)} icon={<Brain size={20} />}>
                <TurquesaAIPanel
                  ai={aiResult}
                  loading={aiLoading}
                  snapshot={snapshot}
                  tables={tables}
                  tickets={tickets}
                  reservations={reservations}
                  inventory={inventory}
                  wifiLeads={wifiLeads}
                  printJobs={printJobs}
                  pendingPrintJobs={pendingPrintJobs}
                  messages={aiMessages}
                  prompt={aiPrompt}
                  onPromptChange={setAiPrompt}
                  onAnalyze={() => void runTurquesaAI()}
                  onAsk={askTurquesaAI}
                  onSetView={setActiveView}
                  onCreatePurchaseRequest={() => void createPurchaseRequest()}
                  onPrintPending={printPending}
                />
              </Panel>
            ) : null}

            {activeView === "reportes" ? (
              <Panel title="Reporte del turno" action="CSV" icon={<FileDown size={20} />}>
                <TurnReportPanel
                  snapshot={snapshot}
                  tables={tables}
                  tickets={tickets}
                  inventory={inventory}
                  reservations={reservations}
                  purchaseRequests={purchaseRequests}
                  wifiLeads={wifiLeads}
                  onExport={exportTurnReport}
                />
              </Panel>
            ) : null}

            {activeView === "configuracion" ? (
              <Panel title="Configuracion operativa" action="Premium OS" icon={<Settings size={20} />}>
                <ConfigurationCommandPanel
                  snapshot={snapshot}
                  printJobs={printJobs}
                  pendingPrintJobs={pendingPrintJobs}
                  onSync={loadSnapshot}
                  onRunAI={() => void runTurquesaAI()}
                  onMessage={setMessage}
                  disabled={syncing || aiLoading}
                />
              </Panel>
            ) : null}

            {activeView === "usuarios" ? (
              <Panel title="Usuarios y permisos" action="RBAC" icon={<UsersRound size={20} />}>
                <UsersCommandPanel snapshot={snapshot} onMessage={setMessage} />
              </Panel>
            ) : null}

            {activeView === "auditoria" ? (
              <Panel title="Auditoria y seguridad" action="Trazabilidad" icon={<History size={20} />}>
                <AuditCommandPanel
                  snapshot={snapshot}
                  tables={tables}
                  inventory={inventory}
                  purchaseRequests={purchaseRequests}
                  printJobs={printJobs}
                  aiResult={aiResult}
                  onExport={exportTurnReport}
                  onRunAI={() => void runTurquesaAI()}
                  disabled={syncing || aiLoading}
                />
              </Panel>
            ) : null}

            <Panel title="Gerencia" action="Hoy" icon={<Gauge size={20} />}>
              <div className={styles.insightList}>
                <Insight icon={<ShieldCheck />} title="Servicio estable" text="Tiempo promedio de cocina 13 min. Mesa M3 requiere seguimiento." />
                <Insight icon={<Package />} title="Compra critica" text={inventoryInsight(inventory)} />
                <Insight icon={<CreditCard />} title="Caja balanceada" text="Tarjetas 61%, efectivo 32%, transferencia 7%." />
              </div>
            </Panel>

            <Panel title="Reservas" action={`${reservations.length} proximas`} icon={<CalendarClock size={20} />}>
              <ReservationQuickForm
                value={reservationForm}
                onChange={setReservationForm}
                onSubmit={() => void createReservation()}
                disabled={syncing}
              />
              <div className={styles.compactList}>
                {reservations.map((item) => (
                  <div className={styles.compactRow} key={`${item.time}-${item.name}`}>
                    <Clock3 size={16} />
                    <div>
                      <strong>
                        {item.time} / {item.name}
                      </strong>
                      <span>
                        {item.guests} pax / {item.area} / {item.note}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Inventario critico" action={`${inventory.length} items`} icon={<ShoppingBag size={20} />}>
              <div className={styles.inventoryList}>
                {inventory.map((item) => (
                  <InventoryRow
                    key={item.item}
                    item={item}
                    onAdjust={(delta) => void adjustInventory(item.item, delta)}
                    disabled={syncing}
                  />
                ))}
              </div>
            </Panel>

            <Panel title="Clientes Wi-Fi" action="CRM" icon={<Wifi size={20} />}>
              <div className={styles.compactList}>
                {wifiLeads.map((lead) => (
                  <WifiLeadRow
                    key={`${lead.name}-${lead.time}`}
                    lead={lead}
                    onStatus={(status) => void updateWifiLead(lead.name, status)}
                    disabled={syncing}
                  />
                ))}
              </div>
            </Panel>
          </div>
        </section>
      </section>
    </main>
  );
}

function ModuleFocus({
  activeView,
  selectedTable,
  tables,
  tickets,
  reservations,
  inventory,
  wifiLeads,
  payableTotal,
  paymentMethod,
  cashOpen,
  projectedSales,
  aiResult,
  aiLoading,
  printJobs,
  pendingPrintJobs,
  onSetView,
  onMessage,
  onSendToKitchen,
  onCharge,
  onCloseShift,
  onCreatePurchaseRequest,
  onAdvanceTicket,
  onExportReport,
  onRunAI,
  onPrintPending,
}: {
  activeView: ViewKey;
  selectedTable: TurquesaTable;
  tables: TurquesaTable[];
  tickets: TurquesaKitchenTicket[];
  reservations: TurquesaSnapshot["reservations"];
  inventory: TurquesaInventoryItem[];
  wifiLeads: TurquesaWifiLead[];
  payableTotal: number;
  paymentMethod: PaymentMethod;
  cashOpen: number;
  projectedSales: number;
  aiResult: TurquesaAIResult | null;
  aiLoading: boolean;
  printJobs: TurquesaPrintJob[];
  pendingPrintJobs: TurquesaPrintJob[];
  onSetView: (view: ViewKey) => void;
  onMessage: (message: string) => void;
  onSendToKitchen: () => void;
  onCharge: () => void;
  onCloseShift: () => void;
  onCreatePurchaseRequest: () => void;
  onAdvanceTicket: (id: string) => void;
  onExportReport: () => void;
  onRunAI: () => void;
  onPrintPending: () => void;
}) {
  const openTables = tables.filter((table) => table.status === "open" || table.status === "attention");
  const readyTickets = tickets.filter((ticket) => ticket.status === "ready");
  const cookingTickets = tickets.filter((ticket) => ticket.status === "cooking");
  const newTickets = tickets.filter((ticket) => ticket.status === "new");
  const criticalInventory = inventory.filter((item) => item.trend === "critico");
  const lowInventory = inventory.filter((item) => item.trend === "bajo");
  const nextReservation = reservations[0];

  const config: {
    title: string;
    subtitle: string;
    stats: Array<{ label: string; value: string }>;
    actions: Array<{ label: string; onClick: () => void; primary?: boolean }>;
  } =
    activeView === "pos"
      ? {
          title: "Punto de venta",
          subtitle: `Mesa ${selectedTable.label} lista para comandar, cobrar o mover a cocina.`,
          stats: [
            { label: "Mesa", value: selectedTable.label },
            { label: "Metodo", value: paymentLabel(paymentMethod) },
            { label: "A cobrar", value: currency(payableTotal) },
          ],
          actions: [
            { label: "Enviar cocina", onClick: onSendToKitchen, primary: true },
            { label: "Cobrar mesa", onClick: onCharge },
          ],
        }
      : activeView === "cocina"
        ? {
            title: "Cocina y barra",
            subtitle: "Control KDS para preparar, marcar listo y servir sin perder el pulso del salon.",
            stats: [
              { label: "Nuevas", value: String(newTickets.length) },
              { label: "En cocina", value: String(cookingTickets.length) },
              { label: "Listas", value: String(readyTickets.length) },
            ],
            actions: [
              {
                label: readyTickets[0] ? `Servir ${readyTickets[0].id}` : tickets[0] ? `Avanzar ${tickets[0].id}` : "Sin tickets",
                onClick: () => {
                  const ticket = readyTickets[0] || tickets[0];
                  if (ticket) onAdvanceTicket(ticket.id);
                  else onMessage("Cocina sin tickets pendientes.");
                },
                primary: true,
              },
              { label: "Ver POS", onClick: () => onSetView("pos") },
            ],
          }
        : activeView === "reservas"
          ? {
              title: "Reservas y anfitrion",
              subtitle: nextReservation
                ? `Proxima reserva: ${nextReservation.time} / ${nextReservation.name}.`
                : "Sin reservas pendientes para este turno.",
              stats: [
                { label: "Reservas", value: String(reservations.length) },
                { label: "Pax", value: String(reservations.reduce((sum, item) => sum + item.guests, 0)) },
                { label: "Clientes Wi-Fi", value: String(wifiLeads.length) },
              ],
              actions: [
                { label: "Preasignar mesa", onClick: () => onMessage("Reserva marcada para preasignacion de mesa."), primary: true },
                { label: "Abrir POS", onClick: () => onSetView("pos") },
              ],
            }
          : activeView === "inventario"
            ? {
                title: "Inventario y compras",
                subtitle: criticalInventory[0]
                  ? `${criticalInventory[0].item} esta por debajo del minimo.`
                  : "Inventario operativo estable para el turno.",
                stats: [
                  { label: "Criticos", value: String(criticalInventory.length) },
                  { label: "Bajos", value: String(lowInventory.length) },
                  { label: "Items", value: String(inventory.length) },
                ],
                actions: [
                  { label: "Generar compra", onClick: onCreatePurchaseRequest, primary: true },
                  { label: "Ver cierre", onClick: () => onSetView("cierre") },
                ],
              }
            : activeView === "cierre"
              ? {
                  title: "Cierre de caja",
                  subtitle: "Cuadre de ventas, pagos, propina 10%, ITBIS y mesas pendientes.",
                  stats: [
                    { label: "Caja", value: currency(cashOpen) },
                    { label: "Proyectado", value: currency(projectedSales) },
                    { label: "Mesas abiertas", value: String(openTables.length) },
                  ],
            actions: [
                    {
                      label: openTables.length ? "Ver mesas abiertas" : "Cerrar turno",
                      onClick: openTables.length
                        ? () => onMessage(`Mesas abiertas antes del cierre: ${openTables.map((table) => table.label).join(", ")}.`)
                        : onCloseShift,
                      primary: true,
                    },
                    { label: "Preparar reporte", onClick: () => onMessage("Reporte de cierre preparado para gerencia.") },
                  ],
                }
              : activeView === "ai"
                ? {
                    title: "Turquesa AI Copilot",
                    subtitle: aiResult
                      ? aiResult.summary
                      : "Analisis supervisado para turno, cocina, caja, inventario, compras, reservas y Wi-Fi.",
                    stats: [
                      { label: "Riesgo", value: aiRiskLabel(aiResult?.riskLevel) },
                      { label: "Motor", value: aiProviderLabel(aiResult) },
                      { label: "Acciones", value: String(aiResult?.recommendations.length || 0) },
                    ],
                    actions: [
                      { label: aiLoading ? "Analizando" : "Analizar turno", onClick: onRunAI, primary: true },
                      { label: "Ver reportes", onClick: () => onSetView("reportes") },
                    ],
                  }
              : activeView === "impresoras"
                ? {
                    title: "Impresion y despacho",
                    subtitle: "Centro de despacho, cocina y bar reciben tickets separados por estacion.",
                    stats: [
                      { label: "Estaciones", value: String(TURQUESA_PRINTER_STATIONS.length) },
                      { label: "Pendientes", value: String(pendingPrintJobs.length) },
                      { label: "Tickets", value: String(printJobs.length) },
                    ],
                    actions: [
                      { label: "Imprimir pendientes", onClick: onPrintPending, primary: true },
                      { label: "Ver cocina", onClick: () => onSetView("cocina") },
                    ],
                  }
              : activeView === "reportes"
                ? {
                    title: "Reportes de gerencia",
                    subtitle: "Resumen exportable del turno: ventas, pagos, mesas, KDS, inventario y compras.",
                    stats: [
                      { label: "Caja", value: currency(cashOpen) },
                      { label: "Mesas abiertas", value: String(openTables.length) },
                      { label: "Alertas inv.", value: String(criticalInventory.length + lowInventory.length) },
                    ],
                    actions: [
                      { label: "Exportar CSV", onClick: onExportReport, primary: true },
                      { label: "Ver cierre", onClick: () => onSetView("cierre") },
                    ],
                  }
                : {
                  title: "Operacion del salon",
                  subtitle: `Mesa ${selectedTable.label}: ${statusLabel(selectedTable.status)} en ${selectedTable.zone}.`,
                  stats: [
                    { label: "Mesas activas", value: String(openTables.length) },
                    { label: "Cocina", value: String(tickets.length) },
                    { label: "Atencion", value: String(tables.filter((table) => table.status === "attention").length) },
                  ],
                  actions: [
                    { label: "Ir al POS", onClick: () => onSetView("pos"), primary: true },
                    { label: "Ver cocina", onClick: () => onSetView("cocina") },
                  ],
                };

  return (
    <section className={styles.moduleFocus}>
      <div className={styles.moduleInfo}>
        <span>{views.find((view) => view.key === activeView)?.label}</span>
        <strong>{config.title}</strong>
        <p>{config.subtitle}</p>
      </div>
      <div className={styles.moduleStats}>
        {config.stats.map((stat) => (
          <div className={styles.statPill} key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
      <div className={styles.moduleActions}>
        {config.actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={action.primary ? styles.modulePrimary : ""}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function inventoryInsight(inventory: TurquesaInventoryItem[]) {
  const critical = inventory.find((item) => item.trend === "critico");
  if (critical) return `${critical.item} bajo minimo. Sugerir compra antes de abrir manana.`;
  const low = inventory.find((item) => item.trend === "bajo");
  if (low) return `${low.item} cerca del punto de reposicion.`;
  return "Inventario estable para el turno activo.";
}

function Panel({
  title,
  action,
  icon,
  children,
}: {
  title: string;
  action?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          {icon}
          <h2>{title}</h2>
        </div>
        {action ? <span>{action}</span> : null}
      </header>
      {children}
    </section>
  );
}

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <div className={styles.metric}>
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}

function ActiveOrdersPanel({
  tables,
  tickets,
  onSelectTable,
  onOpenPOS,
}: {
  tables: TurquesaTable[];
  tickets: TurquesaKitchenTicket[];
  onSelectTable: (id: string) => void;
  onOpenPOS: () => void;
}) {
  const rows = tables
    .filter((table) => table.status === "open" || table.status === "attention")
    .slice(0, 6)
    .map((table) => {
      const tableTickets = tickets.filter((ticket) => ticket.table === table.label);
      const primaryTicket = tableTickets[0];
      return {
        table,
        ticket: primaryTicket,
        items: tableTickets.reduce((sum, ticket) => sum + ticket.items.length, 0) || Math.max(1, Math.round(table.total / 1650)),
        state: primaryTicket ? ticketLabel(primaryTicket.status) : table.status === "attention" ? "Atencion" : "Abierta",
      };
    });

  return (
    <div className={styles.activeOrders}>
      <div className={styles.activeOrderTabs}>
        <button type="button" className={styles.activeOrderTab}>
          Todas <b>{rows.length}</b>
        </button>
        <button type="button">
          Mis mesas <b>{Math.max(1, rows.length - 2)}</b>
        </button>
        <button type="button">
          Para llevar <b>{tickets.filter((ticket) => ticket.table.toLowerCase().includes("take")).length || 1}</b>
        </button>
      </div>

      <div className={styles.activeOrderHeader}>
        <span>Mesa</span>
        <span>Tiempo</span>
        <span>Articulos</span>
        <span>Total</span>
        <span>Estado</span>
      </div>

      <div className={styles.activeOrderRows}>
        {rows.map(({ table, ticket, items, state }) => (
          <button
            type="button"
            className={styles.activeOrderRow}
            key={table.id}
            onClick={() => {
              onSelectTable(table.id);
              onOpenPOS();
            }}
          >
            <span className={styles.tableDot}>{table.label.replace("M", "")}</span>
            <span>00:{String(Math.max(table.minutes, ticket?.minutes || 0)).padStart(2, "0")}</span>
            <span>{items}</span>
            <strong>{currency(table.total)}</strong>
            <b className={styles[`activeState_${table.status === "attention" ? "attention" : ticket?.status || "open"}`]}>{state}</b>
          </button>
        ))}
      </div>

      <button type="button" className={styles.textLinkButton} onClick={onOpenPOS}>
        Ver todas las comandas <ArrowRight size={15} />
      </button>
    </div>
  );
}

function DaySummaryPanel({
  shift,
  tables,
  reservations,
  inventory,
  wifiLeads,
}: {
  shift: TurquesaSnapshot["shift"];
  tables: TurquesaTable[];
  reservations: TurquesaReservation[];
  inventory: TurquesaInventoryItem[];
  wifiLeads: TurquesaWifiLead[];
}) {
  const paidTotal = shiftPaidTotal(shift);
  const occupied = tables.filter((table) => table.status === "open" || table.status === "attention").length;
  const criticalItems = inventory.filter((item) => item.trend === "critico" || item.trend === "bajo").slice(0, 3);

  return (
    <div className={styles.daySummary}>
      <div className={styles.daySales}>
        <span>Ventas totales</span>
        <strong>{currency(paidTotal)}</strong>
        <small>+15.2% vs ayer</small>
        <i aria-hidden />
      </div>

      <div className={styles.daySummaryGrid}>
        <div>
          <span>Transacciones</span>
          <strong>126</strong>
          <small>+8.4%</small>
        </div>
        <div>
          <span>Ticket promedio</span>
          <strong>{currency(385)}</strong>
          <small>+6.7%</small>
        </div>
        <div>
          <span>Mesas ocupadas</span>
          <strong>{Math.round((occupied / Math.max(1, tables.length)) * 100)}%</strong>
          <small>{occupied} de {tables.length}</small>
        </div>
      </div>

      <div className={styles.dayList}>
        <div className={styles.dayListTitle}>
          <strong>Inventario critico</strong>
          <button type="button">Ver todas</button>
        </div>
        {criticalItems.map((item) => (
          <div className={styles.dayListRow} key={item.item}>
            <span>{item.item}</span>
            <b>{item.trend === "critico" ? "Stock bajo" : "Reposicion"}</b>
          </div>
        ))}
      </div>

      <div className={styles.dayList}>
        <div className={styles.dayListTitle}>
          <strong>Proximas reservas</strong>
          <button type="button">Calendario</button>
        </div>
        {reservations.slice(0, 3).map((reservation) => (
          <div className={styles.dayListRow} key={`${reservation.time}-${reservation.name}`}>
            <span>{reservation.time} / {reservation.name}</span>
            <b>{reservation.guests} pax</b>
          </div>
        ))}
      </div>

      <div className={styles.wifiMini}>
        <span>Clientes Wi-Fi hoy</span>
        <strong>{wifiLeads.length}</strong>
        <small>{wifiLeads.filter((lead) => lead.status === "cliente").length || 1} conversion</small>
      </div>
    </div>
  );
}

function AICopilotMiniPanel({
  ai,
  loading,
  tables,
  tickets,
  inventory,
  reservations,
  onAnalyze,
  onOpenAI,
}: {
  ai: TurquesaAIResult | null;
  loading: boolean;
  tables: TurquesaTable[];
  tickets: TurquesaKitchenTicket[];
  inventory: TurquesaInventoryItem[];
  reservations: TurquesaReservation[];
  onAnalyze: () => void;
  onOpenAI: () => void;
}) {
  const attentionTables = tables.filter((table) => table.status === "attention");
  const readyTickets = tickets.filter((ticket) => ticket.status === "ready");
  const criticalItems = inventory.filter((item) => item.trend === "critico");
  const recommendations = ai?.recommendations?.length
    ? ai.recommendations.slice(0, 3)
    : [
        {
          area: "cocina",
          priority: readyTickets.length ? "watch" as const : "ok" as const,
          title: readyTickets.length ? "Despacho pendiente" : "Cocina estable",
          text: readyTickets.length ? `${readyTickets.length} ticket(s) listos para servir.` : "Tiempos de preparacion dentro de rango.",
          action: readyTickets.length ? "Asignar runner ahora" : "Mantener ritmo",
        },
        {
          area: "inventario",
          priority: criticalItems.length ? "urgent" as const : "ok" as const,
          title: criticalItems.length ? "Compra critica" : "Inventario normal",
          text: criticalItems[0] ? `${criticalItems[0].item} bajo minimo.` : "No hay insumos criticos.",
          action: criticalItems.length ? "Crear compra supervisada" : "Revisar al cierre",
        },
        {
          area: "reservas",
          priority: reservations.length > 2 ? "watch" as const : "ok" as const,
          title: "Flujo de reservas",
          text: reservations[0] ? `Proxima ${reservations[0].time}: ${reservations[0].name}.` : "Sin reservas inmediatas.",
          action: "Preasignar salon",
        },
      ];

  return (
    <div className={styles.aiMiniPanel}>
      <div className={`${styles.aiMiniHero} ${ai?.riskLevel === "critico" ? styles.aiMiniHeroRisk : ""}`}>
        <span>Resumen inteligente</span>
        <strong>{ai ? aiRiskLabel(ai.riskLevel) : attentionTables.length ? "Atencion" : "Normal"}</strong>
        <p>{ai?.summary || (attentionTables.length ? `${attentionTables.map((table) => table.label).join(", ")} requiere seguimiento.` : "Ventas y servicio estables para el turno.")}</p>
      </div>

      <div className={styles.aiMiniList}>
        {recommendations.map((item) => (
          <article className={styles.aiMiniItem} key={`${item.area}-${item.title}`}>
            <i className={styles[`aiMiniTone_${item.priority}`]} />
            <div>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
              <span>{item.action}</span>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.aiMiniActions}>
        <button type="button" onClick={onAnalyze} disabled={loading}>
          <Sparkles size={15} /> {loading ? "Analizando" : "Analizar ahora"}
        </button>
        <button type="button" onClick={onOpenAI}>
          <ArrowRight size={15} /> Command center
        </button>
      </div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? styles.totalLine : styles.line}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Insight({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className={styles.insight}>
      <div>{icon}</div>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </article>
  );
}

function PurchasesCommandPanel({
  inventory,
  suggestedItems,
  purchaseRequests,
  onCreate,
  onReceive,
  onAdjustCost,
  disabled,
}: {
  inventory: TurquesaInventoryItem[];
  suggestedItems: TurquesaPurchaseRequestItem[];
  purchaseRequests: TurquesaPurchaseRequest[];
  onCreate: () => void;
  onReceive: (request: TurquesaPurchaseRequest) => void;
  onAdjustCost: (item: TurquesaInventoryItem, delta: number) => void;
  disabled: boolean;
}) {
  const suggestedTotal = purchaseTotal(suggestedItems);
  const criticalItems = inventory.filter((item) => item.trend === "critico");
  const lowItems = inventory.filter((item) => item.trend === "bajo");
  const openRequests = purchaseRequests.filter((request) => request.status !== "received" && request.status !== "cancelled");
  const receivedRequests = purchaseRequests.filter((request) => request.status === "received");
  const payableTotal = openRequests.reduce((sum, request) => sum + request.total, 0);
  const receivable = openRequests[0];

  return (
    <div className={styles.commandPanel}>
      <section className={styles.commandHero}>
        <div>
          <span>Orden sugerida</span>
          <strong>{currency(suggestedTotal)}</strong>
          <p>
            {suggestedItems.length
              ? `${suggestedItems.length} insumo(s) listos para aprobacion de compras.`
              : "Inventario estable; no hay orden sugerida critica."}
          </p>
        </div>
        <div className={styles.commandHeroActions}>
          <button type="button" onClick={onCreate} disabled={disabled || !suggestedItems.length}>
            <ShoppingBag size={16} /> Generar compra
          </button>
          <button type="button" onClick={() => receivable && onReceive(receivable)} disabled={disabled || !receivable}>
            <Package size={16} /> Recibir pendiente
          </button>
        </div>
      </section>

      <div className={styles.commandKpis}>
        <CommandKpi label="Criticos" value={String(criticalItems.length)} note={criticalItems[0]?.item || "Sin bloqueo"} tone={criticalItems.length ? "red" : "green"} />
        <CommandKpi label="Reposicion" value={String(lowItems.length)} note={lowItems[0]?.item || "Normal"} tone={lowItems.length ? "amber" : "green"} />
        <CommandKpi label="Pendiente" value={currency(payableTotal)} note={`${openRequests.length} solicitudes`} tone={openRequests.length ? "amber" : "green"} />
        <CommandKpi label="Recibidas" value={String(receivedRequests.length)} note="Compras cerradas" tone="teal" />
      </div>

      <section className={styles.commandGrid}>
        <div className={styles.commandBlock}>
          <header>
            <span>Compra sugerida</span>
            <strong>Insumos para aprobar</strong>
          </header>
          <div className={styles.commandRows}>
            {suggestedItems.length ? (
              suggestedItems.map((item) => (
                <div className={styles.commandRow} key={item.item}>
                  <div>
                    <strong>{item.item}</strong>
                    <span>
                      {item.qty} {item.unit} / {item.supplier}
                    </span>
                  </div>
                  <b>{currency(item.estimatedCost)}</b>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>Sin compras urgentes ahora.</div>
            )}
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Solicitudes</span>
            <strong>Estado de compras</strong>
          </header>
          <div className={styles.commandRows}>
            {purchaseRequests.length ? (
              purchaseRequests.map((request) => (
                <div className={styles.commandRow} key={request.id}>
                  <div>
                    <strong>{request.code}</strong>
                    <span>
                      {purchaseStatusLabel(request.status)} / {request.items.length} item(s)
                    </span>
                  </div>
                  <div className={styles.commandRowActions}>
                    <b>{currency(request.total)}</b>
                    {request.status !== "received" && request.status !== "cancelled" ? (
                      <button type="button" onClick={() => onReceive(request)} disabled={disabled}>
                        Recibir
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>No hay solicitudes creadas.</div>
            )}
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Proveedores</span>
            <strong>Costos promedio</strong>
          </header>
          <div className={styles.supplierRows}>
            {inventory.map((item) => (
              <div className={styles.supplierRow} key={item.item}>
                <div>
                  <strong>{item.item}</strong>
                  <span>{item.supplier || "Proveedor por definir"}</span>
                </div>
                <div className={styles.supplierCost}>
                  <button type="button" onClick={() => onAdjustCost(item, -25)} disabled={disabled} aria-label={`Bajar costo ${item.item}`}>
                    <Minus size={13} />
                  </button>
                  <b>{currency(item.avgCost)}</b>
                  <button type="button" onClick={() => onAdjustCost(item, 25)} disabled={disabled} aria-label={`Subir costo ${item.item}`}>
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Recepcion</span>
            <strong>Control de entrada</strong>
          </header>
          <div className={styles.auditList}>
            <AuditItem title="Validar factura" text="Confirmar proveedor, RNC, ITBIS y total antes de recibir." tone="amber" />
            <AuditItem title="Actualizar inventario" text="La recepcion suma stock y recalcula tendencia de reposicion." tone="teal" />
            <AuditItem title="Trazabilidad" text="Cada compra conserva codigo, items, costo estimado y estado." tone="green" />
          </div>
        </div>
      </section>
    </div>
  );
}

function AccountingCommandPanel({
  snapshot,
  tables,
  purchaseRequests,
  suggestedItems,
  countedCash,
  notes,
  onChangeClosure,
  onClose,
  onExport,
  disabled,
}: {
  snapshot: TurquesaSnapshot;
  tables: TurquesaTable[];
  purchaseRequests: TurquesaPurchaseRequest[];
  suggestedItems: TurquesaPurchaseRequestItem[];
  countedCash: string;
  notes: string;
  onChangeClosure: (value: ClosureFormState) => void;
  onClose: () => void;
  onExport: () => void;
  disabled: boolean;
}) {
  const shift = snapshot.shift;
  const paidTotal = shiftPaidTotal(shift);
  const openTables = tables.filter((table) => table.status === "open" || table.status === "attention");
  const openBalance = openTables.reduce((sum, table) => sum + table.total, 0);
  const outstandingPurchases = purchaseRequests
    .filter((request) => request.status !== "received" && request.status !== "cancelled")
    .reduce((sum, request) => sum + request.total, 0);
  const suggestedTotal = purchaseTotal(suggestedItems);
  const accountsPayable = outstandingPurchases + suggestedTotal;
  const expectedCash = expectedShiftCash(shift);
  const counted = formNumber(countedCash || String(expectedCash));
  const difference = Math.round((counted - expectedCash) * 100) / 100;
  const netOperating = paidTotal - accountsPayable;
  const paymentRows = [
    { label: "Efectivo", amount: shift.cashSales, tone: styles.cashTone },
    { label: "Tarjeta", amount: shift.cardSales, tone: styles.cardTone },
    { label: "Transferencia", amount: shift.transferSales, tone: styles.transferTone },
  ];

  return (
    <div className={styles.commandPanel}>
      <section className={styles.commandHero}>
        <div>
          <span>Libro del turno</span>
          <strong>{currency(paidTotal)}</strong>
          <p>
            Ventas cobradas, ITBIS, 10% servicio, caja esperada, cuentas por pagar y auditoria de cierre.
          </p>
        </div>
        <div className={styles.commandHeroActions}>
          <button type="button" onClick={onExport}>
            <FileDown size={16} /> Exportar CSV
          </button>
          <button type="button" onClick={onClose} disabled={disabled || openTables.length > 0}>
            <Banknote size={16} /> Cerrar turno
          </button>
        </div>
      </section>

      <div className={styles.commandKpis}>
        <CommandKpi label="Caja abierta" value={currency(shift.cashOpen)} note="Ventas cobradas" tone="teal" />
        <CommandKpi label="ITBIS" value={currency(shift.taxTotal)} note="18% registrado" tone="amber" />
        <CommandKpi label="10% servicio" value={currency(shift.serviceChargeTotal)} note="Propina/servicio" tone="green" />
        <CommandKpi label="CXP" value={currency(accountsPayable)} note="Compras + sugeridas" tone={accountsPayable ? "amber" : "green"} />
      </div>

      <section className={styles.commandGrid}>
        <div className={styles.commandBlock}>
          <header>
            <span>Flujo de pagos</span>
            <strong>Metodos cobrados</strong>
          </header>
          <div className={styles.paymentRows}>
            {paymentRows.map((row) => (
              <div className={styles.paymentRow} key={row.label}>
                <div>
                  <strong>{row.label}</strong>
                  <span>{percent(row.amount, paidTotal)} del turno</span>
                </div>
                <div className={styles.paymentTrack}>
                  <i className={row.tone} style={{ width: percent(row.amount, paidTotal) }} />
                </div>
                <b>{currency(row.amount)}</b>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Mayor contable</span>
            <strong>Asientos del turno</strong>
          </header>
          <div className={styles.ledgerRows}>
            <LedgerRow label="Ventas cobradas" debit={currency(paidTotal)} credit="-" />
            <LedgerRow label="ITBIS por pagar" debit="-" credit={currency(shift.taxTotal)} />
            <LedgerRow label="10% servicio" debit="-" credit={currency(shift.serviceChargeTotal)} />
            <LedgerRow label="Cuentas por pagar" debit="-" credit={currency(accountsPayable)} />
            <LedgerRow label="Saldo mesas abiertas" debit={currency(openBalance)} credit="Pendiente" />
            <LedgerRow label="Resultado operativo" debit={currency(netOperating)} credit={netOperating >= 0 ? "Estimado" : "Revisar"} />
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Cuadre de caja</span>
            <strong>Control de cierre</strong>
          </header>
          <div className={styles.cashAudit}>
            <Line label="Efectivo esperado" value={currency(expectedCash)} />
            <Line label="Efectivo contado" value={currency(counted)} />
            <Line label="Diferencia" value={currency(difference)} strong />
            <label>
              Conteo real
              <input
                value={countedCash}
                onChange={(event) => onChangeClosure({ countedCash: event.target.value, notes })}
                inputMode="numeric"
              />
            </label>
            <label>
              Nota contable
              <textarea
                value={notes}
                onChange={(event) => onChangeClosure({ countedCash, notes: event.target.value })}
                rows={3}
              />
            </label>
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Auditoria</span>
            <strong>Riesgos antes de cerrar</strong>
          </header>
          <div className={styles.auditList}>
            <AuditItem
              title="Mesas abiertas"
              text={openTables.length ? `${openTables.map((table) => table.label).join(", ")} pendientes de cobro.` : "No hay mesas abiertas."}
              tone={openTables.length ? "amber" : "green"}
            />
            <AuditItem
              title="Compras pendientes"
              text={accountsPayable ? `${currency(accountsPayable)} pendiente o sugerido.` : "Sin cuentas por pagar pendientes."}
              tone={accountsPayable ? "amber" : "green"}
            />
            <AuditItem
              title="Diferencia de caja"
              text={difference ? `${currency(difference)} de diferencia contra esperado.` : "Caja balanceada contra esperado."}
              tone={difference ? "red" : "green"}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function ConfigurationCommandPanel({
  snapshot,
  printJobs,
  pendingPrintJobs,
  onSync,
  onRunAI,
  onMessage,
  disabled,
}: {
  snapshot: TurquesaSnapshot;
  printJobs: TurquesaPrintJob[];
  pendingPrintJobs: TurquesaPrintJob[];
  onSync: () => void;
  onRunAI: () => void;
  onMessage: (message: string) => void;
  disabled: boolean;
}) {
  const openModules = ["POS", "KDS", "Compras", "Contabilidad", "AI", "Auditoria", "Reservas", "Wi-Fi", "Reportes"];
  const onlineStations = TURQUESA_PRINTER_STATIONS.length - Math.min(1, pendingPrintJobs.length ? 0 : 0);
  const configRows = [
    { title: "Perfil restaurante", text: `${snapshot.restaurant.name} / ${snapshot.restaurant.location}`, value: "Activo" },
    { title: "Moneda y fiscalidad", text: "DOP, ITBIS 18%, servicio legal 10%", value: "RD" },
    { title: "Operacion de turno", text: `${snapshot.shift.label}, caja inicial ${currency(snapshot.shift.openingCash)}`, value: snapshot.shift.status === "open" ? "Abierto" : "Cerrado" },
    { title: "Impresion por estacion", text: `${printJobs.length} trabajos generados / ${pendingPrintJobs.length} pendientes`, value: `${onlineStations}/${TURQUESA_PRINTER_STATIONS.length}` },
  ];

  return (
    <div className={styles.commandPanel}>
      <section className={`${styles.commandHero} ${styles.premiumHero}`}>
        <div>
          <span>Centro de configuracion</span>
          <strong>Turquesa Premium OS</strong>
          <p>
            Parametros maestros del restaurante: fiscalidad, estaciones, AI, impresoras, permisos, datos Wi-Fi y cierre protegido.
          </p>
        </div>
        <div className={styles.commandHeroActions}>
          <button type="button" onClick={onSync} disabled={disabled}>
            <RefreshCw size={16} /> Sincronizar
          </button>
          <button type="button" onClick={onRunAI} disabled={disabled}>
            <Brain size={16} /> Validar con AI
          </button>
          <button type="button" onClick={() => onMessage("Configuracion premium validada para Turquesa.")}>
            <SlidersHorizontal size={16} /> Reglas maestras
          </button>
        </div>
      </section>

      <div className={styles.commandKpis}>
        <CommandKpi label="Modulos" value={`${openModules.length}/9`} note="Suite completa activa" tone="teal" />
        <CommandKpi label="Fiscal" value="18% + 10%" note="ITBIS y servicio" tone="green" />
        <CommandKpi label="Impresoras" value={`${onlineStations}/3`} note="Cocina, bar, despacho" tone="teal" />
        <CommandKpi label="Seguridad" value="Alta" note="PIN, roles y auditoria" tone="amber" />
      </div>

      <section className={styles.commandGrid}>
        <div className={styles.commandBlock}>
          <header>
            <span>Ajustes maestros</span>
            <strong>Operacion base</strong>
          </header>
          <div className={styles.commandRows}>
            {configRows.map((row) => (
              <div className={styles.commandRow} key={row.title}>
                <div>
                  <strong>{row.title}</strong>
                  <span>{row.text}</span>
                </div>
                <b>{row.value}</b>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Suite activa</span>
            <strong>Modulos premium</strong>
          </header>
          <div className={styles.moduleMatrix}>
            {openModules.map((module) => (
              <span key={module}>
                <CheckCircle2 size={14} /> {module}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Integraciones</span>
            <strong>Servicios conectados</strong>
          </header>
          <div className={styles.auditList}>
            <AuditItem title="Supabase individual" text="Base del restaurante separada del sistema de fabrica; lista para aplicar SQL." tone="teal" />
            <AuditItem title="Omada Wi-Fi portal" text="Clientes capturados desde el acceso cautivo para CRM autorizado." tone="green" />
            <AuditItem title="OpenAI supervisado" text="AI recomienda acciones, pero compras, anulaciones y cierres requieren humano." tone="amber" />
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Reglas criticas</span>
            <strong>Guardrails</strong>
          </header>
          <div className={styles.premiumChecklist}>
            <label><input type="checkbox" checked readOnly /> No cerrar turno con mesas abiertas</label>
            <label><input type="checkbox" checked readOnly /> Cambios fiscales solo gerente/admin</label>
            <label><input type="checkbox" checked readOnly /> Toda compra queda en auditoria</label>
            <label><input type="checkbox" checked readOnly /> AI sin permisos para ejecutar sola</label>
          </div>
        </div>
      </section>
    </div>
  );
}

function UsersCommandPanel({ snapshot, onMessage }: { snapshot: TurquesaSnapshot; onMessage: (message: string) => void }) {
  const staff = [
    { name: "Alberto Garcia", email: "admin@turquesarestaurante.com", role: "Administrador", area: "Gerencia", status: "Activo", access: "Completo" },
    { name: "Rafael Mendez", email: "rafael@turquesarestaurante.com", role: "Capitan salon", area: "POS / Reservas", status: "Activo", access: "Operacion" },
    { name: "Mia Rodriguez", email: "mia@turquesarestaurante.com", role: "Cajera", area: "Caja", status: "Activo", access: "Caja + cierre" },
    { name: "Cocina Caliente", email: "kds@turquesarestaurante.com", role: "KDS", area: "Cocina", status: "Dispositivo", access: "Preparacion" },
  ];
  const permissionRows = [
    { role: "Administrador", modules: "Todos los modulos, fiscal, usuarios, auditoria" },
    { role: "Gerencia", modules: "Reportes, compras, contabilidad, AI supervisada" },
    { role: "Caja", modules: "POS, pagos, cierre con PIN, recibos" },
    { role: "Cocina / Bar", modules: "KDS, impresoras, tiempos y estados" },
  ];

  return (
    <div className={styles.commandPanel}>
      <section className={`${styles.commandHero} ${styles.peopleHero}`}>
        <div>
          <span>Identidad y permisos</span>
          <strong>{staff.length} usuarios operativos</strong>
          <p>
            Roles separados para salon, caja, cocina, gerencia y dispositivos. Cada accion sensible queda ligada a un usuario.
          </p>
        </div>
        <div className={styles.commandHeroActions}>
          <button type="button" onClick={() => onMessage("Invitacion de usuario preparada para Turquesa.")}>
            <UserRound size={16} /> Invitar usuario
          </button>
          <button type="button" onClick={() => onMessage("Revision de permisos marcada para gerencia.")}>
            <KeyRound size={16} /> Revisar permisos
          </button>
        </div>
      </section>

      <div className={styles.commandKpis}>
        <CommandKpi label="Usuarios" value={String(staff.length)} note="Activos y dispositivos" tone="teal" />
        <CommandKpi label="Roles" value="4" note="RBAC restaurante" tone="green" />
        <CommandKpi label="PIN" value="Obligatorio" note="Caja y cierre" tone="amber" />
        <CommandKpi label="Sesion" value="Auditada" note={snapshot.shift.label} tone="teal" />
      </div>

      <section className={styles.commandGrid}>
        <div className={styles.commandBlock}>
          <header>
            <span>Directorio</span>
            <strong>Equipo autorizado</strong>
          </header>
          <div className={styles.userRows}>
            {staff.map((person) => (
              <article className={styles.userRow} key={person.email}>
                <div className={styles.avatarMark}>{person.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{person.name}</strong>
                  <span>{person.email}</span>
                </div>
                <b>{person.role}</b>
                <small>{person.status}</small>
              </article>
            ))}
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Permisos</span>
            <strong>Matriz por rol</strong>
          </header>
          <div className={styles.commandRows}>
            {permissionRows.map((row) => (
              <div className={styles.commandRow} key={row.role}>
                <div>
                  <strong>{row.role}</strong>
                  <span>{row.modules}</span>
                </div>
                <b>Activo</b>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Seguridad</span>
            <strong>Politicas de acceso</strong>
          </header>
          <div className={styles.auditList}>
            <AuditItem title="PIN en caja" text="Cobros, anulaciones, descuentos y cierre exigen PIN o gerente." tone="amber" />
            <AuditItem title="Dispositivos KDS" text="Cocina y bar no acceden a contabilidad ni usuarios." tone="green" />
            <AuditItem title="Sesiones locales" text="Bloqueo por inactividad y rastro por dispositivo." tone="teal" />
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Acceso por area</span>
            <strong>Scopes</strong>
          </header>
          <div className={styles.moduleMatrix}>
            {["Salon", "Caja", "Cocina", "Bar", "Compras", "Gerencia", "Auditoria", "AI"].map((scope) => (
              <span key={scope}>
                <LockKeyhole size={14} /> {scope}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function AuditCommandPanel({
  snapshot,
  tables,
  inventory,
  purchaseRequests,
  printJobs,
  aiResult,
  onExport,
  onRunAI,
  disabled,
}: {
  snapshot: TurquesaSnapshot;
  tables: TurquesaTable[];
  inventory: TurquesaInventoryItem[];
  purchaseRequests: TurquesaPurchaseRequest[];
  printJobs: TurquesaPrintJob[];
  aiResult: TurquesaAIResult | null;
  onExport: () => void;
  onRunAI: () => void;
  disabled: boolean;
}) {
  const activeTables = tables.filter((table) => table.status === "open" || table.status === "attention");
  const riskyInventory = inventory.filter((item) => item.trend === "critico" || item.trend === "bajo");
  const openPurchases = purchaseRequests.filter((request) => request.status !== "received" && request.status !== "cancelled");
  const events = [
    { title: "Apertura de turno", detail: `${snapshot.shift.label} iniciado con fondo ${currency(snapshot.shift.openingCash)}.`, tone: "green" as const, at: "18:00" },
    { title: "Mesa en seguimiento", detail: activeTables[0] ? `${activeTables[0].label} lleva ${activeTables[0].minutes} min con balance ${currency(activeTables[0].total)}.` : "Salon sin mesas bloqueantes.", tone: activeTables.length ? "amber" as const : "green" as const, at: "Ahora" },
    { title: "Inventario sensible", detail: riskyInventory[0] ? `${riskyInventory[0].item} requiere reposicion.` : "Inventario sin riesgo critico.", tone: riskyInventory.length ? "red" as const : "green" as const, at: "KDS" },
    { title: "AI supervisada", detail: aiResult ? `${aiRiskLabel(aiResult.riskLevel)} / ${aiResult.recommendations.length} recomendaciones.` : "AI lista para analisis operativo.", tone: aiResult?.riskLevel === "critico" ? "red" as const : "teal" as const, at: "AI" },
  ];

  return (
    <div className={styles.commandPanel}>
      <section className={`${styles.commandHero} ${styles.auditHero}`}>
        <div>
          <span>Rastro operacional</span>
          <strong>{events.length + printJobs.length} eventos controlados</strong>
          <p>
            Auditoria central para caja, usuarios, compras, impresoras, AI y cambios sensibles del restaurante.
          </p>
        </div>
        <div className={styles.commandHeroActions}>
          <button type="button" onClick={onExport}>
            <FileDown size={16} /> Exportar rastro
          </button>
          <button type="button" onClick={onRunAI} disabled={disabled}>
            <Activity size={16} /> Analizar riesgos
          </button>
        </div>
      </section>

      <div className={styles.commandKpis}>
        <CommandKpi label="Eventos" value={String(events.length + printJobs.length)} note="Turno actual" tone="teal" />
        <CommandKpi label="Mesas" value={String(activeTables.length)} note="Abiertas/atencion" tone={activeTables.length ? "amber" : "green"} />
        <CommandKpi label="Compras" value={String(openPurchases.length)} note="Pendientes" tone={openPurchases.length ? "amber" : "green"} />
        <CommandKpi label="Riesgo" value={aiRiskLabel(aiResult?.riskLevel)} note="AI + reglas" tone={aiResult?.riskLevel === "critico" ? "red" : "teal"} />
      </div>

      <section className={styles.commandGrid}>
        <div className={styles.commandBlock}>
          <header>
            <span>Timeline</span>
            <strong>Eventos recientes</strong>
          </header>
          <div className={styles.auditTimeline}>
            {events.map((event) => (
              <article className={`${styles.timelineItem} ${styles[`timelineItem_${event.tone}`]}`} key={event.title}>
                <span>{event.at}</span>
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Controles</span>
            <strong>Puntos auditables</strong>
          </header>
          <div className={styles.auditList}>
            <AuditItem title="Cierre de caja" text="Bloqueado si existen mesas abiertas, diferencia de caja o PIN ausente." tone={activeTables.length ? "amber" : "green"} />
            <AuditItem title="Compras e inventario" text="Cada recepcion actualiza costo, stock, proveedor y rastro de usuario." tone={openPurchases.length ? "amber" : "teal"} />
            <AuditItem title="Impresoras" text={`${printJobs.length} documentos pueden reconciliar cocina, bar y despacho.`} tone="teal" />
            <AuditItem title="Privacidad Wi-Fi" text="Datos de clientes solo para CRM autorizado y promociones permitidas." tone="green" />
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Base de datos</span>
            <strong>Tablas criticas</strong>
          </header>
          <div className={styles.moduleMatrix}>
            {["orders", "payments", "inventory", "purchase_requests", "ai_events", "users", "settings", "audit_log"].map((table) => (
              <span key={table}>
                <Database size={14} /> turquesa_{table}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.commandBlock}>
          <header>
            <span>Retencion</span>
            <strong>Politica premium</strong>
          </header>
          <div className={styles.premiumChecklist}>
            <label><input type="checkbox" checked readOnly /> 24 meses de auditoria operativa</label>
            <label><input type="checkbox" checked readOnly /> Eventos AI ligados a decision humana</label>
            <label><input type="checkbox" checked readOnly /> Exportacion CSV para gerencia</label>
            <label><input type="checkbox" checked readOnly /> Alertas por cambios de permisos</label>
          </div>
        </div>
      </section>
    </div>
  );
}

function CommandKpi({ label, value, note, tone }: { label: string; value: string; note: string; tone: "teal" | "green" | "amber" | "red" }) {
  return (
    <article className={`${styles.commandKpi} ${styles[`commandKpi_${tone}`]}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function LedgerRow({ label, debit, credit }: { label: string; debit: string; credit: string }) {
  return (
    <div className={styles.ledgerRow}>
      <span>{label}</span>
      <strong>{debit}</strong>
      <b>{credit}</b>
    </div>
  );
}

function AuditItem({ title, text, tone }: { title: string; text: string; tone: "teal" | "green" | "amber" | "red" }) {
  return (
    <article className={`${styles.auditItem} ${styles[`auditItem_${tone}`]}`}>
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

function PurchaseRequestPanel({
  suggestedItems,
  purchaseRequests,
  onCreate,
  onReceive,
  disabled,
}: {
  suggestedItems: TurquesaPurchaseRequestItem[];
  purchaseRequests: TurquesaPurchaseRequest[];
  onCreate: () => void;
  onReceive: (request: TurquesaPurchaseRequest) => void;
  disabled: boolean;
}) {
  const total = purchaseTotal(suggestedItems);
  const latest = purchaseRequests[0];
  const receivable = purchaseRequests.find((request) => request.status !== "received" && request.status !== "cancelled");

  return (
    <div className={styles.purchasePanel}>
      <div className={styles.purchaseHero}>
        <span>Compra recomendada</span>
        <strong>{currency(total)}</strong>
        <p>{suggestedItems.length ? "Basada en inventario critico y reposicion minima." : "Inventario estable para el turno."}</p>
      </div>

      <div className={styles.purchaseRows}>
        {suggestedItems.length ? (
          suggestedItems.map((item) => (
            <div className={styles.purchaseRow} key={item.item}>
              <div>
                <strong>{item.item}</strong>
                <span>
                  {item.qty} {item.unit} / {item.supplier}
                </span>
              </div>
              <b>{currency(item.estimatedCost)}</b>
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>No hay compras urgentes.</div>
        )}
      </div>

      <button type="button" className={styles.closeButton} onClick={onCreate} disabled={disabled || !suggestedItems.length}>
        Generar compra
      </button>

      {latest ? (
        <div className={styles.latestPurchase}>
          <span>Ultima solicitud</span>
          <strong>
            {latest.code} / {purchaseStatusLabel(latest.status)} / {latest.priority === "urgent" ? "Urgente" : "Normal"}
          </strong>
          <p>
            {latest.items.length} item(s) / {currency(latest.total)}
          </p>
          {receivable ? (
            <button type="button" className={styles.closeButton} onClick={() => onReceive(receivable)} disabled={disabled}>
              Recibir compra
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RecipeManagerPanel({
  menuItems,
  recipeIngredients,
  selectedMenu,
  onSelectMenu,
  onAdjust,
  disabled,
}: {
  menuItems: TurquesaMenuItem[];
  recipeIngredients: TurquesaRecipeIngredient[];
  selectedMenu: string;
  onSelectMenu: (menuItem: string) => void;
  onAdjust: (recipe: TurquesaRecipeIngredient, delta: number) => void;
  disabled: boolean;
}) {
  const recipeMenus = menuItems
    .map((item) => item.name)
    .filter((name) => recipeIngredients.some((ingredient) => ingredient.menuItem === name));
  const activeMenu = selectedMenu || recipeMenus[0] || "";
  const selectedRecipes = recipeIngredients.filter((ingredient) => ingredient.menuItem === activeMenu);
  const activeMenuItem = menuItems.find((item) => item.name === activeMenu);

  return (
    <div className={styles.recipePanel}>
      <div className={styles.recipeTabs}>
        {recipeMenus.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onSelectMenu(name)}
            className={activeMenu === name ? styles.recipeTabActive : ""}
          >
            {name}
          </button>
        ))}
      </div>

      {activeMenu ? (
        <div className={styles.recipeHero}>
          <span>{activeMenuItem?.station || "Receta"}</span>
          <strong>{activeMenu}</strong>
          <p>{selectedRecipes.length} insumo(s) enlazados</p>
        </div>
      ) : (
        <div className={styles.emptyState}>No hay recetas enlazadas.</div>
      )}

      <div className={styles.recipeRows}>
        {selectedRecipes.map((recipe) => {
          const step = recipeStep(recipe.unit);
          return (
            <div className={styles.recipeRow} key={recipe.id}>
              <div>
                <strong>{recipe.ingredient}</strong>
                <span>{recipe.note || "Consumo por plato"}</span>
              </div>
              <div className={styles.recipeQty}>
                <button type="button" onClick={() => onAdjust(recipe, -step)} disabled={disabled} aria-label={`Bajar ${recipe.ingredient}`}>
                  <Minus size={13} />
                </button>
                <b>
                  {formatQty(recipe.qty)} {recipe.unit}
                </b>
                <button type="button" onClick={() => onAdjust(recipe, step)} disabled={disabled} aria-label={`Subir ${recipe.ingredient}`}>
                  <Plus size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SupplierCostPanel({
  inventory,
  onAdjustCost,
  disabled,
}: {
  inventory: TurquesaInventoryItem[];
  onAdjustCost: (item: TurquesaInventoryItem, delta: number) => void;
  disabled: boolean;
}) {
  const trackedCost = inventory.reduce((sum, item) => sum + item.onHand * item.avgCost, 0);

  return (
    <div className={styles.supplierPanel}>
      <div className={styles.supplierHero}>
        <span>Costo inventario</span>
        <strong>{currency(trackedCost)}</strong>
        <p>{inventory.length} insumo(s) con proveedor asignado.</p>
      </div>

      <div className={styles.supplierRows}>
        {inventory.map((item) => {
          const step = item.unit === "bot" ? 25 : 10;
          return (
            <div className={styles.supplierRow} key={item.item}>
              <div>
                <strong>{item.item}</strong>
                <span>{item.supplier || "Proveedor por definir"}</span>
              </div>
              <div className={styles.supplierCost}>
                <button type="button" onClick={() => onAdjustCost(item, -step)} disabled={disabled || item.avgCost <= 0} aria-label={`Bajar costo ${item.item}`}>
                  <Minus size={13} />
                </button>
                <b>
                  {currency(item.avgCost)}
                  <small>/{item.unit}</small>
                </b>
                <button type="button" onClick={() => onAdjustCost(item, step)} disabled={disabled} aria-label={`Subir costo ${item.item}`}>
                  <Plus size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrinterControlPanel({
  jobs,
  printLog,
  onPrintJob,
  onPrintPending,
}: {
  jobs: TurquesaPrintJob[];
  printLog: TurquesaPrintLogEntry[];
  onPrintJob: (job: TurquesaPrintJob) => void;
  onPrintPending: (station?: TurquesaPrinterStationKey) => void;
}) {
  const printedJobIds = new Set(printLog.map((entry) => entry.jobId));
  const pendingJobs = jobs.filter((job) => !printedJobIds.has(job.id));
  const latestPrint = printLog[0];

  return (
    <div className={styles.printerPanel}>
      <div className={styles.printerHero}>
        <span>Cola de impresion</span>
        <strong>{pendingJobs.length} pendientes</strong>
        <p>
          {latestPrint
            ? `Ultimo envio: ${formatShortDateTime(latestPrint.printedAt)}.`
            : "Aun no se ha enviado ningun ticket en este turno."}
        </p>
      </div>

      <button type="button" className={styles.closeButton} onClick={() => onPrintPending()} disabled={!pendingJobs.length}>
        <Printer size={16} /> Imprimir pendientes
      </button>

      <div className={styles.printerStations}>
        {TURQUESA_PRINTER_STATIONS.map((station) => {
          const stationJobs = jobs.filter((job) => job.stationKey === station.key);
          const stationPending = stationJobs.filter((job) => !printedJobIds.has(job.id));
          return (
            <article
              className={`${styles.printerStation} ${
                station.status === "ready" ? styles.printerStationReady : styles.printerStationPending
              }`}
              key={station.key}
            >
              <div>
                <span>{station.role}</span>
                <strong>{station.name}</strong>
                <p>{station.routing}</p>
              </div>
              <b>{stationPending.length} pendientes</b>
              <small>{station.printerName}</small>
              <button type="button" onClick={() => onPrintPending(station.key)} disabled={!stationPending.length}>
                Imprimir {station.shortName}
              </button>
            </article>
          );
        })}
      </div>

      <div className={styles.printQueue}>
        {jobs.length ? (
          jobs.map((job) => {
            const log = printLog.find((entry) => entry.jobId === job.id);
            return (
              <article className={styles.printJob} key={job.id}>
                <div className={styles.printJobMeta}>
                  <span>{job.stationName}</span>
                  <strong>
                    {job.ticketId} / {job.table}
                  </strong>
                  <p>{job.items.join(", ")}</p>
                  <small>{job.printerName}</small>
                </div>
                <div className={styles.printJobActions}>
                  <b className={log ? styles.printJobSent : styles.printJobPending}>
                    {log ? `Enviado ${formatShortTime(log.printedAt)}` : "Pendiente"}
                  </b>
                  <button type="button" onClick={() => onPrintJob(job)}>
                    {log ? "Reimprimir" : "Imprimir"}
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <div className={styles.emptyState}>Sin tickets KDS para imprimir.</div>
        )}
      </div>
    </div>
  );
}

function diagnosticIcon(area: TurquesaAIDiagnostic["area"]) {
  if (area === "cocina") return <ChefHat size={18} />;
  if (area === "caja") return <CreditCard size={18} />;
  if (area === "inventario") return <Package size={18} />;
  if (area === "reservas") return <CalendarClock size={18} />;
  if (area === "wifi") return <Wifi size={18} />;
  return <Printer size={18} />;
}

function diagnosticLabel(area: string) {
  if (area === "cocina") return "Cocina";
  if (area === "caja") return "Caja";
  if (area === "inventario") return "Inventario";
  if (area === "reservas") return "Reservas";
  if (area === "wifi") return "Wi-Fi";
  if (area === "impresoras") return "Impresoras";
  return area;
}

function decisionRiskLabel(risk: TurquesaAIDecision["risk"]) {
  if (risk === "critical") return "Critica";
  if (risk === "high") return "Alta";
  if (risk === "medium") return "Media";
  return "Baja";
}

function buildClientDiagnostics({
  tables,
  tickets,
  reservations,
  inventory,
  wifiLeads,
  pendingPrintJobs,
}: {
  tables: TurquesaTable[];
  tickets: TurquesaKitchenTicket[];
  reservations: TurquesaReservation[];
  inventory: TurquesaInventoryItem[];
  wifiLeads: TurquesaWifiLead[];
  pendingPrintJobs: TurquesaPrintJob[];
}): TurquesaAIDiagnostic[] {
  const activeTables = tables.filter((table) => table.status === "open" || table.status === "attention");
  const attentionTables = tables.filter((table) => table.status === "attention");
  const readyTickets = tickets.filter((ticket) => ticket.status === "ready");
  const critical = inventory.filter((item) => item.trend === "critico");
  const low = inventory.filter((item) => item.trend === "bajo");

  return [
    {
      area: "cocina",
      status: readyTickets.length ? "watch" : "ok",
      score: Math.min(100, 28 + tickets.length * 9 + readyTickets.length * 18),
      metric: `${tickets.length} tickets`,
      finding: readyTickets.length ? `${readyTickets.length} ticket(s) listos para servir.` : "KDS sin acumulacion critica.",
      action: readyTickets[0] ? `Servir ${readyTickets[0].id} primero.` : "Mantener cocina visible.",
    },
    {
      area: "caja",
      status: attentionTables.length ? "watch" : "ok",
      score: Math.min(100, 30 + activeTables.length * 8 + attentionTables.length * 18),
      metric: `${activeTables.length} mesas activas`,
      finding: attentionTables.length ? `${attentionTables.map((table) => table.label).join(", ")} requiere seguimiento.` : "Caja sin bloqueo de cierre.",
      action: attentionTables.length ? "Enviar encargado y preparar cobro." : "Cuadrar antes de cerrar turno.",
    },
    {
      area: "inventario",
      status: critical.length ? "urgent" : low.length ? "watch" : "ok",
      score: Math.min(100, 22 + critical.length * 34 + low.length * 14),
      metric: `${critical.length} criticos`,
      finding: critical.length ? `${critical.map((item) => item.item).join(", ")} bajo minimo.` : "Inventario operativo.",
      action: critical.length ? "Crear compra supervisada." : "Revisar consumo al cierre.",
    },
    {
      area: "reservas",
      status: reservations.length >= 3 ? "watch" : "ok",
      score: Math.min(100, 24 + reservations.length * 11),
      metric: `${reservations.length} reservas`,
      finding: reservations[0] ? `Proxima ${reservations[0].time}: ${reservations[0].name}.` : "Sin reservas inmediatas.",
      action: "Preasignar salon y tiempos de cocina.",
    },
    {
      area: "wifi",
      status: wifiLeads.length ? "ok" : "watch",
      score: Math.min(100, 20 + wifiLeads.length * 13),
      metric: `${wifiLeads.length} leads`,
      finding: wifiLeads.length ? "Portal Wi-Fi captando clientes." : "Portal sin capturas recientes.",
      action: "Pasar leads a CRM o promocion.",
    },
    {
      area: "impresoras",
      status: pendingPrintJobs.length ? "watch" : "ok",
      score: Math.min(100, 34 + pendingPrintJobs.length * 14),
      metric: `${pendingPrintJobs.length} pendientes`,
      finding: pendingPrintJobs.length ? "Hay comandas pendientes de impresion." : "Cola de impresion al dia.",
      action: pendingPrintJobs.length ? "Imprimir pendientes por estacion." : "Mantener despacho listo.",
    },
  ];
}

function buildClientDecisions(
  diagnostics: TurquesaAIDiagnostic[],
  tables: TurquesaTable[],
  pendingPrintJobs: TurquesaPrintJob[]
): TurquesaAIDecision[] {
  const urgent = diagnostics.find((item) => item.status === "urgent");
  const watch = diagnostics.find((item) => item.status === "watch");
  const openTables = tables.filter((table) => table.status === "open" || table.status === "attention");

  return [
    ...(urgent
      ? [
          {
            id: `turq_dec_${urgent.area}`,
            area: urgent.area,
            title: `Aprobar accion de ${diagnosticLabel(urgent.area)}`,
            summary: urgent.action,
            risk: "high" as const,
            status: "draft" as const,
            actionLabel: "Preparar aprobacion",
          },
        ]
      : []),
    ...(watch
      ? [
          {
            id: `turq_watch_${watch.area}`,
            area: watch.area,
            title: `Seguimiento ${diagnosticLabel(watch.area)}`,
            summary: watch.finding,
            risk: "medium" as const,
            status: "draft" as const,
            actionLabel: "Asignar responsable",
          },
        ]
      : []),
    {
      id: "turq_print_decision",
      area: "impresoras" as const,
      title: "Despacho por estaciones",
      summary: pendingPrintJobs.length
        ? `${pendingPrintJobs.length} ticket(s) pendientes entre cocina, bar y despacho.`
        : "Impresion de estaciones sin pendientes.",
      risk: pendingPrintJobs.length ? "medium" as const : "low" as const,
      status: "draft" as const,
      actionLabel: pendingPrintJobs.length ? "Imprimir ahora" : "Ver impresoras",
    },
    {
      id: "turq_close_decision",
      area: "caja" as const,
      title: "Cierre protegido",
      summary: openTables.length ? `${openTables.length} mesa(s) activas antes del cierre.` : "Turno listo para cuadre final.",
      risk: openTables.length ? "medium" as const : "low" as const,
      status: "draft" as const,
      actionLabel: openTables.length ? "Revisar mesas" : "Preparar cierre",
    },
  ].slice(0, 4);
}

function buildClientEvents(diagnostics: TurquesaAIDiagnostic[], tickets: TurquesaKitchenTicket[], inventory: TurquesaInventoryItem[]): TurquesaAIEvent[] {
  const now = new Date().toISOString();
  const ready = tickets.filter((ticket) => ticket.status === "ready");
  const critical = inventory.filter((item) => item.trend === "critico");

  return [
    ...critical.slice(0, 2).map((item, index) => ({
      id: `client_stock_${index}`,
      area: "inventario",
      title: `Stock critico: ${item.item}`,
      summary: `${item.onHand} ${item.unit} disponible; minimo ${item.min}.`,
      severity: "critical" as const,
      riskScore: 88,
      createdAt: now,
    })),
    ...ready.slice(0, 2).map((ticket, index) => ({
      id: `client_ready_${index}`,
      area: ticket.station,
      title: `KDS listo: ${ticket.id}`,
      summary: `${ticket.table}: ${ticket.items.join(", ")}.`,
      severity: "warning" as const,
      riskScore: 61,
      createdAt: now,
    })),
    ...diagnostics.slice(0, 4).map((item, index) => ({
      id: `client_diag_${index}`,
      area: item.area,
      title: `${diagnosticLabel(item.area)} ${item.status === "ok" ? "estable" : "en seguimiento"}`,
      summary: item.finding,
      severity: item.status === "urgent" ? "danger" as const : item.status === "watch" ? "warning" as const : "success" as const,
      riskScore: item.score,
      createdAt: now,
    })),
  ].slice(0, 8);
}

function TurquesaAIPanel({
  ai,
  loading,
  tables,
  tickets,
  reservations,
  inventory,
  wifiLeads,
  printJobs,
  pendingPrintJobs,
  messages,
  prompt,
  onPromptChange,
  onAnalyze,
  onAsk,
  onSetView,
  onCreatePurchaseRequest,
  onPrintPending,
}: {
  ai: TurquesaAIResult | null;
  loading: boolean;
  snapshot: TurquesaSnapshot;
  tables: TurquesaTable[];
  tickets: TurquesaKitchenTicket[];
  reservations: TurquesaReservation[];
  inventory: TurquesaInventoryItem[];
  wifiLeads: TurquesaWifiLead[];
  printJobs: TurquesaPrintJob[];
  pendingPrintJobs: TurquesaPrintJob[];
  messages: TurquesaAIChatMessage[];
  prompt: string;
  onPromptChange: (value: string) => void;
  onAnalyze: () => void;
  onAsk: (question: string) => void;
  onSetView: (view: ViewKey) => void;
  onCreatePurchaseRequest: () => void;
  onPrintPending: () => void;
}) {
  const fallbackDiagnostics = buildClientDiagnostics({ tables, tickets, reservations, inventory, wifiLeads, pendingPrintJobs });
  const diagnostics = ai?.diagnostics?.length ? ai.diagnostics : fallbackDiagnostics;
  const decisions = ai?.decisions?.length ? ai.decisions : buildClientDecisions(diagnostics, tables, pendingPrintJobs);
  const events = ai?.events?.length ? ai.events : buildClientEvents(diagnostics, tickets, inventory);
  const guardrails = ai?.guardrails?.length
    ? ai.guardrails
    : [
        "Compras, descuentos, anulaciones y cierre requieren aprobacion humana.",
        "La AI recomienda; gerencia ejecuta y queda responsable.",
        "Datos Wi-Fi solo para CRM autorizado.",
      ];
  const recommendations = ai?.recommendations || [];
  const watchlist = ai?.watchlist || [];
  const nextActions = ai?.nextActions || [];
  const riskScore = ai?.riskScore ?? Math.round(diagnostics.reduce((sum, item) => sum + item.score, 0) / Math.max(1, diagnostics.length));
  const riskLevel = ai?.riskLevel || (riskScore >= 75 ? "critico" : riskScore >= 45 ? "atencion" : "normal");
  const quickPrompts = [
    "Analiza cocina, bar e impresoras ahora",
    "Que debo aprobar antes de cerrar?",
    "Prioriza compras por riesgo y costo",
    "Resume el turno para gerencia",
  ];

  function runDecision(decision: TurquesaAIDecision) {
    if (decision.area === "compras" || decision.area === "inventario") {
      onCreatePurchaseRequest();
      return;
    }
    if (decision.area === "cocina") {
      onSetView("cocina");
      return;
    }
    if (decision.area === "impresoras") {
      if (pendingPrintJobs.length) onPrintPending();
      else onSetView("impresoras");
      return;
    }
    if (decision.area === "reservas") {
      onSetView("reservas");
      return;
    }
    if (decision.area === "caja") {
      onSetView("cierre");
      return;
    }
    onAsk(`Prepara decision supervisada para gerencia: ${decision.title}`);
  }

  return (
    <div className={styles.aiPanel}>
      <section className={`${styles.aiCommandHero} ${styles[`aiRisk_${riskLevel}`]}`}>
        <div className={styles.aiHeroCopy}>
          <span>
            <Cpu size={15} /> Turquesa AI Copilot
          </span>
          <strong>{ai ? aiRiskLabel(ai.riskLevel) : "Centro inteligente listo"}</strong>
          <p>{ai?.summary || "Analiza el turno completo con cocina, caja, inventario, reservas, Wi-Fi, impresoras y decisiones supervisadas."}</p>
          <div className={styles.aiHeroActions}>
            <button type="button" onClick={onAnalyze} disabled={loading}>
              <Radar size={16} /> {loading ? "Analizando" : "Analizar turno"}
            </button>
            <button type="button" onClick={() => onAsk("Detecta riesgos y prepara decisiones supervisadas para este turno")} disabled={loading}>
              <ShieldCheck size={16} /> Decisiones
            </button>
          </div>
        </div>
        <div className={styles.aiRiskCard}>
          <div className={styles.aiRiskRing} style={{ "--risk": `${riskScore * 3.6}deg` } as React.CSSProperties}>
            <span>{riskScore}</span>
            <small>riesgo</small>
          </div>
          <b>{aiProviderLabel(ai)}</b>
          <small>Guardrails activos / acciones supervisadas</small>
        </div>
      </section>

      <section className={styles.aiCommandGrid}>
        <div className={styles.aiCommandMain}>
          <div className={styles.aiSectionHeader}>
            <div>
              <span>Diagnostico operacional</span>
              <strong>Lectura AI por areas</strong>
            </div>
            <b>{diagnostics.length} frentes</b>
          </div>

          <div className={styles.aiDiagnosticsGrid}>
            {diagnostics.map((item) => (
              <article className={`${styles.aiDiagnosticCard} ${styles[`aiStatus_${item.status}`]}`} key={item.area}>
                <div>
                  <i>{diagnosticIcon(item.area)}</i>
                  <span>{diagnosticLabel(item.area)}</span>
                </div>
                <strong>{item.metric}</strong>
                <p>{item.finding}</p>
                <b>{item.action}</b>
              </article>
            ))}
          </div>

          <div className={styles.aiTwoColumns}>
            <section className={styles.aiBlock}>
              <div className={styles.aiSectionHeader}>
                <div>
                  <span>Recomendaciones</span>
                  <strong>Prioridades del turno</strong>
                </div>
              </div>
              <div className={styles.aiRecommendations}>
                {recommendations.length ? (
                  recommendations.map((item) => (
                    <article className={`${styles.aiRecommendation} ${styles[`aiPriority_${item.priority}`]}`} key={`${item.area}-${item.title}`}>
                      <span>{item.area}</span>
                      <strong>{item.title}</strong>
                      <p>{item.text}</p>
                      <b>{item.action}</b>
                    </article>
                  ))
                ) : (
                  <div className={styles.emptyState}>Pulsa Analizar turno para generar recomendaciones AI.</div>
                )}
              </div>
            </section>

            <section className={styles.aiBlock}>
              <div className={styles.aiSectionHeader}>
                <div>
                  <span>Vigilancia</span>
                  <strong>Watchlist y proximos pasos</strong>
                </div>
              </div>
              <div className={styles.aiListBlock}>
                {(watchlist.length ? watchlist : diagnostics.filter((item) => item.status !== "ok").map((item) => item.finding)).slice(0, 6).map((item) => (
                  <span key={item}><AlertTriangle size={14} /> {item}</span>
                ))}
              </div>
              <div className={styles.aiListBlock}>
                {(nextActions.length ? nextActions : diagnostics.slice(0, 3).map((item) => item.action)).slice(0, 5).map((item) => (
                  <span key={item}><CheckCircle2 size={14} /> {item}</span>
                ))}
              </div>
            </section>
          </div>
        </div>

        <aside className={styles.aiCommandSide}>
          <section className={styles.aiBlock}>
            <div className={styles.aiSectionHeader}>
              <div>
                <span>Acciones</span>
                <strong>Decisiones supervisadas</strong>
              </div>
              <b>{decisions.length}</b>
            </div>
            <div className={styles.aiDecisionList}>
              {decisions.map((decision) => (
                <article className={`${styles.aiDecision} ${styles[`aiDecision_${decision.risk}`]}`} key={decision.id}>
                  <div>
                    <span>{decision.area}</span>
                    <b>{decisionRiskLabel(decision.risk)}</b>
                  </div>
                  <strong>{decision.title}</strong>
                  <p>{decision.summary}</p>
                  <button type="button" onClick={() => runDecision(decision)}>
                    {decision.actionLabel} <ArrowRight size={14} />
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.aiBlock}>
            <div className={styles.aiSectionHeader}>
              <div>
                <span>Eventos AI</span>
                <strong>Monitor vivo</strong>
              </div>
              <b>{events.length}</b>
            </div>
            <div className={styles.aiEventList}>
              {events.map((event) => (
                <article className={`${styles.aiEvent} ${styles[`aiEvent_${event.severity}`]}`} key={event.id}>
                  <span>{event.area}</span>
                  <strong>{event.title}</strong>
                  <p>{event.summary}</p>
                  <small>{event.riskScore}% / {formatShortTime(event.createdAt)}</small>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <section className={styles.aiBottomGrid}>
        <div className={styles.aiChat}>
          <div className={styles.aiSectionHeader}>
            <div>
              <span>Chat operativo</span>
              <strong>Pregunta al copiloto</strong>
            </div>
          </div>
          <div className={styles.aiQuickPrompts}>
            {quickPrompts.map((item) => (
              <button type="button" key={item} onClick={() => onAsk(item)} disabled={loading}>
                <Sparkles size={14} /> {item}
              </button>
            ))}
          </div>
          <div className={styles.aiMessages}>
            {messages.slice(-6).map((item, index) => (
              <article className={item.role === "assistant" ? styles.aiMessageAssistant : styles.aiMessageUser} key={`${item.at}-${index}`}>
                <span>{item.role === "assistant" ? <Bot size={14} /> : <MessageCircle size={14} />} {item.role === "assistant" ? "Turquesa AI" : "Tu"}</span>
                <p>{item.content}</p>
                <small>{formatShortTime(item.at)}</small>
              </article>
            ))}
            {loading ? <div className={styles.aiThinking}><Zap size={15} /> Analizando datos del turno...</div> : null}
          </div>
          <form
            className={styles.aiPromptBox}
            onSubmit={(event) => {
              event.preventDefault();
              onAsk(prompt);
            }}
          >
            <input
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="Pregunta: compras, cierre, cocina, caja, reservas..."
            />
            <button type="submit" disabled={loading || !prompt.trim()}>
              <Send size={16} />
            </button>
          </form>
        </div>

        <div className={styles.aiGuardrails}>
          <div className={styles.aiSectionHeader}>
            <div>
              <span>Control humano</span>
              <strong>Reglas de seguridad</strong>
            </div>
          </div>
          {guardrails.map((item) => (
            <div className={styles.aiGuardrail} key={item}>
              <ShieldCheck size={16} />
              <span>{item}</span>
            </div>
          ))}
          <div className={styles.aiSystemStats}>
            <div>
              <span>Tickets</span>
              <strong>{tickets.length}</strong>
            </div>
            <div>
              <span>Print jobs</span>
              <strong>{printJobs.length}</strong>
            </div>
            <div>
              <span>Leads</span>
              <strong>{wifiLeads.length}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function TurnReportPanel({
  snapshot,
  tables,
  tickets,
  inventory,
  reservations,
  purchaseRequests,
  wifiLeads,
  onExport,
}: {
  snapshot: TurquesaSnapshot;
  tables: TurquesaTable[];
  tickets: TurquesaKitchenTicket[];
  inventory: TurquesaInventoryItem[];
  reservations: TurquesaReservation[];
  purchaseRequests: TurquesaPurchaseRequest[];
  wifiLeads: TurquesaWifiLead[];
  onExport: () => void;
}) {
  const paidTotal = shiftPaidTotal(snapshot.shift);
  const openTables = tables.filter((table) => table.status === "open" || table.status === "attention");
  const openBalance = openTables.reduce((sum, table) => sum + table.total, 0);
  const suggestedItems = suggestedPurchaseItems(inventory);
  const criticalInventory = inventory.filter((item) => item.trend === "critico");
  const lowInventory = inventory.filter((item) => item.trend === "bajo");
  const latestPurchase = purchaseRequests[0];
  const paymentRows = [
    { label: "Efectivo", amount: snapshot.shift.cashSales, tone: styles.cashTone },
    { label: "Tarjeta", amount: snapshot.shift.cardSales, tone: styles.cardTone },
    { label: "Transferencia", amount: snapshot.shift.transferSales, tone: styles.transferTone },
  ];

  return (
    <div className={styles.reportPanel}>
      <div className={styles.reportHero}>
        <span>Venta cobrada</span>
        <strong>{currency(paidTotal)}</strong>
        <p>
          {snapshot.shift.label} / {snapshot.shift.status === "open" ? "Turno abierto" : "Turno cerrado"}
        </p>
      </div>

      <div className={styles.reportKpis}>
        <div>
          <span>Saldo abierto</span>
          <strong>{currency(openBalance)}</strong>
        </div>
        <div>
          <span>Proyectado</span>
          <strong>{currency(snapshot.shift.projectedSales)}</strong>
        </div>
        <div>
          <span>Inventario</span>
          <strong>{currency(Math.round(inventoryValue(inventory)))}</strong>
        </div>
        <div>
          <span>Compra sugerida</span>
          <strong>{currency(purchaseTotal(suggestedItems))}</strong>
        </div>
      </div>

      <div className={styles.reportSection}>
        <div className={styles.reportSectionTitle}>
          <strong>Mezcla de pagos</strong>
          <span>{paymentRows.length} metodos</span>
        </div>
        <div className={styles.paymentRows}>
          {paymentRows.map((row) => (
            <div className={styles.paymentRow} key={row.label}>
              <div>
                <strong>{row.label}</strong>
                <span>{percent(row.amount, paidTotal)}</span>
              </div>
              <div className={styles.paymentTrack}>
                <i className={row.tone} style={{ width: percent(row.amount, paidTotal) }} />
              </div>
              <b>{currency(row.amount)}</b>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.reportGrid}>
        <div className={styles.reportCard}>
          <span>Operacion</span>
          <Line label="Mesas abiertas" value={String(openTables.length)} />
          <Line label="Tickets KDS" value={String(tickets.length)} />
          <Line label="Reservas" value={String(reservations.length)} />
          <Line label="Leads Wi-Fi" value={String(wifiLeads.length)} />
        </div>
        <div className={styles.reportCard}>
          <span>Inventario</span>
          <Line label="Criticos" value={String(criticalInventory.length)} />
          <Line label="Bajos" value={String(lowInventory.length)} />
          <Line label="Solicitud" value={latestPurchase ? latestPurchase.code : "Sin solicitud"} />
          <Line label="Total compra" value={latestPurchase ? currency(latestPurchase.total) : currency(0)} />
        </div>
      </div>

      <button type="button" className={styles.closeButton} onClick={onExport}>
        <FileDown size={16} /> Exportar CSV
      </button>
    </div>
  );
}

function ShiftClosePanel({
  shift,
  openTables,
  countedCash,
  notes,
  onChange,
  onClose,
  disabled,
}: {
  shift: TurquesaSnapshot["shift"];
  openTables: TurquesaTable[];
  countedCash: string;
  notes: string;
  onChange: (value: ClosureFormState) => void;
  onClose: () => void;
  disabled: boolean;
}) {
  const paidTotal = shiftPaidTotal(shift);
  const expectedCash = expectedShiftCash(shift);
  const counted = formNumber(countedCash || String(expectedCash));
  const difference = Math.round((counted - expectedCash) * 100) / 100;
  const diffTone = Math.abs(difference) < 1 ? styles.good : difference < 0 ? styles.bad : styles.warn;

  return (
    <div className={styles.closePanel}>
      <div className={styles.closeHero}>
        <span>{shift.status === "closed" ? "Turno cerrado" : "Venta del turno"}</span>
        <strong>{currency(paidTotal)}</strong>
        <p>{openTables.length ? `${openTables.length} mesas abiertas antes de cerrar.` : "Sin mesas abiertas. Listo para cierre final."}</p>
      </div>

      <div className={styles.closeBreakdown}>
        <Line label="Fondo inicial" value={currency(shift.openingCash)} />
        <Line label="Efectivo vendido" value={currency(shift.cashSales)} />
        <Line label="Tarjetas" value={currency(shift.cardSales)} />
        <Line label="Transferencias" value={currency(shift.transferSales)} />
        <Line label="Efectivo esperado" value={currency(expectedCash)} strong />
      </div>

      <div className={styles.cashForm}>
        <label>
          <span>Efectivo contado</span>
          <input
            type="number"
            min="0"
            value={countedCash}
            onChange={(event) => onChange({ countedCash: event.target.value, notes })}
            disabled={disabled}
          />
        </label>
        <label>
          <span>Nota de cierre</span>
          <textarea
            value={notes}
            onChange={(event) => onChange({ countedCash, notes: event.target.value })}
            placeholder="Ej: deposito preparado, propina revisada..."
            disabled={disabled}
          />
        </label>
      </div>

      <div className={styles.diffRow}>
        <span>Diferencia</span>
        <b className={diffTone}>{currency(difference)}</b>
      </div>

      <button type="button" className={styles.closeButton} onClick={onClose} disabled={disabled || shift.status === "closed"}>
        {shift.status === "closed" ? "Turno cerrado" : "Cerrar turno"}
      </button>

      {openTables.length ? (
        <p className={styles.closeWarning}>Pendiente: {openTables.map((table) => table.label).join(", ")}.</p>
      ) : null}
    </div>
  );
}

function ReservationQuickForm({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: ReservationFormState;
  onChange: (value: ReservationFormState) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  return (
    <form
      className={styles.quickForm}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className={styles.formGrid}>
        <input
          aria-label="Hora de reserva"
          type="time"
          value={value.time}
          onChange={(event) => onChange({ ...value, time: event.target.value })}
          disabled={disabled}
        />
        <input
          aria-label="Cantidad de personas"
          type="number"
          min="1"
          max="50"
          value={value.guests}
          onChange={(event) => onChange({ ...value, guests: event.target.value })}
          disabled={disabled}
        />
      </div>
      <input
        value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        placeholder="Nombre de reserva"
        disabled={disabled}
      />
      <input
        value={value.note}
        onChange={(event) => onChange({ ...value, note: event.target.value })}
        placeholder="Cumpleanos, hotel, VIP..."
        disabled={disabled}
      />
      <button type="submit" disabled={disabled}>
        Crear reserva
      </button>
    </form>
  );
}

function InventoryRow({
  item,
  onAdjust,
  disabled,
}: {
  item: TurquesaInventoryItem;
  onAdjust: (delta: number) => void;
  disabled: boolean;
}) {
  return (
    <div className={styles.inventoryRow}>
      <div>
        <strong>{item.item}</strong>
        <span>
          Minimo {item.min} {item.unit} / {currency(item.avgCost)} por {item.unit}
        </span>
      </div>
      <b className={item.trend === "critico" ? styles.bad : item.trend === "bajo" ? styles.warn : styles.good}>
        {item.onHand} {item.unit}
      </b>
      <div className={styles.rowActions}>
        <button type="button" onClick={() => onAdjust(-1)} disabled={disabled} aria-label={`Restar ${item.item}`}>
          <Minus size={13} />
        </button>
        <button type="button" onClick={() => onAdjust(1)} disabled={disabled} aria-label={`Sumar ${item.item}`}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

function WifiLeadRow({
  lead,
  onStatus,
  disabled,
}: {
  lead: TurquesaWifiLead;
  onStatus: (status: WifiLeadStatus) => void;
  disabled: boolean;
}) {
  return (
    <div className={`${styles.compactRow} ${styles.actionRow}`}>
      <UserRound size={16} />
      <div>
        <strong>{lead.name}</strong>
        <span>
          {lead.time} / {lead.source} / {lead.status}
        </span>
      </div>
      <div className={styles.leadActions}>
        <button type="button" onClick={() => onStatus("cliente")} disabled={disabled}>
          Cliente
        </button>
        <button type="button" onClick={() => onStatus("promocion")} disabled={disabled}>
          Promo
        </button>
      </div>
    </div>
  );
}
