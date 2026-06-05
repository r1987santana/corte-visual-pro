"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/saas/auth-client";

type ServiceItem = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  price?: number | null;
  currency?: string | null;
  image_url?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
  ai_prompt?: string | null;
  created_at?: string | null;
};

type ServiceForm = {
  id: string;
  title: string;
  description: string;
  category: string;
  price: string;
  currency: string;
  image_url: string;
  is_active: boolean;
  sort_order: string;
  ai_prompt: string;
};

const emptyForm: ServiceForm = {
  id: "",
  title: "",
  description: "",
  category: "adicional",
  price: "",
  currency: "DOP",
  image_url: "",
  is_active: true,
  sort_order: "10",
  ai_prompt: "",
};

const fieldInputClass =
  "w-full rounded-2xl border border-cyan-400/20 bg-slate-950/85 px-4 py-3 text-sm font-bold text-white shadow-inner shadow-black/30 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:bg-slate-950 focus:ring-2 focus:ring-cyan-300/20";

function money(value: any, currency = "DOP") {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function n(value: any) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function base64ToBlob(base64: string, mimeType = "image/png") {
  const cleanBase64 = base64.includes(",") ? base64.split(",").pop() || "" : base64;
  const byteCharacters = atob(cleanBase64);
  const byteArrays: ArrayBuffer[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
    byteArrays.push(new Uint8Array(byteNumbers).buffer);
  }

  return new Blob(byteArrays, { type: mimeType });
}

async function uploadServiceImage(base64: string, mimeType = "image/png") {
  const blob = await base64ToBlob(base64, mimeType);
  const path = `portal-services/service-${Date.now()}.png`;

  const { error } = await supabase.storage.from("ai-design-images").upload(path, blob, {
    upsert: true,
    contentType: mimeType,
  });

  if (error) throw new Error("Error subiendo imagen: " + error.message);

  const { data } = supabase.storage.from("ai-design-images").getPublicUrl(path);
  return data.publicUrl;
}

function promptFor(form: ServiceForm) {
  return [
    "Fotografia comercial premium para vender un servicio de RD Wood System.",
    `Servicio: ${form.title || "servicio de mobiliario"}.`,
    `Descripcion: ${form.description || "servicio complementario para muebles a medida"}.`,
    "Estilo visual: interior moderno dominicano, madera real, iluminacion natural, limpio, elegante, sin texto, sin logos, sin personas si no aportan al servicio.",
    "Formato cuadrado para tarjeta de portal cliente, producto o resultado claramente visible.",
  ].join(" ");
}

export default function ServiciosPortalPage() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  const activeItems = useMemo(() => items.filter((item) => item.is_active !== false), [items]);
  const inactiveItems = useMemo(() => items.filter((item) => item.is_active === false), [items]);

  async function loadItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_portal_catalog_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Error cargando servicios: " + error.message);
      setItems([]);
    } else {
      setItems((data || []) as ServiceItem[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadItems();
  }, []);

  function edit(item: ServiceItem) {
    setForm({
      id: item.id,
      title: item.title || "",
      description: item.description || "",
      category: item.category || "adicional",
      price: String(item.price || ""),
      currency: item.currency || "DOP",
      image_url: item.image_url || "",
      is_active: item.is_active !== false,
      sort_order: String(item.sort_order || 10),
      ai_prompt: item.ai_prompt || "",
    });
    setMessage("");
  }

  async function save() {
    if (!form.title.trim()) {
      setMessage("Escribe el nombre del servicio.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || "adicional",
      price: n(form.price),
      currency: form.currency || "DOP",
      image_url: form.image_url.trim() || null,
      is_active: form.is_active,
      sort_order: n(form.sort_order),
      ai_prompt: form.ai_prompt.trim() || null,
    };

    const result = form.id
      ? await supabase.from("client_portal_catalog_items").update(payload).eq("id", form.id)
      : await supabase.from("client_portal_catalog_items").insert(payload);

    if (result.error) {
      setMessage("Error guardando servicio: " + result.error.message);
    } else {
      setMessage("Servicio guardado y disponible para el portal.");
      setForm(emptyForm);
      await loadItems();
    }

    setSaving(false);
  }

  async function remove(item: ServiceItem) {
    if (!confirm(`Eliminar ${item.title}?`)) return;
    const { error } = await supabase.from("client_portal_catalog_items").delete().eq("id", item.id);
    if (error) setMessage("Error eliminando: " + error.message);
    else {
      setMessage("Servicio eliminado.");
      await loadItems();
    }
  }

  async function generateImage() {
    if (!form.title.trim()) {
      setMessage("Primero escribe el servicio que vas a vender.");
      return;
    }

    setGenerating(true);
    setMessage("Generando imagen IA del servicio...");

    try {
      const prompt = form.ai_prompt.trim() || promptFor(form);
      const response = await apiFetch("/api/ai-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size: "1024x1024" }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result?.error || "No se pudo generar imagen.");

      const imageUrl = await uploadServiceImage(result.image_base64, result.mime_type || "image/png");
      setForm((current) => ({ ...current, image_url: imageUrl, ai_prompt: prompt }));
      setMessage("Imagen IA generada. Revisa y guarda el servicio.");
    } catch (error: any) {
      setMessage(error?.message || "Error generando imagen IA.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="mx-auto max-w-[1700px] px-6 py-6">
        <div className="rounded-[34px] border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,47,73,.92),rgba(15,23,42,.96))] p-8 shadow-2xl shadow-cyan-950/30">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.38em] text-cyan-200">Portal comercial</p>
              <h1 className="mt-3 text-5xl font-black tracking-tight">Servicios Portal</h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold text-cyan-50/80">
                Configura lo que RD Wood puede vender adicional a cada cliente: servicios, upgrades, accesorios,
                mantenimiento y promociones con imagen IA.
              </p>
            </div>
            <button onClick={loadItems} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950">
              <RefreshCw size={18} /> Actualizar
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-5 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm font-black text-cyan-50">
            {message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[430px_1fr]">
          <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-5 flex items-center gap-3">
              <Plus className="text-cyan-200" />
              <h2 className="text-2xl font-black">{form.id ? "Editar servicio" : "Nuevo servicio"}</h2>
            </div>

            <div className="space-y-4">
              <Field label="Nombre">
                <input className={fieldInputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Upgrade de iluminacion LED" />
              </Field>
              <Field label="Descripcion">
                <textarea className={`${fieldInputClass} min-h-28 resize-y`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Que incluye, para que sirve y cuando ofrecerlo." />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria">
                  <input className={fieldInputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="adicional" />
                </Field>
                <Field label="Orden">
                  <input className={fieldInputClass} type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
                </Field>
                <Field label="Precio">
                  <input className={fieldInputClass} type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </Field>
                <Field label="Moneda">
                  <input className={fieldInputClass} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
                </Field>
              </div>
              <Field label="URL imagen">
                <input className={fieldInputClass} value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              </Field>
              <Field label="Prompt IA">
                <textarea className={`${fieldInputClass} min-h-28 resize-y`} value={form.ai_prompt} onChange={(e) => setForm({ ...form, ai_prompt: e.target.value })} placeholder={promptFor(form)} />
              </Field>

              <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-black">
                Activo en portal
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-5 w-5 accent-cyan-400" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={generateImage} disabled={generating} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 py-3 text-sm font-black text-white disabled:opacity-60">
                  {generating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  Imagen IA
                </button>
                <button onClick={save} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Guardar
                </button>
              </div>

              {form.image_url ? (
                <img src={form.image_url} alt={form.title || "Servicio"} className="h-56 w-full rounded-3xl border border-white/10 object-cover" />
              ) : null}
            </div>
          </div>

          <div className="space-y-6">
            <ServiceGrid title="Activos en portal" items={activeItems} loading={loading} onEdit={edit} onRemove={remove} />
            <ServiceGrid title="Inactivos" items={inactiveItems} loading={loading} onEdit={edit} onRemove={remove} muted />
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function ServiceGrid({
  title,
  items,
  loading,
  onEdit,
  onRemove,
  muted,
}: {
  title: string;
  items: ServiceItem[];
  loading: boolean;
  onEdit: (item: ServiceItem) => void;
  onRemove: (item: ServiceItem) => void;
  muted?: boolean;
}) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
      <div className="mb-5 flex items-center gap-3">
        <BadgeCheck className={muted ? "text-slate-500" : "text-emerald-200"} />
        <h2 className="text-2xl font-black">{title}</h2>
      </div>
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950 p-8 text-center font-bold text-slate-400">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950 p-8 text-center font-bold text-slate-500">Sin servicios.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
              {item.image_url ? (
                <img src={item.image_url} alt={item.title} className="h-44 w-full object-cover" />
              ) : (
                <div className="flex h-44 items-center justify-center bg-cyan-300/10 text-cyan-200">
                  <ImagePlus size={42} />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{item.title}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">{item.category || "adicional"}</p>
                  </div>
                  <p className="text-lg font-black text-emerald-200">{money(item.price, item.currency || "DOP")}</p>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-slate-400">{item.description || "Sin descripcion."}</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => onEdit(item)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 text-xs font-black uppercase text-slate-950">
                    <Pencil size={14} /> Editar
                  </button>
                  <button onClick={() => onRemove(item)} className="inline-flex items-center justify-center rounded-xl bg-red-500/15 px-3 py-2 text-red-200">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
