"use client";

import { useParams } from "next/navigation";


import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardSignature,
  CreditCard,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type PortalOverview = {
  token: string;
  is_active: boolean;
  expires_at: string | null;
  id: string;
  project_code: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  project_name: string;
  project_type: string;
  status: string;
  progress: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  estimated_delivery: string | null;
  address: string | null;
  render_url: string | null;
  notes: string | null;
  gallery_count: number;
  documents_count: number;
  comments_count: number;
  signatures_count: number;
};

type Timeline = {
  id: string;
  step_code: string;
  step_name: string;
  description: string | null;
  status: string;
  step_order: number;
  planned_date: string | null;
  completed_at: string | null;
};

type Payment = {
  id: string;
  payment_code: string;
  payment_date: string;
  concept: string;
  amount: number;
  method: string;
  status: string;
  receipt_url: string | null;
};

type Gallery = {
  id: string;
  image_type: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
};

type DocumentRow = {
  id: string;
  document_code: string;
  document_type: string;
  title: string;
  file_url: string | null;
  status: string;
};

type CommentRow = {
  id: string;
  author: string;
  author_type: string;
  comment: string;
  created_at: string;
};

const money = (value: any) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    diseño: "Diseño",
    aprobado: "Aprobado",
    produccion: "Producción",
    transporte: "Transporte",
    instalacion: "Instalación",
    entregado: "Entregado",
    pendiente: "Pendiente",
    en_proceso: "En proceso",
    completado: "Completado",
    confirmado: "Confirmado",
  };
  return map[String(status || "")] || status || "N/A";
}

function statusClass(status?: string | null) {
  if (["entregado", "completado", "confirmado", "aprobado"].includes(String(status))) {
    return "border-emerald-400/40 bg-emerald-500/15 text-emerald-200";
  }
  if (["produccion", "en_proceso", "transporte", "instalacion"].includes(String(status))) {
    return "border-blue-400/40 bg-blue-500/15 text-blue-200";
  }
  if (["pendiente", "diseño"].includes(String(status))) {
    return "border-amber-400/40 bg-amber-500/15 text-amber-200";
  }
  return "border-slate-400/40 bg-slate-500/15 text-slate-200";
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleDateString("es-DO");
  } catch {
    return "N/A";
  }
}

export default function CustomerPortalPage() {
  const routeParams = useParams<{ token: string }>();
  const token = routeParams?.token as string;

  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [timeline, setTimeline] = useState<Timeline[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [gallery, setGallery] = useState<Gallery[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [comment, setComment] = useState("");
  const [signer, setSigner] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadPortal() {
    setLoading(true);
    try {
      const [o, t, p, g, d, c] = await Promise.all([
        supabase.from("v_customer_portal_overview").select("*").eq("token", token).eq("is_active", true).maybeSingle(),
        supabase.from("v_customer_portal_timeline").select("*").eq("token", token).order("step_order"),
        supabase.from("v_customer_portal_payments").select("*").eq("token", token),
        supabase.from("v_customer_portal_gallery").select("*").eq("token", token),
        supabase.from("v_customer_portal_documents").select("*").eq("token", token),
        supabase.from("v_customer_portal_comments").select("*").eq("token", token),
      ]);

      if (o.error) throw o.error;
      if (t.error) throw t.error;
      if (p.error) throw p.error;
      if (g.error) throw g.error;
      if (d.error) throw d.error;
      if (c.error) throw c.error;

      setOverview(o.data as PortalOverview | null);
      setTimeline((t.data || []) as Timeline[]);
      setPayments((p.data || []) as Payment[]);
      setGallery((g.data || []) as Gallery[]);
      setDocuments((d.data || []) as DocumentRow[]);
      setComments((c.data || []) as CommentRow[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPortal();
  }, [token]);

  const paidPercent = useMemo(() => {
    if (!overview?.total_amount) return 0;
    return Math.min(100, (Number(overview.paid_amount || 0) / Number(overview.total_amount || 1)) * 100);
  }, [overview]);

  async function sendComment() {
    if (!overview?.id || !comment.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("customer_portal_add_comment", {
        p_portal_project_id: overview.id,
        p_author: overview.customer_name,
        p_comment: comment.trim(),
      });
      if (error) throw error;
      setComment("");
      await loadPortal();
    } catch (error: any) {
      alert(error?.message || "No se pudo enviar el comentario.");
    } finally {
      setSaving(false);
    }
  }

  async function approveDesign() {
    if (!overview?.id) return;
    if (!signer.trim()) {
      alert("Escribe tu nombre para aprobar.");
      return;
    }
    if (!confirm("¿Confirmas que apruebas digitalmente este diseño/proyecto?")) return;

    setSaving(true);
    try {
      const { error } = await supabase.rpc("customer_portal_approve", {
        p_portal_project_id: overview.id,
        p_signer_name: signer.trim(),
        p_signature_text: "Cliente aprobó el diseño/proyecto desde el portal.",
      });
      if (error) throw error;
      await loadPortal();
    } catch (error: any) {
      alert(error?.message || "No se pudo aprobar.");
    } finally {
      setSaving(false);
    }
  }

  async function signDelivery() {
    if (!overview?.id) return;
    if (!signer.trim()) {
      alert("Escribe tu nombre para firmar entrega.");
      return;
    }
    if (!confirm("¿Confirmas que recibiste el proyecto conforme?")) return;

    setSaving(true);
    try {
      const { error } = await supabase.rpc("customer_portal_sign_delivery", {
        p_portal_project_id: overview.id,
        p_signer_name: signer.trim(),
        p_signature_text: "Cliente recibió el proyecto conforme desde el portal.",
      });
      if (error) throw error;
      await loadPortal();
    } catch (error: any) {
      alert(error?.message || "No se pudo firmar entrega.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-6 py-5">
          <Loader2 className="animate-spin text-blue-300" />
          Cargando portal del cliente...
        </div>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <section className="max-w-xl rounded-3xl border border-red-400/30 bg-red-500/10 p-8 text-center">
          <ShieldCheck className="mx-auto mb-4 text-red-200" size={44} />
          <h1 className="text-3xl font-black">Portal no encontrado</h1>
          <p className="mt-3 text-red-100">
            El enlace no existe, está vencido o fue desactivado. Contacta a RD Wood System.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
        {overview.render_url && (
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url(${overview.render_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}
        <div className="relative mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 shadow-2xl backdrop-blur">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.3em] text-blue-300">
                  <Sparkles size={16} /> RD Wood System
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight lg:text-6xl">
                  {overview.project_name}
                </h1>
                <p className="mt-3 max-w-3xl text-slate-300">
                  Portal premium del cliente · {overview.project_code} · {overview.project_type}
                </p>
              </div>

              <div className="flex flex-col gap-2 lg:items-end">
                <span className={`rounded-full border px-4 py-2 text-sm font-black ${statusClass(overview.status)}`}>
                  {statusLabel(overview.status)}
                </span>
                <button
                  onClick={loadPortal}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black hover:bg-blue-500"
                >
                  <RefreshCw size={16} />
                  Actualizar
                </button>
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-black text-slate-300">Avance del proyecto</span>
                <span className="font-black text-blue-200">{Number(overview.progress || 0).toFixed(0)}%</span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
                  style={{ width: `${Math.min(Number(overview.progress || 0), 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Kpi icon={<UserRound />} title="Cliente" value={overview.customer_name} />
          <Kpi icon={<CalendarDays />} title="Entrega estimada" value={formatDate(overview.estimated_delivery)} />
          <Kpi icon={<Wallet />} title="Total" value={money(overview.total_amount)} />
          <Kpi icon={<CheckCircle2 />} title="Pagado" value={money(overview.paid_amount)} />
          <Kpi icon={<CreditCard />} title="Balance" value={money(overview.balance_amount)} />
          <Kpi icon={<ImageIcon />} title="Galería" value={overview.gallery_count} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Panel title="Resumen del proyecto" icon={<ShieldCheck className="text-blue-300" />}>
            {overview.render_url && (
              <img
                src={overview.render_url}
                alt={overview.project_name}
                className="mb-4 h-72 w-full rounded-3xl object-cover"
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Código" value={overview.project_code} />
              <Info label="Tipo" value={overview.project_type} />
              <Info label="Teléfono" value={overview.customer_phone || "N/A"} />
              <Info label="Email" value={overview.customer_email || "N/A"} />
              <Info label="Dirección" value={overview.address || "N/A"} full />
              <Info label="Notas" value={overview.notes || "N/A"} full />
            </div>
            {overview.customer_phone && (
              <a
                href={`https://wa.me/1${overview.customer_phone.replace(/\D/g, "")}`}
                target="_blank"
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-500"
              >
                <Phone size={16} />
                Contactar por WhatsApp
              </a>
            )}
          </Panel>

          <Panel title="Pagos" icon={<CreditCard className="text-emerald-300" />}>
            <div className="mb-4">
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-bold text-slate-300">Pagado</span>
                <span className="font-black text-emerald-300">{paidPercent.toFixed(0)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPercent}%` }} />
              </div>
            </div>
            <div className="space-y-3">
              {payments.map((p) => (
                <div key={p.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{p.concept}</p>
                      <p className="text-xs text-slate-400">{p.payment_code} · {formatDate(p.payment_date)} · {p.method}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-300">{money(p.amount)}</p>
                      <span className={`mt-1 inline-block rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(p.status)}`}>
                        {statusLabel(p.status)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <Panel title="Cronograma del proyecto" icon={<CalendarDays className="text-blue-300" />}>
          <div className="grid gap-3 lg:grid-cols-5">
            {timeline.map((item) => (
              <div key={item.id} className="rounded-3xl border border-white/10 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-500/20 text-sm font-black text-blue-200">
                    {item.step_order}
                  </span>
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(item.status)}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>
                <p className="font-black">{item.step_name}</p>
                <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                <p className="mt-3 text-xs font-bold text-slate-500">Plan: {formatDate(item.planned_date)}</p>
              </div>
            ))}
          </div>
        </Panel>

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="Galería / Renders / Avances" icon={<ImageIcon className="text-blue-300" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              {gallery.map((img) => (
                <div key={img.id} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
                  {img.image_url ? (
                    <img src={img.image_url} alt={img.title || "Imagen"} className="h-48 w-full object-cover" />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-slate-800 text-slate-500">Sin imagen</div>
                  )}
                  <div className="p-4">
                    <p className="font-black">{img.title || "Imagen"}</p>
                    <p className="text-xs text-slate-400">{img.image_type}</p>
                    <p className="mt-2 text-sm text-slate-300">{img.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Documentos" icon={<FileText className="text-blue-300" />}>
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div>
                    <p className="font-black">{doc.title}</p>
                    <p className="text-xs text-slate-400">{doc.document_code} · {doc.document_type}</p>
                  </div>
                  {doc.file_url ? (
                    <a href={doc.file_url} target="_blank" className="rounded-2xl bg-blue-600 p-3 hover:bg-blue-500">
                      <Download size={18} />
                    </a>
                  ) : (
                    <span className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-400">Pendiente</span>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="Aprobación y firma digital" icon={<ClipboardSignature className="text-emerald-300" />}>
            <p className="text-sm text-slate-300">
              Escribe tu nombre para aprobar digitalmente el diseño o firmar la entrega final.
            </p>
            <input
              value={signer}
              onChange={(e) => setSigner(e.target.value)}
              placeholder="Nombre completo"
              className="mt-4 h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 outline-none focus:border-blue-400"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                onClick={approveDesign}
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-black hover:bg-blue-500 disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                Aprobar diseño
              </button>
              <button
                onClick={signDelivery}
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-black hover:bg-emerald-500 disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <ClipboardSignature size={18} />}
                Firmar entrega
              </button>
            </div>
          </Panel>

          <Panel title="Comentarios" icon={<MessageCircle className="text-blue-300" />}>
            <div className="mb-4 space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-black">{c.author}</p>
                    <span className="text-xs text-slate-500">{formatDate(c.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{c.comment}</p>
                </div>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Escribe un comentario para RD Wood System..."
              className="min-h-28 w-full rounded-2xl border border-white/10 bg-slate-900 p-4 outline-none focus:border-blue-400"
            />
            <button
              onClick={sendComment}
              disabled={saving || !comment.trim()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-black hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              Enviar comentario
            </button>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Kpi({ icon, title, value }: { icon: React.ReactNode; title: string; value: any }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
        {icon}
      </div>
      <p className="text-xs uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-1 break-words text-lg font-black">{value}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20">
          {icon}
        </div>
        <h2 className="text-xl font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Info({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 rounded-2xl border border-white/10 bg-slate-900 p-3 font-bold text-slate-200">{value}</p>
    </div>
  );
}
