
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ImageIcon,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Truck,
  UploadCloud,
  UserRound,
  Wrench,
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
  progress?: number | null;
  created_at?: string | null;
};

type MediaFile = {
  id?: string;
  project_id: string;
  module: string;
  reference_id?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  description?: string | null;
  uploaded_by?: string | null;
  created_at?: string | null;
};

type TransportEvent = {
  id?: string;
  project_id: string;
  driver_name?: string | null;
  driver_email?: string | null;
  driver_phone?: string | null;
  vehicle?: string | null;
  event_type: string;
  event_status?: string | null;
  location_text?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  gps_accuracy?: number | null;
  client_contact_name?: string | null;
  client_contact_phone?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type InstallationPlan = {
  id?: string;
  project_id: string;
  plan_name?: string | null;
  plan_url?: string | null;
  plan_type?: string | null;
  uploaded_by?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type InstallationScan = {
  id?: string;
  project_id: string;
  module_code?: string | null;
  module_name?: string | null;
  qr_value?: string | null;
  scanned_by?: string | null;
  installer_name?: string | null;
  scan_status?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  installed_at?: string | null;
};

type VerificationIssue = {
  id?: string;
  project_id: string;
  issue_title: string;
  issue_type?: string | null;
  severity?: string | null;
  status?: string | null;
  reported_by?: string | null;
  assigned_to?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  resolution_notes?: string | null;
  created_at?: string | null;
};

type DeliverySignature = {
  id?: string;
  project_id: string;
  received_by?: string | null;
  client_document?: string | null;
  client_phone?: string | null;
  signature_data?: string | null;
  delivery_photo_url?: string | null;
  warranty_notes?: string | null;
  final_notes?: string | null;
  delivered_by?: string | null;
  delivered_at?: string | null;
};

function projectCode(project: Project) {
  return project.code || project.project_code || `PRO-${project.id.slice(0, 8)}`;
}

function projectName(project: Project) {
  return project.name || project.project_name || project.title || "Proyecto sin nombre";
}

async function uploadProjectFile(projectId: string, moduleName: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${projectId}/${moduleName}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("project-files")
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from("project-files").getPublicUrl(path);

  return {
    url: data.publicUrl,
    name: file.name,
    type: file.type,
  };
}

async function saveMedia(projectId: string, moduleName: string, fileData: { url: string; name: string; type: string }, description: string, referenceId?: string) {
  await supabase.from("project_media_files").insert({
    project_id: projectId,
    module: moduleName,
    reference_id: referenceId || null,
    file_url: fileData.url,
    file_name: fileData.name,
    file_type: fileData.type,
    description,
    uploaded_by: "RD WOOD USER",
  });
}

function StatusBadge({ value }: { value?: string | null }) {
  const v = String(value || "pendiente");
  const done = ["completado", "aprobado", "entregado", "instalado", "resuelto"].includes(v);

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase",
        done
          ? "bg-emerald-500/10 text-emerald-300"
          : v === "pendiente" || v === "abierto"
          ? "bg-yellow-500/10 text-yellow-300"
          : "bg-cyan-500/10 text-cyan-300",
      ].join(" ")}
    >
      {done ? <CheckCircle2 size={14} /> : <BadgeCheck size={14} />}
      {v}
    </span>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        {label}
      </label>
      <textarea
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
      />
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
      <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
        {title}
      </div>
      <div className="mt-4 text-3xl font-black text-white">{value}</div>
    </div>
  );
}

function ProjectCard({
  project,
  active,
  status,
  onClick,
}: {
  project: Project;
  active: boolean;
  status?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full rounded-3xl border p-5 text-left transition",
        active
          ? "border-cyan-400 bg-cyan-500/10"
          : "border-slate-800 bg-slate-950 hover:border-cyan-500/40",
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
            {projectCode(project)}
          </div>
          <h3 className="mt-2 text-xl font-black text-white">
            {projectName(project)}
          </h3>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
            <span className="inline-flex items-center gap-2">
              <UserRound size={15} />
              {project.client_name || "Cliente general"}
            </span>
            <span className="inline-flex items-center gap-2">
              <Phone size={15} />
              {project.client_phone || "Sin teléfono"}
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin size={15} />
              {project.location || "Sin dirección"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge value={status || project.status || "pendiente"} />
          <ArrowRight className="text-cyan-300" size={22} />
        </div>
      </div>
    </button>
  );
}

function EmptySelect({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
      <div className="text-slate-600">{icon}</div>
      <h3 className="mt-5 text-2xl font-black">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">
        Selecciona un proyecto para trabajar esta fase.
      </p>
    </div>
  );
}

export default function TransportePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<TransportEvent[]>([]);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [form, setForm] = useState<TransportEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);

  const loadPhotoRef = useRef<HTMLInputElement | null>(null);
  const deliveryPhotoRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsMessage, setGpsMessage] = useState("");

  async function getGps() {
    setGpsMessage("");
    if (!navigator.geolocation) {
      setGpsMessage("GPS no disponible en este navegador.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsMessage(`GPS capturado: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
      },
      (err) => setGpsMessage("GPS no disponible: " + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  useEffect(() => {
    loadData();
    getGps();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: p } = await supabase
      .from("furniture_projects")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: e } = await supabase
      .from("project_transport_events")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: m } = await supabase
      .from("project_media_files")
      .select("*")
      .eq("module", "transporte")
      .order("created_at", { ascending: false });

    setProjects((p || []) as Project[]);
    setEvents((e || []) as TransportEvent[]);
    setMedia((m || []) as MediaFile[]);
    setLoading(false);
  }

  function currentEvent(projectId: string) {
    return events.find((event) => event.project_id === projectId) || null;
  }

  function selectProject(project: Project) {
    const current = currentEvent(project.id);

    setSelected(project);
    setForm(
      current || {
        project_id: project.id,
        driver_name: "",
        driver_email: "",
        driver_phone: "",
        vehicle: "",
        event_type: "carga",
        event_status: "pendiente",
        location_text: project.location || "",
        client_contact_name: project.client_name || "",
        client_contact_phone: project.client_phone || "",
        notes: "",
      }
    );
  }

  async function saveEvent() {
    if (!selected || !form) return;

    setSaving(true);

    const payload = {
      project_id: selected.id,
      driver_name: form.driver_name || null,
      driver_email: form.driver_email || null,
      driver_phone: form.driver_phone || null,
      vehicle: form.vehicle || null,
      event_type: form.event_type || "carga",
      event_status: form.event_status || "pendiente",
      location_text: form.location_text || null,
      gps_lat: gps?.lat || form.gps_lat || null,
      gps_lng: gps?.lng || form.gps_lng || null,
      gps_accuracy: gps?.accuracy || form.gps_accuracy || null,
      client_contact_name: form.client_contact_name || null,
      client_contact_phone: form.client_contact_phone || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };

    if (form.id) {
      const { error } = await supabase
        .from("project_transport_events")
        .update(payload)
        .eq("id", form.id);

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("project_transport_events")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        alert(error.message);
        setSaving(false);
        return;
      }

      setForm({ ...form, id: data.id });
    }

    alert("✅ Transporte guardado");
    setSaving(false);
    await loadData();
  }


  async function entregarAInstalacion() {
    if (!selected) return;

    const ok = window.confirm(
      "¿Confirmas que el proyecto fue entregado en obra y debe pasar a Instalación?"
    );

    if (!ok) return;

    setHandoffLoading(true);

    try {
      const now = new Date().toISOString();

      // 1) Actualizar / crear evento de transporte como completado
      const payload = {
        project_id: selected.id,
        driver_name: form?.driver_name || null,
        driver_email: form?.driver_email || null,
        driver_phone: form?.driver_phone || null,
        vehicle: form?.vehicle || null,
        event_type: "entrega_instalacion",
        event_status: "completado",
        location_text: form?.location_text || selected.location || null,
        gps_lat: gps?.lat || form?.gps_lat || null,
        gps_lng: gps?.lng || form?.gps_lng || null,
        gps_accuracy: gps?.accuracy || form?.gps_accuracy || null,
        delivered_at: now,
        updated_at: now,
        client_contact_name: form?.client_contact_name || selected.client_name || null,
        client_contact_phone: form?.client_contact_phone || selected.client_phone || null,
        notes: [
          form?.notes || "",
          `Entregado a instalación el ${new Date(now).toLocaleString("es-DO")}.`,
        ]
          .filter(Boolean)
          .join("\n"),
      };

      if (form?.id) {
        const { error } = await supabase
          .from("project_transport_events")
          .update(payload)
          .eq("id", form.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("project_transport_events")
          .insert(payload)
          .select("*")
          .single();

        if (error) throw error;
        setForm({ ...(form || payload), id: data.id, ...payload });
      }

      // 2) Cambiar proyecto a instalación
      try {
        await supabase
          .from("furniture_projects")
          .update({
            status: "instalacion",
            progress: 75,
          })
          .eq("id", selected.id);
      } catch {}

      // 3) Intentar actualizar production_orders si existe relación por project_id
      try {
        await supabase
          .from("production_orders")
          .update({
            status: "installation_pending",
          })
          .eq("project_id", selected.id);
      } catch {}

      // 4) Crear plan básico de instalación si la tabla existe
      try {
        await supabase.from("project_installation_plans").insert({
          project_id: selected.id,
          plan_name: `Instalación pendiente · ${projectName(selected)}`,
          plan_type: "handoff_transport",
          uploaded_by: form?.driver_name || "Transportación",
          notes: `Proyecto entregado por transportación el ${new Date(now).toLocaleString("es-DO")}.`,
        });
      } catch {}

      // 5) Registrar evento auditable general en historial de piezas si aplica
      try {
        await supabase.from("piece_tracking_history").insert({
          piece_code: projectCode(selected),
          label_code: projectCode(selected),
          order_code: projectCode(selected),
          piece_name: projectName(selected),
          module_name: "Transporte",
          previous_status: "en_ruta",
          new_status: "entrega_instalacion",
          department: "transporte",
          operator_name: form?.driver_name || "Chofer",
          notes: `Transporte completado y entregado a instalación. ${form?.notes || ""}`,
          payload: {
            project_id: selected.id,
            gps,
            vehicle: form?.vehicle || "",
            driver_phone: form?.driver_phone || "",
            source: "fase_39_transporte_entrega",
          },
          scanned_at: now,
          device_name: "Campo / Transporte",
          scan_source: "transport_delivery",
        });
      } catch {}

      alert("✅ Proyecto entregado a Instalación correctamente.");

      await loadData();

      setSelected((old) =>
        old
          ? {
              ...old,
              status: "instalacion",
              progress: 75,
            }
          : old
      );

      setForm((old) =>
        old
          ? {
              ...old,
              event_type: "entrega_instalacion",
              event_status: "completado",
            }
          : old
      );
    } catch (error: any) {
      alert(`Error entregando a instalación: ${error?.message || error}`);
    } finally {
      setHandoffLoading(false);
    }
  }

  async function uploadPhoto(file: File, description: string) {
    if (!selected) return;

    setSaving(true);

    try {
      const data = await uploadProjectFile(selected.id, "transporte", file);
      await saveMedia(selected.id, "transporte", data, description, form?.id);
      alert("✅ Foto subida");
      await loadData();
    } catch (error: any) {
      alert(`Error subiendo foto: ${error.message || error}`);
    }

    setSaving(false);
  }

  function update(key: keyof TransportEvent, value: string) {
    if (!form) return;
    setForm({ ...form, [key]: value });
  }

  const filtered = useMemo(() => {
    const t = search.toLowerCase().trim();
    if (!t) return projects;
    return projects.filter((p) =>
      [projectCode(p), projectName(p), p.client_name, p.client_phone, p.location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(t)
    );
  }, [projects, search]);

  const selectedMedia = media.filter((m) => m.project_id === selected?.id);

  return (
    <div className="min-h-screen bg-[#020617] p-6 text-white">
      <div className="mx-auto max-w-[1700px]">
        <Header icon={<Truck size={38} />} title="Transporte y Entrega PRO" subtitle="GPS del chofer, fotos de carga, entrega en ubicación y handoff directo a instalación." onRefresh={loadData} />

        <section className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4">
          <Stat title="Proyectos" value={projects.length} />
          <Stat title="Con transporte" value={events.length} />
          <Stat title="Fotos" value={media.length} />
          <Stat title="Entregados a instalación" value={events.filter((e) => e.event_type === "entrega_instalacion" || e.event_status === "completado").length} />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_560px]">
          <ProjectList title="Proyectos para despacho" search={search} setSearch={setSearch} loading={loading}>
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                active={selected?.id === project.id}
                status={currentEvent(project.id)?.event_status || "pendiente"}
                onClick={() => selectProject(project)}
              />
            ))}
          </ProjectList>

          <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
            {!selected || !form ? (
              <EmptySelect icon={<Truck size={64} />} title="Selecciona un proyecto" />
            ) : (
              <>
                <PanelProjectHeader project={selected} />

                <div className="space-y-4">
                  <Select label="Evento" value={form.event_type} options={["carga_taller", "salida_ruta", "en_ruta", "entrega_ubicacion", "entrega_instalacion", "retorno"]} onChange={(v) => update("event_type", v)} />
                  <Select label="Estado" value={form.event_status || "pendiente"} options={["pendiente", "programado", "cargando", "en_ruta", "en_ubicacion", "completado"]} onChange={(v) => update("event_status", v)} />

                  <Input label="Chofer" value={form.driver_name || ""} onChange={(v) => update("driver_name", v)} />
                  <Input label="Teléfono chofer" value={form.driver_phone || ""} onChange={(v) => update("driver_phone", v)} />
                  <Input label="Vehículo" value={form.vehicle || ""} onChange={(v) => update("vehicle", v)} />
                  <Input label="Contacto cliente" value={form.client_contact_name || ""} onChange={(v) => update("client_contact_name", v)} />
                  <Input label="Teléfono cliente" value={form.client_contact_phone || ""} onChange={(v) => update("client_contact_phone", v)} />
                  <Input label="Ubicación / dirección" value={form.location_text || ""} onChange={(v) => update("location_text", v)} />
                  <Textarea label="Notas del chofer" value={form.notes || ""} onChange={(v) => update("notes", v)} />

                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">GPS del chofer</div>
                        <div className="mt-1 text-sm font-bold text-white">
                          {gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : "No capturado"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={getGps}
                        className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-200"
                      >
                        Capturar GPS
                      </button>
                    </div>
                    {gpsMessage && <div className="text-xs font-bold text-cyan-200">{gpsMessage}</div>}
                  </div>

                  <button onClick={saveEvent} disabled={saving} className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-4 text-sm font-black uppercase text-white disabled:opacity-60">
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Guardar transporte
                  </button>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        form.location_text || selected.location || ""
                      )}`}
                      target="_blank"
                      className="inline-flex items-center justify-center gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-4 text-sm font-black uppercase text-cyan-200 hover:bg-cyan-500/20"
                    >
                      <MapPin size={18} />
                      Abrir Maps
                    </a>

                    <button
                      onClick={entregarAInstalacion}
                      disabled={handoffLoading}
                      className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-5 py-4 text-sm font-black uppercase text-white shadow-lg shadow-emerald-950/30 disabled:opacity-60"
                    >
                      {handoffLoading ? <Loader2 className="animate-spin" size={18} /> : <Wrench size={18} />}
                      Entregar a Instalación
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button onClick={() => loadPhotoRef.current?.click()} className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 font-black text-cyan-200">
                      <Camera className="mx-auto mb-2" /> Foto cargando
                    </button>
                    <button onClick={() => deliveryPhotoRef.current?.click()} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 font-black text-emerald-200">
                      <MapPin className="mx-auto mb-2" /> Foto en ubicación
                    </button>
                  </div>

                  <input ref={loadPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0], "Foto de carga en taller")} />
                  <input ref={deliveryPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0], "Foto de entrega en ubicación")} />

                  <MediaGrid files={selectedMedia} />
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Header({
  icon,
  title,
  subtitle,
  onRefresh,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-[34px] border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-[#07111f] to-blue-900 p-8 shadow-2xl shadow-black/40">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-500/10 text-cyan-300">
            {icon}
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
              RD WOOD SYSTEM · FASE 39
            </div>
            <h1 className="mt-2 text-4xl font-black lg:text-5xl">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-300">{subtitle}</p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-7 py-4 text-sm font-black uppercase tracking-wide text-slate-950"
        >
          <RefreshCw size={18} />
          Actualizar
        </button>
      </div>
    </section>
  );
}

function ProjectList({
  title,
  search,
  setSearch,
  loading,
  children,
}: {
  title: string;
  search: string;
  setSearch: (value: string) => void;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="text-sm text-slate-400">Selecciona un proyecto para trabajar.</p>
        </div>

        <div className="relative w-full lg:w-[360px]">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar proyecto..."
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center">
          <Loader2 className="animate-spin text-cyan-300" size={44} />
        </div>
      ) : (
        <div className="space-y-4">{children}</div>
      )}
    </div>
  );
}

function PanelProjectHeader({ project }: { project: Project }) {
  return (
    <div className="mb-6 rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
      <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
        {projectCode(project)}
      </div>
      <h2 className="mt-2 text-2xl font-black">{projectName(project)}</h2>
      <div className="mt-3 grid gap-2 text-sm text-slate-300">
        <span className="inline-flex items-center gap-2">
          <UserRound size={15} />
          {project.client_name || "Cliente general"}
        </span>
        <span className="inline-flex items-center gap-2">
          <Phone size={15} />
          {project.client_phone || "Sin teléfono"}
        </span>
        <span className="inline-flex items-center gap-2">
          <MapPin size={15} />
          {project.location || "Sin dirección"}
        </span>
      </div>
    </div>
  );
}

function MediaGrid({ files }: { files: MediaFile[] }) {
  if (!files.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">
        Sin fotos todavía.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {files.map((file) => (
        <a key={file.id} href={file.file_url || "#"} target="_blank" className="rounded-2xl border border-slate-800 bg-slate-950 p-2">
          {file.file_type?.startsWith("image") ? (
            <img src={file.file_url || ""} className="h-28 w-full rounded-xl object-cover" />
          ) : (
            <div className="flex h-28 items-center justify-center rounded-xl bg-[#020617]">
              <FileText className="text-cyan-300" />
            </div>
          )}
          <div className="mt-2 truncate text-xs font-bold text-slate-400">{file.description || file.file_name}</div>
        </a>
      ))}
    </div>
  );
}
