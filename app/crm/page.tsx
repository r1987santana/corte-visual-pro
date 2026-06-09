"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Edit3,
  Eye,
  Filter,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Lead = {
  id: string;
  lead_code?: string | null;
  customer_name: string;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  project_type?: string | null;
  need_description?: string | null;
  estimated_budget?: number | null;
  expected_close_date?: string | null;
  stage?: string | null;
  status?: string | null;
  priority?: string | null;
  assigned_to?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ActivityRow = {
  id: string;
  lead_id: string;
  activity_type?: string | null;
  title?: string | null;
  description?: string | null;
  scheduled_at?: string | null;
  status?: string | null;
  created_by?: string | null;
  created_at?: string | null;
};

type Quote = {
  id: string;
  quote_code?: string | null;
  lead_id?: string | null;
  customer_name?: string | null;
  project_type?: string | null;
  description?: string | null;
  subtotal?: number | null;
  discount?: number | null;
  tax?: number | null;
  total?: number | null;
  currency?: string | null;
  status?: string | null;
  valid_until?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

const STAGES = [
  { key: "prospecto", name: "Prospecto", probability: 10 },
  { key: "contactado", name: "Contactado", probability: 25 },
  { key: "medicion", name: "Medición", probability: 40 },
  { key: "cotizacion_enviada", name: "Cotización enviada", probability: 60 },
  { key: "negociacion", name: "Negociación", probability: 80 },
  { key: "ganado", name: "Ganado", probability: 100 },
  { key: "perdido", name: "Perdido", probability: 0 },
];

const PROJECT_TYPES = ["cocina", "closet", "centro_tv", "vanity", "puertas", "oficina", "mueble_comercial", "herrajes", "servicio", "otro"];
const SOURCES = ["manual", "whatsapp", "instagram", "facebook", "referido", "tienda", "web", "llamada", "showroom"];

function money(value: any) {
  const n = Number(value || 0);
  return `RD$${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateText(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("es-DO");
  } catch {
    return "-";
  }
}

function normal(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function stageLabel(stage?: string | null) {
  return STAGES.find((s) => s.key === stage)?.name || stage || "Prospecto";
}

function stageProbability(stage?: string | null) {
  return STAGES.find((s) => s.key === stage)?.probability || 0;
}

function stageClass(stage?: string | null) {
  if (stage === "ganado") return "bg-emerald-500/15 border-emerald-500/40 text-emerald-200";
  if (stage === "perdido") return "bg-red-500/15 border-red-500/40 text-red-200";
  if (stage === "negociacion") return "bg-orange-500/15 border-orange-500/40 text-orange-200";
  if (stage === "cotizacion_enviada") return "bg-amber-500/15 border-amber-500/40 text-amber-200";
  if (stage === "medicion") return "bg-blue-500/15 border-blue-500/40 text-blue-200";
  if (stage === "contactado") return "bg-cyan-500/15 border-cyan-500/40 text-cyan-200";
  return "bg-slate-500/15 border-slate-500/40 text-slate-200";
}

function priorityClass(priority?: string | null) {
  if (priority === "caliente" || priority === "urgente") return "bg-red-500/15 border-red-500/40 text-red-200";
  if (priority === "alta") return "bg-amber-500/15 border-amber-500/40 text-amber-200";
  if (priority === "media") return "bg-blue-500/15 border-blue-500/40 text-blue-200";
  return "bg-slate-500/15 border-slate-500/40 text-slate-200";
}

function whatsappLink(phone?: string | null, msg?: string) {
  const clean = String(phone || "").replace(/\D/g, "");
  if (!clean) return "#";
  const finalPhone = clean.startsWith("1") ? clean : `1${clean}`;
  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg || "Hola, le escribimos de RD Wood System.")}`;
}

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("todos");

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [savingLead, setSavingLead] = useState(false);

  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const [leadForm, setLeadForm] = useState<Partial<Lead>>({
    customer_name: "",
    phone: "",
    email: "",
    source: "manual",
    project_type: "otro",
    need_description: "",
    estimated_budget: 0,
    stage: "prospecto",
    status: "activo",
    priority: "media",
    assigned_to: "",
    address: "",
    notes: "",
  });

  const [activityForm, setActivityForm] = useState<Partial<ActivityRow>>({
    activity_type: "whatsapp",
    title: "",
    description: "",
    scheduled_at: "",
    status: "pendiente",
    created_by: "",
  });

  const [quoteForm, setQuoteForm] = useState<Partial<Quote>>({
    description: "",
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    status: "borrador",
    valid_until: "",
    notes: "",
  });

  useEffect(() => {
    loadAll();
  }, []);

  const stats = useMemo(() => {
    const active = leads.filter((l) => !["inactivo", "perdido", "ganado"].includes(String(l.status || "")) && !["perdido", "ganado"].includes(String(l.stage || "")));
    const won = leads.filter((l) => l.stage === "ganado");
    const lost = leads.filter((l) => l.stage === "perdido");
    const openPipeline = leads.filter((l) => !["ganado", "perdido"].includes(String(l.stage || "")));
    const pipeline = openPipeline.reduce((s, l) => s + Number(l.estimated_budget || 0), 0);
    const weightedForecast = openPipeline.reduce((s, l) => s + (Number(l.estimated_budget || 0) * stageProbability(l.stage)) / 100, 0);
    const wonAmount = won.reduce((s, l) => s + Number(l.estimated_budget || 0), 0);
    const closed = won.length + lost.length;
    const closeRate = closed > 0 ? (won.length / closed) * 100 : 0;
    const avgTicket = won.length > 0 ? wonAmount / won.length : 0;
    const pending = activities.filter((a) => a.status !== "completada");
    const overdue = pending.filter((a) => a.scheduled_at && new Date(a.scheduled_at).getTime() < Date.now());

    return {
      total: leads.length,
      active: active.length,
      won: won.length,
      lost: lost.length,
      pipeline,
      weightedForecast,
      wonAmount,
      activitiesPending: pending.length,
      activitiesOverdue: overdue.length,
      quotesTotal: quotes.reduce((s, q) => s + Number(q.total || 0), 0),
      quotesCount: quotes.length,
      closeRate,
      avgTicket,
    };
  }, [leads, activities, quotes]);

  const filteredLeads = useMemo(() => {
    const q = normal(search);
    return leads.filter(
      (lead) =>
        (!q ||
          normal(lead.customer_name).includes(q) ||
          normal(lead.phone).includes(q) ||
          normal(lead.email).includes(q) ||
          normal(lead.lead_code).includes(q) ||
          normal(lead.need_description).includes(q) ||
          normal(lead.address).includes(q)) &&
        (stageFilter === "todos" || lead.stage === stageFilter)
    );
  }, [leads, search, stageFilter]);

  const forecastByStage = useMemo(() => {
    return STAGES.map((stage) => {
      const rows = leads.filter((lead) => lead.stage === stage.key);
      const pipelineValue = rows.reduce((s, lead) => s + Number(lead.estimated_budget || 0), 0);
      return {
        ...stage,
        count: rows.length,
        pipelineValue,
        weightedValue: (pipelineValue * stage.probability) / 100,
      };
    });
  }, [leads]);

  async function loadAll() {
    setLoading(true);
    setMessage("");
    try {
      const [leadsRes, actsRes, quotesRes] = await Promise.all([
        supabase.from("crm_leads").select("*").order("created_at", { ascending: false }),
        supabase.from("crm_activities").select("*").order("created_at", { ascending: false }),
        supabase.from("crm_quotes").select("*").order("created_at", { ascending: false }),
      ]);

      if (leadsRes.error) throw leadsRes.error;
      if (actsRes.error) throw actsRes.error;
      if (quotesRes.error) throw quotesRes.error;

      setLeads((leadsRes.data || []) as Lead[]);
      setActivities((actsRes.data || []) as ActivityRow[]);
      setQuotes((quotesRes.data || []) as Quote[]);
    } catch (error: any) {
      setMessage(error?.message || "Error cargando CRM. Verifica que corriste el SQL de Fase 30 Master Upgrade.");
    } finally {
      setLoading(false);
    }
  }

  function openNewLead() {
    setSelectedLead(null);
    setLeadForm({
      customer_name: "",
      phone: "",
      email: "",
      source: "manual",
      project_type: "otro",
      need_description: "",
      estimated_budget: 0,
      stage: "prospecto",
      status: "activo",
      priority: "media",
      assigned_to: "",
      address: "",
      notes: "",
    });
    setShowLeadModal(true);
  }

  function openEditLead(lead: Lead) {
    setSelectedLead(lead);
    setLeadForm({ ...lead });
    setShowLeadModal(true);
  }

  async function saveLead() {
    if (!leadForm.customer_name) {
      alert("El nombre del cliente es obligatorio.");
      return;
    }

    setSavingLead(true);
    try {
      const payload = {
        customer_name: leadForm.customer_name,
        phone: leadForm.phone || null,
        email: leadForm.email || null,
        source: leadForm.source || "manual",
        project_type: leadForm.project_type || "otro",
        need_description: leadForm.need_description || null,
        estimated_budget: Number(leadForm.estimated_budget || 0),
        expected_close_date: leadForm.expected_close_date || null,
        stage: leadForm.stage || "prospecto",
        status: leadForm.status || "activo",
        priority: leadForm.priority || "media",
        assigned_to: leadForm.assigned_to || null,
        address: leadForm.address || null,
        notes: leadForm.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (selectedLead?.id) {
        const { error } = await supabase.from("crm_leads").update(payload).eq("id", selectedLead.id);
        if (error) throw error;
      } else {
        const { data: codeData } = await supabase.rpc("generate_crm_lead_code");
        const { error } = await supabase.from("crm_leads").insert({
          lead_code: codeData || `LEAD-${Date.now()}`,
          ...payload,
        });
        if (error) throw error;
      }

      setShowLeadModal(false);
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Error guardando lead.");
    } finally {
      setSavingLead(false);
    }
  }

  async function moveStage(lead: Lead, stage: string) {
    try {
      const nextStatus = stage === "ganado" ? "ganado" : stage === "perdido" ? "perdido" : "activo";
      const { error } = await supabase
        .from("crm_leads")
        .update({ stage, status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", lead.id);

      if (error) throw error;
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage, status: nextStatus } : l)));
    } catch (error: any) {
      alert(error?.message || "Error moviendo lead.");
    }
  }

  async function markWon(lead: Lead) {
    try {
      const { error } = await supabase.rpc("crm_mark_lead_won", { p_lead_id: lead.id });
      if (error) throw error;
      await loadAll();
    } catch {
      await moveStage(lead, "ganado");
    }
  }

  async function markLost(lead: Lead) {
    if (!confirm(`¿Marcar como perdido a ${lead.customer_name}?`)) return;
    try {
      const { error } = await supabase.rpc("crm_mark_lead_lost", {
        p_lead_id: lead.id,
        p_reason: "Cliente no aprobó la propuesta.",
      });
      if (error) throw error;
      await loadAll();
    } catch {
      await moveStage(lead, "perdido");
    }
  }

  async function createQuickFollowup(lead: Lead) {
    try {
      const { error } = await supabase.rpc("crm_next_followup", {
        p_lead_id: lead.id,
        p_days: 1,
      });
      if (error) throw error;
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Error creando seguimiento.");
    }
  }

  async function deleteLead(lead: Lead) {
    if (!confirm(`¿Eliminar lead de ${lead.customer_name}?`)) return;
    try {
      const { error } = await supabase.from("crm_leads").delete().eq("id", lead.id);
      if (error) throw error;
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Error eliminando lead.");
    }
  }

  function openActivity(lead: Lead) {
    setSelectedLead(lead);
    setActivityForm({
      activity_type: "whatsapp",
      title: `Seguimiento a ${lead.customer_name}`,
      description: "",
      scheduled_at: "",
      status: "pendiente",
      created_by: "RD Wood Admin",
    });
    setShowActivityModal(true);
  }

  async function saveActivity() {
    if (!selectedLead?.id) return;
    try {
      const { error } = await supabase.from("crm_activities").insert({
        lead_id: selectedLead.id,
        activity_type: activityForm.activity_type || "nota",
        title: activityForm.title || "Seguimiento",
        description: activityForm.description || null,
        scheduled_at: activityForm.scheduled_at || null,
        status: activityForm.status || "pendiente",
        created_by: activityForm.created_by || "RD Wood Admin",
      });
      if (error) throw error;
      setShowActivityModal(false);
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Error guardando actividad.");
    }
  }

  function openQuote(lead: Lead) {
    setSelectedLead(lead);
    const subtotal = Number(lead.estimated_budget || 0);
    const tax = Math.round(subtotal * 0.18 * 100) / 100;
    setQuoteForm({
      description: lead.need_description || "",
      subtotal,
      discount: 0,
      tax,
      total: subtotal + tax,
      status: "borrador",
      valid_until: "",
      notes: "",
    });
    setShowQuoteModal(true);
  }

  function recalcQuote(next: Partial<Quote>) {
    return Math.max(0, Number(next.subtotal || 0) - Number(next.discount || 0) + Number(next.tax || 0));
  }

  async function saveQuote() {
    if (!selectedLead?.id) return;
    try {
      const { data: codeData } = await supabase.rpc("generate_crm_quote_code");
      const total = recalcQuote(quoteForm);

      const { error } = await supabase.from("crm_quotes").insert({
        quote_code: codeData || `CRM-COT-${Date.now()}`,
        lead_id: selectedLead.id,
        customer_name: selectedLead.customer_name,
        project_type: selectedLead.project_type,
        description: quoteForm.description || null,
        subtotal: Number(quoteForm.subtotal || 0),
        discount: Number(quoteForm.discount || 0),
        tax: Number(quoteForm.tax || 0),
        total,
        currency: "DOP",
        status: quoteForm.status || "borrador",
        valid_until: quoteForm.valid_until || null,
        notes: quoteForm.notes || null,
      });

      if (error) throw error;

      await supabase
        .from("crm_leads")
        .update({ stage: "cotizacion_enviada", estimated_budget: total, updated_at: new Date().toISOString() })
        .eq("id", selectedLead.id);

      setShowQuoteModal(false);
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Error guardando cotización.");
    }
  }

  function printLead(lead: Lead) {
    const leadQuotes = quotes.filter((q) => q.lead_id === lead.id);
    const leadActs = activities.filter((a) => a.lead_id === lead.id);
    const html = `<html><head><title>CRM - ${lead.customer_name}</title><style>@page{size:letter;margin:10mm}body{font-family:Arial;margin:30px;color:#111}.brand{letter-spacing:8px;color:#005c99;font-weight:900}h1{font-size:28px;margin:4px 0}.box{border:1px solid #111;border-radius:12px;padding:16px;margin:14px 0}table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#07111f;color:white;text-align:left;padding:8px}td{border:1px solid #ddd;padding:8px}.money{font-weight:900;color:#008a4b}</style></head><body><div class="brand">RD WOOD SYSTEM</div><h1>Ficha Comercial CRM</h1><div class="box"><b>Lead:</b> ${lead.lead_code || ""}<br/><b>Cliente:</b> ${lead.customer_name}<br/><b>Teléfono:</b> ${lead.phone || ""}<br/><b>Email:</b> ${lead.email || ""}<br/><b>Proyecto:</b> ${lead.project_type || ""}<br/><b>Etapa:</b> ${stageLabel(lead.stage)}<br/><b>Presupuesto:</b> <span class="money">${money(lead.estimated_budget)}</span><br/><b>Necesidad:</b> ${lead.need_description || ""}</div><h2>Cotizaciones</h2><table><thead><tr><th>Código</th><th>Estado</th><th>Total</th><th>Fecha</th></tr></thead><tbody>${leadQuotes.map((q) => `<tr><td>${q.quote_code || ""}</td><td>${q.status || ""}</td><td>${money(q.total)}</td><td>${dateText(q.created_at)}</td></tr>`).join("")}</tbody></table><h2>Actividades</h2><table><thead><tr><th>Tipo</th><th>Título</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>${leadActs.map((a) => `<tr><td>${a.activity_type || ""}</td><td>${a.title || ""}</td><td>${a.status || ""}</td><td>${dateText(a.created_at)}</td></tr>`).join("")}</tbody></table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-cyan-900/60 bg-gradient-to-br from-[#07111f] to-[#111b38] p-6 shadow-2xl">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-700 bg-cyan-500/10 px-3 py-1 text-xs font-black tracking-[0.25em] text-cyan-300">
                <Sparkles size={14} /> FASE 30 MASTER
              </div>
              <h1 className="mt-4 text-4xl font-black lg:text-5xl">CRM Comercial Pro</h1>
              <p className="mt-2 text-slate-300">
                Leads, seguimiento, cotizaciones, pipeline, forecast ponderado y conversión comercial.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={loadAll} disabled={loading} className="flex h-12 items-center gap-2 rounded-2xl bg-white px-5 font-black text-slate-950">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                Actualizar
              </button>
              <button onClick={openNewLead} className="flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 font-black">
                <Plus size={18} /> Nuevo Lead
              </button>
            </div>
          </div>
        </section>

        {message && (
          <section className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {message}
          </section>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-10">
          <Kpi icon={<UserRound />} label="Leads" value={stats.total} />
          <Kpi icon={<Activity />} label="Activos" value={stats.active} />
          <Kpi icon={<TrendingUp />} label="Ganados" value={stats.won} />
          <Kpi icon={<X />} label="Perdidos" value={stats.lost} />
          <Kpi icon={<CircleDollarSign />} label="Pipeline" value={money(stats.pipeline)} />
          <Kpi icon={<Target />} label="Forecast" value={money(stats.weightedForecast)} />
          <Kpi icon={<CheckCircle2 />} label="Ventas" value={money(stats.wonAmount)} />
          <Kpi icon={<ClipboardList />} label="Pendientes" value={stats.activitiesPending} />
          <Kpi icon={<XCircle />} label="Vencidas" value={stats.activitiesOverdue} />
          <Kpi icon={<Trophy />} label="Cierre" value={`${stats.closeRate.toFixed(1)}%`} />
        </section>

        <section className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-4 shadow-2xl">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_260px]">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 text-slate-500" size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, teléfono, email, código, dirección o necesidad..."
                className="h-12 w-full rounded-2xl border border-slate-800 bg-[#030817] pl-12 pr-4 outline-none focus:border-cyan-500"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-3.5 text-slate-500" size={18} />
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-800 bg-[#030817] pl-12 pr-4 outline-none focus:border-cyan-500"
              >
                <option value="todos">Todas las etapas</option>
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-7">
          {STAGES.map((stage) => {
            const stageLeads = filteredLeads.filter((l) => l.stage === stage.key);
            const stageTotal = stageLeads.reduce((s, lead) => s + Number(lead.estimated_budget || 0), 0);

            return (
              <div key={stage.key} className="min-h-[280px] rounded-3xl border border-slate-800 bg-[#07111f] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black">{stage.name}</h2>
                    <p className="text-[10px] font-bold text-slate-500">{money(stageTotal)}</p>
                  </div>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-black">{stageLeads.length}</span>
                </div>
                <div className="space-y-3">
                  {stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onEdit={() => openEditLead(lead)}
                      onDelete={() => deleteLead(lead)}
                      onActivity={() => openActivity(lead)}
                      onQuote={() => openQuote(lead)}
                      onPrint={() => printLead(lead)}
                      onMove={(next) => moveStage(lead, next)}
                      onWon={() => markWon(lead)}
                      onLost={() => markLost(lead)}
                      onFollow={() => createQuickFollowup(lead)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="Forecast ponderado por etapa" icon={<Target className="text-cyan-300" />}>
            <div className="space-y-3">
              {forecastByStage.map((row) => (
                <div key={row.key} className="rounded-2xl border border-slate-800 bg-[#030817] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-black">{row.name}</p>
                        <p className="text-sm font-black text-cyan-300">{row.probability}%</p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-cyan-500" style={{ width: `${row.probability}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">{row.count} leads · Pipeline {money(row.pipelineValue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Forecast</p>
                      <p className="text-lg font-black text-emerald-300">{money(row.weightedValue)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Últimas actividades" icon={<ClipboardList className="text-cyan-300" />}>
            <div className="overflow-auto rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-[#0a1627] text-slate-300">
                  <tr>
                    <th className="p-3 text-left">Tipo</th>
                    <th className="p-3 text-left">Título</th>
                    <th className="p-3 text-left">Estado</th>
                    <th className="p-3 text-left">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.slice(0, 12).map((a) => (
                    <tr key={a.id} className="border-t border-slate-800">
                      <td className="p-3">{a.activity_type}</td>
                      <td className="p-3 font-bold">{a.title}</td>
                      <td className="p-3">{a.status}</td>
                      <td className="p-3 text-slate-400">{dateText(a.scheduled_at || a.created_at)}</td>
                    </tr>
                  ))}
                  {!activities.length && (
                    <tr>
                      <td className="p-6 text-center text-slate-500" colSpan={4}>
                        Sin actividades todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>
      </div>

      {showLeadModal && (
        <Modal title={selectedLead ? "Editar Lead" : "Nuevo Lead"} onClose={() => setShowLeadModal(false)}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Cliente">
              <input value={leadForm.customer_name || ""} onChange={(e) => setLeadForm({ ...leadForm, customer_name: e.target.value })} className="input" />
            </Field>
            <Field label="Teléfono">
              <input value={leadForm.phone || ""} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} className="input" />
            </Field>
            <Field label="Email">
              <input value={leadForm.email || ""} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} className="input" />
            </Field>
            <Field label="Fuente">
              <select value={leadForm.source || "manual"} onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })} className="input">
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo proyecto">
              <select value={leadForm.project_type || "otro"} onChange={(e) => setLeadForm({ ...leadForm, project_type: e.target.value })} className="input">
                {PROJECT_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Presupuesto">
              <input type="number" value={leadForm.estimated_budget || 0} onChange={(e) => setLeadForm({ ...leadForm, estimated_budget: Number(e.target.value) })} className="input" />
            </Field>
            <Field label="Etapa">
              <select value={leadForm.stage || "prospecto"} onChange={(e) => setLeadForm({ ...leadForm, stage: e.target.value })} className="input">
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prioridad">
              <select value={leadForm.priority || "media"} onChange={(e) => setLeadForm({ ...leadForm, priority: e.target.value })} className="input">
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="caliente">Caliente</option>
                <option value="urgente">Urgente</option>
              </select>
            </Field>
            <Field label="Asignado a">
              <input value={leadForm.assigned_to || ""} onChange={(e) => setLeadForm({ ...leadForm, assigned_to: e.target.value })} className="input" />
            </Field>
            <Field label="Fecha cierre">
              <input type="date" value={leadForm.expected_close_date || ""} onChange={(e) => setLeadForm({ ...leadForm, expected_close_date: e.target.value })} className="input" />
            </Field>
            <Field label="Dirección" full>
              <input value={leadForm.address || ""} onChange={(e) => setLeadForm({ ...leadForm, address: e.target.value })} className="input" />
            </Field>
            <Field label="Necesidad" full>
              <textarea value={leadForm.need_description || ""} onChange={(e) => setLeadForm({ ...leadForm, need_description: e.target.value })} className="textarea" />
            </Field>
            <Field label="Notas" full>
              <textarea value={leadForm.notes || ""} onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })} className="textarea" />
            </Field>
          </div>
          <button onClick={saveLead} disabled={savingLead} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 font-black">
            {savingLead ? <Loader2 className="animate-spin" /> : <Save />}
            Guardar Lead
          </button>
        </Modal>
      )}

      {showActivityModal && selectedLead && (
        <Modal title={`Actividad - ${selectedLead.customer_name}`} onClose={() => setShowActivityModal(false)}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Tipo">
              <select value={activityForm.activity_type || "nota"} onChange={(e) => setActivityForm({ ...activityForm, activity_type: e.target.value })} className="input">
                <option value="whatsapp">WhatsApp</option>
                <option value="llamada">Llamada</option>
                <option value="reunion">Reunión</option>
                <option value="visita">Visita</option>
                <option value="nota">Nota</option>
                <option value="seguimiento">Seguimiento</option>
              </select>
            </Field>
            <Field label="Fecha programada">
              <input type="datetime-local" value={activityForm.scheduled_at || ""} onChange={(e) => setActivityForm({ ...activityForm, scheduled_at: e.target.value })} className="input" />
            </Field>
            <Field label="Título" full>
              <input value={activityForm.title || ""} onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })} className="input" />
            </Field>
            <Field label="Descripción" full>
              <textarea value={activityForm.description || ""} onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })} className="textarea" />
            </Field>
          </div>
          <button onClick={saveActivity} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 font-black">
            <Save /> Guardar Actividad
          </button>
        </Modal>
      )}

      {showQuoteModal && selectedLead && (
        <Modal title={`Cotización - ${selectedLead.customer_name}`} onClose={() => setShowQuoteModal(false)}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Subtotal">
              <input
                type="number"
                value={quoteForm.subtotal || 0}
                onChange={(e) => {
                  const next = { ...quoteForm, subtotal: Number(e.target.value) };
                  setQuoteForm({ ...next, total: recalcQuote(next) });
                }}
                className="input"
              />
            </Field>
            <Field label="Descuento">
              <input
                type="number"
                value={quoteForm.discount || 0}
                onChange={(e) => {
                  const next = { ...quoteForm, discount: Number(e.target.value) };
                  setQuoteForm({ ...next, total: recalcQuote(next) });
                }}
                className="input"
              />
            </Field>
            <Field label="ITBIS">
              <input
                type="number"
                value={quoteForm.tax || 0}
                onChange={(e) => {
                  const next = { ...quoteForm, tax: Number(e.target.value) };
                  setQuoteForm({ ...next, total: recalcQuote(next) });
                }}
                className="input"
              />
            </Field>
            <Field label="Válida hasta">
              <input type="date" value={quoteForm.valid_until || ""} onChange={(e) => setQuoteForm({ ...quoteForm, valid_until: e.target.value })} className="input" />
            </Field>
            <Field label="Estado">
              <select value={quoteForm.status || "borrador"} onChange={(e) => setQuoteForm({ ...quoteForm, status: e.target.value })} className="input">
                <option value="borrador">Borrador</option>
                <option value="enviada">Enviada</option>
                <option value="aprobada">Aprobada</option>
                <option value="rechazada">Rechazada</option>
              </select>
            </Field>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="text-xs font-black tracking-[0.2em] text-emerald-300">TOTAL</div>
              <div className="text-2xl font-black">{money(quoteForm.total)}</div>
            </div>
            <Field label="Descripción" full>
              <textarea value={quoteForm.description || ""} onChange={(e) => setQuoteForm({ ...quoteForm, description: e.target.value })} className="textarea" />
            </Field>
            <Field label="Notas" full>
              <textarea value={quoteForm.notes || ""} onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })} className="textarea" />
            </Field>
          </div>
          <button onClick={saveQuote} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 font-black">
            <Save /> Crear Cotización
          </button>
        </Modal>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          height: 46px;
          border-radius: 14px;
          border: 1px solid #243247;
          background: #030817;
          padding: 0 14px;
          outline: none;
          color: white;
        }
        .input:focus {
          border-color: #06b6d4;
        }
        .textarea {
          width: 100%;
          min-height: 95px;
          border-radius: 14px;
          border: 1px solid #243247;
          background: #030817;
          padding: 12px 14px;
          outline: none;
          color: white;
        }
        .textarea:focus {
          border-color: #06b6d4;
        }
      `}</style>
    </main>
  );
}

function Kpi({ icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-[#07111f] p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</div>
        <div className="rounded-2xl bg-cyan-500/10 p-2 text-cyan-300">{icon}</div>
      </div>
      <div className="mt-3 text-xl font-black">{value}</div>
    </div>
  );
}

function LeadCard({
  lead,
  onEdit,
  onDelete,
  onActivity,
  onQuote,
  onPrint,
  onMove,
  onWon,
  onLost,
  onFollow,
}: {
  lead: Lead;
  onEdit: () => void;
  onDelete: () => void;
  onActivity: () => void;
  onQuote: () => void;
  onPrint: () => void;
  onMove: (stage: string) => void;
  onWon: () => void;
  onLost: () => void;
  onFollow: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#030817] p-3 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-black text-cyan-300">{lead.lead_code}</div>
          <div className="text-sm font-black leading-tight">{lead.customer_name}</div>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${stageClass(lead.stage)}`}>{stageLabel(lead.stage)}</span>
      </div>

      <div className="mt-2 space-y-1 text-xs text-slate-400">
        <div>{lead.project_type || "otro"}</div>
        <div className="font-black text-emerald-300">{money(lead.estimated_budget)}</div>
        <div>{lead.phone || "-"}</div>
        <div className="flex flex-wrap gap-1">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${priorityClass(lead.priority)}`}>{lead.priority || "media"}</span>
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black text-cyan-200">
            {stageProbability(lead.stage)}%
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={onEdit} className="btn-mini"><Edit3 size={13} /> Editar</button>
        <button onClick={onActivity} className="btn-mini"><Activity size={13} /> Act.</button>
        <button onClick={onQuote} className="btn-mini"><CircleDollarSign size={13} /> Cot.</button>
        <button onClick={onPrint} className="btn-mini"><Eye size={13} /> Ficha</button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <a href={whatsappLink(lead.phone, `Hola ${lead.customer_name}, le escribimos de RD Wood System sobre su proyecto de ${lead.project_type}.`)} target="_blank" className="btn-mini border-emerald-500/40 bg-emerald-600/20 text-emerald-200">
          <MessageCircle size={13} /> WhatsApp
        </a>
        <a href={lead.phone ? `tel:${lead.phone}` : "#"} className="btn-mini border-blue-500/40 bg-blue-600/20 text-blue-200">
          <Phone size={13} /> Llamar
        </a>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <button onClick={onFollow} className="btn-mini border-cyan-500/40 bg-cyan-600/20 text-cyan-200">Seg.</button>
        <button onClick={onWon} className="btn-mini border-emerald-500/40 bg-emerald-600/20 text-emerald-200">Ganar</button>
        <button onClick={onLost} className="btn-mini border-red-500/40 bg-red-600/20 text-red-200">Perder</button>
      </div>

      <select value={lead.stage || "prospecto"} onChange={(e) => onMove(e.target.value)} className="mt-2 h-9 w-full rounded-xl border border-slate-800 bg-[#07111f] px-2 text-xs">
        {STAGES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name}
          </option>
        ))}
      </select>

      <button onClick={onDelete} className="mt-2 flex h-8 w-full items-center justify-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 text-xs font-black text-red-200">
        <Trash2 size={13} /> Eliminar
      </button>

      <style jsx>{`
        .btn-mini {
          min-height: 34px;
          border-radius: 12px;
          border: 1px solid #243247;
          background: #0a1627;
          color: #dbeafe;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 900;
        }
      `}</style>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: any; children: any }) {
  return (
    <section className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5 shadow-2xl">
      <h2 className="mb-4 flex items-center gap-2 text-2xl font-black">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children, full }: { label: string; children: any; full?: boolean }) {
  return (
    <label className={full ? "md:col-span-2" : ""}>
      <div className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</div>
      {children}
    </label>
  );
}

function Modal({ title, children, onClose }: { title: string; children: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl border border-cyan-900/60 bg-[#07111f] p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">{title}</h2>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
