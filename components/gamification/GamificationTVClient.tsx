"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  Brain,
  CalendarClock,
  Factory,
  Gift,
  Medal,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import {
  DEMO_POINTS,
  DEMO_RANKINGS,
  DEMO_REWARDS,
  GamificationPoint,
  GamificationRanking,
  GamificationReward,
  buildDepartmentRankings,
  buildGamificationAlerts,
  departmentLabel,
  getGamificationTotals,
  loadGamificationData,
  pointsForPeriod,
  rankCollaborators,
} from "@/lib/gamification";

const nf = new Intl.NumberFormat("es-DO");

function formatPoints(points: number) {
  return `${points > 0 ? "+" : ""}${nf.format(points)} pts`;
}

function clockLabel() {
  return new Date().toLocaleTimeString("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GamificationTVClient() {
  const [rankings, setRankings] = useState<GamificationRanking[]>(DEMO_RANKINGS);
  const [points, setPoints] = useState<GamificationPoint[]>(DEMO_POINTS);
  const [rewards, setRewards] = useState<GamificationReward[]>(DEMO_REWARDS);
  const [usingDemo, setUsingDemo] = useState(true);
  const [message, setMessage] = useState("Cargando TV operacional.");
  const [time, setTime] = useState(clockLabel());

  async function refresh() {
    const next = await loadGamificationData();
    setRankings(next.rankings);
    setPoints(next.points);
    setRewards(next.rewards);
    setUsingDemo(next.usingDemo);
    setMessage(next.sourceMessage);
    setTime(clockLabel());
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    const clock = window.setInterval(() => setTime(clockLabel()), 10000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, []);

  const topCollaborators = useMemo(() => rankCollaborators(rankings, "daily").slice(0, 6), [rankings]);
  const topDepartments = useMemo(() => buildDepartmentRankings(rankings, "daily").slice(0, 5), [rankings]);
  const totals = useMemo(() => getGamificationTotals(rankings, points), [rankings, points]);
  const alerts = useMemo(() => buildGamificationAlerts(rankings, points).slice(0, 3), [rankings, points]);
  const recentPoints = points
    .filter((point) => point.status === "approved")
    .slice()
    .sort((a, b) => new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime())
    .slice(0, 7);

  const leader = topCollaborators[0];

  return (
    <main className="min-h-screen overflow-hidden bg-[#020817] text-white">
      <section className="grid min-h-screen grid-rows-[auto_1fr] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.16),transparent_28%),linear-gradient(135deg,#020817_0%,#061526_48%,#111b3e_100%)] p-6 2xl:p-10">
        <header className="flex items-center justify-between gap-6 rounded-[32px] border border-cyan-300/20 bg-slate-950/55 px-8 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.36)]">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-cyan-400 to-blue-700 text-5xl font-black">
              R
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.42em] text-cyan-200">
                RD Wood System Live
              </p>
              <h1 className="mt-1 text-5xl font-black tracking-tight 2xl:text-7xl">
                Gamificacion Operacional
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="rounded-3xl border border-slate-700 bg-slate-950/80 px-6 py-4 text-right">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Hora planta</p>
              <p className="mt-1 text-4xl font-black text-cyan-100">{time}</p>
            </div>
            <div className="rounded-3xl border border-emerald-300/25 bg-emerald-500/10 px-6 py-4">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-200">Estado</p>
              <p className="mt-1 text-2xl font-black text-emerald-100">
                {usingDemo ? "Demo operativo" : "Supabase live"}
              </p>
            </div>
          </div>
        </header>

        <div className="mt-6 grid min-h-0 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="grid min-h-0 gap-6">
            <div className="grid gap-4 md:grid-cols-4">
              <TvMetric icon={<Users size={28} />} label="Colaboradores" value={nf.format(totals.collaborators)} />
              <TvMetric icon={<Zap size={28} />} label="Puntos hoy" value={formatPoints(totals.dailyPoints)} tone="cyan" />
              <TvMetric icon={<ShieldCheck size={28} />} label="Positivos" value={nf.format(totals.positiveEvents)} tone="emerald" />
              <TvMetric icon={<AlertTriangle size={28} />} label="Alertas" value={nf.format(totals.negativeEvents)} tone="amber" />
            </div>

            <div className="grid min-h-0 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[32px] border border-cyan-400/15 bg-slate-950/70 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.38em] text-cyan-300">
                      Top colaboradores
                    </p>
                    <h2 className="mt-1 text-4xl font-black">Ranking diario</h2>
                  </div>
                  <Trophy className="text-amber-300" size={46} />
                </div>

                <div className="mt-6 space-y-4">
                  {topCollaborators.map((row, index) => {
                    const score = pointsForPeriod(row, "daily");
                    const leaderScore = Math.max(1, pointsForPeriod(topCollaborators[0], "daily"));
                    const width = Math.max(8, Math.min(100, Math.round((Math.max(0, score) / leaderScore) * 100)));

                    return (
                      <article
                        key={row.collaborator_id}
                        className="grid items-center gap-5 rounded-[26px] border border-slate-800 bg-[#07111f] p-5 md:grid-cols-[90px_1fr_170px]"
                      >
                        <div className="flex h-20 w-20 items-center justify-center rounded-[24px] border border-cyan-300/25 bg-cyan-500/15 text-4xl font-black text-cyan-50">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-3xl font-black">{row.collaborator_name}</h3>
                          <p className="mt-1 text-lg font-bold text-slate-400">{departmentLabel(row.department)}</p>
                          <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-500 to-emerald-300"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                        <p className={`text-right text-4xl font-black ${score < 0 ? "text-rose-200" : "text-emerald-200"}`}>
                          {formatPoints(score)}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[32px] border border-cyan-400/15 bg-slate-950/70 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.38em] text-cyan-300">
                      Areas
                    </p>
                    <h2 className="mt-1 text-4xl font-black">Top departamentos</h2>
                  </div>
                  <Factory className="text-cyan-200" size={42} />
                </div>
                <div className="mt-6 space-y-4">
                  {topDepartments.map((row, index) => (
                    <div key={row.department} className="rounded-[24px] border border-slate-800 bg-[#07111f] p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-500">
                            #{index + 1}
                          </p>
                          <h3 className="text-3xl font-black">{departmentLabel(row.department)}</h3>
                        </div>
                        <p className="text-4xl font-black text-emerald-200">{formatPoints(row.points)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className="grid min-h-0 gap-6">
            <div className="rounded-[32px] border border-amber-300/20 bg-amber-400/10 p-6">
              <div className="flex items-center gap-4">
                <Brain className="text-amber-200" size={42} />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.38em] text-amber-200">Alertas IA</p>
                  <h2 className="text-4xl font-black">Radar operacional</h2>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                {alerts.map((alert) => (
                  <div key={alert} className="rounded-[24px] border border-amber-300/20 bg-slate-950/70 p-5 text-xl font-black text-amber-50">
                    {alert}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-cyan-400/15 bg-slate-950/70 p-6">
              <div className="flex items-center gap-4">
                <Target className="text-cyan-200" size={40} />
                <h2 className="text-4xl font-black">Metas del dia</h2>
              </div>
              <div className="mt-5 grid gap-4">
                <GoalRow label="Puntualidad operacional" progress={leader?.daily_points ? 92 : 68} />
                <GoalRow label="QR sin huecos de trazabilidad" progress={totals.negativeEvents ? 76 : 100} />
                <GoalRow label="Fotos/evidencias completas" progress={totals.positiveEvents > 2 ? 94 : 72} />
                <GoalRow label="Cero reprocesos criticos" progress={totals.negativeEvents ? 81 : 100} />
              </div>
            </div>

            <div className="grid min-h-0 gap-6 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="rounded-[32px] border border-slate-800 bg-slate-950/70 p-6">
                <div className="flex items-center gap-3">
                  <Medal className="text-emerald-200" size={34} />
                  <h2 className="text-3xl font-black">Puntos ganados</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {recentPoints.map((point) => (
                    <div key={point.id} className="rounded-2xl border border-slate-800 bg-[#07111f] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black">{point.collaborator_name}</p>
                          <p className="truncate text-sm font-bold text-slate-500">{point.rule_title}</p>
                        </div>
                        <p className={`text-2xl font-black ${point.points < 0 ? "text-rose-200" : "text-emerald-200"}`}>
                          {formatPoints(point.points)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-800 bg-slate-950/70 p-6">
                <div className="flex items-center gap-3">
                  <Gift className="text-amber-200" size={34} />
                  <h2 className="text-3xl font-black">Proximas recompensas</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {rewards.slice(0, 3).map((reward) => (
                    <div key={reward.id} className="rounded-2xl border border-amber-300/15 bg-amber-400/10 p-4">
                      <p className="text-lg font-black">{reward.title}</p>
                      <p className="mt-1 text-sm font-bold text-amber-100">{nf.format(reward.points_required)} puntos</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="pointer-events-none fixed bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full border border-cyan-400/20 bg-slate-950/85 px-5 py-3 text-sm font-black text-cyan-100">
          {message}
        </div>
      </section>
    </main>
  );
}

function TvMetric({
  icon,
  label,
  value,
  tone = "slate",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "slate" | "cyan" | "emerald" | "amber";
}) {
  const tones = {
    slate: "border-slate-700 bg-slate-950/70 text-slate-200",
    cyan: "border-cyan-300/25 bg-cyan-500/10 text-cyan-100",
    emerald: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-300/25 bg-amber-400/10 text-amber-100",
  };

  return (
    <article className={`rounded-[28px] border p-6 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-current/20 bg-white/5">
          {icon}
        </div>
        <Sparkles className="opacity-40" size={22} />
      </div>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.3em] opacity-70">{label}</p>
      <p className="mt-2 text-4xl font-black">{value}</p>
    </article>
  );
}

function GoalRow({ label, progress }: { label: string; progress: number }) {
  return (
    <div className="rounded-[24px] border border-slate-800 bg-[#07111f] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {progress >= 90 ? (
            <Award className="text-emerald-200" size={26} />
          ) : (
            <CalendarClock className="text-amber-200" size={26} />
          )}
          <p className="text-xl font-black">{label}</p>
        </div>
        <p className="text-2xl font-black text-cyan-100">{progress}%</p>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${progress >= 90 ? "bg-emerald-300" : "bg-amber-300"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
