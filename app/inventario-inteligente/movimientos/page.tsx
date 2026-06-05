"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUp,
  Boxes,
  CalendarDays,
  CheckCircle2,
  Database,
  Filter,
  Loader2,
  PackageSearch,
  RefreshCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Warehouse,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Movement = any;
type Item = any;
type MovementType = "todos" | "entrada" | "salida" | "ajuste" | "transferencia" | "produccion" | "venta" | "compra";

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
    return new Date(v).toLocaleString("es-DO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(v);
  }
}

function getType(m: Movement) {
  return String(m.type || m.tipo || m.movement_type || m.action || "movimiento").toLowerCase();
}

function getQty(m: Movement) {
  return n(m.quantity ?? m.qty ?? m.cantidad ?? m.amount ?? 0);
}

function getBefore(m: Movement) {
  return n(m.stock_before ?? m.before_stock ?? m.stock_anterior ?? m.previous_stock ?? 0);
}

function getAfter(m: Movement) {
  return n(m.stock_after ?? m.after_stock ?? m.stock_nuevo ?? m.new_stock ?? 0);
}

function getCost(m: Movement) {
  return n(m.unit_cost ?? m.costo_unitario ?? m.cost ?? m.costo ?? 0);
}

function getTotal(m: Movement) {
  return n(m.total_cost ?? m.total ?? m.valor_total ?? getQty(m) * getCost(m));
}

function getProductName(m: Movement, inventoryMap: Map<string, Item>) {
  const direct = m.product_name || m.item_name || m.material || m.description;
  if (direct) return direct;

  const id = m.inventory_id || m.product_id || m.item_id;
  const item = id ? inventoryMap.get(String(id)) : null;
  if (!item) return "Producto sin identificar";

  return item.material || item.name || item.product_name || item.description || "Producto sin nombre";
}

function getReference(m: Movement) {
  return m.reference || m.referencia || m.document_no || m.source || m.origin || "-";
}

function getUser(m: Movement) {
  return m.user_name || m.created_by_name || m.responsable || m.operator || "Sistema";
}

function getDate(m: Movement) {
  return m.created_at || m.date || m.fecha || m.movement_date;
}

function normalizeType(t: string): MovementType {
  const v = t.toLowerCase();
  if (v.includes("entrada") || v.includes("in")) return "entrada";
  if (v.includes("salida") || v.includes("out")) return "salida";
  if (v.includes("ajuste")) return "ajuste";
  if (v.includes("transfer")) return "transferencia";
  if (v.includes("produccion") || v.includes("production")) return "produccion";
  if (v.includes("venta") || v.includes("sale")) return "venta";
  if (v.includes("compra") || v.includes("purchase")) return "compra";
  return "ajuste";
}

const typeStyles: Record<string, string> = {
  entrada: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  compra: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  salida: "border-red-400/30 bg-red-400/10 text-red-200",
  venta: "border-red-400/30 bg-red-400/10 text-red-200",
  produccion: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  ajuste: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  transferencia: "border-blue-400/30 bg-blue-400/10 text-blue-200",
};

function typeIcon(type: string) {
  const t = normalizeType(type);
  if (t === "entrada" || t === "compra") return ArrowDown;
  if (t === "salida" || t === "venta") return ArrowUp;
  if (t === "transferencia") return ArrowRightLeft;
  return SlidersHorizontal;
}

export default function MovimientosInventarioPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [sourceTable, setSourceTable] = useState("inventory_movements");
  const [loading, setLoading] = useState(true);
  const [realtime, setRealtime] = useState("Conectando...");
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<MovementType>("todos");
  const [productFilter, setProductFilter] = useState("todos");

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    const inventoryRes = await supabase
      .from("inventory")
      .select("*")
      .order("material", { ascending: true });

    if (inventoryRes.error) {
      setErrorMessage("Error cargando inventory: " + inventoryRes.error.message);
    } else {
      setItems(inventoryRes.data || []);
    }

    let movementRes = await supabase
      .from("inventory_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (movementRes.error) {
      const fallback = await supabase
        .from("movimientos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      if (fallback.error) {
        setErrorMessage("No pude leer inventory_movements ni movimientos: " + fallback.error.message);
        setMovements([]);
      } else {
        setSourceTable("movimientos");
        setMovements(fallback.data || []);
      }
    } else {
      setSourceTable("inventory_movements");
      setMovements(movementRes.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("inventory-movements-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_movements" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "movimientos" }, () => loadData())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtime("Realtime activo");
        else if (status === "CHANNEL_ERROR") setRealtime("Realtime con error");
        else setRealtime(status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const inventoryMap = useMemo(() => {
    const map = new Map<string, Item>();
    items.forEach((i) => {
      if (i.id) map.set(String(i.id), i);
    });
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return movements.filter((m) => {
      const rawType = getType(m);
      const normalized = normalizeType(rawType);
      const productName = getProductName(m, inventoryMap);
      const ref = getReference(m);
      const user = getUser(m);

      const matchesQuery =
        !q ||
        productName.toLowerCase().includes(q) ||
        ref.toLowerCase().includes(q) ||
        user.toLowerCase().includes(q) ||
        rawType.toLowerCase().includes(q);

      const matchesType = typeFilter === "todos" || normalized === typeFilter;
      const matchesProduct = productFilter === "todos" || productName === productFilter;

      return matchesQuery && matchesType && matchesProduct;
    });
  }, [movements, query, typeFilter, productFilter, inventoryMap]);

  const products = useMemo(() => {
    const set = new Set<string>();
    movements.forEach((m) => set.add(getProductName(m, inventoryMap)));
    return Array.from(set).sort();
  }, [movements, inventoryMap]);

  const summary = useMemo(() => {
    let entradas = 0;
    let salidas = 0;
    let ajustes = 0;
    let valor = 0;

    movements.forEach((m) => {
      const t = normalizeType(getType(m));
      const qty = Math.abs(getQty(m));
      if (t === "entrada" || t === "compra") entradas += qty;
      else if (t === "salida" || t === "venta" || t === "produccion") salidas += qty;
      else ajustes += qty;
      valor += getTotal(m);
    });

    return { total: movements.length, entradas, salidas, ajustes, valor };
  }, [movements]);

  const latest = filtered.slice(0, 100);

  return (
    <main className="min-h-screen bg-[#030712] text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-7 p-5 md:p-8">
        <section className="overflow-hidden rounded-[30px] border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/25 shadow-2xl shadow-cyan-950/20">
          <div className="grid gap-6 p-6 xl:grid-cols-[1.35fr_.65fr] xl:p-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-200">
                <Database className="h-4 w-4" />
                Fase 5C · Kardex SaaS PRO
              </div>

              <div>
                <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                  Movimientos / Kardex PRO
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
                  Historial profesional de entradas, salidas, ajustes, producción, ventas y compras del Inventario Inteligente.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/inventario-inteligente"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al inventario
                </Link>

                <button
                  onClick={loadData}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  Actualizar
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
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Fuente de datos</p>
                  <h2 className="text-xl font-black text-white">{sourceTable}</h2>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                  <span className="font-bold text-slate-300">Realtime</span>
                  <span className="font-black text-cyan-200">{realtime}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                  <span className="font-bold text-slate-300">Productos</span>
                  <span className="font-black text-white">{items.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                  <span className="font-bold text-slate-300">Movimientos</span>
                  <span className="font-black text-emerald-200">{movements.length}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Movimientos", value: summary.total, detail: "Registros históricos", icon: PackageSearch },
            { label: "Entradas", value: summary.entradas.toLocaleString("es-DO"), detail: "Compras / ajustes +", icon: ArrowDown },
            { label: "Salidas", value: summary.salidas.toLocaleString("es-DO"), detail: "Ventas / producción", icon: ArrowUp },
            { label: "Valor movido", value: money(summary.valor), detail: "Costo total", icon: Warehouse },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="rounded-[26px] border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20">
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

        <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
            <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Historial de movimientos</h2>
                <p className="text-sm text-slate-500">Mostrando hasta 100 registros filtrados.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-11 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
                  />
                </div>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as MovementType)}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
                >
                  <option value="todos">Todos los tipos</option>
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                  <option value="ajuste">Ajuste</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="produccion">Producción</option>
                  <option value="venta">Venta</option>
                  <option value="compra">Compra</option>
                </select>

                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
                >
                  <option value="todos">Todos los productos</option>
                  {products.slice(0, 200).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-white/10 bg-slate-900/60">
                <div className="flex items-center gap-3 text-cyan-100">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Cargando movimientos...
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[24px] border border-white/10">
                <div className="hidden grid-cols-[.7fr_1.3fr_.5fr_.5fr_.7fr_.8fr_.8fr] gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500 xl:grid">
                  <div>Tipo</div>
                  <div>Producto</div>
                  <div>Cant.</div>
                  <div>Costo</div>
                  <div>Stock</div>
                  <div>Referencia</div>
                  <div>Fecha</div>
                </div>

                <div className="divide-y divide-white/10">
                  {latest.map((m, idx) => {
                    const raw = getType(m);
                    const t = normalizeType(raw);
                    const Icon = typeIcon(raw);
                    const productName = getProductName(m, inventoryMap);

                    return (
                      <article
                        key={m.id || idx}
                        className="grid gap-3 bg-slate-950/40 px-4 py-4 transition hover:bg-cyan-400/[0.04] xl:grid-cols-[.7fr_1.3fr_.5fr_.5fr_.7fr_.8fr_.8fr] xl:items-center"
                      >
                        <div>
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${typeStyles[t] || typeStyles.ajuste}`}>
                            <Icon className="h-4 w-4" />
                            {t}
                          </span>
                        </div>

                        <div>
                          <p className="font-black text-white">{productName}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">Usuario: {getUser(m)}</p>
                        </div>

                        <div>
                          <p className="text-lg font-black text-white">{getQty(m)}</p>
                        </div>

                        <div>
                          <p className="font-black text-slate-100">{money(getCost(m))}</p>
                          <p className="text-xs text-slate-500">Total {money(getTotal(m))}</p>
                        </div>

                        <div>
                          <p className="font-black text-slate-100">{getBefore(m)} → {getAfter(m)}</p>
                          <p className="text-xs text-slate-500">Antes / Después</p>
                        </div>

                        <div>
                          <p className="font-semibold text-slate-300">{getReference(m)}</p>
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-300">{fmtDate(getDate(m))}</p>
                        </div>
                      </article>
                    );
                  })}

                  {!latest.length && (
                    <div className="flex min-h-[220px] items-center justify-center text-sm font-semibold text-slate-500">
                      No hay movimientos con esos filtros.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
              <h2 className="text-xl font-black text-white">Control de auditoría</h2>
              <p className="mt-1 text-sm text-slate-500">Lectura segura sin modificar datos.</p>

              <div className="mt-5 grid gap-3">
                {[
                  ["Fuente", sourceTable, Database],
                  ["Filtrados", filtered.length.toLocaleString("es-DO"), Filter],
                  ["Productos", products.length.toLocaleString("es-DO"), Boxes],
                  ["Estado", errorMessage ? "Revisar" : "OK", errorMessage ? AlertTriangle : CheckCircle2],
                ].map(([label, value, Icon]: any) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-400">
                      <Icon className="h-4 w-4 text-cyan-200" />
                      {label}
                    </span>
                    <span className="font-black text-white">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
              <h2 className="text-xl font-black text-white">Tipos de movimiento</h2>
              <div className="mt-5 space-y-3">
                {["entrada", "salida", "produccion", "compra", "venta", "ajuste", "transferencia"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t as MovementType)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-black ${typeStyles[t] || typeStyles.ajuste}`}
                  >
                    <span className="capitalize">{t}</span>
                    <span>Ver</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-amber-400/20 bg-amber-400/10 p-5">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-1 h-5 w-5 text-amber-200" />
                <div>
                  <h2 className="font-black text-amber-100">Siguiente mejora</h2>
                  <p className="mt-2 text-sm leading-6 text-amber-100/75">
                    Después de esta fase conviene agregar creación manual de movimiento con validación de stock y actualización automática del inventario.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
