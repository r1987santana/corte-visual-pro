
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

export default function EntregaPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [signatures, setSignatures] = useState<DeliverySignature[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [deliveryPhoto, setDeliveryPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<DeliverySignature>({
    project_id: "",
    received_by: "",
    client_document: "",
    client_phone: "",
    signature_data: "",
    warranty_notes: "",
    final_notes: "",
    delivered_by: "",
  });

  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: p } = await supabase.from("furniture_projects").select("*").order("created_at", { ascending: false });
    const { data: s } = await supabase.from("project_delivery_signatures").select("*").order("created_at", { ascending: false });
    setProjects((p || []) as Project[]);
    setSignatures((s || []) as DeliverySignature[]);
    setLoading(false);
  }

  function existing(projectId: string) {
    return signatures.find((s) => s.project_id === projectId) || null;
  }

  function selectProject(project: Project) {
    const current = existing(project.id);

    setSelected(project);
    setForm(
      current || {
        project_id: project.id,
        received_by: project.client_name || "",
        client_document: "",
        client_phone: project.client_phone || "",
        signature_data: "",
        warranty_notes: "Garantía limitada por fabricación e instalación según acuerdo del proyecto.",
        final_notes: "",
        delivered_by: "",
      }
    );
  }

  async function saveDelivery() {
    if (!selected) return;

    setSaving(true);

    try {
      let photoUrl = form.delivery_photo_url || "";

      if (deliveryPhoto) {
        const fileData = await uploadProjectFile(selected.id, "entrega", deliveryPhoto);
        photoUrl = fileData.url;
        await saveMedia(selected.id, "entrega", fileData, "Foto final de entrega");
      }

      const payload = {
        project_id: selected.id,
        received_by: form.received_by || null,
        client_document: form.client_document || null,
        client_phone: form.client_phone || null,
        signature_data: form.signature_data || null,
        delivery_photo_url: photoUrl || null,
        warranty_notes: form.warranty_notes || null,
        final_notes: form.final_notes || null,
        delivered_by: form.delivered_by || null,
        delivered_at: new Date().toISOString(),
      };

      if (form.id) {
        const { error } = await supabase.from("project_delivery_signatures").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_delivery_signatures").insert(payload);
        if (error) throw error;
      }

      await supabase.from("furniture_projects").update({ status: "entregado", progress: 100 }).eq("id", selected.id);

      alert("✅ Entrega registrada y proyecto cerrado");
      setDeliveryPhoto(null);
      await loadData();
    } catch (error: any) {
      alert(`Error guardando entrega: ${error.message || error}`);
    }

    setSaving(false);
  }

  function update(key: keyof DeliverySignature, value: string) {
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

  return (
    <div className="min-h-screen bg-[#020617] p-6 text-white">
      <div className="mx-auto max-w-[1700px]">
        <Header icon={<PackageCheck size={38} />} title="Entrega Cliente PRO" subtitle="Firma, foto final, garantía y cierre formal del proyecto." onRefresh={loadData} />

        <section className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          <Stat title="Proyectos" value={projects.length} />
          <Stat title="Entregas registradas" value={signatures.length} />
          <Stat title="Pendientes" value={projects.length - signatures.length} />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_620px]">
          <ProjectList title="Proyectos para entrega" search={search} setSearch={setSearch} loading={loading}>
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                active={selected?.id === project.id}
                status={existing(project.id) ? "entregado" : "pendiente"}
                onClick={() => selectProject(project)}
              />
            ))}
          </ProjectList>

          <div className="rounded-[30px] border border-slate-800 bg-[#07111f] p-6 shadow-2xl shadow-black/30">
            {!selected ? (
              <EmptySelect icon={<PackageCheck size={64} />} title="Selecciona un proyecto" />
            ) : (
              <>
                <PanelProjectHeader project={selected} />

                <div className="space-y-4">
                  <Input label="Recibido por" value={form.received_by || ""} onChange={(v) => update("received_by", v)} />
                  <Input label="Documento / cédula" value={form.client_document || ""} onChange={(v) => update("client_document", v)} />
                  <Input label="Teléfono cliente" value={form.client_phone || ""} onChange={(v) => update("client_phone", v)} />
                  <Input label="Entregado por" value={form.delivered_by || ""} onChange={(v) => update("delivered_by", v)} />
                  <Textarea label="Firma cliente escrita" value={form.signature_data || ""} onChange={(v) => update("signature_data", v)} />
                  <Textarea label="Garantía" value={form.warranty_notes || ""} onChange={(v) => update("warranty_notes", v)} />
                  <Textarea label="Notas finales" value={form.final_notes || ""} onChange={(v) => update("final_notes", v)} />

                  <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                    <h3 className="mb-4 flex items-center gap-2 text-xl font-black">
                      <ImageIcon className="text-cyan-300" /> Foto final
                    </h3>
                    {form.delivery_photo_url && <img src={form.delivery_photo_url} className="mb-3 h-40 w-full rounded-2xl object-cover" />}
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => setDeliveryPhoto(e.target.files?.[0] || null)} className="w-full rounded-2xl border border-slate-700 bg-[#020617] p-4 text-sm font-bold" />
                  </div>

                  <button onClick={saveDelivery} disabled={saving} className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-7 py-4 text-sm font-black uppercase text-white disabled:opacity-60">
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <PackageCheck size={18} />}
                    Firmar y cerrar proyecto
                  </button>
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
              RD WOOD SYSTEM · FASE 5.1
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
