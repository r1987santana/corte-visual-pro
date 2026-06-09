"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { requestSupervisorApproval, writeAuditLog } from "@/lib/auditTrail";
import {
  centralPaymentConcept,
  classifyClientPayment,
  contractPaymentSummary,
  moneyDop,
  paymentAmount as cajaPaymentAmount,
  type CajaContract,
  type CajaPayment,
  type PaymentStage,
} from "@/lib/cajaPrincipal";

type Cliente = { id: string; nombre?: string | null; name?: string | null; telefono?: string | null; phone?: string | null };

type Sale = {
  id: string;
  invoice_number?: string | null;
  sale_no?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  total?: number | null;
  total_amount?: number | null;
  amount_paid?: number | null;
  paid?: number | null;
  balance?: number | null;
  balance_due?: number | null;
  status?: string | null;
  payment_status?: string | null;
  workflow_status?: string | null;
  project_type?: string | null;
  created_at?: string | null;
};

type Payment = {
  id: string;
  sale_id?: string | null;
  cliente_id?: string | null;
  monto?: number | null;
  amount?: number | null;
  metodo?: string | null;
  payment_method?: string | null;
  status?: string | null;
  nota?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type ProjectContract = CajaContract;
type ClientPayment = CajaPayment;
type Notice = { tone: "success" | "error" | "info"; text: string } | null;
type CalendarEvent = {
  id: string;
  title?: string | null;
  event_type?: string | null;
  status?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  phone?: string | null;
  address?: string | null;
  start_at?: string | null;
  payment_required?: boolean | null;
  payment_status?: string | null;
  measurement_fee?: number | null;
  amount_paid?: number | null;
  payment_reference?: string | null;
};

type CashSession = {
  id: string;
  cash_date: string;
  status: "open" | "closed";
  opening_amount: number;
  closing_amount?: number | null;
  expected_amount?: number | null;
  difference_amount?: number | null;
  opened_at: string;
  closed_at?: string | null;
  opened_by?: string | null;
  closed_by?: string | null;
  notes?: string | null;
  source?: "database" | "local";
};

const methodLabels: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

const CASH_SESSIONS_STORAGE_KEY = "rdwood_cash_register_sessions";

function n(value: any) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: any) {
  return String(value ?? "").trim();
}

function money(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(n(value));
}

function dateText(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("es-DO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function dayKey(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function localCashSessions(): CashSession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CASH_SESSIONS_STORAGE_KEY) || "[]") as CashSession[];
  } catch {
    return [];
  }
}

function saveLocalCashSessions(sessions: CashSession[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CASH_SESSIONS_STORAGE_KEY, JSON.stringify(sessions.slice(0, 90)));
}

function currentUserName() {
  if (typeof window === "undefined") return "Caja Principal";
  const candidates = ["rdwood_auth_user", "rdwood_user", "user", "auth_user"];
  for (const key of candidates) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const name = text(parsed?.name || parsed?.nombre || parsed?.full_name || parsed?.email || parsed?.username);
      if (name) return name;
    } catch {
      const raw = text(window.localStorage.getItem(key));
      if (raw) return raw;
    }
  }
  return "Caja Principal";
}

function saleCode(sale?: Sale | null) {
  return text(sale?.invoice_number) || text(sale?.sale_no) || (sale?.id ? sale.id.slice(0, 8) : "Factura");
}

function saleTotal(sale?: Sale | null) {
  return n(sale?.total ?? sale?.total_amount);
}

function salePaid(sale?: Sale | null) {
  return n(sale?.amount_paid ?? sale?.paid);
}

function saleBalance(sale?: Sale | null) {
  const stored = sale?.balance ?? sale?.balance_due;
  if (stored !== null && stored !== undefined) return n(stored);
  return Math.max(saleTotal(sale) - salePaid(sale), 0);
}

function paymentAmount(payment: Payment) {
  return n(payment.monto ?? payment.amount);
}

function paymentMethod(payment: Payment) {
  return text(payment.metodo ?? payment.payment_method) || "efectivo";
}

function paymentNotes(payment: Payment) {
  return text(payment.nota ?? payment.notes);
}

function paymentIsVoided(payment: Payment) {
  const raw = `${payment.status || ""} ${paymentNotes(payment)}`.toLowerCase();
  return raw.includes("anulad") || raw.includes("revers");
}

function saleIsVoided(sale?: Sale | null) {
  const raw = `${sale?.status || ""} ${sale?.payment_status || ""} ${sale?.workflow_status || ""}`.toLowerCase();
  return raw.includes("anulad") || raw.includes("cancel");
}

function stageLabel(stage: PaymentStage) {
  if (stage === "measurement_5000") return "Abono medicion + render RD$5,000";
  if (stage === "initial_60") return "Inicial 60%";
  if (stage === "delivery_20") return "20% entrega / transporte";
  if (stage === "final_20") return "20% final instalacion";
  return "Otro ingreso";
}

function stageDue(stage: PaymentStage, summary: ReturnType<typeof contractPaymentSummary>) {
  if (stage === "measurement_5000") return Math.max(5000 - summary.stageTotals.measurement_5000, 0);
  if (stage === "initial_60") return summary.initialDue;
  if (stage === "delivery_20") return summary.deliveryDue;
  if (stage === "final_20") return summary.finalDue;
  return 0;
}

function stagePaid(stage: PaymentStage, summary: ReturnType<typeof contractPaymentSummary>) {
  if (stage === "measurement_5000") return summary.stageTotals.measurement_5000 || summary.credit;
  if (stage === "initial_60") return summary.initialPaid;
  if (stage === "delivery_20") return summary.deliveryPaid;
  if (stage === "final_20") return summary.finalPaid;
  return summary.stageTotals.other;
}

function stageRequired(stage: PaymentStage, summary: ReturnType<typeof contractPaymentSummary>) {
  if (stage === "measurement_5000") return 5000;
  if (stage === "initial_60") return summary.initialRequired;
  if (stage === "delivery_20") return summary.deliveryRequired;
  if (stage === "final_20") return summary.finalRequired;
  return 0;
}

function clientName(cliente?: Cliente | null) {
  return text(cliente?.nombre ?? cliente?.name) || "Cliente";
}

function clientPhone(cliente?: Cliente | null) {
  return text(cliente?.telefono ?? cliente?.phone);
}

function noticeClass(tone: NonNullable<Notice>["tone"]) {
  if (tone === "success") return "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
  if (tone === "error") return "border-red-400/35 bg-red-500/10 text-red-100";
  return "border-cyan-400/35 bg-cyan-500/10 text-cyan-100";
}

async function auditPayment(action: string, newData: Record<string, any>) {
  await writeAuditLog({
    module: "contabilidad",
    action,
    entity_type: "payments",
    entity_id: String(newData.sale_id || newData.cliente_id || newData.contract_id || "sin-entidad"),
    entity_name: newData.invoice || newData.payment_code || newData.code || null,
    new_data: newData,
    severity: "info",
  });
}

function createToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openIncomeReceipt(input: {
  incomeCode: string;
  paymentCode: string;
  contract: ProjectContract;
  stage: PaymentStage;
  amount: number;
  method: string;
  reference: string;
  notes: string;
  reprint?: boolean;
}) {
  const printTitle = input.reprint ? "RECIBO DE INGRESO - RE-IMPRESION" : "RECIBO DE INGRESO";
  const html = `
    <html>
      <head>
        <title>Recibo ${input.incomeCode}</title>
        <style>
          @page{size:letter;margin:8mm}
          body{margin:0;padding:22px;font-family:Arial,sans-serif;color:#111;background:#fff}
          .page{max-width:880px;margin:0 auto}
          .copy{border:1.5px solid #111;border-radius:16px;padding:18px;margin-bottom:18px;page-break-inside:avoid}
          .copy.cash{border-color:#078a4f}
          .top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-bottom:1px solid #ddd;padding-bottom:10px}
          .brand{letter-spacing:5px;color:#005c99;font-weight:900;font-size:11px}
          h1{margin:6px 0 0;font-size:24px}
          .stamp{border-radius:999px;padding:7px 12px;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;background:#f3f7fb;color:#005c99;border:1px solid #b7d7ee;white-space:nowrap}
          .copy.cash .stamp{background:#effaf4;color:#078a4f;border-color:#9bd7b8}
          .muted{color:#555;margin-top:5px;font-size:12px}
          .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;margin-top:14px}
          .field{border-bottom:1px solid #e5e5e5;padding-bottom:7px}
          .label{font-weight:900;color:#555;text-transform:uppercase;font-size:10px;letter-spacing:.08em}
          .value{margin-top:3px;font-weight:800;font-size:13px}
          .amount{margin-top:14px;border-radius:14px;background:#f6f8fb;border:1px solid #ddd;padding:14px;display:flex;justify-content:space-between;align-items:center}
          .total{font-size:28px;font-weight:900;color:#078a4f}
          .note{margin-top:12px;padding:10px 12px;border-left:4px solid #005c99;background:#f3f7fb;font-size:12px;line-height:1.35}
          .sign{display:grid;grid-template-columns:1fr 1fr;gap:44px;margin-top:30px}
          .line{border-top:1px solid #111;padding-top:7px;text-align:center;font-size:12px}
          .cut{text-align:center;color:#777;font-size:11px;margin:6px 0 18px}
          @media print{body{padding:8mm}.copy{margin-bottom:10mm}.cut{margin:2mm 0 6mm}}
        </style>
      </head>
      <body>
        <div class="page">
          ${["COPIA CLIENTE", "SOPORTE CAJA PRINCIPAL"].map((copyLabel, index) => `
            <section class="copy ${index === 1 ? "cash" : ""}">
              <div class="top">
                <div>
                  <div class="brand">RD WOOD SYSTEM / SANTANA GROUP</div>
                  <h1>${printTitle}</h1>
                  <p class="muted">Caja Principal registra y libera etapa del proyecto.</p>
                </div>
                <div class="stamp">${input.reprint ? `RE-IMPRESION / ${copyLabel}` : copyLabel}</div>
              </div>
              <div class="grid">
                <div class="field"><div class="label">Codigo ingreso</div><div class="value">${input.incomeCode}</div></div>
                <div class="field"><div class="label">Codigo pago</div><div class="value">${input.paymentCode}</div></div>
                <div class="field"><div class="label">Fecha</div><div class="value">${new Date().toLocaleString("es-DO")}</div></div>
                <div class="field"><div class="label">Etapa</div><div class="value">${stageLabel(input.stage)}</div></div>
                <div class="field"><div class="label">Cliente</div><div class="value">${input.contract.client_name || "-"}</div></div>
                <div class="field"><div class="label">Telefono</div><div class="value">${input.contract.client_phone || "-"}</div></div>
                <div class="field"><div class="label">Contrato</div><div class="value">${input.contract.contract_code || "-"}</div></div>
                <div class="field"><div class="label">Proyecto</div><div class="value">${input.contract.project_name || "-"}</div></div>
                <div class="field"><div class="label">Metodo</div><div class="value">${input.method}</div></div>
                <div class="field"><div class="label">Referencia</div><div class="value">${input.reference || "-"}</div></div>
              </div>
              <div class="amount"><div class="label">Monto recibido</div><div class="total">${moneyDop(input.amount)}</div></div>
              ${input.notes ? `<div class="note"><b>Nota:</b> ${input.notes}</div>` : ""}
              <div class="note">Este recibo nace solo desde Caja Principal. Ningun modulo operativo debe recibir dinero fuera de caja.</div>
              ${input.reprint ? `<div class="note"><b>RE-IMPRESION:</b> documento generado nuevamente para auditoria. No crea ingreso nuevo ni duplica caja.</div>` : ""}
              <div class="sign">
                <div class="line">Cliente / Pagador</div>
                <div class="line">Caja Principal / RD Wood</div>
              </div>
            </section>
            ${index === 0 ? `<div class="cut">cortar aqui - copia cliente arriba / soporte caja abajo</div>` : ""}
          `).join("")}
        </div>
        <script>window.onload=function(){setTimeout(function(){window.print()},500)}</script>
      </body>
    </html>
  `;

  const receiptWindow = window.open("", "_blank", "width=900,height=900");
  if (receiptWindow) {
    receiptWindow.document.write(html);
    receiptWindow.document.close();
  } else {
    alert("Pago registrado, pero el navegador bloqueo la ventana del recibo. Permite popups para imprimir.");
  }
}

function openSaleReceipt(input: {
  incomeCode: string;
  paymentCode: string;
  sale: Sale;
  amount: number;
  method: string;
  reference: string;
  notes: string;
  balanceAfter: number;
  reprint?: boolean;
}) {
  const printTitle = input.reprint ? "RECIBO DE INGRESO - RE-IMPRESION" : "RECIBO DE INGRESO";
  const html = `
    <html>
      <head>
        <title>Recibo ${input.incomeCode}</title>
        <style>
          @page{size:letter;margin:8mm}
          body{margin:0;padding:22px;font-family:Arial,sans-serif;color:#111;background:#fff}
          .page{max-width:880px;margin:0 auto}
          .copy{border:1.5px solid #111;border-radius:16px;padding:18px;margin-bottom:18px;page-break-inside:avoid}
          .copy.cash{border-color:#078a4f}
          .top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-bottom:1px solid #ddd;padding-bottom:10px}
          .brand{letter-spacing:5px;color:#005c99;font-weight:900;font-size:11px}
          h1{margin:6px 0 0;font-size:24px}
          .stamp{border-radius:999px;padding:7px 12px;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;background:#f3f7fb;color:#005c99;border:1px solid #b7d7ee;white-space:nowrap}
          .copy.cash .stamp{background:#effaf4;color:#078a4f;border-color:#9bd7b8}
          .muted{color:#555;margin-top:5px;font-size:12px}
          .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;margin-top:14px}
          .field{border-bottom:1px solid #e5e5e5;padding-bottom:7px}
          .label{font-weight:900;color:#555;text-transform:uppercase;font-size:10px;letter-spacing:.08em}
          .value{margin-top:3px;font-weight:800;font-size:13px}
          .amount{margin-top:14px;border-radius:14px;background:#f6f8fb;border:1px solid #ddd;padding:14px;display:flex;justify-content:space-between;align-items:center}
          .total{font-size:28px;font-weight:900;color:#078a4f}
          .note{margin-top:12px;padding:10px 12px;border-left:4px solid #005c99;background:#f3f7fb;font-size:12px;line-height:1.35}
          .sign{display:grid;grid-template-columns:1fr 1fr;gap:44px;margin-top:30px}
          .line{border-top:1px solid #111;padding-top:7px;text-align:center;font-size:12px}
          .cut{text-align:center;color:#777;font-size:11px;margin:6px 0 18px}
          @media print{body{padding:8mm}.copy{margin-bottom:10mm}.cut{margin:2mm 0 6mm}}
        </style>
      </head>
      <body>
        <div class="page">
          ${["COPIA CLIENTE", "SOPORTE CAJA PRINCIPAL"].map((copyLabel, index) => `
            <section class="copy ${index === 1 ? "cash" : ""}">
              <div class="top">
                <div>
                  <div class="brand">RD WOOD SYSTEM / SANTANA GROUP</div>
                  <h1>${printTitle}</h1>
                  <p class="muted">Cobro de factura registrado solo por Caja Principal.</p>
                </div>
                <div class="stamp">${input.reprint ? `RE-IMPRESION / ${copyLabel}` : copyLabel}</div>
              </div>
              <div class="grid">
                <div class="field"><div class="label">Codigo ingreso</div><div class="value">${input.incomeCode}</div></div>
                <div class="field"><div class="label">Codigo pago</div><div class="value">${input.paymentCode}</div></div>
                <div class="field"><div class="label">Fecha</div><div class="value">${new Date().toLocaleString("es-DO")}</div></div>
                <div class="field"><div class="label">Factura</div><div class="value">${saleCode(input.sale)}</div></div>
                <div class="field"><div class="label">Cliente</div><div class="value">${input.sale.client_name || "-"}</div></div>
                <div class="field"><div class="label">Telefono</div><div class="value">${input.sale.client_phone || "-"}</div></div>
                <div class="field"><div class="label">Metodo</div><div class="value">${input.method}</div></div>
                <div class="field"><div class="label">Referencia</div><div class="value">${input.reference || "-"}</div></div>
              </div>
              <div class="amount"><div class="label">Monto recibido</div><div class="total">${money(input.amount)}</div></div>
              <div class="note"><b>Balance luego del pago:</b> ${money(input.balanceAfter)}</div>
              ${input.notes ? `<div class="note"><b>Nota:</b> ${input.notes}</div>` : ""}
              <div class="note">Este recibo nace solo desde Caja Principal. Ningun modulo operativo debe recibir dinero fuera de caja.</div>
              ${input.reprint ? `<div class="note"><b>RE-IMPRESION:</b> documento generado nuevamente para auditoria. No crea ingreso nuevo ni duplica caja.</div>` : ""}
              <div class="sign">
                <div class="line">Cliente / Pagador</div>
                <div class="line">Caja Principal / RD Wood</div>
              </div>
            </section>
            ${index === 0 ? `<div class="cut">cortar aqui - copia cliente arriba / soporte caja abajo</div>` : ""}
          `).join("")}
        </div>
        <script>window.onload=function(){setTimeout(function(){window.print()},500)}</script>
      </body>
    </html>
  `;

  const receiptWindow = window.open("", "_blank", "width=900,height=900");
  if (receiptWindow) {
    receiptWindow.document.write(html);
    receiptWindow.document.close();
  } else {
    alert("Pago registrado, pero el navegador bloqueo la ventana del recibo. Permite popups para imprimir.");
  }
}

function openCashReport(input: {
  session: CashSession;
  closedBy: string;
  payments: ClientPayment[];
  legacyPayments: Payment[];
  openingAmount: number;
  closingAmount: number;
  totalCollected: number;
  expectedAmount: number;
  difference: number;
  byMethod: Record<string, number>;
}) {
  const rows = input.payments
    .map(
      (payment) => `
        <tr>
          <td>${dateText(payment.created_at || payment.payment_date)}</td>
          <td>${payment.payment_code || payment.code || payment.id || "-"}</td>
          <td>${payment.client_name || "-"}</td>
          <td>${methodLabels[text(payment.payment_method || payment.metodo)] || text(payment.payment_method || payment.metodo) || "Efectivo"}</td>
          <td class="right">${money(cajaPaymentAmount(payment))}</td>
        </tr>
      `,
    )
    .join("");

  const html = `
    <html>
      <head>
        <title>Cierre Caja ${input.session.cash_date}</title>
        <style>
          @page{size:letter;margin:8mm}
          body{margin:0;padding:22px;font-family:Arial,sans-serif;color:#111;background:#fff}
          .page{max-width:980px;margin:0 auto}
          .top{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #111;padding-bottom:14px}
          .brand{letter-spacing:5px;color:#005c99;font-weight:900;font-size:11px}
          h1{margin:6px 0 0;font-size:28px}
          .muted{color:#555;font-size:12px}
          .stamp{border:1px solid #078a4f;color:#078a4f;border-radius:999px;padding:8px 12px;font-weight:900;font-size:11px;letter-spacing:.12em;text-transform:uppercase}
          .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}
          .card{border:1px solid #ddd;border-radius:14px;padding:12px}
          .label{font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#555}
          .value{margin-top:5px;font-size:18px;font-weight:900}
          .warn{color:#a16207}
          .bad{color:#b91c1c}
          table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
          th{background:#06111f;color:#fff;text-align:left;padding:8px;text-transform:uppercase;font-size:10px;letter-spacing:.08em}
          td{border-bottom:1px solid #e5e7eb;padding:8px}
          .right{text-align:right;font-weight:900}
          .sign{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:34px}
          .line{border-top:1px solid #111;text-align:center;padding-top:8px;font-size:12px}
          @media print{body{padding:8mm}.grid{break-inside:avoid}}
        </style>
      </head>
      <body>
        <div class="page">
          <div class="top">
            <div>
              <div class="brand">RD WOOD SYSTEM / SANTANA GROUP</div>
              <h1>Cierre de Caja del Dia</h1>
              <p class="muted">Reporte para auditoria de cobros, ventas e ingresos diarios.</p>
            </div>
            <div class="stamp">Caja ${input.session.status === "closed" ? "cerrada" : "abierta"}</div>
          </div>

          <div class="grid">
            <div class="card"><div class="label">Fecha</div><div class="value">${input.session.cash_date}</div></div>
            <div class="card"><div class="label">Abierta por</div><div class="value">${input.session.opened_by || "-"}</div></div>
            <div class="card"><div class="label">Cerrada por</div><div class="value">${input.closedBy || "-"}</div></div>
            <div class="card"><div class="label">Cobros</div><div class="value">${input.payments.length + input.legacyPayments.length}</div></div>
            <div class="card"><div class="label">Apertura</div><div class="value">${money(input.openingAmount)}</div></div>
            <div class="card"><div class="label">Cobrado</div><div class="value">${money(input.totalCollected)}</div></div>
            <div class="card"><div class="label">Esperado caja</div><div class="value">${money(input.expectedAmount)}</div></div>
            <div class="card"><div class="label">Diferencia</div><div class="value ${Math.abs(input.difference) > 0.01 ? "bad" : ""}">${money(input.difference)}</div></div>
          </div>

          <h2>Resumen por metodo</h2>
          <div class="grid">
            ${Object.entries(input.byMethod)
              .map(([method, amount]) => `<div class="card"><div class="label">${methodLabels[method] || method}</div><div class="value">${money(amount)}</div></div>`)
              .join("")}
          </div>

          <h2>Movimientos del dia</h2>
          <table>
            <thead><tr><th>Fecha</th><th>Codigo</th><th>Cliente</th><th>Metodo</th><th class="right">Monto</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#777;padding:18px">Sin cobros registrados.</td></tr>`}</tbody>
          </table>

          <div class="sign">
            <div class="line">Cajero responsable</div>
            <div class="line">Auditoria / Administracion</div>
          </div>
        </div>
        <script>window.onload=function(){setTimeout(function(){window.print()},500)}</script>
      </body>
    </html>
  `;

  const reportWindow = window.open("", "_blank", "width=980,height=900");
  if (reportWindow) {
    reportWindow.document.write(html);
    reportWindow.document.close();
  } else {
    alert("Caja cerrada, pero el navegador bloqueo la ventana del reporte. Permite popups para imprimir.");
  }
}

export default function PagosPage() {
  const searchParams = useSearchParams();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contracts, setContracts] = useState<ProjectContract[]>([]);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
  const [agendaEvents, setAgendaEvents] = useState<CalendarEvent[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [cashStoreMode, setCashStoreMode] = useState<"database" | "local">("database");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [saleId, setSaleId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [referencia, setReferencia] = useState("");
  const [nota, setNota] = useState("");
  const [stageContractId, setStageContractId] = useState("");
  const [stage, setStage] = useState<PaymentStage>("initial_60");
  const [stageAmountValue, setStageAmountValue] = useState("");
  const [stageMethod, setStageMethod] = useState("efectivo");
  const [stageReference, setStageReference] = useState("");
  const [stageNotes, setStageNotes] = useState("");
  const [cashDate, setCashDate] = useState(todayKey());
  const [cashOpeningAmount, setCashOpeningAmount] = useState("0");
  const [cashClosingAmount, setCashClosingAmount] = useState("");
  const [cashNotes, setCashNotes] = useState("");

  async function loadCashSessions() {
    const { data, error } = await supabase
      .from("cash_register_sessions")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(90);

    if (error) {
      setCashStoreMode("local");
      setCashSessions(localCashSessions());
      return;
    }

    setCashStoreMode("database");
    setCashSessions(((data || []) as CashSession[]).map((session) => ({ ...session, source: "database" })));
  }

  async function loadAll() {
    setLoading(true);
    setNotice(null);

    const [clientesRes, salesRes, paymentsRes, contractsRes, clientPaymentsRes, agendaEventsRes] = await Promise.all([
      supabase.from("clientes").select("*").order("nombre", { ascending: true }),
      supabase.from("sales").select("*").order("created_at", { ascending: false }).limit(700),
      supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("project_contracts").select("*").order("created_at", { ascending: false }).limit(800),
      supabase.from("client_payments").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("calendar_events").select("*").eq("event_type", "medida").order("start_at", { ascending: false }).limit(300),
    ]);

    const errors = [clientesRes.error, salesRes.error, paymentsRes.error, contractsRes.error, clientPaymentsRes.error, agendaEventsRes.error].filter(Boolean);
    if (errors.length) {
      setNotice({ tone: "error", text: errors.map((error) => error?.message).join(" | ") });
    }

    setClientes((clientesRes.data || []) as Cliente[]);
    setSales((salesRes.data || []) as Sale[]);
    setPayments((paymentsRes.data || []) as Payment[]);
    setContracts((contractsRes.data || []) as ProjectContract[]);
    setClientPayments((clientPaymentsRes.data || []) as ClientPayment[]);
    setAgendaEvents((agendaEventsRes.data || []) as CalendarEvent[]);
    await loadCashSessions();
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const contractId = searchParams.get("contract_id") || "";
    const eventId = searchParams.get("event_id") || "";
    const requestedStage = searchParams.get("stage") as PaymentStage | null;
    if (contractId) setStageContractId(contractId);
    if (eventId) setStageContractId(`event:${eventId}`);
    if (requestedStage && ["measurement_5000", "initial_60", "delivery_20", "final_20"].includes(requestedStage)) {
      setStage(requestedStage);
    }
  }, [searchParams]);

  useEffect(() => {
    const requestedSaleId = searchParams.get("sale_id") || "";
    if (!requestedSaleId || !sales.some((sale) => sale.id === requestedSaleId) || saleId === requestedSaleId) return;
    handleSaleChange(requestedSaleId);
  }, [searchParams, sales, saleId]);

  const pendientes = useMemo(
    () =>
      sales.filter((sale) => {
        const status = text(sale.status).toLowerCase();
        if (saleIsVoided(sale)) return false;
        return saleBalance(sale) > 0 || status.includes("pendiente") || status.includes("credito");
      }),
    [sales],
  );

  const selectedSale = sales.find((sale) => sale.id === saleId) || null;
  const selectedCliente = clientes.find((cliente) => cliente.id === clienteId) || null;
  const selectedContract = contracts.find((contract) => String(contract.id) === String(stageContractId)) || null;
  const selectedAgendaEvent = stageContractId.startsWith("event:")
    ? agendaEvents.find((event) => String(event.id) === stageContractId.replace("event:", "")) || null
    : null;
  const pendingMeasurementEvents = useMemo(
    () =>
      agendaEvents.filter((event) => {
        const paid = text(event.payment_status).toLowerCase() === "pagado" || n(event.amount_paid) > 0 || Boolean(event.payment_reference);
        return !paid;
      }),
    [agendaEvents],
  );
  const selectedContractSummary = useMemo(
    () => contractPaymentSummary(selectedContract, clientPayments),
    [selectedContract, clientPayments],
  );
  const selectedStageDue = selectedAgendaEvent ? Math.max(n(selectedAgendaEvent.measurement_fee || 5000) - n(selectedAgendaEvent.amount_paid), 0) : stageDue(stage, selectedContractSummary);
  const selectedStageRequired = selectedAgendaEvent ? n(selectedAgendaEvent.measurement_fee || 5000) : stageRequired(stage, selectedContractSummary);
  const selectedStagePaid = selectedAgendaEvent ? n(selectedAgendaEvent.amount_paid) : stagePaid(stage, selectedContractSummary);

  const filteredPendientes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return pendientes.filter((sale) => {
      const row = `${saleCode(sale)} ${sale.client_name || ""} ${sale.client_phone || ""} ${sale.status || ""}`.toLowerCase();
      return row.includes(q);
    });
  }, [pendientes, search]);

  const totalPendiente = pendientes.reduce((sum, sale) => sum + saleBalance(sale), 0);
  const activePayments = payments.filter((payment) => !paymentIsVoided(payment));
  const saleCashPayments = clientPayments.filter((payment) => {
    const entity = `${payment.entity_name || ""} ${payment.entity_type || ""}`.toLowerCase();
    const status = text(payment.status).toLowerCase();
    return entity.includes("sales") || entity.includes("factura") || entity.includes("venta_mostrador")
      ? !status.includes("anulad") && !status.includes("cancel")
      : false;
  });
  const totalCobrado =
    activePayments.reduce((sum, payment) => sum + paymentAmount(payment), 0) +
    saleCashPayments.reduce((sum, payment) => sum + cajaPaymentAmount(payment), 0);
  const totalCajaCentral = clientPayments.reduce((sum, payment) => sum + cajaPaymentAmount(payment), 0);
  const paymentsWithSupport = activePayments.filter((payment) => {
    const method = paymentMethod(payment);
    if (method === "efectivo") return true;
    return paymentNotes(payment).toLowerCase().includes("soporte:");
  }).length;

  const supportCoverage = activePayments.length ? Math.round((paymentsWithSupport / activePayments.length) * 100) : 100;
  const dayClientPayments = clientPayments.filter((payment) => {
    const status = text(payment.status).toLowerCase();
    return dayKey(payment.created_at || payment.payment_date) === cashDate && !status.includes("anulad") && !status.includes("cancel");
  });
  const dayLegacyPayments = activePayments.filter((payment) => dayKey(payment.created_at) === cashDate);
  const dayPaymentsByMethod = dayClientPayments.reduce<Record<string, number>>((acc, payment) => {
    const method = text(payment.payment_method || payment.metodo).toLowerCase() || "efectivo";
    acc[method] = (acc[method] || 0) + cajaPaymentAmount(payment);
    return acc;
  }, {});
  const dayTotalCollected = dayClientPayments.reduce((sum, payment) => sum + cajaPaymentAmount(payment), 0);
  const dayCashCollected = dayPaymentsByMethod.efectivo || 0;
  const dayTransferCollected = dayPaymentsByMethod.transferencia || 0;
  const dayCardCollected = dayPaymentsByMethod.tarjeta || 0;
  const dayCheckCollected = dayPaymentsByMethod.cheque || 0;
  const openCashSession =
    cashSessions.find((session) => session.cash_date === cashDate && session.status === "open") ||
    null;
  const lastCashSession =
    openCashSession ||
    cashSessions.find((session) => session.cash_date === cashDate) ||
    null;
  const expectedCashAmount = n(openCashSession?.opening_amount || lastCashSession?.opening_amount) + dayCashCollected;
  const closeDifference = cashClosingAmount ? n(cashClosingAmount) - expectedCashAmount : 0;

  const riskAlerts = useMemo(() => {
    const alerts: string[] = [];
    const missingSupport = activePayments.filter((payment) => paymentMethod(payment) !== "efectivo" && !paymentNotes(payment).toLowerCase().includes("soporte:"));
    const unlinked = activePayments.filter((payment) => !payment.sale_id && !payment.cliente_id);

    if (missingSupport.length) alerts.push(`${missingSupport.length} pago(s) no efectivo sin soporte visible.`);
    if (unlinked.length) alerts.push(`${unlinked.length} pago(s) sin factura o cliente vinculado.`);
    if (totalPendiente > 0) alerts.push(`CxC abierta por ${money(totalPendiente)}.`);
    if (!alerts.length) alerts.push("Cobros sin alertas criticas.");

    return alerts;
  }, [activePayments, totalPendiente]);

  useEffect(() => {
    if (!selectedContract && !selectedAgendaEvent) return;
    const due = selectedStageDue || (stage === "measurement_5000" ? 5000 : 0);
    setStageAmountValue(due > 0 ? String(due.toFixed(2)) : "");
  }, [selectedContract?.id, selectedAgendaEvent?.id, stage, selectedStageDue]);

  function handleSaleChange(nextSaleId: string) {
    setSaleId(nextSaleId);
    const sale = sales.find((item) => item.id === nextSaleId);
    const byPhone = clientes.find((cliente) => clientPhone(cliente) && clientPhone(cliente) === text(sale?.client_phone));
    const byName = clientes.find((cliente) => clientName(cliente).toLowerCase() === text(sale?.client_name).toLowerCase());
    setClienteId((byPhone || byName)?.id || "");
    setMonto(sale ? String(saleBalance(sale) || "") : "");
  }

  function requireOpenCashSession() {
    if (openCashSession) return true;
    setNotice({ tone: "error", text: "Debes abrir la caja del dia antes de registrar cualquier cobro." });
    return false;
  }

  async function abrirCajaDia() {
    if (openCashSession) {
      setNotice({ tone: "info", text: `La caja del ${cashDate} ya esta abierta por ${openCashSession.opened_by || "Caja Principal"}.` });
      return;
    }

    const now = new Date().toISOString();
    const session: CashSession = {
      id: createToken(),
      cash_date: cashDate,
      status: "open",
      opening_amount: n(cashOpeningAmount),
      opened_at: now,
      opened_by: currentUserName(),
      notes: cashNotes.trim() || null,
      source: cashStoreMode,
    };

    let persisted = false;
    if (cashStoreMode === "database") {
      const { error } = await supabase.from("cash_register_sessions").insert({
        id: session.id,
        cash_date: session.cash_date,
        status: session.status,
        opening_amount: session.opening_amount,
        opened_at: session.opened_at,
        opened_by: session.opened_by,
        notes: session.notes,
      });
      persisted = !error;
    }

    if (!persisted) {
      const next = [{ ...session, source: "local" as const }, ...localCashSessions().filter((item) => !(item.cash_date === cashDate && item.status === "open"))];
      saveLocalCashSessions(next);
      setCashStoreMode("local");
      setCashSessions(next);
    } else {
      await loadCashSessions();
    }

    await writeAuditLog({
      module: "contabilidad",
      action: "cash_register_opened",
      entity_type: "cash_register_sessions",
      entity_id: session.id,
      entity_name: `Caja ${cashDate}`,
      new_data: session,
      severity: "info",
    });

    setCashNotes("");
    setNotice({ tone: "success", text: `Caja del dia abierta con fondo inicial ${money(session.opening_amount)}.` });
  }

  async function cerrarCajaDia() {
    if (!openCashSession) {
      setNotice({ tone: "error", text: "No hay caja abierta para cerrar en la fecha seleccionada." });
      return;
    }

    const closingAmount = n(cashClosingAmount);
    const difference = closingAmount - expectedCashAmount;
    const now = new Date().toISOString();
    const closedBy = currentUserName();
    const patch = {
      status: "closed",
      closing_amount: closingAmount,
      expected_amount: expectedCashAmount,
      difference_amount: difference,
      closed_at: now,
      closed_by: closedBy,
      notes: cashNotes.trim() || openCashSession.notes || null,
    };

    let persisted = false;
    if (openCashSession.source === "database" && cashStoreMode === "database") {
      const { error } = await supabase.from("cash_register_sessions").update(patch).eq("id", openCashSession.id);
      persisted = !error;
    }

    const closedSession: CashSession = { ...openCashSession, ...patch, status: "closed" };
    if (!persisted) {
      const localSessions = localCashSessions();
      const localClosedSession = { ...closedSession, source: "local" as const };
      const next = localSessions.some((session) => session.id === openCashSession.id)
        ? localSessions.map((session) => (session.id === openCashSession.id ? localClosedSession : session))
        : [localClosedSession, ...localSessions];
      saveLocalCashSessions(next);
      setCashSessions(next);
      setCashStoreMode("local");
    } else {
      await loadCashSessions();
    }

    await writeAuditLog({
      module: "contabilidad",
      action: "cash_register_closed",
      entity_type: "cash_register_sessions",
      entity_id: openCashSession.id,
      entity_name: `Caja ${cashDate}`,
      old_data: openCashSession,
      new_data: { ...closedSession, total_collected: dayTotalCollected, by_method: dayPaymentsByMethod },
      severity: Math.abs(difference) > 0.01 ? "warning" : "info",
    });

    openCashReport({
      session: closedSession,
      closedBy,
      payments: dayClientPayments,
      legacyPayments: dayLegacyPayments,
      openingAmount: n(openCashSession.opening_amount),
      closingAmount,
      totalCollected: dayTotalCollected,
      expectedAmount: expectedCashAmount,
      difference,
      byMethod: {
        efectivo: dayCashCollected,
        transferencia: dayTransferCollected,
        tarjeta: dayCardCollected,
        cheque: dayCheckCollected,
      },
    });

    setCashClosingAmount("");
    setCashNotes("");
    setNotice({ tone: "success", text: `Caja cerrada. Esperado ${money(expectedCashAmount)}, contado ${money(closingAmount)}, diferencia ${money(difference)}.` });
  }

  async function applyInventoryForPaidSale(sale: Sale) {
    const workflow = text(sale.workflow_status).toLowerCase();
    if (workflow.includes("inventario_descontado")) return false;
    if (text(sale.project_type).toLowerCase().includes("servicio")) return false;

    const { data: items, error } = await supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", sale.id);

    if (error) throw error;

    for (const item of items || []) {
      const productId = item.product_id;
      const qty = n(item.quantity);
      if (!productId || qty <= 0) continue;

      const { data: product, error: productError } = await supabase
        .from("inventory")
        .select("id,stock,quantity")
        .eq("id", productId)
        .maybeSingle();

      if (productError) throw productError;
      if (!product) continue;

      const currentStock = n(product.stock ?? product.quantity);
      const nextStock = Math.max(currentStock - qty, 0);
      const patch: Record<string, any> = {
        stock: nextStock,
        quantity: nextStock,
        updated_at: new Date().toISOString(),
      };

      await supabase.from("inventory").update(patch).eq("id", productId);
    }

    await writeAuditLog({
      module: "inventario",
      action: "inventory_discounted_after_cashier_payment",
      entity_type: "sales",
      entity_id: sale.id,
      entity_name: saleCode(sale),
      new_data: { sale, items },
      severity: "info",
    });

    return true;
  }

  async function registrarPago() {
    if (!selectedSale) {
      setNotice({ tone: "error", text: "Selecciona una factura pendiente antes de registrar el cobro." });
      return;
    }
    if (!requireOpenCashSession()) return;

    const amount = n(monto);
    const balanceActual = saleBalance(selectedSale);
    const support = referencia.trim();

    if (amount <= 0) {
      setNotice({ tone: "error", text: "El monto debe ser mayor que cero." });
      return;
    }

    if (metodo !== "efectivo" && !support) {
      setNotice({ tone: "error", text: "Para transferencia, tarjeta o cheque debes colocar referencia o soporte." });
      return;
    }

    if (amount > balanceActual) {
      const ok = confirm("El pago supera el balance. Si continuas, la factura quedara en balance 0. Deseas continuar?");
      if (!ok) return;
    }

    setSaving(true);
    setNotice(null);

    const nuevoPagado = salePaid(selectedSale) + amount;
    const nuevoBalance = Math.max(balanceActual - amount, 0);
    const nuevoEstado = nuevoBalance <= 0 ? "pagada" : "pendiente";
    const cleanNote = [nota.trim(), support ? `Soporte: ${support}` : ""].filter(Boolean).join(" | ");

    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
    const unique = String(Date.now()).slice(-6);
    const paymentCode = `PAY-${ymd}-${unique}`;
    const incomeCode = `ING-${ymd}-${unique}`;

    const paymentPayload = {
      payment_code: paymentCode,
      code: paymentCode,
      client_id: clienteId || null,
      client_name: selectedSale.client_name || clientName(selectedCliente),
      amount,
      currency: "DOP",
      payment_method: metodo,
      reference: support || paymentCode,
      reference_external: support || null,
      concept: `Cobro Venta Mostrador - Factura ${saleCode(selectedSale)}`,
      status: "registrado",
      payment_date: now.toISOString(),
      created_at: now.toISOString(),
      entity_id: selectedSale.id,
      entity_name: "sales",
      entity_type: "caja_principal_factura_venta_mostrador",
      notes: cleanNote || `Pago factura ${saleCode(selectedSale)}`,
    };

    const { data: paymentRow, error: paymentError } = await supabase
      .from("client_payments")
      .insert(paymentPayload)
      .select("id")
      .single();

    if (paymentError) {
      setSaving(false);
      setNotice({ tone: "error", text: `Error registrando pago: ${paymentError.message}` });
      return;
    }

    const incomePayload = {
      income_code: incomeCode,
      client_id: clienteId || null,
      client_name: selectedSale.client_name || clientName(selectedCliente),
      concept: `Ingreso Caja Principal - Factura ${saleCode(selectedSale)}`,
      amount,
      currency: "DOP",
      payment_method: metodo,
      reference_external: support || null,
      account_name: "Caja Principal",
      status: "registrado",
      income_date: now.toISOString(),
      source_type: "client_payments",
      source_id: paymentRow?.id || null,
      payment_id: paymentRow?.id || null,
      entity_id: selectedSale.id,
      entity_name: "sales",
      entity_type: "caja_principal_factura",
      notes: cleanNote || null,
    };

    const { data: incomeRow, error: incomeError } = await supabase
      .from("income_records")
      .insert(incomePayload)
      .select("id")
      .single();
    if (incomeError) {
      setSaving(false);
      setNotice({ tone: "error", text: `Pago creado, pero fallo ingreso auditable: ${incomeError.message}` });
      return;
    }

    if (incomeRow?.id && paymentRow?.id) {
      await supabase.from("client_payments").update({ income_record_id: incomeRow.id }).eq("id", paymentRow.id);
    }

    let inventoryApplied = false;
    if (nuevoBalance <= 0) {
      try {
        inventoryApplied = await applyInventoryForPaidSale(selectedSale);
      } catch (inventoryError: any) {
        await writeAuditLog({
          module: "inventario",
          action: "inventory_discount_failed_after_cashier_payment",
          entity_type: "sales",
          entity_id: selectedSale.id,
          entity_name: saleCode(selectedSale),
          new_data: { error: inventoryError?.message || String(inventoryError) },
          severity: "critical",
        });
      }
    }

    const { error: saleError } = await supabase
      .from("sales")
      .update({
        amount_paid: nuevoPagado,
        balance: nuevoBalance,
        status: nuevoEstado,
        payment_status: nuevoEstado === "pagada" ? "Pagada Caja Principal" : "Pendiente Caja",
        workflow_status: inventoryApplied ? "venta_cobrada_inventario_descontado" : "cobro_caja_principal",
      })
      .eq("id", selectedSale.id);

    if (saleError) {
      setSaving(false);
      setNotice({ tone: "error", text: `Pago creado, pero no pude actualizar factura: ${saleError.message}` });
      return;
    }

    await auditPayment("payment_registered", {
      ...paymentPayload,
      sale_id: selectedSale.id,
      cliente_id: clienteId || null,
      monto: amount,
      metodo,
      invoice: saleCode(selectedSale),
      income_code: incomeCode,
      payment_code: paymentCode,
      old_balance: balanceActual,
      new_balance: nuevoBalance,
    });

    openSaleReceipt({
      incomeCode,
      paymentCode,
      sale: selectedSale,
      amount,
      method: metodo,
      reference: support,
      notes: cleanNote,
      balanceAfter: nuevoBalance,
    });

    setSaleId("");
    setClienteId("");
    setMonto("");
    setMetodo("efectivo");
    setReferencia("");
    setNota("");
    setSaving(false);
    setNotice({ tone: "success", text: `Caja Principal cobro ${money(amount)} e imprimio recibo ${incomeCode}.` });

    await loadAll();
  }

  async function anularFacturaPendiente(sale: Sale) {
    if (salePaid(sale) > 0) {
      setNotice({ tone: "error", text: "Esta factura ya tiene pagos. Primero reversa el pago con autorizacion de supervisor." });
      return;
    }

    try {
      const approval = await requestSupervisorApproval("anular factura pendiente", saleCode(sale));
      const oldData = { ...sale };
      const patch = {
        status: "anulada_supervisor",
        payment_status: "Anulada por supervisor",
        workflow_status: "anulada_supervisor_sin_cobro",
        balance: 0,
      };

      const { error } = await supabase.from("sales").update(patch).eq("id", sale.id);
      if (error) throw error;

      await writeAuditLog({
        module: "contabilidad",
        action: "invoice_voided_by_supervisor",
        entity_type: "sales",
        entity_id: sale.id,
        entity_name: saleCode(sale),
        old_data: oldData,
        new_data: { ...patch, approval },
        severity: "critical",
        user_email: approval.supervisor_email,
      });

      setNotice({ tone: "success", text: `Factura ${saleCode(sale)} anulada con autorizacion de ${approval.supervisor_name}.` });
      await loadAll();
    } catch (error: any) {
      setNotice({ tone: "error", text: error?.message || "Anulacion cancelada." });
    }
  }

  async function reversarPago(payment: Payment) {
    if (paymentIsVoided(payment)) {
      setNotice({ tone: "info", text: "Ese pago ya fue reversado o anulado." });
      return;
    }

    const sale = sales.find((item) => item.id === payment.sale_id) || null;
    if (!sale) {
      setNotice({ tone: "error", text: "No encontre la factura vinculada a ese pago." });
      return;
    }

    try {
      const approval = await requestSupervisorApproval("reversar pago", `${saleCode(sale)} / ${money(paymentAmount(payment))}`);
      const amount = paymentAmount(payment);
      const now = new Date();
      const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
      const unique = String(Date.now()).slice(-6);
      const reversalCode = `REV-${ymd}-${unique}`;
      const nextPaid = Math.max(salePaid(sale) - amount, 0);
      const nextBalance = Math.max(saleTotal(sale) - nextPaid, 0);
      const nextStatus = nextBalance > 0 ? "pendiente" : "pagada";
      const oldPayment = { ...payment };
      const oldSale = { ...sale };
      const voidNote = [paymentNotes(payment), `REVERSADO ${reversalCode}: ${approval.reason}`].filter(Boolean).join(" | ");

      const withStatus = await supabase
        .from("payments")
        .update({ nota: voidNote, status: "anulado" })
        .eq("id", payment.id);

      if (withStatus.error) {
        const retry = await supabase.from("payments").update({ nota: voidNote }).eq("id", payment.id);
        if (retry.error) throw retry.error;
      }

      await supabase.from("income_records").insert({
        income_code: reversalCode,
        client_id: payment.cliente_id || null,
        client_name: sale.client_name || null,
        concept: `Reverso Caja Principal - Factura ${saleCode(sale)}`,
        amount: -Math.abs(amount),
        currency: "DOP",
        payment_method: paymentMethod(payment),
        account_name: "Caja Principal",
        status: "reverso_supervisor",
        income_date: now.toISOString(),
        source_type: "payments_reversal",
        source_id: payment.id,
        payment_id: payment.id,
        entity_id: sale.id,
        entity_name: "sales",
        entity_type: "reverso_caja_principal",
        notes: approval.reason,
      });

      const salePatch = {
        amount_paid: nextPaid,
        balance: nextBalance,
        status: nextStatus,
        payment_status: nextBalance > 0 ? "Pendiente Caja" : "Pagada Caja Principal",
        workflow_status: "pago_reversado_supervisor",
      };

      const { error: saleError } = await supabase.from("sales").update(salePatch).eq("id", sale.id);
      if (saleError) throw saleError;

      await writeAuditLog({
        module: "contabilidad",
        action: "payment_reversed_by_supervisor",
        entity_type: "payments",
        entity_id: payment.id,
        entity_name: saleCode(sale),
        old_data: { payment: oldPayment, sale: oldSale },
        new_data: { payment_patch: { nota: voidNote, status: "anulado" }, sale_patch: salePatch, approval, reversal_code: reversalCode },
        severity: "critical",
        user_email: approval.supervisor_email,
      });

      setNotice({ tone: "success", text: `Pago reversado con supervisor. Factura ${saleCode(sale)} queda con balance ${money(nextBalance)}.` });
      await loadAll();
    } catch (error: any) {
      setNotice({ tone: "error", text: error?.message || "Reverso cancelado." });
    }
  }

  async function registrarPagoEtapa() {
    if (!selectedContract?.id && !selectedAgendaEvent?.id) {
      setNotice({ tone: "error", text: "Selecciona una visita pendiente o un contrato/proyecto que Caja Principal va a cobrar." });
      return;
    }
    if (!requireOpenCashSession()) return;

    const amount = n(stageAmountValue);
    const support = stageReference.trim();

    if (amount <= 0) {
      setNotice({ tone: "error", text: "El monto debe ser mayor que cero." });
      return;
    }

    if (stageMethod !== "efectivo" && !support) {
      setNotice({ tone: "error", text: "Para transferencia, tarjeta o cheque debes colocar referencia o soporte." });
      return;
    }

    if (selectedStageDue > 0 && amount > selectedStageDue) {
      const ok = confirm("El pago supera el pendiente de esta etapa. Si continuas, Caja Principal registrara el monto completo. Deseas continuar?");
      if (!ok) return;
    }

    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
    const unique = String(Date.now()).slice(-6);
    const paymentCode = `PAY-${ymd}-${unique}`;
    const incomeCode = `ING-${ymd}-${unique}`;
    const paymentStage: PaymentStage = selectedAgendaEvent ? "measurement_5000" : stage;
    const concept = selectedAgendaEvent ? "Abono medicion + render" : centralPaymentConcept(paymentStage, selectedContract);
    const notes = [stageNotes.trim(), support ? `Soporte: ${support}` : ""].filter(Boolean).join(" | ");

    setSaving(true);
    setNotice(null);

    try {
      if (selectedAgendaEvent) {
        const paymentPayload = {
          payment_code: paymentCode,
          code: paymentCode,
          calendar_event_id: selectedAgendaEvent.id,
          client_id: selectedAgendaEvent.client_id || null,
          client_name: selectedAgendaEvent.client_name || null,
          amount,
          currency: "DOP",
          payment_method: stageMethod,
          reference: support || paymentCode,
          reference_external: support || null,
          concept,
          status: "registrado",
          payment_date: now.toISOString(),
          created_at: now.toISOString(),
          entity_id: selectedAgendaEvent.id,
          entity_name: "calendar_events",
          entity_type: "caja_principal_measurement_5000",
          notes: notes || null,
        };

        const { data: paymentRow, error: paymentError } = await supabase
          .from("client_payments")
          .insert(paymentPayload)
          .select("id")
          .single();

        if (paymentError) throw paymentError;

        const incomePayload = {
          income_code: incomeCode,
          client_id: selectedAgendaEvent.client_id || null,
          client_name: selectedAgendaEvent.client_name || null,
          concept: `Ingreso Caja Principal - ${concept}`,
          amount,
          currency: "DOP",
          payment_method: stageMethod,
          reference_external: support || null,
          account_name: "Caja Principal",
          status: "registrado",
          income_date: now.toISOString(),
          source_type: "client_payments",
          source_id: paymentRow?.id || null,
          payment_id: paymentRow?.id || null,
          entity_id: selectedAgendaEvent.id,
          entity_name: "calendar_events",
          entity_type: "caja_principal_measurement_5000",
          notes: notes || null,
        };

        const { data: incomeRow, error: incomeError } = await supabase
          .from("income_records")
          .insert(incomePayload)
          .select("id")
          .single();

        if (incomeError) throw incomeError;

        if (incomeRow?.id && paymentRow?.id) {
          await supabase.from("client_payments").update({ income_record_id: incomeRow.id }).eq("id", paymentRow.id);
        }

        const creditPayload = {
          client_id: selectedAgendaEvent.client_id || null,
          client_name: selectedAgendaEvent.client_name || null,
          source_type: "measurement_render_fee",
          source_reference: paymentCode,
          calendar_event_id: selectedAgendaEvent.id,
          amount,
          applied_amount: 0,
          remaining_amount: amount,
          status: "disponible",
          notes: "Credito generado por Caja Principal para medicion + render.",
          created_at: now.toISOString(),
        };
        await supabase.from("client_credits").insert(creditPayload);

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
          .eq("id", selectedAgendaEvent.id);

        if (eventError) throw eventError;

        const pseudoContract: ProjectContract = {
          id: selectedAgendaEvent.id,
          contract_code: paymentCode,
          client_id: selectedAgendaEvent.client_id,
          client_name: selectedAgendaEvent.client_name,
          client_phone: selectedAgendaEvent.phone,
          project_name: selectedAgendaEvent.title || "Medicion + render",
          total_amount: amount,
        };

        await auditPayment("caja_principal_measurement_payment_registered", {
          ...paymentPayload,
          income_code: incomeCode,
          stage: paymentStage,
        });

        openIncomeReceipt({
          incomeCode,
          paymentCode,
          contract: pseudoContract,
          stage: paymentStage,
          amount,
          method: stageMethod,
          reference: support,
          notes,
        });

        setStageContractId("");
        setStageReference("");
        setStageNotes("");
        setNotice({ tone: "success", text: `Caja Principal registro RD$5,000 de medicion/render por ${money(amount)}. Recibo ${incomeCode} enviado a impresion.` });
        await loadAll();
        return;
      }

      const paymentPayload = {
        payment_code: paymentCode,
        code: paymentCode,
        contract_id: selectedContract!.id,
        quote_id: selectedContract!.quote_id || null,
        client_id: selectedContract!.client_id || null,
        client_name: selectedContract!.client_name || null,
        amount,
        currency: "DOP",
        payment_method: stageMethod,
        reference: support || null,
        reference_external: support || null,
        concept,
        status: "registrado",
        payment_date: now.toISOString(),
        entity_id: selectedContract!.id,
        entity_name: "project_contracts",
        entity_type: `caja_principal_${paymentStage}`,
        notes: notes || null,
      };

      const { data: paymentRow, error: paymentError } = await supabase
        .from("client_payments")
        .insert(paymentPayload)
        .select("id")
        .single();

      if (paymentError) throw paymentError;

      const incomePayload = {
        income_code: incomeCode,
        contract_id: selectedContract!.id,
        quote_id: selectedContract!.quote_id || null,
        client_id: selectedContract!.client_id || null,
        client_name: selectedContract!.client_name || null,
        concept: `Ingreso Caja Principal - ${concept}`,
        amount,
        currency: "DOP",
        payment_method: stageMethod,
        reference_external: support || null,
        account_name: "Caja Principal",
        status: "registrado",
        income_date: now.toISOString(),
        source_type: "client_payments",
        source_id: paymentRow?.id || null,
        payment_id: paymentRow?.id || null,
        entity_id: selectedContract!.id,
        entity_name: "project_contracts",
        entity_type: `caja_principal_${paymentStage}`,
        notes: notes || null,
      };

      const { data: incomeRow, error: incomeError } = await supabase
        .from("income_records")
        .insert(incomePayload)
        .select("id")
        .single();

      if (incomeError) throw incomeError;

      if (incomeRow?.id && paymentRow?.id) {
        await supabase.from("client_payments").update({ income_record_id: incomeRow.id }).eq("id", paymentRow.id);
      }

      if (paymentStage === "initial_60") {
        const nextInitialPaid = selectedContractSummary.initialPaid + amount;
        const nextInitialDue = Math.max(selectedContractSummary.initialRequired - nextInitialPaid, 0);
        const patch: Record<string, any> = {
          initial_paid: nextInitialPaid,
          initial_due: nextInitialDue,
          updated_at: now.toISOString(),
        };

        if (nextInitialDue <= 0) {
          const token = selectedContract!.client_portal_token || createToken();
          patch.client_portal_token = token;
          patch.client_portal_url =
            selectedContract!.client_portal_url ||
            `${typeof window !== "undefined" ? window.location.origin : ""}/portal-cliente/${token}`;
          patch.portal_enabled = true;
          patch.portal_enabled_at = selectedContract!.portal_enabled_at || now.toISOString();
        }

        await supabase.from("project_contracts").update(patch).eq("id", selectedContract!.id);
      }

      await auditPayment("caja_principal_payment_registered", {
        ...paymentPayload,
        income_code: incomeCode,
        stage: paymentStage,
      });

      openIncomeReceipt({
        incomeCode,
        paymentCode,
        contract: selectedContract!,
        stage: paymentStage,
        amount,
        method: stageMethod,
        reference: support,
        notes,
      });

      setStageReference("");
      setStageNotes("");
      setNotice({ tone: "success", text: `Caja Principal registro ${stageLabel(paymentStage)} por ${money(amount)}. Recibo ${incomeCode} enviado a impresion.` });
      await loadAll();
    } catch (error: any) {
      setNotice({ tone: "error", text: `Error registrando Caja Principal: ${error?.message || error}` });
    } finally {
      setSaving(false);
    }
  }

  function reimprimirCobroCaja(payment: ClientPayment) {
    const linkedContract =
      contracts.find((contract) => String(contract.id || "") === String(payment.contract_id || "")) ||
      contracts.find((contract) => String(contract.quote_id || "") === String(payment.quote_id || ""));
    const pseudoContract: ProjectContract =
      linkedContract || {
        id: payment.contract_id || payment.calendar_event_id || payment.id,
        contract_code: payment.entity_type === "caja_principal_measurement_5000" ? payment.payment_code || payment.code || "Abono medicion" : payment.contract_id || "-",
        client_id: payment.client_id,
        client_name: payment.client_name,
        project_name: payment.entity_type === "caja_principal_measurement_5000" ? "Medicion + render" : payment.entity_name || "Proyecto",
        total_amount: cajaPaymentAmount(payment),
      };

    openIncomeReceipt({
      incomeCode: payment.income_code || payment.income_record_id || payment.payment_code || payment.code || "SIN-CODIGO",
      paymentCode: payment.payment_code || payment.code || payment.id || "SIN-PAGO",
      contract: pseudoContract,
      stage: classifyClientPayment(payment),
      amount: cajaPaymentAmount(payment),
      method: text(payment.payment_method || payment.metodo) || "efectivo",
      reference: text(payment.reference_external || payment.reference),
      notes: text(payment.notes || payment.concept),
      reprint: true,
    });

    void auditPayment("caja_principal_receipt_reprinted", {
      payment_id: payment.id,
      payment_code: payment.payment_code || payment.code,
      contract_id: payment.contract_id || null,
      amount: cajaPaymentAmount(payment),
      reprint: true,
    });
  }

  return (
    <main className="min-h-screen bg-[#020817] p-4 text-white md:p-6">
      <div className="mx-auto w-full max-w-[1780px] space-y-5">
        <section className="rounded-3xl border border-cyan-900/50 bg-gradient-to-br from-[#081421] via-[#0b1830] to-[#111b3f] p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.30em] text-cyan-300">
                <ShieldCheck size={14} /> COBROS PRO
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                Pagos y Cuentas por Cobrar
              </h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-300">
                Registro de cobros con soporte obligatorio, balance actualizado y lectura antifraude para Contabilidad.
              </p>
            </div>

            <button
              onClick={loadAll}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-5 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              Actualizar
            </button>
          </div>
        </section>

        {notice ? (
          <section className={`rounded-2xl border px-4 py-3 text-sm font-bold ${noticeClass(notice.tone)}`}>
            {notice.text}
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi title="Facturas pendientes" value={String(pendientes.length)} icon={<FileCheck2 />} tone={pendientes.length ? "amber" : "green"} />
          <Kpi title="Total pendiente" value={money(totalPendiente)} icon={<Banknote />} tone={totalPendiente ? "amber" : "green"} />
          <Kpi title="Pagos registrados" value={String(clientPayments.length + activePayments.length)} icon={<CreditCard />} tone="cyan" />
          <Kpi title="Total cobrado" value={money(totalCajaCentral + totalCobrado)} icon={<Wallet />} tone="green" />
          <Kpi title="Soporte cobros" value={`${supportCoverage}%`} icon={<ShieldCheck />} tone={supportCoverage >= 90 ? "green" : "red"} />
        </section>

        <section className="rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-[#081421] via-[#082333] to-[#030817] p-5 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-200">
                <Wallet size={14} /> Caja del dia
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-black">Apertura, cierre y auditoria diaria</h2>
                <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${
                  openCashSession
                    ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                    : lastCashSession?.status === "closed"
                      ? "border-slate-500/35 bg-slate-500/10 text-slate-200"
                      : "border-amber-400/35 bg-amber-500/10 text-amber-200"
                }`}>
                  {openCashSession ? "Abierta" : lastCashSession?.status === "closed" ? "Cerrada" : "Sin abrir"}
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs font-black text-slate-300">
                  {cashStoreMode === "database" ? "Auditoria DB" : "Auditoria local"}
                </span>
              </div>
              <p className="mt-2 max-w-4xl text-sm font-semibold text-slate-300">
                Toda venta o pago de contrato exige caja abierta. El cierre compara efectivo contado contra apertura + efectivo recibido y genera reporte para auditoria.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:w-[760px]">
              <MiniMetric label="Apertura" value={money(n(openCashSession?.opening_amount || lastCashSession?.opening_amount))} />
              <MiniMetric label="Cobrado hoy" value={money(dayTotalCollected)} />
              <MiniMetric label="Efectivo esperado" value={money(expectedCashAmount)} />
              <MiniMetric label="Diferencia" value={cashClosingAmount ? money(closeDifference) : "Pendiente"} danger={Math.abs(closeDifference) > 0.01 && Boolean(cashClosingAmount)} />
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={cashDate}
                onChange={(event) => setCashDate(event.target.value || todayKey())}
                type="date"
                className="h-12 rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              />
              <input
                value={cashOpeningAmount}
                onChange={(event) => setCashOpeningAmount(event.target.value)}
                disabled={Boolean(openCashSession)}
                type="number"
                min="0"
                step="0.01"
                placeholder="Fondo inicial"
                className="h-12 rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400 disabled:opacity-60"
              />
              <input
                value={cashClosingAmount}
                onChange={(event) => setCashClosingAmount(event.target.value)}
                disabled={!openCashSession}
                type="number"
                min="0"
                step="0.01"
                placeholder="Efectivo contado al cierre"
                className="h-12 rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400 disabled:opacity-60 md:col-span-2"
              />
              <textarea
                value={cashNotes}
                onChange={(event) => setCashNotes(event.target.value)}
                placeholder="Notas de apertura/cierre, cuadre o diferencia"
                className="min-h-[86px] rounded-2xl border border-slate-700 bg-[#030817] px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400 md:col-span-2"
              />
              <button
                onClick={abrirCajaDia}
                disabled={saving || Boolean(openCashSession)}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-black text-slate-950 hover:brightness-110 disabled:opacity-50"
              >
                <ShieldCheck size={18} />
                Abrir caja
              </button>
              <button
                onClick={cerrarCajaDia}
                disabled={saving || !openCashSession || !cashClosingAmount}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-amber-400/35 bg-amber-500/15 px-4 py-3 text-sm font-black text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
              >
                <Printer size={18} />
                Cerrar e imprimir reporte
              </button>
            </div>

            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Reporte del dia</p>
                  <h3 className="text-xl font-black text-white">{cashDate}</h3>
                </div>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-200">
                  {dayClientPayments.length} movimiento(s)
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Line label="Efectivo" value={money(dayCashCollected)} />
                <Line label="Transferencia" value={money(dayTransferCollected)} />
                <Line label="Tarjeta" value={money(dayCardCollected)} />
                <Line label="Cheque" value={money(dayCheckCollected)} />
              </div>

              <div className="mt-4 max-h-[180px] space-y-2 overflow-y-auto pr-1">
                {dayClientPayments.slice(0, 10).map((payment) => (
                  <div key={payment.id || payment.payment_code || payment.code} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#030817]/80 p-3 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-black text-cyan-100">{payment.payment_code || payment.code || "Pago Caja"}</p>
                      <p className="truncate font-bold text-slate-400">{payment.client_name || "Cliente"} - {methodLabels[text(payment.payment_method || payment.metodo)] || text(payment.payment_method || payment.metodo) || "Efectivo"}</p>
                    </div>
                    <span className="shrink-0 font-black text-emerald-300">{money(cajaPaymentAmount(payment))}</span>
                  </div>
                ))}

                {!dayClientPayments.length ? (
                  <p className="rounded-xl border border-slate-800 p-4 text-center text-sm font-bold text-slate-500">
                    No hay cobros registrados en la fecha seleccionada.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-[#030817] p-5 shadow-2xl shadow-black/25">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-emerald-200">
                <ShieldCheck size={14} /> Caja Principal
              </div>
              <h2 className="mt-3 text-3xl font-black">Cobro central por etapas</h2>
              <p className="mt-2 max-w-4xl text-sm font-semibold text-slate-300">
                Todo ingreso del proyecto se registra aqui: RD$5,000 de medicion/render, inicial 60%, 20% para transporte y 20% final.
                Los modulos operativos solo se liberan cuando Caja Principal confirma el pago.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/70 p-4 text-sm font-bold text-emerald-100">
              <Line label="Ingresos centrales" value={money(totalCajaCentral)} />
              <Line label="Contratos activos" value={String(contracts.length)} />
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={stageContractId}
                onChange={(event) => {
                  const value = event.target.value;
                  setStageContractId(value);
                  if (value.startsWith("event:")) setStage("measurement_5000");
                }}
                className="h-12 rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400 md:col-span-2"
              >
                <option value="">Seleccionar visita pendiente o contrato/proyecto</option>
                {pendingMeasurementEvents.length ? (
                  <optgroup label="Visitas pendientes RD$5,000">
                    {pendingMeasurementEvents.map((event) => (
                      <option key={event.id} value={`event:${event.id}`}>
                        Caja RD$5,000 - {event.client_name || "Cliente"} - {event.title || "Medida en obra"}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label="Contratos / proyectos">
                {contracts.map((contract) => (
                  <option key={contract.id || contract.contract_code} value={contract.id || ""}>
                    {contract.contract_code || "Contrato"} - {contract.client_name || "Cliente"} - {contract.project_name || "Proyecto"}
                  </option>
                ))}
                </optgroup>
              </select>

              <select
                value={stage}
                onChange={(event) => setStage(event.target.value as PaymentStage)}
                className="h-12 rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              >
                <option value="measurement_5000">RD$5,000 medicion + render</option>
                <option value="initial_60">Inicial 60%</option>
                <option value="delivery_20">20% entrega / transporte</option>
                <option value="final_20">20% final instalacion</option>
              </select>

              <input
                value={stageAmountValue}
                onChange={(event) => setStageAmountValue(event.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder="Monto a cobrar"
                className="h-12 rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              />

              <select
                value={stageMethod}
                onChange={(event) => setStageMethod(event.target.value)}
                className="h-12 rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="cheque">Cheque</option>
              </select>

              <input
                value={stageReference}
                onChange={(event) => setStageReference(event.target.value)}
                placeholder="Referencia / voucher / soporte"
                className="h-12 rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
              />

              <textarea
                value={stageNotes}
                onChange={(event) => setStageNotes(event.target.value)}
                placeholder="Nota de Caja Principal"
                className="min-h-[96px] rounded-2xl border border-slate-700 bg-[#030817] px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400 md:col-span-2"
              />

              <button
                onClick={registrarPagoEtapa}
                disabled={saving || (!selectedContract && !selectedAgendaEvent)}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-sm font-black text-slate-950 shadow-xl shadow-cyan-950/30 hover:brightness-110 disabled:opacity-60 md:col-span-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                Registrar en Caja Principal + imprimir recibo
              </button>
            </div>

            <div className="rounded-2xl border border-cyan-400/25 bg-slate-950/70 p-5">
              <h3 className="text-xl font-black text-cyan-100">
                {selectedAgendaEvent ? selectedAgendaEvent.title || "Medicion + render" : selectedContract ? selectedContract.project_name || "Proyecto" : "Selecciona un proyecto"}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {selectedAgendaEvent
                  ? `${selectedAgendaEvent.client_name || "Cliente"} - visita pendiente de Caja Principal`
                  : selectedContract
                  ? `${selectedContract.client_name || "Cliente"} - ${selectedContract.contract_code || "sin contrato"}`
                  : "Caja Principal calcula el pendiente real por etapa."}
              </p>

              <div className="mt-4 space-y-2 text-sm">
                <Line label="Total proyecto" value={money(selectedContractSummary.total)} />
                <Line label="Abono reservado para pago final" value={money(selectedContractSummary.credit)} />
                <Line label={`${stageLabel(stage)} requerido`} value={money(selectedStageRequired)} />
                <Line label={`${stageLabel(stage)} pagado`} value={money(selectedStagePaid)} />
                <Line label="Pendiente etapa" value={selectedStageDue <= 0 ? "Cubierto" : money(selectedStageDue)} danger={selectedStageDue > 0} />
                <Line label="Balance general" value={money(selectedContractSummary.balance)} danger={selectedContractSummary.balance > 0} />
              </div>

              <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs font-bold leading-5 text-amber-100">
                Regla: si el 20% de entrega no esta cubierto, Transporte no puede cargar ni salir. Si el 20% final no esta cubierto, Entrega Final no debe cerrar.
              </div>

              <div className="mt-4 rounded-2xl border border-slate-700/70 bg-[#030817]/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Reimpresion auditada</p>
                    <h4 className="text-lg font-black text-white">Ultimos recibos Caja Principal</h4>
                  </div>
                  <Printer className="text-cyan-300" size={18} />
                </div>
                <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                  {clientPayments.slice(0, 8).map((payment) => (
                    <div key={payment.id || payment.payment_code || payment.code} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs md:grid-cols-[1fr_auto] md:items-center">
                      <div>
                        <p className="font-black text-cyan-100">{payment.payment_code || payment.code || "Pago Caja"}</p>
                        <p className="font-bold text-slate-400">{payment.client_name || "Cliente"} · {stageLabel(classifyClientPayment(payment))}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{dateText(payment.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3 md:justify-end">
                        <span className="font-black text-emerald-300">{money(cajaPaymentAmount(payment))}</span>
                        <button
                          onClick={() => reimprimirCobroCaja(payment)}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 font-black text-cyan-100 hover:bg-cyan-500/20"
                        >
                          <Printer size={14} />
                          Reimprimir
                        </button>
                      </div>
                    </div>
                  ))}

                  {!clientPayments.length ? (
                    <p className="rounded-xl border border-slate-800 p-4 text-center text-sm font-bold text-slate-500">
                      Todavia no hay recibos de Caja Principal para reimprimir.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-black">
              <Wallet className="text-cyan-300" /> Registrar pago blindado
            </h2>

            <div className="space-y-3">
              <select value={saleId} onChange={(event) => handleSaleChange(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400">
                <option value="">Seleccionar factura pendiente</option>
                {pendientes.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    {saleCode(sale)} - {sale.client_name || "Cliente"} - Balance {money(saleBalance(sale))}
                  </option>
                ))}
              </select>

              <select value={clienteId} onChange={(event) => setClienteId(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400">
                <option value="">Cliente no vinculado</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {clientName(cliente)} - {clientPhone(cliente) || "sin telefono"}
                  </option>
                ))}
              </select>

              <input value={monto} onChange={(event) => setMonto(event.target.value)} type="number" min="0" step="0.01" placeholder="Monto abonado" className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />

              <select value={metodo} onChange={(event) => setMetodo(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="cheque">Cheque</option>
              </select>

              <input value={referencia} onChange={(event) => setReferencia(event.target.value)} placeholder="Referencia / autorizacion / soporte" className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />

              <textarea value={nota} onChange={(event) => setNota(event.target.value)} placeholder="Nota interna del cobro" className="min-h-[112px] w-full rounded-2xl border border-slate-700 bg-[#030817] px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400" />

              {selectedSale ? (
                <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-sm">
                  <Line label="Factura" value={saleCode(selectedSale)} />
                  <Line label="Cliente" value={selectedSale.client_name || clientName(selectedCliente)} />
                  <Line label="Total" value={money(saleTotal(selectedSale))} />
                  <Line label="Pagado" value={money(salePaid(selectedSale))} />
                  <Line label="Balance actual" value={money(saleBalance(selectedSale))} danger />
                </div>
              ) : null}

              <button
                onClick={registrarPago}
                disabled={saving}
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-sm font-black text-slate-950 shadow-xl shadow-cyan-950/30 hover:brightness-110 disabled:opacity-60"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                Registrar pago
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5 shadow-2xl shadow-black/30">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Facturas pendientes</h2>
                  <p className="text-sm text-slate-400">{filteredPendientes.length} factura(s) filtrada(s)</p>
                </div>

                <div className="relative w-full lg:w-[360px]">
                  <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar factura, cliente, telefono..." className="h-12 w-full rounded-2xl border border-slate-700 bg-[#030817] pl-11 pr-4 text-sm font-bold text-white outline-none focus:border-cyan-400" />
                </div>
              </div>

              <div className="overflow-auto rounded-2xl border border-slate-800">
                <table className="w-full min-w-[840px] text-sm">
                  <thead className="bg-[#030817] text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                    <tr>
                      <th className="px-4 py-4">Factura</th>
                      <th className="px-4 py-4">Cliente</th>
                      <th className="px-4 py-4">Total</th>
                      <th className="px-4 py-4">Pagado</th>
                      <th className="px-4 py-4">Balance</th>
                      <th className="px-4 py-4">Estado</th>
                      <th className="px-4 py-4 text-right">Supervisor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredPendientes.map((sale) => (
                      <tr key={sale.id} onClick={() => handleSaleChange(sale.id)} className="cursor-pointer hover:bg-cyan-500/5">
                        <td className="px-4 py-4 font-black text-cyan-200">{saleCode(sale)}</td>
                        <td className="px-4 py-4">
                          <p className="font-black text-white">{sale.client_name || "Cliente"}</p>
                          <p className="text-xs text-slate-500">{sale.client_phone || "-"}</p>
                        </td>
                        <td className="px-4 py-4 font-black text-white">{money(saleTotal(sale))}</td>
                        <td className="px-4 py-4 font-black text-emerald-300">{money(salePaid(sale))}</td>
                        <td className="px-4 py-4 font-black text-amber-300">{money(saleBalance(sale))}</td>
                        <td className="px-4 py-4 text-slate-300">{sale.status || "-"}</td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void anularFacturaPendiente(sale);
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200 hover:bg-red-500/20"
                          >
                            <XCircle size={14} />
                            Anular
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!filteredPendientes.length ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center font-bold text-slate-500">
                          No hay facturas pendientes.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.7fr_1.3fr]">
              <div className="rounded-3xl border border-amber-400/25 bg-amber-500/10 p-5">
                <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-amber-100">
                  <AlertTriangle size={20} /> Control antifraude
                </h3>
                <div className="space-y-3">
                  {riskAlerts.map((alert) => (
                    <div key={alert} className="rounded-2xl border border-amber-400/25 bg-[#030817]/60 p-3 text-sm font-bold text-amber-100">
                      {alert}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-900/45 bg-gradient-to-br from-[#081421] to-[#030817] p-5">
                <h3 className="mb-4 flex items-center gap-2 text-xl font-black">
                  <CheckCircle2 className="text-emerald-300" /> Ultimos pagos
                </h3>
                <div className="max-h-[280px] overflow-y-auto rounded-2xl border border-slate-800">
                  {payments.map((payment) => (
                    <div key={payment.id} className={`grid gap-3 border-b border-slate-800 p-4 text-sm md:grid-cols-[1fr_auto] ${paymentIsVoided(payment) ? "opacity-55" : ""}`}>
                      <div>
                        <p className="font-black text-white">{methodLabels[paymentMethod(payment)] || paymentMethod(payment)}</p>
                        <p className="text-xs text-slate-400">{paymentNotes(payment) || "Sin nota"}</p>
                        <p className="mt-1 text-[11px] font-bold text-slate-500">{dateText(payment.created_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className={`font-black ${paymentIsVoided(payment) ? "text-red-300 line-through" : "text-emerald-300"}`}>
                          {money(paymentAmount(payment))}
                        </p>
                        {!paymentIsVoided(payment) ? (
                          <button
                            onClick={() => void reversarPago(payment)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-400/25 bg-red-500/10 px-2 py-1 text-[11px] font-black text-red-200 hover:bg-red-500/20"
                          >
                            <XCircle size={12} />
                            Reversar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}

                  {!payments.length ? (
                    <p className="p-6 text-center font-bold text-slate-500">Sin pagos registrados.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Kpi({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  tone: "green" | "cyan" | "amber" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-300 border-emerald-400/25 bg-emerald-500/10"
      : tone === "cyan"
        ? "text-cyan-300 border-cyan-400/25 bg-cyan-500/10"
        : tone === "amber"
          ? "text-amber-300 border-amber-400/25 bg-amber-500/10"
          : "text-red-300 border-red-400/25 bg-red-500/10";

  return (
    <div className="rounded-3xl border border-slate-800 bg-[#081421] p-5 shadow-xl shadow-black/25">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border ${toneClass}`}>{icon}</div>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <p className={`mt-2 text-2xl font-black ${toneClass.split(" ")[0]}`}>{value}</p>
    </div>
  );
}

function MiniMetric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${danger ? "border-red-400/30 bg-red-500/10" : "border-slate-700/70 bg-slate-950/70"}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.20em] text-slate-500">{label}</p>
      <p className={`mt-2 truncate text-xl font-black ${danger ? "text-red-200" : "text-white"}`}>{value}</p>
    </div>
  );
}

function Line({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="mb-2 flex justify-between gap-3">
      <span className="font-bold text-slate-400">{label}</span>
      <span className={`text-right font-black ${danger ? "text-amber-300" : "text-white"}`}>{value}</span>
    </div>
  );
}
