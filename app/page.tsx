"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Module =
  | "dashboard"
  | "clientes"
  | "ordenes"
  | "inventario"
  | "produccion"
  | "historial"
  | "whatsapp";

type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  created_at: string;
};

type Orden = {
  id: string;
  cliente_id: string | null;
  cliente_nombre: string;
  proyecto: string;
  descripcion: string | null;
  estado: string;
  total_estimado: number | null;
  created_at: string;
};

type InventoryItem = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  stock: number;
  unit_cost: number | null;
  created_at?: string;
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

export default function Home() {
  const [activeModule, setActiveModule] = useState<Module>("dashboard");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);

  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "",
    telefono: "",
    email: "",
    direccion: "",
  });

  const [nuevaOrden, setNuevaOrden] = useState({
    cliente_id: "",
    proyecto: "",
    descripcion: "",
    total_estimado: "",
  });

  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    unit: "unidad",
    stock: "",
    unit_cost: "",
  });

  const [production, setProduction] = useState({
    orden_id: "",
    itemId: "",
    quantity: "",
    notes: "",
  });

  const [whatsapp, setWhatsapp] = useState({
    phone: "",
    message: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([
      loadClientes(),
      loadOrdenes(),
      loadInventory(),
      loadMovements(),
    ]);
    setLoading(false);
  }

  async function loadClientes() {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Error cargando clientes");
      return;
    }

    setClientes((data || []) as Cliente[]);
  }

  async function loadOrdenes() {
    const { data, error } = await supabase
      .from("ordenes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Error cargando órdenes");
      return;
    }

    setOrdenes((data || []) as Orden[]);
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

  const totalInventoryValue = useMemo(() => {
    return inventory.reduce((acc, item) => {
      return acc + Number(item.stock || 0) * Number(item.unit_cost || 0);
    }, 0);
  }, [inventory]);

  const lowStockItems = useMemo(() => {
    return inventory.filter((item) => Number(item.stock || 0) <= 5);
  }, [inventory]);

  const ordenesPendientes = ordenes.filter((o) => o.estado === "pendiente").length;
  const ordenesProduccion = ordenes.filter((o) => o.estado === "produccion").length;
  const ordenesTerminadas = ordenes.filter((o) => o.estado === "terminada").length;

  async function crearCliente() {
    if (!nuevoCliente.nombre.trim()) {
      alert("Escribe el nombre del cliente");
      return;
    }

    const { error } = await supabase.from("clientes").insert({
      nombre: nuevoCliente.nombre.trim(),
      telefono: nuevoCliente.telefono.trim() || null,
      email: nuevoCliente.email.trim() || null,
      direccion: nuevoCliente.direccion.trim() || null,
    });

    if (error) {
      console.error(error);
      alert("No se pudo guardar el cliente");
      return;
    }

    setNuevoCliente({
      nombre: "",
      telefono: "",
      email: "",
      direccion: "",
    });

    await loadClientes();
  }

  async function crearOrden() {
    if (!nuevaOrden.cliente_id || !nuevaOrden.proyecto.trim()) {
      alert("Selecciona cliente y escribe el proyecto");
      return;
    }

    const cliente = clientes.find((c) => c.id === nuevaOrden.cliente_id);

    if (!cliente) {
      alert("Cliente no encontrado");
      return;
    }

    const { error } = await supabase.from("ordenes").insert({
      cliente_id: cliente.id,
      cliente_nombre: cliente.nombre,
      proyecto: nuevaOrden.proyecto.trim(),
      descripcion: nuevaOrden.descripcion.trim() || null,
      estado: "pendiente",
      total_estimado: Number(nuevaOrden.total_estimado || 0),
    });

    if (error) {
      console.error(error);
      alert("No se pudo crear la orden");
      return;
    }

    setNuevaOrden({
      cliente_id: "",
      proyecto: "",
      descripcion: "",
      total_estimado: "",
    });

    await loadOrdenes();
  }

  async function cambiarEstadoOrden(ordenId: string, estado: string) {
    const { error } = await supabase
      .from("ordenes")
      .update({ estado })
      .eq("id", ordenId);

    if (error) {
      console.error(error);
      alert("No se pudo cambiar el estado");
      return;
    }

    await loadOrdenes();
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

    await loadData();
  }

  async function registerMovement(params: {
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
      alert("No se pudo guardar el historial");
      console.error(error);
    }
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
      alert("No se pudo actualizar el stock");
      console.error(error);
      return;
    }

    await registerMovement({
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

  async function discountFromProduction() {
    if (!production.orden_id || !production.itemId || !production.quantity) {
      alert("Selecciona orden, material y cantidad");
      return;
    }

    const orden = ordenes.find((o) => o.id === production.orden_id);
    const item = inventory.find((i) => i.id === production.itemId);

    if (!orden || !item) {
      alert("Orden o material no encontrado");
      return;
    }

    const quantity = Number(production.quantity);

    if (quantity <= 0) {
      alert("La cantidad debe ser mayor que cero");
      return;
    }

    const stockBefore = Number(item.stock || 0);
    const stockAfter = stockBefore - quantity;

    if (stockAfter < 0) {
      alert("No hay suficiente stock");
      return;
    }

    const { error } = await supabase
      .from("inventory_items")
      .update({ stock: stockAfter })
      .eq("id", item.id);

    if (error) {
      alert("No se pudo rebajar inventario");
      console.error(error);
      return;
    }

    await supabase
      .from("ordenes")
      .update({ estado: "produccion" })
      .eq("id", orden.id);

    await registerMovement({
      itemId: item.id,
      itemName: item.name,
      movementType: "produccion",
      quantity,
      stockBefore,
      stockAfter,
      relatedOrder: `${orden.proyecto} - ${orden.cliente_nombre}`,
      materialUsed: item.name,
      notes: production.notes || undefined,
    });

    setProduction({
      orden_id: "",
      itemId: "",
      quantity: "",
      notes: "",
    });

    await loadData();
    alert("Producción registrada e inventario rebajado");
  }

  function openWhatsApp() {
    const phone = whatsapp.phone.replace(/\D/g, "");
    const message = encodeURIComponent(whatsapp.message);

    if (!phone || !message) {
      alert("Completa teléfono y mensaje");
      return;
    }

    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  }

  const selectedProductionItem = inventory.find((i) => i.id === production.itemId);
  const productionCost =
    Number(production.quantity || 0) * Number(selectedProductionItem?.unit_cost || 0);

  return (
    <main style={styles.app}>
      <aside style={styles.sidebar}>
        <div>
          <div style={styles.logoBox}>
            <h1 style={styles.logo}>RD WOOD</h1>
            <p style={styles.logoSub}>Corte Visual Pro</p>
          </div>

          <nav style={styles.nav}>
            <MenuButton label="Dashboard" icon="📊" active={activeModule === "dashboard"} onClick={() => setActiveModule("dashboard")} />
            <MenuButton label="Clientes" icon="👤" active={activeModule === "clientes"} onClick={() => setActiveModule("clientes")} />
            <MenuButton label="Órdenes" icon="🧾" active={activeModule === "ordenes"} onClick={() => setActiveModule("ordenes")} />
            <MenuButton label="Inventario" icon="📦" active={activeModule === "inventario"} onClick={() => setActiveModule("inventario")} />
            <MenuButton label="Producción" icon="🏭" active={activeModule === "produccion"} onClick={() => setActiveModule("produccion")} />
            <MenuButton label="Historial" icon="📚" active={activeModule === "historial"} onClick={() => setActiveModule("historial")} />
            <MenuButton label="WhatsApp" icon="🟢" active={activeModule === "whatsapp"} onClick={() => setActiveModule("whatsapp")} />
          </nav>
        </div>

        <div style={styles.sidebarFooter}>
          <p>RD Wood Design</p>
          <span>Sistema empresarial</span>
        </div>
      </aside>

      <section style={styles.content}>
        <header style={styles.header}>
          <div>
            <h2 style={styles.pageTitle}>
              {activeModule === "dashboard" && "Dashboard"}
              {activeModule === "clientes" && "Clientes"}
              {activeModule === "ordenes" && "Órdenes de trabajo"}
              {activeModule === "inventario" && "Inventario"}
              {activeModule === "produccion" && "Producción"}
              {activeModule === "historial" && "Historial"}
              {activeModule === "whatsapp" && "WhatsApp"}
            </h2>
            <p style={styles.pageSubtitle}>
              Control real de clientes, órdenes, inventario y producción.
            </p>
          </div>

          <button style={styles.refreshButton} onClick={loadData}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </header>

        {activeModule === "dashboard" && (
          <div>
            <div style={styles.cardsGrid}>
              <StatCard title="Clientes" value={clientes.length.toString()} />
              <StatCard title="Órdenes" value={ordenes.length.toString()} />
              <StatCard title="Pendientes" value={ordenesPendientes.toString()} />
              <StatCard title="En producción" value={ordenesProduccion.toString()} />
              <StatCard title="Terminadas" value={ordenesTerminadas.toString()} />
              <StatCard title="Materiales" value={inventory.length.toString()} />
              <StatCard title="Valor inventario" value={`RD$ ${totalInventoryValue.toLocaleString("es-DO")}`} />
              <StatCard title="Stock bajo" value={lowStockItems.length.toString()} />
            </div>

            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <h3>Órdenes recientes</h3>
                <span>Últimos trabajos registrados</span>
              </div>

              <DataTable
                headers={["Cliente", "Proyecto", "Estado", "Total"]}
                rows={ordenes.slice(0, 5).map((o) => [
                  o.cliente_nombre,
                  o.proyecto,
                  o.estado,
                  `RD$ ${Number(o.total_estimado || 0).toLocaleString("es-DO")}`,
                ])}
              />
            </section>
          </div>
        )}

        {activeModule === "clientes" && (
          <div style={styles.gridTwo}>
            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <h3>Nuevo cliente</h3>
                <span>Registra tus clientes</span>
              </div>

              <div style={styles.formGridTwo}>
                <input style={styles.input} placeholder="Nombre" value={nuevoCliente.nombre} onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} />
                <input style={styles.input} placeholder="Teléfono" value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} />
                <input style={styles.input} placeholder="Email" value={nuevoCliente.email} onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })} />
                <input style={styles.input} placeholder="Dirección" value={nuevoCliente.direccion} onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })} />
              </div>

              <button style={styles.primaryButton} onClick={crearCliente}>
                Guardar cliente
              </button>
            </section>

            <section style={styles.panelWide}>
              <div style={styles.panelHeader}>
                <h3>Lista de clientes</h3>
                <span>{clientes.length} clientes registrados</span>
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Teléfono</th>
                      <th>Email</th>
                      <th>Dirección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.length === 0 ? (
                      <tr><td colSpan={4} style={styles.emptyCell}>No hay clientes registrados.</td></tr>
                    ) : clientes.map((c) => (
                      <tr key={c.id}>
                        <td>{c.nombre}</td>
                        <td>{c.telefono || "-"}</td>
                        <td>{c.email || "-"}</td>
                        <td>{c.direccion || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeModule === "ordenes" && (
          <div style={styles.gridTwo}>
            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <h3>Nueva orden</h3>
                <span>Crea una orden de trabajo</span>
              </div>

              <div style={styles.formGridTwo}>
                <select style={styles.input} value={nuevaOrden.cliente_id} onChange={(e) => setNuevaOrden({ ...nuevaOrden, cliente_id: e.target.value })}>
                  <option value="">Seleccionar cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>

                <input style={styles.input} placeholder="Proyecto. Ej: Cocina modular" value={nuevaOrden.proyecto} onChange={(e) => setNuevaOrden({ ...nuevaOrden, proyecto: e.target.value })} />
                <input style={styles.input} placeholder="Total estimado RD$" type="number" value={nuevaOrden.total_estimado} onChange={(e) => setNuevaOrden({ ...nuevaOrden, total_estimado: e.target.value })} />
                <input style={styles.input} placeholder="Descripción" value={nuevaOrden.descripcion} onChange={(e) => setNuevaOrden({ ...nuevaOrden, descripcion: e.target.value })} />
              </div>

              <button style={styles.primaryButton} onClick={crearOrden}>
                Crear orden
              </button>
            </section>

            <section style={styles.panelWide}>
              <div style={styles.panelHeader}>
                <h3>Órdenes activas</h3>
                <span>Control por estado</span>
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Proyecto</th>
                      <th>Estado</th>
                      <th>Total</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenes.length === 0 ? (
                      <tr><td colSpan={5} style={styles.emptyCell}>No hay órdenes registradas.</td></tr>
                    ) : ordenes.map((o) => (
                      <tr key={o.id}>
                        <td>{o.cliente_nombre}</td>
                        <td>{o.proyecto}</td>
                        <td><Badge text={o.estado} /></td>
                        <td>RD$ {Number(o.total_estimado || 0).toLocaleString("es-DO")}</td>
                        <td>
                          <select style={styles.smallSelect} value={o.estado} onChange={(e) => cambiarEstadoOrden(o.id, e.target.value)}>
                            <option value="pendiente">Pendiente</option>
                            <option value="produccion">Producción</option>
                            <option value="terminada">Terminada</option>
                            <option value="entregada">Entregada</option>
                            <option value="cancelada">Cancelada</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeModule === "inventario" && (
          <div style={styles.gridTwo}>
            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <h3>Agregar material</h3>
                <span>Registra materiales disponibles</span>
              </div>

              <div style={styles.formGridTwo}>
                <input style={styles.input} placeholder="Nombre" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
                <input style={styles.input} placeholder="Categoría" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} />
                <input style={styles.input} placeholder="Unidad" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
                <input style={styles.input} type="number" placeholder="Stock" value={newItem.stock} onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })} />
                <input style={styles.input} type="number" placeholder="Costo unitario" value={newItem.unit_cost} onChange={(e) => setNewItem({ ...newItem, unit_cost: e.target.value })} />
              </div>

              <button style={styles.primaryButton} onClick={addInventoryItem}>
                Agregar material
              </button>
            </section>

            <section style={styles.panelWide}>
              <div style={styles.panelHeader}>
                <h3>Inventario actual</h3>
                <span>Entradas, salidas y stock</span>
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Categoría</th>
                      <th>Stock</th>
                      <th>Costo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.length === 0 ? (
                      <tr><td colSpan={5} style={styles.emptyCell}>No hay materiales registrados.</td></tr>
                    ) : inventory.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.category || "-"}</td>
                        <td>{item.stock} {item.unit}</td>
                        <td>RD$ {Number(item.unit_cost || 0).toLocaleString("es-DO")}</td>
                        <td>
                          <button style={styles.smallGreenButton} onClick={() => adjustStock(item, "entrada")}>Entrada</button>
                          <button style={styles.smallRedButton} onClick={() => adjustStock(item, "salida")}>Salida</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeModule === "produccion" && (
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h3>Producción por orden</h3>
              <span>Descuenta material y guarda movimiento</span>
            </div>

            <div style={styles.formGridTwo}>
              <select style={styles.input} value={production.orden_id} onChange={(e) => setProduction({ ...production, orden_id: e.target.value })}>
                <option value="">Seleccionar orden</option>
                {ordenes.map((o) => (
                  <option key={o.id} value={o.id}>{o.proyecto} - {o.cliente_nombre}</option>
                ))}
              </select>

              <select style={styles.input} value={production.itemId} onChange={(e) => setProduction({ ...production, itemId: e.target.value })}>
                <option value="">Seleccionar material</option>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — Stock: {item.stock} {item.unit}
                  </option>
                ))}
              </select>

              <input style={styles.input} type="number" placeholder="Cantidad usada" value={production.quantity} onChange={(e) => setProduction({ ...production, quantity: e.target.value })} />
              <input style={styles.input} placeholder="Notas" value={production.notes} onChange={(e) => setProduction({ ...production, notes: e.target.value })} />
            </div>

            <div style={styles.costBox}>
              <strong>Costo estimado del consumo:</strong>
              <span>RD$ {productionCost.toLocaleString("es-DO")}</span>
            </div>

            <button style={styles.primaryButton} onClick={discountFromProduction}>
              Rebajar inventario y registrar producción
            </button>
          </section>
        )}

        {activeModule === "historial" && (
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h3>Historial de movimientos</h3>
              <span>Stock antes, después, orden, material y fecha</span>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Material</th>
                    <th>Cantidad</th>
                    <th>Antes</th>
                    <th>Después</th>
                    <th>Orden</th>
                    <th>Uso</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr><td colSpan={8} style={styles.emptyCell}>No hay movimientos registrados.</td></tr>
                  ) : movements.map((m) => (
                    <tr key={m.id}>
                      <td>{new Date(m.created_at).toLocaleString("es-DO")}</td>
                      <td><Badge text={m.movement_type} /></td>
                      <td>{m.item_name}</td>
                      <td>{m.quantity}</td>
                      <td>{m.stock_before}</td>
                      <td>{m.stock_after}</td>
                      <td>{m.related_order || "-"}</td>
                      <td>{m.material_used || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeModule === "whatsapp" && (
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h3>WhatsApp automático</h3>
              <span>Envía mensajes directos a clientes</span>
            </div>

            <div style={styles.formGridTwo}>
              <input style={styles.input} placeholder="Teléfono. Ej: 18096905636" value={whatsapp.phone} onChange={(e) => setWhatsapp({ ...whatsapp, phone: e.target.value })} />
              <textarea style={{ ...styles.input, minHeight: 140 }} placeholder="Mensaje" value={whatsapp.message} onChange={(e) => setWhatsapp({ ...whatsapp, message: e.target.value })} />
            </div>

            <button style={styles.whatsappButton} onClick={openWhatsApp}>
              Abrir WhatsApp
            </button>
          </section>
        )}
      </section>
    </main>
  );
}

function MenuButton({ label, icon, active, onClick }: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={active ? styles.menuActive : styles.menuButton}>
      <span>{icon}</span>
      {label}
    </button>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  const color =
    text === "entrada" ? "#16a34a" :
    text === "salida" ? "#dc2626" :
    text === "produccion" ? "#2563eb" :
    text === "produccion" ? "#2563eb" :
    text === "terminada" ? "#16a34a" :
    text === "entregada" ? "#9333ea" :
    text === "cancelada" ? "#dc2626" :
    "#ca8a04";

  return (
    <span style={{
      background: `${color}20`,
      color,
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      textTransform: "capitalize",
    }}>
      {text}
    </span>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} style={styles.emptyCell}>No hay datos.</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles: any = {
  app: {
    minHeight: "100vh",
    display: "flex",
    background: "#f4f7fb",
    color: "#0f172a",
    fontFamily: "Arial, sans-serif",
  },
  sidebar: {
    width: 285,
    background: "linear-gradient(180deg, #020617, #0f172a)",
    color: "white",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  logoBox: { marginBottom: 30 },
  logo: { margin: 0, fontSize: 28, color: "#22c55e", letterSpacing: 1 },
  logoSub: { marginTop: 6, color: "#94a3b8", fontSize: 14 },
  nav: { display: "flex", flexDirection: "column", gap: 12 },
  menuButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#cbd5e1",
    padding: "14px 16px",
    borderRadius: 14,
    textAlign: "left",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 15,
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  menuActive: {
    width: "100%",
    border: "none",
    background: "linear-gradient(90deg, #22c55e, #86efac)",
    color: "#052e16",
    padding: "14px 16px",
    borderRadius: 14,
    textAlign: "left",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 15,
    display: "flex",
    gap: 10,
    alignItems: "center",
    boxShadow: "0 10px 25px rgba(34,197,94,.35)",
  },
  sidebarFooter: { color: "#94a3b8", fontSize: 13 },
  content: { flex: 1, padding: 34, overflow: "auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  pageTitle: { margin: 0, fontSize: 34, fontWeight: 900 },
  pageSubtitle: { color: "#64748b", marginTop: 6 },
  refreshButton: {
    background: "#0f172a",
    color: "white",
    border: "none",
    borderRadius: 14,
    padding: "13px 18px",
    fontWeight: 900,
    cursor: "pointer",
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 18,
    marginBottom: 24,
  },
  statCard: {
    background: "white",
    borderRadius: 22,
    padding: 24,
    boxShadow: "0 12px 35px rgba(15,23,42,.08)",
    border: "1px solid #e2e8f0",
  },
  panel: {
    background: "white",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 12px 35px rgba(15,23,42,.08)",
    border: "1px solid #e2e8f0",
    marginBottom: 24,
  },
  panelWide: {
    background: "white",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 12px 35px rgba(15,23,42,.08)",
    border: "1px solid #e2e8f0",
    gridColumn: "1 / -1",
  },
  panelHeader: { marginBottom: 18 },
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 24,
  },
  formGridTwo: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "14px 15px",
    outline: "none",
    fontSize: 14,
    background: "#fff",
  },
  primaryButton: {
    marginTop: 18,
    background: "linear-gradient(90deg, #16a34a, #22c55e)",
    color: "white",
    border: "none",
    borderRadius: 16,
    padding: "14px 22px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(34,197,94,.25)",
  },
  whatsappButton: {
    marginTop: 18,
    background: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: 16,
    padding: "14px 22px",
    fontWeight: 900,
    cursor: "pointer",
  },
  tableWrap: { overflowX: "auto" },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  emptyCell: {
    padding: 20,
    textAlign: "center",
    color: "#64748b",
  },
  smallGreenButton: {
    background: "#dcfce7",
    color: "#166534",
    border: "none",
    borderRadius: 10,
    padding: "8px 10px",
    marginRight: 8,
    fontWeight: 800,
    cursor: "pointer",
  },
  smallRedButton: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "none",
    borderRadius: 10,
    padding: "8px 10px",
    fontWeight: 800,
    cursor: "pointer",
  },
  smallSelect: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "8px 10px",
    background: "white",
  },
  costBox: {
    marginTop: 18,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 16,
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    color: "#166534",
  },
};