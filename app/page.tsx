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
  | "cortes"
  | "imprimir"
  | "admin";

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeModule, setActiveModule] = useState<Module>("dashboard");
  const [loading, setLoading] = useState(false);

  const [login, setLogin] = useState({ email: "", password: "" });

  const [clientes, setClientes] = useState<any[]>([]);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [inventario, setInventario] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);

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
    category_id: "",
    unidad: "unidad",
    stock: "",
    costo_unitario: "",
  });

  const [nuevaCategoria, setNuevaCategoria] = useState({
    name: "",
    description: "",
  });

  const [produccion, setProduccion] = useState({
    orden_id: "",
    item_id: "",
    cantidad: "",
    notas: "",
  });

  const [corte, setCorte] = useState({
    sheetW: "2440",
    sheetH: "1220",
    kerf: "3",
    pieceName: "",
    pieceW: "",
    pieceH: "",
    qty: "1",
    rotate: true,
  });

  const [piezas, setPiezas] = useState<any[]>([]);
  const [layoutCorte, setLayoutCorte] = useState<any[]>([]);
  const [imagenCorte, setImagenCorte] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);

    if (data.session?.user) {
      await cargarPerfil(data.session.user.id);
      await cargarTodo();
    }
  }

  async function loginUser() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: login.email,
      password: login.password,
    });

    if (error) return alert("Usuario o contraseña incorrectos");

    setSession(data.session);
    await cargarPerfil(data.session?.user?.id);
    await cargarTodo();
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  async function cargarPerfil(userId: string) {
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();

    setProfile(data);
  }

  function puede(area: string) {
    const role = profile?.role || "lectura";
    if (role === "admin") return true;
    if (area === "ventas") return role === "ventas";
    if (area === "inventario") return role === "inventario";
    if (area === "produccion") return role === "produccion";
    return false;
  }

  async function cargarTodo() {
    setLoading(true);
    await Promise.all([
      cargarClientes(),
      cargarOrdenes(),
      cargarInventario(),
      cargarMovimientos(),
      cargarCategorias(),
      cargarUsuarios(),
    ]);
    setLoading(false);
  }

  async function cargarClientes() {
    const { data } = await supabase.from("clientes").select("*").order("created_at", { ascending: false });
    setClientes(data || []);
  }

  async function cargarOrdenes() {
    const { data } = await supabase.from("ordenes").select("*").order("created_at", { ascending: false });
    setOrdenes(data || []);
  }

  async function cargarInventario() {
    const { data } = await supabase.from("inventario").select("*").order("nombre", { ascending: true });
    setInventario(data || []);
  }

  async function cargarMovimientos() {
    const { data } = await supabase.from("movimientos").select("*").order("created_at", { ascending: false });
    setMovimientos(data || []);
  }

  async function cargarCategorias() {
    const { data } = await supabase
      .from("inventory_categories")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    setCategorias(data || []);
  }

  async function cargarUsuarios() {
    if (profile?.role !== "admin") return;
    const { data } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: false });
    setUsuarios(data || []);
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
    if (!puede("ventas")) return alert("No tienes permiso");
    if (!nuevoCliente.nombre.trim()) return alert("Escribe el nombre");

    await supabase.from("clientes").insert({
      nombre: nuevoCliente.nombre,
      telefono: nuevoCliente.telefono || null,
      email: nuevoCliente.email || null,
    });

    setNuevoCliente({ nombre: "", telefono: "", email: "" });
    await cargarClientes();
  }

  async function crearOrden() {
    if (!puede("ventas")) return alert("No tienes permiso");

    const cliente = clientes.find((c) => c.id === nuevaOrden.cliente_id);
    if (!cliente) return alert("Selecciona cliente");

    await supabase.from("ordenes").insert({
      cliente_id: cliente.id,
      cliente_nombre: cliente.nombre,
      proyecto: nuevaOrden.proyecto,
      estado: "pendiente",
      total: Number(nuevaOrden.total || 0),
    });

    setNuevaOrden({ cliente_id: "", proyecto: "", total: "" });
    await cargarOrdenes();
  }

  async function cambiarEstadoOrden(id: string, estado: string) {
    if (!puede("produccion")) return alert("No tienes permiso");
    await supabase.from("ordenes").update({ estado }).eq("id", id);
    await cargarOrdenes();
  }

  async function crearCategoria() {
    if (profile?.role !== "admin") return alert("Solo administrador");
    if (!nuevaCategoria.name.trim()) return alert("Escribe categoría");

    await supabase.from("inventory_categories").insert({
      name: nuevaCategoria.name.trim(),
      description: nuevaCategoria.description || null,
    });

    setNuevaCategoria({ name: "", description: "" });
    await cargarCategorias();
  }

  async function agregarMaterial() {
    if (!puede("inventario")) return alert("No tienes permiso");
    if (!nuevoMaterial.nombre.trim()) return alert("Escribe material");
    if (!nuevoMaterial.category_id) return alert("Selecciona categoría");

    const categoria = categorias.find((c) => c.id === nuevoMaterial.category_id);

    await supabase.from("inventario").insert({
      nombre: nuevoMaterial.nombre,
      categoria: categoria?.name || null,
      category_id: nuevoMaterial.category_id,
      unidad: nuevoMaterial.unidad,
      stock: Number(nuevoMaterial.stock || 0),
      costo_unitario: Number(nuevoMaterial.costo_unitario || 0),
    });

    setNuevoMaterial({
      nombre: "",
      category_id: "",
      unidad: "unidad",
      stock: "",
      costo_unitario: "",
    });

    await cargarInventario();
  }

  async function registrarMovimiento(params: any) {
    await supabase.from("movimientos").insert({
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
  }

  async function ajustarStock(item: any, tipo: "entrada" | "salida") {
    if (!puede("inventario")) return alert("No tienes permiso");

    const valor = prompt(tipo === "entrada" ? "Cantidad que entra:" : "Cantidad que sale:");
    if (!valor) return;

    const cantidad = Number(valor);
    const antes = Number(item.stock || 0);
    const despues = tipo === "entrada" ? antes + cantidad : antes - cantidad;

    if (despues < 0) return alert("No hay suficiente stock");

    await supabase.from("inventario").update({ stock: despues }).eq("id", item.id);

    await registrarMovimiento({
      item_id: item.id,
      item_nombre: item.nombre,
      tipo,
      cantidad,
      stock_antes: antes,
      stock_despues: despues,
      orden_relacionada: "Movimiento manual",
      material_usado: item.nombre,
    });

    await cargarTodo();
  }

  async function registrarProduccion() {
    if (!puede("produccion")) return alert("No tienes permiso");

    const orden = ordenes.find((o) => o.id === produccion.orden_id);
    const item = inventario.find((i) => i.id === produccion.item_id);

    if (!orden || !item) return alert("Selecciona orden y material");

    const cantidad = Number(produccion.cantidad);
    const antes = Number(item.stock || 0);
    const despues = antes - cantidad;

    if (cantidad <= 0) return alert("Cantidad inválida");
    if (despues < 0) return alert("No hay suficiente stock");

    await supabase.from("inventario").update({ stock: despues }).eq("id", item.id);

    await supabase.from("produccion").insert({
      orden_id: orden.id,
      item_id: item.id,
      cantidad,
      notas: produccion.notas || null,
    });

    await supabase.from("ordenes").update({ estado: "produccion" }).eq("id", orden.id);

    await registrarMovimiento({
      item_id: item.id,
      item_nombre: item.nombre,
      tipo: "produccion",
      cantidad,
      stock_antes: antes,
      stock_despues: despues,
      orden_relacionada: `${orden.proyecto || ""} - ${orden.cliente_nombre || ""}`,
      material_usado: item.nombre,
      notas: produccion.notas || null,
    });

    setProduccion({ orden_id: "", item_id: "", cantidad: "", notas: "" });
    await cargarTodo();
  }

  async function cambiarRolUsuario(id: string, role: string) {
    if (profile?.role !== "admin") return;
    await supabase.from("user_profiles").update({ role }).eq("id", id);
    await cargarUsuarios();
  }

  async function cambiarEstadoUsuario(id: string, is_active: boolean) {
    if (profile?.role !== "admin") return;
    await supabase.from("user_profiles").update({ is_active }).eq("id", id);
    await cargarUsuarios();
  }

  function agregarPieza() {
    if (!corte.pieceName || !corte.pieceW || !corte.pieceH) {
      alert("Completa pieza");
      return;
    }

    const qty = Number(corte.qty || 1);
    const nuevas = [];

    for (let i = 0; i < qty; i++) {
      nuevas.push({
        id: crypto.randomUUID(),
        name: corte.pieceName,
        w: Number(corte.pieceW),
        h: Number(corte.pieceH),
      });
    }

    setPiezas([...piezas, ...nuevas]);
    setCorte({ ...corte, pieceName: "", pieceW: "", pieceH: "", qty: "1" });
  }

  function limpiarPiezas() {
    setPiezas([]);
    setLayoutCorte([]);
  }

  function optimizarCorte() {
    const sheetW = Number(corte.sheetW);
    const sheetH = Number(corte.sheetH);
    const kerf = Number(corte.kerf || 0);

    let x = 0;
    let y = 0;
    let rowH = 0;
    let sheet = 1;

    const sorted = [...piezas].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));
    const result: any[] = [];

    for (const raw of sorted) {
      let p = { ...raw };

      if (corte.rotate && p.w > p.h && p.w > sheetW - x && p.h <= sheetW - x) {
        p = { ...p, w: raw.h, h: raw.w, rotated: true };
      }

      if (x + p.w > sheetW) {
        x = 0;
        y += rowH + kerf;
        rowH = 0;
      }

      if (y + p.h > sheetH) {
        sheet += 1;
        x = 0;
        y = 0;
        rowH = 0;
      }

      result.push({
        ...p,
        x,
        y,
        sheet,
      });

      x += p.w + kerf;
      rowH = Math.max(rowH, p.h);
    }

    setLayoutCorte(result);
  }

  function cargarImagen(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagenCorte(URL.createObjectURL(file));
  }

  function imprimir() {
    window.print();
  }

  if (!session) {
    return (
      <main style={styles.loginPage}>
        <div style={styles.loginBox}>
          <h1>RD WOOD</h1>
          <p>Corte Visual Pro Industrial</p>

          <input style={styles.input} placeholder="Email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
          <input style={styles.input} type="password" placeholder="Contraseña" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />

          <button style={styles.primaryButton} onClick={loginUser}>Entrar</button>
        </div>
      </main>
    );
  }

  const itemProduccion = inventario.find((i) => i.id === produccion.item_id);
  const costoProduccion = Number(produccion.cantidad || 0) * Number(itemProduccion?.costo_unitario || 0);

  return (
    <main style={styles.app}>
      <aside style={styles.sidebar} className="no-print">
        <div>
          <h1 style={styles.logo}>RD WOOD</h1>
          <p style={styles.logoSub}>Industrial ERP</p>

          <MenuButton label="Dashboard" active={activeModule === "dashboard"} onClick={() => setActiveModule("dashboard")} />
          <MenuButton label="Clientes" active={activeModule === "clientes"} onClick={() => setActiveModule("clientes")} />
          <MenuButton label="Órdenes" active={activeModule === "ordenes"} onClick={() => setActiveModule("ordenes")} />
          <MenuButton label="Inventario" active={activeModule === "inventario"} onClick={() => setActiveModule("inventario")} />
          <MenuButton label="Producción" active={activeModule === "produccion"} onClick={() => setActiveModule("produccion")} />
          <MenuButton label="Historial" active={activeModule === "historial"} onClick={() => setActiveModule("historial")} />
          <MenuButton label="Corte Visual" active={activeModule === "cortes"} onClick={() => setActiveModule("cortes")} />
          <MenuButton label="Imprimir" active={activeModule === "imprimir"} onClick={() => setActiveModule("imprimir")} />

          {profile?.role === "admin" && (
            <MenuButton label="Administrador" active={activeModule === "admin"} onClick={() => setActiveModule("admin")} />
          )}
        </div>

        <div style={styles.sidebarFooter}>
          <strong>{profile?.full_name || session.user.email}</strong>
          <span>Rol: {profile?.role || "sin rol"}</span>
          <button style={styles.logoutButton} onClick={logout}>Salir</button>
        </div>
      </aside>

      <section style={styles.content}>
        <header style={styles.header} className="no-print">
          <div>
            <h2 style={styles.pageTitle}>{activeModule.toUpperCase()}</h2>
            <p style={styles.pageSubtitle}>Sistema profesional con roles, inventario, producción y corte visual.</p>
          </div>

          <button style={styles.refreshButton} onClick={cargarTodo}>
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </header>

        {activeModule === "dashboard" && (
          <div style={styles.cardsGrid}>
            <StatCard title="Clientes" value={clientes.length} />
            <StatCard title="Órdenes" value={ordenes.length} />
            <StatCard title="Pendientes" value={pendientes} />
            <StatCard title="Producción" value={enProduccion} />
            <StatCard title="Terminadas" value={terminadas} />
            <StatCard title="Materiales" value={inventario.length} />
            <StatCard title="Valor inventario" value={`RD$ ${valorInventario.toLocaleString("es-DO")}`} />
            <StatCard title="Stock bajo" value={stockBajo.length} />
          </div>
        )}

        {activeModule === "clientes" && (
          <>
            <Panel title="Nuevo cliente">
              <div style={styles.formGrid}>
                <input style={styles.input} placeholder="Nombre" value={nuevoCliente.nombre} onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} />
                <input style={styles.input} placeholder="Teléfono" value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} />
                <input style={styles.input} placeholder="Email" value={nuevoCliente.email} onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })} />
              </div>
              {puede("ventas") && <button style={styles.primaryButton} onClick={crearCliente}>Guardar cliente</button>}
            </Panel>

            <Panel title="Clientes registrados">
              <Table headers={["Nombre", "Teléfono", "Email"]} rows={clientes.map((c) => [c.nombre, c.telefono || "-", c.email || "-"])} />
            </Panel>
          </>
        )}

        {activeModule === "ordenes" && (
          <>
            <Panel title="Nueva orden">
              <div style={styles.formGrid}>
                <select style={styles.input} value={nuevaOrden.cliente_id} onChange={(e) => setNuevaOrden({ ...nuevaOrden, cliente_id: e.target.value })}>
                  <option value="">Seleccionar cliente</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <input style={styles.input} placeholder="Proyecto" value={nuevaOrden.proyecto} onChange={(e) => setNuevaOrden({ ...nuevaOrden, proyecto: e.target.value })} />
                <input style={styles.input} type="number" placeholder="Total RD$" value={nuevaOrden.total} onChange={(e) => setNuevaOrden({ ...nuevaOrden, total: e.target.value })} />
              </div>
              {puede("ventas") && <button style={styles.primaryButton} onClick={crearOrden}>Crear orden</button>}
            </Panel>

            <Panel title="Órdenes">
              <Table
                headers={["Cliente", "Proyecto", "Estado", "Total"]}
                rows={ordenes.map((o) => [
                  o.cliente_nombre || "-",
                  o.proyecto || "-",
                  o.estado || "-",
                  `RD$ ${Number(o.total || 0).toLocaleString("es-DO")}`,
                ])}
              />
            </Panel>
          </>
        )}

        {activeModule === "inventario" && (
          <>
            <Panel title="Agregar material">
              <div style={styles.formGrid}>
                <input style={styles.input} placeholder="Nombre" value={nuevoMaterial.nombre} onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, nombre: e.target.value })} />

                <select style={styles.input} value={nuevoMaterial.category_id} onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, category_id: e.target.value })}>
                  <option value="">Seleccionar categoría</option>
                  {categorias.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>

                <input style={styles.input} placeholder="Unidad" value={nuevoMaterial.unidad} onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, unidad: e.target.value })} />
                <input style={styles.input} type="number" placeholder="Stock" value={nuevoMaterial.stock} onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, stock: e.target.value })} />
                <input style={styles.input} type="number" placeholder="Costo unitario" value={nuevoMaterial.costo_unitario} onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, costo_unitario: e.target.value })} />
              </div>
              {puede("inventario") && <button style={styles.primaryButton} onClick={agregarMaterial}>Agregar material</button>}
            </Panel>

            <Panel title="Inventario">
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
                          {puede("inventario") && (
                            <>
                              <button style={styles.smallGreenButton} onClick={() => ajustarStock(item, "entrada")}>Entrada</button>
                              <button style={styles.smallRedButton} onClick={() => ajustarStock(item, "salida")}>Salida</button>
                            </>
                          )}
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
          <Panel title="Producción por orden">
            <div style={styles.formGrid}>
              <select style={styles.input} value={produccion.orden_id} onChange={(e) => setProduccion({ ...produccion, orden_id: e.target.value })}>
                <option value="">Seleccionar orden</option>
                {ordenes.map((o) => <option key={o.id} value={o.id}>{o.proyecto} - {o.cliente_nombre}</option>)}
              </select>

              <select style={styles.input} value={produccion.item_id} onChange={(e) => setProduccion({ ...produccion, item_id: e.target.value })}>
                <option value="">Seleccionar material</option>
                {inventario.map((i) => <option key={i.id} value={i.id}>{i.nombre} - Stock: {i.stock}</option>)}
              </select>

              <input style={styles.input} type="number" placeholder="Cantidad" value={produccion.cantidad} onChange={(e) => setProduccion({ ...produccion, cantidad: e.target.value })} />
              <input style={styles.input} placeholder="Notas" value={produccion.notas} onChange={(e) => setProduccion({ ...produccion, notas: e.target.value })} />
            </div>

            <div style={styles.costBox}>
              <strong>Costo estimado:</strong>
              <span>RD$ {costoProduccion.toLocaleString("es-DO")}</span>
            </div>

            {puede("produccion") && <button style={styles.primaryButton} onClick={registrarProduccion}>Registrar producción</button>}
          </Panel>
        )}

        {activeModule === "historial" && (
          <Panel title="Historial">
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

        {activeModule === "cortes" && (
          <>
            <Panel title="Corte Visual Pro">
              <div style={styles.formGrid}>
                <input style={styles.input} placeholder="Ancho hoja mm" value={corte.sheetW} onChange={(e) => setCorte({ ...corte, sheetW: e.target.value })} />
                <input style={styles.input} placeholder="Alto hoja mm" value={corte.sheetH} onChange={(e) => setCorte({ ...corte, sheetH: e.target.value })} />
                <input style={styles.input} placeholder="Disco / kerf mm" value={corte.kerf} onChange={(e) => setCorte({ ...corte, kerf: e.target.value })} />
                <input style={styles.input} type="file" accept="image/*" onChange={cargarImagen} />
                <input style={styles.input} placeholder="Nombre pieza" value={corte.pieceName} onChange={(e) => setCorte({ ...corte, pieceName: e.target.value })} />
                <input style={styles.input} placeholder="Ancho pieza" value={corte.pieceW} onChange={(e) => setCorte({ ...corte, pieceW: e.target.value })} />
                <input style={styles.input} placeholder="Alto pieza" value={corte.pieceH} onChange={(e) => setCorte({ ...corte, pieceH: e.target.value })} />
                <input style={styles.input} placeholder="Cantidad" value={corte.qty} onChange={(e) => setCorte({ ...corte, qty: e.target.value })} />
              </div>

              <button style={styles.primaryButton} onClick={agregarPieza}>Agregar pieza</button>
              <button style={styles.darkButton} onClick={optimizarCorte}>Optimizar</button>
              <button style={styles.darkButton} onClick={limpiarPiezas}>Limpiar</button>
              <button style={styles.darkButton} onClick={imprimir}>Imprimir corte</button>
            </Panel>

            {imagenCorte && (
              <Panel title="Imagen de referencia">
                <img src={imagenCorte} alt="Referencia de corte" style={{ maxWidth: "100%", borderRadius: 18 }} />
              </Panel>
            )}

            <Panel title="Vista optimizada">
              <CutView sheetW={Number(corte.sheetW)} sheetH={Number(corte.sheetH)} layout={layoutCorte} />
            </Panel>

            <Panel title="Lista de piezas">
              <Table headers={["Pieza", "Ancho", "Alto"]} rows={piezas.map((p) => [p.name, String(p.w), String(p.h)])} />
            </Panel>
          </>
        )}

        {activeModule === "imprimir" && (
          <Panel title="Impresión rápida">
            <button style={styles.primaryButton} onClick={imprimir}>Imprimir pantalla actual</button>
          </Panel>
        )}

        {activeModule === "admin" && profile?.role === "admin" && (
          <>
            <Panel title="Crear categoría de inventario">
              <div style={styles.formGrid}>
                <input style={styles.input} placeholder="Categoría" value={nuevaCategoria.name} onChange={(e) => setNuevaCategoria({ ...nuevaCategoria, name: e.target.value })} />
                <input style={styles.input} placeholder="Descripción" value={nuevaCategoria.description} onChange={(e) => setNuevaCategoria({ ...nuevaCategoria, description: e.target.value })} />
              </div>
              <button style={styles.primaryButton} onClick={crearCategoria}>Crear categoría</button>
            </Panel>

            <Panel title="Usuarios y roles">
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Rol</th>
                      <th>Activo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr key={u.id}>
                        <td>{u.full_name || u.id}</td>
                        <td>
                          <select style={styles.inputSmall} value={u.role || "lectura"} onChange={(e) => cambiarRolUsuario(u.id, e.target.value)}>
                            <option value="admin">Admin</option>
                            <option value="ventas">Ventas</option>
                            <option value="inventario">Inventario</option>
                            <option value="produccion">Producción</option>
                            <option value="lectura">Lectura</option>
                          </select>
                        </td>
                        <td>
                          <select style={styles.inputSmall} value={u.is_active ? "true" : "false"} onChange={(e) => cambiarEstadoUsuario(u.id, e.target.value === "true")}>
                            <option value="true">Activo</option>
                            <option value="false">Inactivo</option>
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
      </section>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </main>
  );
}

function MenuButton({ label, active, onClick }: any) {
  return <button onClick={onClick} style={active ? styles.menuActive : styles.menuButton}>{label}</button>;
}

function StatCard({ title, value }: any) {
  return (
    <div style={styles.statCard}>
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  );
}

function Panel({ title, children }: any) {
  return (
    <section style={styles.panel}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Table({ headers, rows }: any) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>{headers.map((h: string) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} style={styles.emptyCell}>No hay datos</td></tr>
          ) : rows.map((r: any[], i: number) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CutView({ sheetW, sheetH, layout }: any) {
  const scale = 520 / sheetW;
  const sheets = Array.from(new Set(layout.map((p: any) => p.sheet)));

  if (layout.length === 0) {
    return <p style={{ color: "#64748b" }}>Agrega piezas y presiona Optimizar.</p>;
  }

  return (
    <div>
      {sheets.map((sheet: any) => (
        <div key={sheet} style={{ marginBottom: 30 }}>
          <h4>Hoja {sheet}</h4>
          <div style={{
            position: "relative",
            width: sheetW * scale,
            height: sheetH * scale,
            border: "2px solid #0f172a",
            background: "#f8fafc",
          }}>
            {layout.filter((p: any) => p.sheet === sheet).map((p: any) => (
              <div key={p.id} style={{
                position: "absolute",
                left: p.x * scale,
                top: p.y * scale,
                width: p.w * scale,
                height: p.h * scale,
                border: "1px solid #166534",
                background: "#bbf7d0",
                fontSize: 10,
                overflow: "hidden",
                padding: 2,
              }}>
                {p.name}<br />{p.w}x{p.h}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: any = {
  loginPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#020617" },
  loginBox: { width: 360, background: "white", padding: 30, borderRadius: 20, display: "flex", flexDirection: "column", gap: 14 },
  app: { minHeight: "100vh", display: "flex", background: "#f4f7fb", color: "#0f172a", fontFamily: "Arial, sans-serif" },
  sidebar: { width: 290, background: "linear-gradient(180deg, #020617, #0f172a)", color: "white", padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" },
  logo: { margin: 0, fontSize: 28, color: "#22c55e" },
  logoSub: { color: "#94a3b8", marginBottom: 30 },
  menuButton: { width: "100%", background: "transparent", color: "#cbd5e1", border: "none", padding: "14px", textAlign: "left", borderRadius: 12, fontWeight: 800, cursor: "pointer", marginBottom: 8 },
  menuActive: { width: "100%", background: "#22c55e", color: "#052e16", border: "none", padding: "14px", textAlign: "left", borderRadius: 12, fontWeight: 900, cursor: "pointer", marginBottom: 8 },
  sidebarFooter: { color: "#94a3b8", display: "flex", flexDirection: "column", gap: 8 },
  logoutButton: { background: "#ef4444", color: "white", border: "none", padding: 10, borderRadius: 10, cursor: "pointer" },
  content: { flex: 1, padding: 34, overflow: "auto" },
  header: { display: "flex", justifyContent: "space-between", marginBottom: 28 },
  pageTitle: { margin: 0, fontSize: 34, fontWeight: 900 },
  pageSubtitle: { color: "#64748b" },
  refreshButton: { background: "#0f172a", color: "white", border: "none", borderRadius: 14, padding: "13px 18px", fontWeight: 900, cursor: "pointer" },
  cardsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 18 },
  statCard: { background: "white", borderRadius: 22, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 12px 35px rgba(15,23,42,.08)" },
  panel: { background: "white", borderRadius: 24, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 12px 35px rgba(15,23,42,.08)", marginBottom: 24 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 },
  input: { width: "100%", border: "1px solid #cbd5e1", borderRadius: 14, padding: "14px 15px", fontSize: 14 },
  inputSmall: { border: "1px solid #cbd5e1", borderRadius: 10, padding: "8px 10px" },
  primaryButton: { marginTop: 18, background: "#16a34a", color: "white", border: "none", borderRadius: 16, padding: "14px 22px", fontWeight: 900, cursor: "pointer" },
  darkButton: { marginTop: 18, marginLeft: 10, background: "#0f172a", color: "white", border: "none", borderRadius: 16, padding: "14px 22px", fontWeight: 900, cursor: "pointer" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  emptyCell: { padding: 20, textAlign: "center", color: "#64748b" },
  smallGreenButton: { background: "#dcfce7", color: "#166534", border: "none", borderRadius: 10, padding: "8px 10px", marginRight: 8, fontWeight: 800, cursor: "pointer" },
  smallRedButton: { background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 10, padding: "8px 10px", fontWeight: 800, cursor: "pointer" },
  costBox: { marginTop: 18, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 16, padding: 18, display: "flex", justifyContent: "space-between", color: "#166534" },
};