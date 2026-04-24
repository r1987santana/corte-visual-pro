"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Module =
  | "dashboard"
  | "inventario"
  | "produccion"
  | "movimientos"
  | "whatsapp";

type InventoryItem = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  stock: number;
  unit_cost: number | null;
};

type Movement = {
  id: string;
  item_id: string | null;
  item_name: string;
  movement_type: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  related_order: string | null;
  material_used: string | null;
  notes: string | null;
  created_at: string;
};

export default function CorteVisualPro() {
  const [activeModule, setActiveModule] = useState<Module>("dashboard");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);

  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    unit: "unidad",
    stock: "",
    unit_cost: "",
  });

  const [production, setProduction] = useState({
    order: "",
    client: "",
    project: "",
    itemId: "",
    quantity: "",
    notes: "",
  });

  const [whatsapp, setWhatsapp] = useState({
    phone: "",
    message: "",
  });

  const totalInventoryValue = useMemo(() => {
    return inventory.reduce((acc, item) => {
      return acc + Number(item.stock || 0) * Number(item.unit_cost || 0);
    }, 0);
  }, [inventory]);

  const lowStockItems = useMemo(() => {
    return inventory.filter((item) => Number(item.stock || 0) <= 5);
  }, [inventory]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadInventory(), loadMovements()]);
    setLoading(false);
  }

  async function loadInventory() {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      alert("Error cargando inventario");
      return;
    }

    setInventory((data || []) as InventoryItem[]);
  }

  async function loadMovements() {
    const { data, error } = await supabase
      .from("inventory_movements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setMovements((data || []) as Movement[]);
  }

  async function addInventoryItem() {
    if (!newItem.name.trim()) {
      alert("Escribe el nombre del material");
      return;
    }

    const { error } = await supabase.from("inventory_items").insert({
      name: newItem.name.trim(),
      category: newItem.category.trim() || null,
      unit: newItem.unit || "unidad",
      stock: Number(newItem.stock || 0),
      unit_cost: Number(newItem.unit_cost || 0),
    });

    if (error) {
      console.error(error);
      alert("No se pudo agregar el material");
      return;
    }

    setNewItem({
      name: "",
      category: "",
      unit: "unidad",
      stock: "",
      unit_cost: "",
    });

    await loadInventory();
  }

  async function registerInventoryMovement(params: {
    itemId: string | null;
    itemName: string;
    movementType: "entrada" | "salida" | "ajuste" | "produccion";
    quantity: number;
    stockBefore: number;
    stockAfter: number;
    relatedOrder?: string;
    materialUsed?: string;
    notes?: string;
  }) {
    const { error } = await supabase.from("inventory_movements").insert({
      item_id: params.itemId,
      item_name: params.itemName,
      movement_type: params.movementType,
      quantity: params.quantity,
      stock_before: params.stockBefore,
      stock_after: params.stockAfter,
      related_order: params.relatedOrder || null,
      material_used: params.materialUsed || null,
      notes: params.notes || null,
    });

    if (error) {
      console.error(error);
      alert("No se pudo guardar el historial");
    }
  }

  async function discountFromProduction() {
    if (!production.itemId || !production.quantity) {
      alert("Selecciona material y cantidad");
      return;
    }

    const item = inventory.find((i) => i.id === production.itemId);

    if (!item) {
      alert("Material no encontrado");
      return;
    }

    const quantity = Number(production.quantity);

    if (quantity <= 0) {
      alert("La cantidad debe ser mayor a cero");
      return;
    }

    const stockBefore = Number(item.stock || 0);
    const stockAfter = stockBefore - quantity;

    if (stockAfter < 0) {
      alert("No hay suficiente stock para rebajar esa cantidad");
      return;
    }

    const { error } = await supabase
      .from("inventory_items")
      .update({ stock: stockAfter })
      .eq("id", item.id);

    if (error) {
      console.error(error);
      alert("No se pudo rebajar inventario");
      return;
    }

    await registerInventoryMovement({
      itemId: item.id,
      itemName: item.name,
      movementType: "produccion",
      quantity,
      stockBefore,
      stockAfter,
      relatedOrder: production.order || "Producción sin número",
      materialUsed: item.name,
      notes: `Cliente: ${production.client || "-"} | Proyecto: ${
        production.project || "-"
      } | ${production.notes || ""}`,
    });

    setProduction({
      order: "",
      client: "",
      project: "",
      itemId: "",
      quantity: "",
      notes: "",
    });

    await loadData();
    alert("Inventario rebajado y movimiento guardado");
  }

  async function adjustStock(item: InventoryItem, type: "entrada" | "salida") {
    const value = prompt(
      type === "entrada"
        ? "Cantidad que entra al inventario:"
        : "Cantidad que sale del inventario:"
    );

    if (!value) return;

    const quantity = Number(value);

    if (quantity <= 0) {
      alert("Cantidad inválida");
      return;
    }

    const stockBefore = Number(item.stock || 0);
    const stockAfter =
      type === "entrada" ? stockBefore + quantity : stockBefore - quantity;

    if (stockAfter < 0) {
      alert("No hay suficiente stock");
      return;
    }

    const { error } = await supabase
      .from("inventory_items")
      .update({ stock: stockAfter })
      .eq("id", item.id);

    if (error) {
      console.error(error);
      alert("No se pudo actualizar stock");
      return;
    }

    await registerInventoryMovement({
      itemId: item.id,
      itemName: item.name,
      movementType: type,
      quantity,
      stockBefore,
      stockAfter,
      relatedOrder: "Movimiento manual",
      materialUsed: item.name,
    });

    await loadData();
  }

  function openWhatsApp() {
    const phone = whatsapp.phone.replace(/\D/g, "");
    const text = encodeURIComponent(whatsapp.message);

    if (!phone || !text) {
      alert("Completa teléfono y mensaje");
      return;
    }

    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-72 bg-white border-r border-slate-200 p-5 hidden md:block">
          <div className="mb-8">
            <h1 className="text-2xl font-black">Corte Visual Pro</h1>
            <p className="text-sm text-slate-500">
              Producción, inventario y costeo
            </p>
          </div>

          <nav className="space-y-2">
            <MenuButton
              label="Dashboard"
              icon="📊"
              active={activeModule === "dashboard"}
              onClick={() => setActiveModule("dashboard")}
            />
            <MenuButton
              label="Inventario"
              icon="📦"
              active={activeModule === "inventario"}
              onClick={() => setActiveModule("inventario")}
            />
            <MenuButton
              label="Producción"
              icon="🏭"
              active={activeModule === "produccion"}
              onClick={() => setActiveModule("produccion")}
            />
            <MenuButton
              label="Historial"
              icon="🧾"
              active={activeModule === "movimientos"}
              onClick={() => setActiveModule("movimientos")}
            />
            <MenuButton
              label="WhatsApp"
              icon="🟢"
              active={activeModule === "whatsapp"}
              onClick={() => setActiveModule("whatsapp")}
            />
          </nav>
        </aside>

        <section className="flex-1 p-4 md:p-8">
          <div className="md:hidden mb-4 grid grid-cols-2 gap-2">
            <button onClick={() => setActiveModule("dashboard")} className="btn">
              Dashboard
            </button>
            <button onClick={() => setActiveModule("inventario")} className="btn">
              Inventario
            </button>
            <button onClick={() => setActiveModule("produccion")} className="btn">
              Producción
            </button>
            <button onClick={() => setActiveModule("movimientos")} className="btn">
              Historial
            </button>
          </div>

          <header className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black">
                {activeModule === "dashboard" && "Dashboard"}
                {activeModule === "inventario" && "Inventario"}
                {activeModule === "produccion" && "Producción"}
                {activeModule === "movimientos" && "Historial de movimientos"}
                {activeModule === "whatsapp" && "WhatsApp automático"}
              </h2>
              <p className="text-slate-500">
                Sistema profesional para RD Wood Design / Santana Group
              </p>
            </div>

            <button
              onClick={loadData}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold"
            >
              {loading ? "Cargando..." : "Actualizar"}
            </button>
          </header>

          {activeModule === "dashboard" && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-4 gap-4">
                <Card title="Materiales" value={inventory.length.toString()} />
                <Card
                  title="Valor inventario"
                  value={`RD$ ${totalInventoryValue.toLocaleString("es-DO")}`}
                />
                <Card title="Stock bajo" value={lowStockItems.length.toString()} />
                <Card title="Movimientos" value={movements.length.toString()} />
              </div>

              <Panel title="Alertas de stock bajo">
                {lowStockItems.length === 0 ? (
                  <p className="text-slate-500">No hay materiales en stock bajo.</p>
                ) : (
                  <div className="space-y-2">
                    {lowStockItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between bg-red-50 text-red-700 p-3 rounded-xl"
                      >
                        <span>{item.name}</span>
                        <strong>
                          {item.stock} {item.unit}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          )}

          {activeModule === "inventario" && (
            <div className="space-y-6">
              <Panel title="Agregar material">
                <div className="grid md:grid-cols-5 gap-3">
                  <input
                    className="input"
                    placeholder="Nombre"
                    value={newItem.name}
                    onChange={(e) =>
                      setNewItem({ ...newItem, name: e.target.value })
                    }
                  />
                  <input
                    className="input"
                    placeholder="Categoría"
                    value={newItem.category}
                    onChange={(e) =>
                      setNewItem({ ...newItem, category: e.target.value })
                    }
                  />
                  <input
                    className="input"
                    placeholder="Unidad"
                    value={newItem.unit}
                    onChange={(e) =>
                      setNewItem({ ...newItem, unit: e.target.value })
                    }
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Stock"
                    value={newItem.stock}
                    onChange={(e) =>
                      setNewItem({ ...newItem, stock: e.target.value })
                    }
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Costo unitario"
                    value={newItem.unit_cost}
                    onChange={(e) =>
                      setNewItem({ ...newItem, unit_cost: e.target.value })
                    }
                  />
                </div>

                <button
                  onClick={addInventoryItem}
                  className="mt-4 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold"
                >
                  Agregar material
                </button>
              </Panel>

              <Panel title="Inventario actual">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="p-3 text-left">Material</th>
                        <th className="p-3 text-left">Categoría</th>
                        <th className="p-3 text-right">Stock</th>
                        <th className="p-3 text-right">Costo</th>
                        <th className="p-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-3 font-bold">{item.name}</td>
                          <td className="p-3">{item.category || "-"}</td>
                          <td className="p-3 text-right">
                            {item.stock} {item.unit}
                          </td>
                          <td className="p-3 text-right">
                            RD$ {Number(item.unit_cost || 0).toLocaleString("es-DO")}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <button
                              onClick={() => adjustStock(item, "entrada")}
                              className="px-3 py-1 rounded-lg bg-green-100 text-green-700 font-bold"
                            >
                              Entrada
                            </button>
                            <button
                              onClick={() => adjustStock(item, "salida")}
                              className="px-3 py-1 rounded-lg bg-red-100 text-red-700 font-bold"
                            >
                              Salida
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          )}

          {activeModule === "produccion" && (
            <Panel title="Rebajar inventario por producción">
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  className="input"
                  placeholder="Orden relacionada"
                  value={production.order}
                  onChange={(e) =>
                    setProduction({ ...production, order: e.target.value })
                  }
                />
                <input
                  className="input"
                  placeholder="Cliente"
                  value={production.client}
                  onChange={(e) =>
                    setProduction({ ...production, client: e.target.value })
                  }
                />
                <input
                  className="input"
                  placeholder="Proyecto"
                  value={production.project}
                  onChange={(e) =>
                    setProduction({ ...production, project: e.target.value })
                  }
                />
                <select
                  className="input"
                  value={production.itemId}
                  onChange={(e) =>
                    setProduction({ ...production, itemId: e.target.value })
                  }
                >
                  <option value="">Seleccionar material del inventario</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — Stock: {item.stock} {item.unit}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  type="number"
                  placeholder="Cantidad usada"
                  value={production.quantity}
                  onChange={(e) =>
                    setProduction({ ...production, quantity: e.target.value })
                  }
                />
                <input
                  className="input"
                  placeholder="Notas"
                  value={production.notes}
                  onChange={(e) =>
                    setProduction({ ...production, notes: e.target.value })
                  }
                />
              </div>

              <button
                onClick={discountFromProduction}
                className="mt-5 px-6 py-3 rounded-xl bg-blue-600 text-white font-black"
              >
                Rebajar inventario y guardar movimiento
              </button>
            </Panel>
          )}

          {activeModule === "movimientos" && (
            <Panel title="Historial de movimientos">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-3 text-left">Fecha</th>
                      <th className="p-3 text-left">Tipo</th>
                      <th className="p-3 text-left">Material</th>
                      <th className="p-3 text-right">Cantidad</th>
                      <th className="p-3 text-right">Stock antes</th>
                      <th className="p-3 text-right">Stock después</th>
                      <th className="p-3 text-left">Orden</th>
                      <th className="p-3 text-left">Uso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-b">
                        <td className="p-3">
                          {new Date(m.created_at).toLocaleString("es-DO")}
                        </td>
                        <td className="p-3 font-bold">{m.movement_type}</td>
                        <td className="p-3">{m.item_name}</td>
                        <td className="p-3 text-right">{m.quantity}</td>
                        <td className="p-3 text-right">{m.stock_before}</td>
                        <td className="p-3 text-right font-bold">
                          {m.stock_after}
                        </td>
                        <td className="p-3">{m.related_order || "-"}</td>
                        <td className="p-3">{m.material_used || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {activeModule === "whatsapp" && (
            <Panel title="Enviar WhatsApp automático">
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  className="input"
                  placeholder="Teléfono con código. Ej: 18096905636"
                  value={whatsapp.phone}
                  onChange={(e) =>
                    setWhatsapp({ ...whatsapp, phone: e.target.value })
                  }
                />
                <textarea
                  className="input min-h-32 md:col-span-2"
                  placeholder="Mensaje"
                  value={whatsapp.message}
                  onChange={(e) =>
                    setWhatsapp({ ...whatsapp, message: e.target.value })
                  }
                />
              </div>

              <button
                onClick={openWhatsApp}
                className="mt-5 px-6 py-3 rounded-xl bg-green-600 text-white font-black"
              >
                Abrir WhatsApp
              </button>
            </Panel>
          )}
        </section>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          padding: 12px 14px;
          background: white;
          outline: none;
        }

        .input:focus {
          border-color: #0f172a;
        }

        .btn {
          padding: 10px;
          background: white;
          border-radius: 12px;
          font-weight: 800;
        }
      `}</style>
    </main>
  );
}

function MenuButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl font-bold transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-50 text-slate-700 hover:bg-slate-100"
      }`}
    >
      <span className="mr-2">{icon}</span>
      {label}
    </button>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <h3 className="text-2xl font-black mt-2">{value}</h3>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="text-xl font-black mb-5">{title}</h3>
      {children}
    </section>
  );
}