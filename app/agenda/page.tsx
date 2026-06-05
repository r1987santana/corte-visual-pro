"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Plus,
  RefreshCw,
  Trash2,
  Clock3,
  User,
  MapPin,
  Phone,
  Loader2,
  Users,
  CreditCard,
  UploadCloud,
  CheckCircle2,
  ReceiptText,
  Ruler,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  event_type: string;
  status: string;
  client_id?: string | null;
  client_name?: string | null;
  phone?: string | null;
  address?: string | null;
  start_at: string;
  end_at?: string | null;
  color?: string | null;
  payment_required?: boolean | null;
  payment_status?: string | null;
  measurement_fee?: number | null;
  amount_paid?: number | null;
  payment_reference?: string | null;
};

type Client = {
  id: string;
  name?: string | null;
  nombre?: string | null;
  full_name?: string | null;
  phone?: string | null;
  telefono?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  direccion?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type PaymentHistory = {
  id: string;
  payment_code?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  calendar_event_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  payment_method?: string | null;
  concept?: string | null;
  reference?: string | null;
  support_url?: string | null;
  support_name?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type FieldMeasurement = {
  id: string;
  code?: string | null;
  measurement_no?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  project_name?: string | null;
  project_type?: string | null;
  status?: string | null;
  estado?: string | null;
  created_at?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
  ceiling_height_mm?: number | null;
  linear_feet?: number | null;
  calendar_event_id?: string | null;
  agenda_event_id?: string | null;
  visit_calendar_event_id?: string | null;
  visit_fee_reference?: string | null;
  real_space_json?: Record<string, any> | null;
};

const EVENT_COLORS: Record<string, string> = {
  medida: "#0ea5e9",
  produccion: "#8b5cf6",
  transporte: "#f59e0b",
  instalacion: "#10b981",
  cobro: "#ef4444",
  seguimiento: "#06b6d4",
  general: "#64748b",
};

const EVENT_LABELS: Record<string, string> = {
  medida: "Medida en obra",
  produccion: "Producción",
  transporte: "Transporte",
  instalacion: "Instalación",
  cobro: "Cobro",
  seguimiento: "Seguimiento",
  general: "General",
};

function formatDate(date: string) {
  return new Date(date).toLocaleString("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function money(value: any) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function escapeHtml(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function todayLocalInput() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function clientName(client: Client) {
  return (
    client.name ||
    client.full_name ||
    client.nombre ||
    "Cliente sin nombre"
  );
}

function clientPhone(client: Client) {
  return client.phone || client.telefono || client.whatsapp || "";
}

function clientAddress(client: Client) {
  return client.address || client.direccion || "";
}

function measurementCode(measurement: FieldMeasurement) {
  return measurement.code || measurement.measurement_no || measurement.id.slice(0, 8);
}

function measurementAgendaEventId(measurement: FieldMeasurement) {
  return (
    measurement.calendar_event_id ||
    measurement.agenda_event_id ||
    measurement.visit_calendar_event_id ||
    measurement.real_space_json?.agenda_event_id ||
    measurement.real_space_json?.calendar_event_id ||
    null
  );
}

export default function AgendaPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [measurements, setMeasurements] = useState<FieldMeasurement[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [client, setClient] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [eventType, setEventType] = useState("medida");
  const [startAt, setStartAt] = useState(todayLocalInput());

  const [measurementFee, setMeasurementFee] = useState(5000);
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [paymentEvent, setPaymentEvent] = useState<CalendarEvent | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(5000);
  const [paymentSupportFile, setPaymentSupportFile] = useState<File | null>(null);
  const [paymentReference, setPaymentReference] = useState("");

  async function loadClients() {
    setLoadingClients(true);

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando clientes:", error.message);
      setLoadingClients(false);
      return;
    }

    setClients((data || []) as Client[]);
    setLoadingClients(false);
  }

  async function loadEvents() {
    setLoading(true);

    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .order("start_at", { ascending: true });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setEvents((data || []) as CalendarEvent[]);
    setLoading(false);
  }

  async function loadPayments() {
    const { data, error } = await supabase
      .from("client_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("Error cargando historial de pagos:", error.message);
      setPayments([]);
      return;
    }

    setPayments((data || []) as PaymentHistory[]);
  }

  async function loadMeasurements() {
    const { data, error } = await supabase
      .from("field_measurements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("Error cargando levantamientos:", error.message);
      setMeasurements([]);
      return;
    }

    setMeasurements((data || []) as FieldMeasurement[]);
  }

  function handleSelectClient(id: string) {
    setSelectedClientId(id);

    const selected = clients.find((c) => c.id === id);

    if (!selected) {
      setClient("");
      setPhone("");
      setAddress("");
      return;
    }

    setClient(clientName(selected));
    setPhone(clientPhone(selected));
    setAddress(clientAddress(selected));
  }

  async function uploadPaymentSupport(paymentCode: string) {
    if (!paymentSupportFile) {
      throw new Error("Debes subir un soporte del pago.");
    }

    const filePath = `${paymentCode}/${Date.now()}_${cleanFileName(paymentSupportFile.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("payment-supports")
      .upload(filePath, paymentSupportFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: paymentSupportFile.type || "application/octet-stream",
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("payment-supports")
      .getPublicUrl(filePath);

    return {
      url: data.publicUrl,
      name: paymentSupportFile.name,
      path: filePath,
    };
  }

  function measurementReceiptHtml(payment: PaymentHistory, event?: CalendarEvent | null, incomeCode?: string | null) {
    const paymentCode = payment.payment_code || payment.reference || "PAGO";
    const clientLabel = payment.client_name || event?.client_name || "Cliente";
    const projectLabel = event?.title || "Pago medicion + render";
    const externalReference = payment.reference && payment.reference !== paymentCode ? payment.reference : "-";

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Recibo ${escapeHtml(paymentCode)}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 18px; font-family: Arial, sans-serif; color: #111827; background: #f8fafc; }
            .receipt { width: 760px; max-width: 100%; margin: 0 auto; border: 1px solid #111827; background: white; padding: 22px; }
            .top { display: flex; justify-content: space-between; gap: 18px; border-bottom: 2px solid #111827; padding-bottom: 14px; }
            h1 { margin: 0; font-size: 24px; letter-spacing: 0.08em; }
            h2 { margin: 8px 0 0; font-size: 18px; color: #0369a1; }
            .muted { color: #64748b; font-size: 12px; }
            .code { border: 1px solid #111827; padding: 8px 12px; font-size: 13px; font-weight: 800; text-align: right; }
            .amount { margin: 18px 0; border: 2px solid #047857; padding: 16px; text-align: center; color: #047857; font-size: 30px; font-weight: 900; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
            td { border: 1px solid #cbd5e1; padding: 9px; font-size: 13px; vertical-align: top; }
            td:first-child { width: 32%; background: #f1f5f9; font-weight: 800; text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; }
            .note { margin-top: 16px; border: 1px dashed #94a3b8; padding: 12px; font-size: 12px; color: #334155; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 44px; }
            .line { border-top: 1px solid #111827; padding-top: 8px; text-align: center; font-size: 12px; font-weight: 800; }
            @media print { body { background: white; padding: 0; } .receipt { border: 0; width: 100%; } }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="top">
              <div>
                <h1>RD WOOD SYSTEM</h1>
                <h2>Recibo de pago medicion + render</h2>
                <p class="muted">Comprobante de ingreso auditable generado desde Agenda.</p>
              </div>
              <div class="code">
                Recibo: ${escapeHtml(paymentCode)}<br />
                Ingreso: ${escapeHtml(incomeCode || payment.reference || "-")}<br />
                Fecha: ${escapeHtml(payment.created_at ? formatDate(payment.created_at) : formatDate(new Date().toISOString()))}
              </div>
            </div>

            <div class="amount">${money(payment.amount)}</div>

            <table>
              <tr><td>Cliente</td><td>${escapeHtml(clientLabel)}</td></tr>
              <tr><td>Proyecto / evento</td><td>${escapeHtml(projectLabel)}</td></tr>
              <tr><td>Telefono</td><td>${escapeHtml(event?.phone || "-")}</td></tr>
              <tr><td>Direccion</td><td>${escapeHtml(event?.address || "-")}</td></tr>
              <tr><td>Concepto</td><td>${escapeHtml(payment.concept || "Abono medicion + render")}</td></tr>
              <tr><td>Metodo</td><td>${escapeHtml(payment.payment_method || "efectivo")}</td></tr>
              <tr><td>Referencia externa</td><td>${escapeHtml(externalReference)}</td></tr>
              <tr><td>Estado</td><td>${escapeHtml(payment.status || "confirmado")}</td></tr>
            </table>

            <div class="note">
              Este abono se registra como credito del cliente y se descuenta segun la condicion comercial aprobada del proyecto.
            </div>

            <div class="signatures">
              <div class="line">Recibido por RD Wood</div>
              <div class="line">Cliente / autorizado</div>
            </div>
          </div>
          <script>
            window.onload = function () {
              setTimeout(function () { window.print(); }, 400);
            };
          </script>
        </body>
      </html>
    `;
  }

  function printMeasurementReceipt(payment: PaymentHistory, event?: CalendarEvent | null, incomeCode?: string | null, targetWindow?: Window | null) {
    const receiptWindow = targetWindow || window.open("", "_blank", "width=850,height=900");

    if (!receiptWindow) {
      alert("El navegador bloqueo la ventana del recibo. Usa el boton Imprimir en el historial de pagos.");
      return;
    }

    receiptWindow.document.open();
    receiptWindow.document.write(measurementReceiptHtml(payment, event, incomeCode));
    receiptWindow.document.close();
  }

  async function handleRegisterPayment() {
    if (!paymentEvent) return;

    if (!paymentEvent.client_id) {
      alert("Este evento no tiene cliente vinculado.");
      return;
    }

    const requiresSupport = paymentMethod !== "efectivo";

    if (requiresSupport && !paymentSupportFile) {
      alert("Debes subir el soporte del pago.");
      return;
    }

    const amount = Number(paymentAmount || paymentEvent.measurement_fee || 5000);

    if (amount <= 0) {
      alert("El monto debe ser mayor a cero.");
      return;
    }

    setSaving(true);
    const receiptWindow = window.open("", "_blank", "width=850,height=900");

    try {
      const { data: codeData, error: codeError } = await supabase.rpc("generate_sequential_code", {
        p_prefix: "ING",
      });

      if (codeError) throw codeError;

      const paymentCode = String(codeData || `ING-${Date.now()}`);

      let support: { url: string | null; name: string | null; path: string | null } = {
        url: null,
        name: null,
        path: null,
      };

      if (requiresSupport) {
        support = await uploadPaymentSupport(paymentCode);
      }

      const { data: payment, error: paymentError } = await supabase
        .from("client_payments")
        .insert({
          payment_code: paymentCode,
          client_id: paymentEvent.client_id,
          client_name: paymentEvent.client_name || null,
          calendar_event_id: paymentEvent.id,
          amount,
          currency: "DOP",
          payment_method: paymentMethod,
          concept: "Abono medición + render",
          reference: paymentReference || paymentCode,
          support_url: support.url,
          support_name: support.name,
          status: "confirmado",
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (paymentError) throw paymentError;

      const { data: incomeCodeData, error: incomeCodeError } = await supabase.rpc("generate_sequential_code", {
        p_prefix: "REC",
      });

      if (incomeCodeError) throw incomeCodeError;

      const incomeCode = String(incomeCodeData || `REC-${Date.now()}`);

      const { error: incomeError } = await supabase.from("income_records").insert({
        income_code: incomeCode,
        payment_id: payment.id,
        concept: "Ingreso por abono de medición + render",
        amount,
        account_name: paymentMethod === "efectivo" ? "Caja General" : "Banco / Transferencia",
        status: "registrado",
        created_at: new Date().toISOString(),
      });

      if (incomeError) throw incomeError;

      const { error: creditError } = await supabase.from("client_credits").insert({
        client_id: paymentEvent.client_id,
        client_name: paymentEvent.client_name || null,
        source_type: "measurement_render_fee",
        source_reference: paymentCode,
        calendar_event_id: paymentEvent.id,
        amount,
        applied_amount: 0,
        remaining_amount: amount,
        status: "disponible",
        notes: "Crédito generado por pago de medición + render.",
        created_at: new Date().toISOString(),
      });

      if (creditError) throw creditError;

      const { error: eventError } = await supabase
        .from("calendar_events")
        .update({
          payment_required: true,
          payment_status: "pagado",
          measurement_fee: amount,
          amount_paid: amount,
          payment_reference: paymentCode,
          status: "medicion_pagada",
        })
        .eq("id", paymentEvent.id);

      if (eventError) throw eventError;

      await supabase.from("audit_logs").insert({
        entity_name: "client_payments",
        entity_id: payment.id,
        action: "create_measurement_payment",
        payload: {
          payment_code: paymentCode,
          income_code: incomeCode,
          client_id: paymentEvent.client_id,
          calendar_event_id: paymentEvent.id,
          amount,
          support_url: support.url,
        },
        created_at: new Date().toISOString(),
      });

      printMeasurementReceipt(payment as PaymentHistory, paymentEvent, incomeCode, receiptWindow);
      alert(`Pago registrado correctamente. Codigo: ${paymentCode}`);
      setPaymentEvent(null);
      setPaymentSupportFile(null);
      setPaymentAmount(5000);
      setPaymentReference("");
      await refreshAll();
    } catch (error: any) {
      receiptWindow?.close();
      alert(error?.message || "Error registrando pago.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!title.trim() || !startAt) {
      alert("Completa título y fecha.");
      return;
    }

    if (!selectedClientId) {
      alert("Selecciona un cliente registrado.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("calendar_events").insert({
      title: title.trim(),
      client_id: selectedClientId || null,
      client_name: client.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      event_type: eventType,
      status: eventType === "medida" ? "pendiente_pago_medicion" : "pendiente",
      payment_required: eventType === "medida",
      payment_status: eventType === "medida" ? "pendiente" : "no_requiere",
      measurement_fee: eventType === "medida" ? Number(measurementFee || 5000) : 0,
      amount_paid: 0,
      payment_reference: null,
      start_at: new Date(startAt).toISOString(),
      color: EVENT_COLORS[eventType] || EVENT_COLORS.general,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setSelectedClientId("");
    setClient("");
    setPhone("");
    setAddress("");
    setEventType("medida");
    setStartAt(todayLocalInput());
    setMeasurementFee(5000);

    await refreshAll();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar evento?")) return;

    const { error } = await supabase.from("calendar_events").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await refreshAll();
  }

  async function refreshAll() {
    await Promise.all([loadEvents(), loadClients(), loadPayments(), loadMeasurements()]);
  }

  useEffect(() => {
    refreshAll();
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};

    for (const event of events) {
      const key = new Date(event.start_at).toLocaleDateString("es-DO", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      if (!map[key]) map[key] = [];
      map[key].push(event);
    }

    return map;
  }, [events]);

  const paymentsByEvent = useMemo(() => {
    const map: Record<string, PaymentHistory[]> = {};

    for (const payment of payments) {
      if (!payment.calendar_event_id) continue;
      if (!map[payment.calendar_event_id]) map[payment.calendar_event_id] = [];
      map[payment.calendar_event_id].push(payment);
    }

    return map;
  }, [payments]);

  const measurementsByEvent = useMemo(() => {
    const map: Record<string, FieldMeasurement> = {};

    for (const measurement of measurements) {
      const agendaId = measurementAgendaEventId(measurement);
      if (agendaId && !map[agendaId]) map[agendaId] = measurement;
    }

    return map;
  }, [measurements]);

  function paymentsForEvent(event: CalendarEvent) {
    const direct = paymentsByEvent[event.id] || [];
    if (direct.length || !event.client_id) return direct;

    return payments
      .filter((payment) => String(payment.client_id || "") === String(event.client_id))
      .slice(0, 3);
  }

  function measurementForEvent(event: CalendarEvent) {
    const direct = measurementsByEvent[event.id];
    if (direct || !event.client_id) return direct || null;

    return (
      measurements.find((measurement) => String(measurement.client_id || "") === String(event.client_id)) ||
      null
    );
  }

  const stats = useMemo(() => {
    const paidTotal = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return {
      total: events.length,
      medidas: events.filter((e) => e.event_type === "medida").length,
      instalaciones: events.filter((e) => e.event_type === "instalacion").length,
      pendientesPago: events.filter((e) => e.event_type === "medida" && e.payment_status !== "pagado").length,
      clientes: clients.length,
      pagos: payments.length,
      pagado: paidTotal,
      levantamientos: measurements.length,
    };
  }, [events, clients, payments, measurements]);

  return (
    <main className="min-h-screen bg-[#020817] p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-cyan-900/60 bg-gradient-to-br from-[#07111f] to-[#101b3f] p-8 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-black tracking-[0.35em] text-cyan-300">
                📅 FASE 26 · CLIENTES CONECTADOS
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
                Agenda / Calendario Maestro
              </h1>
              <p className="mt-2 max-w-4xl text-slate-300">
                Medidas, producción, instalaciones, transporte, cobros y seguimiento comercial.
              </p>
            </div>

            <button
              type="button"
              onClick={refreshAll}
              disabled={loading || loadingClients}
              className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-white px-6 font-black text-slate-950 transition hover:scale-[1.02] disabled:opacity-60"
            >
              {loading || loadingClients ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <RefreshCw size={20} />
              )}
              Actualizar
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Eventos</p>
            <h2 className="mt-2 text-3xl font-black">{stats.total}</h2>
          </div>

          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Clientes</p>
            <h2 className="mt-2 text-3xl font-black text-cyan-300">{stats.clientes}</h2>
          </div>

          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Medidas</p>
            <h2 className="mt-2 text-3xl font-black text-cyan-300">{stats.medidas}</h2>
          </div>

          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Instalaciones</p>
            <h2 className="mt-2 text-3xl font-black text-emerald-300">{stats.instalaciones}</h2>
          </div>

          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Pend. pago</p>
            <h2 className="mt-2 text-3xl font-black text-red-300">{stats.pendientesPago}</h2>
          </div>

          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Ingresos</p>
            <h2 className="mt-2 text-2xl font-black text-emerald-300">{money(stats.pagado)}</h2>
          </div>

          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Levant.</p>
            <h2 className="mt-2 text-3xl font-black text-purple-300">{stats.levantamientos}</h2>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-6 shadow-2xl shadow-black/25 lg:col-span-1">
            <h2 className="mb-5 text-2xl font-black">Nuevo evento</h2>

            <div className="space-y-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
              />

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                  <Users className="h-4 w-4" />
                  Cliente registrado
                </label>

                <select
                  value={selectedClientId}
                  onChange={(e) => handleSelectClient(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                >
                  <option value="">
                    {loadingClients ? "Cargando clientes..." : "Seleccionar cliente"}
                  </option>

                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {clientName(c)}
                    </option>
                  ))}
                </select>
              </div>

              <input
                value={client}
                readOnly
                placeholder="Cliente"
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-slate-300 outline-none"
              />

              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Teléfono"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
              />

              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
              />

              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
              >
                <option value="medida">Medida en obra</option>
                <option value="produccion">Producción</option>
                <option value="transporte">Transporte</option>
                <option value="instalacion">Instalación</option>
                <option value="cobro">Cobro</option>
                <option value="seguimiento">Seguimiento</option>
                <option value="general">General</option>
              </select>

              {eventType === "medida" ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                    Abono obligatorio medición + render
                  </label>
                  <input
                    type="number"
                    value={measurementFee}
                    onChange={(e) => setMeasurementFee(Number(e.target.value || 0))}
                    className="w-full rounded-2xl border border-amber-400/40 bg-slate-950 px-4 py-3 text-amber-100 outline-none focus:border-amber-300"
                  />
                  <p className="mt-2 text-xs text-amber-100/80">
                    No se debe realizar el levantamiento hasta registrar este pago con soporte.
                  </p>
                </div>
              ) : null}

              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
              />

              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 py-4 font-black text-white transition hover:from-cyan-400 hover:to-blue-500 disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                Crear evento
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-6 shadow-2xl shadow-black/25 lg:col-span-2">
            <div className="mb-5 flex items-center gap-3">
              <CalendarDays className="h-7 w-7 text-cyan-400" />
              <h2 className="text-2xl font-black">Agenda</h2>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-10 text-center text-slate-400">
                Cargando agenda...
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-10 text-center text-slate-400">
                No hay eventos registrados.
              </div>
            ) : (
              <div className="max-h-[720px] space-y-6 overflow-auto pr-2">
                {Object.entries(grouped).map(([date, items]) => (
                  <div key={date}>
                    <h3 className="mb-3 text-lg font-black capitalize text-cyan-300">{date}</h3>

                    <div className="space-y-3">
                      {items.map((event) => {
                        const linkedPayments = paymentsForEvent(event);
                        const linkedMeasurement = measurementForEvent(event);

                        return (
                        <div
                          key={event.id}
                          className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                          style={{ borderLeft: `6px solid ${event.color || "#0ea5e9"}` }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-xl font-black">{event.title}</h4>

                                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-300">
                                  {EVENT_LABELS[event.event_type] || event.event_type}
                                </span>

                                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-300">
                                  {event.status}
                                </span>

                                {event.event_type === "medida" ? (
                                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${
                                    event.payment_status === "pagado"
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                      : "border-red-500/30 bg-red-500/10 text-red-300"
                                  }`}>
                                    Pago: {event.payment_status || "pendiente"}
                                  </span>
                                ) : null}
                              </div>

                              <div className="space-y-1 text-sm text-slate-400">
                                <div className="flex items-center gap-2">
                                  <Clock3 className="h-4 w-4" />
                                  {formatDate(event.start_at)}
                                </div>

                                {event.client_name ? (
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    {event.client_name}
                                  </div>
                                ) : null}

                                {event.phone ? (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4" />
                                    {event.phone}
                                  </div>
                                ) : null}

                                {event.address ? (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    {event.address}
                                  </div>
                                ) : null}

                                {event.event_type === "medida" ? (
                                  <div className="flex items-center gap-2 text-amber-200">
                                    <CreditCard className="h-4 w-4" />
                                    Abono requerido: {money(event.measurement_fee || 5000)}
                                    {event.payment_reference ? ` · ${event.payment_reference}` : ""}
                                  </div>
                                ) : null}

                                {event.event_type === "medida" && linkedPayments.length ? (
                                  <div className="flex items-center gap-2 text-emerald-200">
                                    <ReceiptText className="h-4 w-4" />
                                    Pago Caja Principal: {money(linkedPayments[0].amount)}
                                    {linkedPayments[0].payment_code ? ` · ${linkedPayments[0].payment_code}` : ""}
                                  </div>
                                ) : null}

                                {event.event_type === "medida" ? (
                                  <div className={`flex items-center gap-2 ${linkedMeasurement ? "text-purple-200" : "text-slate-500"}`}>
                                    <Ruler className="h-4 w-4" />
                                    {linkedMeasurement
                                      ? `Levantamiento: ${measurementCode(linkedMeasurement)} · ${linkedMeasurement.project_name || "Proyecto"}`
                                      : "Sin levantamiento vinculado todavia"}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              {event.event_type === "medida" && event.payment_status !== "pagado" ? (
                                <Link
                                  href={`/pagos?stage=measurement_5000&event_id=${event.id}`}
                                  className="rounded-xl bg-emerald-600/20 px-3 py-2 text-xs font-black text-emerald-200 transition hover:bg-emerald-600/30"
                                >
                                  Enviar a Caja
                                </Link>
                              ) : null}

                              {event.event_type === "medida" && event.payment_status === "pagado" && !linkedMeasurement ? (
                                <Link
                                  href="/levantamientos"
                                  className="rounded-xl bg-purple-600/20 px-3 py-2 text-center text-xs font-black text-purple-100 transition hover:bg-purple-600/30"
                                >
                                  Crear medida
                                </Link>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => handleDelete(event.id)}
                                className="rounded-xl bg-red-600/20 p-3 text-red-300 transition hover:bg-red-600/30"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-6 shadow-2xl shadow-black/25">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                Caja Principal
              </p>
              <h2 className="mt-1 text-2xl font-black">Historial de pagos de medicion</h2>
            </div>
            <p className="text-sm font-bold text-slate-400">
              Total registrado: <span className="text-emerald-300">{money(stats.pagado)}</span>
            </p>
          </div>

          {payments.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-400">
              Todavia no hay pagos de medicion registrados por Caja Principal.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {payments.slice(0, 12).map((payment) => {
                const linkedEvent = events.find((event) => event.id === payment.calendar_event_id);

                return (
                <article key={payment.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
                          {payment.payment_code || payment.reference || "PAGO"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-slate-300">
                          {payment.status || "registrado"}
                        </span>
                      </div>
                      <h3 className="mt-3 font-black text-white">{payment.client_name || "Cliente"}</h3>
                      <p className="mt-1 text-sm text-slate-400">{payment.concept || "Pago medicion + render"}</p>
                      <p className="mt-1 text-xs text-slate-500">{payment.created_at ? formatDate(payment.created_at) : "-"}</p>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="text-xl font-black text-emerald-300">{money(payment.amount)}</p>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                        {payment.payment_method || "metodo"}
                      </p>
                      <button
                        type="button"
                        onClick={() => printMeasurementReceipt(payment, linkedEvent)}
                        className="mt-2 inline-flex rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-400/20"
                      >
                        Imprimir recibo
                      </button>
                      {payment.support_url ? (
                        <a
                          href={payment.support_url}
                          target="_blank"
                          className="mt-2 inline-flex rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-400/20"
                        >
                          Ver soporte
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {paymentEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-cyan-900/60 bg-[#07111f] p-6 shadow-2xl shadow-black">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                  Registro de ingreso auditable
                </p>
                <h2 className="mt-2 text-2xl font-black">Pago medición + render</h2>
                <p className="mt-1 text-sm text-slate-400">{paymentEvent.client_name}</p>
              </div>

              <button
                type="button"
                onClick={() => setPaymentEvent(null)}
                className="rounded-xl bg-red-600/20 p-3 text-red-300 hover:bg-red-600/30"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Monto
                </span>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value || 0))}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Método de pago
                </span>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="deposito">Depósito</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Referencia externa opcional
                </span>
                <input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ej: número transferencia / voucher"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                />
              </label>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-400/40 bg-cyan-400/10 px-4 py-6 text-center hover:bg-cyan-400/20">
                <UploadCloud className="mb-2 h-8 w-8 text-cyan-200" />
                <span className="font-black text-cyan-100">
                  {paymentSupportFile
                    ? paymentSupportFile.name
                    : paymentMethod === "efectivo"
                    ? "Soporte opcional para efectivo"
                    : "Subir soporte obligatorio"}
                </span>
                <span className="mt-1 text-xs text-cyan-100/70">
                  {paymentMethod === "efectivo"
                    ? "En efectivo no es obligatorio, pero puedes adjuntar una foto si deseas."
                    : "Imagen o PDF del comprobante obligatorio."}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setPaymentSupportFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleRegisterPayment}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-600 py-4 font-black text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                Registrar pago e ingreso
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
