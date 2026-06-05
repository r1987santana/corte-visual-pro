"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ImagePlus,
  Save,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Wrench,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Visit = {
  id: string;
  visit_code: string;
  ticket_id: string;
  ticket_code?: string | null;
  issue_title?: string | null;
  client_name?: string | null;
  project_name?: string | null;
  technician_name?: string | null;
  visit_status?: string | null;
  findings?: string | null;
  solution_applied?: string | null;
  parts_used?: string | null;
};

type LocalPhoto = {
  file: File;
  preview: string;
  stage: "antes" | "despues";
};

const STORAGE_BUCKET = "warranty-claims";

export default function TicketTechnicalExecutionPage() {
  const params = useParams();
  const ticketId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const [visit, setVisit] = useState<Visit | null>(null);
  const [findings, setFindings] = useState("");
  const [solution, setSolution] = useState("");
  const [parts, setParts] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [satisfaction, setSatisfaction] = useState(5);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadVisit();

    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  async function loadVisit() {
    const { data } = await supabase
      .from("v_after_sales_agenda_full")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setVisit(data as Visit);
      setFindings(data.findings || "");
      setSolution(data.solution_applied || "");
      setParts(data.parts_used || "");
    }
  }

  function handlePhotos(files: FileList | null, stage: "antes" | "despues") {
    if (!files) return;

    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 8)
      .map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        stage,
      }));

    setPhotos((prev) => [...prev, ...next].slice(0, 16));
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return copy;
    });
  }

  async function uploadPhotos(visitId: string, ticketId: string) {
    for (const item of photos) {
      const cleanName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `visits/${ticketId}/${visitId}/${item.stage}/${Date.now()}-${crypto.randomUUID()}-${cleanName}`;

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, item.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: item.file.type,
        });

      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

      await supabase.from("after_sales_visit_photos").insert({
        visit_id: visitId,
        ticket_id: ticketId,
        photo_url: data.publicUrl,
        storage_path: path,
        photo_stage: item.stage,
        notes: `Foto ${item.stage} subida desde ejecución técnica`,
        uploaded_by: visit?.technician_name || "Técnico RD Wood",
      });
    }
  }

  async function saveExecution(closeVisit = false) {
    if (!visit) return;

    setSaving(true);

    try {
      await uploadPhotos(visit.id, visit.ticket_id);

      const patch: any = {
        findings,
        solution_applied: solution,
        parts_used: parts,
        client_signature_name: signatureName,
        client_satisfaction: satisfaction,
        visit_status: closeVisit ? "completada" : "en_sitio",
      };

      if (closeVisit) {
        patch.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("after_sales_service_visits")
        .update(patch)
        .eq("id", visit.id);

      if (error) throw new Error(error.message);

      alert(closeVisit ? "✅ Visita completada y ticket cerrado." : "✅ Avance guardado.");
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      await loadVisit();
    } catch (error: any) {
      alert("Error guardando ejecución: " + (error?.message || error));
    } finally {
      setSaving(false);
    }
  }

  if (!visit) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050816] text-white">
        <div className="text-center">
          <Wrench className="mx-auto mb-4 text-cyan-300" size={44} />
          <h1 className="text-3xl font-black">Sin visita programada</h1>
          <p className="mt-2 text-slate-400">Primero programa una visita desde /postventa/agenda.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="mx-auto max-w-6xl px-6 py-8">
        <a href="/postventa/agenda" className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black">
          <ArrowLeft size={16} />
          Volver a agenda
        </a>

        <div className="rounded-[34px] border border-cyan-400/20 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-cyan-200">
            <Sparkles size={16} />
            Ejecución técnica
          </div>
          <h1 className="mt-5 text-5xl font-black">{visit.visit_code}</h1>
          <p className="mt-3 text-slate-300">{visit.ticket_code} · {visit.issue_title}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <Info label="Cliente" value={visit.client_name || "-"} />
            <Info label="Proyecto" value={visit.project_name || "-"} />
            <Info label="Técnico" value={visit.technician_name || "-"} />
            <Info label="Estado" value={visit.visit_status || "-"} />
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <Card title="Diagnóstico y solución" icon={<Wrench className="text-cyan-200" />}>
              <textarea value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Hallazgos técnicos..." className="h-32 w-full rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-300" />
              <textarea value={solution} onChange={(e) => setSolution(e.target.value)} placeholder="Solución aplicada..." className="mt-4 h-32 w-full rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-300" />
              <textarea value={parts} onChange={(e) => setParts(e.target.value)} placeholder="Piezas / materiales usados..." className="mt-4 h-24 w-full rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-300" />
            </Card>

            <Card title="Evidencia fotográfica" icon={<Camera className="text-amber-200" />}>
              <div className="grid gap-4 md:grid-cols-2">
                <PhotoInput label="Fotos antes" stage="antes" onFiles={handlePhotos} />
                <PhotoInput label="Fotos después" stage="despues" onFiles={handlePhotos} />
              </div>

              {photos.length > 0 && (
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  {photos.map((p, i) => (
                    <div key={p.preview} className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
                      <img src={p.preview} className="h-36 w-full object-cover" alt="Evidencia" />
                      <button onClick={() => removePhoto(i)} className="absolute right-2 top-2 rounded-full bg-black/70 p-2">
                        <X size={15} />
                      </button>
                      <div className="p-2 text-xs font-black uppercase text-cyan-200">{p.stage}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Firma y cierre" icon={<ShieldCheck className="text-emerald-200" />}>
              <input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} placeholder="Nombre de quien recibe" className="w-full rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-semibold outline-none focus:border-cyan-300" />

              <div className="mt-5">
                <p className="mb-3 text-sm font-black uppercase text-slate-400">Satisfacción del cliente</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setSatisfaction(n)} className={n <= satisfaction ? "text-amber-300" : "text-slate-600"}>
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <button disabled={saving} onClick={() => saveExecution(false)} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-4 text-sm font-black uppercase text-slate-950 disabled:opacity-50">
                <Save size={16} />
                Guardar avance
              </button>

              <button disabled={saving} onClick={() => saveExecution(true)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-4 text-sm font-black uppercase text-slate-950 disabled:opacity-50">
                <CheckCircle2 size={16} />
                Completar visita
              </button>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
      <div className="mb-5 flex items-center gap-3">
        {icon}
        <h2 className="text-2xl font-black">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function PhotoInput({
  label,
  stage,
  onFiles,
}: {
  label: string;
  stage: "antes" | "despues";
  onFiles: (files: FileList | null, stage: "antes" | "despues") => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-cyan-300/30 bg-cyan-300/10 p-8 text-center hover:bg-cyan-300/15">
      <ImagePlus className="mb-3 text-cyan-200" size={34} />
      <div className="font-black">{label}</div>
      <div className="mt-2 text-xs text-slate-300">Tomar foto o subir imagen</div>
      <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => onFiles(e.target.files, stage)} />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-black">{value}</div>
    </div>
  );
}
