"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CheckCircle2,
  Gift,
  Loader2,
  PhoneCall,
  RefreshCw,
  Search,
  Share2,
  Trophy,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ReferralRow = {
  id: string;
  referral_code?: string | null;
  referral_link?: string | null;
  status?: string | null;
  bonus_status?: string | null;
  bonus_amount?: number | null;
  referrer_name?: string | null;
  resolved_referrer_name?: string | null;
  referred_name?: string | null;
  referred_phone?: string | null;
  referred_email?: string | null;
  referred_client_id?: string | null;
  referred_contract_id?: string | null;
  referrer_client_id?: string | null;
  referrer_phone?: string | null;
  project_interest?: string | null;
  completed_project_amount?: number | null;
  reward_code?: string | null;
  reward_amount?: number | null;
  reward_status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
};

type ClientRow = {
  id: string;
  name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  referral_bonus_balance?: number | null;
};

function money(value?: number | null) {
  return `RD$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function label(value?: string | null) {
  return String(value || "pendiente").replaceAll("_", " ");
}

function n(value: any) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function missingColumn(message?: string) {
  const match = String(message || "").match(/'([^']+)' column/);
  return match?.[1] || "";
}

async function updateCompatible(table: string, id: string, payload: Record<string, any>) {
  const next = { ...payload };

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const { error } = await supabase.from(table).update(next).eq("id", id);
    if (!error) return;

    const column = missingColumn(error.message);
    if (!column || !(column in next)) throw error;
    delete next[column];
  }
}

async function insertCompatible(table: string, payload: Record<string, any>) {
  const next = { ...payload };

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const { data, error } = await supabase.from(table).insert(next).select("*").single();
    if (!error) return data;

    const column = missingColumn(error.message);
    if (!column || !(column in next)) throw error;
    delete next[column];
  }

  return null;
}

function referralBonusFromConsumption(amount: number) {
  if (amount < 20000) return 0;
  if (amount < 50000) return Math.min(amount * 0.02, 1000);
  if (amount < 150000) return Math.min(amount * 0.03, 3000);
  if (amount < 300000) return Math.min(amount * 0.04, 7000);
  return Math.min(amount * 0.05, 12000);
}

function bonusRuleLabel(amount: number) {
  if (amount < 20000) return "Sin bono: consumo menor a RD$20,000.";
  if (amount < 50000) return "2% del consumo referido, tope RD$1,000.";
  if (amount < 150000) return "3% del consumo referido, tope RD$3,000.";
  if (amount < 300000) return "4% del consumo referido, tope RD$7,000.";
  return "5% del consumo referido, tope RD$12,000.";
}

function clientName(client: ClientRow) {
  return client.name || client.full_name || "";
}

export default function ReferidosPage() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    loadRows();
  }, []);

  async function loadRows() {
    setLoading(true);
    setMessage("");

    let res = await supabase
      .from("v_client_referral_summary")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (res.error) {
      res = await supabase
        .from("client_referrals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
    }

    if (res.error) {
      setMessage(`Error cargando referidos: ${res.error.message}`);
      setRows([]);
    } else {
      setRows((res.data || []) as ReferralRow[]);
    }

    setLoading(false);
  }

  async function markContacted(row: ReferralRow) {
    setBusyId(row.id);
    setMessage("");

    try {
      await updateCompatible("client_referrals", row.id, {
        status: "contactado_telefonico",
        referral_status: "contactado_telefonico",
        bonus_status: row.bonus_status || "pendiente_proyecto",
        notes: [row.project_interest || row.notes, `Contactado vía telefónica el ${new Date().toLocaleString("es-DO")}.`]
          .filter(Boolean)
          .join("\n"),
        updated_at: new Date().toISOString(),
      });
      setMessage("Referido marcado como contactado por teléfono.");
      await loadRows();
    } catch (error: any) {
      setMessage(`Error marcando contacto: ${error?.message || error}`);
    }

    setBusyId("");
  }

  async function findOrCreateReferredClient(row: ReferralRow) {
    const phone = String(row.referred_phone || "").trim();
    const name = String(row.referred_name || "").trim().toUpperCase();
    if (!name || !phone) {
      throw new Error("El referido necesita nombre y teléfono para crear cliente.");
    }

    const { data: clients } = await supabase.from("clients").select("*").limit(1000);
    const existing = ((clients || []) as ClientRow[]).find((client) => {
      const clientPhone = String(client.phone || client.whatsapp || "").replace(/\D/g, "");
      return clientPhone && clientPhone === phone.replace(/\D/g, "");
    });

    if (existing) return existing;

    const referralCode = `RDW-${Date.now().toString(36).toUpperCase().slice(-8)}`;
    return (await insertCompatible("clients", {
      name,
      full_name: name,
      phone,
      telefono: phone,
      whatsapp: phone,
      email: row.referred_email || null,
      category: "referido",
      status: "activo",
      referral_code: referralCode,
      referred_by_code: row.referral_code || null,
      referred_by_client_id: row.referrer_client_id || null,
      referral_bonus_balance: 0,
      notes: `Cliente creado desde Referidos PRO.\nReferido por: ${row.resolved_referrer_name || row.referrer_name || "cliente"}.\nCódigo referido: ${row.referral_code || "-"}.\nInterés: ${row.project_interest || "-"}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })) as ClientRow;
  }

  async function createReferredClient(row: ReferralRow) {
    setBusyId(row.id);
    setMessage("");

    try {
      const client = await findOrCreateReferredClient(row);
      await updateCompatible("client_referrals", row.id, {
        referred_client_id: client.id,
        status: "cliente_creado",
        referral_status: "cliente_creado",
        bonus_status: row.bonus_status || "pendiente_proyecto",
        updated_at: new Date().toISOString(),
      });
      setMessage(`${clientName(client) || row.referred_name} fue creado/vinculado como cliente referido.`);
      await loadRows();
    } catch (error: any) {
      setMessage(`Error creando cliente referido: ${error?.message || error}`);
    }

    setBusyId("");
  }

  async function resolveCompletedAmount(row: ReferralRow) {
    if (n(row.completed_project_amount) > 0) return n(row.completed_project_amount);

    const client = row.referred_client_id ? null : await findOrCreateReferredClient(row);
    const referredClientId = row.referred_client_id || client?.id || "";
    const referredName = normalize(row.referred_name);
    const referredPhone = String(row.referred_phone || "").replace(/\D/g, "");

    const { data: contracts } = await supabase.from("project_contracts").select("*").limit(1000);
    const matches = (contracts || []).filter((contract: any) => {
      const status = normalize(contract.status);
      const completed = status.includes("entregado_final") || status.includes("cerrado") || status.includes("pagado");
      const byId = referredClientId && contract.client_id === referredClientId;
      const byName = referredName && normalize(contract.client_name).includes(referredName);
      const byPhone = referredPhone && String(contract.client_phone || "").replace(/\D/g, "") === referredPhone;
      return completed && (byId || byName || byPhone);
    });

    return matches.reduce((sum: number, contract: any) => sum + n(contract.total_amount || contract.total_price), 0);
  }

  async function completeReferral(row: ReferralRow) {
    const projectAmount = await resolveCompletedAmount(row);
    const calculatedBonus = Math.round(referralBonusFromConsumption(projectAmount));
    const ok = confirm(
      `Confirmar bono para ${row.referrer_name || row.resolved_referrer_name || "cliente"} por referido ${row.referred_name || ""}?\n\nConsumo referido: ${money(projectAmount)}\nRegla: ${bonusRuleLabel(projectAmount)}\nBono: ${money(calculatedBonus)}`
    );
    if (!ok) return;

    setBusyId(row.id);
    setMessage("");

    try {
      await updateCompatible("client_referrals", row.id, {
        status: "proyecto_completado",
        referral_status: "proyecto_completado",
        bonus_status: calculatedBonus > 0 ? "disponible" : "sin_bono_por_monto",
        bonus_amount: calculatedBonus,
        completed_project_amount: projectAmount,
        bonus_type: "credito_proxima_compra_por_consumo_referido",
        reward_notes: `${bonusRuleLabel(projectAmount)} Bono calculado sobre consumo real del referido, no sobre proyecto futuro del referidor.`,
        completed_at: new Date().toISOString(),
        bonus_granted_at: calculatedBonus > 0 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      });

      if (calculatedBonus > 0 && row.referrer_client_id) {
        const { data: referrer } = await supabase.from("clients").select("*").eq("id", row.referrer_client_id).maybeSingle();
        if (referrer) {
          await updateCompatible("clients", row.referrer_client_id, {
            referral_bonus_balance: n((referrer as ClientRow).referral_bonus_balance) + calculatedBonus,
            updated_at: new Date().toISOString(),
          });
        }
      }

      setMessage(
        calculatedBonus > 0
          ? `Bono disponible: ${money(calculatedBonus)} para ${row.referrer_name || row.resolved_referrer_name || "cliente"}.`
          : "Referido completado, pero no genera bono porque el consumo no alcanza el mínimo definido."
      );
    } catch (error: any) {
      setMessage(`Error liberando bono: ${error?.message || error}`);
    }

    setBusyId("");
    await loadRows();
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [
        row.referral_code,
        row.referrer_name,
        row.resolved_referrer_name,
        row.referred_name,
        row.referred_phone,
        row.project_interest,
        row.status,
        row.bonus_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const completed = rows.filter((row) => row.status === "proyecto_completado").length;
    const pending = rows.filter((row) => row.status !== "proyecto_completado").length;
    const bonus = rows.reduce((sum, row) => sum + Number(row.reward_amount || row.bonus_amount || 0), 0);
    const referrers = new Set(rows.map((row) => row.resolved_referrer_name || row.referrer_name).filter(Boolean));
    return { total: rows.length, completed, pending, bonus, referrers: referrers.size };
  }, [rows]);

  return (
    <main className="min-h-screen bg-[#020617] p-6 text-white">
      <div className="mx-auto max-w-[1600px]">
        <section className="rounded-[34px] border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-[#07111f] to-[#07142a] p-8 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-emerald-200">
                <Share2 size={15} /> Fidelizacion organica
              </div>
              <h1 className="mt-5 text-4xl font-black lg:text-6xl">Referidos PRO</h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold text-slate-400">
                Trazabilidad clara de quien refirio a quien, estado del proyecto referido y bono disponible para la proxima compra.
              </p>
            </div>
            <button onClick={loadRows} disabled={loading} className="inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-7 py-4 text-sm font-black uppercase text-slate-950">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              Actualizar
            </button>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm font-black text-cyan-100">
            {message}
          </div>
        )}

        <section className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-5">
          <Stat title="Referidos" value={stats.total} icon={<UserPlus />} />
          <Stat title="Completados" value={stats.completed} icon={<CheckCircle2 />} />
          <Stat title="Pendientes" value={stats.pending} icon={<Trophy />} />
          <Stat title="Clientes activos" value={stats.referrers} icon={<Share2 />} />
          <Stat title="Bonos" value={money(stats.bonus)} icon={<BadgeDollarSign />} />
        </section>

        <section className="mt-6 rounded-[30px] border border-slate-800 bg-[#07111f] p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Control comercial</p>
              <h2 className="mt-2 text-2xl font-black">Bandeja de referidos</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar referido, cliente, telefono..." className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-950 pl-11 pr-4 text-sm font-bold outline-none focus:border-cyan-400" />
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-100">
                Bono automatico por consumo real
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-slate-800 bg-slate-950">
              <Loader2 className="animate-spin text-cyan-300" size={42} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950 p-10 text-center text-slate-400">
              No hay referidos registrados todavia.
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((row) => (
                <div key={row.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase text-cyan-200">{row.referral_code || "SIN-CODIGO"}</span>
                        <span className="rounded-full bg-blue-400/10 px-3 py-1 text-xs font-black uppercase text-blue-200">{label(row.status)}</span>
                        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase text-emerald-200">{label(row.bonus_status)}</span>
                      </div>
                      <h3 className="mt-3 text-2xl font-black">{row.referred_name || "Referido sin nombre"}</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-400">
                        Referido por {row.resolved_referrer_name || row.referrer_name || "cliente"} · {row.referred_phone || "sin telefono"}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">{row.project_interest || row.notes || "Sin detalle de proyecto"}</p>
                      <div className="mt-3 grid gap-2 text-xs font-bold text-slate-400 md:grid-cols-3">
                        <span>1. Lead recibido</span>
                        <span className={normalize(row.status).includes("contactado") || row.referred_client_id ? "text-emerald-300" : ""}>2. Contacto telefonico</span>
                        <span className={row.referred_client_id ? "text-emerald-300" : ""}>3. Cliente creado</span>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
                      <Mini title="Proyecto" value={money(row.completed_project_amount)} />
                      <Mini title="Bono actual" value={money(row.reward_amount || row.bonus_amount)} />
                      <Mini title="Regla" value={bonusRuleLabel(n(row.completed_project_amount))} />
                      <button
                        onClick={() => markContacted(row)}
                        disabled={busyId === row.id || normalize(row.status).includes("contactado")}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-xs font-black uppercase text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyId === row.id ? <Loader2 className="animate-spin" size={16} /> : <PhoneCall size={16} />}
                        Contactado
                      </button>
                      <button
                        onClick={() => createReferredClient(row)}
                        disabled={busyId === row.id || Boolean(row.referred_client_id)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 py-3 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyId === row.id ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
                        Crear cliente
                      </button>
                      <button
                        onClick={() => completeReferral(row)}
                        disabled={busyId === row.id || row.bonus_status === "disponible"}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyId === row.id ? <Loader2 className="animate-spin" size={16} /> : <Gift size={16} />}
                        Liberar bono
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-[26px] border border-slate-800 bg-[#07111f] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-black">{value}</p>
        </div>
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">{icon}</div>
      </div>
    </div>
  );
}

function Mini({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#020617] p-4">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{title}</p>
      <p className="mt-2 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}
