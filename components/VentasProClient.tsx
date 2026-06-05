"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  PackageSearch,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  XCircle,
  ReceiptText,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type InventoryProduct = {
  id: string;
  code?: string | null;
  name?: string | null;
  product_name?: string | null;
  material?: string | null;
  category?: string | null;
  subcategory?: string | null;
  unit?: string | null;
  unidad?: string | null;
  stock?: number | null;
  quantity?: number | null;
  cost_price?: number | null;
  unit_cost?: number | null;
  purchase_cost?: number | null;
  costo_prom?: number | null;
  costo_promedio?: number | null;
  sale_price?: number | null;
  unit_price?: number | null;
  price?: number | null;
  venta?: number | null;
  precio_venta?: number | null;
};

type CartItem = {
  product_id: string;
  product_name: string;
  code: string;
  unit: string;
  stock: number;
  quantity: number;
  unit_cost: number;
  unit_price: number;
};

type SaleRecord = {
  id: string;
  sale_no?: string | null;
  invoice_number?: string | null;
  customer_name?: string | null;
  client_name?: string | null;
  customer_phone?: string | null;
  client_phone?: string | null;
  total?: number | null;
  subtotal?: number | null;
  discount?: number | null;
  cost_total?: number | null;
  profit_total?: number | null;
  margin?: number | null;
  payment_method?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type SaleItemRecord = {
  id?: string;
  sale_id?: string;
  product_id?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  price?: number | null;
  unit_price?: number | null;
  unit_cost?: number | null;
  cost_price?: number | null;
  subtotal?: number | null;
  total_price?: number | null;
  total_cost?: number | null;
  profit?: number | null;
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

function productName(p: InventoryProduct): string {
  return p.name || p.product_name || p.material || "Producto sin nombre";
}

function productCode(p: InventoryProduct): string {
  return p.code || "SIN-CODIGO";
}

function productUnit(p: InventoryProduct): string {
  return p.unit || p.unidad || "Unidad";
}

function productStock(p: InventoryProduct): number {
  return n(p.stock ?? p.quantity);
}

function productCost(p: InventoryProduct): number {
  return n(
    p.cost_price ??
      p.unit_cost ??
      p.purchase_cost ??
      p.costo_prom ??
      p.costo_promedio
  );
}

function productPrice(p: InventoryProduct): number {
  return n(p.sale_price ?? p.unit_price ?? p.price ?? p.venta ?? p.precio_venta);
}

function saleNumber(s: SaleRecord): string {
  return s.sale_no || s.invoice_number || "VENTA";
}

function saleClient(s: SaleRecord): string {
  return s.customer_name || s.client_name || "Cliente general";
}

function salePhone(s: SaleRecord): string {
  return s.customer_phone || s.client_phone || "";
}

function safeDate(value?: string | null): string {
  if (!value) return new Date().toLocaleString("es-DO");
  return new Date(value).toLocaleString("es-DO");
}

export default function VentasProClient() {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");

  const [clientName, setClientName] = useState("Cliente general");
  const [clientPhone, setClientPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [discount, setDiscount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [recentSales, setRecentSales] = useState<SaleRecord[]>([]);

  useEffect(() => {
    loadProducts();
    loadRecentSales();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      alert(`Error cargando inventario: ${error.message}`);
      setProducts([]);
    } else {
      setProducts((data || []) as InventoryProduct[]);
    }

    setLoading(false);
  }

  async function loadRecentSales() {
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      console.warn("No se pudieron cargar ventas recientes:", error.message);
      setRecentSales([]);
      return;
    }

    setRecentSales((data || []) as SaleRecord[]);
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;

    return products.filter((p) => {
      const text = [
        productName(p),
        productCode(p),
        p.category,
        p.subcategory,
        p.material,
        productUnit(p),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [products, search]);

  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity * item.unit_price, 0),
    [cart]
  );

  const totalCost = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity * item.unit_cost, 0),
    [cart]
  );

  const total = Math.max(subtotal - n(discount), 0);
  const profit = total - totalCost;
  const margin = total > 0 ? (profit / total) * 100 : 0;

  function addToCart(product: InventoryProduct) {
    const stock = productStock(product);
    const name = productName(product);

    if (stock <= 0) {
      alert(`No hay stock disponible para ${name}`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);

      if (existing) {
        if (existing.quantity + 1 > stock) {
          alert(`No puedes agregar más de ${stock} ${productUnit(product)} para ${name}`);
          return prev;
        }

        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...prev,
        {
          product_id: product.id,
          product_name: name,
          code: productCode(product),
          unit: productUnit(product),
          stock,
          quantity: 1,
          unit_cost: productCost(product),
          unit_price: productPrice(product),
        },
      ];
    });
  }

  function updateQuantity(productId: string, value: number) {
    const qty = Math.max(1, n(value));

    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;

        if (qty > item.stock) {
          alert(`No hay stock suficiente. Disponible: ${item.stock} ${item.unit}`);
          return { ...item, quantity: item.stock > 0 ? item.stock : 1 };
        }

        return { ...item, quantity: qty };
      })
    );
  }

  function updatePrice(productId: string, value: number) {
    const price = Math.max(0, n(value));

    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, unit_price: price } : item
      )
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  }

  function clearCart() {
    setCart([]);
    setDiscount(0);
  }

  async function handleSell() {
    if (cart.length === 0) {
      alert("Agrega productos al carrito antes de vender.");
      return;
    }

    for (const item of cart) {
      if (item.stock <= 0) {
        alert(`No hay stock disponible para ${item.product_name}`);
        return;
      }

      if (item.quantity <= 0) {
        alert(`La cantidad de ${item.product_name} debe ser mayor que 0.`);
        return;
      }

      if (item.quantity > item.stock) {
        alert(
          `Stock insuficiente para ${item.product_name}. Disponible: ${item.stock} ${item.unit}. En carrito: ${item.quantity}.`
        );
        return;
      }

      if (item.unit_price <= 0) {
        alert(`El precio de venta de ${item.product_name} debe ser mayor a cero.`);
        return;
      }
    }

    setSaving(true);

    try {
      const invoiceNumber = `FV-${Date.now()}`;

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          invoice_number: invoiceNumber,
          sale_no: invoiceNumber,
          client_name: clientName || "Cliente general",
          client_phone: clientPhone || null,
          customer_name: clientName || "Cliente general",
          customer_phone: clientPhone || null,
          project_name: `Venta directa ${invoiceNumber}`,
          project_type: "venta_directa",
          subtotal,
          discount: n(discount),
          tax: 0,
          total,
          cost_total: totalCost,
          profit_total: profit,
          margin,
          payment_method: paymentMethod,
          payment_status: "Pagada",
          status: "emitida",
          workflow_status: "venta_registrada",
          amount_paid: total,
          balance: 0,
        })
        .select("*")
        .single();

      if (saleError || !sale) {
        throw new Error(saleError?.message || "No se pudo crear la venta.");
      }

      const itemsPayload = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product_id,
        product_name: item.product_name,
        code: item.code,
        quantity: item.quantity,
        price: item.unit_price,
        unit_price: item.unit_price,
        unit_cost: item.unit_cost,
        cost_price: item.unit_cost,
        subtotal: item.quantity * item.unit_price,
        total_price: item.quantity * item.unit_price,
        total_cost: item.quantity * item.unit_cost,
        profit: item.quantity * (item.unit_price - item.unit_cost),
        inventory_source: "inventory",
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(itemsPayload);

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      await printInvoice(sale as SaleRecord, itemsPayload as SaleItemRecord[]);

      alert(`✅ Venta creada: ${sale.invoice_number || invoiceNumber}`);

      setCart([]);
      setDiscount(0);
      setClientName("Cliente general");
      setClientPhone("");

      await loadProducts();
      await loadRecentSales();
    } catch (error: any) {
      alert(`Error creando venta: ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  async function getSaleItems(saleId: string): Promise<SaleItemRecord[]> {
    const { data, error } = await supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", saleId);

    if (error) {
      alert(`No se pudieron cargar los artículos de la factura: ${error.message}`);
      return [];
    }

    return (data || []) as SaleItemRecord[];
  }

  async function handlePrintExistingSale(sale: SaleRecord) {
    setPrintingId(sale.id);
    try {
      const items = await getSaleItems(sale.id);
      await printInvoice(sale, items);
    } finally {
      setPrintingId(null);
    }
  }


  async function printInvoice(sale: SaleRecord, items: SaleItemRecord[]) {
    const { jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "letter",
    });

    const invoice = saleNumber(sale);
    const client = saleClient(sale);
    const phone = salePhone(sale);

    const subtotalPdf = n(sale.subtotal);
    const discountPdf = n(sale.discount);
    const totalPdf = n(sale.total);

    // HEADER
    doc.setFillColor(2, 6, 23);
    doc.rect(0, 0, 216, 38, "F");

    doc.setTextColor(34, 211, 238);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("RD WOOD SYSTEM", 14, 12);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("Factura de Venta", 14, 24);

    doc.setFontSize(10);
    doc.text(`No. ${invoice}`, 160, 12);
    doc.text(`Fecha: ${safeDate(sale.created_at)}`, 130, 20);

    // DATOS CLIENTE
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");

    doc.text("Cliente", 14, 48);
    doc.text("Teléfono", 110, 48);
    doc.text("Pago", 14, 65);
    doc.text("Estado", 110, 65);

    doc.setFont("helvetica", "normal");
    doc.text(client, 14, 55);
    doc.text(phone || "-", 110, 55);
    doc.text(sale.payment_method || "Efectivo", 14, 72);
    doc.text(sale.status || "emitida", 110, 72);

    // TABLA
    autoTable(doc, {
      startY: 82,
      head: [["Código", "Producto", "Cant.", "Precio", "Subtotal"]],
      body: items.map((item: any) => [
        item.code || item.product_code || "-",
        item.product_name || "Producto",
        String(n(item.quantity)),
        money.format(n(item.unit_price ?? item.price)),
        money.format(n(item.subtotal ?? item.total_price)),
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 3,
        valign: "middle",
      },
      headStyles: {
        fillColor: [2, 6, 23],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    const boxY = finalY + 10;

    // RESUMEN
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(120, boxY, 78, 45, 3, 3);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Resumen", 126, boxY + 8);

    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", 126, boxY + 17);
    doc.text(money.format(subtotalPdf), 190, boxY + 17, { align: "right" });

    doc.text("Descuento:", 126, boxY + 25);
    doc.text(money.format(discountPdf), 190, boxY + 25, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", 126, boxY + 36);

    doc.setFontSize(14);
    doc.text(money.format(totalPdf), 190, boxY + 36, { align: "right" });

    // FOOTER
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Gracias por su compra.", 14, 260);
    doc.text("RD Wood System · Venta directa de artículos", 14, 266);

    doc.save(`${invoice}.pdf`);
  }


  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="border-b border-slate-800 bg-[#020617] px-6 py-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-[0.45em] text-sky-400">
              RD WOOD SYSTEM
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white lg:text-4xl">
              Ventas PRO
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Venta directa de artículos conectada a inventario + sales + sale_items.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric title="Productos" value={products.length.toString()} />
            <Metric title="En carrito" value={cart.length.toString()} />
            <Metric title="Total" value={money.format(total)} accent="green" />
            <Metric title="Margen" value={`${margin.toFixed(1)}%`} accent="blue" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 p-6 lg:grid-cols-[1.35fr_1fr] lg:p-8">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/30">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-600/20 p-3 text-sky-400">
                <PackageSearch size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black">Inventario disponible</h2>
                <p className="text-xs text-slate-400">Productos cargados: {products.length}</p>
              </div>
            </div>

            <button
              onClick={loadProducts}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-500/50 bg-blue-600/10 px-5 py-3 text-sm font-black text-blue-200 transition hover:bg-blue-600/20 disabled:opacity-60"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              Actualizar
            </button>
          </div>

          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3">
            <Search size={18} className="text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por producto, código, categoría..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="max-h-[650px] overflow-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[780px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-950 text-xs uppercase text-slate-400">
                <tr>
                  <th className="p-4 text-left">Producto</th>
                  <th className="p-4 text-left">Stock</th>
                  <th className="p-4 text-left">Costo</th>
                  <th className="p-4 text-left">Precio</th>
                  <th className="p-4 text-right">Acción</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((p) => {
                  const stock = productStock(p);
                  const disabled = stock <= 0;

                  return (
                    <tr key={p.id} className="border-t border-slate-800 hover:bg-blue-500/10">
                      <td className="p-4">
                        <div className="font-black text-white">{productName(p)}</div>
                        <div className="mt-1 text-xs text-slate-500">{productCode(p)}</div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            stock <= 0
                              ? "bg-red-500/20 text-red-300"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {stock} {productUnit(p)}
                        </span>
                      </td>
                      <td className="p-4 text-slate-200">{money.format(productCost(p))}</td>
                      <td className="p-4 font-black text-emerald-300">{money.format(productPrice(p))}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => addToCart(p)}
                          disabled={disabled}
                          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black transition ${
                            disabled
                              ? "cursor-not-allowed bg-slate-800 text-slate-500"
                              : "bg-blue-600 text-white hover:bg-blue-500"
                          }`}
                        >
                          {disabled ? <XCircle size={17} /> : <Plus size={17} />}
                          {disabled ? "Sin stock" : "Agregar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-500">
                      No hay productos para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/30">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black">
                <ShoppingCart className="text-sky-400" size={21} />
                Carrito de venta
              </h2>
              <p className="text-xs text-slate-400">
                Venta directa por unidad. Imprime factura al vender.
              </p>
            </div>

            <button
              onClick={clearCart}
              className="rounded-2xl border border-slate-700 px-4 py-2 text-xs font-black text-slate-300 hover:bg-slate-800"
            >
              Limpiar
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Cliente">
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="input-pro"
              />
            </Field>

            <Field label="Teléfono">
              <input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="809..."
                className="input-pro"
              />
            </Field>

            <Field label="Pago">
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="input-pro"
              >
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Tarjeta</option>
                <option>Crédito</option>
              </select>
            </Field>

            <Field label="Descuento RD$">
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(n(e.target.value))}
                className="input-pro"
              />
            </Field>
          </div>

          <div className="mt-4 space-y-3">
            {cart.map((item) => (
              <div key={item.product_id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-white">{item.product_name}</div>
                    <div className="text-xs text-slate-500">
                      Stock: {item.stock} {item.unit} · Costo: {money.format(item.unit_cost)}
                    </div>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="text-red-300 hover:text-red-200"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="grid grid-cols-[96px_1fr] gap-3">
                  <div className="flex items-center rounded-2xl border border-slate-700 bg-slate-900">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      className="px-3 text-lg text-slate-300"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.product_id, n(e.target.value))}
                      className="w-full bg-transparent text-center font-black outline-none"
                    />
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      className="px-3 text-lg text-slate-300"
                    >
                      +
                    </button>
                  </div>

                  <input
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => updatePrice(item.product_id, n(e.target.value))}
                    className="input-pro font-black"
                  />
                </div>

                <div className="mt-3 flex justify-between text-xs text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-black text-white">
                    {money.format(item.quantity * item.unit_price)}
                  </span>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-10 text-center text-slate-500">
                <ReceiptText className="mx-auto mb-3" size={32} />
                <p className="font-black text-slate-300">Carrito vacío</p>
                <p className="text-sm">Agrega productos desde el inventario.</p>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <TotalRow label="Subtotal" value={money.format(subtotal)} />
            <TotalRow label="Descuento" value={money.format(n(discount))} />
            <TotalRow label="Costo" value={money.format(totalCost)} />
            <TotalRow label="Utilidad" value={money.format(profit)} accent />
            <div className="my-4 border-t border-slate-800" />
            <div className="flex items-end justify-between">
              <span className="text-sm font-black uppercase text-slate-400">Total</span>
              <span className="text-3xl font-black text-emerald-300">
                {money.format(total)}
              </span>
            </div>
          </div>

          <button
            onClick={handleSell}
            disabled={saving || cart.length === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-4 text-sm font-black text-white transition hover:from-blue-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
            Vender, descontar inventario e imprimir factura
          </button>
        </div>
      </section>

      <section className="px-6 pb-8 lg:px-8">
        <div className="rounded-3xl border border-cyan-900/50 bg-slate-900/70 p-5 shadow-2xl shadow-black/30">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black">
                <ReceiptText className="text-cyan-300" size={22} />
                Últimas ventas
              </h2>
              <p className="text-xs text-slate-400">
                Historial de ventas directas. Puedes reimprimir cualquier factura.
              </p>
            </div>

            <button
              onClick={loadRecentSales}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/50 bg-cyan-600/10 px-5 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-600/20"
            >
              <RefreshCw size={18} />
              Actualizar ventas
            </button>
          </div>

          <div className="overflow-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead className="bg-slate-950 text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="p-4 text-left">Factura</th>
                  <th className="p-4 text-left">Cliente</th>
                  <th className="p-4 text-left">Teléfono</th>
                  <th className="p-4 text-left">Total</th>
                  <th className="p-4 text-left">Estado</th>
                  <th className="p-4 text-right">Acción</th>
                </tr>
              </thead>

              <tbody>
                {recentSales.map((sale) => {
                  const busy = printingId === sale.id;

                  return (
                    <tr key={sale.id} className="border-t border-slate-800 hover:bg-cyan-500/10">
                      <td className="p-4">
                        <div className="font-black text-cyan-300">{saleNumber(sale)}</div>
                        <div className="text-xs text-slate-500">{safeDate(sale.created_at)}</div>
                      </td>
                      <td className="p-4 font-bold text-white">{saleClient(sale)}</td>
                      <td className="p-4 text-slate-300">{salePhone(sale) || "-"}</td>
                      <td className="p-4 font-black text-emerald-300">
                        {money.format(n(sale.total))}
                      </td>
                      <td className="p-4">
                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300">
                          {sale.status || "emitida"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handlePrintExistingSale(sale)}
                          disabled={busy}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-black text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="animate-spin" size={17} /> : <Printer size={17} />}
                          Reimprimir
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {recentSales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-500">
                      No hay ventas recientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .input-pro {
          width: 100%;
          border-radius: 0.9rem;
          border: 1px solid rgb(51 65 85);
          background: rgb(15 23 42 / 0.85);
          padding: 0.8rem 0.9rem;
          color: white;
          outline: none;
        }
        .input-pro:focus {
          border-color: rgb(59 130 246);
          box-shadow: 0 0 0 3px rgb(37 99 235 / 0.18);
        }
      `}</style>
    </main>
  );
}

function Metric({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent?: "green" | "blue";
}) {
  return (
    <div className="min-w-[140px] rounded-2xl border border-slate-800 bg-slate-950 px-5 py-3">
      <div className="text-xs text-slate-500">{title}</div>
      <div
        className={`mt-1 text-xl font-black ${
          accent === "green"
            ? "text-emerald-300"
            : accent === "blue"
            ? "text-sky-300"
            : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function TotalRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="mb-2 flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`font-black ${accent ? "text-emerald-300" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}