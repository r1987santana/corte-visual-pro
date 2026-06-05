"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Database,
  Edit3,
  Layers3,
  Loader2,
  PackagePlus,
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Warehouse,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Item = any;
type FilterMode = "todos" | "criticos" | "precio_cero" | "margen_negativo";

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

function itemName(i: Item) {
  return i.material || i.name || i.product_name || i.description || "Producto sin nombre";
}

function stock(i: Item) {
  return n(i.stock ?? i.quantity ?? i.qty ?? 0);
}

function minStock(i: Item) {
  return n(i.minimo ?? i.min_stock ?? i.minimum_stock ?? 0);
}

function cost(i: Item) {
  return n(i.costo_promedio ?? i.unit_cost ?? i.purchase_cost ?? i.cost_price ?? i.cost ?? 0);
}

function sale(i: Item) {
  return n(i.precio_venta ?? i.sale_price ?? i.price ?? 0);
}

function category(i: Item) {
  return i.subgrupo || i.category || i.sub_category || "-";
}

function typeName(i: Item) {
  return i.grupo || i.subcategory || i.type || i.group_name || "-";
}

function unit(i: Item) {
  return i.unidad || i.unit || "Unidad";
}

function code(i: Item) {
  return i.code || i.sku || i.codigo || "-";
}

function marginValue(i: Item) {
  return sale(i) - cost(i);
}

function marginPercent(i: Item) {
  const v = sale(i);
  if (v <= 0) return 0;
  return (marginValue(i) / v) * 100;
}

export default function InventarioInteligentePage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [realtime, setRealtime] = useState("Conectando...");
  const [lastUpdate, setLastUpdate] = useState("");

  const [searchText, setSearchText] = useState("");
  const [groupFilter, setGroupFilter] = useState("todos");
  const [filterMode, setFilterMode] = useState<FilterMode>("todos");

  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editStock, setEditStock] = useState("");
  const [editMin, setEditMin] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editSale, setEditSale] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadInventory() {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("material", { ascending: true });

    if (error) {
      setErrorMessage("Error cargando inventario: " + error.message);
      setItems([]);
    } else {
      setItems(data || []);
      setLastUpdate(new Date().toLocaleTimeString("es-DO"));
    }

    setLoading(false);
  }

  useEffect(() => {
    setMounted(true);
    loadInventory();

    const channel = supabase
      .channel("inventory-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        () => loadInventory()
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtime("Realtime activo");
        else if (status === "CHANNEL_ERROR") setRealtime("Realtime con error");
        else setRealtime(status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const groups = useMemo(() => {
    const list = new Set<string>();
    items.forEach((i) => {
      const g = typeName(i);
      if (g && g !== "-") list.add(g);
    });
    return Array.from(list).sort();
  }, [items]);

  const resumen = useMemo(() => {
    let totalCost = 0;
    let totalSale = 0;
    let critical = 0;
    let zeroSale = 0;
    let negativeMargin = 0;
    let totalUnits = 0;

    items.forEach((i) => {
      const s = stock(i);
      const c = cost(i);
      const v = sale(i);

      totalUnits += s;
      totalCost += s * c;
      totalSale += s * v;

      if (s <= minStock(i)) critical += 1;
      if (v <= 0) zeroSale += 1;
      if (v - c < 0) negativeMargin += 1;
    });

    return {
      products: items.length,
      totalUnits,
      totalCost,
      totalSale,
      potentialProfit: totalSale - totalCost,
      critical,
      zeroSale,
      negativeMargin,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return items.filter((i) => {
      const s = stock(i);
      const min = minStock(i);
      const c = cost(i);
      const v = sale(i);
      const margin = v - c;

      const matchesSearch =
        !q ||
        itemName(i).toLowerCase().includes(q) ||
        code(i).toLowerCase().includes(q) ||
        category(i).toLowerCase().includes(q) ||
        typeName(i).toLowerCase().includes(q);

      const matchesGroup = groupFilter === "todos" || typeName(i) === groupFilter;

      let matchesMode = true;
      if (filterMode === "criticos") matchesMode = s <= min;
      if (filterMode === "precio_cero") matchesMode = v <= 0;
      if (filterMode === "margen_negativo") matchesMode = margin < 0;

      return matchesSearch && matchesGroup && matchesMode;
    });
  }, [items, searchText, groupFilter, filterMode]);

  const criticalItems = useMemo(() => {
    return items
      .filter((item) => stock(item) <= minStock(item))
      .slice(0, 8);
  }, [items]);

  function openEdit(item: Item) {
    setEditingItem(item);
    setEditStock(String(stock(item)));
    setEditMin(String(minStock(item)));
    setEditCost(String(cost(item)));
    setEditSale(String(sale(item)));
  }

  function closeEdit() {
    setEditingItem(null);
    setEditStock("");
    setEditMin("");
    setEditCost("");
    setEditSale("");
  }

  async function saveEdit() {
    if (!editingItem?.id) return;

    setSaving(true);
    setErrorMessage("");

    const newStock = n(editStock);
    const newMin = n(editMin);
    const newCost = n(editCost);
    const newSale = n(editSale);

    const payload = {
      stock: newStock,
      quantity: newStock,
      minimo: newMin,
      min_stock: newMin,
      minimum_stock: newMin,
      costo_promedio: newCost,
      unit_cost: newCost,
      purchase_cost: newCost,
      cost_price: newCost,
      cost: newCost,
      precio_venta: newSale,
      sale_price: newSale,
      price: newSale,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("inventory")
      .update(payload)
      .eq("id", editingItem.id);

    setSaving(false);

    if (error) {
      setErrorMessage("Error actualizando producto: " + error.message);
      return;
    }

    closeEdit();
    await loadInventory();
  }

  if (!mounted) {
    return (
      <main className="min-h-screen bg-[#030712] p-8 text-slate-100">
        <div className="flex min-h-[400px] items-center justify-center rounded-[28px] border border-white/10 bg-slate-950/70">
          <div className="flex items-center gap-3 text-cyan-100">
            <Loader2 className="h-6 w-6 animate-spin" />
            Cargando Inventario Inteligente PRO...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#030712] text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-7 p-5 md:p-8">
        <section className="overflow-hidden rounded-[30px] border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/25 shadow-2xl shadow-cyan-950/20">
          <div className="grid gap-6 p-6 xl:grid-cols-[1.35fr_.65fr] xl:p-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-200">
                <Database className="h-4 w-4" />
                Fase 5A · SaaS PRO · Sin cambiar lógica
              </div>

              <div>
                <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                  Inventario Inteligente PRO
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
                  Control premium de productos, stock, costos, precios, margen, alertas críticas y conexión directa con Producción.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/inventario-inteligente/nuevo"
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/20"
                >
                  <PackagePlus className="h-4 w-4" />
                  Nuevo producto
                </Link>

                <Link
                  href="/inventario-inteligente/movimientos"
                  className="inline-flex items-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm font-black text-blue-100 transition hover:bg-blue-400/20"
                >
                  <ArrowDownUp className="h-4 w-4" />
                  Movimientos / Kardex
                </Link>

                <button
                  type="button"
                  onClick={loadInventory}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  {loading ? "Cargando..." : "Actualizar"}
                </button>
              </div>

              {errorMessage && (
                <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-semibold text-red-100">
                  {errorMessage}
                </div>
              )}
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Estado del sistema</p>
                  <h2 className="text-xl font-black text-white">Producción conectada</h2>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                  <span className="font-bold text-slate-300">Realtime</span>
                  <span className="font-black text-cyan-200">{realtime}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                  <span className="font-bold text-slate-300">Última actualización</span>
                  <span className="font-black text-slate-100">{lastUpdate || "-"}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                  <span className="font-bold text-slate-300">Ruta protegida</span>
                  <span className="font-black text-emerald-200">Sin cambios críticos</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Productos",
              value: resumen.products,
              detail: `${resumen.totalUnits.toLocaleString("es-DO")} unidades`,
              icon: Boxes,
            },
            {
              label: "Valor costo",
              value: money(resumen.totalCost),
              detail: "Inventario valorizado",
              icon: Warehouse,
            },
            {
              label: "Valor venta",
              value: money(resumen.totalSale),
              detail: "Potencial bruto",
              icon: CircleDollarSign,
            },
            {
              label: "Utilidad potencial",
              value: money(resumen.potentialProfit),
              detail: "Venta - costo",
              icon: resumen.potentialProfit >= 0 ? TrendingUp : TrendingDown,
            },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="rounded-[26px] border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-right text-2xl font-black text-white">{metric.value}</p>
                </div>
                <p className="mt-4 text-sm font-black text-slate-300">{metric.label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{metric.detail}</p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_400px]">
          <div className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
            <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Inventario operativo</h2>
                <p className="text-sm text-slate-500">
                  Lista principal usada por Producción, Corte, Compras y Ventas.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-11 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
                  />
                </div>

                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
                >
                  <option value="todos">Todos los grupos</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>

                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
                >
                  <option value="todos">Todos</option>
                  <option value="criticos">Stock crítico</option>
                  <option value="precio_cero">Precio cero</option>
                  <option value="margen_negativo">Margen negativo</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-white/10 bg-slate-900/60">
                <div className="flex items-center gap-3 text-cyan-100">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Cargando inventario...
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[24px] border border-white/10">
                <div className="hidden grid-cols-[1.1fr_.7fr_.5fr_.6fr_.6fr_.6fr_.5fr] gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500 xl:grid">
                  <div>Producto</div>
                  <div>Grupo</div>
                  <div>Stock</div>
                  <div>Costo</div>
                  <div>Venta</div>
                  <div>Margen</div>
                  <div>Acción</div>
                </div>

                <div className="divide-y divide-white/10">
                  {filteredItems.map((item) => {
                    const s = stock(item);
                    const min = minStock(item);
                    const isCritical = s <= min;
                    const margin = marginValue(item);
                    const marginPct = marginPercent(item);

                    return (
                      <article
                        key={item.id || code(item) || itemName(item)}
                        className="grid gap-3 bg-slate-950/40 px-4 py-4 transition hover:bg-cyan-400/[0.04] xl:grid-cols-[1.1fr_.7fr_.5fr_.6fr_.6fr_.6fr_.5fr] xl:items-center"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black text-white">{itemName(item)}</p>
                            {isCritical && (
                              <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] font-black text-red-200">
                                Crítico
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Código: {code(item)} · Unidad: {unit(item)}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm font-black text-slate-200">{typeName(item)}</p>
                          <p className="text-xs text-slate-500">{category(item)}</p>
                        </div>

                        <div>
                          <p className={`text-lg font-black ${isCritical ? "text-red-200" : "text-white"}`}>{s}</p>
                          <p className="text-xs text-slate-500">Mín: {min}</p>
                        </div>

                        <div>
                          <p className="font-black text-slate-100">{money(cost(item))}</p>
                          <p className="text-xs text-slate-500">Costo</p>
                        </div>

                        <div>
                          <p className="font-black text-slate-100">{money(sale(item))}</p>
                          <p className="text-xs text-slate-500">Precio</p>
                        </div>

                        <div>
                          <p className={`font-black ${margin >= 0 ? "text-emerald-200" : "text-red-200"}`}>
                            {money(margin)}
                          </p>
                          <p className="text-xs text-slate-500">{marginPct.toFixed(1)}%</p>
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100 hover:bg-cyan-400/20"
                          >
                            <Edit3 className="h-4 w-4" />
                            Editar
                          </button>
                        </div>
                      </article>
                    );
                  })}

                  {!filteredItems.length && (
                    <div className="flex min-h-[220px] items-center justify-center text-sm font-semibold text-slate-500">
                      No hay productos con esos filtros.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
              <h2 className="text-xl font-black text-white">Alertas inteligentes</h2>
              <p className="mt-1 text-sm text-slate-500">Prioridades que afectan producción y ventas.</p>

              <div className="mt-5 grid gap-3">
                {[
                  {
                    label: "Stock crítico",
                    value: resumen.critical,
                    icon: AlertTriangle,
                    color: "text-red-200 border-red-400/20 bg-red-400/10",
                  },
                  {
                    label: "Precio de venta cero",
                    value: resumen.zeroSale,
                    icon: CircleDollarSign,
                    color: "text-amber-200 border-amber-400/20 bg-amber-400/10",
                  },
                  {
                    label: "Margen negativo",
                    value: resumen.negativeMargin,
                    icon: TrendingDown,
                    color: "text-violet-200 border-violet-400/20 bg-violet-400/10",
                  },
                ].map((alert) => {
                  const Icon = alert.icon;
                  return (
                    <button
                      key={alert.label}
                      onClick={() => {
                        if (alert.label === "Stock crítico") setFilterMode("criticos");
                        if (alert.label === "Precio de venta cero") setFilterMode("precio_cero");
                        if (alert.label === "Margen negativo") setFilterMode("margen_negativo");
                      }}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${alert.color}`}
                    >
                      <span className="inline-flex items-center gap-3 font-black">
                        <Icon className="h-5 w-5" />
                        {alert.label}
                      </span>
                      <span className="text-xl font-black">{alert.value}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
              <h2 className="text-xl font-black text-white">Críticos para producción</h2>
              <p className="mt-1 text-sm text-slate-500">Productos con stock en mínimo o por debajo.</p>

              <div className="mt-5 space-y-3">
                {criticalItems.map((item) => (
                  <div key={item.id || itemName(item)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-white">{itemName(item)}</p>
                        <p className="mt-1 text-xs text-slate-500">{typeName(item)} · {category(item)}</p>
                      </div>
                      <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-black text-red-200">
                        {stock(item)} / {minStock(item)}
                      </span>
                    </div>
                  </div>
                ))}

                {!criticalItems.length && (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-100">
                    <CheckCircle2 className="mb-2 h-5 w-5" />
                    No hay productos críticos actualmente.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">Edición rápida</p>
                <h2 className="mt-2 text-2xl font-black text-white">{itemName(editingItem)}</h2>
                <p className="mt-1 text-sm text-slate-500">Actualiza stock, mínimo, costo y precio sin salir del inventario.</p>
              </div>
              <button onClick={closeEdit} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["Stock actual", editStock, setEditStock],
                ["Stock mínimo", editMin, setEditMin],
                ["Costo promedio", editCost, setEditCost],
                ["Precio venta", editSale, setEditSale],
              ].map(([label, value, setter]: any) => (
                <label key={label} className="space-y-2">
                  <span className="text-sm font-black text-slate-300">{label}</span>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50"
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                onClick={closeEdit}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
