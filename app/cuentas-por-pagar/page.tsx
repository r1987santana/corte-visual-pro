"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, CheckCircle2, DollarSign, Loader2, Plus, RefreshCw, Save, Search, Trash2, Truck, Wallet } from "lucide-react";

type Payable = {
  id: string;
  bill_no: string | null;
  supplier_name: string | null;
  supplier_phone: string | null;
  description: string | null;
  category: string | null;
  total_amount: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  due_date: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
};

type FormState = {
  supplier_name: string;
  supplier_phone: string;
  description: string;
  category: string;
  total_amount: string;
  amount_paid: string;
  due_date: string;
  notes: string;
};

const RD = new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", minimumFractionDigits: 2 });
const money = (v: any) => RD.format(Number.isFinite(Number(v)) ? Number(v) : 0);
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysUntil(date?: string | null) {
  if (!date) return 9999;
  const now = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const due = new Date(date).getTime();
  return Math.ceil((due - now) / 86400000);
}

function computedStatus(row: Payable) {
  const balance = num(row.balance_due);
  const days = daysUntil(row.due_date);
  if (balance <= 0) return "pagada";
  if (days < 0) return "vencida";
  if (days <= 3) return "por vencer";
  return row.status || "pendiente";
}

function badge(status: string) {
  if (status === "pagada") return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
  if (status === "vencida") return "border-red-500/30 bg-red-500/15 text-red-300";
  if (status === "por vencer") return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  return "border-cyan-500/30 bg-cyan-500/15 text-cyan-300";
}

export default function CuentasPorPagarPage() {
  const [rows, setRows] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const [form, setForm] = useState<FormState>({
    supplier_name: "",
    supplier_phone: "",
    description: "",
    category: "materiales",
    total_amount: "",
    amount_paid: "0",
    due_date: addDaysISO(15),
    notes: "",
  });

  function updateForm(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase.from("accounts_payable").select("*").order("created_at", { ascending: false });
    if (error) {
      alert(error.message);
      setRows([]);
    } else {
      setRows((data || []) as Payable[]);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.supplier_name.trim()) return alert("Coloca el suplidor.");
    if (num(form.total_amount) <= 0) return alert("Coloca un monto válido.");

    setSaving(true);
    const total = num(form.total_amount);
    const paid = num(form.amount_paid);
    const balance = Math.max(total - paid, 0);

    const { error } = await supabase.from("accounts_payable").insert({
      supplier_name: form.supplier_name.trim(),
      supplier_phone: form.supplier_phone.trim() || null,
      description: form.description.trim() || "Cuenta por pagar",
      category: form.category,
      total_amount: total,
      amount_paid: paid,
      balance_due: balance,
      due_date: form.due_date || null,
      status: balance <= 0 ? "pagada" : paid > 0 ? "parcial" : "pendiente",
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) return alert(error.message);

    setForm({ supplier_name: "", supplier_phone: "", description: "", category: "materiales", total_amount: "", amount_paid: "0", due_date: addDaysISO(15), notes: "" });
    await loadData();
  }

  async function handlePay(row: Payable) {
    const currentBalance = num(row.balance_due);
    if (currentBalance <= 0) return alert("Esta cuenta ya está pagada.");

    const amountText = prompt("Monto a pagar:", String(currentBalance));
    if (!amountText) return;
    const amount = num(amountText);
    if (amount <= 0) return alert("Monto inválido.");

    const newPaid = num(row.amount_paid) + amount;
    const newBalance = Math.max(num(row.total_amount) - newPaid, 0);

    const { error } = await supabase.from("accounts_payable").update({
      amount_paid: newPaid,
      balance_due: newBalance,
      status: newBalance <= 0 ? "pagada" : "parcial",
    }).eq("id", row.id);
    if (error) return alert(error.message);

    await supabase.from("accounts_payable_payments").insert({ payable_id: row.id, amount, payment_method: "efectivo", notes: "Abono registrado desde Cuentas por Pagar PRO" });
    await loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta cuenta por pagar?")) return;
    const { error } = await supabase.from("accounts_payable").delete().eq("id", id);
    if (error) return alert(error.message);
    await loadData();
  }

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => rows.filter((row) => {
    const q = query.toLowerCase().trim();
    const text = `${row.bill_no || ""} ${row.supplier_name || ""} ${row.description || ""} ${row.category || ""}`.toLowerCase();
    const status = computedStatus(row);
    const balance = num(row.balance_due);
    if (q && !text.includes(q)) return false;
    if (filter === "pendientes") return balance > 0;
    if (filter === "vencidas") return status === "vencida";
    if (filter === "pagadas") return balance <= 0;
    if (filter === "por_vencer") return status === "por vencer";
    return true;
  }), [rows, query, filter]);

  const stats = useMemo(() => ({
    count: rows.filter((r) => num(r.balance_due) > 0).length,
    total: rows.reduce((a, r) => a + num(r.total_amount), 0),
    paid: rows.reduce((a, r) => a + num(r.amount_paid), 0),
    pending: rows.reduce((a, r) => a + num(r.balance_due), 0),
    overdue: rows.filter((r) => num(r.balance_due) > 0 && daysUntil(r.due_date) < 0).length,
  }), [rows]);

  return (
    <main className="min-h-screen bg-[#020817] p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-cyan-900/60 bg-gradient-to-br from-[#07111f] to-[#101b3f] p-8 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-black tracking-[0.35em] text-cyan-300">FASE 28</div>
              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">Cuentas por Pagar PRO</h1>
              <p className="mt-2 max-w-4xl text-slate-300">Control de suplidores, facturas pendientes, vencimientos, abonos y obligaciones.</p>
            </div>
            <button onClick={loadData} disabled={loading} className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-white px-6 font-black text-slate-950 disabled:opacity-60">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />} Actualizar
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <Card title="Cuentas pendientes" value={String(stats.count)} icon={<Wallet />} tone="cyan" />
          <Card title="Total facturado" value={money(stats.total)} icon={<DollarSign />} tone="blue" />
          <Card title="Pagado" value={money(stats.paid)} icon={<CheckCircle2 />} tone="green" />
          <Card title="Por pagar" value={money(stats.pending)} icon={<DollarSign />} tone="amber" />
          <Card title="Vencidas" value={String(stats.overdue)} icon={<AlertTriangle />} tone={stats.overdue ? "red" : "green"} />
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-6 shadow-2xl shadow-black/25">
            <h2 className="mb-5 flex items-center gap-2 text-2xl font-black"><Plus className="text-cyan-300" />Nueva cuenta</h2>
            <div className="space-y-4">
              <Input label="Suplidor" value={form.supplier_name} onChange={(v) => updateForm("supplier_name", v)} placeholder="Nombre del suplidor" />
              <Input label="Teléfono" value={form.supplier_phone} onChange={(v) => updateForm("supplier_phone", v)} placeholder="809..." />
              <Input label="Descripción" value={form.description} onChange={(v) => updateForm("description", v)} placeholder="Factura, materiales, servicio..." />
              <Select label="Categoría" value={form.category} onChange={(v) => updateForm("category", v)} />
              <Input label="Monto total" value={form.total_amount} onChange={(v) => updateForm("total_amount", v)} placeholder="0.00" type="number" />
              <Input label="Abonado" value={form.amount_paid} onChange={(v) => updateForm("amount_paid", v)} placeholder="0.00" type="number" />
              <Input label="Vence" value={form.due_date} onChange={(v) => updateForm("due_date", v)} type="date" />
              <button onClick={handleCreate} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 py-4 font-black text-white disabled:opacity-60">
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Guardar cuenta
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-6 shadow-2xl shadow-black/25 xl:col-span-2">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="flex items-center gap-2 text-2xl font-black"><Truck className="text-cyan-300" />Obligaciones pendientes</h2>
              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar suplidor..." className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 pl-11 pr-4 outline-none focus:border-cyan-400 md:w-72" /></div>
                <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-12 rounded-2xl border border-slate-700 bg-slate-950 px-4 outline-none focus:border-cyan-400"><option value="todos">Todos</option><option value="pendientes">Pendientes</option><option value="por_vencer">Por vencer</option><option value="vencidas">Vencidas</option><option value="pagadas">Pagadas</option></select>
              </div>
            </div>

            <div className="overflow-auto rounded-2xl border border-slate-800">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-950 text-left text-xs uppercase tracking-[0.2em] text-slate-400"><tr><th className="p-4">Factura</th><th className="p-4">Suplidor</th><th className="p-4">Descripción</th><th className="p-4">Total</th><th className="p-4">Pagado</th><th className="p-4">Balance</th><th className="p-4">Vence</th><th className="p-4">Estado</th><th className="p-4 text-right">Acciones</th></tr></thead>
                <tbody>
                  {filtered.map((row) => {
                    const st = computedStatus(row);
                    return <tr key={row.id} className="border-t border-slate-800 hover:bg-cyan-500/10"><td className="p-4 font-black text-cyan-300">{row.bill_no || "AUTO"}</td><td className="p-4"><div className="font-black">{row.supplier_name || "Suplidor"}</div><div className="text-xs text-slate-500">{row.supplier_phone || "-"}</div></td><td className="p-4"><div>{row.description || "-"}</div><div className="text-xs text-slate-500">{row.category || "general"}</div></td><td className="p-4 font-bold">{money(row.total_amount)}</td><td className="p-4 font-bold text-emerald-300">{money(row.amount_paid)}</td><td className="p-4 font-black text-amber-300">{money(row.balance_due)}</td><td className="p-4"><div>{row.due_date ? new Date(row.due_date).toLocaleDateString("es-DO") : "-"}</div><div className="text-xs text-slate-500">{row.due_date ? `${daysUntil(row.due_date)} días` : ""}</div></td><td className="p-4"><span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${badge(st)}`}>{st}</span></td><td className="p-4"><div className="flex justify-end gap-2"><button onClick={() => handlePay(row)} className="rounded-xl bg-emerald-600/20 px-3 py-2 font-black text-emerald-300">Abonar</button><button onClick={() => handleDelete(row.id)} className="rounded-xl bg-red-600/20 p-2 text-red-300"><Trash2 size={17} /></button></div></td></tr>;
                  })}
                  {!filtered.length && <tr><td colSpan={9} className="p-12 text-center text-slate-500">No hay cuentas por pagar para este filtro.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ title, value, icon, tone }: { title: string; value: string; icon: React.ReactNode; tone: "cyan" | "green" | "amber" | "red" | "blue" }) {
  const tones = { cyan: "text-cyan-300 border-cyan-500/30 bg-cyan-500/10", green: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10", amber: "text-amber-300 border-amber-500/30 bg-amber-500/10", red: "text-red-300 border-red-500/30 bg-red-500/10", blue: "text-blue-300 border-blue-500/30 bg-blue-500/10" };
  return <div className="rounded-3xl border border-cyan-900/50 bg-[#07111f] p-5"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">{title}</p><div className={`rounded-2xl border p-3 ${tones[tone]}`}>{icon}</div></div><div className="text-2xl font-black md:text-3xl">{value}</div></div>;
}

function Input({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <div><label className="mb-2 block text-xs font-black uppercase tracking-[0.25em] text-slate-400">{label}</label><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400" /></div>;
}

function Select({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div><label className="mb-2 block text-xs font-black uppercase tracking-[0.25em] text-slate-400">{label}</label><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"><option value="materiales">Materiales</option><option value="herrajes">Herrajes</option><option value="servicios">Servicios</option><option value="transporte">Transporte</option><option value="nomina">Nómina</option><option value="alquiler">Alquiler</option><option value="otros">Otros</option></select></div>;
}
