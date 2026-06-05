"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  Users,
  Activity,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type AIScore = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  full_name: string;
  department: string | null;
  position: string | null;
  status: string | null;
  analysis_date: string;
  resignation_risk: number | null;
  absenteeism_risk: number | null;
  productivity_score: number | null;
  global_score: number | null;
  risk_level: string | null;
  recommendation: string | null;
};

type AIAlert = {
  id: string;
  employee_id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  created_at: string;
};

export default function RRHHAIPredictivaPage() {
  const [scores, setScores] = useState<AIScore[]>([]);
  const [alerts, setAlerts] = useState<AIAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    const total = scores.length;
    const high = scores.filter((s) => s.risk_level === "alto").length;
    const medium = scores.filter((s) => s.risk_level === "medio").length;
    const low = scores.filter((s) => s.risk_level === "bajo").length;
    const avgGlobal =
      total > 0
        ? scores.reduce((a, s) => a + Number(s.global_score || 0), 0) / total
        : 0;

    return { total, high, medium, low, avgGlobal };
  }, [scores]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scores;

    return scores.filter((s) =>
      [
        s.employee_code,
        s.full_name,
        s.department,
        s.position,
        s.risk_level,
        s.recommendation,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [scores, search]);

  async function loadAll() {
    try {
      setLoading(true);
      setMessage("");

      const [scoresRes, alertsRes] = await Promise.all([
        supabase
          .from("v_employee_ai_scores_detail")
          .select("*")
          .order("resignation_risk", { ascending: false }),
        supabase
          .from("employee_ai_alerts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (scoresRes.error) throw scoresRes.error;
      if (alertsRes.error) throw alertsRes.error;

      setScores((scoresRes.data || []) as AIScore[]);
      setAlerts((alertsRes.data || []) as AIAlert[]);
    } catch (error: any) {
      setMessage(error.message || "Error cargando IA predictiva.");
    } finally {
      setLoading(false);
    }
  }

  async function calculateAI() {
    try {
      setLoading(true);
      setMessage("");

      const { data, error } = await supabase.rpc("calculate_employee_ai_scores");

      if (error) throw error;

      setMessage(`IA calculada correctamente para ${data || 0} empleados.`);
      await loadAll();
    } catch (error: any) {
      setMessage(error.message || "Error calculando IA.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">
                RD Wood System
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight lg:text-5xl">
                IA Predictiva de RRHH
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Fase 11: riesgo de renuncia, ausentismo, productividad,
                alertas y recomendaciones inteligentes.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadAll}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 hover:bg-blue-100"
              >
                <RefreshCw size={18} />
                Actualizar
              </button>

              <button
                onClick={calculateAI}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500"
              >
                <Brain size={18} />
                Calcular IA
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

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi title="Empleados" value={stats.total} icon={<Users size={20} />} />
          <Kpi title="Riesgo alto" value={stats.high} icon={<AlertTriangle size={20} />} />
          <Kpi title="Riesgo medio" value={stats.medium} icon={<Activity size={20} />} />
          <Kpi title="Riesgo bajo" value={stats.low} icon={<ShieldCheck size={20} />} />
          <Kpi
            title="Score global"
            value={stats.avgGlobal.toFixed(1)}
            icon={<TrendingUp size={20} />}
          />
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2">
              <Search size={18} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar empleado, departamento o riesgo..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-3">Empleado</th>
                    <th className="px-3 py-3">Departamento</th>
                    <th className="px-3 py-3">Renuncia</th>
                    <th className="px-3 py-3">Ausentismo</th>
                    <th className="px-3 py-3">Productividad</th>
                    <th className="px-3 py-3">Global</th>
                    <th className="px-3 py-3">Nivel</th>
                    <th className="px-3 py-3">Recomendación</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-t border-white/10">
                      <td className="px-3 py-3">
                        <p className="font-black">{s.employee_code}</p>
                        <p className="text-xs text-slate-400">{s.full_name}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p>{s.department || "-"}</p>
                        <p className="text-xs text-slate-400">{s.position || "-"}</p>
                      </td>
                      <td className="px-3 py-3 font-bold text-red-300">
                        {Number(s.resignation_risk || 0).toFixed(1)}
                      </td>
                      <td className="px-3 py-3 font-bold text-amber-300">
                        {Number(s.absenteeism_risk || 0).toFixed(1)}
                      </td>
                      <td className="px-3 py-3 font-bold text-blue-300">
                        {Number(s.productivity_score || 0).toFixed(1)}
                      </td>
                      <td className="px-3 py-3 font-black text-emerald-300">
                        {Number(s.global_score || 0).toFixed(1)}
                      </td>
                      <td className="px-3 py-3">
                        <RiskBadge level={s.risk_level || "bajo"} />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        {s.recommendation || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!filtered.length && (
                <p className="py-6 text-sm text-slate-400">
                  No hay resultados. Presiona “Calcular IA”.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/20 text-red-200">
                <AlertTriangle size={20} />
              </div>
              <h2 className="text-lg font-black">Alertas IA</h2>
            </div>

            <div className="space-y-3">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl border border-white/10 bg-slate-900 p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="font-black">{a.title}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        a.severity === "alta"
                          ? "bg-red-500/15 text-red-300"
                          : a.severity === "media"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-blue-500/15 text-blue-300"
                      }`}
                    >
                      {a.severity}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{a.message}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {new Date(a.created_at).toLocaleString("es-DO")}
                  </p>
                </div>
              ))}

              {!alerts.length && (
                <p className="text-sm text-slate-400">No hay alertas activas.</p>
              )}
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
}: {
  title: string;
  value: any;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
        {icon}
      </div>
      <p className="text-xs uppercase tracking-widest text-slate-400">
        {title}
      </p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const cls =
    level === "alto"
      ? "bg-red-500/15 text-red-300"
      : level === "medio"
      ? "bg-amber-500/15 text-amber-300"
      : "bg-emerald-500/15 text-emerald-300";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>
      {level.toUpperCase()}
    </span>
  );
}