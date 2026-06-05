"use client";

import { useMemo, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileSignature,
  ImagePlus,
  PackageCheck,
  Route,
  Search,
  ShieldCheck,
  Truck,
  UploadCloud,
  UserCheck,
  Wrench,
} from "lucide-react";

type TaskStatus = "pendiente" | "en_proceso" | "completado" | "revision";

type MobileTask = {
  id: string;
  title: string;
  code: string;
  client: string;
  project: string;
  role: "Chofer" | "Instalador" | "Supervisor";
  status: TaskStatus;
  location: string;
  time: string;
  photos: number;
  signature: boolean;
};

const tasks: MobileTask[] = [
  {
    id: "1",
    title: "Retiro de módulos en producción",
    code: "MOB-001",
    client: "Cliente Proyecto Cocina",
    project: "Cocina Modular Premium",
    role: "Chofer",
    status: "en_proceso",
    location: "Taller RD Wood",
    time: "Hoy 9:30 AM",
    photos: 2,
    signature: false,
  },
  {
    id: "2",
    title: "Entrega de módulos en obra",
    code: "MOB-002",
    client: "Cliente Residencial",
    project: "Closet Principal",
    role: "Chofer",
    status: "pendiente",
    location: "La Romana",
    time: "Hoy 2:00 PM",
    photos: 0,
    signature: false,
  },
  {
    id: "3",
    title: "Instalación módulo inferior",
    code: "MOB-003",
    client: "Cliente Proyecto TV",
    project: "Centro de TV",
    role: "Instalador",
    status: "revision",
    location: "Apartamento Cliente",
    time: "Mañana 8:00 AM",
    photos: 5,
    signature: true,
  },
  {
    id: "4",
    title: "Verificación final de instalación",
    code: "MOB-004",
    client: "Cliente Cocina Blanca",
    project: "Cocina Lineal",
    role: "Supervisor",
    status: "completado",
    location: "Santo Domingo",
    time: "Ayer 4:20 PM",
    photos: 8,
    signature: true,
  },
];

const statusStyles: Record<TaskStatus, string> = {
  pendiente: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  en_proceso: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  revision: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  completado: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
};

const statusLabel: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  revision: "En revisión",
  completado: "Completado",
};

export default function MobilePage() {
  const [role, setRole] = useState<"Todos" | "Chofer" | "Instalador" | "Supervisor">("Todos");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      const matchesRole = role === "Todos" || task.role === role;
      const text = `${task.title} ${task.code} ${task.client} ${task.project} ${task.location}`.toLowerCase();
      return matchesRole && text.includes(query.toLowerCase());
    });
  }, [role, query]);

  const metrics = [
    {
      label: "Tareas activas",
      value: tasks.filter((t) => t.status !== "completado").length,
      icon: ClipboardCheck,
    },
    {
      label: "Fotos subidas",
      value: tasks.reduce((sum, task) => sum + task.photos, 0),
      icon: Camera,
    },
    {
      label: "Firmas capturadas",
      value: tasks.filter((t) => t.signature).length,
      icon: FileSignature,
    },
    {
      label: "Completadas",
      value: tasks.filter((t) => t.status === "completado").length,
      icon: CheckCircle2,
    },
  ];

  return (
    <main className="min-h-screen bg-[#030712] text-slate-100">
      <div className="mx-auto max-w-[1500px] space-y-7 p-5 md:p-8">
        <section className="overflow-hidden rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/30 shadow-2xl shadow-cyan-950/20">
          <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_.8fr] md:p-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">
                <ShieldCheck className="h-4 w-4" />
                Operaciones móviles
              </div>

              <div>
                <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                  Mobile Operations PRO
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
                  Control operativo para choferes, instaladores y supervisores:
                  fotos, firmas, estados, entregas, instalación y verificación final.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {["Todos", "Chofer", "Instalador", "Supervisor"].map((item) => (
                  <button
                    key={item}
                    onClick={() => setRole(item as any)}
                    className={`rounded-2xl border px-4 py-2 text-sm font-bold transition ${
                      role === item
                        ? "border-cyan-300 bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/20"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-300/40 hover:bg-cyan-300/10"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-200">
                  <Truck className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Flujo conectado
                  </p>
                  <h2 className="text-xl font-black text-white">Producción → Mobile → Entrega</h2>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm">
                {[
                  ["Producción libera módulos", PackageCheck],
                  ["Chofer recoge y fotografía", Truck],
                  ["Instalador confirma avance", Wrench],
                  ["Supervisor valida entrega", UserCheck],
                ].map(([label, Icon]: any) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3"
                  >
                    <Icon className="h-5 w-5 text-cyan-300" />
                    <span className="font-semibold text-slate-200">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="rounded-[24px] border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-3xl font-black text-white">{metric.value}</span>
                </div>
                <p className="mt-4 text-sm font-bold text-slate-300">{metric.label}</p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Tareas móviles</h2>
                <p className="text-sm text-slate-500">Listado operativo conectado al flujo de entrega e instalación.</p>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar tarea, cliente o proyecto..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-11 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50 md:w-80"
                />
              </div>
            </div>

            <div className="space-y-3">
              {filtered.map((task) => (
                <article
                  key={task.id}
                  className="rounded-[22px] border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-4 transition hover:border-cyan-300/30"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">
                          {task.code}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyles[task.status]}`}>
                          {statusLabel[task.status]}
                        </span>
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-200">
                          {task.role}
                        </span>
                      </div>

                      <h3 className="text-lg font-black text-white">{task.title}</h3>
                      <p className="text-sm text-slate-400">
                        {task.client} · {task.project}
                      </p>

                      <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Route className="h-4 w-4" />
                          {task.location}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-4 w-4" />
                          {task.time}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Camera className="h-4 w-4" />
                          {task.photos} fotos
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FileSignature className="h-4 w-4" />
                          {task.signature ? "Firmado" : "Sin firma"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100 hover:bg-cyan-400/20">
                        Subir foto
                      </button>
                      <button className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-400/20">
                        Completar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
              <h2 className="text-xl font-black text-white">Captura rápida</h2>
              <p className="mt-1 text-sm text-slate-500">Fotos de carga, entrega, instalación y verificación.</p>

              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-cyan-300/30 bg-cyan-300/5 p-8 text-center hover:bg-cyan-300/10">
                <UploadCloud className="h-10 w-10 text-cyan-200" />
                <span className="mt-3 text-sm font-black text-white">Subir evidencia</span>
                <span className="mt-1 text-xs text-slate-500">JPG, PNG o foto desde celular</span>
                <input type="file" multiple accept="image/*" className="hidden" />
              </label>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-white/10">
                  <ImagePlus className="mx-auto mb-2 h-5 w-5 text-cyan-200" />
                  Antes
                </button>
                <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-white/10">
                  <ImagePlus className="mx-auto mb-2 h-5 w-5 text-cyan-200" />
                  Después
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30">
              <h2 className="text-xl font-black text-white">Acciones críticas</h2>
              <div className="mt-4 space-y-3">
                {[
                  ["Confirmar carga", PackageCheck],
                  ["Confirmar entrega", Truck],
                  ["Firmar cliente", FileSignature],
                  ["Validar supervisor", ShieldCheck],
                ].map(([label, Icon]: any) => (
                  <button
                    key={label}
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-black text-slate-200 hover:border-cyan-300/30 hover:bg-cyan-300/10"
                  >
                    <Icon className="h-5 w-5 text-cyan-200" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
