"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Scrap = {
  id: string;
  code: string;
  material_name: string;
  largo_mm: number;
  ancho_mm: number;
  grosor_mm: number;
  area_m2: number;
  quantity: number;
  status: string;
  source_reference: string;
};

export default function RetazosPage() {
  const [scraps, setScraps] = useState<Scrap[]>([]);

  const fetchScraps = async () => {
    const { data } = await supabase
      .from("inventory_scraps")
      .select("*")
      .order("area_m2", { ascending: false });

    setScraps(data || []);
  };

  useEffect(() => {
    fetchScraps();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase
      .from("inventory_scraps")
      .update({ status })
      .eq("id", id);

    fetchScraps();
  };

  const getColor = (status: string) => {
    if (status === "disponible") return "bg-green-500";
    if (status === "usado") return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-6">♻️ RETAZOS PRO</h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {scraps.map((s) => (
          <div
            key={s.id}
            className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-5 rounded-xl border border-gray-700 shadow-lg"
          >
            {/* HEADER */}
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-lg">{s.code}</h2>
              <span
                className={`text-xs px-2 py-1 rounded ${getColor(
                  s.status
                )}`}
              >
                {s.status}
              </span>
            </div>

            <p className="text-sm text-gray-400 mb-2">
              {s.material_name}
            </p>

            {/* VISUAL DEL RETAZO */}
            <div className="bg-black/30 rounded-lg p-2 mb-3 flex items-center justify-center">
              <div
                style={{
                  width: `${Math.min(s.ancho_mm / 5, 200)}px`,
                  height: `${Math.min(s.largo_mm / 5, 150)}px`,
                }}
                className="bg-cyan-500/70 border border-cyan-300 flex items-center justify-center text-xs"
              >
                {s.ancho_mm} x {s.largo_mm}
              </div>
            </div>

            {/* INFO */}
            <div className="grid grid-cols-2 text-sm gap-1">
              <span>Área:</span>
              <span>{s.area_m2.toFixed(2)} m²</span>

              <span>Espesor:</span>
              <span>{s.grosor_mm} mm</span>

              <span>Cantidad:</span>
              <span>{s.quantity}</span>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              Ref: {s.source_reference}
            </p>

            {/* ACCIONES */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => updateStatus(s.id, "usado")}
                className="bg-yellow-500 px-2 py-1 rounded text-black text-xs"
              >
                Usar
              </button>

              <button
                onClick={() => updateStatus(s.id, "descartado")}
                className="bg-red-500 px-2 py-1 rounded text-xs"
              >
                Descartar
              </button>

              <button
                onClick={() => updateStatus(s.id, "disponible")}
                className="bg-green-500 px-2 py-1 rounded text-xs"
              >
                Activar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}