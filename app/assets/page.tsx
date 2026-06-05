"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Cpu,
  DollarSign,
  Laptop,
  PackageCheck,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Ticket,
  ToolCase,
  UserCheck,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Tab = "dashboard" | "activos" | "asignaciones" | "mantenimiento" | "depreciacion" | "categorias";

type Dashboard = {
  total_assets: number;
  active_assets: number;
  assigned_assets: number;
  maintenance_assets: number;
  damaged_assets: number;
  overdue_maintenance: number;
  total_purchase_value: number;
  total_current_value: number;
  open_maintenance: number;
};

type Asset = {
  id: string;
  asset_code: string;
  name: string;
  category_code: string | null;
  category_name: string | null;
  asset_type: string | null;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  purchase_cost: number;
  current_value: number;
  location: string | null;
  department: string | null;
  condition_status: string;
  operational_status: string;
  assigned_employee_id: string | null;
  employee_code: string | null;
  assigned_employee_name: string | null;
  next_maintenance_date: string | null;
  warranty_expiration: string | null;
  qr_code: string | null;
  notes: string | null;
  maintenance_status: string;
  maintenance_count: number;
  documents_count: number;
};

type Assignment = {
  id: string;
  asset_code: string;
  asset_name: string;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  position: string | null;
  assigned_at: string;
  returned_at: string | null;
  status: string;
  assignment_notes: string | null;
};

type Maintenance = {
  id: string;
  maintenance_code: string;
  asset_code: string;
  asset_name: string;
  location: string | null;
  department: string | null;
  category_name: string | null;
  maintenance_type: string;
  scheduled_date: string | null;
  performed_date: string | null;
  performed_by: string | null;
  cost: number;
  status: string;
  description: string | null;
  findings: string | null;
  next_maintenance_date: string | null;
  schedule_status: string;
};

type Depreciation = {
  id: string;
  asset_code: string;
  asset_name: string;
  period_month: string;
  opening_value: number;
  depreciation_amount: number;
  closing_value: number;
  purchase_cost: number;
  current_value: number;
};

type Category = {
  id: string;
  code: string;
  name: string;
  asset_type: string;
  depreciation_months: number;
  maintenance_required: boolean;
  default_maintenance_days: number;
  description: string | null;
  is_active: boolean;
};

type Employee = {
  id: string;
  employee_code: string | null;
  full_name: string;
  department: string | null;
  position: string | null;
};

const money = (n: number | null | undefined) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number(n || 0));

function statusClass(value?: string | null) {
  if (["activo", "asignado", "bueno", "nuevo", "completado", "en_tiempo"].includes(value || "")) return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
  if (["almacenado", "programado", "proximo", "regular"].includes(value || "")) return "border-amber-400/30 bg-amber-500/15 text-amber-300";
  if (["mantenimiento", "en_proceso"].includes(value || "")) return "border-blue-400/30 bg-blue-500/15 text-blue-300";
  if (["dañado", "fuera_servicio", "retirado", "vencido"].includes(value || "")) return "border-red-400/30 bg-red-500/15 text-red-300";
  return "border-slate-500/30 bg-slate-500/15 text-slate-300";
}

export default function AssetManagementPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard>({
    total_assets: 0,
    active_assets: 0,
    assigned_assets: 0,
    maintenance_assets: 0,
    damaged_assets: 0,
    overdue_maintenance: 0,
    total_purchase_value: 0,
    total_current_value: 0,
    open_maintenance: 0,
  });

  const [assets, setAssets] = useState<Asset[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [depreciation, setDepreciation] = useState<Depreciation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      const [dashRes, assetsRes, assRes, mntRes, depRes, catRes, empRes] = await Promise.all([
        supabase.from("v_assets_dashboard").select("*").maybeSingle(),
        supabase.from("v_assets_detail").select("*").order("asset_code"),
        supabase.from("v_asset_assignments_detail").select("*").order("assigned_at", { ascending: false }),
        supabase.from("v_asset_maintenance_detail").select("*").order("scheduled_date"),
        supabase.from("v_asset_depreciation_detail").select("*").order("period_month", { ascending: false }),
        supabase.from("asset_categories").select("*").order("name"),
        supabase.from("employees").select("id, employee_code, full_name, department, position").order("full_name"),
      ]);

      if (dashRes.error) throw dashRes.error;
      if (assetsRes.error) throw assetsRes.error;
      if (assRes.error) throw assRes.error;
      if (mntRes.error) throw mntRes.error;
      if (depRes.error) throw depRes.error;
      if (catRes.error) throw catRes.error;
      if (empRes.error) throw empRes.error;

      if (dashRes.data) setDashboard(dashRes.data as Dashboard);
      setAssets((assetsRes.data || []) as Asset[]);
      setAssignments((assRes.data || []) as Assignment[]);
      setMaintenance((mntRes.data || []) as Maintenance[]);
      setDepreciation((depRes.data || []) as Depreciation[]);
      setCategories((catRes.data || []) as Category[]);
      setEmployees((empRes.data || []) as Employee[]);
    } catch (error: any) {
      setMessage(error.message || "Error cargando activos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) =>
      [
        a.asset_code,
        a.name,
        a.category_name,
        a.brand,
        a.model,
        a.location,
        a.department,
        a.assigned_employee_name,
        a.operational_status,
        a.condition_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [assets, search]);

  async function assignAsset(asset: Asset) {
    try {
      const emp = employees.find((e) => e.department === asset.department) || employees[0];
      if (!emp) {
        setMessage("No hay empleados disponibles para asignar.");
        return;
      }

      setLoading(true);
      const { error } = await supabase.rpc("asset_assign", {
        p_asset_id: asset.id,
        p_employee_id: emp.id,
        p_notes: "Asignación rápida desde Asset Management Pro.",
      });
      if (error) throw error;
      setMessage(`Activo asignado a ${emp.full_name}.`);
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo asignar activo.");
    } finally {
      setLoading(false);
    }
  }

  async function scheduleMaintenance(asset: Asset) {
    try {
      setLoading(true);
      const d = new Date();
      d.setDate(d.getDate() + 30);

      const { error } = await supabase.rpc("asset_schedule_maintenance", {
        p_asset_id: asset.id,
        p_scheduled_date: d.toISOString().slice(0, 10),
        p_description: `Mantenimiento preventivo programado para ${asset.asset_code}.`,
      });
      if (error) throw error;
      setMessage("Mantenimiento programado.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo programar mantenimiento.");
    } finally {
      setLoading(false);
    }
  }

  async function createHelpdesk(asset: Asset) {
    try {
      setLoading(true);
      const { error } = await supabase.rpc("asset_create_helpdesk_ticket", {
        p_asset_id: asset.id,
        p_description: `Revisión solicitada para activo ${asset.asset_code} - ${asset.name}.`,
      });
      if (error) throw error;
      setMessage("Ticket Help Desk creado desde activo.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo crear ticket.");
    } finally {
      setLoading(false);
    }
  }

  async function generateDepreciation() {
    try {
      setLoading(true);
      const { error } = await supabase.rpc("asset_generate_monthly_depreciation");
      if (error) throw error;
      setMessage("Depreciación mensual generada.");
      await loadData();
    } catch (error: any) {
      setMessage(error.message || "No se pudo generar depreciación.");
    } finally {
      setLoading(false);
    }
  }

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "activos", label: "Activos", icon: PackageCheck },
    { id: "asignaciones", label: "Asignaciones", icon: UserCheck },
    { id: "mantenimiento", label: "Mantenimiento", icon: Wrench },
    { id: "depreciacion", label: "Depreciación", icon: DollarSign },
    { id: "categorias", label: "Categorías", icon: Settings },
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">RD Wood System</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-5xl">
                Asset Management Pro
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Fase 27: activos, computadoras, herramientas, CNC, asignaciones, mantenimiento y depreciación.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={generateDepreciation}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-500"
              >
                <DollarSign size={18} />
                Depreciación
              </button>
              <button
                onClick={loadData}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-500"
              >
                <RefreshCw size={18} />
                Actualizar
              </button>
            </div>
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

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-9">
          <Kpi title="Activos" value={dashboard.total_assets} icon={<PackageCheck size={20} />} />
          <Kpi title="Activos OK" value={dashboard.active_assets} icon={<CheckCircle2 size={20} />} />
          <Kpi title="Asignados" value={dashboard.assigned_assets} icon={<UserCheck size={20} />} />
          <Kpi title="Mant." value={dashboard.maintenance_assets} icon={<Wrench size={20} />} />
          <Kpi title="Dañados" value={dashboard.damaged_assets} icon={<ShieldAlert size={20} />} />
          <Kpi title="Mant. vencido" value={dashboard.overdue_maintenance} icon={<AlertTriangle size={20} />} />
          <Kpi title="Compra" value={money(dashboard.total_purchase_value)} icon={<DollarSign size={20} />} />
          <Kpi title="Valor actual" value={money(dashboard.total_current_value)} icon={<BarChart3 size={20} />} />
          <Kpi title="Mant. abiertos" value={dashboard.open_maintenance} icon={<CalendarClock size={20} />} />
        </section>

        <section className="mb-6 flex gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-white/5 p-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id as Tab)}
                className={`flex min-w-max items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${
                  active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </section>

        {(tab === "dashboard" || tab === "activos") && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar activo, categoría, empleado, ubicación..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>
        )}

        {tab === "dashboard" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="Activos principales" icon={<PackageCheck size={20} />}>
              <div className="space-y-3">
                {filteredAssets.slice(0, 8).map((a) => (
                  <AssetCard key={a.id} item={a} onAssign={assignAsset} onMaintenance={scheduleMaintenance} onTicket={createHelpdesk} />
                ))}
              </div>
            </Panel>

            <Panel title="Mantenimientos próximos" icon={<Wrench size={20} />}>
              <div className="space-y-3">
                {maintenance.slice(0, 8).map((m) => <MaintenanceCard key={m.id} item={m} />)}
                {!maintenance.length && <p className="text-sm text-slate-400">No hay mantenimientos.</p>}
              </div>
            </Panel>
          </section>
        )}

        {tab === "activos" && (
          <Panel title="Inventario de activos" icon={<PackageCheck size={20} />}>
            <div className="space-y-3">
              {filteredAssets.map((a) => (
                <AssetCard key={a.id} item={a} onAssign={assignAsset} onMaintenance={scheduleMaintenance} onTicket={createHelpdesk} />
              ))}
            </div>
          </Panel>
        )}

        {tab === "asignaciones" && (
          <Panel title="Historial de asignaciones" icon={<UserCheck size={20} />}>
            <div className="space-y-3">
              {assignments.map((a) => (
                <div key={a.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{a.asset_code} · {a.asset_name}</p>
                      <p className="text-xs text-slate-400">{a.employee_code} · {a.employee_name} · {a.department}</p>
                      <p className="mt-2 text-sm text-slate-300">{a.assignment_notes}</p>
                      <p className="mt-1 text-xs text-slate-500">Asignado: {new Date(a.assigned_at).toLocaleString("es-DO")}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(a.status)}`}>{a.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === "mantenimiento" && (
          <Panel title="Mantenimiento de activos" icon={<Wrench size={20} />}>
            <div className="space-y-3">
              {maintenance.map((m) => <MaintenanceCard key={m.id} item={m} />)}
            </div>
          </Panel>
        )}

        {tab === "depreciacion" && (
          <Panel title="Depreciación mensual" icon={<DollarSign size={20} />}>
            <div className="space-y-3">
              {depreciation.map((d) => (
                <div key={d.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{d.asset_code} · {d.asset_name}</p>
                      <p className="text-xs text-slate-400">Periodo {d.period_month}</p>
                      <p className="mt-2 text-sm text-slate-300">Inicial {money(d.opening_value)} · Depreciación {money(d.depreciation_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Valor cierre</p>
                      <p className="text-2xl font-black text-emerald-300">{money(d.closing_value)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === "categorias" && (
          <Panel title="Categorías de activos" icon={<Settings size={20} />}>
            <div className="grid gap-3 lg:grid-cols-2">
              {categories.map((c) => (
                <div key={c.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-black">{c.code} · {c.name}</p>
                      <p className="text-xs text-slate-400">{c.asset_type} · depreciación {c.depreciation_months} meses</p>
                      <p className="mt-2 text-sm text-slate-300">{c.description}</p>
                      <p className="mt-1 text-xs text-slate-500">Mantenimiento: {c.maintenance_required ? `cada ${c.default_maintenance_days} días` : "no requerido"}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${c.is_active ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300" : "border-red-400/30 bg-red-500/15 text-red-300"}`}>
                      {c.is_active ? "activo" : "inactivo"}
                    </span>
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

function AssetCard({
  item,
  onAssign,
  onMaintenance,
  onTicket,
}: {
  item: Asset;
  onAssign: (a: Asset) => void;
  onMaintenance: (a: Asset) => void;
  onTicket: (a: Asset) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-black">{item.asset_code} · {item.name}</p>
          <p className="text-xs text-slate-400">
            {item.category_name || "Sin categoría"} · {item.brand || ""} {item.model || ""} · {item.location || ""}
          </p>
          <p className="mt-2 text-sm text-slate-300">{item.notes}</p>
          <p className="mt-1 text-xs text-slate-500">
            Responsable: {item.employee_code || "N/A"} · {item.assigned_employee_name || "Sin asignar"} · QR {item.qr_code || "N/A"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.operational_status)}`}>
              {item.operational_status}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.condition_status)}`}>
              {item.condition_status}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.maintenance_status)}`}>
              {item.maintenance_status}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          <p className="text-xs text-slate-400">Valor actual</p>
          <p className="text-2xl font-black text-emerald-300">{money(item.current_value)}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={() => onAssign(item)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500">
              Asignar
            </button>
            <button onClick={() => onMaintenance(item)} className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white hover:bg-amber-500">
              Mant.
            </button>
            <button onClick={() => onTicket(item)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-500">
              Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MaintenanceCard({ item }: { item: Maintenance }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-black">{item.maintenance_code} · {item.asset_code}</p>
          <p className="text-xs text-slate-400">{item.asset_name} · {item.department} · {item.location}</p>
          <p className="mt-2 text-sm text-slate-300">{item.description}</p>
          <p className="mt-1 text-xs text-slate-500">
            Programado: {item.scheduled_date || "N/A"} · Responsable: {item.performed_by || "N/A"}
          </p>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.schedule_status)}`}>
            {item.schedule_status}
          </span>
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>
            {item.status}
          </span>
          <p className="text-sm font-black text-emerald-300">{money(item.cost)}</p>
        </div>
      </div>
    </div>
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
