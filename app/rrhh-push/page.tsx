"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Send, RefreshCw, CheckCircle2, XCircle, Clock, Smartphone, Search, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  employee_code: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string | null;
};

type PushSub = {
  id: string;
  employee_id: string | null;
  endpoint: string;
  is_active: boolean | null;
  device_name: string | null;
  user_agent: string | null;
  last_seen_at: string | null;
  created_at: string;
  employee_code?: string | null;
  full_name?: string | null;
};

type PushQueue = {
  id: string;
  employee_id: string | null;
  title: string;
  body: string;
  url: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  employee_code?: string | null;
  full_name?: string | null;
  active_subscriptions?: number | null;
};

type PayrollPeriod = {
  id: string;
  name: string;
  status: string | null;
};

export default function RRHHPushPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [subs, setSubs] = useState<PushSub[]>([]);
  const [queue, setQueue] = useState<PushQueue[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    employee_id: "",
    title: "RD Wood System",
    body: "",
    url: "/portal-empleado",
  });

  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const stats = useMemo(() => ({
    subs: subs.filter((s) => s.is_active).length,
    pending: queue.filter((q) => q.status === "pendiente").length,
    sent: queue.filter((q) => q.status === "enviado").length,
    failed: queue.filter((q) => q.status === "fallido").length,
  }), [subs, queue]);

  const filteredQueue = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter((item) =>
      [item.full_name, item.employee_code, item.title, item.body, item.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [queue, search]);

  async function loadAll() {
    try {
      setLoading(true);
      setMessage("");

      const [empRes, subRes, queueRes, periodRes] = await Promise.all([
        supabase.from("employees").select("id, employee_code, full_name, phone, email, status").order("full_name"),
        supabase.from("v_employee_push_subscriptions_detail").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("v_push_notification_queue_detail").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("payroll_periods").select("id, name, status").order("created_at", { ascending: false }).limit(20),
      ]);

      if (empRes.error) throw empRes.error;
      if (subRes.error) throw subRes.error;
      if (queueRes.error) throw queueRes.error;
      if (periodRes.error) throw periodRes.error;

      setEmployees((empRes.data || []) as Employee[]);
      setSubs((subRes.data || []) as PushSub[]);
      setQueue((queueRes.data || []) as PushQueue[]);
      setPeriods((periodRes.data || []) as PayrollPeriod[]);

      const firstEmployee = (empRes.data || [])[0] as Employee | undefined;
      if (firstEmployee && !form.employee_id) setForm((f) => ({ ...f, employee_id: firstEmployee.id }));

      const firstPeriod = (periodRes.data || [])[0] as PayrollPeriod | undefined;
      if (firstPeriod && !selectedPeriodId) setSelectedPeriodId(firstPeriod.id);
    } catch (error: any) {
      setMessage(error.message || "Error cargando push.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enqueueManualPush() {
    if (!form.employee_id || !form.title.trim() || !form.body.trim()) {
      setMessage("Completa empleado, título y mensaje.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.rpc("enqueue_push_notification", {
        p_employee_id: form.employee_id,
        p_title: form.title,
        p_body: form.body,
        p_url: form.url || "/portal-empleado",
      });

      if (error) throw error;

      setForm({ ...form, body: "" });
      setMessage("Push agregado a la cola.");
      await loadAll();
    } catch (error: any) {
      setMessage(error.message || "Error creando push.");
    } finally {
      setLoading(false);
    }
  }

  async function enqueuePayrollPushes() {
    if (!selectedPeriodId) return setMessage("Selecciona un periodo.");

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("enqueue_payroll_pushes", {
        p_payroll_period_id: selectedPeriodId,
      });

      if (error) throw error;

      setMessage(`Push de nómina generados: ${data || 0}`);
      await loadAll();
    } catch (error: any) {
      setMessage(error.message || "Error generando push de nómina.");
    } finally {
      setLoading(false);
    }
  }

  async function markSent(id: string) {
    const { error } = await supabase.rpc("mark_push_sent", { p_push_id: id });
    if (error) return setMessage(error.message);
    setMessage("Push marcado como enviado.");
    await loadAll();
  }

  async function markFailed(id: string) {
    const reason = window.prompt("Motivo del fallo:", "No enviado todavía");
    if (reason === null) return;

    const { error } = await supabase.rpc("mark_push_failed", {
      p_push_id: id,
      p_error: reason,
    });

    if (error) return setMessage(error.message);
    setMessage("Push marcado como fallido.");
    await loadAll();
  }

  async function deletePush(id: string) {
    if (!window.confirm("¿Eliminar este push?")) return;

    const { error } = await supabase.from("push_notification_queue").delete().eq("id", id);
    if (error) return setMessage(error.message);

    setMessage("Push eliminado.");
    await loadAll();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">RD Wood System</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-5xl">Push Notifications Pro</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Fase 9: suscripciones push, cola de envíos, modo offline y PWA avanzada.
              </p>
            </div>

            <button onClick={loadAll} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-lg hover:bg-blue-100">
              <RefreshCw size={18} />
              Actualizar
            </button>
          </div>
        </section>

        {message && (
          <div className="mb-4 rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
            {message}
          </div>
        )}

        {loading && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            Procesando...
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi title="Dispositivos" value={stats.subs} icon={<Smartphone size={20} />} />
          <Kpi title="Pendientes" value={stats.pending} icon={<Clock size={20} />} />
          <Kpi title="Enviadas" value={stats.sent} icon={<CheckCircle2 size={20} />} />
          <Kpi title="Fallidas" value={stats.failed} icon={<XCircle size={20} />} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <div className="grid gap-4">
            <Panel title="Push manual" icon={<Send size={20} />}>
              <div className="grid gap-3">
                <Select label="Empleado" value={form.employee_id} onChange={(v) => setForm({ ...form, employee_id: v })}>
                  <option value="">Seleccionar...</option>
                  {employees.filter((e) => e.status === "activo").map((e) => (
                    <option key={e.id} value={e.id}>{e.employee_code} - {e.full_name}</option>
                  ))}
                </Select>

                <Input label="Título" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
                <Input label="URL al abrir" value={form.url} onChange={(v) => setForm({ ...form, url: v })} />
                <TextArea label="Mensaje" value={form.body} onChange={(v) => setForm({ ...form, body: v })} />

                <button onClick={enqueueManualPush} className="rounded-2xl bg-blue-600 px-4 py-3 font-black hover:bg-blue-500">
                  Agregar push a cola
                </button>
              </div>
            </Panel>

            <Panel title="Push masivo nómina" icon={<Bell size={20} />}>
              <div className="grid gap-3">
                <Select label="Periodo" value={selectedPeriodId} onChange={setSelectedPeriodId}>
                  <option value="">Seleccionar...</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.status}</option>
                  ))}
                </Select>

                <button onClick={enqueuePayrollPushes} className="rounded-2xl bg-emerald-600 px-4 py-3 font-black hover:bg-emerald-500">
                  Generar push de recibos
                </button>
              </div>
            </Panel>
          </div>

          <Panel title="Cola push" icon={<Bell size={20} />}>
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
              <Search size={18} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar push..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-3">
              {filteredQueue.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black">{item.title}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                          item.status === "enviado"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : item.status === "fallido"
                            ? "bg-red-500/15 text-red-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}>
                          {item.status}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-400">
                        {item.employee_code} · {item.full_name} · Dispositivos: {item.active_subscriptions || 0}
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{item.body}</p>

                      {item.error_message && (
                        <p className="mt-2 text-xs text-red-300">Error: {item.error_message}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.status !== "enviado" && (
                        <button onClick={() => markSent(item.id)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold hover:bg-emerald-500">
                          Enviado
                        </button>
                      )}
                      <button onClick={() => markFailed(item.id)} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold hover:bg-red-500">
                        Falló
                      </button>
                      <button onClick={() => deletePush(item.id)} className="rounded-xl bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {!filteredQueue.length && (
                <p className="text-sm text-slate-400">No hay push notifications.</p>
              )}
            </div>
          </Panel>
        </section>

        <section className="mt-4">
          <Panel title="Dispositivos suscritos" icon={<Smartphone size={20} />}>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {subs.map((s) => (
                <div key={s.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <p className="font-black">{s.full_name || "Sin empleado"}</p>
                  <p className="text-xs text-slate-400">{s.employee_code} · {s.device_name || "PWA"}</p>
                  <p className="mt-2 break-all text-xs text-slate-500">{s.endpoint.slice(0, 90)}...</p>
                  <p className="mt-2 text-xs text-blue-200">
                    {s.is_active ? "Activo" : "Inactivo"} · {s.last_seen_at ? new Date(s.last_seen_at).toLocaleString("es-DO") : "-"}
                  </p>
                </div>
              ))}

              {!subs.length && (
                <p className="text-sm text-slate-400">Aún no hay dispositivos suscritos.</p>
              )}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Kpi({ title, value, icon }: { title: string; value: any; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
        {icon}
      </div>
      <p className="text-xs uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
          {icon}
        </div>
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
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-400"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-28 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-400"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-400"
      >
        {children}
      </select>
    </label>
  );
}
