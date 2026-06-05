"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type PurchaseOrder = {
  id: string;
  code?: string | null;
  order_number?: string | null;
  supplier?: string | null;
  supplier_name?: string | null;
  status?: string | null;
  total_cost?: number | null;
  total_estimated?: number | null;
  reason?: string | null;
  whatsapp_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PurchaseItem = {
  id: string;
  purchase_order_id: string;
  inventory_id?: string | null;
  product_id?: string | null;
  producto_id?: string | null;
  product_name?: string | null;
  group_name?: string | null;
  subgroup_name?: string | null;
  unit?: string | null;
  current_stock?: number | null;
  min_stock?: number | null;
  max_stock?: number | null;
  suggested_quantity?: number | null;
  quantity_to_buy?: number | null;
  unit_cost?: number | null;
  estimated_cost?: number | null;
  total_cost?: number | null;
  created_at?: string | null;
};

type InventoryItem = {
  id: string;
  code?: string | null;
  name?: string | null;
  product_name?: string | null;
  material?: string | null;
  category?: string | null;
  group_name?: string | null;
  subgroup_name?: string | null;
  stock?: number | null;
  quantity?: number | null;
  unit_cost?: number | null;
  purchase_cost?: number | null;
  cost_price?: number | null;
  cost?: number | null;
  unit?: string | null;
};

function n(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function money(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function orderCode(order: PurchaseOrder) {
  return String(order.code || order.order_number || `OC-${order.id.slice(0, 8).toUpperCase()}`);
}

function supplierName(order: PurchaseOrder) {
  return String(order.supplier || order.supplier_name || "Sin proveedor");
}

function orderTotal(order: PurchaseOrder) {
  return n(order.total_cost ?? order.total_estimated ?? 0);
}

function getProductId(item: PurchaseItem) {
  return item.inventory_id || item.product_id || item.producto_id || null;
}

function itemQty(item: PurchaseItem) {
  return n(item.suggested_quantity ?? item.quantity_to_buy ?? 0);
}

function itemUnitCost(item: PurchaseItem) {
  return n(item.unit_cost ?? item.estimated_cost ?? 0);
}

function itemTotal(item: PurchaseItem) {
  const stored = n(item.total_cost ?? 0);
  if (stored > 0) return stored;
  return itemQty(item) * itemUnitCost(item);
}

function inventoryName(item?: InventoryItem | null) {
  if (!item) return "Material desconocido";
  return String(item.name || item.product_name || item.material || item.code || "Material");
}

function inventoryStock(item?: InventoryItem | null) {
  if (!item) return 0;
  return n(item.stock ?? item.quantity ?? 0);
}

function inventoryCost(item?: InventoryItem | null) {
  if (!item) return 0;
  return n(item.unit_cost ?? item.purchase_cost ?? item.cost_price ?? item.cost ?? 0);
}

export default function OrdenesCompraPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [items, setItems] = useState<Record<string, PurchaseItem[]>>({});
  const [inventory, setInventory] = useState<Record<string, InventoryItem>>({});

  const [loading, setLoading] = useState(false);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (orders.length > 0 && !openOrder) {
      setOpenOrder(orders[0].id);
    }
  }, [orders, openOrder]);

  async function loadOrders() {
    setLoading(true);
    setMessage("");

    const [ordersRes, itemsRes, inventoryRes] = await Promise.all([
      supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("purchase_order_items").select("*").order("created_at", { ascending: false }),
      supabase.from("inventory").select("*"),
    ]);

    if (ordersRes.error) {
      setMessage("Error cargando órdenes: " + ordersRes.error.message);
      setLoading(false);
      return;
    }

    if (itemsRes.error) {
      setMessage("Error cargando items: " + itemsRes.error.message);
      setLoading(false);
      return;
    }

    if (inventoryRes.error) {
      setMessage("Error cargando inventario: " + inventoryRes.error.message);
    }

    const grouped: Record<string, PurchaseItem[]> = {};
    (itemsRes.data || []).forEach((item: PurchaseItem) => {
      if (!grouped[item.purchase_order_id]) grouped[item.purchase_order_id] = [];
      grouped[item.purchase_order_id].push(item);
    });

    const invMap: Record<string, InventoryItem> = {};
    (inventoryRes.data || []).forEach((item: InventoryItem) => {
      invMap[item.id] = item;
    });

    setOrders((ordersRes.data || []) as PurchaseOrder[]);
    setItems(grouped);
    setInventory(invMap);
    setLoading(false);
  }

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();

    return orders.filter((order) => {
      const text = [
        orderCode(order),
        supplierName(order),
        order.status || "pendiente",
        order.reason || "",
      ].join(" ").toLowerCase();

      return (
        (!q || text.includes(q)) &&
        (statusFilter === "todos" || String(order.status || "pendiente") === statusFilter)
      );
    });
  }, [orders, search, statusFilter]);

  const totalEstimated = orders.reduce((sum, order) => sum + orderTotal(order), 0);

  const pendingCount = orders.filter((o) => {
    const status = String(o.status || "pendiente").toLowerCase();
    return status === "pendiente";
  }).length;

  const sentCount = orders.filter((o) => String(o.status || "").toLowerCase() === "enviado").length;

  const boughtCount = orders.filter((o) => {
    const status = String(o.status || "").toLowerCase();
    return status === "comprado" || status === "recibido" || status === "recibida";
  }).length;

  async function updateStatus(orderId: string, status: string) {
    const selectedOrder = orders.find((o) => o.id === orderId);

    if (!selectedOrder) {
      alert("No se encontró la orden.");
      return;
    }

    const currentStatus = String(selectedOrder.status || "pendiente").toLowerCase();

    if (currentStatus === "recibido" || currentStatus === "recibida") {
      alert("Esta orden ya fue recibida. No se puede recibir dos veces.");
      return;
    }

    if (status !== "recibido" && status !== "recibida") {
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) {
        alert("Error actualizando estado: " + error.message);
        return;
      }

      await loadOrders();
      return;
    }

    const confirmar = confirm(
      `¿Confirmas recibir la orden ${orderCode(selectedOrder)}? Esto sumará inventario y registrará movimientos.`
    );

    if (!confirmar) return;

    const orderItems = items[orderId] || [];

    if (orderItems.length === 0) {
      alert("Esta orden no tiene productos para recibir.");
      return;
    }

    setProcessingOrder(orderId);

    try {
      for (const item of orderItems) {
        const inventoryId = getProductId(item);
        const cantidad = itemQty(item);

        if (!inventoryId) {
          console.warn("Item sin inventory_id:", item);
          continue;
        }

        if (cantidad <= 0) {
          console.warn("Item con cantidad inválida:", item);
          continue;
        }

        let inv = inventory[inventoryId];

        if (!inv) {
          const { data: freshInv, error: freshError } = await supabase
            .from("inventory")
            .select("*")
            .eq("id", inventoryId)
            .single();

          if (freshError || !freshInv) {
            throw new Error("No se encontró material: " + (item.product_name || inventoryId));
          }

          inv = freshInv as InventoryItem;
        }

        const stockAntes = inventoryStock(inv);
        const stockDespues = stockAntes + cantidad;
        const costoUnitario = itemUnitCost(item) || inventoryCost(inv);
        const costoTotal = cantidad * costoUnitario;

        const { error: updateInvError } = await supabase
          .from("inventory")
          .update({
            stock: stockDespues,
            quantity: stockDespues,
            unit_cost: costoUnitario,
            purchase_cost: costoUnitario,
            cost_price: costoUnitario,
            cost: costoUnitario,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inventoryId);

        if (updateInvError) throw new Error(updateInvError.message);

        const { error: movError } = await supabase.from("inventory_movements").insert({
          inventory_id: inventoryId,
          product_id: inventoryId,
          item_id: inventoryId,
          type: "entrada",
          movement_type: "entrada",
          quantity: cantidad,
          qty: cantidad,
          stock_before: stockAntes,
          stock_after: stockDespues,
          reason: "Orden de compra recibida",
          note: `Entrada automática por orden ${orderCode(selectedOrder)}`,
          reference: orderCode(selectedOrder),
          order_code: orderCode(selectedOrder),
          unit_cost: costoUnitario,
          total_cost: costoTotal,
          created_at: new Date().toISOString(),
        });

        if (movError) throw new Error(movError.message);
      }

      const { error } = await supabase
        .from("purchase_orders")
        .update({
          status: "recibida",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) {
        throw new Error("Inventario recibido, pero error actualizando estado: " + error.message);
      }

      alert("Orden recibida correctamente. Inventario actualizado.");
      await loadOrders();
    } catch (err: any) {
      console.error(err);
      alert("Error recibiendo orden: " + (err?.message || "Error desconocido"));
    }

    setProcessingOrder(null);
  }

  function openWhatsApp(order: PurchaseOrder) {
    const orderItems = items[order.id] || [];

    const lines = [
      `Orden de compra: ${orderCode(order)}`,
      `Proveedor: ${supplierName(order)}`,
      "",
      "Materiales:",
      ...orderItems.map((item) => {
        const inv = getProductId(item) ? inventory[getProductId(item)!] : null;
        return `- ${item.product_name || inventoryName(inv)} | Cant: ${itemQty(item)} | Costo: ${money(itemUnitCost(item))}`;
      }),
      "",
      `Total estimado: ${money(orderTotal(order))}`,
    ];

    const message = order.whatsapp_message || lines.join("\n");
    const telefono = "18096905636";
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  function statusClass(status: string | null | undefined) {
    const value = String(status || "pendiente").toLowerCase();

    if (value === "comprado" || value === "recibido" || value === "recibida") {
      return "bg-emerald-400/10 text-emerald-300 border-emerald-400/20";
    }

    if (value === "cancelado") {
      return "bg-red-400/10 text-red-300 border-red-400/20";
    }

    if (value === "enviado") {
      return "bg-blue-400/10 text-blue-300 border-blue-400/20";
    }

    return "bg-amber-400/10 text-amber-300 border-amber-400/20";
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 lg:p-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[34px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-7 shadow-2xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-amber-300">
                RD Wood System
              </p>
              <h1 className="mt-2 text-3xl font-black text-white lg:text-4xl">
                Órdenes de Compra PRO
              </h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                Seguimiento de compras automáticas, materiales sugeridos, recepción e inventario.
              </p>
            </div>

            <button
              onClick={loadOrders}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-100">
            {message}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric icon={<ClipboardList size={20} />} title="Total órdenes" value={String(orders.length)} />
          <Metric icon={<AlertTriangle size={20} />} title="Pendientes" value={String(pendingCount)} danger={pendingCount > 0} />
          <Metric icon={<Truck size={20} />} title="Enviadas" value={String(sentCount)} />
          <Metric icon={<CheckCircle2 size={20} />} title="Compradas / recibidas" value={String(boughtCount)} success />
          <Metric icon={<PackageCheck size={20} />} title="Monto estimado" value={money(totalEstimated)} />
        </section>

        <section className="rounded-[34px] border border-white/10 bg-slate-900/90 p-5 shadow-xl">
          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3">
              <Search size={17} className="text-slate-400" />
              <input
                placeholder="Buscar orden, proveedor o estado..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-pro"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="enviado">Enviado</option>
              <option value="comprado">Comprado</option>
              <option value="recibida">Recibida</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </section>

        <section className="space-y-4">
          {loading ? (
            <Empty text="Cargando órdenes..." />
          ) : filteredOrders.length === 0 ? (
            <Empty text="No hay órdenes de compra para mostrar." />
          ) : (
            filteredOrders.map((order) => {
              const orderItems = items[order.id] || [];
              const isOpen = openOrder === order.id;
              const isProcessing = processingOrder === order.id;
              const status = String(order.status || "pendiente").toLowerCase();
              const isReceived = status === "recibido" || status === "recibida";

              return (
                <article key={order.id} className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/90 shadow-xl">
                  <button
                    onClick={() => setOpenOrder(isOpen ? null : order.id)}
                    className="flex w-full flex-col gap-4 p-5 text-left lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black text-white">
                          {isOpen ? "▼" : "▶"} {orderCode(order)}
                        </h2>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(order.status)}`}>
                          {(order.status || "pendiente").toUpperCase()}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-400">
                        {new Date(order.created_at || Date.now()).toLocaleString("es-DO")} ·{" "}
                        {supplierName(order)} · {orderItems.length} productos
                      </p>

                      {order.reason ? (
                        <p className="mt-1 text-xs text-slate-500">{order.reason}</p>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Total estimado
                      </p>
                      <p className="text-2xl font-black text-emerald-300">
                        {money(orderTotal(order))}
                      </p>
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-white/10 p-5">
                      <div className="mb-5 flex flex-wrap gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white hover:bg-emerald-400"
                          onClick={() => openWhatsApp(order)}
                        >
                          <MessageCircle size={17} />
                          WhatsApp
                        </button>

                        <button
                          className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50"
                          onClick={() => updateStatus(order.id, "enviado")}
                          disabled={isProcessing || isReceived}
                        >
                          Marcar enviado
                        </button>

                        <button
                          className="rounded-2xl bg-slate-700 px-4 py-3 text-sm font-black text-white hover:bg-slate-600 disabled:opacity-50"
                          onClick={() => updateStatus(order.id, "comprado")}
                          disabled={isProcessing || isReceived}
                        >
                          Marcar comprado
                        </button>

                        <button
                          className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                          onClick={() => updateStatus(order.id, "recibida")}
                          disabled={isProcessing || isReceived}
                        >
                          {isProcessing ? "Recibiendo..." : isReceived ? "Ya recibida" : "Marcar recibida"}
                        </button>

                        <button
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-black text-red-300 hover:bg-red-400/20 disabled:opacity-50"
                          onClick={() => updateStatus(order.id, "cancelado")}
                          disabled={isProcessing || isReceived}
                        >
                          <XCircle size={17} />
                          Cancelar
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left text-sm">
                          <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="py-3">Producto</th>
                              <th>Grupo</th>
                              <th>Stock actual</th>
                              <th>Mínimo</th>
                              <th>Máximo</th>
                              <th>Comprar</th>
                              <th>Costo</th>
                              <th>ID Inventario</th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-white/10">
                            {orderItems.length === 0 ? (
                              <tr>
                                <td className="py-8 text-center text-slate-400" colSpan={8}>
                                  Esta orden no tiene items registrados.
                                </td>
                              </tr>
                            ) : (
                              orderItems.map((item) => {
                                const productId = getProductId(item);
                                const inv = productId ? inventory[productId] : null;

                                return (
                                  <tr key={item.id}>
                                    <td className="py-4 font-black text-white">
                                      {item.product_name || inventoryName(inv)}
                                    </td>
                                    <td className="text-slate-300">
                                      {item.group_name || inv?.category || "-"} /{" "}
                                      {item.subgroup_name || "-"}
                                    </td>
                                    <td>{n(item.current_stock ?? inventoryStock(inv))} {item.unit || inv?.unit || ""}</td>
                                    <td>{n(item.min_stock)}</td>
                                    <td>{n(item.max_stock)}</td>
                                    <td className="font-black text-white">
                                      {itemQty(item)} {item.unit || inv?.unit || ""}
                                    </td>
                                    <td>{money(itemTotal(item))}</td>
                                    <td>
                                      {productId ? (
                                        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">
                                          OK
                                        </span>
                                      ) : (
                                        <span className="rounded-full bg-red-400/10 px-3 py-1 text-xs font-black text-red-300">
                                          Falta
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </section>
      </section>

      <style jsx global>{`
        .input-pro {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.9);
          padding: 0.85rem 1rem;
          color: white;
          outline: none;
        }

        .input-pro:focus {
          border-color: rgba(251, 191, 36, 0.7);
          box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.12);
        }

        .input-pro option {
          background: rgb(15 23 42);
          color: white;
        }
      `}</style>
    </main>
  );
}

function Metric({
  icon,
  title,
  value,
  danger,
  success,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <div
      className={`rounded-[28px] border p-5 shadow-xl ${
        danger
          ? "border-red-400/25 bg-red-400/10"
          : success
          ? "border-emerald-400/25 bg-emerald-400/10"
          : "border-white/10 bg-slate-900/90"
      }`}
    >
      <div className={danger ? "text-red-300" : success ? "text-emerald-300" : "text-amber-300"}>
        {icon}
      </div>
      <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <p className="mt-1 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-[34px] border border-dashed border-white/15 bg-slate-900/70 p-10 text-center text-sm font-bold text-slate-400">
      {text}
    </div>
  );
}
