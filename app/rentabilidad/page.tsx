"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProductionOrder = {
  id: string;
  client_name: string | null;
  phone: string | null;
  project_type: string | null;
  linear_feet: number | null;
  total: number | null;
  status: string | null;

  sheets_used: number | null;
  material_cost: number | null;
  edge_cost: number | null;
  total_cost: number | null;
  profit: number | null;

  labor_cost: number | null;
  cnc_cost: number | null;
  install_cost: number | null;
  transport_cost: number | null;
  overhead_cost: number | null;
  hardware_cost: number | null;
  real_total_cost: number | null;
  real_profit_final: number | null;
  real_margin_final: number | null;

  created_at: string;
};

type Movimiento = {
  id: string;
  producto_id: string | null;
  tipo: string;
  cantidad: number | null;
  costo_total: number | null;
  referencia: string | null;
  modulo: string | null;
  created_at: string;
  productos?: {
    nombre: string | null;
    codigo: string | null;
  } | null;
};

type OperatorTime = {
  id: string;
  order_id: string | null;
  operator_name: string | null;
  process: string | null;
  hours: number | null;
  rate: number | null;
  total: number | null;
  created_at: string;
};

type ExtraCost = {
  id: string;
  order_id: string | null;
  concept: string | null;
  category: string | null;
  quantity: number | null;
  unit_cost: number | null;
  total: number | null;
  created_at: string;
};

type Instalacion = {
  id: string;
  orden_id: string | null;
  tecnico: string | null;
  estado: string | null;
  fecha: string | null;
  hora_salida: string | null;
  hora_llegada: string | null;
  hora_finalizacion: string | null;
  created_at: string;
};

const money = (v: any) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
  }).format(Number(v || 0));

const num = (v: any) =>
  new Intl.NumberFormat("es-DO", {
    maximumFractionDigits: 2,
  }).format(Number(v || 0));

function pct(v: any) {
  return `${num(v)}%`;
}

function getDateFromFilter(days: string) {
  const d = new Date();
  d.setDate(d.getDate() - Number(days || 30));
  return d.toISOString();
}

export default function RentabilidadPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [operatorTimes, setOperatorTimes] = useState<OperatorTime[]>([]);
  const [extraCosts, setExtraCosts] = useState<ExtraCost[]>([]);
  const [instalaciones, setInstalaciones] = useState<Instalacion[]>([]);
  const [loading, setLoading] = useState(false);

  const [dateFilter, setDateFilter] = useState("90");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");

  useEffect(() => {
    cargarTodo();
  }, [dateFilter]);

  async function cargarTodo() {
    setLoading(true);
    const desde = getDateFromFilter(dateFilter);

    const [ordersRes, movRes, timesRes, costsRes, instRes] = await Promise.all([
      supabase
        .from("production_orders")
        .select("*")
        .gte("created_at", desde)
        .order("created_at", { ascending: false }),

      supabase
        .from("movimientos_inventario")
        .select("*, productos(nombre,codigo)")
        .gte("created_at", desde)
        .order("created_at", { ascending: false }),

      supabase
        .from("production_operator_time")
        .select("*")
        .gte("created_at", desde)
        .order("created_at", { ascending: false }),

      supabase
        .from("production_order_costs")
        .select("*")
        .gte("created_at", desde)
        .order("created_at", { ascending: false }),

      supabase
        .from("instalaciones")
        .select("*")
        .gte("created_at", desde)
        .order("created_at", { ascending: false }),
    ]);

    if (ordersRes.error) alert("Error órdenes: " + ordersRes.error.message);
    if (movRes.error) alert("Error movimientos: " + movRes.error.message);
    if (timesRes.error) alert("Error tiempos operarios: " + timesRes.error.message);
    if (costsRes.error) alert("Error costos extras: " + costsRes.error.message);
    if (instRes.error) alert("Error instalaciones: " + instRes.error.message);

    setOrders((ordersRes.data || []) as ProductionOrder[]);
    setMovimientos((movRes.data || []) as Movimiento[]);
    setOperatorTimes((timesRes.data || []) as OperatorTime[]);
    setExtraCosts((costsRes.data || []) as ExtraCost[]);
    setInstalaciones((instRes.data || []) as Instalacion[]);

    setLoading(false);
  }

  function calcularOrden(order: ProductionOrder) {
    const venta = Number(order.total || 0);

    const consumosProduccion = movimientos.filter((m) => {
      const ref = String(m.referencia || "");
      const modulo = String(m.modulo || "");
      return (
        modulo.includes("Producción") &&
        (ref.includes(order.id) || ref.includes(String(order.id).slice(0, 8)))
      );
    });

    const costoMaterialInventario = consumosProduccion.reduce(
      (s, m) => s + Number(m.costo_total || 0),
      0
    );

    const tiempos = operatorTimes.filter((t) => t.order_id === order.id);
    const costoOperarios = tiempos.reduce((s, t) => s + Number(t.total || 0), 0);

    const costos = extraCosts.filter((c) => c.order_id === order.id);
    const costoExtras = costos.reduce((s, c) => s + Number(c.total || 0), 0);

    const costoMaterial =
      Number(order.material_cost || 0) || costoMaterialInventario || 0;

    const costoCanto = Number(order.edge_cost || 0);
    const costoManoObra =
      Number(order.labor_cost || 0) || costoOperarios || 0;
    const costoCnc = Number(order.cnc_cost || 0);
    const costoInstalacion = Number(order.install_cost || 0);
    const costoTransporte = Number(order.transport_cost || 0);
    const costoIndirecto = Number(order.overhead_cost || 0);
    const costoHerrajes = Number(order.hardware_cost || 0);

    const costoTotalSistema =
      Number(order.real_total_cost || 0) || Number(order.total_cost || 0);

    const costoTotalCalculado =
      costoMaterial +
      costoCanto +
      costoManoObra +
      costoCnc +
      costoInstalacion +
      costoTransporte +
      costoIndirecto +
      costoHerrajes +
      costoExtras;

    const costoTotal = costoTotalSistema > 0 ? costoTotalSistema : costoTotalCalculado;
    const ganancia = venta - costoTotal;
    const margen = venta > 0 ? (ganancia / venta) * 100 : 0;

    const instalada = instalaciones.find((i) => i.orden_id === order.id);

    let alerta = "Rentable";
    if (margen < 0) alerta = "Pérdida";
    else if (margen < 20) alerta = "Margen bajo";
    else if (margen < 35) alerta = "Aceptable";
    else alerta = "Excelente";

    return {
      order,
      venta,
      costoMaterial,
      costoCanto,
      costoManoObra,
      costoCnc,
      costoInstalacion,
      costoTransporte,
      costoIndirecto,
      costoHerrajes,
      costoExtras,
      costoTotal,
      ganancia,
      margen,
      consumosProduccion,
      tiempos,
      costos,
      instalada,
      alerta,
    };
  }

  const filas = useMemo(() => {
    let data = orders.map(calcularOrden);

    if (statusFilter !== "todos") {
      data = data.filter((x) => String(x.order.status || "") === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((x) => {
        return (
          String(x.order.client_name || "").toLowerCase().includes(q) ||
          String(x.order.project_type || "").toLowerCase().includes(q) ||
          String(x.order.status || "").toLowerCase().includes(q)
        );
      });
    }

    return data;
  }, [orders, movimientos, operatorTimes, extraCosts, instalaciones, statusFilter, search]);

  const resumen = useMemo(() => {
    const ventas = filas.reduce((s, r) => s + r.venta, 0);
    const costos = filas.reduce((s, r) => s + r.costoTotal, 0);
    const ganancia = ventas - costos;
    const margen = ventas > 0 ? (ganancia / ventas) * 100 : 0;

    const perdidas = filas.filter((r) => r.ganancia < 0).length;
    const margenBajo = filas.filter((r) => r.ganancia >= 0 && r.margen < 20).length;
    const excelentes = filas.filter((r) => r.margen >= 35).length;

    const mejor = [...filas].sort((a, b) => b.ganancia - a.ganancia)[0];
    const peor = [...filas].sort((a, b) => a.ganancia - b.ganancia)[0];

    return {
      ordenes: filas.length,
      ventas,
      costos,
      ganancia,
      margen,
      perdidas,
      margenBajo,
      excelentes,
      mejor,
      peor,
    };
  }, [filas]);

  const porTipoProyecto = useMemo(() => {
    const map = new Map<string, { tipo: string; ordenes: number; ventas: number; costos: number }>();

    filas.forEach((r) => {
      const tipo = r.order.project_type || "Sin tipo";
      const actual = map.get(tipo) || { tipo, ordenes: 0, ventas: 0, costos: 0 };
      actual.ordenes += 1;
      actual.ventas += r.venta;
      actual.costos += r.costoTotal;
      map.set(tipo, actual);
    });

    return Array.from(map.values())
      .map((x) => ({
        ...x,
        ganancia: x.ventas - x.costos,
        margen: x.ventas > 0 ? ((x.ventas - x.costos) / x.ventas) * 100 : 0,
      }))
      .sort((a, b) => b.ganancia - a.ganancia);
  }, [filas]);

  const estados = useMemo(() => {
    const unique = Array.from(new Set(orders.map((o) => String(o.status || "-"))));
    return unique.filter(Boolean);
  }, [orders]);

  function exportarCSV() {
    const rows = [
      [
        "cliente",
        "proyecto",
        "estado",
        "venta",
        "material",
        "canto",
        "mano_obra",
        "cnc",
        "instalacion",
        "transporte",
        "indirecto",
        "herrajes",
        "extras",
        "costo_total",
        "ganancia",
        "margen",
        "alerta",
      ],
      ...filas.map((r) => [
        r.order.client_name || "",
        r.order.project_type || "",
        r.order.status || "",
        r.venta,
        r.costoMaterial,
        r.costoCanto,
        r.costoManoObra,
        r.costoCnc,
        r.costoInstalacion,
        r.costoTransporte,
        r.costoIndirecto,
        r.costoHerrajes,
        r.costoExtras,
        r.costoTotal,
        r.ganancia,
        r.margen,
        r.alerta,
      ]),
    ];

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rentabilidad-proyectos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900">
      <div className="mx-auto max-w-[1700px] space-y-5">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black tracking-[0.45em] text-blue-700">
            RD WOOD SYSTEM
          </p>

          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black">Rentabilidad por Proyecto</h1>
              <p className="mt-1 text-sm text-slate-500">
                Venta · costos reales · ganancia · margen · alertas por orden
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded-2xl border px-4 py-3 text-sm font-black"
              >
                <option value="30">Últimos 30 días</option>
                <option value="90">Últimos 90 días</option>
                <option value="180">Últimos 180 días</option>
                <option value="365">Último año</option>
              </select>

              <button
                onClick={exportarCSV}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
              >
                Exportar CSV
              </button>

              <button
                onClick={cargarTodo}
                className="rounded-2xl bg-blue-700 px-6 py-3 text-sm font-black text-white"
              >
                {loading ? "Cargando..." : "Actualizar"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
          <Card title="Órdenes" value={resumen.ordenes} />
          <Card title="Ventas" value={money(resumen.ventas)} />
          <Card title="Costos" value={money(resumen.costos)} />
          <Card
            title="Ganancia"
            value={money(resumen.ganancia)}
            good={resumen.ganancia >= 0}
            danger={resumen.ganancia < 0}
          />
          <Card title="Margen" value={pct(resumen.margen)} good={resumen.margen >= 30} danger={resumen.margen < 20} />
          <Card title="Pérdidas" value={resumen.perdidas} danger={resumen.perdidas > 0} />
          <Card title="Margen bajo" value={resumen.margenBajo} danger={resumen.margenBajo > 0} />
          <Card title="Excelentes" value={resumen.excelentes} good />
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Panel title="Mejor y peor proyecto">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-green-200 bg-green-50 p-5">
                <p className="text-xs font-black uppercase text-green-700">Más rentable</p>
                <h3 className="mt-2 text-xl font-black">
                  {resumen.mejor?.order.client_name || "-"}
                </h3>
                <p className="text-sm text-green-700">
                  {resumen.mejor?.order.project_type || "-"}
                </p>
                <p className="mt-3 text-2xl font-black">
                  {money(resumen.mejor?.ganancia || 0)}
                </p>
                <p className="text-sm font-bold">Margen: {pct(resumen.mejor?.margen || 0)}</p>
              </div>

              <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
                <p className="text-xs font-black uppercase text-red-700">Más crítico</p>
                <h3 className="mt-2 text-xl font-black">
                  {resumen.peor?.order.client_name || "-"}
                </h3>
                <p className="text-sm text-red-700">
                  {resumen.peor?.order.project_type || "-"}
                </p>
                <p className="mt-3 text-2xl font-black">
                  {money(resumen.peor?.ganancia || 0)}
                </p>
                <p className="text-sm font-bold">Margen: {pct(resumen.peor?.margen || 0)}</p>
              </div>
            </div>
          </Panel>

          <Panel title="Rentabilidad por tipo de proyecto">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="p-3">Tipo</th>
                    <th>Órdenes</th>
                    <th>Ventas</th>
                    <th>Costos</th>
                    <th>Ganancia</th>
                    <th>Margen</th>
                  </tr>
                </thead>

                <tbody>
                  {porTipoProyecto.map((x) => (
                    <tr key={x.tipo} className="border-b">
                      <td className="p-3 font-black">{x.tipo}</td>
                      <td>{x.ordenes}</td>
                      <td>{money(x.ventas)}</td>
                      <td>{money(x.costos)}</td>
                      <td className={x.ganancia >= 0 ? "font-black text-green-700" : "font-black text-red-700"}>
                        {money(x.ganancia)}
                      </td>
                      <td>{pct(x.margen)}</td>
                    </tr>
                  ))}

                  {porTipoProyecto.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No hay datos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black">Detalle por orden</h2>
              <p className="text-sm text-slate-500">
                Aquí ves qué proyecto deja dinero y cuál está perdiendo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente/proyecto..."
                className="rounded-2xl border px-4 py-3 text-sm"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-2xl border px-4 py-3 text-sm font-black"
              >
                <option value="todos">Todos los estados</option>
                {estados.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1450px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="p-3">Cliente</th>
                  <th>Proyecto</th>
                  <th>Estado</th>
                  <th>Venta</th>
                  <th>Material</th>
                  <th>Canto</th>
                  <th>Mano obra</th>
                  <th>CNC</th>
                  <th>Instalación</th>
                  <th>Transporte</th>
                  <th>Indirecto</th>
                  <th>Herrajes</th>
                  <th>Extras</th>
                  <th>Costo total</th>
                  <th>Ganancia</th>
                  <th>Margen</th>
                  <th>Alerta</th>
                </tr>
              </thead>

              <tbody>
                {filas.map((r) => (
                  <tr key={r.order.id} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-black">{r.order.client_name || "-"}</td>
                    <td>{r.order.project_type || "-"}</td>
                    <td>
                      <Status text={r.order.status || "-"} />
                    </td>
                    <td>{money(r.venta)}</td>
                    <td>{money(r.costoMaterial)}</td>
                    <td>{money(r.costoCanto)}</td>
                    <td>{money(r.costoManoObra)}</td>
                    <td>{money(r.costoCnc)}</td>
                    <td>{money(r.costoInstalacion)}</td>
                    <td>{money(r.costoTransporte)}</td>
                    <td>{money(r.costoIndirecto)}</td>
                    <td>{money(r.costoHerrajes)}</td>
                    <td>{money(r.costoExtras)}</td>
                    <td className="font-black">{money(r.costoTotal)}</td>
                    <td className={r.ganancia >= 0 ? "font-black text-green-700" : "font-black text-red-700"}>
                      {money(r.ganancia)}
                    </td>
                    <td className={r.margen >= 30 ? "font-black text-green-700" : r.margen < 20 ? "font-black text-red-700" : "font-black text-yellow-700"}>
                      {pct(r.margen)}
                    </td>
                    <td>
                      <ProfitBadge text={r.alerta} />
                    </td>
                  </tr>
                ))}

                {filas.length === 0 && (
                  <tr>
                    <td colSpan={17} className="p-10 text-center text-slate-500">
                      No hay órdenes para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-3">
          <Panel title="Lectura gerencial">
            <div className="space-y-3 text-sm">
              <Insight
                title="Margen objetivo"
                text="Para muebles industriales, intenta mantener margen real por encima de 30% después de materiales, mano de obra, CNC, instalación, transporte y herrajes."
              />
              <Insight
                title="Alerta roja"
                text="Si un proyecto baja de 20%, revisa cotización, desperdicio, horas de taller e instalación."
              />
              <Insight
                title="Uso correcto"
                text="Antes de cerrar una orden, asegúrate de agregar mano de obra, CNC, instalación, transporte y herrajes en Producción → Costeo."
              />
            </div>
          </Panel>

          <Panel title="Costos invisibles a controlar">
            <ul className="space-y-2 text-sm font-semibold text-slate-700">
              <li>• Horas reales de operarios</li>
              <li>• Tiempo de máquina CNC</li>
              <li>• Transporte y combustible</li>
              <li>• Herrajes no presupuestados</li>
              <li>• Retrabajos por piezas dañadas</li>
              <li>• Instalaciones con más de una visita</li>
            </ul>
          </Panel>

          <Panel title="Próxima mejora sugerida">
            <p className="text-sm text-slate-600">
              Conectar este módulo con alertas automáticas: si una orden baja de 20% de margen,
              el sistema debe bloquear cierre o pedir autorización de gerencia.
            </p>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Card({
  title,
  value,
  danger,
  good,
}: {
  title: string;
  value: any;
  danger?: boolean;
  good?: boolean;
}) {
  return (
    <div
      className={`rounded-[24px] border bg-white p-5 shadow-sm ${
        danger ? "border-red-200" : good ? "border-green-200" : "border-slate-200"
      }`}
    >
      <p
        className={`text-xs font-black uppercase ${
          danger ? "text-red-600" : good ? "text-green-600" : "text-slate-500"
        }`}
      >
        {title}
      </p>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 border-b pb-3 text-2xl font-black">{title}</h2>
      {children}
    </section>
  );
}

function Status({ text }: { text: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
      {text}
    </span>
  );
}

function ProfitBadge({ text }: { text: string }) {
  const cls =
    text === "Excelente"
      ? "bg-green-100 text-green-700"
      : text === "Aceptable"
      ? "bg-blue-100 text-blue-700"
      : text === "Margen bajo"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";

  return <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>{text}</span>;
}

function Insight({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="font-black">{title}</p>
      <p className="mt-1 text-slate-600">{text}</p>
    </div>
  );
}
