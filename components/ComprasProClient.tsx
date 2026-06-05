"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  XCircle,
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
  subgrupo?: string | null;
  unit?: string | null;
  unidad?: string | null;
  stock?: number | null;
  quantity?: number | null;
  min_stock?: number | null;
  minimum_stock?: number | null;
  cost_price?: number | null;
  unit_cost?: number | null;
  purchase_cost?: number | null;
  costo_prom?: number | null;
  costo_promedio?: number | null;
  sale_price?: number | null;
  price?: number | null;
  supplier?: string | null;
  proveedor?: string | null;
  status?: string | null;
};

type PurchaseLine = {
  product_id: string;
  product_name: string;
  code: string;
  category: string;
  subcategory: string;
  unit: string;
  old_stock: number;
  old_cost: number;
  quantity: number;
  unit_cost: number;
};

type RecentPurchase = {
  id: string;
  po_number?: string | null;
  supplier_name?: string | null;
  supplier?: string | null;
  status?: string | null;
  total?: number | null;
  created_at?: string | null;
};

const money = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
});

function n(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function productName(p: Product): string {
  return p.name || p.product_name || p.material || "Producto sin nombre";
}

function productCode(p: Product): string {
  return p.code || "SIN-CODIGO";
}

function productCategory(p: Product): string {
  return p.category || p.grupo || "General";
}

function productSubcategory(p: Product): string {
  return p.subcategory || p.subgrupo || "";
}

function productUnit(p: Product): string {
  return p.unit || p.unidad || "Unidad";
}

function productStock(p: Product): number {
  return n(p.stock ?? p.quantity);
}

function productCost(p: Product): number {
  return n(p.cost_price ?? p.unit_cost ?? p.purchase_cost ?? p.costo_prom ?? p.costo_promedio);
}

function nowCode() {
  return `OC-${Date.now()}`;
}

export default function ComprasProClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
  const [query, setQuery] = useState("");
  const [supplierName, setSupplierName] = useState("Proveedor general");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Compras listo");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadProducts(), loadRecentPurchases()]);
    setLoading(false);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .or("status.is.null,status.eq.active,status.eq.activo")
      .order("name", { ascending: true });

    if (error) {
      setProducts([]);
      setMessage(`Error cargando inventario: ${error.message}`);
      return;
    }

    setProducts((data || []) as Product[]);
  }

  async function loadRecentPurchases() {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("id, po_number, supplier_name, supplier, status, total, created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    if (!error) {
      setRecentPurchases((data || []) as RecentPurchase[]);
    }
  }

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products
      .filter((p) =>
        [productName(p), productCode(p), productCategory(p), productSubcategory(p)]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 40);
  }, [products, query]);

  const totals = useMemo(() => {
    const items = lines.length;
    const units = lines.reduce((acc, item) => acc + n(item.quantity), 0);
    const subtotal = lines.reduce((acc, item) => acc + n(item.quantity) * n(item.unit_cost), 0);
    const inventoryValue = products.reduce((acc, p) => acc + productStock(p) * productCost(p), 0);
    return { items, units, subtotal, inventoryValue };
  }, [lines, products]);

  function addProduct(product: Product) {
    const stock = productStock(product);
    const cost = productCost(product);
    const exists = lines.find((item) => item.product_id === product.id);

    if (exists) {
      setLines((current) =>
        current.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: n(item.quantity) + 1, unit_cost: n(item.unit_cost) || cost }
            : item
        )
      );
      return;
    }

    setLines((current) => [
      ...current,
      {
        product_id: product.id,
        product_name: productName(product),
        code: productCode(product),
        category: productCategory(product),
        subcategory: productSubcategory(product),
        unit: productUnit(product),
        old_stock: stock,
        old_cost: cost,
        quantity: 1,
        unit_cost: cost || 0,
      },
    ]);
  }

  function updateLine(productId: string, field: "quantity" | "unit_cost", value: string) {
    const clean = Math.max(0, n(value));
    setLines((current) =>
      current.map((item) => (item.product_id === productId ? { ...item, [field]: clean } : item))
    );
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((item) => item.product_id !== productId));
  }

  function clearForm() {
    setLines([]);
    setInvoiceNumber("");
    setNotes("");
    setSupplierName("Proveedor general");
  }

  async function processPurchase() {
    if (saving) return;
    if (!supplierName.trim()) {
      alert("Coloca el nombre del proveedor.");
      return;
    }
    if (lines.length === 0) {
      alert("Agrega productos a la compra.");
      return;
    }

    for (const item of lines) {
      if (n(item.quantity) <= 0) {
        alert(`La cantidad de ${item.product_name} debe ser mayor a cero.`);
        return;
      }
      if (n(item.unit_cost) <= 0) {
        alert(`El costo de ${item.product_name} debe ser mayor a cero.`);
        return;
      }
    }

    setSaving(true);
    const poNumber = invoiceNumber.trim() || nowCode();

    try {
      const { data: order, error: orderError } = await supabase
        .from("purchase_orders")
        .insert({
          po_number: poNumber,
          order_number: poNumber,
          invoice_number: invoiceNumber || poNumber,
          invoice_no: invoiceNumber || poNumber,
          supplier_name: supplierName.trim(),
          supplier: supplierName.trim(),
          status: "recibida",
          subtotal: totals.subtotal,
          tax: 0,
          total: totals.subtotal,
          total_estimated: totals.subtotal,
          notes,
          note: notes,
          code: poNumber,
        })
        .select("*")
        .single();

      if (orderError) throw orderError;

      for (const item of lines) {
        const oldStock = n(item.old_stock);
        const oldCost = n(item.old_cost);
        const qty = n(item.quantity);
        const unitCost = n(item.unit_cost);
        const newStock = oldStock + qty;
        const newAverageCost = newStock > 0 ? (oldStock * oldCost + qty * unitCost) / newStock : unitCost;
        const total = qty * unitCost;

        const { error: itemError } = await supabase.from("purchase_order_items").insert({
          purchase_order_id: order.id,
          item_id: item.product_id,
          product_id: item.product_id,
          item_name: item.product_name,
          product_name: item.product_name,
          category: item.category,
          subcategory: item.subcategory,
          group_name: item.category,
          subgroup_name: item.subcategory,
          unit: item.unit,
          quantity: qty,
          quantity_to_buy: qty,
          unit_cost: unitCost,
          estimated_cost: total,
          total,
        });
        if (itemError) throw itemError;

        const { error: updateError } = await supabase
          .from("inventory")
          .update({
            stock: newStock,
            quantity: newStock,
            purchase_cost: unitCost,
            cost_price: newAverageCost,
            unit_cost: newAverageCost,
            costo_prom: newAverageCost,
            costo_promedio: newAverageCost,
            supplier: supplierName.trim(),
            proveedor: supplierName.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.product_id);
        if (updateError) throw updateError;

        const { error: movementError } = await supabase.from("inventory_movements").insert({
          product_id: item.product_id,
          inventory_id: item.product_id,
          item_id: item.product_id,
          producto_id: item.product_id,
          product_name: item.product_name,
          material_name: item.product_name,
          movement_type: "entrada",
          type: "entrada",
          tipo: "entrada",
          origin: "compra",
          origen: "compra",
          source_table: "purchase_orders",
          reference_type: "purchase_order",
          reference_id: order.id,
          reference: poNumber,
          referencia: poNumber,
          invoice_number: poNumber,
          quantity: qty,
          qty,
          cantidad: qty,
          unit_cost: unitCost,
          costo_unitario: unitCost,
          costo: unitCost,
          total_cost: total,
          costo_total: total,
          stock_before: oldStock,
          stock_antes: oldStock,
          stock_after: newStock,
          stock_despues: newStock,
          note: notes || `Compra recibida de ${supplierName}`,
          nota: notes || `Compra recibida de ${supplierName}`,
          user_name: "RD Wood System",
        });
        if (movementError) throw movementError;
      }

      setMessage(`Compra procesada: ${poNumber}. Inventario actualizado.`);
      alert(`✅ Compra procesada: ${poNumber}`);
      clearForm();
      await loadAll();
    } catch (error: any) {
      console.error(error);
      alert(`Error procesando compra: ${error?.message || "Error desconocido"}`);
      setMessage(`Error: ${error?.message || "Error desconocido"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <div className="border-b border-slate-800 px-6 py-6 lg:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.45em] text-sky-400">RD Wood System</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">Compras PRO</h1>
            <p className="mt-1 text-sm text-slate-400">
              Entrada de mercancía conectada a inventory + purchase_orders + inventory_movements.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Productos" value={products.length.toString()} />
            <Metric label="Items compra" value={totals.items.toString()} />
            <Metric label="Unidades" value={totals.units.toString()} />
            <Metric label="Total compra" value={money.format(totals.subtotal)} accent />
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-600/20 p-3 text-blue-300">
                <PackagePlus size={26} />
              </div>
              <div>
                <h2 className="text-2xl font-black">Inventario para comprar</h2>
                <p className="text-xs text-slate-400">Selecciona productos y define cantidad + costo real.</p>
              </div>
            </div>
            <button
              onClick={loadAll}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-500/50 bg-blue-600/15 px-5 py-3 text-sm font-black text-blue-100 hover:bg-blue-600/25 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              Actualizar
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3">
            <Search className="text-slate-500" size={20} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto, código o categoría..."
              className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="mt-5 max-h-[610px] overflow-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#070b19] text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-4">Producto</th>
                  <th className="px-4 py-4">Stock</th>
                  <th className="px-4 py-4">Costo actual</th>
                  <th className="px-4 py-4">Categoría</th>
                  <th className="px-4 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const stock = productStock(p);
                  return (
                    <tr key={p.id} className="border-t border-slate-800 bg-[#080d1e] hover:bg-blue-950/30">
                      <td className="px-4 py-4">
                        <div className="font-black text-white">{productName(p)}</div>
                        <div className="mt-1 text-xs font-bold text-slate-500">{productCode(p)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300">
                          {stock} {productUnit(p)}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-black text-slate-200">{money.format(productCost(p))}</td>
                      <td className="px-4 py-4 text-slate-300">{productCategory(p)}</td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => addProduct(p)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-500"
                        >
                          <Plus size={17} /> Agregar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-600/20 p-3 text-cyan-300">
                <ShoppingBag size={25} />
              </div>
              <div>
                <h2 className="text-2xl font-black">Orden de compra</h2>
                <p className="text-xs text-slate-400">Al procesar, sube stock y actualiza costo promedio.</p>
              </div>
            </div>
            <button
              onClick={clearForm}
              className="rounded-2xl border border-slate-700 px-4 py-2 text-xs font-black text-slate-300 hover:bg-slate-800"
            >
              Limpiar
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Field label="Proveedor">
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="field"
                placeholder="Nombre del proveedor"
              />
            </Field>
            <Field label="Factura / Referencia">
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="field"
                placeholder="OC o factura"
              />
            </Field>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-xs font-black uppercase text-slate-400">Nota</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="field min-h-[72px] resize-none"
              placeholder="Comentario de compra, condición, transporte..."
            />
          </div>

          <div className="mt-5 space-y-3">
            {lines.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-[#070b19] p-10 text-center text-slate-500">
                <ClipboardList className="mx-auto mb-3" size={36} />
                <p className="font-black text-slate-300">Compra vacía</p>
                <p className="text-sm">Agrega productos desde el inventario.</p>
              </div>
            ) : (
              lines.map((item) => {
                const total = n(item.quantity) * n(item.unit_cost);
                const newStock = n(item.old_stock) + n(item.quantity);
                const avg = newStock > 0 ? (n(item.old_stock) * n(item.old_cost) + total) / newStock : n(item.unit_cost);
                return (
                  <div key={item.product_id} className="rounded-3xl border border-slate-800 bg-[#070b19] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-white">{item.product_name}</h3>
                        <p className="text-xs font-bold text-slate-500">
                          {item.code} · Stock actual: {item.old_stock} {item.unit}
                        </p>
                      </div>
                      <button
                        onClick={() => removeLine(item.product_id)}
                        className="rounded-xl p-2 text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <Field label="Cantidad">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateLine(item.product_id, "quantity", e.target.value)}
                          className="field"
                        />
                      </Field>
                      <Field label="Costo unitario">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => updateLine(item.product_id, "unit_cost", e.target.value)}
                          className="field"
                        />
                      </Field>
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                        <p className="text-xs font-black uppercase text-slate-500">Total línea</p>
                        <p className="mt-1 text-xl font-black text-emerald-300">{money.format(total)}</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs font-bold text-cyan-100">
                      Nuevo stock: <b>{newStock}</b> {item.unit} · Costo promedio estimado: <b>{money.format(avg)}</b>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800 bg-[#070b19] p-5">
            <div className="flex items-center justify-between text-sm font-bold text-slate-300">
              <span>Items</span>
              <span>{totals.items}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm font-bold text-slate-300">
              <span>Unidades</span>
              <span>{totals.units}</span>
            </div>
            <div className="mt-4 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black uppercase text-slate-400">Total compra</span>
                <span className="text-3xl font-black text-emerald-300">{money.format(totals.subtotal)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={processPurchase}
            disabled={saving || lines.length === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-950/50 hover:from-blue-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Procesar compra y subir inventario
          </button>

          <div className="mt-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-xs font-bold text-blue-100">
            {message}
          </div>
        </section>
      </div>

      <div className="grid gap-5 px-6 pb-8 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center gap-3">
            <Truck className="text-yellow-300" />
            <h2 className="text-xl font-black">Regla del módulo</h2>
          </div>
          <div className="space-y-3 text-sm font-semibold text-slate-300">
            <p className="flex gap-2"><CheckCircle2 className="shrink-0 text-emerald-300" size={18} /> Compra recibida aumenta stock.</p>
            <p className="flex gap-2"><CheckCircle2 className="shrink-0 text-emerald-300" size={18} /> Actualiza costo promedio automático.</p>
            <p className="flex gap-2"><CheckCircle2 className="shrink-0 text-emerald-300" size={18} /> Guarda movimiento auditable en inventario.</p>
            <p className="flex gap-2"><AlertTriangle className="shrink-0 text-yellow-300" size={18} /> No uses tablas viejas: productos, inventario, inventory_items.</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ClipboardList className="text-sky-300" />
              <h2 className="text-xl font-black">Últimas compras</h2>
            </div>
            <span className="text-xs font-black text-slate-500">purchase_orders</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            {recentPurchases.length === 0 ? (
              <div className="p-8 text-center text-sm font-bold text-slate-500">Sin compras registradas todavía.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-[#070b19] text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Orden</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPurchases.map((p) => (
                    <tr key={p.id} className="border-t border-slate-800 bg-[#080d1e]">
                      <td className="px-4 py-3 font-black text-white">{p.po_number || "Sin número"}</td>
                      <td className="px-4 py-3 text-slate-300">{p.supplier_name || p.supplier || "Proveedor"}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300">
                          {p.status || "recibida"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-emerald-300">{money.format(n(p.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <style jsx global>{`
        .field {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgb(51 65 85);
          background: rgba(15, 23, 42, 0.9);
          padding: 0.85rem 1rem;
          color: white;
          font-weight: 800;
          outline: none;
        }
        .field:focus {
          border-color: rgb(59 130 246);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25);
        }
        .field::placeholder {
          color: rgb(100 116 139);
        }
      `}</style>
    </div>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-[150px] rounded-2xl border border-slate-800 bg-[#070b19] px-5 py-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-black ${accent ? "text-emerald-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase text-slate-400">{label}</span>
      {children}
    </label>
  );
}
