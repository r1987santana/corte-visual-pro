"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  Database,
  Loader2,
  PackagePlus,
  Save,
  ShieldCheck,
  Sparkles,
  Tags,
  Warehouse,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Grupo = "TABLEROS" | "HERRAJES" | "CANTOS" | "CONSUMIBLES" | "SERVICIOS" | "OTROS";

const subgruposPorGrupo: Record<Grupo, string[]> = {
  TABLEROS: ["Melamina", "MDF", "Plywood", "RH", "Alto brillo", "Texturizado"],
  HERRAJES: ["Bisagras", "Correderas", "Tiradores", "Minifix", "Soportes", "Canastos"],
  CANTOS: ["Canto PVC", "Canto ABS", "Canto 1mm", "Canto 2mm", "Canto especial"],
  CONSUMIBLES: ["Pegamentos", "Tornillos", "Silicón", "Lijas", "Brocas", "Cuchillas"],
  SERVICIOS: ["Corte", "Canteo", "Mecanizado", "Instalación", "Transporte"],
  OTROS: ["General", "Especial", "Importado"],
};

const unidades = ["unidad", "ud", "ml", "m2", "pie", "pie2", "hoja", "caja", "par", "juego", "servicio"];

function n(v: string) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(v: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(v || 0);
}

function cleanCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase()
    .slice(0, 22);
}

export default function NuevoProductoInventarioPage() {
  const [grupo, setGrupo] = useState<Grupo>("TABLEROS");
  const [subgrupo, setSubgrupo] = useState("Melamina");
  const [material, setMaterial] = useState("");
  const [codigo, setCodigo] = useState("");
  const [unidad, setUnidad] = useState("unidad");
  const [stock, setStock] = useState("0");
  const [minimo, setMinimo] = useState("0");
  const [costoPromedio, setCostoPromedio] = useState("0");
  const [precioVenta, setPrecioVenta] = useState("0");
  const [margenDeseado, setMargenDeseado] = useState("35");
  const [proveedor, setProveedor] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const costo = n(costoPromedio);
  const venta = n(precioVenta);
  const margen = venta - costo;
  const margenPct = venta > 0 ? (margen / venta) * 100 : 0;
  const valorCosto = n(stock) * costo;
  const valorVenta = n(stock) * venta;
  const precioSugerido = useMemo(() => {
    const pct = n(margenDeseado);
    if (pct >= 100) return costo;
    if (costo <= 0) return 0;
    return costo / (1 - pct / 100);
  }, [costoPromedio, margenDeseado]);

  function handleGrupoChange(next: Grupo) {
    setGrupo(next);
    setSubgrupo(subgruposPorGrupo[next][0]);
  }

  function autoCode() {
    const base = material || `${grupo}-${subgrupo}`;
    const prefix = cleanCode(base).slice(0, 14);
    const suffix = Date.now().toString().slice(-5);
    setCodigo(`${prefix}-${suffix}`);
  }

  function useSuggestedPrice() {
    setPrecioVenta(precioSugerido.toFixed(2));
  }

  async function saveProduct() {
    setSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      if (!material.trim()) {
        setErrorMessage("Debes escribir el nombre del producto/material.");
        setSaving(false);
        return;
      }

      const finalCode = codigo.trim() || `${cleanCode(material)}-${Date.now().toString().slice(-5)}`;

      const payload: any = {
        material: material.trim(),
        name: material.trim(),
        product_name: material.trim(),
        code: finalCode,
        sku: finalCode,
        grupo,
        group_name: grupo,
        subgrupo,
        category: grupo,
        sub_category: subgrupo,
        unidad: unidad,
        unit: unidad,
        stock: n(stock),
        quantity: n(stock),
        minimo: n(minimo),
        min_stock: n(minimo),
        minimum_stock: n(minimo),
        costo_promedio: n(costoPromedio),
        unit_cost: n(costoPromedio),
        purchase_cost: n(costoPromedio),
        cost_price: n(costoPromedio),
        cost: n(costoPromedio),
        precio_venta: n(precioVenta),
        sale_price: n(precioVenta),
        price: n(precioVenta),
        supplier: proveedor.trim() || null,
        proveedor: proveedor.trim() || null,
        location: ubicacion.trim() || null,
        ubicacion: ubicacion.trim() || null,
        notes: notas.trim() || null,
        notas: notas.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("inventory").insert(payload);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage(`Producto creado correctamente: ${material}`);
      setMaterial("");
      setCodigo("");
      setStock("0");
      setMinimo("0");
      setCostoPromedio("0");
      setPrecioVenta("0");
      setProveedor("");
      setUbicacion("");
      setNotas("");
    } catch (err: any) {
      setErrorMessage(err?.message || "Error creando producto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#030712] text-slate-100">
      <div className="mx-auto max-w-[1500px] space-y-7 p-5 md:p-8">
        <section className="overflow-hidden rounded-[30px] border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/25 shadow-2xl shadow-cyan-950/20">
          <div className="grid gap-6 p-6 xl:grid-cols-[1.25fr_.75fr] xl:p-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-200">
                <Sparkles className="h-4 w-4" />
                Fase 5B · Nuevo producto SaaS PRO
              </div>

              <div>
                <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                  Crear producto inteligente
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
                  Alta profesional de productos conectados a Inventario, Producción, Compras y Ventas.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/inventario-inteligente"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al inventario
                </Link>

                <button
                  onClick={autoCode}
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm font-black text-blue-100 transition hover:bg-blue-400/20"
                >
                  <Tags className="h-4 w-4" />
                  Generar código
                </button>

                <button
                  onClick={saveProduct}
                  disabled={saving}
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Guardando..." : "Guardar producto"}
                </button>
              </div>

              {successMessage && (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-100">
                  {successMessage}
                </div>
              )}

              {errorMessage && (
                <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-semibold text-red-100">
                  {errorMessage}
                </div>
              )}
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Control inteligente</p>
                  <h2 className="text-xl font-black text-white">No rompe Producción</h2>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                  <span className="font-bold text-slate-300">Grupo</span>
                  <span className="font-black text-cyan-200">{grupo}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                  <span className="font-bold text-slate-300">Subgrupo</span>
                  <span className="font-black text-slate-100">{subgrupo}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                  <span className="font-bold text-slate-300">Código</span>
                  <span className="font-black text-emerald-200">{codigo || "Pendiente"}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
            <h2 className="text-xl font-black text-white">Datos del producto</h2>
            <p className="mt-1 text-sm text-slate-500">
              Clasificación, costos y parámetros operativos del artículo.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-black text-slate-300">Nombre / Material</span>
                <input
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder="Ej: Melamina blanca 18mm, Bisagra soft close, Canto PVC..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Código / SKU</span>
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="SKU automático o manual"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Unidad</span>
                <select
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50"
                >
                  {unidades.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Grupo</span>
                <select
                  value={grupo}
                  onChange={(e) => handleGrupoChange(e.target.value as Grupo)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50"
                >
                  {(Object.keys(subgruposPorGrupo) as Grupo[]).map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Subgrupo</span>
                <select
                  value={subgrupo}
                  onChange={(e) => setSubgrupo(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50"
                >
                  {subgruposPorGrupo[grupo].map((sg) => (
                    <option key={sg} value={sg}>{sg}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Stock inicial</span>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Stock mínimo</span>
                <input
                  type="number"
                  value={minimo}
                  onChange={(e) => setMinimo(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Costo promedio</span>
                <input
                  type="number"
                  value={costoPromedio}
                  onChange={(e) => setCostoPromedio(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Precio venta</span>
                <input
                  type="number"
                  value={precioVenta}
                  onChange={(e) => setPrecioVenta(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Proveedor</span>
                <input
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  placeholder="Proveedor principal"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-slate-300">Ubicación</span>
                <input
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="Almacén, pasillo, rack..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-black text-slate-300">Notas</span>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={4}
                  placeholder="Notas de compra, uso en producción, equivalencias, etc."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
                />
              </label>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
              <h2 className="text-xl font-black text-white">Cálculo inteligente</h2>
              <p className="mt-1 text-sm text-slate-500">
                Precio sugerido, margen y valor de inventario.
              </p>

              <div className="mt-5 grid gap-3">
                <label className="space-y-2">
                  <span className="text-sm font-black text-slate-300">Margen deseado %</span>
                  <input
                    type="number"
                    value={margenDeseado}
                    onChange={(e) => setMargenDeseado(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300/50"
                  />
                </label>

                <button
                  type="button"
                  onClick={useSuggestedPrice}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-400/20"
                >
                  <Calculator className="h-4 w-4" />
                  Usar precio sugerido {money(precioSugerido)}
                </button>
              </div>

              <div className="mt-5 grid gap-3">
                {[
                  ["Costo unitario", money(costo), Warehouse],
                  ["Precio venta", money(venta), CircleDollarSign],
                  ["Margen unidad", money(margen), margen >= 0 ? CheckCircle2 : CircleDollarSign],
                  ["Margen %", `${margenPct.toFixed(1)}%`, Boxes],
                  ["Valor costo stock", money(valorCosto), Database],
                  ["Valor venta stock", money(valorVenta), CircleDollarSign],
                ].map(([label, value, Icon]: any) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-400">
                      <Icon className="h-4 w-4 text-cyan-200" />
                      {label}
                    </span>
                    <span className={`font-black ${String(value).startsWith("-") ? "text-red-200" : "text-white"}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
              <h2 className="text-xl font-black text-white">Vista previa</h2>
              <div className="mt-5 rounded-[24px] border border-cyan-400/20 bg-cyan-400/[0.04] p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">{grupo} · {subgrupo}</p>
                <h3 className="mt-3 text-2xl font-black text-white">{material || "Producto sin nombre"}</h3>
                <p className="mt-2 text-sm text-slate-400">Código: {codigo || "Pendiente"} · Unidad: {unidad}</p>

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-black/20 p-3">
                    <p className="text-xs font-black text-slate-500">Stock</p>
                    <p className="mt-1 text-xl font-black text-white">{n(stock)}</p>
                  </div>
                  <div className="rounded-2xl bg-black/20 p-3">
                    <p className="text-xs font-black text-slate-500">Mínimo</p>
                    <p className="mt-1 text-xl font-black text-white">{n(minimo)}</p>
                  </div>
                  <div className="rounded-2xl bg-black/20 p-3">
                    <p className="text-xs font-black text-slate-500">Costo</p>
                    <p className="mt-1 text-lg font-black text-white">{money(costo)}</p>
                  </div>
                  <div className="rounded-2xl bg-black/20 p-3">
                    <p className="text-xs font-black text-slate-500">Venta</p>
                    <p className="mt-1 text-lg font-black text-white">{money(venta)}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={saveProduct}
                disabled={saving}
                type="button"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm font-black text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                Crear producto
              </button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
