"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Loader2,
  PackageCheck,
  RefreshCcw,
  Search,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/saas/auth-client";

type Row = any;

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(v: any) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(n(v));
}

function fmtDate(v: any) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("es-DO");
  } catch {
    return String(v);
  }
}

function getErrorMessage(error: any) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return error.message || error.details || JSON.stringify(error);
}

function poNumber(po: Row) {
  return po.po_number || po.order_number || po.code || po.invoice_number || "OC-SIN-NUMERO";
}

function poSupplier(po: Row) {
  return po.supplier_name || po.supplier || "Proveedor por definir";
}

function poStatus(po: Row) {
  return po.status || po.estado || "pendiente";
}

function itemName(i: Row) {
  return i.item_name || i.product_name || i.material || i.name || "Producto sin nombre";
}

function orderedQty(i: Row) {
  return n(i.quantity ?? i.quantity_to_buy ?? i.qty ?? i.qty_requested ?? 0);
}

function receivedQty(i: Row) {
  return n(i.qty_received ?? i.quantity_received ?? i.cantidad_recibida ?? 0);
}

function unitCost(i: Row) {
  return n(i.unit_cost ?? i.estimated_cost ?? i.cost ?? 0);
}

function inventoryName(i: Row) {
  return i.material || i.name || i.product_name || i.description || "Producto sin nombre";
}

function inventoryStock(i: Row) {
  return n(i.stock ?? i.quantity ?? i.qty ?? 0);
}

function inventoryCost(i: Row) {
  return n(i.costo_promedio ?? i.unit_cost ?? i.purchase_cost ?? i.cost_price ?? i.cost ?? 0);
}

export default function RecepcionComprasAlmacenPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<Row[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<Row[]>([]);
  const [receipts, setReceipts] = useState<Row[]>([]);
  const [inventory, setInventory] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveValues, setReceiveValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pendientes");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function safeSelect(table: string) {
    try {
      const res = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(1500);
      if (res.error) return { data: [], error: res.error };
      return { data: res.data || [], error: null };
    } catch (err: any) {
      return { data: [], error: err };
    }
  }

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    const [poRes, itemRes, invRes, receiptRes] = await Promise.all([
      safeSelect("purchase_orders"),
      safeSelect("purchase_order_items"),
      supabase.from("inventory").select("*").order("material", { ascending: true }).limit(2000),
      safeSelect("purchase_receipts"),
    ]);

    if (poRes.error) setErrorMessage("purchase_orders: " + getErrorMessage(poRes.error));
    if (itemRes.error) setErrorMessage("purchase_order_items: " + getErrorMessage(itemRes.error));
    if (invRes.error) setErrorMessage("inventory: " + invRes.error.message);

    setPurchaseOrders(poRes.data || []);
    setPurchaseItems(itemRes.data || []);
    setInventory(invRes.data || []);
    setReceipts(receiptRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const inventoryMap = useMemo(() => {
    const map = new Map<string, Row>();
    inventory.forEach((i) => i?.id && map.set(String(i.id), i));
    return map;
  }, [inventory]);

  const itemsByPO = useMemo(() => {
    const map = new Map<string, Row[]>();
    purchaseItems.forEach((item) => {
      const id = String(item.purchase_order_id || "");
      if (!id) return;
      map.set(id, [...(map.get(id) || []), item]);
    });
    return map;
  }, [purchaseItems]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();

    return purchaseOrders.filter((po) => {
      const items = itemsByPO.get(String(po.id)) || [];
      const ordered = items.reduce((s, i) => s + orderedQty(i), 0);
      const received = items.reduce((s, i) => s + receivedQty(i), 0);
      const pending = Math.max(0, ordered - received);
      const isPending = pending > 0;

      const statusOk =
        statusFilter === "todas" ||
        (statusFilter === "pendientes" && isPending) ||
        (statusFilter === "recibidas" && !isPending);

      const text = `${poNumber(po)} ${poSupplier(po)} ${poStatus(po)}`.toLowerCase();
      const queryOk = !q || text.includes(q);

      return statusOk && queryOk;
    });
  }, [purchaseOrders, itemsByPO, query, statusFilter]);

  const summary = useMemo(() => {
    let pending = 0;
    let received = 0;
    let partial = 0;

    purchaseOrders.forEach((po) => {
      const items = itemsByPO.get(String(po.id)) || [];
      const ordered = items.reduce((s, i) => s + orderedQty(i), 0);
      const rec = items.reduce((s, i) => s + receivedQty(i), 0);
      if (rec <= 0) pending += 1;
      else if (rec < ordered) partial += 1;
      else received += 1;
    });

    return {
      total: purchaseOrders.length,
      pending,
      partial,
      received,
      receipts: receipts.length,
    };
  }, [purchaseOrders, itemsByPO, receipts.length]);

  function openReceive(po: Row) {
    const items = itemsByPO.get(String(po.id)) || [];
    const values: Record<string, string> = {};
    items.forEach((item) => {
      const pending = Math.max(0, orderedQty(item) - receivedQty(item));
      values[String(item.id)] = String(pending);
    });
    setSelected(po);
    setReceiveValues(values);
    setNotes("");
    setReceiveOpen(true);
  }

  async function createKardexEntry(args: {
    inventoryId: string;
    productName: string;
    qty: number;
    beforeStock: number;
    afterStock: number;
    cost: number;
    reference: string;
  }) {
    const payload = {
      inventory_id: args.inventoryId,
      product_id: args.inventoryId,
      product_name: args.productName,
      item_name: args.productName,
      type: "entrada",
      tipo: "entrada",
      movement_type: "recepcion_compra",
      quantity: Math.abs(args.qty),
      qty: Math.abs(args.qty),
      cantidad: Math.abs(args.qty),
      stock_before: args.beforeStock,
      stock_after: args.afterStock,
      stock_anterior: args.beforeStock,
      stock_nuevo: args.afterStock,
      unit_cost: args.cost,
      costo_unitario: args.cost,
      total_cost: args.qty * args.cost,
      total: args.qty * args.cost,
      reference: args.reference,
      referencia: args.reference,
      source: "purchase_receipt",
      origin: "recepcion_compras_almacen",
      notes: `Entrada por recepción de compra ${args.reference}`,
      created_at: new Date().toISOString(),
    };

    let res = await supabase.from("inventory_movements").insert(payload);
    if (res.error) res = await supabase.from("movimientos").insert(payload);
    return res.error;
  }

  async function processReceipt() {
    if (!selected?.id) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const apiRes = await apiFetch("/api/purchase-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseOrderId: selected.id, receiveValues, notes }),
      });
      const payload = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok || !payload?.ok) throw new Error(payload?.error || "No se pudo confirmar la recepcion.");

      setSuccessMessage(
        `Recepcion ${payload.receiptNo} registrada. Lineas recibidas: ${payload.receivedLines}. Inventario y Kardex actualizados.`
      );
      setReceiveOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage("Error recibiendo compra: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function processReceiptLegacy() {
    if (!selected?.id) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const poItems = itemsByPO.get(String(selected.id)) || [];
      const receiptNo = `REC-${Date.now().toString().slice(-10)}`;

      const { data: receipt, error: receiptError } = await supabase
        .from("purchase_receipts")
        .insert({
          receipt_no: receiptNo,
          code: receiptNo,
          purchase_order_id: selected.id,
          status: "recibida",
          estado: "recibida",
          received_by_name: "Almacén",
          supplier_name: poSupplier(selected),
          notes: notes || `Recepción de almacén para ${poNumber(selected)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (receiptError) throw receiptError;

      let totalReceived = 0;
      let receivedLines = 0;

      for (const item of poItems) {
        const qtyToReceive = n(receiveValues[String(item.id)]);
        if (qtyToReceive <= 0) continue;

        const invId = item.product_id || item.item_id || item.inventory_id;
        const inv = invId ? inventoryMap.get(String(invId)) : null;

        if (!inv) {
          await supabase.from("purchase_receipt_items").insert({
            purchase_receipt_id: receipt.id,
            purchase_order_id: selected.id,
            purchase_order_item_id: item.id,
            inventory_id: invId || null,
            product_id: invId || null,
            product_name: itemName(item),
            item_name: itemName(item),
            qty_ordered: orderedQty(item),
            qty_received: qtyToReceive,
            quantity_received: qtyToReceive,
            cantidad_recibida: qtyToReceive,
            unit_cost: unitCost(item),
            total: qtyToReceive * unitCost(item),
            status: "sin_match_inventario",
            estado: "sin_match_inventario",
            notes: "No se encontró producto en inventario para actualizar stock.",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          continue;
        }

        const before = inventoryStock(inv);
        const currentCost = inventoryCost(inv);
        const cost = unitCost(item) || currentCost;
        const after = before + qtyToReceive;
        const oldValue = before * currentCost;
        const newValue = qtyToReceive * cost;
        const avgCost = after > 0 ? (oldValue + newValue) / after : cost;

        const { error: invError } = await supabase
          .from("inventory")
          .update({
            stock: after,
            quantity: after,
            costo_promedio: avgCost,
            unit_cost: avgCost,
            purchase_cost: cost,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inv.id);

        if (invError) throw invError;

        const newReceived = receivedQty(item) + qtyToReceive;
        const itemStatus = newReceived >= orderedQty(item) ? "recibido" : "parcial";

        const { error: itemError } = await supabase
          .from("purchase_order_items")
          .update({
            qty_received: newReceived,
            quantity_received: newReceived,
            cantidad_recibida: newReceived,
            status: itemStatus,
            estado: itemStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        if (itemError) throw itemError;

        const receiptItemError = await supabase.from("purchase_receipt_items").insert({
          purchase_receipt_id: receipt.id,
          purchase_order_id: selected.id,
          purchase_order_item_id: item.id,
          inventory_id: inv.id,
          product_id: inv.id,
          product_name: inventoryName(inv),
          item_name: inventoryName(inv),
          qty_ordered: orderedQty(item),
          qty_received: qtyToReceive,
          quantity_received: qtyToReceive,
          cantidad_recibida: qtyToReceive,
          unit_cost: cost,
          total: qtyToReceive * cost,
          status: "recibido",
          estado: "recibido",
          notes: "Entrada confirmada por Almacén.",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (receiptItemError.error) throw receiptItemError.error;

        const kardexError = await createKardexEntry({
          inventoryId: String(inv.id),
          productName: inventoryName(inv),
          qty: qtyToReceive,
          beforeStock: before,
          afterStock: after,
          cost,
          reference: receiptNo,
        });

        if (kardexError) throw kardexError;

        totalReceived += qtyToReceive * cost;
        receivedLines += 1;
      }

      const refreshedItems = poItems.map((item) => {
        const add = n(receiveValues[String(item.id)]);
        return {
          ...item,
          qty_received: receivedQty(item) + add,
        };
      });

      const orderedTotal = refreshedItems.reduce((s, i) => s + orderedQty(i), 0);
      const receivedTotal = refreshedItems.reduce((s, i) => s + receivedQty(i), 0);
      const poFinalStatus = receivedTotal >= orderedTotal ? "recibida" : "parcial";

      await supabase
        .from("purchase_receipts")
        .update({
          total_received: totalReceived,
          updated_at: new Date().toISOString(),
        })
        .eq("id", receipt.id);

      await supabase
        .from("purchase_orders")
        .update({
          status: poFinalStatus,
          estado: poFinalStatus,
          receipt_status: poFinalStatus,
          received_at: poFinalStatus === "recibida" ? new Date().toISOString() : selected.received_at || null,
          received_by_name: "Almacén",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selected.id);

      setSuccessMessage(`Recepción ${receiptNo} registrada. Líneas recibidas: ${receivedLines}. Inventario y Kardex actualizados.`);
      setReceiveOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage("Error recibiendo compra: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#030712] text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-7 p-5 md:p-8">
        <section className="overflow-hidden rounded-[30px] border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/25 shadow-2xl shadow-cyan-950/20">
          <div className="grid gap-6 p-6 xl:grid-cols-[1.35fr_.65fr] xl:p-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-200">
                <Database className="h-4 w-4" />
                Fase 6I · Recepción de Compras
              </div>

              <div>
                <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                  Recepción de Compras en Almacén
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
                  Almacén confirma la mercancía recibida, actualiza inventario, recalcula costo promedio y registra Kardex de entrada.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/inventario-inteligente" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4" />
                  Volver al inventario
                </Link>

                <Link href="/compras" className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/20">
                  <Truck className="h-4 w-4" />
                  Abrir Compras PRO
                </Link>

                <button onClick={loadData} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm font-black text-blue-100 transition hover:bg-blue-400/20 disabled:opacity-60">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  Actualizar
                </button>
              </div>

              {successMessage && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-100">{successMessage}</div>}
              {errorMessage && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-semibold text-red-100">{errorMessage}</div>}
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Control físico</p>
                  <h2 className="text-xl font-black text-white">Proveedor → Almacén → Kardex</h2>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">Órdenes compra: {summary.total}</div>
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-amber-100">Pendientes: {summary.pending}</div>
                <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-blue-100">Parciales: {summary.partial}</div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-emerald-100">Recepciones: {summary.receipts}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Órdenes", value: summary.total, icon: ClipboardCheck, detail: "Compras registradas" },
            { label: "Pendientes", value: summary.pending, icon: Boxes, detail: "Por recibir" },
            { label: "Parciales", value: summary.partial, icon: Truck, detail: "Recepción incompleta" },
            { label: "Recibidas", value: summary.received, icon: PackageCheck, detail: "Completadas" },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="rounded-[26px] border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20">
                <div className="flex items-center justify-between">
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-3xl font-black text-white">{m.value}</p>
                </div>
                <p className="mt-4 text-sm font-black text-slate-300">{m.label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{m.detail}</p>
              </div>
            );
          })}
        </section>

        <section className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
          <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-black text-white">Órdenes de compra para recibir</h2>
              <p className="text-sm text-slate-500">Solo Almacén confirma entrada física de mercancía.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar OC o proveedor..." className="w-full rounded-2xl border border-white/10 bg-slate-900 px-11 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50" />
              </div>

              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50">
                <option value="pendientes">Pendientes</option>
                <option value="recibidas">Recibidas</option>
                <option value="todas">Todas</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-white/10 bg-slate-900/60">
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-cyan-100" /> Cargando órdenes...
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((po) => {
                const items = itemsByPO.get(String(po.id)) || [];
                const ordered = items.reduce((s, i) => s + orderedQty(i), 0);
                const received = items.reduce((s, i) => s + receivedQty(i), 0);
                const pending = Math.max(0, ordered - received);
                const complete = pending <= 0;

                return (
                  <article key={po.id} className="rounded-[24px] border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-4 transition hover:border-cyan-300/30">
                    <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">{poNumber(po)}</span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${complete ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>
                            {complete ? "recibida" : "pendiente"}
                          </span>
                          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-200">Pendiente {pending}</span>
                        </div>

                        <h3 className="mt-3 text-lg font-black text-white">{poSupplier(po)}</h3>
                        <p className="mt-1 text-sm text-slate-400">Total: {money(po.total)} · Creada: {fmtDate(po.created_at)}</p>

                        <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-500 md:grid-cols-3">
                          <span>{items.length} líneas</span>
                          <span>Ordenado: {ordered}</span>
                          <span>Recibido: {received}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 xl:flex-col">
                        <button onClick={() => setSelected(po)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 hover:bg-white/10">
                          Ver líneas
                        </button>
                        <button onClick={() => openReceive(po)} disabled={complete} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-50">
                          Recibir en almacén
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}

              {!filteredOrders.length && <div className="flex min-h-[220px] items-center justify-center rounded-[24px] border border-white/10 bg-slate-900/50 text-sm font-semibold text-slate-500">No hay órdenes con esos filtros.</div>}
            </div>
          )}
        </section>

        {selected && (
          <section className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">Detalle de {poNumber(selected)}</h2>
                <p className="mt-1 text-sm text-slate-500">{poSupplier(selected)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 hover:bg-white/10">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(itemsByPO.get(String(selected.id)) || []).map((item) => {
                const pending = Math.max(0, orderedQty(item) - receivedQty(item));
                return (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="font-black text-white">{itemName(item)}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-black/20 p-2"><p className="text-slate-500">Ordenado</p><p className="font-black text-white">{orderedQty(item)}</p></div>
                      <div className="rounded-xl bg-black/20 p-2"><p className="text-slate-500">Recibido</p><p className="font-black text-emerald-100">{receivedQty(item)}</p></div>
                      <div className="rounded-xl bg-black/20 p-2"><p className="text-slate-500">Pendiente</p><p className="font-black text-amber-100">{pending}</p></div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Costo: {money(unitCost(item))}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {receiveOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-[30px] border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">Recepción física de almacén</p>
                <h2 className="mt-2 text-2xl font-black text-white">{poNumber(selected)}</h2>
                <p className="mt-1 text-sm text-slate-500">{poSupplier(selected)}</p>
              </div>
              <button onClick={() => setReceiveOpen(false)} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 hover:bg-white/10">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[460px] space-y-3 overflow-auto pr-1">
              {(itemsByPO.get(String(selected.id)) || []).map((item) => {
                const pending = Math.max(0, orderedQty(item) - receivedQty(item));
                return (
                  <div key={item.id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_160px] md:items-center">
                    <div>
                      <p className="font-black text-white">{itemName(item)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Ordenado {orderedQty(item)} · Recibido {receivedQty(item)} · Pendiente {pending} · Costo {money(unitCost(item))}
                      </p>
                    </div>
                    <label className="space-y-1">
                      <span className="text-xs font-black text-slate-400">Cantidad recibida</span>
                      <input
                        type="number"
                        value={receiveValues[String(item.id)] || "0"}
                        onChange={(e) => setReceiveValues((prev) => ({ ...prev, [String(item.id)]: e.target.value }))}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50"
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            <label className="mt-4 block space-y-2">
              <span className="text-sm font-black text-slate-300">Notas de recepción / calidad</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50"
                placeholder="Ej: recibido completo, pendiente factura, revisar golpes, etc."
              />
            </label>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={() => setReceiveOpen(false)} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 hover:bg-white/10">
                Cancelar
              </button>
              <button onClick={processReceipt} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar recepción
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
