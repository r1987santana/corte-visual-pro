"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Project = {
  id: string;
  code?: string | null;
  project_code?: string | null;
  name?: string | null;
  project_name?: string | null;
  title?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  location?: string | null;
  type?: string | null;
  project_type?: string | null;
  status?: string | null;
  sale_price?: number | null;
  total_sale?: number | null;
  total_cost?: number | null;
  cost?: number | null;
  profit?: number | null;
  progress?: number | null;
  created_at?: string | null;
};

export default function ProyectosPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("furniture_projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error cargando proyectos:", error);
        alert(`Error cargando proyectos: ${error.message}`);
        setProjects([]);
        return;
      }

      setProjects((data || []) as Project[]);
    } catch (error) {
      console.error("Error inesperado cargando proyectos:", error);
      alert("Error inesperado cargando proyectos. Revisa consola F12.");
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  function money(value?: number | null) {
    return `RD$${Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function projectCode(project: Project) {
    return (
      project.code ||
      project.project_code ||
      `PRO-${String(project.id || "").slice(0, 8)}`
    );
  }

  function projectName(project: Project) {
    return (
      project.name ||
      project.project_name ||
      project.title ||
      "Proyecto sin nombre"
    );
  }

  function projectType(project: Project) {
    return project.type || project.project_type || "otro";
  }

  function sale(project: Project) {
    return Number(project.sale_price || project.total_sale || 0);
  }

  function cost(project: Project) {
    return Number(project.total_cost || project.cost || 0);
  }

  function profit(project: Project) {
    const explicit = Number(project.profit || 0);
    if (explicit > 0) return explicit;
    return sale(project) - cost(project);
  }

  function statusLabel(project: Project) {
    return project.status || "borrador";
  }

  function openProject(project: Project) {
    if (!project.id) {
      alert("Este proyecto no tiene ID válido.");
      return;
    }

    window.location.href = `/proyectos/${project.id}`;
  }

  function createNewProject() {
    window.location.href = "/proyectos/nuevo";
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return projects;

    return projects.filter((project) => {
      const text = [
        projectCode(project),
        projectName(project),
        project.client_name,
        project.client_phone,
        project.location,
        projectType(project),
        statusLabel(project),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [projects, search]);

  const totals = useMemo(() => {
    const totalSale = projects.reduce((sum, project) => sum + sale(project), 0);
    const totalCost = projects.reduce((sum, project) => sum + cost(project), 0);

    return {
      totalProjects: projects.length,
      totalSale,
      totalCost,
      totalProfit: totalSale - totalCost,
    };
  }, [projects]);

  return (
    <div className="min-h-screen bg-[#020617] p-6 text-white">
      <div className="mx-auto max-w-[1600px]">
        <section className="rounded-[34px] border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-[#07111f] to-blue-900 p-8 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-cyan-200">
                <BriefcaseBusiness size={15} />
                RD WOOD SYSTEM
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight lg:text-5xl">
                Proyectos CEO
              </h1>

              <p className="mt-3 max-w-3xl text-sm font-medium text-slate-300">
                Control total de proyectos, clientes, cotización, costos, avance,
                producción y utilidad real.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <span className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-black uppercase text-white">
                  Estado: Operando
                </span>
                <span className="rounded-full bg-slate-700 px-5 py-2 text-xs font-black uppercase text-white">
                  Supabase conectado
                </span>
              </div>
            </div>

            <button
              onClick={loadProjects}
              disabled={loading}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-7 py-4 text-sm font-black uppercase tracking-wide text-slate-950 shadow-xl transition hover:scale-[1.02] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <RefreshCw size={18} />
              )}
              Actualizar
            </button>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total proyectos" value={totals.totalProjects} />
          <StatCard title="Venta proyectos" value={money(totals.totalSale)} />
          <StatCard title="Costo total" value={money(totals.totalCost)} />
          <StatCard title="Utilidad" value={money(totals.totalProfit)} />
        </section>

        <section className="mt-6 rounded-[30px] border border-slate-800 bg-[#07111f] p-5 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar proyecto..."
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />
            </div>

            <button
              onClick={createNewProject}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-7 py-4 text-sm font-black uppercase tracking-wide text-white shadow-xl shadow-cyan-950/30 transition hover:scale-[1.02]"
            >
              <Plus size={18} />
              Nuevo proyecto
            </button>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-[30px] border border-slate-800 bg-[#07111f] shadow-2xl shadow-black/30">
          <div className="border-b border-slate-800 px-6 py-5">
            <h2 className="text-2xl font-black">Lista de proyectos</h2>
            <p className="mt-1 text-sm text-slate-400">
              Haz click en cualquier fila, código o proyecto para abrir el seguimiento.
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <Loader2 className="animate-spin text-cyan-300" size={44} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
              <BriefcaseBusiness className="text-slate-600" size={58} />
              <h3 className="mt-4 text-xl font-black">No hay proyectos</h3>
              <p className="mt-2 text-sm text-slate-500">
                Crea un proyecto nuevo para iniciar venta, diseño, BOM, producción y CNC.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="bg-[#020617] text-xs uppercase tracking-[0.18em] text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Código</th>
                    <th className="px-5 py-4">Cliente</th>
                    <th className="px-5 py-4">Proyecto</th>
                    <th className="px-5 py-4">Tipo</th>
                    <th className="px-5 py-4">Estado</th>
                    <th className="px-5 py-4 text-right">Venta</th>
                    <th className="px-5 py-4 text-right">Costo</th>
                    <th className="px-5 py-4 text-right">Utilidad</th>
                    <th className="px-5 py-4">Avance</th>
                    <th className="px-5 py-4">Fecha</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((project) => {
                    const progress = Number(project.progress || 0);
                    const status = statusLabel(project);
                    const date = project.created_at
                      ? new Date(project.created_at).toLocaleDateString("es-DO")
                      : "-";

                    return (
                      <tr
                        key={project.id}
                        onClick={() => openProject(project)}
                        className="cursor-pointer border-t border-slate-800 bg-slate-950/40 transition hover:bg-cyan-500/10"
                        title="Abrir seguimiento del proyecto"
                      >
                        <td className="px-5 py-5">
                          <span className="text-base font-black text-cyan-300 hover:text-cyan-100 hover:underline">
                            {projectCode(project)}
                          </span>
                        </td>

                        <td className="px-5 py-5">
                          <div className="flex items-center gap-2">
                            <UserRound size={15} className="text-slate-500" />
                            <div>
                              <div className="font-black text-white">
                                {project.client_name || "Cliente General"}
                              </div>
                              <div className="text-xs text-slate-500">
                                {project.client_phone || "Sin teléfono"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-5">
                          <div className="font-black text-white hover:text-cyan-200">
                            {projectName(project)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {project.location || "—"}
                          </div>
                        </td>

                        <td className="px-5 py-5">
                          <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-black uppercase text-slate-200">
                            {projectType(project)}
                          </span>
                        </td>

                        <td className="px-5 py-5">
                          <span
                            className={[
                              "rounded-full px-3 py-1 text-xs font-black uppercase",
                              status.toLowerCase().includes("produ")
                                ? "bg-yellow-500/10 text-yellow-300"
                                : status.toLowerCase().includes("termin") ||
                                  status.toLowerCase().includes("entreg")
                                ? "bg-emerald-500/10 text-emerald-300"
                                : "bg-slate-700 text-slate-200",
                            ].join(" ")}
                          >
                            {status}
                          </span>
                        </td>

                        <td className="px-5 py-5 text-right font-black text-emerald-300">
                          {money(sale(project))}
                        </td>

                        <td className="px-5 py-5 text-right font-black text-slate-300">
                          {money(cost(project))}
                        </td>

                        <td className="px-5 py-5 text-right font-black text-cyan-200">
                          {money(profit(project))}
                        </td>

                        <td className="px-5 py-5">
                          <div className="w-40">
                            <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600"
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                            <div className="mt-1 text-xs font-bold text-slate-500">
                              {progress}%
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-5 text-slate-400">{date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            {title}
          </div>
          <div className="mt-4 text-3xl font-black text-white">{value}</div>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
          <CheckCircle2 size={24} />
        </div>
      </div>
    </div>
  );
}
