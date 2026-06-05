"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Clock,
  Crown,
  Factory,
  FileSpreadsheet,
  Loader2,
  PackageCheck,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ProductionOrderAI = {
  id: string;
  order_code: string;
  request_id?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  project_type?: string | null;
  status?: string | null;
  total_cost?: number | null;
  total_sale?: number | null;
  profit?: number | null;
  created_at?: string | null;
};

type ProductionOrderItemAI = {
  id: string;
  production_order_id: string;
  request_id?: string | null;
  item_type?: string | null;
  item_name?: string | null;
  material?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  depth_mm?: number | null;
  quantity?: number | null;
  unit?: string | null;
  unit_cost?: number | null;
  total_cost?: number | null;
  status?: string | null;
  qr_code?: string | null;
  created_at?: string | null;
};

const STATUS_OPTIONS = [
  "pendiente",
  "en_produccion",
  "cortado",
  "canteado",
  "perforado",
  "ensamblado",
  "instalado",
  "terminada",
];

const ITEM_STATUS_OPTIONS = [
  "pendiente",
  "cortada",
  "canteada",
  "perforada",
  "ensamblada",
  "instalada",
  "faltante",
];

const RD = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
});

function n(value: any): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function money(value: any): string {
  return RD.format(n(value));
}

function normal(value: any): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function shortDate(value?: string | null): string {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("es-DO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function statusLabel(status?: string | null): string {
  const s = normal(status);
  if (s === "en_produccion") return "En producción";
  if (s === "cortado" || s === "cortada") return "Cortado";
  if (s === "canteado" || s === "canteada") return "Canteado";
  if (s === "perforado" || s === "perforada") return "Perforado";
  if (s === "ensamblado" || s === "ensamblada") return "Ensamblado";
  if (s === "instalado" || s === "instalada") return "Instalado";
  if (s === "terminada") return "Terminada";
  if (s === "faltante") return "Faltante";
  return status || "Pendiente";
}

function statusClass(status?: string | null): string {
  const s = normal(status);
  if (s.includes("terminada") || s.includes("instalada")) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (s.includes("produccion") || s.includes("cort") || s.includes("cant") || s.includes("perfor") || s.includes("ensam")) return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
  if (s.includes("faltante")) return "bg-red-500/15 text-red-300 border-red-500/30";
  return "bg-amber-500/15 text-amber-300 border-amber-500/30";
}

function progressFromItems(items: ProductionOrderItemAI[]): number {
  const trackable = items.filter((item) => !normal(item.status).includes("faltante"));
  if (!trackable.length) return 0;
  const completed = trackable.filter((item) => {
    const s = normal(item.status);
    return s.includes("instalada") || s.includes("terminada") || s.includes("ensamblada");
  }).length;
  return Math.round((completed / trackable.length) * 100);
}

function parseQr(value: string): any | null {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    const lines = value.split("\n").map((x) => x.trim()).filter(Boolean);
    const obj: any = {};
    lines.forEach((line) => {
      const idx = line.indexOf(":");
      if (idx > -1) obj[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    });
    return Object.keys(obj).length ? obj : { raw: value };
  }
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = "cyan",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  tone?: "cyan" | "green" | "amber" | "red" | "blue";
}) {
  const tones: Record<string, string> = {
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    red: "border-red-500/25 bg-red-500/10 text-red-300",
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  };

  return (
    <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-400 font-black">{title}</div>
          <div className="mt-2 text-3xl font-black text-white">{value}</div>
          {subtitle ? <div className="mt-1 text-xs text-slate-400">{subtitle}</div> : null}
        </div>
        <div className={`h-12 w-12 rounded-2xl border flex items-center justify-center ${tones[tone]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function ProductionOrdersAIPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<ProductionOrderAI[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrderAI | null>(null);
  const [items, setItems] = useState<ProductionOrderItemAI[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const [qrInput, setQrInput] = useState("");
  const [updating, setUpdating] = useState("");

  async function loadOrders() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("production_orders_ai")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders((data || []) as ProductionOrderAI[]);
    } catch (error: any) {
      alert(error?.message || "Error cargando órdenes.");
    } finally {
      setLoading(false);
    }
  }

  async function loadOrderItems(order: ProductionOrderAI) {
    try {
      setSelectedOrder(order);
      setLoadingItems(true);
      const { data, error } = await supabase
        .from("production_order_ai_items")
        .select("*")
        .eq("production_order_id", order.id)
        .order("item_type", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      setItems((data || []) as ProductionOrderItemAI[]);
    } catch (error: any) {
      alert(error?.message || "Error cargando piezas de la OP.");
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesFilter = filter === "todos" || normal(order.status).includes(normal(filter));
      const q = normal(query);
      const matchesQuery =
        !q ||
        normal(order.order_code).includes(q) ||
        normal(order.project_name).includes(q) ||
        normal(order.client_name).includes(q) ||
        normal(order.project_type).includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [orders, query, filter]);

  const totals = useMemo(() => {
    const cost = orders.reduce((s, x) => s + n(x.total_cost), 0);
    const sale = orders.reduce((s, x) => s + n(x.total_sale), 0);
    const profit = orders.reduce((s, x) => s + n(x.profit), 0);
    const active = orders.filter((x) => !["terminada", "instalada"].includes(normal(x.status))).length;
    return { cost, sale, profit, active, count: orders.length };
  }, [orders]);

  const itemStats = useMemo(() => {
    const total = items.length;
    const faltantes = items.filter((x) => normal(x.status).includes("faltante")).length;
    const piezas = items.filter((x) => normal(x.item_type).includes("pieza")).length;
    const bom = items.filter((x) => normal(x.item_type).includes("bom") || normal(x.item_type).includes("tablero") || normal(x.item_type).includes("canto")).length;
    const herrajes = items.filter((x) => normal(x.item_type).includes("herraje")).length;
    const progress = progressFromItems(items);
    return { total, faltantes, piezas, bom, herrajes, progress };
  }, [items]);

  async function updateOrderStatus(status: string) {
    if (!selectedOrder) return;
    try {
      setUpdating("order");
      const { error } = await supabase
        .from("production_orders_ai")
        .update({ status })
        .eq("id", selectedOrder.id);

      if (error) throw error;

      const updated = { ...selectedOrder, status };
      setSelectedOrder(updated);
      setOrders((old) => old.map((x) => (x.id === updated.id ? updated : x)));
    } catch (error: any) {
      alert(error?.message || "Error actualizando estado de OP.");
    } finally {
      setUpdating("");
    }
  }

  async function updateItemStatus(item: ProductionOrderItemAI, status: string) {
    try {
      setUpdating(item.id);
      const { error } = await supabase
        .from("production_order_ai_items")
        .update({ status })
        .eq("id", item.id);

      if (error) throw error;

      setItems((old) => old.map((x) => (x.id === item.id ? { ...x, status } : x)));
    } catch (error: any) {
      alert(error?.message || "Error actualizando pieza.");
    } finally {
      setUpdating("");
    }
  }

  async function scanQrAndUpdate(status = "cortada") {
    const parsed = parseQr(qrInput);
    if (!parsed) {
      alert("Pega o escanea el contenido del QR primero.");
      return;
    }

    const orderCode = parsed.order_code || parsed.op || parsed.orden || "";
    const pieceName = parsed.piece || parsed.pieza || parsed.item || parsed["pieza"] || "";

    try {
      setUpdating("qr");

      let orderId = selectedOrder?.id || "";

      if (!orderId && orderCode) {
        const { data: orderData, error: orderError } = await supabase
          .from("production_orders_ai")
          .select("*")
          .eq("order_code", orderCode)
          .maybeSingle();

        if (orderError) throw orderError;
        if (!orderData) throw new Error("No encontré la orden del QR.");
        orderId = orderData.id;
        await loadOrderItems(orderData as ProductionOrderAI);
      }

      if (!orderId) throw new Error("Selecciona una OP o escanea un QR con order_code.");

      let match = items.find((item) => {
        const qr = parseQr(item.qr_code || "") || {};
        return (
          normal(qr.piece).includes(normal(pieceName)) ||
          normal(item.item_name).includes(normal(pieceName))
        );
      });

      if (!match && pieceName) {
        const { data, error } = await supabase
          .from("production_order_ai_items")
          .select("*")
          .eq("production_order_id", orderId)
          .ilike("item_name", `%${pieceName}%`)
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        match = data as ProductionOrderItemAI | undefined;
      }

      if (!match) throw new Error("No encontré la pieza del QR dentro de la OP.");

      const { error } = await supabase
        .from("production_order_ai_items")
        .update({ status })
        .eq("id", match.id);

      if (error) throw error;

      setItems((old) => old.map((x) => (x.id === match!.id ? { ...x, status } : x)));
      setQrInput("");
      alert(`✅ Pieza actualizada a: ${statusLabel(status)}`);
    } catch (error: any) {
      alert(error?.message || "Error escaneando QR.");
    } finally {
      setUpdating("");
    }
  }

  function printOrderPack() {
    if (!selectedOrder) return alert("Selecciona una OP.");
    const rows = items
      .map(
        (item) => `
        <tr>
          <td>${item.item_type || ""}</td>
          <td>${item.item_name || ""}</td>
          <td>${item.material || ""}</td>
          <td>${n(item.width_mm)} x ${n(item.height_mm)} x ${n(item.depth_mm)} mm</td>
          <td>${n(item.quantity).toFixed(2)} ${item.unit || ""}</td>
          <td>${money(item.unit_cost)}</td>
          <td>${money(item.total_cost)}</td>
          <td>${statusLabel(item.status)}</td>
        </tr>`
      )
      .join("");

    const win = window.open("", "_blank");
    if (!win) return alert("Permite popups para imprimir.");

    win.document.write(`
      <html>
        <head>
          <title>${selectedOrder.order_code}</title>
          <style>
            body{font-family:Arial;margin:28px;color:#111}
            .brand{letter-spacing:6px;color:#0066aa;font-weight:900;font-size:13px}
            h1{font-size:28px;margin:10px 0 4px}
            .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}
            .box{border:1px solid #111;border-radius:10px;padding:10px}
            .label{font-size:10px;color:#555;text-transform:uppercase;font-weight:700}
            .value{font-size:18px;font-weight:900}
            table{width:100%;border-collapse:collapse;font-size:11px;margin-top:16px}
            th{background:#07111f;color:white;text-align:left}
            th,td{border:1px solid #ccc;padding:7px}
            @media print{body{margin:12mm}}
          </style>
        </head>
        <body>
          <div class="brand">RD WOOD SYSTEM</div>
          <h1>ORDEN DE PRODUCCIÓN ${selectedOrder.order_code}</h1>
          <div><b>Proyecto:</b> ${selectedOrder.project_name || ""}</div>
          <div><b>Cliente:</b> ${selectedOrder.client_name || ""}</div>
          <div><b>Tipo:</b> ${selectedOrder.project_type || ""}</div>
          <div><b>Fecha:</b> ${shortDate(selectedOrder.created_at)}</div>
          <div class="grid">
            <div class="box"><div class="label">Costo</div><div class="value">${money(selectedOrder.total_cost)}</div></div>
            <div class="box"><div class="label">Venta</div><div class="value">${money(selectedOrder.total_sale)}</div></div>
            <div class="box"><div class="label">Utilidad</div><div class="value">${money(selectedOrder.profit)}</div></div>
            <div class="box"><div class="label">Estado</div><div class="value">${statusLabel(selectedOrder.status)}</div></div>
          </div>
          <h2>Detalle de producción</h2>
          <table>
            <thead>
              <tr>
                <th>Tipo</th><th>Item</th><th>Material</th><th>Medidas</th><th>Cantidad</th><th>Costo Unit.</th><th>Total</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <script>window.print()</script>
        </body>
      </html>
    `);

    win.document.close();
  }

  function printQrLabels() {
    if (!selectedOrder) return alert("Selecciona una OP.");

    const labels = items
      .filter((item) => normal(item.item_type).includes("pieza") || normal(item.item_type).includes("modulo"))
      .map((item) => {
        const qrRaw =
          item.qr_code ||
          JSON.stringify({
            order_code: selectedOrder.order_code,
            project: selectedOrder.project_name,
            item_type: item.item_type,
            piece: item.item_name,
            material: item.material,
            width_mm: item.width_mm,
            height_mm: item.height_mm,
            status: item.status,
          });

        const qrData = encodeURIComponent(qrRaw);

        return `
          <div class="label">
            <div class="brand">RD WOOD SYSTEM</div>
            <div class="row">
              <div class="info">
                <b>${selectedOrder.order_code}</b>
                <div>${selectedOrder.project_name || ""}</div>
                <div>${item.item_name || ""}</div>
                <div>${item.material || ""}</div>
                <div class="big">${n(item.width_mm)} x ${n(item.height_mm)} mm</div>
                <div>Estado: ${statusLabel(item.status)}</div>
              </div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=92x92&data=${qrData}" />
            </div>
          </div>`;
      })
      .join("");

    const win = window.open("", "_blank");
    if (!win) return alert("Permite popups para imprimir.");

    win.document.write(`
      <html>
        <head>
          <title>Etiquetas ${selectedOrder.order_code}</title>
          <style>
            body{font-family:Arial;margin:12px;color:#111}
            .wrap{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
            .label{border:1px solid #111;border-radius:8px;padding:10px;min-height:138px;page-break-inside:avoid}
            .brand{letter-spacing:4px;color:#0066aa;font-weight:900;font-size:11px}
            .row{display:flex;justify-content:space-between;gap:8px}
            .info{flex:1}
            .big{font-size:18px;font-weight:900;margin:8px 0}
            img{width:92px;height:92px}
            @media print{body{margin:8mm}}
          </style>
        </head>
        <body>
          <div class="wrap">${labels}</div>
          <script>window.print()</script>
        </body>
      </html>
    `);

    win.document.close();
  }

  return (
    <main className="min-h-screen bg-[#020817] text-white px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[30px] border border-cyan-900/60 bg-[#07111f] p-8 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-700 bg-cyan-500/10 px-4 py-2 text-cyan-300 text-sm font-black tracking-[0.35em]">
                <Crown size={16} /> FASE 11
              </div>
              <h1 className="mt-5 text-5xl font-black tracking-tight">Production Orders AI</h1>
              <p className="mt-2 text-slate-300 max-w-3xl">
                Gestión completa de órdenes de producción IA: estados, piezas, QR, impresión y control de taller.
              </p>
            </div>

            <button
              onClick={loadOrders}
              disabled={loading}
              className="h-14 px-7 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 font-black flex items-center justify-center gap-3 hover:scale-[1.02] transition"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
              RECARGAR
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <MetricCard title="Órdenes" value={totals.count} subtitle="OP IA creadas" icon={<Factory />} tone="blue" />
          <MetricCard title="OP Activas" value={totals.active} subtitle="Pendientes o en proceso" icon={<Clock />} tone="amber" />
          <MetricCard title="Ventas OP" value={money(totals.sale)} subtitle="Total aprobado" icon={<PackageCheck />} tone="green" />
          <MetricCard title="Utilidad" value={money(totals.profit)} subtitle="Utilidad acumulada" icon={<Boxes />} tone="cyan" />
        </section>

        {!selectedOrder ? (
          <>
            <section className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-6 shadow-2xl">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 mb-5">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar OP, proyecto, cliente o tipo..."
                    className="w-full h-14 rounded-2xl bg-[#030817] border border-slate-800 pl-12 pr-4 outline-none focus:border-cyan-500"
                  />
                </div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="h-14 rounded-2xl bg-[#030817] border border-slate-800 px-4 outline-none focus:border-cyan-500"
                >
                  <option value="todos">Todos</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </select>
              </div>

              <div className="overflow-auto rounded-2xl border border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-[#061527] text-slate-300">
                    <tr>
                      <th className="text-left p-4">OP</th>
                      <th className="text-left p-4">Proyecto</th>
                      <th className="text-left p-4">Cliente</th>
                      <th className="text-left p-4">Tipo</th>
                      <th className="text-left p-4">Costo</th>
                      <th className="text-left p-4">Venta</th>
                      <th className="text-left p-4">Utilidad</th>
                      <th className="text-left p-4">Estado</th>
                      <th className="text-left p-4">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="p-10 text-center text-slate-500">
                          <Loader2 className="animate-spin mx-auto mb-2" />
                          Cargando órdenes...
                        </td>
                      </tr>
                    ) : filteredOrders.length ? filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => loadOrderItems(order)}
                        className="border-t border-slate-800 hover:bg-cyan-500/5 cursor-pointer"
                      >
                        <td className="p-4 font-black text-cyan-300">{order.order_code}</td>
                        <td className="p-4 font-bold">{order.project_name}</td>
                        <td className="p-4 text-slate-300">{order.client_name}</td>
                        <td className="p-4 text-slate-300">{order.project_type}</td>
                        <td className="p-4 text-amber-300 font-black">{money(order.total_cost)}</td>
                        <td className="p-4 text-emerald-300 font-black">{money(order.total_sale)}</td>
                        <td className="p-4 text-cyan-300 font-black">{money(order.profit)}</td>
                        <td className="p-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(order.status)}`}>
                            {statusLabel(order.status)}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400">{shortDate(order.created_at)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={9} className="p-10 text-center text-slate-500">
                          <AlertTriangle className="mx-auto mb-2" />
                          No hay órdenes todavía.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-6 shadow-2xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6">
                <div>
                  <button onClick={() => { setSelectedOrder(null); setItems([]); }} className="mb-4 inline-flex items-center gap-2 text-cyan-300 font-black">
                    <ArrowLeft size={18} /> Volver a órdenes
                  </button>
                  <h2 className="text-3xl font-black">{selectedOrder.order_code}</h2>
                  <p className="text-slate-400">
                    {selectedOrder.project_name} · {selectedOrder.client_name} · {selectedOrder.project_type}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button onClick={printOrderPack} className="h-12 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 font-black flex items-center gap-2">
                    <Printer size={18} /> IMPRIMIR PACK
                  </button>
                  <button onClick={printQrLabels} className="h-12 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 font-black flex items-center gap-2">
                    <QrCode size={18} /> ETIQUETAS QR
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
                <MetricCard title="Progreso" value={`${itemStats.progress}%`} subtitle="Por piezas listas" icon={<CheckCircle2 />} tone="green" />
                <MetricCard title="Piezas" value={itemStats.piezas} subtitle="Piezas CNC" icon={<Wrench />} tone="cyan" />
                <MetricCard title="BOM" value={itemStats.bom} subtitle="Materiales" icon={<Boxes />} tone="blue" />
                <MetricCard title="Herrajes" value={itemStats.herrajes} subtitle="Accesorios" icon={<PackageCheck />} tone="amber" />
                <MetricCard title="Faltantes" value={itemStats.faltantes} subtitle="Material crítico" icon={<AlertTriangle />} tone={itemStats.faltantes ? "red" : "green"} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
                <div className="rounded-2xl border border-slate-800 bg-[#030817] p-5">
                  <h3 className="text-xl font-black mb-4">Estado de OP</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => updateOrderStatus(s)}
                        disabled={updating === "order"}
                        className={`rounded-2xl border px-3 py-3 text-xs font-black ${normal(selectedOrder.status) === normal(s) ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-800 bg-[#07111f] text-slate-300 hover:border-cyan-700"}`}
                      >
                        {statusLabel(s)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#030817] p-5">
                  <h3 className="text-xl font-black mb-4 flex items-center gap-2"><QrCode className="text-cyan-300" /> Escaneo QR</h3>
                  <textarea
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder="Pega aquí el contenido del QR escaneado..."
                    className="w-full h-24 rounded-2xl bg-[#07111f] border border-slate-800 p-3 text-sm outline-none focus:border-cyan-500"
                  />
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button onClick={() => scanQrAndUpdate("cortada")} disabled={updating === "qr"} className="rounded-xl bg-cyan-600 px-3 py-2 font-black text-sm">CORTADA</button>
                    <button onClick={() => scanQrAndUpdate("canteada")} disabled={updating === "qr"} className="rounded-xl bg-blue-600 px-3 py-2 font-black text-sm">CANTEADA</button>
                    <button onClick={() => scanQrAndUpdate("ensamblada")} disabled={updating === "qr"} className="rounded-xl bg-emerald-600 px-3 py-2 font-black text-sm">ENSAMBLADA</button>
                    <button onClick={() => scanQrAndUpdate("instalada")} disabled={updating === "qr"} className="rounded-xl bg-green-600 px-3 py-2 font-black text-sm">INSTALADA</button>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-2xl font-black flex items-center gap-2">
                  <FileSpreadsheet className="text-cyan-300" /> Items de Producción
                </h2>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-cyan-300 text-xs font-black">
                  {itemStats.total} items
                </span>
              </div>

              <div className="overflow-auto rounded-2xl border border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-[#061527] text-slate-300">
                    <tr>
                      <th className="text-left p-4">Tipo</th>
                      <th className="text-left p-4">Item</th>
                      <th className="text-left p-4">Material</th>
                      <th className="text-left p-4">Medidas</th>
                      <th className="text-left p-4">Cantidad</th>
                      <th className="text-left p-4">Costo</th>
                      <th className="text-left p-4">Estado</th>
                      <th className="text-left p-4">Actualizar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingItems ? (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-slate-500">
                          <Loader2 className="animate-spin mx-auto mb-2" />
                          Cargando items...
                        </td>
                      </tr>
                    ) : items.length ? items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-800 hover:bg-cyan-500/5">
                        <td className="p-4 text-cyan-300 font-black">{item.item_type}</td>
                        <td className="p-4 font-bold">{item.item_name}</td>
                        <td className="p-4 text-slate-300">{item.material}</td>
                        <td className="p-4 text-slate-300">{n(item.width_mm)} x {n(item.height_mm)} x {n(item.depth_mm)} mm</td>
                        <td className="p-4 text-slate-300">{n(item.quantity).toFixed(2)} {item.unit}</td>
                        <td className="p-4 text-amber-300 font-black">{money(item.total_cost)}</td>
                        <td className="p-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td className="p-4">
                          <select
                            value={item.status || "pendiente"}
                            onChange={(e) => updateItemStatus(item, e.target.value)}
                            disabled={updating === item.id}
                            className="h-10 rounded-xl bg-[#030817] border border-slate-800 px-3 outline-none focus:border-cyan-500"
                          >
                            {ITEM_STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{statusLabel(s)}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-slate-500">
                          No hay items asociados a esta OP.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
