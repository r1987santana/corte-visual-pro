"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { jsPDF } from "jspdf";
import { supabase } from "@/lib/supabase";

export default function HistorialDetalle() {
  const { id } = useParams();

  const [job, setJob] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);

    // 🔹 traer corte
    const { data: jobData } = await supabase
      .from("cutting_jobs")
      .select("*")
      .eq("id", id)
      .single();

    // 🔹 traer piezas
    const { data: itemsData } = await supabase
      .from("cutting_items")
      .select("*")
      .eq("cutting_job_id", id);

    setJob(jobData);
    setItems(itemsData || []);
    setLoading(false);
  }

  function money(v: number) {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
    }).format(v || 0);
  }

  function exportPDF() {
    const doc = new jsPDF();

    doc.text("Detalle de Corte", 14, 15);

    doc.text(`Proyecto: ${job?.project_name}`, 14, 25);
    doc.text(`Cliente: ${job?.client_name}`, 14, 32);
    doc.text(`Material: ${job?.material_name}`, 14, 39);

    doc.text(`Costo total: ${money(job?.total_cost)}`, 14, 48);

    let y = 60;

    items.forEach((p, i) => {
      doc.text(
        `${i + 1}. ${p.name} - ${p.width}x${p.height} - ${p.quantity}`,
        14,
        y
      );
      y += 7;
    });

    doc.save("detalle-corte.pdf");
  }

  function repetirCorte() {
    localStorage.setItem("repeat_cut_items", JSON.stringify(items));
    localStorage.setItem("repeat_cut_job", JSON.stringify(job));
    window.location.href = "/corte";
  }

  if (loading) return <p className="p-6">Cargando...</p>;

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <h1 className="text-2xl font-black">Detalle de Corte</h1>

        <p><b>Proyecto:</b> {job?.project_name}</p>
        <p><b>Cliente:</b> {job?.client_name}</p>
        <p><b>Material:</b> {job?.material_name}</p>
        <p><b>Hojas:</b> {job?.sheets_used}</p>
        <p><b>Costo:</b> {money(job?.total_cost)}</p>
        <p><b>Desperdicio:</b> {job?.waste_percent?.toFixed(2)}%</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <h2 className="text-xl font-bold mb-4">Piezas</h2>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2">Nombre</th>
              <th className="p-2">Ancho</th>
              <th className="p-2">Alto</th>
              <th className="p-2">Cantidad</th>
            </tr>
          </thead>

          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-2">{p.name}</td>
                <td className="p-2">{p.width}</td>
                <td className="p-2">{p.height}</td>
                <td className="p-2">{p.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        <button
          onClick={exportPDF}
          className="bg-orange-500 text-white px-4 py-2 rounded-xl"
        >
          Exportar PDF
        </button>

        <button
          onClick={repetirCorte}
          className="bg-green-600 text-white px-4 py-2 rounded-xl"
        >
          Repetir Corte
        </button>
      </div>
    </div>
  );
}