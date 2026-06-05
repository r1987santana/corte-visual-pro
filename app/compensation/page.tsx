"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  TrendingUp,
  Users,
  Award,
  Calculator,
  BarChart3,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Dashboard = {
  employees: number;
  monthly_payroll: number;
  annual_payroll: number;
  annual_bonus: number;
  below_band: number;
  above_band: number;
  avg_compa_ratio: number;
};

type CompensationRow = {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department: string;
  position: string;
  current_salary: number;
  min_salary: number | null;
  mid_salary: number | null;
  max_salary: number | null;
  salary_status: string;
  compa_ratio: number;
  annual_bonus: number;
};

const currency = (n: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(n || 0);

const percent = (n: number) => `${Number(n || 0).toFixed(2)}%`;

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: any;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        </div>
        <div className="rounded-xl bg-blue-600/20 p-3">
          <Icon className="h-6 w-6 text-blue-400" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "EN RANGO": "bg-green-500/20 text-green-400",
    "POR DEBAJO": "bg-yellow-500/20 text-yellow-400",
    "POR ENCIMA": "bg-red-500/20 text-red-400",
    "SIN BANDA": "bg-slate-500/20 text-slate-400",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        map[status] || "bg-slate-500/20 text-slate-300"
      }`}
    >
      {status}
    </span>
  );
}

export default function CompensationPage() {
  const [dashboard, setDashboard] = useState<Dashboard>({
    employees: 0,
    monthly_payroll: 0,
    annual_payroll: 0,
    annual_bonus: 0,
    below_band: 0,
    above_band: 0,
    avg_compa_ratio: 0,
  });

  const [rows, setRows] = useState<CompensationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = async () => {
    setLoading(true);

    const { data: dashData } = await supabase
      .from("v_hr_compensation_dashboard")
      .select("*")
      .single();

    const { data: compensationData } = await supabase
      .from("v_hr_compensation")
      .select("*")
      .order("employee_name");

    if (dashData) setDashboard(dashData);
    if (compensationData) setRows(compensationData);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRows = useMemo(() => {
    if (!search) return rows;

    const q = search.toLowerCase();

    return rows.filter(
      (r) =>
        r.employee_name?.toLowerCase().includes(q) ||
        r.employee_code?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) ||
        r.position?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="min-h-screen bg-[#020617] p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 to-blue-950 p-8 shadow-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-blue-400">
                RD WOOD SYSTEM
              </p>
              <h1 className="mt-3 text-5xl font-black">
                Compensation & Payroll Pro
              </h1>
              <p className="mt-2 text-slate-300">
                Fase 15: bandas salariales, compa ratio, nómina y simulaciones.
              </p>
            </div>

            <button
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700"
            >
              <RefreshCw className="h-5 w-5" />
              Actualizar
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Empleados"
            value={dashboard.employees}
            icon={Users}
          />
          <StatCard
            title="Nómina Mensual"
            value={currency(dashboard.monthly_payroll)}
            icon={DollarSign}
          />
          <StatCard
            title="Nómina Anual"
            value={currency(dashboard.annual_payroll)}
            icon={TrendingUp}
          />
          <StatCard
            title="Bonos Anuales"
            value={currency(dashboard.annual_bonus)}
            icon={Award}
          />
          <StatCard
            title="Por Debajo"
            value={dashboard.below_band}
            icon={AlertTriangle}
          />
          <StatCard
            title="Por Encima"
            value={dashboard.above_band}
            icon={BarChart3}
          />
          <StatCard
            title="Compa Ratio Prom."
            value={percent(dashboard.avg_compa_ratio)}
            icon={Calculator}
          />
        </div>

        {/* Search */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <input
            type="text"
            placeholder="Buscar empleado, código, departamento o posición..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-950">
                <tr className="text-left text-slate-400">
                  <th className="px-4 py-3">Empleado</th>
                  <th className="px-4 py-3">Departamento</th>
                  <th className="px-4 py-3">Posición</th>
                  <th className="px-4 py-3">Salario</th>
                  <th className="px-4 py-3">Banda Mid</th>
                  <th className="px-4 py-3">Compa Ratio</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Bonos</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      Cargando...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      No hay datos.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.employee_id}
                      className="border-t border-slate-800 hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">
                          {row.employee_name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {row.employee_code}
                        </div>
                      </td>
                      <td className="px-4 py-3">{row.department}</td>
                      <td className="px-4 py-3">{row.position}</td>
                      <td className="px-4 py-3">
                        {currency(row.current_salary)}
                      </td>
                      <td className="px-4 py-3">
                        {currency(row.mid_salary || 0)}
                      </td>
                      <td className="px-4 py-3">
                        {percent(row.compa_ratio)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.salary_status} />
                      </td>
                      <td className="px-4 py-3">
                        {currency(row.annual_bonus)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}