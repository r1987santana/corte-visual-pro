"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, ShieldCheck, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ValidationResult = {
  ok: boolean;
  message: string;
  payroll_item_id: string | null;
  receipt_number: string | null;
  employee_code: string | null;
  employee_name: string | null;
  employee_identification: string | null;
  period_name: string | null;
  start_date: string | null;
  end_date: string | null;
  pay_date: string | null;
  gross_pay: number | null;
  total_deductions: number | null;
  net_pay: number | null;
  employee_signature: string | null;
  employee_signed_at: string | null;
  validation_count: number | null;
};

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export default function ValidarReciboPage() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") || "";
    if (t) {
      setToken(t);
      validate(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function validate(customToken?: string) {
    const finalToken = customToken || token;

    if (!finalToken.trim()) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.rpc("validate_payroll_receipt", {
        p_validation_token: finalToken.trim(),
        p_ip: null,
        p_user_agent: navigator.userAgent,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      setResult(row as ValidationResult);
    } catch (error: any) {
      setResult({
        ok: false,
        message: error.message || "Error validando recibo",
        payroll_item_id: null,
        receipt_number: null,
        employee_code: null,
        employee_name: null,
        employee_identification: null,
        period_name: null,
        start_date: null,
        end_date: null,
        pay_date: null,
        gross_pay: null,
        total_deductions: null,
        net_pay: null,
        employee_signature: null,
        employee_signed_at: null,
        validation_count: null,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto max-w-3xl py-8">
        <section className="mb-5 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-500/20 text-blue-200">
              <ShieldCheck size={30} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-blue-300">RD Wood System</p>
              <h1 className="text-3xl font-black">Validar Recibo</h1>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-300">
            Escanea el QR del recibo o pega el token de validación para confirmar autenticidad.
          </p>
        </section>

        <section className="mb-5 rounded-3xl border border-white/10 bg-white/5 p-5">
          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Token de validación
            </span>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="UUID del recibo"
              className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-400"
            />
          </label>

          <button
            onClick={() => validate()}
            disabled={loading}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-black hover:bg-blue-500 disabled:opacity-50"
          >
            <Search size={18} />
            Validar recibo
          </button>
        </section>

        {result && (
          <section className={`rounded-3xl border p-6 ${
            result.ok
              ? "border-emerald-400/30 bg-emerald-500/10"
              : "border-red-400/30 bg-red-500/10"
          }`}>
            <div className="mb-4 flex items-center gap-3">
              {result.ok ? (
                <CheckCircle2 size={34} className="text-emerald-300" />
              ) : (
                <XCircle size={34} className="text-red-300" />
              )}
              <div>
                <h2 className="text-2xl font-black">
                  {result.ok ? "Recibo válido" : "Recibo inválido"}
                </h2>
                <p className="text-sm text-slate-300">{result.message}</p>
              </div>
            </div>

            {result.ok && (
              <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-sm">
                <Info label="Recibo" value={result.receipt_number || "-"} />
                <Info label="Empleado" value={`${result.employee_code || ""} · ${result.employee_name || ""}`} />
                <Info label="Cédula" value={result.employee_identification || "-"} />
                <Info label="Periodo" value={`${result.period_name || "-"} (${result.start_date || "-"} a ${result.end_date || "-"})`} />
                <Info label="Fecha de pago" value={result.pay_date || "-"} />
                <Info label="Bruto" value={money(result.gross_pay)} />
                <Info label="Deducciones" value={money(result.total_deductions)} />
                <Info label="Neto" value={money(result.net_pay)} />
                <Info label="Firma" value={result.employee_signature || "No firmado"} />
                <Info
                  label="Fecha firma"
                  value={result.employee_signed_at ? new Date(result.employee_signed_at).toLocaleString("es-DO") : "-"}
                />
                <Info label="Validaciones" value={String(result.validation_count || 0)} />
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </div>
  );
}
