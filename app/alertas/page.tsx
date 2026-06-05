"use client";

import { useEffect, useState } from "react";
import { getAlertasStockBajo } from "@/lib/alertas";

export default function AlertasPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    try {
      setError("");
      const data = await getAlertasStockBajo();
      setProductos(data);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar las alertas.");
    }
  };

  return (
    <main className="min-h-screen bg-[#020617] p-6 text-white">
      <section className="rounded-3xl border border-cyan-400/20 bg-slate-900 p-6">
        <h1 className="text-3xl font-black">Alertas de Stock Bajo</h1>
        <p className="mt-2 text-sm text-slate-400">
          Productos con stock igual o menor al minimo operativo.
        </p>
      </section>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 font-bold text-red-100">
          {error}
        </div>
      ) : null}

      <section className="mt-5 grid gap-3">
        {productos.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4"
          >
            <p className="font-black">
              {p.name || p.product_name || p.material || "Producto"}
            </p>
            <p className="mt-1 text-sm text-amber-200">
              Stock: {p.stock ?? p.quantity ?? 0}
            </p>
          </div>
        ))}

        {productos.length === 0 && !error ? (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 font-bold text-emerald-100">
            No hay alertas de stock bajo.
          </div>
        ) : null}
      </section>
    </main>
  );
}
