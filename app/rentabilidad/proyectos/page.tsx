"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  Search,
  Printer,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  DbProjectItem,
  InventoryProduct,
  ItemType,
  ProjectItem,
  ProjectSale,
} from "./types";
import {
  createManualItem,
  money,
  productCost,
  productName,
  productPrice,
  productStock,
} from "./helpers";

export default function ProyectosVentasPage() {
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [projects, setProjects] = useState<ProjectSale[]>([]);
  const [selected, setSelected] = useState<ProjectSale | null>(null);
  const [selectedItems, setSelectedItems] = useState<DbProjectItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [projectName, setProjectName] = useState("Proyecto nuevo");
  const [projectType, setProjectType] = useState("cocina");
  const [clientName, setClientName] = useState("Cliente final");
  const [clientPhone, setClientPhone] = useState("");
  const [clientDocument, setClientDocument] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [status, setStatus] = useState("cotizacion");
  const [productionStatus, setProductionStatus] = useState("pendiente");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [paymentType, setPaymentType] = useState("contado");
  const [amountPaid, setAmountPaid] = useState(0);
  const [delivery, setDelivery] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    await Promise.all([fetchInventory(), fetchProjects()]);
  }

  async function fetchInventory() {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("material", { ascending: true });

    if (error) {
      alert("Error cargando inventario: " + error.message);
      return;
    }

    setInventory((data || []) as InventoryProduct[]);
  }

  async function fetchProjects() {
    const { data } = await supabase
      .from("project_sales")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);

    setProjects((data || []) as ProjectSale[]);
  }

  const filteredInventory = useMemo(() => {
    const q = inventorySearch.toLowerCase().trim();

    return inventory.filter((p) =>
      [
        p.code,
        p.name,
        p.material,
        p.grupo,
        p.subgrupo,
        p.category,
        p.subcategory,
        p.medidas,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [inventory, inventorySearch]);

  const totals = useMemo(() => {
    const byType = (type: ItemType) =>
      items
        .filter((i) => i.item_type === type)
        .reduce((a, i) => a + i.quantity * i.unit_price, 0);

    const material = byType("material");
    const labor = byType("mano_obra");
    const installation = byType("instalacion");
    const design = byType("diseno");
    const other = byType("otro");

    const cost = items.reduce((a, i) => a + i.quantity * i.unit_cost, 0);
    const total = material + labor + installation + design + other;
    const profit = total - cost;
    const margin = total > 0 ? (profit / total) * 100 : 0;
    const balance = total - amountPaid;

    return {
      material,
      labor,
      installation,
      design,
      other,
      cost,
      total,
      profit,
      margin,
      balance,
    };
  }, [items, amountPaid]);

  function addMaterial(product: InventoryProduct) {
    const stock = productStock(product);

    if (stock <= 0) {
      alert("Este material no tiene stock.");
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        item_type: "material",
        product_id: product.id,
        product_name: productName(product),
        description: `${product.code || ""} ${product.medidas || ""}`.trim(),
        quantity: 1,
        unit_cost: productCost(product),
        unit_price: productPrice(product),
        stock_available: stock,
      },
    ]);
  }

  function addManual(type: ItemType) {
    setItems((prev) => [...prev, createManualItem(type)]);
  }

  function updateItem(id: string, field: keyof ProjectItem, value: string | number) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function saveProject() {
    if (items.length === 0 || totals.total <= 0) {
      alert("Agrega materiales o conceptos con precio.");
      return;
    }

    const invalid = items.find(
      (i) => i.item_type === "material" && i.quantity > i.stock_available
    );

    if (invalid) {
      alert(`Stock insuficiente: ${invalid.product_name}`);
      return;
    }

    setSaving(true);

    const stamp = Date.now();
    const invoice = `PRO-${stamp}`;
    const code = `PRY-${stamp}`;

    const { data: sale, error } = await supabase
      .from("project_sales")
      .insert({
        invoice_number: invoice,
        project_code: code,
        project_type: projectType,
        project_name: projectName,
        client_name: clientName,
        client_phone: clientPhone || null,
        client_document: clientDocument || null,
        client_email: clientEmail || null,
        client_address: clientAddress || null,
        seller_name: "Ruben Santana",
        status,
        production_status: productionStatus,
        payment_method: paymentMethod,
        payment_type: paymentType,
        material_total: totals.material,
        labor_total: totals.labor,
        installation_total: totals.installation,
        design_total: totals.design,
        other_total: totals.other,
        subtotal: totals.total,
        total: totals.total,
        amount_paid: amountPaid,
        balance: totals.balance,
        estimated_delivery: delivery || null,
        notes: "Proyecto registrado desde módulo PRO de proyectos",
      })
      .select()
      .single();

    if (error || !sale) {
      alert("Error guardando proyecto: " + error?.message);
      setSaving(false);
      return;
    }

    const itemRows = items.map((i) => ({
      project_sale_id: sale.id,
      product_id: i.product_id,
      item_type: i.item_type,
      product_name: i.product_name,
      category: i.item_type,
      description: i.description || null,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      unit_price: i.unit_price,
      total_cost: i.quantity * i.unit_cost,
      total_price: i.quantity * i.unit_price,
    }));

    const { error: itemError } = await supabase
      .from("project_sale_items")
      .insert(itemRows);

    if (itemError) {
      alert("Proyecto creado, pero falló detalle: " + itemError.message);
      setSaving(false);
      return;
    }

    for (const item of items.filter((i) => i.item_type === "material" && i.product_id)) {
      const before = item.stock_available;
      const after = before - item.quantity;

      const { error: invError } = await supabase
        .from("inventory")
        .update({ stock: after, updated_at: new Date().toISOString() })
        .eq("id", item.product_id);

      if (invError) {
        alert("Error descontando inventario: " + invError.message);
        setSaving(false);
        return;
      }

      await supabase.from("inventory_movements").insert({
        product_id: item.product_id,
        product_name: item.product_name,
        movement_type: "salida_proyecto",
        quantity: item.quantity,
        stock_before: before,
        stock_after: after,
        unit_cost: item.unit_cost,
        unit_price: item.unit_price,
        reference_type: "project_sale",
        reference_id: sale.id,
        notes: `Proyecto ${invoice}`,
      });
    }

    if (amountPaid > 0) {
      await supabase.from("project_payments").insert({
        project_sale_id: sale.id,
        payment_number: `PAY-${stamp}`,
        amount: amountPaid,
        payment_method: paymentMethod,
        note: "Abono inicial",
      });
    }

    alert(`Proyecto guardado: ${invoice}`);

    setItems([]);
    setAmountPaid(0);
    setProjectName("Proyecto nuevo");
    setClientName("Cliente final");
    setClientPhone("");
    setClientDocument("");
    setClientEmail("");
    setClientAddress("");
    setStatus("cotizacion");
    setProductionStatus("pendiente");
    setDelivery("");

    await fetchAll();
    setSaving(false);
  }

  async function openProject(project: ProjectSale) {
    setSelected(project);

    const { data, error } = await supabase
      .from("project_sale_items")
      .select("*")
      .eq("project_sale_id", project.id)
      .order("created_at", { ascending: true });

    if (error) {
      alert("Error abriendo proyecto: " + error.message);
      setSelectedItems([]);
      return;
    }

    setSelectedItems((data || []) as DbProjectItem[]);
  }

  function printProject() {
    if (!selected) return;

    const rows = selectedItems
      .map(
        (i) => `
        <tr>
          <td>${i.item_type}</td>
          <td>${i.product_name}<br/><small>${i.description || ""}</small></td>
          <td>${i.quantity}</td>
          <td>${money(Number(i.unit_price))}</td>
          <td>${money(Number(i.total_price))}</td>
        </tr>`
      )
      .join("");

    const html = `
      <html>
      <head>
        <title>${selected.invoice_number}</title>
        <style>
          @page { size: letter; margin: 10mm; }
          body { font-family: Arial; padding: 32px; color:#111827; }
          .top { display:flex; justify-content:space-between; border-bottom:2px solid #111827; padding-bottom:16px; margin-bottom:24px; }
          table { width:100%; border-collapse:collapse; margin-top:24px; }
          th, td { border-bottom:1px solid #ddd; padding:10px; text-align:left; }
          th { background:#f3f4f6; }
          .total { margin-top:16px; text-align:right; font-size:20px; font-weight:bold; }
        </style>
      </head>
      <body>
        <div class="top">
          <div>
            <h1>RD Wood System</h1>
            <p>Proyectos de cocinas, clósets y mobiliario</p>
            <p>WhatsApp: +1 (809) 690-5636</p>
          </div>
          <div>
            <h2>Proyecto / Factura</h2>
            <p><b>No:</b> ${selected.invoice_number}</p>
            <p><b>Código:</b> ${selected.project_code}</p>
            <p><b>Fecha:</b> ${new Date(selected.created_at).toLocaleString("es-DO")}</p>
          </div>
        </div>

        <p><b>Cliente:</b> ${selected.client_name}</p>
        <p><b>Teléfono:</b> ${selected.client_phone || "-"}</p>
        <p><b>Tipo:</b> ${selected.project_type}</p>
        <p><b>Estado:</b> ${selected.status}</p>
        <p><b>Producción:</b> ${selected.production_status}</p>

        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Concepto</th>
              <th>Cant.</th>
              <th>Precio</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="total">TOTAL: ${money(Number(selected.total || 0))}</div>
        <div class="total">ABONO: ${money(Number(selected.amount_paid || 0))}</div>
        <div class="total">BALANCE: ${money(Number(selected.balance || 0))}</div>
      </body>
      </html>
    `;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
  }

  function sendWhatsApp() {
    if (!selected) return;

    const phone = (selected.client_phone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Hola ${selected.client_name || ""}, le compartimos su proyecto/factura ${selected.invoice_number}. Total: ${money(
        Number(selected.total || 0)
      )}. Abono: ${money(Number(selected.amount_paid || 0))}. Balance: ${money(
        Number(selected.balance || 0)
      )}. Gracias por confiar en RD Wood System.`
    );

    window.open(phone ? `https://wa.me/1${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-5">
      <div className="mb-6 rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-blue-300">
              RD Wood System
            </p>
            <h1 className="mt-2 text-3xl font-black">Proyectos PRO Mundial</h1>
            <p className="mt-1 text-sm text-slate-300">
              Inventario + costeo + abonos + producción + factura + utilidad real.
            </p>
          </div>

          <button
            onClick={fetchAll}
            className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-6">
        <Kpi title="Materiales" value={money(totals.material)} />
        <Kpi title="Mano obra" value={money(totals.labor)} />
        <Kpi title="Instalación" value={money(totals.installation)} />
        <Kpi title="Costo" value={money(totals.cost)} />
        <Kpi title="Total" value={money(totals.total)} />
        <Kpi title="Utilidad" value={`${money(totals.profit)} / ${totals.margin.toFixed(2)}%`} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-4 text-xl font-black">Datos del proyecto</h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input label="Proyecto" value={projectName} setValue={setProjectName} />
            <Select label="Tipo" value={projectType} setValue={setProjectType} options={["cocina", "closet", "vanity", "mueble_tv", "otro"]} />
            <Input label="Cliente" value={clientName} setValue={setClientName} />
            <Input label="Teléfono" value={clientPhone} setValue={setClientPhone} placeholder="809..." />
            <Input label="Documento" value={clientDocument} setValue={setClientDocument} />
            <Input label="Email" value={clientEmail} setValue={setClientEmail} />
            <Input label="Dirección" value={clientAddress} setValue={setClientAddress} />
            <Input label="Entrega estimada" value={delivery} setValue={setDelivery} type="date" />
            <Select label="Estado" value={status} setValue={setStatus} options={["cotizacion", "aprobado", "facturado", "cancelado"]} />
            <Select label="Producción" value={productionStatus} setValue={setProductionStatus} options={["pendiente", "en_produccion", "instalacion", "terminado", "entregado"]} />
            <Select label="Método pago" value={paymentMethod} setValue={setPaymentMethod} options={["efectivo", "transferencia", "tarjeta", "cheque"]} />
            <Select label="Tipo pago" value={paymentType} setValue={setPaymentType} options={["contado", "credito"]} />
          </div>

          <div className="mt-4 rounded-3xl bg-slate-100 p-4">
            <Input
              label="Abono inicial"
              value={String(amountPaid)}
              setValue={(v) => setAmountPaid(Number(v))}
              type="number"
            />

            <Line label="Total proyecto" value={money(totals.total)} />
            <Line label="Abonado" value={money(amountPaid)} />
            <Line label="Balance pendiente" value={money(totals.balance)} green />

            <button
              onClick={saveProject}
              disabled={saving || totals.total <= 0}
              className="mt-4 w-full rounded-2xl bg-green-600 py-4 text-lg font-black text-white shadow-lg hover:bg-green-700 disabled:bg-slate-300"
            >
              {saving ? "Guardando..." : "Guardar Proyecto"}
            </button>
          </div>

          <div className="mt-5 rounded-3xl bg-white p-4 ring-1 ring-slate-200">
            <h3 className="mb-3 font-black">Inventario conectado</h3>

            <div className="relative mb-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                placeholder="Buscar material del inventario..."
                className="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="max-h-[360px] overflow-auto rounded-2xl border">
              {filteredInventory.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 border-b p-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-black">{productName(p)}</p>
                    <p className="text-xs text-slate-500">
                      Stock: {productStock(p)} | Costo: {money(productCost(p))} | Precio: {money(productPrice(p))}
                    </p>
                  </div>

                  <button
                    onClick={() => addMaterial(p)}
                    className="rounded-xl bg-blue-600 px-3 py-2 font-black text-white"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex flex-wrap gap-2">
            <Button text="+ Mano obra" color="bg-orange-600" onClick={() => addManual("mano_obra")} />
            <Button text="+ Instalación" color="bg-purple-600" onClick={() => addManual("instalacion")} />
            <Button text="+ Diseño" color="bg-slate-900" onClick={() => addManual("diseno")} />
            <Button text="+ Otro" color="bg-slate-500" onClick={() => addManual("otro")} />
          </div>

          <div className="max-h-[760px] overflow-auto rounded-2xl border border-slate-200">
            {items.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-center">
                <p className="font-black text-slate-500">
                  Selecciona materiales del inventario o agrega mano de obra.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {items.map((item) => {
                  const totalCost = item.quantity * item.unit_cost;
                  const totalPrice = item.quantity * item.unit_price;
                  const profit = totalPrice - totalCost;
                  const margin = totalPrice > 0 ? (profit / totalPrice) * 100 : 0;

                  return (
                    <div key={item.id} className="p-4">
                      <div className="mb-3 flex justify-between gap-3">
                        <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase text-slate-600">
                          {item.item_type}
                        </span>

                        <button onClick={() => removeItem(item.id)} className="rounded-xl bg-red-50 p-2 text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.9fr]">
                        <input
                          value={item.product_name}
                          onChange={(e) => updateItem(item.id, "product_name", e.target.value)}
                          disabled={item.item_type === "material"}
                          className="rounded-2xl border px-3 py-3 text-sm font-bold disabled:bg-slate-100"
                        />

                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                          className="rounded-2xl border px-3 py-3 text-sm font-bold"
                          placeholder="Cant."
                        />

                        <input
                          type="number"
                          value={item.unit_cost}
                          onChange={(e) => updateItem(item.id, "unit_cost", Number(e.target.value))}
                          className="rounded-2xl border px-3 py-3 text-sm font-bold"
                          placeholder="Costo"
                        />

                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateItem(item.id, "unit_price", Number(e.target.value))}
                          className="rounded-2xl border px-3 py-3 text-sm font-bold"
                          placeholder="Precio"
                        />

                        <div className="rounded-2xl bg-slate-100 px-3 py-3 text-sm font-black">
                          {money(totalPrice)}
                        </div>
                      </div>

                      {item.item_type === "material" && (
                        <p className="mt-2 text-xs font-bold text-slate-500">
                          Stock disponible: {item.stock_available}
                        </p>
                      )}

                      <textarea
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                        className="mt-2 w-full rounded-2xl border px-3 py-3 text-sm"
                        placeholder="Descripción, medidas, color, herrajes, observaciones..."
                      />

                      <div className="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-4">
                        <Mini label="Costo total" value={money(totalCost)} />
                        <Mini label="Venta total" value={money(totalPrice)} />
                        <Mini label="Utilidad" value={money(profit)} green />
                        <Mini label="Margen" value={`${margin.toFixed(2)}%`} green />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 text-xl font-black">Historial de Proyectos</h2>

        <div className="overflow-auto rounded-2xl border">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Factura</th>
                <th className="px-4 py-3">Proyecto</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Producción</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Abono</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>

            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-4 font-black">{p.invoice_number}</td>
                  <td className="px-4 py-4">{p.project_name}</td>
                  <td className="px-4 py-4">{p.client_name}</td>
                  <td className="px-4 py-4">{p.status}</td>
                  <td className="px-4 py-4">{p.production_status}</td>
                  <td className="px-4 py-4 font-black">{money(Number(p.total || 0))}</td>
                  <td className="px-4 py-4">{money(Number(p.amount_paid || 0))}</td>
                  <td className="px-4 py-4 font-black text-red-700">{money(Number(p.balance || 0))}</td>
                  <td className="px-4 py-4 text-right">
                    <button onClick={() => openProject(p)} className="rounded-xl bg-slate-900 px-3 py-2 font-bold text-white">
                      <Eye size={16} className="inline" /> Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex justify-between">
              <div>
                <p className="text-xs font-black uppercase text-slate-500">Proyecto / Factura</p>
                <h2 className="text-2xl font-black">{selected.invoice_number}</h2>
                <p className="text-sm text-slate-500">{selected.client_name}</p>
              </div>

              <button onClick={() => setSelected(null)} className="rounded-xl bg-red-100 px-3 py-2 font-black text-red-700">
                Cerrar
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <Line label="Proyecto" value={selected.project_name || "-"} />
              <Line label="Estado" value={selected.status || "-"} />
              <Line label="Producción" value={selected.production_status || "-"} />
              <Line label="Total" value={money(Number(selected.total || 0))} green />
              <Line label="Abono" value={money(Number(selected.amount_paid || 0))} />
              <Line label="Balance" value={money(Number(selected.balance || 0))} />
            </div>

            <div className="overflow-auto rounded-2xl border">
              <table className="w-full min-w-[750px] text-sm">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Concepto</th>
                    <th className="px-4 py-3">Cant.</th>
                    <th className="px-4 py-3">Precio</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedItems.map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className="px-4 py-3">{i.item_type}</td>
                      <td className="px-4 py-3 font-bold">
                        {i.product_name}
                        <p className="text-xs font-normal text-slate-500">{i.description}</p>
                      </td>
                      <td className="px-4 py-3">{i.quantity}</td>
                      <td className="px-4 py-3">{money(Number(i.unit_price))}</td>
                      <td className="px-4 py-3 font-black">{money(Number(i.total_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <button onClick={printProject} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 font-black text-white">
                <Printer size={18} /> PDF / Imprimir
              </button>

              <button onClick={sendWhatsApp} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 font-black text-white">
                <MessageCircle size={18} /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <h2 className="mt-2 text-xl font-black">{value}</h2>
    </div>
  );
}

function Input({
  label,
  value,
  setValue,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 text-xs font-black uppercase text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
      />
    </div>
  );
}

function Select({
  label,
  value,
  setValue,
  options,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="mb-1 text-xs font-black uppercase text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function Button({
  text,
  color,
  onClick,
}: {
  text: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`rounded-2xl ${color} px-4 py-3 font-black text-white`}>
      <Plus size={16} className="inline" /> {text}
    </button>
  );
}

function Line({
  label,
  value,
  green,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="mb-2 flex justify-between text-sm">
      <span className="font-bold text-slate-600">{label}</span>
      <span className={`font-black ${green ? "text-emerald-700" : "text-slate-900"}`}>
        {value}
      </span>
    </div>
  );
}

function Mini({
  label,
  value,
  green,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-slate-100 p-3">
      <p className="text-[11px] font-black uppercase text-slate-500">{label}</p>
      <p className={`font-black ${green ? "text-emerald-700" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}
