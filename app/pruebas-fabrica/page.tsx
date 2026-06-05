"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Factory,
  FileText,
  Image,
  PackageCheck,
  QrCode,
  RefreshCw,
  Save,
  Scissors,
  ShieldCheck,
  Truck,
  Users,
  Wrench,
  X,
} from "lucide-react";

type PilotStep = {
  id: string;
  area: string;
  title: string;
  objective: string;
  route: string;
  owner: string;
  evidence: string;
  icon: React.ReactNode;
};

type Incident = {
  id: string;
  area: string;
  severity: "baja" | "media" | "alta" | "critica";
  status: "abierta" | "revisando" | "resuelta";
  description: string;
  createdAt: string;
};

const STORAGE_KEY = "rdwood_factory_pilot_v2";
const VISIT_RENDER_FEE = 5000;

const paymentRules = [
  "El cliente se registra primero en Maestro Clientes.",
  "Antes de medir, paga RD$5,000 fijos por visita, medicion y renders.",
  "Diseno genera 4 opciones de render para que el cliente elija una.",
  "Despues del render aprobado, pasa a cotizacion.",
  "Cotizacion aprobada genera contrato.",
  "Contrato: 60% para iniciar produccion, 20% para entregar, 20% al finalizar instalacion.",
  "Los RD$5,000 iniciales se descuentan del ultimo 20%.",
];

const steps: PilotStep[] = [
  {
    id: "cliente",
    area: "Comercial",
    title: "Captar cliente en Maestro Clientes",
    objective: "Registrar nombre, telefono, direccion, canal de entrada y necesidad inicial.",
    route: "/clientes",
    owner: "Ventas",
    evidence: "Cliente creado con datos de contacto completos.",
    icon: <FileText size={20} />,
  },
  {
    id: "agenda",
    area: "Agenda",
    title: "Agendar visita",
    objective: "Crear cita para visita de levantamiento y confirmar fecha con el cliente.",
    route: "/agenda",
    owner: "Ventas / Agenda",
    evidence: "Visita agendada con fecha, hora, responsable y direccion.",
    icon: <CalendarDays size={20} />,
  },
  {
    id: "pago_visita",
    area: "Cobro inicial",
    title: "Cobrar RD$5,000 antes de medir",
    objective: "Registrar pago fijo por visita, medicion y generacion de renders.",
    route: "/pagos",
    owner: "Caja / Ventas",
    evidence: "Pago RD$5,000 registrado antes de enviar tecnico.",
    icon: <CreditCard size={20} />,
  },
  {
    id: "levantamiento",
    area: "Levantamiento",
    title: "Tomar medidas reales",
    objective: "Visitar al cliente, tomar medidas, fotos, notas tecnicas y restricciones del espacio.",
    route: "/levantamientos",
    owner: "Tecnico de medicion",
    evidence: "Medidas, fotos y observaciones guardadas.",
    icon: <ClipboardCheck size={20} />,
  },
  {
    id: "renders",
    area: "Diseno IA",
    title: "Generar 4 opciones de render",
    objective: "Crear cuatro propuestas visuales basadas en las medidas y preferencia del cliente.",
    route: "/ia-diseno",
    owner: "Diseno",
    evidence: "4 renders disponibles para revision del cliente.",
    icon: <Image size={20} />,
  },
  {
    id: "render_aprobado",
    area: "Aprobacion cliente",
    title: "Cliente selecciona render",
    objective: "Registrar cual opcion de render fue aprobada antes de cotizar.",
    route: "/portal-cliente",
    owner: "Cliente / Ventas",
    evidence: "Render elegido y aprobado por el cliente.",
    icon: <CheckCircle2 size={20} />,
  },
  {
    id: "cotizacion",
    area: "Comercial",
    title: "Generar cotizacion",
    objective: "Crear cotizacion desde el render aprobado, medidas, materiales y margen real.",
    route: "/cotizador-automatico",
    owner: "Ventas",
    evidence: "Cotizacion enviada y aprobada por el cliente.",
    icon: <ClipboardCheck size={20} />,
  },
  {
    id: "contrato",
    area: "Contrato",
    title: "Contrato y pago inicial 60%",
    objective: "Generar contrato y registrar el 60% para iniciar produccion.",
    route: "/contratos",
    owner: "Ventas / Administracion",
    evidence: "Contrato firmado y 60% registrado.",
    icon: <CreditCard size={20} />,
  },
  {
    id: "produccion",
    area: "Produccion",
    title: "Liberar a produccion",
    objective: "Crear orden, BOM, piezas, materiales y ruta de fabricacion.",
    route: "/produccion",
    owner: "Supervisor de planta",
    evidence: "Orden liberada con BOM revisado.",
    icon: <Factory size={20} />,
  },
  {
    id: "corte",
    area: "Corte/CNC",
    title: "Optimizacion, corte y canteo",
    objective: "Optimizar planchas, validar veta, generar corte, canteo, QR y reporte.",
    route: "/corte",
    owner: "Corte / CNC",
    evidence: "Nesting aprobado, piezas cortadas/canteadas y QR generado.",
    icon: <Scissors size={20} />,
  },
  {
    id: "ensamblado_limpieza",
    area: "Ensamblado",
    title: "Ensamblado y limpieza",
    objective: "Armar modulos, revisar calidad, limpiar y dejar listo para despacho.",
    route: "/ensamblado",
    owner: "Ensamblado",
    evidence: "Modulo ensamblado, limpio y listo para transporte.",
    icon: <PackageCheck size={20} />,
  },
  {
    id: "pago_entrega",
    area: "Cobro entrega",
    title: "Cobrar 20% para entregar",
    objective: "Registrar segundo pago antes de transportar el proyecto.",
    route: "/cuentas-por-cobrar",
    owner: "Administracion",
    evidence: "20% de entrega registrado antes del despacho.",
    icon: <CreditCard size={20} />,
  },
  {
    id: "transporte",
    area: "Transporte",
    title: "Transportacion",
    objective: "Registrar salida, chofer, vehiculo, evidencias y entrega al equipo de instalacion.",
    route: "/transporte",
    owner: "Logistica",
    evidence: "Despacho registrado con evidencia.",
    icon: <Truck size={20} />,
  },
  {
    id: "instalacion",
    area: "Instalacion",
    title: "Instalacion",
    objective: "Instalar modulos, registrar avances, fotos, faltantes o ajustes.",
    route: "/instalacion",
    owner: "Instaladores",
    evidence: "Instalacion completada o incidencias registradas.",
    icon: <Wrench size={20} />,
  },
  {
    id: "verificacion",
    area: "Verificacion",
    title: "Verificacion final",
    objective: "QA revisa medidas, terminacion, limpieza, puertas, gavetas, luces y detalles.",
    route: "/verificacion",
    owner: "Supervisor QA",
    evidence: "Checklist de verificacion aprobado.",
    icon: <QrCode size={20} />,
  },
  {
    id: "entrega_final",
    area: "Entrega",
    title: "Entrega final y cobro restante",
    objective: "Cerrar proyecto, descontar RD$5,000 del ultimo 20%, firma y evidencia final.",
    route: "/entrega-final",
    owner: "Ventas / Instalacion",
    evidence: "20% final conciliado, RD$5,000 descontados y entrega firmada.",
    icon: <PackageCheck size={20} />,
  },
];

function todayText() {
  return new Date().toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function loadPilotState() {
  if (typeof window === "undefined") {
    return {
      checked: {} as Record<string, boolean>,
      incidents: [] as Incident[],
      pilotName: "Cliente Piloto 01",
      supervisor: "Supervisor RD Wood",
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    return JSON.parse(raw);
  } catch {
    return {
      checked: {} as Record<string, boolean>,
      incidents: [] as Incident[],
      pilotName: "Cliente Piloto 01",
      supervisor: "Supervisor RD Wood",
    };
  }
}

export default function PruebasFabricaPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [pilotName, setPilotName] = useState("Cliente Piloto 01");
  const [supervisor, setSupervisor] = useState("Supervisor RD Wood");
  const [incidentArea, setIncidentArea] = useState("Comercial");
  const [incidentSeverity, setIncidentSeverity] = useState<Incident["severity"]>("media");
  const [incidentText, setIncidentText] = useState("");

  useEffect(() => {
    const state = loadPilotState();
    setChecked(state.checked || {});
    setIncidents(state.incidents || []);
    setPilotName(state.pilotName || "Cliente Piloto 01");
    setSupervisor(state.supervisor || "Supervisor RD Wood");
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ checked, incidents, pilotName, supervisor })
    );
  }, [checked, incidents, pilotName, supervisor]);

  const done = steps.filter((step) => checked[step.id]).length;
  const progress = Math.round((done / steps.length) * 100);
  const criticalOpen = incidents.filter(
    (item) => item.status !== "resuelta" && ["alta", "critica"].includes(item.severity)
  ).length;

  const readiness = useMemo(() => {
    if (criticalOpen > 0) return "BLOQUEADO";
    if (progress >= 90) return "LISTO PARA PILOTO";
    if (progress >= 55) return "EN VALIDACION";
    return "PREPARACION";
  }, [criticalOpen, progress]);

  function toggleStep(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function addIncident() {
    const text = incidentText.trim();
    if (!text) return;

    setIncidents((prev) => [
      {
        id: `INC-${Date.now()}`,
        area: incidentArea,
        severity: incidentSeverity,
        status: "abierta",
        description: text,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setIncidentText("");
  }

  function updateIncident(id: string, status: Incident["status"]) {
    setIncidents((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  }

  function resetPilot() {
    if (!confirm("Reiniciar checklist e incidencias del piloto en este equipo?")) return;
    setChecked({});
    setIncidents([]);
  }

  return (
    <main className="min-h-screen bg-[#020617] p-5 text-white lg:p-7">
      <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="rounded-[28px] border border-cyan-400/20 bg-[#07111f] p-6 shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
                <ShieldCheck size={15} /> Piloto de fabrica
              </div>
              <h1 className="mt-5 text-4xl font-black leading-tight lg:text-5xl">
                Flujo Maestro Cliente a Entrega
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold text-slate-400">
                Prueba controlada del proceso real: cliente, agenda, pago de visita, medicion, render, cotizacion, contrato, pagos, produccion, instalacion y entrega.
              </p>
            </div>

            <div className="grid min-w-[260px] gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <Mini label="Fecha" value={todayText()} />
              <Mini label="Estado" value={readiness} accent={readiness === "LISTO PARA PILOTO"} />
              <Mini label="Avance" value={`${progress}%`} accent={progress >= 90} />
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Field label="Cliente / proyecto piloto" value={pilotName} onChange={setPilotName} />
            <Field label="Responsable" value={supervisor} onChange={setSupervisor} />
          </div>

          <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-slate-950/70 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                  Reglas comerciales del piloto
                </p>
                <h2 className="mt-1 text-xl font-black">Pago inicial RD${VISIT_RENDER_FEE.toLocaleString("en-US")} + plan 60/20/20</h2>
              </div>
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-100">
                4 renders antes de cotizar
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {paymentRules.map((rule) => (
                <div key={rule} className="flex gap-2 rounded-xl border border-slate-800 bg-[#07111f] p-3 text-xs font-bold text-slate-300">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-300" size={15} />
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="rounded-[28px] border border-cyan-400/20 bg-[#07111f] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
              <AlertTriangle size={22} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Control de riesgo</p>
              <h2 className="text-2xl font-black">Incidencias</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <select
              value={incidentArea}
              onChange={(event) => setIncidentArea(event.target.value)}
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-white"
            >
              {Array.from(new Set(steps.map((step) => step.area))).map((area) => (
                <option key={area}>{area}</option>
              ))}
            </select>
            <select
              value={incidentSeverity}
              onChange={(event) => setIncidentSeverity(event.target.value as Incident["severity"])}
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-white"
            >
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="critica">Critica</option>
            </select>
            <textarea
              value={incidentText}
              onChange={(event) => setIncidentText(event.target.value)}
              placeholder="Describe el problema encontrado..."
              className="min-h-[110px] rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400"
            />
            <button
              type="button"
              onClick={addIncident}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white hover:bg-cyan-500"
            >
              <Save size={17} /> Registrar incidencia
            </button>
          </div>
        </aside>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-4">
        <Kpi title="Pasos completos" value={`${done}/${steps.length}`} icon={<CheckCircle2 />} />
        <Kpi title="Incidencias abiertas" value={String(incidents.filter((i) => i.status !== "resuelta").length)} icon={<Wrench />} />
        <Kpi title="Criticas/altas" value={String(criticalOpen)} icon={<AlertTriangle />} danger={criticalOpen > 0} />
        <Kpi title="Caso piloto" value="1 cliente" icon={<Users />} />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="grid gap-4">
          {steps.map((step, index) => {
            const isDone = Boolean(checked[step.id]);
            return (
              <article
                key={step.id}
                className={`rounded-[24px] border p-5 transition ${
                  isDone
                    ? "border-emerald-400/30 bg-emerald-500/10"
                    : "border-slate-800 bg-[#07111f]"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <button
                      type="button"
                      onClick={() => toggleStep(step.id)}
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                        isDone
                          ? "border-emerald-400/40 bg-emerald-400 text-slate-950"
                          : "border-cyan-400/25 bg-cyan-400/10 text-cyan-200"
                      }`}
                      title={isDone ? "Marcar pendiente" : "Marcar completado"}
                    >
                      {isDone ? <CheckCircle2 size={22} /> : step.icon}
                    </button>

                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                        Paso {index + 1} / {step.area}
                      </p>
                      <h3 className="mt-1 text-xl font-black">{step.title}</h3>
                      <p className="mt-2 text-sm font-semibold text-slate-400">{step.objective}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                        <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
                          Responsable: {step.owner}
                        </span>
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">
                          Evidencia: {step.evidence}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={step.route}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-400/20"
                  >
                    Abrir modulo
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-slate-800 bg-[#07111f] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Bitacora</h2>
              <button
                type="button"
                onClick={resetPilot}
                className="rounded-xl border border-red-400/30 bg-red-500/10 p-2 text-red-100 hover:bg-red-500/20"
                title="Reiniciar piloto"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {incidents.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                        {item.area} / {item.severity}
                      </p>
                      <p className="mt-2 text-sm font-bold text-slate-200">{item.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateIncident(item.id, "resuelta")}
                      className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-2 text-emerald-100"
                      title="Marcar resuelta"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <select
                    value={item.status}
                    onChange={(event) => updateIncident(item.id, event.target.value as Incident["status"])}
                    className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-white"
                  >
                    <option value="abierta">Abierta</option>
                    <option value="revisando">Revisando</option>
                    <option value="resuelta">Resuelta</option>
                  </select>
                </div>
              ))}

              {incidents.length === 0 ? (
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
                  Sin incidencias registradas.
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none focus:border-cyan-400"
      />
    </label>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-black ${accent ? "text-emerald-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

function Kpi({
  title,
  value,
  icon,
  danger,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-slate-800 bg-[#07111f] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{title}</p>
          <p className={`mt-3 text-3xl font-black ${danger ? "text-red-300" : "text-white"}`}>{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
          danger ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-cyan-400/25 bg-cyan-400/10 text-cyan-200"
        }`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
