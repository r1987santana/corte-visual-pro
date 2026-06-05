"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Factory,
  FileDown,
  RefreshCw,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Movimiento = {
  id: string;

  inventory_id?: string | null;
  product_id?: string | null;
  item_id?: string | null;
  producto_id?: string | null;

  product_name?: string | null;
  product_code?: string | null;

  type?: string | null;
  tipo?: string | null;
  movement_type?: string | null;

  quantity?: number | null;
  cantidad?: number | null;
  qty?: number | null;

  stock_before?: number | null;
  stock_after?: number | null;
  stock_antes?: number | null;
  stock_despues?: number | null;

  reference?: string | null;
  referencia?: string | null;
  order_code?: string | null;
  production_order_id?: string | null;
  sale_id?: string | null;
  invoice_number?: string | null;

  reason?: string | null;
  origen?: string | null;
  note?: string | null;
  notes?: string | null;
  nota?: string | null;

  unit_cost?: number | null;
  total_cost?: number | null;
  costo_unitario?: number | null;
  costo_total?: number | null;
  costo?: number | null;

  created_at?: string | null;
  fecha?: string | null;
};

type ProductoRef = {
  id: string;
  name: string;
  code: string;
};

function n(value: any) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value: any) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(n(value));
}

function num(value: any) {
  return new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n(value));
}

function formatDate(value: any) {
  if (!value) return "N/A";

  try {
    return new Date(value).toLocaleString("es-DO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

function getMovementProductId(m: Movimiento) {
  return (
    m.inventory_id ||
    m.product_id ||
    m.item_id ||
    m.producto_id ||
    null
  );
}

function getType(m: Movimiento) {
  const raw = String(m.type || m.tipo || m.movement_type || "").toLowerCase();
  const reason = String(m.reason || m.origen || "").toLowerCase();

  if (raw.includes("entrada") || raw === "in") return "ENTRADA";
  if (raw.includes("salida") || raw === "out") return "SALIDA";

  if (reason.includes("produccion") || reason.includes("producción")) return "SALIDA";
  if (m.production_order_id) return "SALIDA";
  if (m.sale_id || m.invoice_number) return "SALIDA";

  return raw ? raw.toUpperCase() : "MOVIMIENTO";
}

function getOrigin(m: Movimiento) {
  const raw = String(m.reason || m.origen || "").toLowerCase();

  if (raw.includes("produccion") || raw.includes("producción") || m.production_order_id) {
    return "Producción";
  }

  if (raw.includes("venta") || m.sale_id || m.invoice_number) {
    return "Venta";
  }

  if (raw.includes("compra") || raw.includes("purchase")) {
    return "Compra";
  }

  if (raw.includes("inventario") || raw.includes("inventory")) {
    return "Inventario";
  }

  return "Sistema";
}

function getReference(m: Movimiento) {
  return (
    m.order_code ||
    m.reference ||
    m.referencia ||
    m.invoice_number ||
    m.production_order_id ||
    m.sale_id ||
    "N/A"
  );
}

function getNote(m: Movimiento) {
  return m.note || m.notes || m.nota || m.reason || m.origen || "N/A";
}

function getQty(m: Movimiento) {
  return n(m.quantity ?? m.cantidad ?? m.qty ?? 0);
}

function getStockBefore(m: Movimiento) {
  const value = m.stock_before ?? m.stock_antes;
  return value == null ? "N/A" : num(value);
}

function getStockAfter(m: Movimiento) {
  const value = m.stock_after ?? m.stock_despues;
  return value == null ? "N/A" : num(value);
}

function getCost(m: Movimiento) {
  return n(
    m.total_cost ??
      m.costo_total ??
      m.costo ??
      m.unit_cost ??
      m.costo_unitario ??
      0
  );
}

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [productos, setProductos] = useState<ProductoRef[]>([]);
  const [loading, setLoading] = useState(false);

  const [buscar, setBuscar] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [origenFiltro, setOrigenFiltro] = useState("todos");
  const [limite, setLimite] = useState("200");

  async function cargarProductos() {
    const { data, error } = await supabase
      .from("inventory")
      .select("id, code, material, name, product_name");

    if (error) {
      console.warn("No se pudo cargar inventory:", error.message);
      setProductos([]);
      return;
    }

    const refs = (data || []).map((p: any) => ({
      id: String(p.id),
      name: String(p.material || p.name || p.product_name || p.code || "Producto"),
      code: String(p.code || p.id || "N/A"),
    }));

    setProductos(refs);
  }

  async function cargar() {
    setLoading(true);

    try {
      await cargarProductos();

      const { data: invMov, error: invError } = await supabase
        .from("inventory_movements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(Number(limite));

      let base: Movimiento[] = [];

      if (!invError) {
        base = (invMov || []) as Movimiento[];
      }

      if (invError || base.length === 0) {
        const { data: movViejos } = await supabase
          .from("movimientos")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(Number(limite));

        base = (movViejos || []) as Movimiento[];
      }

      const unicos = Array.from(
        new Map(base.map((m: any) => [String(m.id), m])).values()
      );

      setMovimientos(unicos as Movimiento[]);
    } catch (error: any) {
      alert("Error cargando movimientos: " + (error?.message || "Error desconocido"));
      setMovimientos([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    cargar();
  }, [limite]);

  function productoNombre(m: Movimiento) {
    if (m.product_name && String(m.product_name).trim() !== "") {
      return m.product_name;
    }

    const id = getMovementProductId(m);
    const p = productos.find((x) => x.id === id);

    return p?.name || p?.code || m.product_code || "Material sin vínculo";
  }

  function productoCodigo(m: Movimiento) {
    if (m.product_code && String(m.product_code).trim() !== "") {
      return m.product_code;
    }

    const id = getMovementProductId(m);
    const p = productos.find((x) => x.id === id);

    return p?.code || id || "N/A";
  }

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();

    return movimientos.filter((m) => {
      const tipo = getType(m).toLowerCase();
      const origen = getOrigin(m).toLowerCase();

      const text = [
        productoNombre(m),
        productoCodigo(m),
        getType(m),
        getOrigin(m),
        getReference(m),
        getNote(m),
      ]
        .join(" ")
        .toLowerCase();

      const pasaBusqueda = !q || text.includes(q);
      const pasaTipo = tipoFiltro === "todos" || tipo.includes(tipoFiltro.toLowerCase());
      const pasaOrigen =
        origenFiltro === "todos" || origen.includes(origenFiltro.toLowerCase());

      return pasaBusqueda && pasaTipo && pasaOrigen;
    });
  }, [movimientos, productos, buscar, tipoFiltro, origenFiltro]);

  const totalEntradas = filtrados
    .filter((m) => getType(m) === "ENTRADA")
    .reduce((a, b) => a + getQty(b), 0);

  const totalSalidas = filtrados
    .filter((m) => getType(m) === "SALIDA")
    .reduce((a, b) => a + getQty(b), 0);

  const totalProduccion = filtrados.filter(
    (m) => m.production_order_id || getOrigin(m) === "Producción"
  ).length;

  const valorMovido = filtrados.reduce((a, b) => a + getCost(b), 0);

  function exportarCSV() {
    const rows = filtrados.map((m) => ({
      fecha: formatDate(m.created_at || m.fecha),
      tipo: getType(m),
      producto: productoNombre(m),
      codigo: productoCodigo(m),
      cantidad: getQty(m),
      stock_antes: m.stock_before ?? m.stock_antes ?? "",
      stock_despues: m.stock_after ?? m.stock_despues ?? "",
      referencia: getReference(m),
      origen: getOrigin(m),
      costo: getCost(m),
      nota: getNote(m),
    }));

    if (rows.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const csv =
      "data:text/csv;charset=utf-8," +
      [
        Object.keys(rows[0]).join(","),
        ...rows.map((r) =>
          Object.values(r)
            .map((v) => `"${String(v).replaceAll('"', '""')}"`)
            .join(",")
        ),
      ].join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = "movimientos-rdwood.csv";
    link.click();
  }

  return (
    <main className="min-h-screen bg-[#070b1a] p-4 text-white lg:p-6">
      <section className="rounded-[32px] border border-white/10 bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-700 p-7 shadow-2xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.38em] text-cyan-100">
              RD WOOD SYSTEM
            </p>

            <h1 className="mt-2 text-4xl font-black">Movimientos PRO</h1>

            <p className="mt-1 text-sm text-white/80">
              Auditoría real de entradas, salidas, producción, stock antes y stock después.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi title="Movimientos" value={filtrados.length.toString()} />
            <Kpi title="Entradas" value={num(totalEntradas)} />
            <Kpi title="Salidas" value={num(totalSalidas)} danger />
            <Kpi title="Producción" value={totalProduccion.toString()} />
            <Kpi title="Valor movido" value={money(valorMovido)} />
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-xl backdrop-blur">
        <div className="grid gap-3 xl:grid-cols-[1.5fr_0.7fr_0.7fr_0.5fr_auto_auto]">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-4">
            <Search className="h-5 w-5 text-slate-400" />
            <input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar producto, OP, referencia, origen..."
              className="h-12 w-full bg-transparent font-bold text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="selectPro"
          >
            <option value="todos">Todos los tipos</option>
            <option value="entrada">Entradas</option>
            <option value="salida">Salidas</option>
          </select>

          <select
            value={origenFiltro}
            onChange={(e) => setOrigenFiltro(e.target.value)}
            className="selectPro"
          >
            <option value="todos">Todos los orígenes</option>
            <option value="producción">Producción</option>
            <option value="venta">Venta</option>
            <option value="compra">Compra</option>
            <option value="inventario">Inventario</option>
            <option value="sistema">Sistema</option>
          </select>

          <select
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            className="selectPro"
          >
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="500">500</option>
          </select>

          <button
            onClick={cargar}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/15 px-5 font-black hover:bg-white/25"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>

          <button
            onClick={exportarCSV}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 font-black hover:bg-blue-500"
          >
            <FileDown className="h-5 w-5" />
            CSV
          </button>
        </div>
      </section>

      <section className="mt-5 rounded-[32px] border border-white/10 bg-white/[0.06] p-6 shadow-xl backdrop-blur">
        <div className="mb-4">
          <h2 className="text-2xl font-black">Historial de movimientos</h2>
          <p className="text-sm text-slate-400">
            Fuente principal: inventory_movements. Respaldo: movimientos.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-[1250px] w-full text-left text-sm">
            <thead className="bg-white/10 text-xs uppercase text-slate-300">
              <tr>
                <th className="p-4">Fecha</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Material</th>
                <th className="p-4">Código / ID</th>
                <th className="p-4">Cant.</th>
                <th className="p-4">Stock antes</th>
                <th className="p-4">Stock después</th>
                <th className="p-4">Referencia</th>
                <th className="p-4">Origen</th>
                <th className="p-4">Costo</th>
                <th className="p-4">Nota</th>
              </tr>
            </thead>

            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center font-bold text-slate-400">
                    No hay movimientos.
                  </td>
                </tr>
              ) : (
                filtrados.map((m) => {
                  const tipo = getType(m);
                  const origen = getOrigin(m);

                  return (
                    <tr key={m.id} className="border-t border-white/10 hover:bg-white/[0.04]">
                      <td className="p-4 font-bold text-slate-300">
                        {formatDate(m.created_at || m.fecha)}
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                            tipo === "ENTRADA"
                              ? "bg-emerald-400/15 text-emerald-300"
                              : "bg-red-400/15 text-red-300"
                          }`}
                        >
                          {tipo === "ENTRADA" ? (
                            <ArrowUpCircle className="h-3 w-3" />
                          ) : (
                            <ArrowDownCircle className="h-3 w-3" />
                          )}
                          {tipo}
                        </span>
                      </td>

                      <td className="p-4 font-black">{productoNombre(m)}</td>

                      <td className="p-4 text-xs font-bold text-slate-400">
                        {productoCodigo(m)}
                      </td>

                      <td className="p-4 font-black">{num(getQty(m))}</td>

                      <td className="p-4 font-bold">{getStockBefore(m)}</td>

                      <td className="p-4 font-bold">{getStockAfter(m)}</td>

                      <td className="p-4 font-bold text-cyan-300">{getReference(m)}</td>

                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                            origen.toLowerCase().includes("produ")
                              ? "bg-violet-400/15 text-violet-300"
                              : "bg-blue-400/15 text-blue-300"
                          }`}
                        >
                          {origen.toLowerCase().includes("produ") ? (
                            <Factory className="h-3 w-3" />
                          ) : null}
                          {origen}
                        </span>
                      </td>

                      <td className="p-4 font-black">{money(getCost(m))}</td>

                      <td className="p-4 text-slate-300">{getNote(m)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx global>{`
        .selectPro {
          height: 3rem;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(2, 6, 23, 0.72);
          padding: 0 1rem;
          color: white;
          font-weight: 800;
          outline: none;
        }

        .selectPro option {
          background: rgb(15 23 42);
          color: white;
        }
      `}</style>
    </main>
  );
}

function Kpi({
  title,
  value,
  danger,
}: {
  title: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-xs font-bold text-slate-300">{title}</p>
      <p className={`mt-1 text-2xl font-black ${danger ? "text-red-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}