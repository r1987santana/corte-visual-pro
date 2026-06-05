"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Brain,
  Database,
  ExternalLink,
  Globe2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/saas/auth-client";

type PricingReference = {
  id: string;
  productKey: string;
  productName: string;
  category?: string | null;
  unit?: string | null;
  sourceType: "manual" | "supplier" | "internet" | "internal" | "system";
  sourceName?: string | null;
  sourceUrl?: string | null;
  observedCost?: number | null;
  observedPrice?: number | null;
  currency?: string;
  confidence?: number;
  notes?: string | null;
  observedAt?: string;
};

const emptyForm = {
  productName: "",
  productKey: "",
  category: "SERVICIOS",
  unit: "servicio",
  sourceType: "manual",
  sourceName: "",
  sourceUrl: "",
  observedCost: "",
  observedPrice: "",
  confidence: "0.70",
  notes: "",
};

function money(value?: number | null) {
  return `RD$${Math.round(Number(value || 0)).toLocaleString("en-US")}`;
}

function percent(value?: number | null) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function sourceTone(type?: string) {
  if (type === "internet") return "border-blue-400/30 bg-blue-500/10 text-blue-100";
  if (type === "supplier") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
  if (type === "system") return "border-amber-400/30 bg-amber-500/10 text-amber-100";
  if (type === "internal") return "border-purple-400/30 bg-purple-500/10 text-purple-100";
  return "border-cyan-400/30 bg-cyan-500/10 text-cyan-100";
}

export default function AIPricingPage() {
  const [references, setReferences] = useState<PricingReference[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return references;
    return references.filter((item) =>
      [item.productName, item.productKey, item.sourceName, item.sourceType, item.notes]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [references, query]);

  async function loadReferences() {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/ai/pricing/references");
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || payload.error || "No se pudieron cargar referencias.");
      setReferences(payload.references || []);
    } catch (err: any) {
      setError(err?.message || "Error cargando referencias.");
    } finally {
      setLoading(false);
    }
  }

  async function saveReference() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch("/api/ai/pricing/references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: form.productName,
          productKey: form.productKey || form.productName,
          category: form.category,
          unit: form.unit,
          sourceType: form.sourceType,
          sourceName: form.sourceName,
          sourceUrl: form.sourceUrl,
          observedCost: Number(form.observedCost || 0) || null,
          observedPrice: Number(form.observedPrice || 0) || null,
          confidence: Number(form.confidence || 0.7),
          notes: form.notes,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || payload.error || "No se pudo guardar.");
      setMessage("Referencia guardada para la IA de precios.");
      setForm(emptyForm);
      await loadReferences();
    } catch (err: any) {
      setError(err?.message || "Error guardando referencia.");
    } finally {
      setSaving(false);
    }
  }

  async function importUrl() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch("/api/ai/pricing/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: form.productName,
          productKey: form.productKey || form.productName,
          category: form.category,
          unit: form.unit,
          sourceUrl: form.sourceUrl,
          sourceName: form.sourceName,
          observedCost: Number(form.observedCost || 0) || null,
          observedPrice: Number(form.observedPrice || 0) || null,
          notes: form.notes,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || payload.error || "No se pudo importar URL.");
      setMessage(`Referencia importada. Candidatos detectados: ${payload.candidates?.length || 0}.`);
      setForm(emptyForm);
      await loadReferences();
    } catch (err: any) {
      setError(err?.message || "Error importando URL.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadReferences();
  }, []);

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-slate-900 via-[#061426] to-indigo-950 p-6 shadow-2xl shadow-cyan-950/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200">
                <Brain size={14} />
                IA de precios
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Alimentar IA de precios</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
                Referencias internas, proveedores e internet para recomendar costos y precios con evidencia.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/ia-decisiones"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-100 hover:bg-white/[0.08]"
              >
                <ShieldCheck size={18} />
                Decisiones IA
              </Link>
              <button
                type="button"
                onClick={loadReferences}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                Actualizar
              </button>
            </div>
          </div>
        </section>

        {message ? <Notice tone="ok" text={message} /> : null}
        {error ? <Notice tone="error" text={error} /> : null}

        <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[24px] border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20">
            <SectionHeader icon={<Plus size={20} />} title="Referencia manual" />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Producto o servicio" value={form.productName} onChange={(v) => setForm({ ...form, productName: v })} />
              <Field label="Clave de busqueda" value={form.productKey} onChange={(v) => setForm({ ...form, productKey: v })} placeholder="Ej: servicio instalacion" />
              <Field label="Categoria" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
              <Field label="Unidad" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
              <Select label="Fuente" value={form.sourceType} onChange={(v) => setForm({ ...form, sourceType: v })} />
              <Field label="Nombre fuente" value={form.sourceName} onChange={(v) => setForm({ ...form, sourceName: v })} placeholder="Proveedor, catalogo, competencia" />
              <Field label="Costo observado" value={form.observedCost} onChange={(v) => setForm({ ...form, observedCost: v })} type="number" />
              <Field label="Precio observado" value={form.observedPrice} onChange={(v) => setForm({ ...form, observedPrice: v })} type="number" />
              <Field label="Confianza 0-1" value={form.confidence} onChange={(v) => setForm({ ...form, confidence: v })} type="number" />
              <Field label="URL fuente" value={form.sourceUrl} onChange={(v) => setForm({ ...form, sourceUrl: v })} placeholder="https://..." />
              <div className="md:col-span-2">
                <Field label="Nota" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
              </div>
            </div>
            <button
              type="button"
              onClick={saveReference}
              disabled={saving}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Guardar referencia
            </button>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20">
            <SectionHeader icon={<Globe2 size={20} />} title="Importar desde internet" />
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
              La URL se guarda como evidencia. No cambia inventario ni precios sin aprobacion.
            </p>
            <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.07] p-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Entrada segura</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                Completa producto y URL. Si escribes precio observado, la IA lo usa con mas confianza; si no, intenta detectar candidatos en la pagina.
              </p>
            </div>
            <button
              type="button"
              onClick={importUrl}
              disabled={saving}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-sm font-black text-blue-100 hover:bg-blue-500/20 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Globe2 size={18} />}
              Importar URL
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-[24px] border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <SectionHeader icon={<Database size={20} />} title="Referencias guardadas" />
            <label className="relative block md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar fuente o producto"
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 pl-10 text-sm font-bold text-white outline-none focus:border-cyan-300"
              />
            </label>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            <div className="max-h-[540px] overflow-auto">
              <table className="min-w-[960px] w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Fuente</th>
                    <th className="px-4 py-3">Costo</th>
                    <th className="px-4 py-3">Precio</th>
                    <th className="px-4 py-3">Confianza</th>
                    <th className="px-4 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center font-bold text-slate-400">
                        <Loader2 className="mx-auto mb-2 animate-spin text-cyan-300" />
                        Cargando referencias...
                      </td>
                    </tr>
                  ) : null}
                  {!loading && filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center font-bold text-slate-400">
                        Sin referencias.
                      </td>
                    </tr>
                  ) : null}
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-t border-white/10">
                      <td className="px-4 py-3">
                        <p className="font-black text-white">{item.productName}</p>
                        <p className="text-xs font-bold text-slate-500">{item.productKey}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${sourceTone(item.sourceType)}`}>
                          {item.sourceType}
                        </span>
                        <p className="mt-1 text-xs font-bold text-slate-400">{item.sourceName || "-"}</p>
                        {item.sourceUrl ? (
                          <a href={item.sourceUrl} target="_blank" className="mt-1 inline-flex items-center gap-1 text-xs font-black text-cyan-300" rel="noreferrer">
                            fuente <ExternalLink size={12} />
                          </a>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-black text-amber-200">{money(item.observedCost)}</td>
                      <td className="px-4 py-3 font-black text-emerald-200">{money(item.observedPrice)}</td>
                      <td className="px-4 py-3 font-black text-cyan-200">{percent(item.confidence)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-500">{item.observedAt ? new Date(item.observedAt).toLocaleString("es-DO") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-3 text-cyan-200">{icon}</div>
      <h2 className="text-xl font-black text-white">{title}</h2>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label>
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300"
      />
    </label>
  );
}

function Select({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300"
      >
        <option value="manual">Manual</option>
        <option value="supplier">Proveedor</option>
        <option value="internet">Internet</option>
        <option value="internal">Interno</option>
      </select>
    </label>
  );
}

function Notice({ text, tone }: { text: string; tone: "ok" | "error" }) {
  return (
    <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-bold ${tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-red-400/30 bg-red-500/10 text-red-100"}`}>
      {text}
    </div>
  );
}
