"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Gift, Loader2, Send, Sparkles, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";

function cleanCode(value: string) {
  return value.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase();
}

export default function ReferralLandingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const code = cleanCode(Array.isArray(params?.code) ? params.code[0] : String(params?.code || ""));
  const portalToken = searchParams.get("portal") || "";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [interest, setInterest] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const referralLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, []);

  async function submitReferral() {
    if (!name.trim() || !phone.trim()) {
      alert("Completa tu nombre y WhatsApp.");
      return;
    }

    setSaving(true);
    setMessage("");

    let referrer: any = null;
    const clientRes = await supabase.from("clients").select("*").eq("referral_code", code).maybeSingle();
    if (!clientRes.error && clientRes.data) referrer = clientRes.data;

    const payload = {
      referral_code: code,
      referral_link: referralLink,
      referrer_client_id: referrer?.id || null,
      referrer_name: referrer?.name || null,
      referrer_phone: referrer?.phone || referrer?.whatsapp || null,
      referred_name: name.trim().toUpperCase(),
      referred_phone: phone.trim(),
      project_interest: interest.trim() || "Solicitud desde enlace de referido",
      source: "link_referido",
      status: "lead_registrado",
      bonus_status: "pendiente_proyecto",
      bonus_type: "descuento_proxima_compra",
      portal_token: portalToken || null,
      notes: "Lead registrado desde landing publica de referidos.",
    };

    const { error } = await supabase.from("client_referrals").insert(payload);

    if (error) {
      setMessage("No se pudo registrar el referido: " + error.message);
      setSaving(false);
      return;
    }

    try {
      await supabase.from("crm_leads").insert({
        customer_name: name.trim().toUpperCase(),
        phone: phone.trim(),
        source: "referido",
        project_type: "otro",
        need_description: interest.trim() || "Cliente referido solicita contacto",
        stage: "prospecto",
        status: "activo",
        priority: "alta",
        assigned_to: "Comercial",
        notes: `Codigo referido: ${code}. Referidor: ${referrer?.name || "pendiente identificar"}.`,
        updated_at: new Date().toISOString(),
      } as any);
    } catch {
      // El referido ya queda guardado aunque CRM no tenga todas las columnas activas.
    }

    setName("");
    setPhone("");
    setInterest("");
    setMessage("Listo. RD Wood recibio tu solicitud y contactara contigo por WhatsApp.");
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-[#020617] px-5 py-8 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1fr_480px]">
          <div className="rounded-[34px] border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-[#07111f] to-[#07142a] p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-emerald-200">
              <Sparkles size={15} /> RD Wood System
            </div>
            <h1 className="mt-6 text-4xl font-black leading-tight lg:text-6xl">Tu proyecto referido empieza aqui</h1>
            <p className="mt-4 max-w-2xl text-base font-semibold text-slate-300">
              Completa tus datos y nuestro equipo comercial te contactara. Si completas un proyecto, el cliente que te recomendo recibe su bono.
            </p>
            <div className="mt-8 rounded-3xl border border-white/10 bg-black/30 p-5">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">Codigo de referido</p>
              <p className="mt-2 text-3xl font-black">{code || "RDW"}</p>
            </div>
          </div>

          <div className="rounded-[34px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-200">
                <UserPlus size={24} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-200">Referido</p>
                <h2 className="text-2xl font-black">Solicitar contacto</h2>
              </div>
            </div>

            {message && <div className="mb-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm font-black text-cyan-100">{message}</div>}

            <div className="space-y-3">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre completo" className="h-14 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm font-bold outline-none focus:border-cyan-400" />
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Telefono / WhatsApp" className="h-14 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm font-bold outline-none focus:border-cyan-400" />
              <textarea value={interest} onChange={(event) => setInterest(event.target.value)} placeholder="Que quieres cotizar? Cocina, closet, centro TV, corte/CNC..." className="h-32 w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm font-bold outline-none focus:border-cyan-400" />
              <button onClick={submitReferral} disabled={saving} className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-sm font-black uppercase text-slate-950 disabled:opacity-60">
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Gift size={18} />}
                Registrar referido
              </button>
              <a href="https://wa.me/18096905636" target="_blank" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-black uppercase text-cyan-100">
                <Send size={16} /> WhatsApp RD Wood
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
