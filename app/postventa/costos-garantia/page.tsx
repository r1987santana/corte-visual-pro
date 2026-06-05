// app/postventa/costos-garantia/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  Calculator,
  DollarSign,
  Package,
  Plus,
  RefreshCw,
  Search,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";

type CostDetail = {
  id: string;
  ticket_id: string | null;
  visit_id: string | null;
  cost_type: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  notes: string | null;
  created_at: string;
  ticket_code: string | null;
  issue_title: string | null;
  client_name: string | null;
  ticket_status: string | null;
  visit_status: string | null;
};

type TicketCost = {
  ticket_id: string;
  ticket_code: string | null;
  issue_title: string | null;
  client_name: string | null;
  ticket_status: string | null;
  total_warranty_cost: number;
  material_cost: number;
  labor_cost: number;
  transport_cost: number;
  other_cost: number;
  cost_lines: number;
};

type Kpis = {
  tickets_with_cost: number;
  total_warranty_cost: number;
  material_cost: number;
  labor_cost: number;
  transport_cost: number;
  avg_cost_line: number;
};

type TicketOption = {
  ticket_id: string;
  ticket_code: string | null;
  issue_title: string | null;
  client_name: string | null;
};

const emptyKpis: Kpis = {
  tickets_with_cost: 0,
  total_warranty_cost: 0,
  material_cost: 0,
  labor_cost: 0,
  transport_cost: 0,
  avg_cost_line: 0,
};

export default function WarrantyRealCostsPage() {
  const [loading, setLoading] = useState(true);
  const [costs, setCosts] = useState<CostDetail[]>([]);
  const [ticketCosts, setTicketCosts] = useState<TicketCost[]>([]);
  const [kpis, setKpis] = useState<Kpis>(emptyKpis);
  const [tickets, setTickets] = useState<TicketOption[]>([]);
  const [query, setQuery] = useState("");

  const [ticketId, setTicketId] = useState("");
  const [costType, setCostType] = useState("material");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [costRes, ticketCostRes, kpiRes, ticketRes] = await Promise.all([
      supabase
        .from("v_after_sales_warranty_costs_detail")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("v_after_sales_warranty_costs_by_ticket")
        .select("*")
        .order("total_warranty_cost", { ascending: false })
        .limit(50),
      supabase.from("v_after_sales_warranty_costs_kpis").select("*").maybeSingle(),
      supabase
        .from("v_after_sales_supervisor_tickets")
        .select("ticket_id,ticket_code,issue_title,client_name")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (costRes.data) setCosts(costRes.data as CostDetail[]);
    if (ticketCostRes.data) setTicketCosts(ticketCostRes.data as TicketCost[]);
    if (kpiRes.data) setKpis(kpiRes.data as Kpis);
    if (ticketRes.data) setTickets(ticketRes.data as TicketOption[]);

    setLoading(false);
  }

  const filteredCosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return costs;

    return costs.filter((c) =>
      [
        c.ticket_code,
        c.issue_title,
        c.client_name,
        c.item_name,
        c.cost_type,
        c.notes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [costs, query]);

  async function addCost() {
    if (!ticketId) {
      alert("Selecciona un ticket.");
      return;
    }

    if (!itemName.trim()) {
      alert("Escribe el nombre del costo o material.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc("register_warranty_cost", {
      p_ticket_id: ticketId,
      p_visit_id: null,
      p_cost_type: costType,
      p_item_name: itemName.trim(),
      p_quantity: Number(quantity || 1),
      p_unit_cost: Number(unitCost || 0),
      p_notes: notes || null,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setItemName("");
    setQuantity("1");
    setUnitCost("");
    setNotes("");
    await loadData();
    alert("Costo registrado correctamente.");
  }

  const estimatedLostMargin = Number(kpis.total_warranty_cost || 0);

  return (
    <div className="min-h-screen bg-[#020817] text-white p-6">
      <div className="max-w-[1500px] mx-auto space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-cyan-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-8 shadow-2xl">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute -bottom-28 left-20 h-72 w-72 rounded-full bg-cyan-600/20 blur-3xl" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-cyan-300 text-xs font-black tracking-[0.35em] uppercase">
                <Calculator className="w-4 h-4" />
                Fase 43.4.8 · Costos Reales
              </div>

              <h1 className="mt-6 text-4xl lg:text-6xl font-black tracking-tight">
                Costos Reales de Garantía PRO
              </h1>

              <p className="mt-4 max-w-3xl text-slate-300 text-lg">
                Control financiero de postventa: materiales, mano de obra,
                transporte y utilidad perdida por garantías.
              </p>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="rounded-2xl bg-white text-slate-950 px-7 py-4 font-black flex items-center justify-center gap-3 hover:bg-cyan-100 disabled:opacity-60"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
              ACTUALIZAR
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <Kpi icon={<DollarSign />} label="Costo total" value={money(kpis.total_warranty_cost)} tone="danger" />
          <Kpi icon={<Package />} label="Materiales" value={money(kpis.material_cost)} />
          <Kpi icon={<UserRound />} label="Mano obra" value={money(kpis.labor_cost)} />
          <Kpi icon={<Truck />} label="Transporte" value={money(kpis.transport_cost)} />
          <Kpi icon={<AlertTriangle />} label="Utilidad perdida" value={money(estimatedLostMargin)} tone="warning" />
          <Kpi icon={<Wrench />} label="Tickets con costo" value={kpis.tickets_with_cost || 0} />
        </section>

        <section className="grid xl:grid-cols-[0.9fr_1.2fr] gap-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-2xl font-black mb-2">Registrar costo de garantía</h2>
            <p className="text-slate-400 mb-5">
              Agrega materiales, mano de obra, transporte u otros costos al ticket.
            </p>

            <div className="space-y-4">
              <select
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 outline-none focus:border-cyan-400"
              >
                <option value="">Seleccionar ticket</option>
                {tickets.map((t) => (
                  <option key={t.ticket_id} value={t.ticket_id}>
                    {t.ticket_code || "SAT"} · {t.issue_title || "Incidencia"} · {t.client_name || "Cliente"}
                  </option>
                ))}
              </select>

              <select
                value={costType}
                onChange={(e) => setCostType(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 outline-none focus:border-cyan-400"
              >
                <option value="material">Material</option>
                <option value="mano_obra">Mano de obra</option>
                <option value="transporte">Transporte</option>
                <option value="herramienta">Herramienta</option>
                <option value="otro">Otro</option>
              </select>

              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Ej: Bisagra DTC soft close, hora técnico, combustible..."
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 outline-none focus:border-cyan-400"
              />

              <div className="grid grid-cols-2 gap-4">
                <input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  type="number"
                  placeholder="Cantidad"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 outline-none focus:border-cyan-400"
                />

                <input
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  type="number"
                  placeholder="Costo unitario RD$"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 outline-none focus:border-cyan-400"
                />
              </div>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas internas del costo..."
                className="w-full h-24 rounded-2xl border border-slate-700 bg-slate-950 p-4 outline-none focus:border-cyan-400"
              />

              <button
                onClick={addCost}
                disabled={saving}
                className="w-full rounded-2xl bg-cyan-400 text-slate-950 p-4 font-black flex items-center justify-center gap-2 hover:bg-cyan-300 disabled:opacity-60"
              >
                <Plus className="w-5 h-5" />
                REGISTRAR COSTO
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
              <div>
                <h2 className="text-2xl font-black">Costos registrados</h2>
                <p className="text-slate-400">Detalle financiero por ticket y tipo de costo.</p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar costo..."
                  className="w-full md:w-80 rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-11 pr-4 outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-[0.25em] text-[10px]">
                  <tr>
                    <th className="text-left p-4">Ticket</th>
                    <th className="text-left p-4">Tipo</th>
                    <th className="text-left p-4">Item</th>
                    <th className="text-left p-4">Cant.</th>
                    <th className="text-left p-4">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCosts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No hay costos registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredCosts.map((cost) => (
                      <tr key={cost.id} className="border-t border-slate-800 hover:bg-cyan-400/5">
                        <td className="p-4 font-bold">{cost.ticket_code || "SAT"}</td>
                        <td className="p-4">
                          <CostTypePill value={cost.cost_type} />
                        </td>
                        <td className="p-4 text-slate-300">{cost.item_name}</td>
                        <td className="p-4 text-slate-300">{format(cost.quantity)}</td>
                        <td className="p-4 font-black text-emerald-300">{money(cost.total_cost)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-2xl font-black mb-5">Costo acumulado por ticket</h2>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ticketCosts.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                No hay tickets con costos registrados.
              </div>
            ) : (
              ticketCosts.map((ticket) => (
                <div key={ticket.ticket_id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xl font-black">{ticket.ticket_code || "SAT"}</div>
                      <div className="text-sm text-slate-400">{ticket.client_name}</div>
                      <div className="text-sm text-slate-300 mt-1">{ticket.issue_title}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-300 text-xl font-black">
                        {money(ticket.total_warranty_cost)}
                      </div>
                      <div className="text-xs text-slate-500">{ticket.cost_lines} líneas</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
                    <MiniStat label="Material" value={money(ticket.material_cost)} />
                    <MiniStat label="Mano obra" value={money(ticket.labor_cost)} />
                    <MiniStat label="Transporte" value={money(ticket.transport_cost)} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "default" | "warning" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "border-red-400/30 text-red-300"
      : tone === "warning"
      ? "border-amber-400/30 text-amber-300"
      : "border-cyan-400/20 text-cyan-300";

  return (
    <div className={`rounded-3xl border bg-slate-900/70 p-5 ${cls}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-black">{label}</div>
        <div className="w-5 h-5">{icon}</div>
      </div>
      <div className="mt-4 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function CostTypePill({ value }: { value: string }) {
  const label =
    value === "mano_obra"
      ? "Mano obra"
      : value === "material"
      ? "Material"
      : value === "transporte"
      ? "Transporte"
      : value;

  return (
    <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">
      {label}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <div className="font-black text-white">{value}</div>
      <div className="text-slate-500">{label}</div>
    </div>
  );
}

function money(value: number | string | null | undefined) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function format(value: number | string | null | undefined) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(2).replace(".00", "");
}
