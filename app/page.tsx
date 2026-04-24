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
  created_at: string;
};

type Orden = {
  id: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  proyecto: string | null;
  estado: string | null;
  total: number | null;
  created_at: string;
};

type InventarioItem = {
  id: string;
  nombre: string;
  categoria: string | null;
  unidad: string | null;
  stock: number | null;
  costo_unitario: number | null;
  created_at: string;
};

type Movimiento = {
  id: string;
  item_id: string | null;
  item_nombre: string | null;
  tipo: string | null;
  cantidad: number | null;
  stock_antes: number | null;
  stock_despues: number | null;
  orden_relacionada: string | null;
  material_usado: string | null;
  notas: string | null;
  created_at: string;
};

export default function Home() {
  const [activeModule, setActiveModule] = useState<Module>("dashboard");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(false);

  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "",
    telefono: "",
    email: "",
  });

  const [nuevaOrden, setNuevaOrden] = useState({
    cliente_id: "",
    proyecto: "",
    total: "",
  });

  const [nuevoMaterial, setNuevoMaterial] = useState({
    nombre: "",
    categoria: "",
    unidad: "unidad",
    stock: "",
    costo_unitario: "",
  });

  const [produccion, setProduccion] = useState({
    orden_id: "",
    item_id: "",
    cantidad: "",
    notas: "",
  });

  const [whatsapp, setWhatsapp] = useState({
    telefono: "",
    mensaje: "",
  });

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setLoading(true);
    await Promise.all([
      cargarClientes(),
      cargarOrdenes(),
      cargarInventario(),
      cargarMovimientos(),
    ]);
    setLoading(false);
  }

  async function cargarClientes() {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Error cargando clientes");
      console.error(error);
      return;
    }

    setClientes((data || []) as Cliente[]);
  }

  async function cargarOrdenes() {
    const { data, error } = await supabase
      .from("ordenes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Error cargando órdenes");
      console.error(error);
      return;
    }

    setOrdenes((data || []) as Orden[]);
  }

  async function cargarInventario() {
    const { data, error } = await supabase
      .from("inventario")
      .select("*")
      .order("nombre", { ascending: true });

    if (error) {
      alert("Error cargando inventario");
      console.error(error);
      return;
    }

    setInventario((data || []) as InventarioItem[]);
  }

  async function cargarMovimientos() {
    const { data, error } = await supabase
      .from("movimientos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setMovimientos((data || []) as Movimiento[]);
  }

  const valorInventario = useMemo(() => {
    return inventario.reduce((acc, item) => {
      return acc + Number(item.stock || 0) * Number(item.costo_unitario || 0);
    }, 0);
  }, [inventario]);

  const stockBajo = inventario.filter((item) => Number(item.stock || 0) <= 5);
  const pendientes = ordenes.filter((o) => o.estado === "pendiente").length;
  const enProduccion = ordenes.filter((o) => o.estado === "produccion").length;
  const terminadas = ordenes.filter((o) => o.estado === "terminada").length;

  async function crearCliente() {
    if (!nuevoCliente.nombre.trim()) {
      alert("Escribe el nombre del cliente");
      return;
    }

    const { error } = await supabase.from("clientes").insert({
      nombre: nuevoCliente.nombre.trim(),
      telefono: nuevoCliente.telefono.trim() || null,
      email: nuevoCliente.email.trim() || null,
    });

    if (error) {
      alert("No se pudo guardar el cliente");
      console.error(error);
      return;
    }

    setNuevoCliente({ nombre: "", telefono: "", email: "" });
    await cargarClientes();
  }

  async function crearOrden() {
    if (!nuevaOrden.cliente_id || !nuevaOrden.proyecto.trim()) {
      alert("Selecciona cliente y proyecto");
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
      estado: "pendiente",
      total: Number(nuevaOrden.total || 0),
    });

    if (error) {
      alert("No se pudo crear la orden");
      console.error(error);
      return;
    }

    setNuevaOrden({ cliente_id: "", proyecto: "", total: "" });
    await cargarOrdenes();
  }

  async function cambiarEstadoOrden(id: string, estado: string) {
    const { error } = await supabase
      .from("ordenes")
      .update({ estado })
      .eq("id", id);

    if (error) {
      alert("No se pudo cambiar el estado");
      console.error(error);
      return;
    }

    await cargarOrdenes();
  }

  async function agregarMaterial() {
    if (!nuevoMaterial.nombre.trim()) {
      alert("Escribe el nombre del material");
      return;
    }

    const { error } = await supabase.from("inventario").insert({
      nombre: nuevoMaterial.nombre.trim(),
      categoria: nuevoMaterial.categoria.trim() || null,
      unidad: nuevoMaterial.unidad || "unidad",
      stock: Number(nuevoMaterial.stock || 0),
      costo_unitario: Number(nuevoMaterial.costo_unitario || 0),
    });

    if (error) {
      alert("No se pudo agregar material");
      console.error(error);
      return;
    }

    setNuevoMaterial({
      nombre: "",
      categoria: "",
      unidad: "unidad",
      stock: "",
      costo_unitario: "",
    });

    await cargarInventario();
  }

  async function registrarMovimiento(params: {
    item_id: string;
    item_nombre: string;
    tipo: "entrada" | "salida" | "produccion";
    cantidad: number;
    stock_antes: number;
    stock_despues: number;
    orden_relacionada?: string;
    material_usado?: string;
    notas?: string;
  }) {
    const { error } = await supabase.from("movimientos").insert({
      item_id: params.item_id,
      item_nombre: params.item_nombre,
      tipo: params.tipo,
      cantidad: params.cantidad,
      stock_antes: params.stock_antes,
      stock_despues: params.stock_despues,
      orden_relacionada: params.orden_relacionada || null,
      material_usado: params.material_usado || null,
      notas: params.notas || null,
    });

    if (error) {
      alert("No se pudo guardar movimiento");
      console.error(error);
    }
  }

  async function ajustarStock(item: InventarioItem, tipo: "entrada" | "salida") {
    const valor = prompt(
      tipo === "entrada"
        ? "Cantidad que entra:"
        : "Cantidad que sale:"
    );

    if (!valor) return;

    const cantidad = Number(valor);

    if (cantidad <= 0) {
      alert("Cantidad inválida");
      return;
    }

    const stockAntes = Number(item.stock || 0);
    const stockDespues =
      tipo === "entrada" ? stockAntes + cantidad : stockAntes - cantidad;

    if (stockDespues < 0) {
      alert("No hay suficiente stock");
      return;
    }

    const { error } = await supabase
      .from("inventario")
      .update({ stock: stockDespues })
      .eq("id", item.id);

    if (error) {
      alert("No se pudo actualizar stock");
      console.error(error);
      return;
    }

    await registrarMovimiento({
      item_id: item.id,
      item_nombre: item.nombre,
      tipo,
      cantidad,
      stock_antes: stockAntes,
      stock_despues: stockDespues,
      orden_relacionada: "Movimiento manual",
      material_usado: item.nombre,
    });

    await cargarTodo();
  }

  async function registrarProduccion() {
    if (!produccion.orden_id || !produccion.item_id || !produccion.cantidad) {
      alert("Selecciona orden, material y cantidad");
      return;
    }

    const orden = ordenes.find((o) => o.id === produccion.orden_id);
    const item = inventario.find((i) => i.id === produccion.item_id);

    if (!orden || !item) {
      alert("Orden o material no encontrado");
      return;
    }

    const cantidad = Number(produccion.cantidad);

    if (cantidad <= 0) {
      alert("Cantidad inválida");
      return;
    }

    const stockAntes = Number(item.stock || 0);
    const stockDespues = stockAntes - cantidad;

    if (stockDespues < 0) {
      alert("No hay suficiente stock");
      return;
    }

    const { error: stockError } = await supabase
      .from("inventario")
      .update({ stock: stockDespues })
      .eq("id", item.id);

    if (stockError) {
      alert("No se pudo rebajar inventario");
      console.error(stockError);
      return;
    }

    await supabase.from("produccion").insert({
      orden_id: orden.id,
      item_id: item.id,
      cantidad,
      notas: produccion.notas || null,
    });

    await supabase
      .from("ordenes")
      .update({ estado: "produccion" })
      .eq("id", orden.id);

    await registrarMovimiento({
      item_id: item.id,
      item_nombre: item.nombre,
      tipo: "produccion",
      cantidad,
      stock_antes: stockAntes,
      stock_despues: stockDespues,
      orden_relacionada: `${orden.proyecto || ""} - ${orden.cliente_nombre || ""}`,
      material_usado: item.nombre,
      notas: produccion.notas || undefined,
    });

    setProduccion({
      orden_id: "",
      item_id: "",
      cantidad: "",
      notas: "",
    });

    await cargarTodo();
    alert("Producción registrada e inventario rebajado");
  }

  function abrirWhatsApp() {
    const telefono = whatsapp.telefono.replace(/\D/g, "");
    const mensaje = encodeURIComponent(whatsapp.mensaje);

    if (!telefono || !mensaje) {
      alert("Completa teléfono y mensaje");
      return;
    }

    window.open(`https://wa.me/${telefono}?text=${mensaje}`, "_blank");
  }

  const itemProduccion = inventario.find((i) => i.id === produccion.item_id);
  const costoProduccion =
    Number(produccion.cantidad || 0) * Number(itemProduccion?.costo_unitario || 0);

  return (
    <main style={styles.app}>
      <aside style={styles.sidebar}>
        <div>
          <h1 style={styles.logo}>RD WOOD</h1>
          <p style={styles.logoSub}>Corte Visual Pro Industrial</p>

          <MenuButton label="Dashboard" icon="📊" active={activeModule === "dashboard"} onClick={() => setActiveModule("dashboard")} />
          <MenuButton label="Clientes" icon="👤" active={activeModule === "clientes"} onClick={() => setActiveModule("clientes")} />
          <MenuButton label="Órdenes" icon="🧾" active={activeModule === "ordenes"} onClick={() => setActiveModule("ordenes")} />
          <MenuButton label="Inventario" icon="📦" active={activeModule === "inventario"} onClick={() => setActiveModule("inventario")} />
          <MenuButton label="Producción" icon="🏭" active={activeModule === "produccion"} onClick={() => setActiveModule("produccion")} />
          <MenuButton label="Historial" icon="📚" active={activeModule === "historial"} onClick={() => setActiveModule("historial")} />
          <MenuButton label="WhatsApp" icon="🟢" active={activeModule === "whatsapp"} onClick={() => setActiveModule("whatsapp")} />
        </div>

        <div style={styles.sidebarFooter}>
          <strong>RD Wood Design</strong>
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

          <button style={styles.refreshButton} onClick={cargarTodo}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </header>

        {activeModule === "dashboard" && (
          <>
            <div style={styles.cardsGrid}>
              <StatCard title="Clientes" value={clientes.length.toString()} />
              <StatCard title="Órdenes" value={ordenes.length.toString()} />
              <StatCard title="Pendientes" value={pendientes.toString()} />
              <StatCard title="En producción" value={enProduccion.toString()} />
              <StatCard title="Terminadas" value={terminadas.toString()} />
              <StatCard title="Materiales" value={inventario.length.toString()} />
              <StatCard title="Valor inventario" value={`RD$ ${valorInventario.toLocaleString("es-DO")}`} />
              <StatCard title="Stock bajo" value={stockBajo.length.toString()} />
            </div>

            <Panel title="Órdenes recientes" subtitle="Últimos trabajos registrados">
              <Table
                headers={["Cliente", "Proyecto", "Estado", "Total"]}
                rows={ordenes.slice(0, 6).map((o) => [
                  o.cliente_nombre || "-",
                  o.proyecto || "-",
                  o.estado || "-",
                  `RD$ ${Number(o.total || 0).toLocaleString("es-DO")}`,
                ])}
              />
            </Panel>
          </>
        )}

        {activeModule === "clientes" && (
          <>
            <Panel title="Nuevo cliente" subtitle="Registra tus clientes">
              <div style={styles.formGrid}>
                <input style={styles.input} placeholder="Nombre" value={nuevoCliente.nombre} onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} />
                <input style={styles.input} placeholder="Teléfono" value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} />
                <input style={styles.input} placeholder="Email" value={nuevoCliente.email} onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })} />
              </div>
              <button style={styles.primaryButton} onClick={crearCliente}>Guardar cliente</button>
            </Panel>

            <Panel title="Lista de clientes" subtitle={`${clientes.length} clientes registrados`}>
              <Table
                headers={["Nombre", "Teléfono", "Email"]}
                rows={clientes.map((c) => [
                  c.nombre,
                  c.telefono || "-",
                  c.email || "-",
                ])}
              />
            </Panel>
          </>
        )}

        {activeModule === "ordenes" && (
          <>
            <Panel title="Nueva orden" subtitle="Crea una orden de trabajo">
              <div style={styles.formGrid}>
                <select style={styles.input} value={nuevaOrden.cliente_id} onChange={(e) => setNuevaOrden({ ...nuevaOrden, cliente_id: e.target.value })}>
                  <option value="">Seleccionar cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
                <input style={styles.input} placeholder="Proyecto" value={nuevaOrden.proyecto} onChange={(e) => setNuevaOrden({ ...nuevaOrden, proyecto: e.target.value })} />
                <input style={styles.input} type="number" placeholder="Total RD$" value={nuevaOrden.total} onChange={(e) => setNuevaOrden({ ...nuevaOrden, total: e.target.value })} />
              </div>
              <button style={styles.primaryButton} onClick={crearOrden}>Crear orden</button>
            </Panel>

            <Panel title="Órdenes activas" subtitle="Control por estado">
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
                    {ordenes.map((o) => (
                      <tr key={o.id}>
                        <td>{o.cliente_nombre || "-"}</td>
                        <td>{o.proyecto || "-"}</td>
                        <td><Badge text={o.estado || "pendiente"} /></td>
                        <td>RD$ {Number(o.total || 0).toLocaleString("es-DO")}</td>
                        <td>
                          <select style={styles.inputSmall} value={o.estado || "pendiente"} onChange={(e) => cambiarEstadoOrden(o.id, e.target.value)}>
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
            </Panel>
          </>
        )}

        {activeModule === "inventario" && (
          <>
            <Panel title="Agregar material" subtitle="Registra materiales disponibles">
              <div style={styles.formGrid}>
                <input style={styles.input} placeholder="Nombre" value={nuevoMaterial.nombre} onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, nombre: e.target.value })} />
                <input style={styles.input} placeholder="Categoría" value={nuevoMaterial.categoria} onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, categoria: e.target.value })} />
                <input style={styles.input} placeholder="Unidad" value={nuevoMaterial.unidad} onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, unidad: e.target.value })} />
                <input style={styles.input} type="number" placeholder="Stock" value={nuevoMaterial.stock} onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, stock: e.target.value })} />
                <input style={styles.input} type="number" placeholder="Costo unitario" value={nuevoMaterial.costo_unitario} onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, costo_unitario: e.target.value })} />
              </div>
              <button style={styles.primaryButton} onClick={agregarMaterial}>Agregar material</button>
            </Panel>

            <Panel title="Inventario actual" subtitle="Entradas, salidas y stock">
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
                    {inventario.map((item) => (
                      <tr key={item.id}>
                        <td>{item.nombre}</td>
                        <td>{item.categoria || "-"}</td>
                        <td>{item.stock || 0} {item.unidad || ""}</td>
                        <td>RD$ {Number(item.costo_unitario || 0).toLocaleString("es-DO")}</td>
                        <td>
                          <button style={styles.smallGreenButton} onClick={() => ajustarStock(item, "entrada")}>Entrada</button>
                          <button style={styles.smallRedButton} onClick={() => ajustarStock(item, "salida")}>Salida</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}

        {activeModule === "produccion" && (
          <Panel title="Producción por orden" subtitle="Descuenta material y guarda movimiento">
            <div style={styles.formGrid}>
              <select style={styles.input} value={produccion.orden_id} onChange={(e) => setProduccion({ ...produccion, orden_id: e.target.value })}>
                <option value="">Seleccionar orden</option>
                {ordenes.map((o) => (
                  <option key={o.id} value={o.id}>{o.proyecto} - {o.cliente_nombre}</option>
                ))}
              </select>

              <select style={styles.input} value={produccion.item_id} onChange={(e) => setProduccion({ ...produccion, item_id: e.target.value })}>
                <option value="">Seleccionar material</option>
                {inventario.map((item) => (
                  <option key={item.id} value={item.id}>{item.nombre} — Stock: {item.stock} {item.unidad}</option>
                ))}
              </select>

              <input style={styles.input} type="number" placeholder="Cantidad usada" value={produccion.cantidad} onChange={(e) => setProduccion({ ...produccion, cantidad: e.target.value })} />
              <input style={styles.input} placeholder="Notas" value={produccion.notas} onChange={(e) => setProduccion({ ...produccion, notas: e.target.value })} />
            </div>

            <div style={styles.costBox}>
              <strong>Costo estimado:</strong>
              <span>RD$ {costoProduccion.toLocaleString("es-DO")}</span>
            </div>

            <button style={styles.primaryButton} onClick={registrarProduccion}>
              Registrar producción y rebajar inventario
            </button>
          </Panel>
        )}

        {activeModule === "historial" && (
          <Panel title="Historial de movimientos" subtitle="Control completo de entradas, salidas y producción">
            <Table
              headers={["Fecha", "Tipo", "Material", "Cantidad", "Antes", "Después", "Orden"]}
              rows={movimientos.map((m) => [
                new Date(m.created_at).toLocaleString("es-DO"),
                m.tipo || "-",
                m.item_nombre || "-",
                String(m.cantidad || 0),
                String(m.stock_antes || 0),
                String(m.stock_despues || 0),
                m.orden_relacionada || "-",
              ])}
            />
          </Panel>
        )}

        {activeModule === "whatsapp" && (
          <Panel title="WhatsApp automático" subtitle="Enviar mensaje directo al cliente">
            <div style={styles.formGrid}>
              <input style={styles.input} placeholder="Teléfono. Ej: 18096905636" value={whatsapp.telefono} onChange={(e) => setWhatsapp({ ...whatsapp, telefono: e.target.value })} />
              <textarea style={{ ...styles.input, minHeight: 120 }} placeholder="Mensaje" value={whatsapp.mensaje} onChange={(e) => setWhatsapp({ ...whatsapp, mensaje: e.target.value })} />
            </div>
            <button style={styles.whatsappButton} onClick={abrirWhatsApp}>Abrir WhatsApp</button>
          </Panel>
        )}
      </section>
    </main>
  );
}

function MenuButton({ label, icon, active, onClick }: any) {
  return (
    <button onClick={onClick} style={active ? styles.menuActive : styles.menuButton}>
      <span>{icon}</span> {label}
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

function Panel({ title, subtitle, children }: any) {
  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>
        <h3>{title}</h3>
        <span>{subtitle}</span>
      </div>
      {children}
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} style={styles.emptyCell}>No hay datos.</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  const color =
    text === "produccion" ? "#2563eb" :
    text === "terminada" ? "#16a34a" :
    text === "entregada" ? "#9333ea" :
    text === "cancelada" ? "#dc2626" :
    "#ca8a04";

  return (
    <span style={{ background: `${color}22`, color, padding: "6px 10px", borderRadius: 999, fontWeight: 800 }}>
      {text}
    </span>
  );
}

const styles: any = {
  app: { minHeight: "100vh", display: "flex", background: "#f4f7fb", color: "#0f172a", fontFamily: "Arial, sans-serif" },
  sidebar: { width: 290, background: "linear-gradient(180deg, #020617, #0f172a)", color: "white", padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" },
  logo: { margin: 0, fontSize: 28, color: "#22c55e", letterSpacing: 1 },
  logoSub: { marginTop: 6, marginBottom: 30, color: "#94a3b8", fontSize: 14 },
  menuButton: { width: "100%", border: "none", background: "transparent", color: "#cbd5e1", padding: "14px 16px", borderRadius: 14, textAlign: "left", fontWeight: 800, cursor: "pointer", fontSize: 15, display: "flex", gap: 10, alignItems: "center", marginBottom: 10 },
  menuActive: { width: "100%", border: "none", background: "linear-gradient(90deg, #22c55e, #86efac)", color: "#052e16", padding: "14px 16px", borderRadius: 14, textAlign: "left", fontWeight: 900, cursor: "pointer", fontSize: 15, display: "flex", gap: 10, alignItems: "center", marginBottom: 10 },
  sidebarFooter: { color: "#94a3b8", fontSize: 13, display: "flex", flexDirection: "column", gap: 4 },
  content: { flex: 1, padding: 34, overflow: "auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  pageTitle: { margin: 0, fontSize: 34, fontWeight: 900 },
  pageSubtitle: { color: "#64748b", marginTop: 6 },
  refreshButton: { background: "#0f172a", color: "white", border: "none", borderRadius: 14, padding: "13px 18px", fontWeight: 900, cursor: "pointer" },
  cardsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 18, marginBottom: 24 },
  statCard: { background: "white", borderRadius: 22, padding: 24, boxShadow: "0 12px 35px rgba(15,23,42,.08)", border: "1px solid #e2e8f0" },
  panel: { background: "white", borderRadius: 24, padding: 24, boxShadow: "0 12px 35px rgba(15,23,42,.08)", border: "1px solid #e2e8f0", marginBottom: 24 },
  panelHeader: { marginBottom: 18 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 14, padding: "14px 15px", outline: "none", fontSize: 14, background: "#fff" },
  inputSmall: { border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 10px", background: "white" },
  primaryButton: { marginTop: 18, background: "linear-gradient(90deg, #16a34a, #22c55e)", color: "white", border: "none", borderRadius: 16, padding: "14px 22px", fontWeight: 900, cursor: "pointer" },
  whatsappButton: { marginTop: 18, background: "#16a34a", color: "white", border: "none", borderRadius: 16, padding: "14px 22px", fontWeight: 900, cursor: "pointer" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  emptyCell: { padding: 20, textAlign: "center", color: "#64748b" },
  smallGreenButton: { background: "#dcfce7", color: "#166534", border: "none", borderRadius: 10, padding: "8px 10px", marginRight: 8, fontWeight: 800, cursor: "pointer" },
  smallRedButton: { background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 10, padding: "8px 10px", fontWeight: 800, cursor: "pointer" },
  costBox: { marginTop: 18, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 16, padding: 18, display: "flex", justifyContent: "space-between", color: "#166534" },
};