"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck, Boxes, Camera, CheckCircle2, Loader2, Plus, QrCode,
  RefreshCw, Save, Search, UserRound
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
  status?: string | null;
  created_at?: string | null;
};

type ModuleQR = {
  id?: string;
  project_id: string;
  module_code: string;
  module_name?: string | null;
  module_type?: string | null;
  material?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  depth_mm?: number | null;
  qr_value: string;
  qr_url?: string | null;
  production_status?: string | null;
  transport_status?: string | null;
  installation_status?: string | null;
  verification_status?: string | null;
  delivery_status?: string | null;
  loaded_by?: string | null;
  installed_by?: string | null;
  verified_by?: string | null;
  delivered_by?: string | null;
  notes?: string | null;
};

type QREvent = {
  id?: string;
  project_id: string;
  module_tracking_id?: string | null;
  module_code?: string | null;
  qr_value?: string | null;
  event_type: string;
  event_status?: string | null;
  user_name?: string | null;
  user_role?: string | null;
  photo_url?: string | null;
  location_text?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

const DEFAULT_MODULES = [
  { name: "Base fregadero", type: "base_sink", width: 800, height: 720, depth: 560 },
  { name: "Base gavetero", type: "base_drawer", width: 600, height: 720, depth: 560 },
  { name: "Base estufa", type: "base_stove", width: 800, height: 720, depth: 560 },
  { name: "Torre nevera", type: "tall_fridge", width: 700, height: 2200, depth: 650 },
  { name: "Aéreo superior 1", type: "upper_cabinet", width: 800, height: 700, depth: 350 },
  { name: "Aéreo superior 2", type: "upper_cabinet", width: 800, height: 700, depth: 350 },
];

export default function QRModulosPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<ModuleQR[]>([]);
  const [events, setEvents] = useState<QREvent[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedModule, setSelectedModule] = useState<ModuleQR | null>(null);
  const [search, setSearch] = useState("");
  const [qrInput, setQrInput] = useState("");
  const [eventType, setEventType] = useState("instalacion");
  const [eventStatus, setEventStatus] = useState("instalado");
  const [userName, setUserName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: projectData } = await supabase.from("furniture_projects").select("*").order("created_at", { ascending: false });
    const { data: moduleData } = await supabase.from("project_module_qr_tracking").select("*").order("created_at", { ascending: false });
    const { data: eventData } = await supabase.from("project_module_qr_events").select("*").order("created_at", { ascending: false });
    setProjects((projectData || []) as Project[]);
    setModules((moduleData || []) as ModuleQR[]);
    setEvents((eventData || []) as QREvent[]);
    setLoading(false);
  }

  function projectCode(project: Project) {
    return project.code || project.project_code || `PRO-${project.id.slice(0, 8)}`;
  }

  function projectName(project: Project) {
    return project.name || project.project_name || project.title || "Proyecto sin nombre";
  }

  function currentModules() {
    if (!selectedProject) return [];
    return modules.filter((m) => m.project_id === selectedProject.id);
  }

  function eventsForModule() {
    if (!selectedModule) return [];
    return events.filter((e) => e.module_tracking_id === selectedModule.id);
  }

  async function generateDefaultModules() {
    if (!selectedProject) return alert("Selecciona un proyecto.");
    setSaving(true);
    const existing = currentModules();
    const start = existing.length + 1;

    const rows = DEFAULT_MODULES.map((m, index) => {
      const num = String(start + index).padStart(4, "0");
      const moduleCode = `MOD-${num}`;
      const qrValue = `RDWOOD|PROJECT:${selectedProject.id}|MODULE:${moduleCode}`;
      return {
        project_id: selectedProject.id,
        module_code: moduleCode,
        module_name: m.name,
        module_type: m.type,
        material: "Melamina 18mm",
        width_mm: m.width,
        height_mm: m.height,
        depth_mm: m.depth,
        qr_value: qrValue,
        qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrValue)}`,
        production_status: "generado",
        transport_status: "pendiente",
        installation_status: "pendiente",
        verification_status: "pendiente",
        delivery_status: "pendiente",
      };
    });

    const { error } = await supabase.from("project_module_qr_tracking").insert(rows);
    setSaving(false);
    if (error) return alert(error.message);
    alert("✅ Módulos QR generados");
    await loadData();
  }

  async function createManualModule() {
    if (!selectedProject) return alert("Selecciona un proyecto.");
    const count = currentModules().length + 1;
    const moduleCode = `MOD-${String(count).padStart(4, "0")}`;
    const qrValue = `RDWOOD|PROJECT:${selectedProject.id}|MODULE:${moduleCode}`;

    setSaving(true);
    const { error } = await supabase.from("project_module_qr_tracking").insert({
      project_id: selectedProject.id,
      module_code: moduleCode,
      module_name: "Módulo nuevo",
      module_type: "custom",
      material: "Melamina 18mm",
      width_mm: 0,
      height_mm: 0,
      depth_mm: 0,
      qr_value: qrValue,
      qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrValue)}`,
      production_status: "generado",
      transport_status: "pendiente",
      installation_status: "pendiente",
      verification_status: "pendiente",
      delivery_status: "pendiente",
    });
    setSaving(false);
    if (error) return alert(error.message);
    alert("✅ Módulo creado");
    await loadData();
  }

  function findModuleByQR() {
    const value = qrInput.trim();
    if (!value) return alert("Escanea o pega el QR.");

    const found = modules.find((m) =>
      m.qr_value === value ||
      m.module_code.toLowerCase() === value.toLowerCase() ||
      value.includes(m.module_code)
    );

    if (!found) return alert("No encontré ese módulo QR.");
    const project = projects.find((p) => p.id === found.project_id);
    if (project) setSelectedProject(project);
    setSelectedModule(found);
  }

  async function uploadProjectFile(projectId: string, file: File) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${projectId}/qr-events/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("project-files").upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });
    if (error) throw error;
    const { data } = supabase.storage.from("project-files").getPublicUrl(path);
    return data.publicUrl;
  }

  async function registerEvent(photoFile?: File) {
    if (!selectedProject || !selectedModule) return alert("Selecciona proyecto y módulo.");
    setSaving(true);

    try {
      let photoUrl = "";
      if (photoFile) photoUrl = await uploadProjectFile(selectedProject.id, photoFile);

      const updatePayload: any = {};
      if (eventType === "transporte") {
        updatePayload.transport_status = eventStatus;
        updatePayload.loaded_by = userName || null;
        updatePayload.loaded_at = new Date().toISOString();
      }
      if (eventType === "instalacion") {
        updatePayload.installation_status = eventStatus;
        updatePayload.installed_by = userName || null;
        updatePayload.installed_at = new Date().toISOString();
      }
      if (eventType === "verificacion") {
        updatePayload.verification_status = eventStatus;
        updatePayload.verified_by = userName || null;
        updatePayload.verified_at = new Date().toISOString();
      }
      if (eventType === "entrega") {
        updatePayload.delivery_status = eventStatus;
        updatePayload.delivered_by = userName || null;
        updatePayload.delivered_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("project_module_qr_tracking")
        .update({ ...updatePayload, updated_at: new Date().toISOString() })
        .eq("id", selectedModule.id);
      if (updateError) throw updateError;

      const { error: eventError } = await supabase.from("project_module_qr_events").insert({
        project_id: selectedProject.id,
        module_tracking_id: selectedModule.id,
        module_code: selectedModule.module_code,
        qr_value: selectedModule.qr_value,
        event_type: eventType,
        event_status: eventStatus,
        user_name: userName || null,
        user_role: eventType,
        photo_url: photoUrl || null,
        notes: notes || null,
      });
      if (eventError) throw eventError;

      alert("✅ Evento QR registrado");
      setNotes("");
      await loadData();

      setSelectedModule((prev) => prev ? { ...prev, ...updatePayload } : prev);
    } catch (error: any) {
      alert(`Error registrando QR: ${error.message || error}`);
    }

    setSaving(false);
  }

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((p) =>
      [projectCode(p), projectName(p), p.client_name, p.client_phone, p.location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [projects, search]);

  const stats = useMemo(() => ({
    proyectos: projects.length,
    modulos: modules.length,
    eventos: events.length,
    instalados: modules.filter((m) => m.installation_status === "instalado").length,
  }), [projects, modules, events]);

  return (
    <div className="min-h-screen bg-[#020617] p-6 text-white">
      <div className="mx-auto max-w-[1800px]">
        <section className="rounded-[34px] border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-[#07111f] to-blue-900 p-8 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-500/10 text-cyan-300">
                <QrCode size={40} />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">RD WOOD SYSTEM · FASE 5.3</div>
                <h1 className="mt-2 text-4xl font-black lg:text-5xl">QR Real por Módulo</h1>
                <p className="mt-2 max-w-4xl text-sm font-medium text-slate-300">
                  Trazabilidad completa: producción, transporte, instalación, verificación y entrega por cada módulo.
                </p>
              </div>
            </div>
            <button onClick={loadData} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-7 py-4 text-sm font-black uppercase tracking-wide text-slate-950">
              <RefreshCw size={18} /> Actualizar
            </button>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4">
          <Stat title="Proyectos" value={stats.proyectos} />
          <Stat title="Módulos QR" value={stats.modulos} />
          <Stat title="Eventos" value={stats.eventos} />
          <Stat title="Instalados" value={stats.instalados} />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[430px_1fr_500px]">
          <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
            <h2 className="text-2xl font-black">Proyectos</h2>
            <p className="text-sm text-slate-400">Selecciona proyecto.</p>
            <div className="relative my-5">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proyecto..." className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
            </div>
            {loading ? (
              <div className="flex h-80 items-center justify-center"><Loader2 className="animate-spin text-cyan-300" size={44} /></div>
            ) : (
              <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
                {filteredProjects.map((project) => (
                  <button key={project.id} onClick={() => { setSelectedProject(project); setSelectedModule(null); }} className={[
                    "w-full rounded-3xl border p-4 text-left transition",
                    selectedProject?.id === project.id ? "border-cyan-400 bg-cyan-500/10" : "border-slate-800 bg-slate-950 hover:border-cyan-500/40",
                  ].join(" ")}>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{projectCode(project)}</div>
                    <div className="mt-2 text-lg font-black">{projectName(project)}</div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-400"><UserRound size={14} />{project.client_name || "Cliente general"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
            {!selectedProject ? (
              <div className="flex min-h-[620px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
                <Boxes className="text-slate-600" size={70} />
                <h3 className="mt-5 text-2xl font-black">Selecciona un proyecto</h3>
              </div>
            ) : (
              <>
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{projectCode(selectedProject)}</div>
                    <h2 className="mt-2 text-3xl font-black">{projectName(selectedProject)}</h2>
                    <p className="mt-1 text-sm text-slate-400">{selectedProject.client_name || "Cliente general"}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={generateDefaultModules} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-4 text-sm font-black uppercase">
                      <QrCode size={18} /> Generar base
                    </button>
                    <button onClick={createManualModule} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 px-5 py-4 text-sm font-black uppercase">
                      <Plus size={18} /> Manual
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {currentModules().map((module) => (
                    <button key={module.id} onClick={() => setSelectedModule(module)} className={[
                      "rounded-3xl border p-5 text-left transition",
                      selectedModule?.id === module.id ? "border-cyan-400 bg-cyan-500/10" : "border-slate-800 bg-slate-950 hover:border-cyan-500/40",
                    ].join(" ")}>
                      <div className="flex gap-4">
                        <img src={module.qr_url || ""} alt={module.module_code} className="h-24 w-24 rounded-2xl bg-white p-2" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">{module.module_code}</div>
                          <h3 className="mt-1 text-xl font-black">{module.module_name || "Módulo sin nombre"}</h3>
                          <p className="mt-1 text-xs text-slate-400">{module.width_mm} x {module.height_mm} x {module.depth_mm} mm</p>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-black uppercase">
                            <MiniStatus label="Transp." value={module.transport_status} />
                            <MiniStatus label="Inst." value={module.installation_status} />
                            <MiniStatus label="Verif." value={module.verification_status} />
                            <MiniStatus label="Entrega" value={module.delivery_status} />
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
            <h2 className="text-2xl font-black">Escaneo / Evento QR</h2>
            <p className="mt-1 text-sm text-slate-400">Pega código QR o selecciona módulo.</p>

            <div className="mt-5 space-y-4">
              <div className="flex gap-2">
                <input value={qrInput} onChange={(e) => setQrInput(e.target.value)} placeholder="Pega QR o MOD-0001..." className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
                <button onClick={findModuleByQR} className="rounded-2xl bg-cyan-600 px-5 py-4 font-black">Buscar</button>
              </div>

              {selectedModule ? (
                <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                  <img src={selectedModule.qr_url || ""} className="mx-auto h-44 w-44 rounded-2xl bg-white p-3" />
                  <div className="mt-4 text-center">
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{selectedModule.module_code}</div>
                    <h3 className="mt-1 text-2xl font-black">{selectedModule.module_name}</h3>
                    <p className="mt-1 text-sm text-slate-400">{selectedModule.material}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950 p-10 text-center">
                  <QrCode className="mx-auto text-slate-600" size={60} />
                  <div className="mt-4 text-xl font-black">Sin módulo seleccionado</div>
                </div>
              )}

              <Select label="Tipo evento" value={eventType} options={["transporte", "instalacion", "verificacion", "entrega"]} onChange={setEventType} />
              <Select label="Estado" value={eventStatus} options={
                eventType === "transporte" ? ["cargado", "en_ruta", "entregado_ubicacion", "incidente"] :
                eventType === "instalacion" ? ["instalado", "pendiente_ajuste", "roto", "faltante"] :
                eventType === "verificacion" ? ["aprobado", "rechazado", "corregir", "resuelto"] :
                ["entregado", "pendiente", "garantia"]
              } onChange={setEventStatus} />
              <Input label="Usuario / responsable" value={userName} onChange={setUserName} />
              <Textarea label="Notas" value={notes} onChange={setNotes} />

              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) registerEvent(file); }} />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <button onClick={() => registerEvent()} disabled={saving} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4 text-sm font-black uppercase disabled:opacity-60">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Guardar
                </button>
                <button onClick={() => fileInputRef.current?.click()} disabled={saving} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-6 py-4 text-sm font-black uppercase disabled:opacity-60">
                  <Camera size={18} /> Con foto
                </button>
              </div>

              {selectedModule && (
                <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                  <h3 className="mb-4 text-xl font-black">Historial</h3>
                  <div className="space-y-3">
                    {eventsForModule().map((event) => (
                      <div key={event.id} className="rounded-2xl border border-slate-800 bg-[#020617] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-black text-white">{event.event_type} · {event.event_status}</div>
                            <div className="text-xs text-slate-500">{event.user_name || "Sin usuario"} · {event.created_at ? new Date(event.created_at).toLocaleString("es-DO") : ""}</div>
                          </div>
                          <StatusBadge value={event.event_status} />
                        </div>
                        {event.photo_url && <img src={event.photo_url} className="mt-3 h-32 w-full rounded-xl object-cover" />}
                        {event.notes && <p className="mt-3 text-sm text-slate-300">{event.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return <div className="rounded-[28px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30"><div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{title}</div><div className="mt-4 text-3xl font-black text-white">{value}</div></div>;
}

function MiniStatus({ label, value }: { label: string; value?: string | null }) {
  const done = ["cargado", "instalado", "aprobado", "entregado"].includes(String(value || ""));
  return <div className={(done ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-800 text-slate-400") + " rounded-xl px-3 py-2"}><div className="text-[10px] text-slate-500">{label}</div><div className="truncate">{value || "pendiente"}</div></div>;
}

function StatusBadge({ value }: { value?: string | null }) {
  const v = String(value || "pendiente");
  const done = ["cargado", "instalado", "aprobado", "entregado", "resuelto"].includes(v);
  return <span className={(done ? "bg-emerald-500/10 text-emerald-300" : "bg-cyan-500/10 text-cyan-300") + " inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase"}>{done ? <CheckCircle2 size={14} /> : <BadgeCheck size={14} />}{v}</span>;
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label><input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400" /></div>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <div><label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400">{options.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>;
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</label><textarea value={value} rows={4} onChange={(e) => onChange(e.target.value)} className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400" /></div>;
}
