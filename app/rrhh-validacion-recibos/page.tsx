"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ShieldCheck, Search, Download, RefreshCw, CheckCircle2, PenLine } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Receipt = {
  id: string;
  receipt_number: string | null;
  employee_code: string | null;
  employee_name: string | null;
  identification: string | null;
  department: string | null;
  position: string | null;
  period_name: string | null;
  start_date: string | null;
  end_date: string | null;
  pay_date: string | null;
  gross_pay: number | null;
  total_deductions: number | null;
  net_pay: number | null;
  employee_signature: string | null;
  employee_signed_at: string | null;
  signature_image: string | null;
  validation_token: string | null;
  validated_count: number | null;
  last_validated_at: string | null;
};

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export default function RRHHValidacionRecibosPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter((r) =>
      [
        r.receipt_number,
        r.employee_code,
        r.employee_name,
        r.identification,
        r.period_name,
        r.employee_signature,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [receipts, search]);

  async function loadAll() {
    try {
      setLoading(true);
      setMessage("");

      const { data, error } = await supabase
        .from("v_payroll_receipts_validation_detail")
        .select("*")
        .order("employee_signed_at", { ascending: false, nullsFirst: false })
        .limit(300);

      if (error) throw error;

      setReceipts((data || []) as Receipt[]);
    } catch (error: any) {
      setMessage(error.message || "Error cargando recibos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function downloadReceipt(receipt: Receipt) {
    const origin = window.location.origin;
    const validationUrl = `${origin}/validar-recibo?token=${receipt.validation_token}`;
    const qr = await QRCode.toDataURL(validationUrl, { width: 220, margin: 1 });

    const doc = new jsPDF("portrait", "mm", "letter");

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 216, 34, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("RD WOOD SYSTEM PRO", 14, 15);
    doc.setFontSize(10);
    doc.text("Recibo de Nómina con Validación QR", 14, 24);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Recibo: ${receipt.receipt_number || receipt.id.slice(0, 8)}`, 14, 45);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Empleado: ${receipt.employee_code || ""} · ${receipt.employee_name || ""}`, 14, 54);
    doc.text(`Cédula: ${receipt.identification || ""}`, 14, 60);
    doc.text(`Cargo: ${receipt.position || ""}`, 14, 66);
    doc.text(`Departamento: ${receipt.department || ""}`, 14, 72);
    doc.text(`Periodo: ${receipt.period_name || ""}`, 14, 80);
    doc.text(`Desde: ${receipt.start_date || ""}  Hasta: ${receipt.end_date || ""}`, 14, 86);
    doc.text(`Fecha pago: ${receipt.pay_date || ""}`, 14, 92);

    doc.addImage(qr, "PNG", 160, 45, 35, 35);
    doc.setFontSize(7);
    doc.text("Escanear para validar", 160, 84);

    autoTable(doc, {
      startY: 105,
      head: [["Concepto", "Monto"]],
      body: [
        ["Total bruto", money(receipt.gross_pay)],
        ["Total deducciones", money(receipt.total_deductions)],
        ["Neto a pagar", money(receipt.net_pay)],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    const y = (doc as any).lastAutoTable.finalY + 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`Neto: ${money(receipt.net_pay)}`, 14, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Firma digital: ${receipt.employee_signature || "No firmado"}`, 14, y + 16);
    doc.text(
      `Fecha firma: ${
        receipt.employee_signed_at ? new Date(receipt.employee_signed_at).toLocaleString("es-DO") : "-"
      }`,
      14,
      y + 22
    );

    if (receipt.signature_image) {
      doc.text("Firma biométrica:", 14, y + 35);
      doc.addImage(receipt.signature_image, "PNG", 14, y + 38, 70, 22);
    }

    doc.setFontSize(7);
    doc.text(`Token: ${receipt.validation_token || ""}`, 14, 265);
    doc.text(`Validaciones: ${receipt.validated_count || 0}`, 14, 270);

    doc.save(`Recibo_QR_${receipt.employee_code || ""}_${receipt.receipt_number || ""}.pdf`);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">RD Wood System</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-5xl">
                Validación de Recibos QR
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Fase 10: firma biométrica, token único, QR y verificación pública.
              </p>
            </div>

            <button
              onClick={loadAll}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-lg hover:bg-blue-100"
            >
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

        <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi title="Recibos" value={receipts.length} icon={<ShieldCheck size={20} />} />
          <Kpi title="Firmados" value={receipts.filter((r) => r.employee_signature).length} icon={<PenLine size={20} />} />
          <Kpi title="Validados" value={receipts.reduce((a, r) => a + Number(r.validated_count || 0), 0)} icon={<CheckCircle2 size={20} />} />
          <Kpi title="Con QR" value={receipts.filter((r) => r.validation_token).length} icon={<ShieldCheck size={20} />} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl">
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar recibo..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-3">Recibo</th>
                  <th className="px-3 py-3">Empleado</th>
                  <th className="px-3 py-3">Periodo</th>
                  <th className="px-3 py-3">Neto</th>
                  <th className="px-3 py-3">Firma</th>
                  <th className="px-3 py-3">Validaciones</th>
                  <th className="px-3 py-3">PDF QR</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="px-3 py-3 font-bold">{r.receipt_number || r.id.slice(0, 8)}</td>
                    <td className="px-3 py-3">
                      <p className="font-bold">{r.employee_code} · {r.employee_name}</p>
                      <p className="text-xs text-slate-400">{r.identification}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p>{r.period_name}</p>
                      <p className="text-xs text-slate-400">{r.start_date} → {r.end_date}</p>
                    </td>
                    <td className="px-3 py-3 font-black text-emerald-300">{money(r.net_pay)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                        r.employee_signature ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                      }`}>
                        {r.employee_signature ? "Firmado" : "Pendiente"}
                      </span>
                    </td>
                    <td className="px-3 py-3">{r.validated_count || 0}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => downloadReceipt(r)}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold hover:bg-blue-500"
                      >
                        <Download size={15} />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!filtered.length && (
              <p className="py-6 text-sm text-slate-400">No hay recibos.</p>
            )}
          </div>
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
