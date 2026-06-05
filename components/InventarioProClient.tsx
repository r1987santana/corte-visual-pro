"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  DollarSign,
  Edit3,
  Filter,
  Layers,
  PackagePlus,
  RefreshCw,
  Save,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

type Product = {
  id: string;
  code?: string | null;
  name?: string | null;
  product_name?: string | null;
  material?: string | null;
  category?: string | null;
  subcategory?: string | null;
  grupo?: string | null;
  group_name?: string | null;
  subgrupo?: string | null;
  unit?: string | null;
  unidad?: string | null;
  stock?: number | null;
  quantity?: number | null;
  sale_price?: number | null;
  price?: number | null;
  precio_venta?: number | null;
  venta?: number | null;
  unit_price?: number | null;
  purchase_cost?: number | null;
  cost?: number | null;
  cost_price?: number | null;
  unit_cost?: number | null;
  costo_prom?: number | null;
  costo_promedio?: number | null;
  min_stock?: number | null;
  minimum_stock?: number | null;
  minimo?: number | null;
  supplier?: string | null;
  proveedor?: string | null;
  location?: string | null;
  status?: string | null;
  notes?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type Movement = {
  id: string;
  product_id?: string | null;
  product_name?: string | null;
  movement_type?: string | null;
  tipo?: string | null;
  origin?: string | null;
  origen?: string | null;
  quantity?: number | null;
  qty?: number | null;
  cantidad?: number | null;
  stock_before?: number | null;
  stock_antes?: number | null;
  stock_after?: number | null;
  stock_despues?: number | null;
  unit_cost?: number | null;
  costo_unitario?: number | null;
  reference?: string | null;
  referencia?: string | null;
  note?: string | null;
  nota?: string | null;
  created_at?: string | null;
  fecha?: string | null;
};

type DraftProduct = {
  code: string;
  name: string;
  category: string;
  subcategory: string;
  unit: string;
  stock: string;
  min_stock: string;
  cost_price: string;
  sale_price: string;
  supplier: string;
  location: string;
  notes: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const num = (value: unknown) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};

const productName = (p: Product) => p.name || p.product_name || p.material || "Producto sin nombre";
const productCode = (p: Product) => p.code || "SIN-CODIGO";
const productUnit = (p: Product) => p.unit || p.unidad || "Unidad";
const productCategory = (p: Product) => p.category || p.grupo || p.group_name || "General";
const productSubcategory = (p: Product) => p.subcategory || p.subgrupo || "";
const stockOf = (p: Product) => num(p.stock ?? p.quantity);
const minStockOf = (p: Product) => num(p.min_stock ?? p.minimum_stock ?? p.minimo);
const costOf = (p: Product) => num(p.cost_price ?? p.unit_cost ?? p.purchase_cost ?? p.cost ?? p.costo_prom ?? p.costo_promedio);
const priceOf = (p: Product) => num(p.sale_price ?? p.price ?? p.precio_venta ?? p.venta ?? p.unit_price);
const supplierOf = (p: Product) => p.supplier || p.proveedor || "";

const emptyDraft: DraftProduct = {
  code: "",
  name: "",
  category: "General",
  subcategory: "",
  unit: "Unidad",
  stock: "0",
  min_stock: "0",
  cost_price: "0",
  sale_price: "0",
  supplier: "",
  location: "",
  notes: "",
};

export default function InventarioProClient({
  initialProducts,
  initialDebug,
}: {
  initialProducts: Product[];
  initialDebug?: string;
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [stockFilter, setStockFilter] = useState<"todos" | "bajo" | "disponible" | "sin_stock">("todos");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [debug, setDebug] = useState(initialDebug || "Inventario listo");
  const [selected, setSelected] = useState<Product | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<DraftProduct>(emptyDraft);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(productCategory(p)));
    return ["Todas", ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const st = stockOf(p);
      const min = minStockOf(p);
      const hay = [productName(p), productCode(p), productCategory(p), productSubcategory(p), supplierOf(p)]
        .join(" ")
        .toLowerCase()
        .includes(q);
      const categoryOk = categoryFilter === "Todas" || productCategory(p) === categoryFilter;
      const stockOk =
        stockFilter === "todos" ||
        (stockFilter === "bajo" && st > 0 && min > 0 && st <= min) ||
        (stockFilter === "disponible" && st > 0) ||
        (stockFilter === "sin_stock" && st <= 0);
      return hay && categoryOk && stockOk;
    });
  }, [products, query, categoryFilter, stockFilter]);

  const totals = useMemo(() => {
    const totalProducts = products.length;
    const stockValue = products.reduce((acc, p) => acc + stockOf(p) * costOf(p), 0);
    const saleValue = products.reduce((acc, p) => acc + stockOf(p) * priceOf(p), 0);
    const lowStock = products.filter((p) => stockOf(p) > 0 && minStockOf(p) > 0 && stockOf(p) <= minStockOf(p)).length;
    const noStock = products.filter((p) => stockOf(p) <= 0).length;
    return { totalProducts, stockValue, saleValue, lowStock, noStock };
  }, [products]);

  async function loadProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .or("status.is.null,status.eq.active,status.eq.activo")
      .order("name", { ascending: true });

    if (error) {
      setDebug(`Error cargando inventario: ${error.message}`);
    } else {
      setProducts((data || []) as Product[]);
      setDebug(`Inventario actualizado: ${data?.length || 0} productos`);
    }
    setLoading(false);
  }

  async function openProduct(product: Product) {
    setSelected(product);
    setLoadingMovements(true);
    const { data, error } = await supabase
      .from("inventory_movements")
      .select("*")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      setMovements([]);
      setDebug(`No se pudo cargar historial: ${error.message}`);
    } else {
      setMovements((data || []) as Movement[]);
    }
    setLoadingMovements(false);
  }

  function updateLocal(id: string, patch: Partial<Product>) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }

  async function saveProduct(product: Product) {
    setSavingId(product.id);
    const cleanName = productName(product).trim();
    const stock = stockOf(product);
    const minStock = minStockOf(product);
    const cost = costOf(product);
    const price = priceOf(product);

    const payload = {
      code: productCode(product),
      name: cleanName,
      product_name: cleanName,
      category: productCategory(product),
      grupo: productCategory(product),
      subcategory: productSubcategory(product),
      subgrupo: productSubcategory(product),
      unit: productUnit(product),
      unidad: productUnit(product),
      stock,
      quantity: stock,
      min_stock: minStock,
      minimum_stock: minStock,
      minimo: minStock,
      purchase_cost: cost,
      cost_price: cost,
      unit_cost: cost,
      cost,
      costo_prom: cost,
      costo_promedio: cost,
      sale_price: price,
      price,
      unit_price: price,
      venta: price,
      precio_venta: price,
      supplier: supplierOf(product),
      proveedor: supplierOf(product),
      location: product.location || "",
      notes: product.notes || "",
      updated_at: new Date().toISOString(),
      status: product.status || "active",
    };

    const { error } = await supabase.from("inventory").update(payload).eq("id", product.id);

    if (error) {
      alert(`No se pudo guardar: ${error.message}`);
      setDebug(`Error guardando producto: ${error.message}`);
    } else {
      updateLocal(product.id, payload as Partial<Product>);
      setDebug(`Guardado: ${cleanName}`);
    }
    setSavingId(null);
  }

  async function adjustStock(product: Product, mode: "entrada" | "salida" | "ajuste") {
    const current = stockOf(product);
    const raw = window.prompt(
      mode === "ajuste"
        ? `Stock actual: ${current}. Escribe el NUEVO stock exacto:`
        : `Stock actual: ${current}. Cantidad de ${mode}:`
    );
    if (raw === null) return;
    const amount = num(raw);
    if (amount < 0) return alert("No uses números negativos.");

    const nextStock = mode === "entrada" ? current + amount : mode === "salida" ? current - amount : amount;
    if (nextStock < 0) return alert("No puedes dejar stock negativo.");

    setSavingId(product.id);
    const movementQty = mode === "ajuste" ? Math.abs(nextStock - current) : amount;
    const movementCost = costOf(product);

    const { error: updateError } = await supabase
      .from("inventory")
      .update({
        stock: nextStock,
        quantity: nextStock,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);

    if (updateError) {
      alert(`No se pudo ajustar stock: ${updateError.message}`);
      setSavingId(null);
      return;
    }

    await supabase.from("inventory_movements").insert({
      product_id: product.id,
      product_name: productName(product),
      movement_type: mode,
      type: mode,
      tipo: mode,
      origin: "inventario",
      origen: "inventario",
      quantity: movementQty,
      qty: movementQty,
      cantidad: movementQty,
      stock_before: current,
      stock_antes: current,
      stock_after: nextStock,
      stock_despues: nextStock,
      unit_cost: movementCost,
      costo_unitario: movementCost,
      total_cost: movementCost * movementQty,
      costo_total: movementCost * movementQty,
      reference: `INV-${Date.now()}`,
      referencia: `INV-${Date.now()}`,
      note: `Movimiento manual desde inventario PRO`,
      nota: `Movimiento manual desde inventario PRO`,
    });

    updateLocal(product.id, { stock: nextStock, quantity: nextStock });
    setDebug(`Stock actualizado: ${productName(product)} ${current} → ${nextStock}`);
    setSavingId(null);
  }

  async function createProduct() {
    if (!draft.name.trim()) return alert("Escribe el nombre del producto.");
    setLoading(true);
    const code = draft.code.trim() || `INV-${Date.now()}`;
    const stock = num(draft.stock);
    const minStock = num(draft.min_stock);
    const cost = num(draft.cost_price);
    const price = num(draft.sale_price);
    const name = draft.name.trim();

    const payload = {
      code,
      name,
      product_name: name,
      material: name,
      category: draft.category.trim() || "General",
      grupo: draft.category.trim() || "General",
      subcategory: draft.subcategory.trim(),
      subgrupo: draft.subcategory.trim(),
      unit: draft.unit.trim() || "Unidad",
      unidad: draft.unit.trim() || "Unidad",
      stock,
      quantity: stock,
      min_stock: minStock,
      minimum_stock: minStock,
      minimo: minStock,
      purchase_cost: cost,
      cost_price: cost,
      unit_cost: cost,
      cost,
      costo_prom: cost,
      costo_promedio: cost,
      sale_price: price,
      price,
      unit_price: price,
      precio_venta: price,
      venta: price,
      supplier: draft.supplier.trim(),
      proveedor: draft.supplier.trim(),
      location: draft.location.trim(),
      notes: draft.notes.trim(),
      status: "active",
    };

    const { data, error } = await supabase.from("inventory").insert(payload).select("*").single();

    if (error) {
      alert(`No se pudo crear: ${error.message}`);
      setDebug(`Error creando producto: ${error.message}`);
    } else {
      setProducts((prev) => [data as Product, ...prev]);
      setDraft(emptyDraft);
      setShowCreate(false);
      setDebug(`Producto creado: ${name}`);
    }
    setLoading(false);
  }

  const inputClass = "w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-blue-500";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 bg-slate-950/95 px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.45em] text-blue-400">RD Wood System</p>
            <h1 className="mt-1 text-4xl font-black tracking-tight">Inventario PRO</h1>
            <p className="mt-1 text-sm text-slate-400">Base madre del sistema: inventory + inventory_movements.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Productos" value={totals.totalProducts.toString()} />
            <Stat label="Valor costo" value={money(totals.stockValue)} green />
            <Stat label="Valor venta" value={money(totals.saleValue)} blue />
            <Stat label="Stock bajo" value={totals.lowStock.toString()} warn />
            <Stat label="Sin stock" value={totals.noStock.toString()} danger />
          </div>
        </div>
      </div>

      <main className="p-6">
        <section className="mb-5 grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-2xl shadow-blue-950/20">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-600/15 p-3 text-blue-400"><Boxes size={24} /></div>
                <div>
                  <h2 className="text-xl font-black">Control de almacén</h2>
                  <p className="text-xs text-slate-400">{debug}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowCreate(true)} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black hover:bg-blue-500">
                  <PackagePlus className="mr-2 inline" size={18} /> Nuevo producto
                </button>
                <button onClick={loadProducts} disabled={loading} className="rounded-2xl border border-blue-700 bg-blue-950/50 px-4 py-3 text-sm font-black text-blue-200 hover:bg-blue-900/70 disabled:opacity-50">
                  <RefreshCw className="mr-2 inline" size={18} /> Actualizar
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px_190px]">
              <label className="relative block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por producto, código, categoría, proveedor..." className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 py-3 pl-12 pr-4 text-sm outline-none focus:border-blue-500" />
              </label>
              <label className="relative block">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full appearance-none rounded-2xl border border-slate-700 bg-slate-950/80 py-3 pl-12 pr-4 text-sm outline-none focus:border-blue-500">
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as any)} className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm outline-none focus:border-blue-500">
                <option value="todos">Todos</option>
                <option value="disponible">Disponible</option>
                <option value="bajo">Stock bajo</option>
                <option value="sin_stock">Sin stock</option>
              </select>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-blue-950/50 to-slate-900 p-5">
            <h3 className="flex items-center gap-2 text-lg font-black"><AlertTriangle className="text-amber-400" /> Alertas rápidas</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <AlertLine label="Productos en mínimo" value={totals.lowStock} tone="amber" />
              <AlertLine label="Productos agotados" value={totals.noStock} tone="red" />
              <AlertLine label="Valor costo inventario" value={money(totals.stockValue)} tone="green" />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-2xl shadow-blue-950/20">
          <div className="max-h-[68vh] overflow-auto rounded-2xl border border-slate-800">
            <table className="min-w-[1180px] w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-950 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-4">Producto</th>
                  <th className="px-4 py-4">Categoría</th>
                  <th className="px-4 py-4">Stock</th>
                  <th className="px-4 py-4">Mínimo</th>
                  <th className="px-4 py-4">Costo</th>
                  <th className="px-4 py-4">Venta</th>
                  <th className="px-4 py-4">Margen</th>
                  <th className="px-4 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const st = stockOf(p);
                  const min = minStockOf(p);
                  const cost = costOf(p);
                  const price = priceOf(p);
                  const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
                  const low = st > 0 && min > 0 && st <= min;
                  const zero = st <= 0;
                  return (
                    <tr key={p.id} className="border-t border-slate-800 bg-slate-950/30 hover:bg-blue-950/25">
                      <td className="px-4 py-3">
                        <input value={productName(p)} onChange={(e) => updateLocal(p.id, { name: e.target.value, product_name: e.target.value })} className="w-full bg-transparent font-bold outline-none focus:text-blue-300" />
                        <input value={productCode(p)} onChange={(e) => updateLocal(p.id, { code: e.target.value })} className="mt-1 w-full bg-transparent text-xs text-slate-500 outline-none focus:text-blue-300" />
                      </td>
                      <td className="px-4 py-3">
                        <input value={productCategory(p)} onChange={(e) => updateLocal(p.id, { category: e.target.value, grupo: e.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-2 outline-none focus:border-blue-500" />
                        <input value={productSubcategory(p)} onChange={(e) => updateLocal(p.id, { subcategory: e.target.value, subgrupo: e.target.value })} placeholder="Subcategoría" className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-2 text-xs outline-none focus:border-blue-500" />
                      </td>
                      <td className="px-4 py-3">
                        <div className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${zero ? "bg-red-500/15 text-red-300" : low ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>{st} {productUnit(p)}</div>
                        <input value={productUnit(p)} onChange={(e) => updateLocal(p.id, { unit: e.target.value, unidad: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-2 text-xs outline-none focus:border-blue-500" />
                      </td>
                      <td className="px-4 py-3"><NumberInput value={min} onChange={(v) => updateLocal(p.id, { min_stock: v, minimum_stock: v, minimo: v })} /></td>
                      <td className="px-4 py-3"><NumberInput value={cost} onChange={(v) => updateLocal(p.id, { cost_price: v, unit_cost: v, purchase_cost: v, cost: v, costo_prom: v, costo_promedio: v })} /></td>
                      <td className="px-4 py-3"><NumberInput value={price} onChange={(v) => updateLocal(p.id, { sale_price: v, price: v, unit_price: v, venta: v, precio_venta: v })} /></td>
                      <td className="px-4 py-3"><span className={`font-black ${margin >= 35 ? "text-emerald-400" : margin >= 20 ? "text-amber-400" : "text-red-400"}`}>{margin.toFixed(1)}%</span></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => adjustStock(p, "entrada")} className="rounded-xl bg-emerald-600/20 px-3 py-2 text-emerald-300 hover:bg-emerald-600/30" title="Entrada"><TrendingUp size={17} /></button>
                          <button onClick={() => adjustStock(p, "salida")} className="rounded-xl bg-red-600/20 px-3 py-2 text-red-300 hover:bg-red-600/30" title="Salida"><TrendingDown size={17} /></button>
                          <button onClick={() => adjustStock(p, "ajuste")} className="rounded-xl bg-slate-700 px-3 py-2 hover:bg-slate-600" title="Ajuste"><Edit3 size={17} /></button>
                          <button onClick={() => openProduct(p)} className="rounded-xl border border-blue-700 px-3 py-2 text-blue-300 hover:bg-blue-950" title="Historial"><Layers size={17} /></button>
                          <button onClick={() => saveProduct(p)} disabled={savingId === p.id} className="rounded-xl bg-blue-600 px-3 py-2 font-black hover:bg-blue-500 disabled:opacity-50" title="Guardar"><Save size={17} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {selected && (
        <Modal title={productName(selected)} onClose={() => setSelected(null)}>
          <div className="grid gap-3 md:grid-cols-4">
            <MiniBox label="Stock" value={`${stockOf(selected)} ${productUnit(selected)}`} />
            <MiniBox label="Costo" value={money(costOf(selected))} />
            <MiniBox label="Venta" value={money(priceOf(selected))} />
            <MiniBox label="Proveedor" value={supplierOf(selected) || "N/A"} />
          </div>
          <h3 className="mt-5 font-black">Últimos movimientos</h3>
          <div className="mt-3 max-h-80 overflow-auto rounded-2xl border border-slate-800">
            {loadingMovements ? <p className="p-4 text-slate-400">Cargando historial...</p> : movements.length === 0 ? <p className="p-4 text-slate-400">Sin movimientos registrados.</p> : movements.map((m) => (
              <div key={m.id} className="grid gap-2 border-b border-slate-800 p-3 text-sm md:grid-cols-[120px_1fr_100px_120px]">
                <span className="font-black text-blue-300">{m.movement_type || m.tipo || "movimiento"}</span>
                <span className="text-slate-300">{m.note || m.nota || m.reference || m.referencia || "Sin nota"}</span>
                <span>{num(m.quantity ?? m.qty ?? m.cantidad)}</span>
                <span className="text-slate-500">{new Date(m.created_at || m.fecha || Date.now()).toLocaleString("es-DO")}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {showCreate && (
        <Modal title="Nuevo producto" onClose={() => setShowCreate(false)}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Código" value={draft.code} onChange={(v) => setDraft({ ...draft, code: v })} placeholder="Automático si lo dejas vacío" inputClass={inputClass} />
            <Field label="Producto" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Ej: Melamina blanca 18mm" inputClass={inputClass} />
            <Field label="Categoría" value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} inputClass={inputClass} />
            <Field label="Subcategoría" value={draft.subcategory} onChange={(v) => setDraft({ ...draft, subcategory: v })} inputClass={inputClass} />
            <Field label="Unidad" value={draft.unit} onChange={(v) => setDraft({ ...draft, unit: v })} inputClass={inputClass} />
            <Field label="Stock inicial" value={draft.stock} onChange={(v) => setDraft({ ...draft, stock: v })} inputClass={inputClass} type="number" />
            <Field label="Stock mínimo" value={draft.min_stock} onChange={(v) => setDraft({ ...draft, min_stock: v })} inputClass={inputClass} type="number" />
            <Field label="Costo compra" value={draft.cost_price} onChange={(v) => setDraft({ ...draft, cost_price: v })} inputClass={inputClass} type="number" />
            <Field label="Precio venta" value={draft.sale_price} onChange={(v) => setDraft({ ...draft, sale_price: v })} inputClass={inputClass} type="number" />
            <Field label="Proveedor" value={draft.supplier} onChange={(v) => setDraft({ ...draft, supplier: v })} inputClass={inputClass} />
            <Field label="Ubicación" value={draft.location} onChange={(v) => setDraft({ ...draft, location: v })} inputClass={inputClass} />
            <Field label="Notas" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} inputClass={inputClass} />
          </div>
          <button onClick={createProduct} disabled={loading} className="mt-5 w-full rounded-2xl bg-blue-600 py-4 font-black hover:bg-blue-500 disabled:opacity-60">
            <CheckCircle2 className="mr-2 inline" /> Crear producto
          </button>
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, green, blue, warn, danger }: { label: string; value: string; green?: boolean; blue?: boolean; warn?: boolean; danger?: boolean }) {
  const color = danger ? "text-red-400" : warn ? "text-amber-400" : green ? "text-emerald-400" : blue ? "text-blue-400" : "text-white";
  return <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-xl font-black ${color}`}>{value}</p></div>;
}

function AlertLine({ label, value, tone }: { label: string; value: string | number; tone: "amber" | "red" | "green" }) {
  const color = tone === "red" ? "text-red-300" : tone === "amber" ? "text-amber-300" : "text-emerald-300";
  return <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3"><span>{label}</span><span className={`font-black ${color}`}>{value}</span></div>;
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input type="number" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(num(e.target.value))} className="w-28 rounded-lg border border-slate-800 bg-slate-950 px-2 py-2 outline-none focus:border-blue-500" />;
}

function MiniBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-black text-white">{value}</p></div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-black">{title}</h2><button onClick={onClose} className="rounded-xl bg-slate-800 p-2 hover:bg-slate-700"><X /></button></div>{children}</div></div>;
}

function Field({ label, value, onChange, placeholder, inputClass, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; inputClass: string; type?: string }) {
  return <label><span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-400">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} /></label>;
}
