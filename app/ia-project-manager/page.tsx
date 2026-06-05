"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, RotateCcw, Search, Filter } from "lucide-react";
import { supabase } from "@/lib/supabase";

type RequestRow = {
  id: string;
  project_name: string;
  client_name: string | null;
  project_type: string | null;
  style: string | null;
  status: string | null;
  is_deleted: boolean | null;
  created_at: string;
  approved_for_production: boolean | null;
};

export default function IAProjectManagerPage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("activos");

  async function loadData() {
    setLoading(true);

    let query = supabase
      .from("ai_design_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter === "activos") {
      query = query.eq("is_deleted", false);
    }

    if (filter === "eliminados") {
      query = query.eq("is_deleted", true);
    }

    const { data } = await query;

    setRows((data as RequestRow[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [filter]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const text = `
        ${r.project_name}
        ${r.client_name || ""}
        ${r.project_type || ""}
      `.toLowerCase();

      return text.includes(search.toLowerCase());
    });
  }, [rows, search]);

  async function softDelete(id: string) {
    const ok = confirm("¿Eliminar este proyecto IA?");
    if (!ok) return;

    await supabase
      .from("ai_design_requests")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        status: "deleted",
      })
      .eq("id", id);

    loadData();
  }

  async function restoreProject(id: string) {
    await supabase
      .from("ai_design_requests")
      .update({
        is_deleted: false,
        deleted_at: null,
        status: "draft",
      })
      .eq("id", id);

    loadData();
  }

  async function cancelProduction(id: string) {
    const ok = confirm("¿Cancelar fabricación?");
    if (!ok) return;

    await supabase
      .from("ai_design_requests")
      .update({
        approved_for_production: false,
        production_locked: false,
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", id);

    alert("Fabricación cancelada");

    loadData();
  }

  return (
    <div className="min-h-screen bg-[#020817] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="rounded-3xl border border-cyan-500/20 bg-[#071224] p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-black">
                RD WOOD IA PROJECT MANAGER
              </h1>

              <p className="text-cyan-300 mt-2">
                Gestión avanzada de proyectos IA
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={loadData}
                className="px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 font-bold"
              >
                RECARGAR
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl border border-cyan-500/20 bg-[#071224] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search size={18} />
              <span className="font-bold">Buscar</span>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar proyecto..."
              className="w-full rounded-xl bg-[#020817] border border-cyan-500/20 p-3 outline-none"
            />
          </div>

          <div className="rounded-2xl border border-cyan-500/20 bg-[#071224] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={18} />
              <span className="font-bold">Filtro</span>
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-xl bg-[#020817] border border-cyan-500/20 p-3 outline-none"
            >
              <option value="activos">Activos</option>
              <option value="eliminados">Eliminados</option>
              <option value="todos">Todos</option>
            </select>
          </div>

          <div className="rounded-2xl border border-cyan-500/20 bg-[#071224] p-4 flex flex-col justify-center">
            <div className="text-sm text-cyan-300">Total proyectos</div>

            <div className="text-4xl font-black">
              {filteredRows.length}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-cyan-500/20 bg-[#071224] overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-cyan-500/10">
                <tr className="text-left">
                  <th className="p-4">Proyecto</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Estilo</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-cyan-500/10"
                  >
                    <td className="p-4 font-bold">
                      {row.project_name}
                    </td>

                    <td className="p-4">
                      {row.client_name || "-"}
                    </td>

                    <td className="p-4">
                      {row.project_type || "-"}
                    </td>

                    <td className="p-4">
                      {row.style || "-"}
                    </td>

                    <td className="p-4">
                      <div className="inline-flex px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold">
                        {row.status || "draft"}
                      </div>
                    </td>

                    <td className="p-4">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {!row.is_deleted && (
                          <button
                            onClick={() => softDelete(row.id)}
                            className="px-3 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-sm font-bold flex items-center gap-2"
                          >
                            <Trash2 size={16} />
                            ELIMINAR
                          </button>
                        )}

                        {row.is_deleted && (
                          <button
                            onClick={() => restoreProject(row.id)}
                            className="px-3 py-2 rounded-xl bg-green-500 hover:bg-green-400 text-sm font-bold flex items-center gap-2"
                          >
                            <RotateCcw size={16} />
                            RESTAURAR
                          </button>
                        )}

                        <button
                          onClick={() => cancelProduction(row.id)}
                          className="px-3 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-sm font-bold text-black"
                        >
                          CANCELAR FAB
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && filteredRows.length === 0 && (
              <div className="p-10 text-center text-cyan-300">
                No hay proyectos
              </div>
            )}

            {loading && (
              <div className="p-10 text-center text-cyan-300">
                Cargando proyectos...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}