
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell, RefreshCw, Send, CheckCircle2, XCircle, Clock, Settings,
  MessageCircle, Mail, Inbox, Save, Search, Trash2
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  employee_code: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  department: string | null;
  position: string | null;
  status: string | null;
};

type NotificationSetting = {
  id: string;
  channel: string;
  provider: string | null;
  is_active: boolean | null;
  webhook_url: string | null;
  api_token: string | null;
  sender_name: string | null;
  sender_email: string | null;
  sender_phone: string | null;
  notes: string | null;
};

type NotificationTemplate = {
  id: string;
  code: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  is_active: boolean | null;
};

type NotificationQueue = {
  id: string;
  employee_id: string | null;
  channel: string;
  template_code: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  subject: string | null;
  body: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  employee_code?: string | null;
  employee_name?: string | null;
};

type PayrollPeriod = {
  id: string;
  name: string;
  code: string | null;
  start_date: string;
  end_date: string;
  status: string | null;
};

type Tab = "dashboard" | "queue" | "manual" | "templates" | "settings";

function channelIcon(channel: string) {
  if (channel === "whatsapp") return <MessageCircle size={18} />;
  if (channel === "email") return <Mail size={18} />;
  return <Inbox size={18} />;
}

export default function RRHHNotificacionesPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [queue, setQueue] = useState<NotificationQueue[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [manualForm, setManualForm] = useState({
    employee_id: "",
    channel: "interno",
    subject: "",
    body: "",
  });

  const [templateForm, setTemplateForm] = useState({
    code: "",
    name: "",
    channel: "interno",
    subject: "",
    body: "",
  });

  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const stats = useMemo(() => ({
    total: queue.length,
    pending: queue.filter((q) => q.status === "pendiente").length,
    sent: queue.filter((q) => q.status === "enviado").length,
    failed: queue.filter((q) => q.status === "fallido").length,
  }), [queue]);

  const filteredQueue = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter((n) =>
      [n.employee_name, n.employee_code, n.recipient_name, n.recipient_email, n.recipient_phone, n.subject, n.body, n.status, n.channel]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [queue, search]);

  async function loadAll() {
    try {
      setLoading(true);
      setMessage("");

      const [empRes, cfgRes, tempRes, queueRes, periodRes] = await Promise.all([
        supabase.from("employees").select("*").order("full_name", { ascending: true }),
        supabase.from("notification_settings").select("*").order("channel", { ascending: true }),
        supabase.from("notification_templates").select("*").order("created_at", { ascending: false }),
        supabase.from("v_notification_queue_detail").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("payroll_periods").select("*").order("created_at", { ascending: false }).limit(20),
      ]);

      if (empRes.error) throw empRes.error;
      if (cfgRes.error) throw cfgRes.error;
      if (tempRes.error) throw tempRes.error;
      if (queueRes.error) throw queueRes.error;
      if (periodRes.error) throw periodRes.error;

      setEmployees((empRes.data || []) as Employee[]);
      setSettings((cfgRes.data || []) as NotificationSetting[]);
      setTemplates((tempRes.data || []) as NotificationTemplate[]);
      setQueue((queueRes.data || []) as NotificationQueue[]);
      setPeriods((periodRes.data || []) as PayrollPeriod[]);

      const firstEmployee = (empRes.data || [])[0] as Employee | undefined;
      if (firstEmployee && !manualForm.employee_id) setManualForm((f) => ({ ...f, employee_id: firstEmployee.id }));

      const firstPeriod = (periodRes.data || [])[0] as PayrollPeriod | undefined;
      if (firstPeriod && !selectedPeriodId) setSelectedPeriodId(firstPeriod.id);
    } catch (error: any) {
      setMessage(error.message || "Error cargando notificaciones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createManualNotification() {
    if (!manualForm.employee_id || !manualForm.body.trim()) {
      setMessage("Selecciona empleado y escribe el mensaje.");
      return;
    }

    const employee = employees.find((e) => e.id === manualForm.employee_id);

    try {
      setLoading(true);
      const { error } = await supabase.from("notification_queue").insert({
        employee_id: manualForm.employee_id,
        channel: manualForm.channel,
        template_code: "MANUAL",
        recipient_name: employee?.full_name || null,
        recipient_email: employee?.email || null,
        recipient_phone: employee?.phone || null,
        subject: manualForm.subject || "Notificación RD Wood System",
        body: manualForm.body,
        status: "pendiente",
      });

      if (error) throw error;

      setManualForm({ ...manualForm, subject: "", body: "" });
      setMessage("Notificación agregada a la cola.");
      await loadAll();
    } catch (error: any) {
      setMessage(error.message || "Error creando notificación.");
    } finally {
      setLoading(false);
    }
  }

  async function markSent(id: string) {
    const { error } = await supabase.rpc("mark_notification_sent", { p_notification_id: id });
    if (error) return setMessage(error.message);
    setMessage("Notificación marcada como enviada.");
    await loadAll();
  }

  async function markFailed(id: string) {
    const reason = window.prompt("Motivo del fallo:", "No enviado");
    if (reason === null) return;
    const { error } = await supabase.rpc("mark_notification_failed", { p_notification_id: id, p_error: reason });
    if (error) return setMessage(error.message);
    setMessage("Notificación marcada como fallida.");
    await loadAll();
  }

  async function requeue(id: string) {
    const { error } = await supabase.from("notification_queue").update({ status: "pendiente", error_message: null, sent_at: null }).eq("id", id);
    if (error) return setMessage(error.message);
    setMessage("Notificación reenviada a pendientes.");
    await loadAll();
  }

  async function deleteNotification(id: string) {
    if (!window.confirm("¿Eliminar esta notificación?")) return;
    const { error } = await supabase.from("notification_queue").delete().eq("id", id);
    if (error) return setMessage(error.message);
    setMessage("Notificación eliminada.");
    await loadAll();
  }

  async function saveSetting(setting: NotificationSetting) {
    const { error } = await supabase.from("notification_settings").update({
      provider: setting.provider,
      is_active: setting.is_active,
      webhook_url: setting.webhook_url,
      api_token: setting.api_token,
      sender_name: setting.sender_name,
      sender_email: setting.sender_email,
      sender_phone: setting.sender_phone,
      notes: setting.notes,
    }).eq("id", setting.id);

    if (error) return setMessage(error.message);
    setMessage("Configuración guardada.");
    await loadAll();
  }

  async function createTemplate() {
    if (!templateForm.code.trim() || !templateForm.name.trim() || !templateForm.body.trim()) {
      setMessage("Completa código, nombre y mensaje.");
      return;
    }

    const { error } = await supabase.from("notification_templates").insert({
      code: templateForm.code.trim().toUpperCase().replace(/\s+/g, "_"),
      name: templateForm.name,
      channel: templateForm.channel,
      subject: templateForm.subject || null,
      body: templateForm.body,
      is_active: true,
    });

    if (error) return setMessage(error.message);

    setTemplateForm({ code: "", name: "", channel: "interno", subject: "", body: "" });
    setMessage("Plantilla creada.");
    await loadAll();
  }

  async function toggleTemplate(template: NotificationTemplate) {
    const { error } = await supabase.from("notification_templates").update({ is_active: !template.is_active }).eq("id", template.id);
    if (error) return setMessage(error.message);
    setMessage("Plantilla actualizada.");
    await loadAll();
  }

  async function notifyPayrollReady() {
    if (!selectedPeriodId) return setMessage("Selecciona un periodo de nómina.");

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("notify_payroll_period_ready", { p_payroll_period_id: selectedPeriodId });
      if (error) throw error;
      setMessage(`Notificaciones de nómina generadas: ${data || 0}.`);
      await loadAll();
    } catch (error: any) {
      setMessage(error.message || "Error notificando nómina.");
    } finally {
      setLoading(false);
    }
  }

  function openWhatsApp(n: NotificationQueue) {
    const phone = (n.recipient_phone || "").replace(/[^\d]/g, "");
    if (!phone) return setMessage("Este empleado no tiene teléfono.");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(n.body)}`, "_blank");
  }

  function openEmail(n: NotificationQueue) {
    if (!n.recipient_email) return setMessage("Este empleado no tiene email.");
    window.open(`mailto:${n.recipient_email}?subject=${encodeURIComponent(n.subject || "RD Wood System")}&body=${encodeURIComponent(n.body)}`, "_blank");
  }

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: Bell },
    { id: "queue", label: "Cola", icon: Inbox },
    { id: "manual", label: "Manual", icon: Send },
    { id: "templates", label: "Plantillas", icon: MessageCircle },
    { id: "settings", label: "Configuración", icon: Settings },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">RD Wood System</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-5xl">RRHH Notificaciones Pro</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Fase 7: cola de notificaciones, WhatsApp manual, email, plantillas y alertas internas.
              </p>
            </div>
            <button onClick={loadAll} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-lg hover:bg-blue-100">
              <RefreshCw size={18} /> Actualizar
            </button>
          </div>
        </section>

        {message && <div className="mb-4 rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">{message}</div>}

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi title="Total" value={stats.total} icon={<Bell size={20} />} />
          <Kpi title="Pendientes" value={stats.pending} icon={<Clock size={20} />} />
          <Kpi title="Enviadas" value={stats.sent} icon={<CheckCircle2 size={20} />} />
          <Kpi title="Fallidas" value={stats.failed} icon={<XCircle size={20} />} />
        </section>

        <section className="mb-6 flex gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-white/5 p-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button key={item.id} onClick={() => setTab(item.id as Tab)} className={`flex min-w-max items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10"}`}>
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </section>

        {loading && <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">Procesando...</div>}

        {tab === "dashboard" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="Acciones rápidas" icon={<Send size={20} />}>
              <div className="grid gap-3">
                <Select label="Periodo de nómina" value={selectedPeriodId} onChange={setSelectedPeriodId}>
                  <option value="">Seleccionar...</option>
                  {periods.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.status}</option>)}
                </Select>
                <button onClick={notifyPayrollReady} className="rounded-2xl bg-blue-600 px-4 py-3 font-black hover:bg-blue-500">
                  Generar notificaciones de recibos disponibles
                </button>
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  Fase 7 deja la cola lista. WhatsApp puede abrirse manual con botón o conectarse luego por webhook/Twilio/Meta API.
                </div>
              </div>
            </Panel>

            <Panel title="Últimas notificaciones" icon={<Inbox size={20} />}>
              <NotificationList queue={queue.slice(0, 8)} onSent={markSent} onFailed={markFailed} onRequeue={requeue} onDelete={deleteNotification} onWhatsApp={openWhatsApp} onEmail={openEmail} />
            </Panel>
          </section>
        )}

        {tab === "queue" && (
          <Panel title="Cola de notificaciones" icon={<Inbox size={20} />}>
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
              <Search size={18} className="text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por empleado, mensaje, estado..." className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" />
            </div>
            <NotificationList queue={filteredQueue} onSent={markSent} onFailed={markFailed} onRequeue={requeue} onDelete={deleteNotification} onWhatsApp={openWhatsApp} onEmail={openEmail} />
          </Panel>
        )}

        {tab === "manual" && (
          <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
            <Panel title="Nueva notificación manual" icon={<Send size={20} />}>
              <div className="grid gap-3">
                <Select label="Empleado" value={manualForm.employee_id} onChange={(v) => setManualForm({ ...manualForm, employee_id: v })}>
                  <option value="">Seleccionar...</option>
                  {employees.filter((e) => e.status === "activo").map((e) => <option key={e.id} value={e.id}>{e.employee_code} - {e.full_name}</option>)}
                </Select>
                <Select label="Canal" value={manualForm.channel} onChange={(v) => setManualForm({ ...manualForm, channel: v })}>
                  <option value="interno">Interno</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                </Select>
                <Input label="Asunto" value={manualForm.subject} onChange={(v) => setManualForm({ ...manualForm, subject: v })} />
                <TextArea label="Mensaje" value={manualForm.body} onChange={(v) => setManualForm({ ...manualForm, body: v })} />
                <button onClick={createManualNotification} className="rounded-2xl bg-blue-600 px-4 py-3 font-black hover:bg-blue-500">Agregar a cola</button>
              </div>
            </Panel>
            <Panel title="Vista previa" icon={<Bell size={20} />}>
              <div className="rounded-3xl border border-white/10 bg-slate-900 p-5">
                <p className="text-xs uppercase tracking-wider text-slate-400">{manualForm.channel}</p>
                <h3 className="mt-2 text-xl font-black">{manualForm.subject || "Sin asunto"}</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{manualForm.body || "Escribe el mensaje para ver la vista previa."}</p>
              </div>
            </Panel>
          </section>
        )}

        {tab === "templates" && (
          <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
            <Panel title="Crear plantilla" icon={<MessageCircle size={20} />}>
              <div className="grid gap-3">
                <Input label="Código" value={templateForm.code} onChange={(v) => setTemplateForm({ ...templateForm, code: v })} />
                <Input label="Nombre" value={templateForm.name} onChange={(v) => setTemplateForm({ ...templateForm, name: v })} />
                <Select label="Canal" value={templateForm.channel} onChange={(v) => setTemplateForm({ ...templateForm, channel: v })}>
                  <option value="interno">Interno</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                </Select>
                <Input label="Asunto" value={templateForm.subject} onChange={(v) => setTemplateForm({ ...templateForm, subject: v })} />
                <TextArea label="Mensaje" value={templateForm.body} onChange={(v) => setTemplateForm({ ...templateForm, body: v })} />
                <button onClick={createTemplate} className="rounded-2xl bg-blue-600 px-4 py-3 font-black hover:bg-blue-500">Guardar plantilla</button>
              </div>
            </Panel>

            <Panel title="Plantillas existentes" icon={<MessageCircle size={20} />}>
              <div className="space-y-3">
                {templates.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">{channelIcon(t.channel)}<h3 className="font-black">{t.name}</h3></div>
                        <p className="mt-1 text-xs text-slate-400">{t.code} · {t.channel} · {t.is_active ? "Activa" : "Inactiva"}</p>
                        <p className="mt-2 text-sm text-slate-300">{t.body}</p>
                      </div>
                      <button onClick={() => toggleTemplate(t)} className={`rounded-xl px-3 py-2 text-xs font-bold ${t.is_active ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"}`}>
                        {t.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        )}

        {tab === "settings" && (
          <Panel title="Configuración de canales" icon={<Settings size={20} />}>
            <div className="grid gap-4 lg:grid-cols-3">
              {settings.map((s, index) => (
                <div key={s.id} className="rounded-3xl border border-white/10 bg-slate-900 p-5">
                  <div className="mb-4 flex items-center gap-2">{channelIcon(s.channel)}<h3 className="text-xl font-black capitalize">{s.channel}</h3></div>
                  <div className="grid gap-3">
                    <Input label="Proveedor" value={s.provider || ""} onChange={(v) => { const copy = [...settings]; copy[index] = { ...s, provider: v }; setSettings(copy); }} />
                    <Input label="Webhook URL" value={s.webhook_url || ""} onChange={(v) => { const copy = [...settings]; copy[index] = { ...s, webhook_url: v }; setSettings(copy); }} />
                    <Input label="API Token" value={s.api_token || ""} onChange={(v) => { const copy = [...settings]; copy[index] = { ...s, api_token: v }; setSettings(copy); }} />
                    <Input label="Nombre remitente" value={s.sender_name || ""} onChange={(v) => { const copy = [...settings]; copy[index] = { ...s, sender_name: v }; setSettings(copy); }} />
                    <Input label="Email remitente" value={s.sender_email || ""} onChange={(v) => { const copy = [...settings]; copy[index] = { ...s, sender_email: v }; setSettings(copy); }} />
                    <Input label="Teléfono remitente" value={s.sender_phone || ""} onChange={(v) => { const copy = [...settings]; copy[index] = { ...s, sender_phone: v }; setSettings(copy); }} />
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 p-4">
                      <input type="checkbox" checked={!!s.is_active} onChange={(e) => { const copy = [...settings]; copy[index] = { ...s, is_active: e.target.checked }; setSettings(copy); }} />
                      <span className="font-bold">Canal activo</span>
                    </label>
                    <button onClick={() => saveSetting(s)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-black hover:bg-blue-500">
                      <Save size={17} /> Guardar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Kpi({ title, value, icon }: { title: string; value: any; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">{icon}</div>
      <p className="text-xs uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">{icon}</div>
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-400" />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className="min-h-28 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-400" />
    </label>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-400">{children}</select>
    </label>
  );
}

function NotificationList({
  queue, onSent, onFailed, onRequeue, onDelete, onWhatsApp, onEmail,
}: {
  queue: NotificationQueue[];
  onSent: (id: string) => void;
  onFailed: (id: string) => void;
  onRequeue: (id: string) => void;
  onDelete: (id: string) => void;
  onWhatsApp: (n: NotificationQueue) => void;
  onEmail: (n: NotificationQueue) => void;
}) {
  return (
    <div className="space-y-3">
      {queue.map((n) => (
        <div key={n.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-blue-300">{channelIcon(n.channel)}</span>
                <h3 className="font-black">{n.recipient_name || n.employee_name || "Sin empleado"}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  n.status === "enviado" ? "bg-emerald-500/15 text-emerald-300" :
                  n.status === "fallido" ? "bg-red-500/15 text-red-300" :
                  n.status === "cancelado" ? "bg-slate-500/20 text-slate-300" :
                  "bg-amber-500/15 text-amber-300"
                }`}>{n.status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{n.channel} · {n.template_code || "manual"} · {new Date(n.created_at).toLocaleString("es-DO")}</p>
              {n.subject && <p className="mt-2 font-bold text-slate-200">{n.subject}</p>}
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{n.body}</p>
              {n.error_message && <p className="mt-2 text-xs text-red-300">Error: {n.error_message}</p>}
            </div>

            <div className="flex min-w-max flex-wrap gap-2">
              {n.channel === "whatsapp" && <button onClick={() => onWhatsApp(n)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold hover:bg-emerald-500">WhatsApp</button>}
              {n.channel === "email" && <button onClick={() => onEmail(n)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold hover:bg-blue-500">Email</button>}
              {n.status !== "enviado" && <button onClick={() => onSent(n.id)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold hover:bg-emerald-500">Enviado</button>}
              <button onClick={() => onFailed(n.id)} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold hover:bg-red-500">Falló</button>
              <button onClick={() => onRequeue(n.id)} className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-bold hover:bg-slate-600">Reintentar</button>
              <button onClick={() => onDelete(n.id)} className="rounded-xl bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20"><Trash2 size={15} /></button>
            </div>
          </div>
        </div>
      ))}
      {!queue.length && <p className="text-sm text-slate-400">No hay notificaciones.</p>}
    </div>
  );
}
