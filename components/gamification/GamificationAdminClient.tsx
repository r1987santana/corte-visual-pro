"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  BadgeCheck,
  Brain,
  Camera,
  Clock,
  ClipboardCheck,
  Database,
  Eye,
  Factory,
  Gift,
  History,
  Medal,
  Plus,
  RefreshCcw,
  Save,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Tv,
  Users,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  DEMO_POINTS,
  DEMO_RANKINGS,
  DEMO_REDEMPTIONS,
  DEMO_REWARDS,
  DEMO_RULES,
  GAMIFICATION_CAPTURE_CHANNELS,
  GAMIFICATION_DEPARTMENTS,
  GAMIFICATION_PERIODS,
  GamificationPeriod,
  GamificationPoint,
  GamificationPointType,
  GamificationRanking,
  GamificationRedemption,
  GamificationReward,
  GamificationRule,
  GamificationRuleCategory,
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

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-DO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function uniqueCode(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 42);
}

function metricTone(points: number) {
  if (points < 0) return "text-rose-200 bg-rose-500/10 border-rose-400/25";
  if (points >= 40) return "text-emerald-200 bg-emerald-500/10 border-emerald-400/25";
  return "text-cyan-100 bg-cyan-500/10 border-cyan-400/20";
}

type RuleFormState = {
  title: string;
  points: string;
  category: GamificationRuleCategory;
  department: string;
  sourceModule: string;
  eventType: string;
  requiresApproval: boolean;
};

type OperationalCaptureState = {
  collaboratorId: string;
  ruleCode: string;
  sourceModule: string;
  referenceCode: string;
  evidenceUrl: string;
  notes: string;
};

export default function GamificationAdminClient() {
  const [rankings, setRankings] = useState<GamificationRanking[]>(DEMO_RANKINGS);
  const [rules, setRules] = useState<GamificationRule[]>(DEMO_RULES);
  const [points, setPoints] = useState<GamificationPoint[]>(DEMO_POINTS);
  const [rewards, setRewards] = useState<GamificationReward[]>(DEMO_REWARDS);
  const [redemptions, setRedemptions] = useState<GamificationRedemption[]>(DEMO_REDEMPTIONS);
  const [period, setPeriod] = useState<GamificationPeriod>("monthly");
  const [department, setDepartment] = useState("Todos");
  const [loading, setLoading] = useState(false);
  const [usingDemo, setUsingDemo] = useState(true);
  const [message, setMessage] = useState("Cargando modulo de gamificacion operacional.");

  const [manualCollaboratorId, setManualCollaboratorId] = useState(DEMO_RANKINGS[0]?.collaborator_id || "");
  const [manualPoints, setManualPoints] = useState("10");
  const [manualType, setManualType] = useState<GamificationPointType>("positivo");
  const [manualReason, setManualReason] = useState("Ajuste supervisor");
  const [captureForm, setCaptureForm] = useState<OperationalCaptureState>({
    collaboratorId: DEMO_RANKINGS[0]?.collaborator_id || "",
    ruleCode: "qr_correcto",
    sourceModule: "qr_tracking",
    referenceCode: "OP / QR / MODULO",
    evidenceUrl: "",
    notes: "Captura operacional desde el piso.",
  });

  const [ruleForm, setRuleForm] = useState<RuleFormState>({
    title: "Validacion extra de seguridad",
    points: "15",
    category: "positivo",
    department: "Produccion",
    sourceModule: "manual",
    eventType: "manual_supervisor",
    requiresApproval: true,
  });

  async function refreshData() {
    setLoading(true);
    const next = await loadGamificationData();
    setRankings(next.rankings);
    setRules(next.rules);
    setPoints(next.points);
    setRewards(next.rewards);
    setRedemptions(next.redemptions);
    setUsingDemo(next.usingDemo);
    setMessage(next.sourceMessage);
    setManualCollaboratorId((current) => current || next.rankings[0]?.collaborator_id || "");
    setCaptureForm((current) => ({
      ...current,
      collaboratorId: current.collaboratorId || next.rankings[0]?.collaborator_id || "",
      ruleCode: current.ruleCode || next.rules[0]?.code || "",
    }));
    setLoading(false);
  }

  useEffect(() => {
    void refreshData();
  }, []);

  const departments = useMemo(() => {
    const values = new Set(["Todos", ...GAMIFICATION_DEPARTMENTS, ...rankings.map((row) => row.department)]);
    return Array.from(values);
  }, [rankings]);

  const collaboratorRanking = useMemo(
    () => rankCollaborators(rankings, period, department),
    [department, period, rankings]
  );

  const departmentRanking = useMemo(
    () => buildDepartmentRankings(rankings, period),
    [period, rankings]
  );

  const totals = useMemo(() => getGamificationTotals(rankings, points), [rankings, points]);
  const alerts = useMemo(() => buildGamificationAlerts(rankings, points), [rankings, points]);

  const positiveRules = rules.filter((rule) => rule.category === "positivo");
  const negativeRules = rules.filter((rule) => rule.category === "negativo");
  const pendingRedemptions = redemptions.filter((redemption) => redemption.status === "pending");
  const captureRules = rules.filter(
    (rule) =>
      rule.is_active &&
      (rule.source_module === captureForm.sourceModule ||
        captureForm.sourceModule === "manual" ||
        rule.source_module === "manual" ||
        rule.source_module === "ceo" ||
        rule.source_module === "evidencias")
  );
  const selectedCaptureChannel =
    GAMIFICATION_CAPTURE_CHANNELS.find((channel) => channel.key === captureForm.sourceModule) ||
    GAMIFICATION_CAPTURE_CHANNELS[0];

  function patchRanking(collaboratorId: string, delta: number) {
    setRankings((current) =>
      current.map((row) => {
        if (row.collaborator_id !== collaboratorId) return row;

        return {
          ...row,
          all_time_points: row.all_time_points + delta,
          daily_points: row.daily_points + delta,
          weekly_points: row.weekly_points + delta,
          monthly_points: row.monthly_points + delta,
          daily_penalties: delta < 0 ? row.daily_penalties + Math.abs(delta) : row.daily_penalties,
          daily_positive_events: delta > 0 ? row.daily_positive_events + 1 : row.daily_positive_events,
          daily_negative_events: delta < 0 ? row.daily_negative_events + 1 : row.daily_negative_events,
        };
      })
    );
  }

  async function registerOperationalCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const collaborator = rankings.find((row) => row.collaborator_id === captureForm.collaboratorId);
    const rule =
      rules.find((item) => item.code === captureForm.ruleCode) ||
      captureRules[0] ||
      rules.find((item) => item.is_active);

    if (!collaborator || !rule) {
      setMessage("Selecciona colaborador y regla operacional para captar el evento.");
      return;
    }

    const status: GamificationPoint["status"] = rule.requires_approval ? "pending" : "approved";
    const pointType: GamificationPointType = rule.points < 0 ? "negativo" : "positivo";
    const eventId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `capture-${Date.now()}`;
    const sourceId =
      captureForm.referenceCode.trim() ||
      `${captureForm.sourceModule.toUpperCase()}-${new Date().toISOString().slice(0, 10)}`;

    const newPoint: GamificationPoint = {
      id: eventId,
      collaborator_id: collaborator.collaborator_id,
      collaborator_name: collaborator.collaborator_name,
      department: collaborator.department,
      rule_id: rule.id,
      rule_code: rule.code,
      rule_title: rule.title,
      point_type: pointType,
      points: rule.points,
      source_module: captureForm.sourceModule,
      source_table: selectedCaptureChannel.sourceTable,
      source_id: sourceId,
      reference_code: sourceId,
      evidence_url: captureForm.evidenceUrl.trim() || null,
      notes: captureForm.notes.trim() || selectedCaptureChannel.description,
      status,
      awarded_by: "Captura operacional",
      approved_by: status === "approved" ? "Sistema RD Wood" : null,
      awarded_at: new Date().toISOString(),
    };

    if (!usingDemo) {
      const rpcResult = await supabase.rpc("register_gamification_event", {
        p_collaborator_id: newPoint.collaborator_id,
        p_collaborator_name: newPoint.collaborator_name,
        p_department: newPoint.department,
        p_rule_code: rule.code,
        p_source_module: newPoint.source_module,
        p_source_table: newPoint.source_table,
        p_source_id: newPoint.source_id,
        p_reference_code: newPoint.reference_code,
        p_evidence_url: newPoint.evidence_url,
        p_notes: newPoint.notes,
        p_awarded_by: newPoint.awarded_by,
      });

      if (rpcResult.error) {
        const { data, error } = await supabase
          .from("gamification_points")
          .insert({
            collaborator_id: newPoint.collaborator_id,
            collaborator_name: newPoint.collaborator_name,
            department: newPoint.department,
            rule_id: newPoint.rule_id,
            rule_code: newPoint.rule_code,
            rule_title: newPoint.rule_title,
            point_type: newPoint.point_type,
            points: newPoint.points,
            source_module: newPoint.source_module,
            source_table: newPoint.source_table,
            source_id: newPoint.source_id,
            reference_code: newPoint.reference_code,
            evidence_url: newPoint.evidence_url,
            notes: newPoint.notes,
            status: newPoint.status,
            awarded_by: newPoint.awarded_by,
            approved_by: newPoint.approved_by,
            awarded_at: newPoint.awarded_at,
          })
          .select("*")
          .single();

        if (error) {
          setMessage(`No se pudo captar el evento operativo: ${error.message}`);
          return;
        }

        setPoints((current) => [data as GamificationPoint, ...current]);
      } else {
        setPoints((current) => [{ ...newPoint, id: String(rpcResult.data || newPoint.id) }, ...current]);
      }
    } else {
      setPoints((current) => [newPoint, ...current]);
    }

    if (status === "approved") {
      patchRanking(collaborator.collaborator_id, rule.points);
    }

    setMessage(
      `${selectedCaptureChannel.label}: evento captado para ${collaborator.collaborator_name} (${formatPoints(rule.points)}${status === "pending" ? ", pendiente aprobacion" : ""}).`
    );
  }

  async function registerManualAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const collaborator = rankings.find((row) => row.collaborator_id === manualCollaboratorId);
    if (!collaborator) {
      setMessage("Selecciona un colaborador para registrar puntos.");
      return;
    }

    const rawPoints = Number(manualPoints);
    if (!Number.isFinite(rawPoints) || rawPoints === 0) {
      setMessage("El ajuste debe tener una cantidad de puntos valida.");
      return;
    }

    const signedPoints =
      manualType === "negativo" ? -Math.abs(rawPoints) : manualType === "positivo" ? Math.abs(rawPoints) : Math.trunc(rawPoints);

    const newPoint: GamificationPoint = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `local-${Date.now()}`,
      collaborator_id: collaborator.collaborator_id,
      collaborator_name: collaborator.collaborator_name,
      department: collaborator.department,
      rule_id: null,
      rule_code: "ajuste_manual",
      rule_title: "Ajuste manual supervisor",
      point_type: manualType,
      points: signedPoints,
      source_module: "manual",
      source_table: "gamification_admin",
      source_id: null,
      reference_code: "AJUSTE-MANUAL",
      evidence_url: null,
      notes: manualReason || "Ajuste supervisor",
      status: "approved",
      awarded_by: "Administrador",
      approved_by: "Administrador",
      awarded_at: new Date().toISOString(),
    };

    if (!usingDemo) {
      const { data, error } = await supabase
        .from("gamification_points")
        .insert({
          collaborator_id: newPoint.collaborator_id,
          collaborator_name: newPoint.collaborator_name,
          department: newPoint.department,
          rule_code: newPoint.rule_code,
          rule_title: newPoint.rule_title,
          point_type: newPoint.point_type,
          points: newPoint.points,
          source_module: newPoint.source_module,
          source_table: newPoint.source_table,
          reference_code: newPoint.reference_code,
          notes: newPoint.notes,
          status: newPoint.status,
          awarded_by: newPoint.awarded_by,
          approved_by: newPoint.approved_by,
          awarded_at: newPoint.awarded_at,
        })
        .select("*")
        .single();

      if (error) {
        setMessage(`No se pudo guardar en Supabase: ${error.message}`);
        return;
      }

      setPoints((current) => [data as GamificationPoint, ...current]);
    } else {
      setPoints((current) => [newPoint, ...current]);
    }

    patchRanking(collaborator.collaborator_id, signedPoints);
    setMessage(`Ajuste aplicado a ${collaborator.collaborator_name}: ${formatPoints(signedPoints)}.`);
  }

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const signedPoints =
      ruleForm.category === "negativo" ? -Math.abs(Number(ruleForm.points)) : Math.abs(Number(ruleForm.points));

    if (!ruleForm.title.trim() || !Number.isFinite(signedPoints) || signedPoints === 0) {
      setMessage("La regla necesita nombre y puntos validos.");
      return;
    }

    const newRule: GamificationRule = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `rule-${Date.now()}`,
      code: uniqueCode(ruleForm.title) || `regla_${Date.now()}`,
      title: ruleForm.title.trim(),
      description: "Regla creada desde el panel administrativo.",
      category: ruleForm.category,
      points: signedPoints,
      department_scope: [ruleForm.department],
      source_module: ruleForm.sourceModule.trim() || "manual",
      event_type: ruleForm.eventType.trim() || "manual_event",
      daily_limit: null,
      requires_approval: ruleForm.requiresApproval,
      is_active: true,
      created_by: "Administrador",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!usingDemo) {
      const { data, error } = await supabase
        .from("gamification_rules")
        .insert({
          code: newRule.code,
          title: newRule.title,
          description: newRule.description,
          category: newRule.category,
          points: newRule.points,
          department_scope: newRule.department_scope,
          source_module: newRule.source_module,
          event_type: newRule.event_type,
          daily_limit: newRule.daily_limit,
          requires_approval: newRule.requires_approval,
          is_active: true,
          created_by: "Administrador",
        })
        .select("*")
        .single();

      if (error) {
        setMessage(`No se pudo crear la regla: ${error.message}`);
        return;
      }

      setRules((current) => [data as GamificationRule, ...current]);
    } else {
      setRules((current) => [newRule, ...current]);
    }

    setMessage(`Regla creada: ${newRule.title} (${formatPoints(newRule.points)}).`);
  }

  async function approveRedemption(redemptionId: string) {
    const approvedAt = new Date().toISOString();

    if (!usingDemo) {
      const { data, error } = await supabase
        .from("gamification_redemptions")
        .update({
          status: "approved",
          approved_at: approvedAt,
          approved_by: "Administrador",
        })
        .eq("id", redemptionId)
        .select("*")
        .single();

      if (error) {
        setMessage(`No se pudo aprobar recompensa: ${error.message}`);
        return;
      }

      setRedemptions((current) =>
        current.map((redemption) =>
          redemption.id === redemptionId ? (data as GamificationRedemption) : redemption
        )
      );
    } else {
      setRedemptions((current) =>
        current.map((redemption) =>
          redemption.id === redemptionId
            ? {
                ...redemption,
                status: "approved",
                approved_at: approvedAt,
                approved_by: "Administrador",
              }
            : redemption
        )
      );
    }

    setMessage("Recompensa aprobada y registrada en historial.");
  }

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-6 text-white lg:px-8">
      <section className="overflow-hidden rounded-[28px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,#06111f_0%,#0a1024_54%,#172554_100%)] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.35)] lg:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.36em] text-cyan-200">
              <Trophy size={16} />
              Gamificacion Operacional
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
              Scoreboard de colaboradores y departamentos
            </h1>
            <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-slate-300">
              Puntos auditables para produccion, almacen, instalacion, transporte y oficina. Integra eventos de
              ponchador, QR tracking, evidencias, verificacion de calidad y cierres de orden.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/tv/gamificacion"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-500/15 px-5 py-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20"
            >
              <Tv size={18} />
              Abrir TV 55
            </Link>
            <button
              type="button"
              onClick={refreshData}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-cyan-100"
            >
              <RefreshCcw className={loading ? "animate-spin" : ""} size={18} />
              Actualizar
            </button>
          </div>
        </div>
      </section>

      <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-5 py-4 text-sm font-bold text-cyan-100">
        {message}
        {usingDemo ? (
          <span className="ml-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">
            Demo
          </span>
        ) : null}
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={<Users size={20} />} label="Colaboradores" value={nf.format(totals.collaborators)} />
        <MetricCard icon={<Zap size={20} />} label="Puntos hoy" value={formatPoints(totals.dailyPoints)} accent="cyan" />
        <MetricCard icon={<Target size={20} />} label="Puntos mes" value={formatPoints(totals.monthlyPoints)} accent="emerald" />
        <MetricCard icon={<BadgeCheck size={20} />} label="Eventos positivos" value={nf.format(totals.positiveEvents)} accent="emerald" />
        <MetricCard icon={<AlertTriangle size={20} />} label="Penalizaciones" value={nf.format(totals.negativeEvents)} accent="rose" />
      </section>

      <section className="mt-6 rounded-[28px] border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {GAMIFICATION_PERIODS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPeriod(item.key)}
                className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                  period === item.key
                    ? "border-cyan-300/45 bg-cyan-500/20 text-cyan-50"
                    : "border-slate-800 bg-[#07111f] text-slate-400 hover:border-cyan-400/25 hover:text-cyan-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="flex min-w-[260px] flex-col gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
            Departamento
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="rounded-2xl border border-slate-700 bg-[#07111f] px-4 py-3 text-sm font-black normal-case tracking-normal text-white outline-none focus:border-cyan-300"
            >
              {departments.map((item) => (
                <option key={item} value={item} className="bg-[#07111f] text-white">
                  {item === "Todos" ? "Todos los departamentos" : departmentLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="rounded-[28px] border border-cyan-400/15 bg-[#07111f] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.26em] text-cyan-300">Ranking</p>
              <h2 className="mt-1 text-2xl font-black">Top colaboradores</h2>
            </div>
            <Medal className="text-amber-300" size={34} />
          </div>

          <div className="mt-5 space-y-3">
            {collaboratorRanking.map((row, index) => {
              const score = pointsForPeriod(row, period);
              const width = Math.max(8, Math.min(100, Math.round((score / Math.max(1, pointsForPeriod(collaboratorRanking[0], period))) * 100)));

              return (
                <article
                  key={row.collaborator_id}
                  className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 md:grid-cols-[72px_1fr_150px]"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-500/10 text-2xl font-black text-cyan-100">
                    #{index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-black">{row.collaborator_name}</h3>
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-black text-slate-300">
                        {departmentLabel(row.department)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-400">{row.role_name || "Colaborador operativo"}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-500 to-emerald-300"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                  <div className={`rounded-2xl border p-4 text-right ${metricTone(score)}`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-80">Score</p>
                    <p className="mt-1 text-2xl font-black">{formatPoints(score)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-cyan-400/15 bg-[#07111f] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.26em] text-cyan-300">Departamentos</p>
                <h2 className="mt-1 text-2xl font-black">Ranking por area</h2>
              </div>
              <Factory className="text-cyan-200" size={30} />
            </div>
            <div className="mt-5 space-y-3">
              {departmentRanking.map((row, index) => (
                <div key={row.department} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">#{index + 1}</p>
                      <h3 className="text-xl font-black">{departmentLabel(row.department)}</h3>
                      <p className="text-xs font-semibold text-slate-500">{row.collaborators} colaborador(es)</p>
                    </div>
                    <p className="text-2xl font-black text-emerald-300">{formatPoints(row.points)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-amber-300/20 bg-amber-400/10 p-5">
            <div className="flex items-center gap-3">
              <Brain className="text-amber-200" size={28} />
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.26em] text-amber-200">Alertas IA</p>
                <h2 className="text-2xl font-black">Riesgos y oportunidades</h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {alerts.map((alert) => (
                <div key={alert} className="rounded-2xl border border-amber-300/20 bg-slate-950/60 p-4 text-sm font-bold text-amber-50">
                  {alert}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <form
          onSubmit={registerOperationalCapture}
          className="rounded-[28px] border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,47,73,0.92),rgba(2,8,23,0.94))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.26)]"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200">
                <ScanLine size={15} />
                Captura en operacion
              </div>
              <h2 className="mt-4 text-3xl font-black">Registrar evento real del piso</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
                Para la prueba de fabrica, cada supervisor puede capturar aqui el evento que ocurrio:
                colaborador, regla, orden o QR, evidencia y nota. Luego estos mismos canales se conectan automatico
                desde ponchador, QR tracking, produccion, almacen, transporte, instalacion y calidad.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100">
              {selectedCaptureChannel.label}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <FieldLabel label="Canal donde ocurrio">
              <select
                value={captureForm.sourceModule}
                onChange={(event) =>
                  setCaptureForm((current) => ({
                    ...current,
                    sourceModule: event.target.value,
                    ruleCode:
                      rules.find((rule) => rule.source_module === event.target.value)?.code ||
                      current.ruleCode,
                  }))
                }
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
              >
                {GAMIFICATION_CAPTURE_CHANNELS.map((channel) => (
                  <option key={channel.key} value={channel.key} className="bg-slate-950">
                    {channel.label}
                  </option>
                ))}
              </select>
            </FieldLabel>

            <FieldLabel label="Colaborador / equipo">
              <select
                value={captureForm.collaboratorId}
                onChange={(event) =>
                  setCaptureForm((current) => ({ ...current, collaboratorId: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
              >
                {rankings.map((row) => (
                  <option key={row.collaborator_id} value={row.collaborator_id} className="bg-slate-950">
                    {row.collaborator_name} - {departmentLabel(row.department)}
                  </option>
                ))}
              </select>
            </FieldLabel>

            <FieldLabel label="Regla que aplica">
              <select
                value={captureRules.some((rule) => rule.code === captureForm.ruleCode) ? captureForm.ruleCode : captureRules[0]?.code || ""}
                onChange={(event) =>
                  setCaptureForm((current) => ({ ...current, ruleCode: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
              >
                {captureRules.map((rule) => (
                  <option key={rule.code} value={rule.code} className="bg-slate-950">
                    {rule.title} ({formatPoints(rule.points)})
                  </option>
                ))}
              </select>
            </FieldLabel>

            <FieldLabel label="Orden / QR / modulo">
              <input
                value={captureForm.referenceCode}
                onChange={(event) =>
                  setCaptureForm((current) => ({ ...current, referenceCode: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                placeholder="OP-0000 / QR-PIEZA / MODULO"
              />
            </FieldLabel>

            <FieldLabel label="Evidencia foto/link">
              <input
                value={captureForm.evidenceUrl}
                onChange={(event) =>
                  setCaptureForm((current) => ({ ...current, evidenceUrl: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                placeholder="URL o referencia de foto"
              />
            </FieldLabel>

            <FieldLabel label="Nota operacional">
              <input
                value={captureForm.notes}
                onChange={(event) =>
                  setCaptureForm((current) => ({ ...current, notes: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                placeholder="Que paso y quien valido"
              />
            </FieldLabel>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm font-semibold text-slate-300">
              <span className="font-black text-cyan-100">Mesa de captura:</span>{" "}
              {selectedCaptureChannel.description} Tabla fuente: {selectedCaptureChannel.sourceTable}.
            </div>
            <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-4 text-sm font-black text-slate-950">
              <ClipboardCheck size={18} />
              Captar evento
            </button>
          </div>
        </form>

        <div className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5">
          <div className="flex items-center gap-3">
            <Camera className="text-cyan-200" size={26} />
            <h2 className="text-2xl font-black">Mejor forma de captarlo</h2>
          </div>
          <div className="mt-5 space-y-3">
            {GAMIFICATION_CAPTURE_CHANNELS.map((channel) => (
              <div key={channel.key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="font-black text-white">{channel.label}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-400">{channel.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <form onSubmit={registerManualAdjustment} className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5">
          <div className="flex items-center gap-3">
            <Save className="text-cyan-200" size={26} />
            <h2 className="text-2xl font-black">Ajustar puntos</h2>
          </div>
          <div className="mt-5 space-y-4">
            <FieldLabel label="Colaborador">
              <select
                value={manualCollaboratorId}
                onChange={(event) => setManualCollaboratorId(event.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
              >
                {rankings.map((row) => (
                  <option key={row.collaborator_id} value={row.collaborator_id} className="bg-slate-950">
                    {row.collaborator_name} - {departmentLabel(row.department)}
                  </option>
                ))}
              </select>
            </FieldLabel>

            <div className="grid gap-3 md:grid-cols-2">
              <FieldLabel label="Tipo">
                <select
                  value={manualType}
                  onChange={(event) => setManualType(event.target.value as GamificationPointType)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                >
                  <option value="positivo" className="bg-slate-950">Positivo</option>
                  <option value="negativo" className="bg-slate-950">Negativo</option>
                  <option value="ajuste" className="bg-slate-950">Ajuste libre</option>
                </select>
              </FieldLabel>
              <FieldLabel label="Puntos">
                <input
                  value={manualPoints}
                  onChange={(event) => setManualPoints(event.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                  inputMode="numeric"
                />
              </FieldLabel>
            </div>

            <FieldLabel label="Razon auditada">
              <textarea
                value={manualReason}
                onChange={(event) => setManualReason(event.target.value)}
                className="min-h-28 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
              />
            </FieldLabel>

            <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-4 text-sm font-black text-slate-950">
              <Plus size={18} />
              Registrar ajuste
            </button>
          </div>
        </form>

        <form onSubmit={createRule} className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="text-emerald-200" size={26} />
            <h2 className="text-2xl font-black">Crear regla</h2>
          </div>
          <div className="mt-5 space-y-4">
            <FieldLabel label="Nombre de regla">
              <input
                value={ruleForm.title}
                onChange={(event) => setRuleForm((current) => ({ ...current, title: event.target.value }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
              />
            </FieldLabel>

            <div className="grid gap-3 md:grid-cols-2">
              <FieldLabel label="Categoria">
                <select
                  value={ruleForm.category}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      category: event.target.value as GamificationRuleCategory,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                >
                  <option value="positivo" className="bg-slate-950">Positiva</option>
                  <option value="negativo" className="bg-slate-950">Negativa</option>
                </select>
              </FieldLabel>
              <FieldLabel label="Puntos">
                <input
                  value={ruleForm.points}
                  onChange={(event) => setRuleForm((current) => ({ ...current, points: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                  inputMode="numeric"
                />
              </FieldLabel>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <FieldLabel label="Departamento">
                <select
                  value={ruleForm.department}
                  onChange={(event) => setRuleForm((current) => ({ ...current, department: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                >
                  {GAMIFICATION_DEPARTMENTS.map((item) => (
                    <option key={item} value={item} className="bg-slate-950">
                      {departmentLabel(item)}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Modulo fuente">
                <input
                  value={ruleForm.sourceModule}
                  onChange={(event) => setRuleForm((current) => ({ ...current, sourceModule: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
                />
              </FieldLabel>
            </div>

            <FieldLabel label="Evento tecnico">
              <input
                value={ruleForm.eventType}
                onChange={(event) => setRuleForm((current) => ({ ...current, eventType: event.target.value }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
              />
            </FieldLabel>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-300">
              <input
                type="checkbox"
                checked={ruleForm.requiresApproval}
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, requiresApproval: event.target.checked }))
                }
                className="h-4 w-4 accent-cyan-400"
              />
              Requiere aprobacion de supervisor
            </label>

            <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950">
              <Plus size={18} />
              Crear regla
            </button>
          </div>
        </form>

        <div className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5">
          <div className="flex items-center gap-3">
            <Gift className="text-amber-200" size={26} />
            <h2 className="text-2xl font-black">Recompensas</h2>
          </div>
          <div className="mt-5 space-y-3">
            {rewards.map((reward) => (
              <article key={reward.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-black">{reward.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-400">{reward.description}</p>
                  </div>
                  <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-200">
                    {nf.format(reward.points_required)}
                  </span>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-400/15 bg-cyan-500/10 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">Pendientes</p>
            <div className="mt-3 space-y-3">
              {pendingRedemptions.length ? (
                pendingRedemptions.map((redemption) => (
                  <div key={redemption.id} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-3">
                    <p className="font-black">{redemption.collaborator_name}</p>
                    <p className="text-xs font-semibold text-slate-400">
                      {formatPoints(-Math.abs(redemption.points_spent))} - {formatDate(redemption.requested_at)}
                    </p>
                    <button
                      type="button"
                      onClick={() => approveRedemption(redemption.id)}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950"
                    >
                      <ShieldCheck size={15} />
                      Aprobar recompensa
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm font-semibold text-slate-400">Sin recompensas pendientes.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5">
          <div className="flex items-center gap-3">
            <History className="text-cyan-200" size={26} />
            <h2 className="text-2xl font-black">Historial reciente</h2>
          </div>
          <div className="mt-5 max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {points.map((point) => (
              <article key={point.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black">{point.collaborator_name}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-400">
                      {point.rule_title || point.rule_code || "Ajuste"} - {point.source_module}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{point.notes || point.reference_code}</p>
                  </div>
                  <div className={`rounded-2xl border px-4 py-3 text-right ${metricTone(point.points)}`}>
                    <p className="text-lg font-black">{formatPoints(point.points)}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">{formatDate(point.awarded_at)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5">
          <div className="flex items-center gap-3">
            <Database className="text-emerald-200" size={26} />
            <h2 className="text-2xl font-black">Reglas e integraciones</h2>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <RuleColumn title="Puntos positivos" rules={positiveRules} />
            <RuleColumn title="Puntos negativos" rules={negativeRules} />
          </div>

          <div className="mt-6 rounded-2xl border border-cyan-400/15 bg-slate-950/70 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300">Integracion operacional</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                ["Produccion", "orden_a_tiempo, error_produccion"],
                ["Instalacion", "cero_errores_qa, fotos_requeridas"],
                ["Transporte", "fotos_requeridas, falta_foto"],
                ["Almacen", "fotos_requeridas, no_escanear"],
                ["Ponchador", "llegada_tiempo, llegada_tarde"],
                ["QR Tracking", "qr_correcto, no_escanear"],
                ["Verificacion / Calidad", "cero_errores_qa, reproceso_descuido"],
                ["Oficina / CEO", "mejora_aprobada, ayuda_departamento"],
              ].map(([moduleName, moduleRules]) => (
                <div key={moduleName} className="rounded-2xl border border-slate-800 bg-[#07111f] p-4">
                  <p className="font-black text-white">{moduleName}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{moduleRules}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent = "cyan",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "cyan" | "emerald" | "rose";
}) {
  const tones = {
    cyan: "text-cyan-200 bg-cyan-500/10 border-cyan-400/20",
    emerald: "text-emerald-200 bg-emerald-500/10 border-emerald-400/20",
    rose: "text-rose-200 bg-rose-500/10 border-rose-400/20",
  };

  return (
    <article className="rounded-[24px] border border-slate-800 bg-[#07111f] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${tones[accent]}`}>{icon}</div>
        <Activity className="text-slate-700" size={20} />
      </div>
      <p className="mt-5 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </article>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function RuleColumn({ title, rules }: { title: string; rules: GamificationRule[] }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center gap-2">
        {title.includes("positivos") ? <Award className="text-emerald-200" size={20} /> : <AlertTriangle className="text-rose-200" size={20} />}
        <h3 className="font-black">{title}</h3>
      </div>
      <div className="mt-4 space-y-2">
        {rules.map((rule) => (
          <div key={rule.id || rule.code} className="rounded-2xl border border-slate-800 bg-[#07111f] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black">{rule.title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{rule.source_module} - {rule.event_type}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${metricTone(rule.points)}`}>
                {formatPoints(rule.points)}
              </span>
            </div>
            {rule.requires_approval ? (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">
                <Eye size={12} />
                Supervisor
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
