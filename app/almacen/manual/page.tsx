"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, ArrowDownCircle, ArrowUpCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Producto = {
  id: string;
  codigo: string | null;
  nombre: string;
  stock_actual: number | null;
  stock_minimo: number | null;
  costo_compra: number | null;
  precio_venta: number | null;
  ubicacion: string | null;
};

type Movimiento = {
  id: string;
  producto_id: string | null;
  tipo: string;
  cantidad: number;
  stock_antes: number | null;
  stock_despues: number | null;
  costo_unitario: number | null;
  costo_total: number | null;
  referencia: string | null;
  modulo: string | null;
  usuario: string | null;
  created_at: string;
  productos?: {
    nombre: string;
    codigo: string | null;
  } | null;
};

const money = (n: any) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
  }).format(Number(n || 0));

const num = (n: any) =>
  new Intl.NumberFormat("es-DO", {
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

export default function AlmacenPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "salida">("entrada");

  const [form, setForm] = useState({
    producto_id: "",
    cantidad: "1",
    costo_unitario: "0",
    referencia: "",
    responsable: "",
    nota: "",
  });

  async function cargar() {
    setLoading(true);

    const [prodRes, movRes] = await Promise.all([
      supabase
        .from("productos")
        .select("id,codigo,nombre,stock_actual,stock_minimo,costo_compra,precio_venta,ubicacion")
        .order("nombre", { ascending: true }),

      supabase
        .from("movimientos_inventario")
        .select("*, productos(nombre,codigo)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (prodRes.error) alert("Error cargando productos: " + prodRes.error.message);
    if (movRes.error) alert("Error cargando movimientos: " + movRes.error.message);

    setProductos((prodRes.data || []) as Producto[]);
    setMovimientos((movRes.data || []) as Movimiento[]);
    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const productoSeleccionado = productos.find((p) => p.id === form.producto_id);

  const filtrados = useMemo(() => {
    const q = buscar.toLowerCase().trim();

    return productos.filter((p) => {
      const texto = `${p.codigo || ""} ${p.nombre || ""} ${p.ubicacion || ""}`.toLowerCase();
      return !q || texto.includes(q);
    });
  }, [productos, buscar]);

  const resumen = useMemo(() => {
    const totalItems = productos.length;
    const stockBajo = productos.filter(
      (p) => Number(p.stock_actual || 0) <= Number(p.stock_minimo || 0)
    ).length;

    const valorInventario = productos.reduce(
      (acc, p) => acc + Number(p.stock_actual || 0) * Number(p.costo_compra || 0),
      0
    );

    return { totalItems, stockBajo, valorInventario };
  }, [productos]);

  function limpiarForm() {
    setForm({
      producto_id: "",
      cantidad: "1",
      costo_unitario: "0",
      referencia: "",
      responsable: "",
      nota: "",
    });
  }

  async function registrarMovimiento() {
    if (!productoSeleccionado) return alert("Selecciona un producto.");
    if (!form.responsable.trim()) return alert("Escribe el responsable del movimiento.");
    if (!form.referencia.trim()) return alert("La referencia es obligatoria.");

    const cantidad = Number(form.cantidad || 0);
    if (cantidad <= 0) return alert("La cantidad debe ser mayor que cero.");

    const stockAntes = Number(productoSeleccionado.stock_actual || 0);
    const stockDespues =
      tipo === "entrada" ? stockAntes + cantidad : stockAntes - cantidad;

    if (tipo === "salida" && stockDespues < 0) {
      return alert("No hay stock suficiente para esta salida.");
    }

    const costoUnitario =
      Number(form.costo_unitario || 0) || Number(productoSeleccionado.costo_compra || 0);

    if (tipo === "entrada" && costoUnitario <= 0) {
      return alert("Para entrada debes colocar costo unitario.");
    }

    const costoPromedio =
      tipo === "entrada"
        ? stockDespues > 0
          ? (stockAntes * Number(productoSeleccionado.costo_compra || 0) +
              cantidad * costoUnitario) /
            stockDespues
          : costoUnitario
        : Number(productoSeleccionado.costo_compra || 0);

    const movimientoPayload = {
      producto_id: productoSeleccionado.id,
      tipo,
      cantidad,
      stock_antes: stockAntes,
      stock_despues: stockDespues,
      costo_unitario: Number(costoPromedio.toFixed(2)),
      costo_total: cantidad * Number(costoPromedio.toFixed(2)),
      referencia: form.referencia.trim(),
      modulo: tipo === "entrada" ? "Almacén PRO / Entrada" : "Almacén PRO / Salida",
      usuario: form.responsable.trim(),
      nota: form.nota.trim() || null,
    };

    const { error: movError } = await supabase
      .from("movimientos_inventario")
      .insert(movimientoPayload);

    if (movError) {
      alert("Error creando movimiento: " + movError.message);
      return;
    }

    const updatePayload =
      tipo === "entrada"
        ? {
            stock_actual: stockDespues,
            costo_compra: Number(costoPromedio.toFixed(2)),
          }
        : {
            stock_actual: stockDespues,
          };

    const { error: stockError } = await supabase
      .from("productos")
      .update(updatePayload)
      .eq("id", productoSeleccionado.id);

    if (stockError) {
      alert("Error actualizando stock: " + stockError.message);
      return;
    }

    alert(tipo === "entrada" ? "Entrada registrada correctamente." : "Salida registrada correctamente.");
    limpiarForm();
    await cargar();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="rounded-[30px] bg-slate-950 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.4em] text-cyan-300">
                RD WOOD SYSTEM
              </p>
              <h1 className="mt-2 text-4xl font-black">Almacén PRO Operativo</h1>
              <p className="mt-1 text-sm text-slate-300">
                Entrada, salida, stock bajo e historial. Sin edición peligrosa de inventario.
              </p>
            </div>

            <button
              onClick={cargar}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              <RefreshCw className={`mr-2 inline h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card titulo="Artículos" valor={resumen.totalItems} />
          <Card titulo="Stock bajo" valor={resumen.stockBajo} danger />
          <Card titulo="Valor inventario" valor={money(resumen.valorInventario)} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[430px_1fr]">
          <div className="space-y-5">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black">Registrar movimiento</h2>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTipo("entrada")}
                  className={`rounded-2xl px-4 py-3 font-black ${
                    tipo === "entrada"
                      ? "bg-green-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <ArrowDownCircle className="mr-2 inline h-5 w-5" />
                  Entrada
                </button>

                <button
                  onClick={() => setTipo("salida")}
                  className={`rounded-2xl px-4 py-3 font-black ${
                    tipo === "salida"
                      ? "bg-blue-700 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <ArrowUpCircle className="mr-2 inline h-5 w-5" />
                  Salida
                </button>
              </div>

              <Label text="Producto" />
              <select
                value={form.producto_id}
                onChange={(e) => {
                  const p = productos.find((x) => x.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    producto_id: e.target.value,
                    costo_unitario: String(p?.costo_compra || 0),
                  }));
                }}
                className="input"
              >
                <option value="">Seleccionar producto</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — Stock: {num(p.stock_actual)}
                  </option>
                ))}
              </select>

              {productoSeleccionado && (
                <div className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm">
                  <p>
                    <b>Stock actual:</b> {num(productoSeleccionado.stock_actual)}
                  </p>
                  <p>
                    <b>Stock mínimo:</b> {num(productoSeleccionado.stock_minimo)}
                  </p>
                  <p>
                    <b>Costo prom.:</b> {money(productoSeleccionado.costo_compra)}
                  </p>
                  <p>
                    <b>Ubicación:</b> {productoSeleccionado.ubicacion || "No asignada"}
                  </p>
                </div>
              )}

              <Label text="Cantidad" />
              <input
                className="input"
                type="number"
                value={form.cantidad}
                onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
              />

              <Label text="Costo unitario" />
              <input
                className="input"
                type="number"
                value={form.costo_unitario}
                onChange={(e) => setForm((f) => ({ ...f, costo_unitario: e.target.value }))}
                disabled={tipo === "salida"}
              />

              <Label text="Referencia obligatoria" />
              <input
                className="input"
                value={form.referencia}
                onChange={(e) => setForm((f) => ({ ...f, referencia: e.target.value }))}
                placeholder="Factura, OP, requisición, ajuste autorizado..."
              />

              <Label text="Responsable" />
              <input
                className="input"
                value={form.responsable}
                onChange={(e) => setForm((f) => ({ ...f, responsable: e.target.value }))}
                placeholder="Nombre del empleado"
              />

              <Label text="Nota" />
              <textarea
                className="input min-h-[90px]"
                value={form.nota}
                onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
                placeholder="Comentario opcional..."
              />

              <button
                onClick={registrarMovimiento}
                className={`mt-4 w-full rounded-2xl px-5 py-4 font-black text-white ${
                  tipo === "entrada" ? "bg-green-600" : "bg-blue-700"
                }`}
              >
                Registrar {tipo}
              </button>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Catálogo operativo</h2>
                  <p className="text-sm text-slate-500">
                    Solo lectura para empleados. No permite editar ni eliminar.
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-slate-300 px-4">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={buscar}
                    onChange={(e) => setBuscar(e.target.value)}
                    placeholder="Buscar producto..."
                    className="h-12 w-full min-w-[260px] outline-none"
                  />
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[850px] text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="p-3 text-left">Código</th>
                      <th className="p-3 text-left">Producto</th>
                      <th className="p-3 text-left">Ubicación</th>
                      <th className="p-3 text-right">Stock</th>
                      <th className="p-3 text-right">Mínimo</th>
                      <th className="p-3 text-right">Costo</th>
                      <th className="p-3 text-center">Estado</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtrados.map((p) => {
                      const bajo =
                        Number(p.stock_actual || 0) <= Number(p.stock_minimo || 0);

                      return (
                        <tr key={p.id} className="border-t hover:bg-slate-50">
                          <td className="p-3 font-bold">{p.codigo || "-"}</td>
                          <td className="p-3 font-black">{p.nombre}</td>
                          <td className="p-3">{p.ubicacion || "-"}</td>
                          <td className="p-3 text-right font-black">
                            {num(p.stock_actual)}
                          </td>
                          <td className="p-3 text-right">{num(p.stock_minimo)}</td>
                          <td className="p-3 text-right">{money(p.costo_compra)}</td>
                          <td className="p-3 text-center">
                            {bajo ? (
                              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
                                <AlertTriangle className="mr-1 inline h-3 w-3" />
                                Reabastecer
                              </span>
                            ) : (
                              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
                                OK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {filtrados.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-slate-500">
                          No hay productos encontrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black">Últimos movimientos</h2>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="p-3 text-left">Fecha</th>
                      <th className="p-3 text-left">Producto</th>
                      <th className="p-3 text-left">Tipo</th>
                      <th className="p-3 text-right">Cant.</th>
                      <th className="p-3 text-right">Antes</th>
                      <th className="p-3 text-right">Después</th>
                      <th className="p-3 text-left">Referencia</th>
                      <th className="p-3 text-left">Responsable</th>
                    </tr>
                  </thead>

                  <tbody>
                    {movimientos.map((m) => (
                      <tr key={m.id} className="border-t hover:bg-slate-50">
                        <td className="p-3">
                          {new Date(m.created_at).toLocaleString("es-DO")}
                        </td>
                        <td className="p-3 font-bold">
                          {m.productos?.nombre || "Producto eliminado"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              m.tipo === "entrada"
                                ? "bg-green-100 text-green-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {m.tipo}
                          </span>
                        </td>
                        <td className="p-3 text-right font-black">{num(m.cantidad)}</td>
                        <td className="p-3 text-right">{num(m.stock_antes)}</td>
                        <td className="p-3 text-right">{num(m.stock_despues)}</td>
                        <td className="p-3">{m.referencia || "-"}</td>
                        <td className="p-3">{m.usuario || "-"}</td>
                      </tr>
                    ))}

                    {movimientos.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-slate-500">
                          No hay movimientos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 16px;
          border: 1px solid #dbe3ef;
          padding: 13px 14px;
          outline: none;
          background: white;
          font-size: 14px;
        }

        .input:focus {
          border-color: #0f172a;
          box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
        }
      `}</style>
    </main>
  );
}

function Card({
  titulo,
  valor,
  danger,
}: {
  titulo: string;
  valor: any;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-[24px] border bg-white p-5 shadow-sm ${
        danger ? "border-red-200" : "border-slate-200"
      }`}
    >
      <p
        className={`text-xs font-black uppercase ${
          danger ? "text-red-600" : "text-slate-500"
        }`}
      >
        {titulo}
      </p>
      <p className="mt-3 text-2xl font-black">{valor}</p>
    </div>
  );
}

function Label({ text }: { text: string }) {
  return <p className="mb-1 mt-3 text-xs font-black uppercase text-slate-500">{text}</p>;
}