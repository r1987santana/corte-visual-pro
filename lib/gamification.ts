import { supabase } from "@/lib/supabase";

export type GamificationPeriod = "daily" | "weekly" | "monthly" | "all";
export type GamificationRuleCategory = "positivo" | "negativo";
export type GamificationPointType = GamificationRuleCategory | "ajuste";

export type GamificationRule = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: GamificationRuleCategory;
  points: number;
  department_scope: string[];
  source_module: string;
  event_type: string;
  daily_limit: number | null;
  requires_approval: boolean;
  is_active: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GamificationPoint = {
  id: string;
  collaborator_id: string | null;
  collaborator_name: string;
  department: string;
  rule_id: string | null;
  rule_code: string | null;
  rule_title: string | null;
  point_type: GamificationPointType;
  points: number;
  source_module: string;
  source_table: string | null;
  source_id: string | null;
  reference_code: string | null;
  evidence_url: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected" | "voided";
  awarded_by: string | null;
  approved_by: string | null;
  awarded_at: string;
  created_at?: string;
};

export type GamificationReward = {
  id: string;
  title: string;
  description: string | null;
  reward_type: string;
  points_required: number;
  department_scope: string[];
  stock: number | null;
  period: string;
  status: "active" | "paused" | "archived";
  approval_required: boolean;
  created_at?: string;
  updated_at?: string;
};

export type GamificationRedemption = {
  id: string;
  reward_id: string;
  collaborator_id: string | null;
  collaborator_name: string;
  department: string;
  points_spent: number;
  status: "pending" | "approved" | "rejected" | "delivered" | "cancelled";
  requested_at: string;
  approved_at: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at?: string;
};

export type GamificationRanking = {
  collaborator_id: string;
  collaborator_name: string;
  department: string;
  role_name: string | null;
  avatar_url: string | null;
  all_time_points: number;
  daily_points: number;
  weekly_points: number;
  monthly_points: number;
  daily_penalties: number;
  daily_positive_events: number;
  daily_negative_events: number;
  company_rank: number;
  department_rank: number;
};

export type GamificationDepartmentRanking = {
  department: string;
  points: number;
  collaborators: number;
  penalties: number;
  positiveEvents: number;
};

export type GamificationData = {
  rankings: GamificationRanking[];
  rules: GamificationRule[];
  points: GamificationPoint[];
  rewards: GamificationReward[];
  redemptions: GamificationRedemption[];
  usingDemo: boolean;
  sourceMessage: string;
};

export const GAMIFICATION_DEPARTMENTS = [
  "Produccion",
  "Almacen",
  "Instalacion",
  "Transporte",
  "Oficina",
];

export const GAMIFICATION_PERIODS: Array<{ key: GamificationPeriod; label: string }> = [
  { key: "daily", label: "Diario" },
  { key: "weekly", label: "Semanal" },
  { key: "monthly", label: "Mensual" },
  { key: "all", label: "Total" },
];

export const GAMIFICATION_CAPTURE_CHANNELS = [
  {
    key: "ponchador",
    label: "Ponchador / asistencia",
    sourceTable: "attendance_logs",
    description: "Puntualidad, tardanzas y asistencia del colaborador.",
  },
  {
    key: "qr_tracking",
    label: "QR Tracking",
    sourceTable: "piece_labels",
    description: "Escaneo de orden, modulo, pieza y movimiento operativo.",
  },
  {
    key: "produccion",
    label: "Produccion",
    sourceTable: "production_orders",
    description: "Cierre de orden, error de fabricacion, retraso o reproceso.",
  },
  {
    key: "almacen",
    label: "Almacen",
    sourceTable: "warehouse_requisitions",
    description: "Despacho, requisicion, evidencia y control de materiales.",
  },
  {
    key: "transporte",
    label: "Transporte",
    sourceTable: "transport_events",
    description: "Carga, ruta, entrega y evidencia de despacho.",
  },
  {
    key: "instalacion",
    label: "Instalacion",
    sourceTable: "installation_tasks",
    description: "Avance de instalacion, fotos y cierre en campo.",
  },
  {
    key: "verificacion",
    label: "Verificacion / calidad",
    sourceTable: "qa_checks",
    description: "Cero errores, observaciones y reprocesos.",
  },
  {
    key: "manual",
    label: "Supervisor / mejora",
    sourceTable: "manual_gamification_events",
    description: "Ayuda entre departamentos, mejora aprobada y eventos especiales.",
  },
];

const now = Date.now();

function isoAgo(hours: number) {
  return new Date(now - hours * 60 * 60 * 1000).toISOString();
}

export const DEMO_RULES: GamificationRule[] = [
  {
    id: "rule-on-time",
    code: "llegada_tiempo",
    title: "Llegar a tiempo",
    description: "Ponche puntual dentro del margen permitido.",
    category: "positivo",
    points: 10,
    department_scope: GAMIFICATION_DEPARTMENTS,
    source_module: "ponchador",
    event_type: "attendance_on_time",
    daily_limit: 1,
    requires_approval: false,
    is_active: true,
  },
  {
    id: "rule-order-time",
    code: "orden_a_tiempo",
    title: "Terminar orden a tiempo",
    description: "Orden o modulo completado dentro de la fecha prometida.",
    category: "positivo",
    points: 35,
    department_scope: ["Produccion", "Corte", "Ensamblado"],
    source_module: "produccion",
    event_type: "order_completed_on_time",
    daily_limit: null,
    requires_approval: false,
    is_active: true,
  },
  {
    id: "rule-qa-zero",
    code: "cero_errores_qa",
    title: "Cero errores en verificacion",
    description: "Modulo aprobado por calidad sin observaciones.",
    category: "positivo",
    points: 30,
    department_scope: ["Produccion", "Instalacion"],
    source_module: "verificacion",
    event_type: "qa_zero_errors",
    daily_limit: null,
    requires_approval: false,
    is_active: true,
  },
  {
    id: "rule-photos",
    code: "fotos_requeridas",
    title: "Subir fotos requeridas",
    description: "Evidencias completas de carga, instalacion o entrega.",
    category: "positivo",
    points: 12,
    department_scope: ["Almacen", "Instalacion", "Transporte"],
    source_module: "evidencias",
    event_type: "required_photos_uploaded",
    daily_limit: null,
    requires_approval: false,
    is_active: true,
  },
  {
    id: "rule-qr",
    code: "qr_correcto",
    title: "Escanear QR correctamente",
    description: "Escaneo correcto de orden, modulo o pieza.",
    category: "positivo",
    points: 8,
    department_scope: ["Produccion", "Almacen", "Instalacion", "Transporte"],
    source_module: "qr_tracking",
    event_type: "qr_scan_ok",
    daily_limit: 12,
    requires_approval: false,
    is_active: true,
  },
  {
    id: "rule-help",
    code: "ayuda_departamento",
    title: "Ayudar a otro departamento",
    description: "Soporte documentado entre areas.",
    category: "positivo",
    points: 20,
    department_scope: GAMIFICATION_DEPARTMENTS,
    source_module: "manual",
    event_type: "cross_department_help",
    daily_limit: null,
    requires_approval: true,
    is_active: true,
  },
  {
    id: "rule-improvement",
    code: "mejora_aprobada",
    title: "Proponer mejora aprobada",
    description: "Idea aprobada que mejora costo, calidad, seguridad o velocidad.",
    category: "positivo",
    points: 50,
    department_scope: GAMIFICATION_DEPARTMENTS,
    source_module: "ceo",
    event_type: "approved_improvement",
    daily_limit: null,
    requires_approval: true,
    is_active: true,
  },
  {
    id: "rule-late",
    code: "llegada_tarde",
    title: "Llegada tarde",
    description: "Ponche fuera de horario sin aprobacion.",
    category: "negativo",
    points: -12,
    department_scope: GAMIFICATION_DEPARTMENTS,
    source_module: "ponchador",
    event_type: "attendance_late",
    daily_limit: 1,
    requires_approval: false,
    is_active: true,
  },
  {
    id: "rule-no-qr",
    code: "no_escanear",
    title: "No escanear orden/modulo",
    description: "Movimiento sin QR o sin trazabilidad.",
    category: "negativo",
    points: -15,
    department_scope: ["Produccion", "Almacen", "Instalacion", "Transporte"],
    source_module: "qr_tracking",
    event_type: "missing_qr_scan",
    daily_limit: null,
    requires_approval: false,
    is_active: true,
  },
  {
    id: "rule-prod-error",
    code: "error_produccion",
    title: "Error en produccion",
    description: "Error de corte, canteo, armado o material.",
    category: "negativo",
    points: -30,
    department_scope: ["Produccion", "Corte", "Ensamblado"],
    source_module: "produccion",
    event_type: "production_error",
    daily_limit: null,
    requires_approval: false,
    is_active: true,
  },
  {
    id: "rule-missing-photo",
    code: "falta_foto",
    title: "Falta de foto/evidencia",
    description: "Entrega, transporte o instalacion sin evidencia requerida.",
    category: "negativo",
    points: -15,
    department_scope: ["Almacen", "Instalacion", "Transporte"],
    source_module: "evidencias",
    event_type: "missing_photo",
    daily_limit: null,
    requires_approval: false,
    is_active: true,
  },
  {
    id: "rule-delay",
    code: "retraso_injustificado",
    title: "Retraso injustificado",
    description: "Tarea vencida sin causa aprobada.",
    category: "negativo",
    points: -25,
    department_scope: GAMIFICATION_DEPARTMENTS,
    source_module: "ceo",
    event_type: "unjustified_delay",
    daily_limit: null,
    requires_approval: true,
    is_active: true,
  },
  {
    id: "rule-rework",
    code: "reproceso_descuido",
    title: "Reproceso por descuido",
    description: "Trabajo repetido por falta de cuidado o validacion.",
    category: "negativo",
    points: -35,
    department_scope: ["Produccion", "Corte", "Ensamblado", "Instalacion"],
    source_module: "verificacion",
    event_type: "careless_rework",
    daily_limit: null,
    requires_approval: true,
    is_active: true,
  },
];

export const DEMO_RANKINGS: GamificationRanking[] = [
  {
    collaborator_id: "11111111-1111-4111-8111-111111111111",
    collaborator_name: "JUAN JULIO SANTANA",
    department: "Produccion",
    role_name: "Maestro produccion",
    avatar_url: null,
    all_time_points: 1210,
    daily_points: 43,
    weekly_points: 188,
    monthly_points: 520,
    daily_penalties: 0,
    daily_positive_events: 2,
    daily_negative_events: 0,
    company_rank: 1,
    department_rank: 1,
  },
  {
    collaborator_id: "22222222-2222-4222-8222-222222222222",
    collaborator_name: "RUBEN SANTANA",
    department: "Oficina",
    role_name: "Ventas / proyectos",
    avatar_url: null,
    all_time_points: 980,
    daily_points: 50,
    weekly_points: 120,
    monthly_points: 410,
    daily_penalties: 0,
    daily_positive_events: 1,
    daily_negative_events: 0,
    company_rank: 2,
    department_rank: 1,
  },
  {
    collaborator_id: "44444444-4444-4444-8444-444444444444",
    collaborator_name: "EQUIPO INSTALACION A",
    department: "Instalacion",
    role_name: "Instalador lider",
    avatar_url: null,
    all_time_points: 860,
    daily_points: 30,
    weekly_points: 112,
    monthly_points: 392,
    daily_penalties: 0,
    daily_positive_events: 1,
    daily_negative_events: 0,
    company_rank: 3,
    department_rank: 1,
  },
  {
    collaborator_id: "33333333-3333-4333-8333-333333333333",
    collaborator_name: "MARIA ALMACEN",
    department: "Almacen",
    role_name: "Control almacen",
    avatar_url: null,
    all_time_points: 720,
    daily_points: 12,
    weekly_points: 86,
    monthly_points: 305,
    daily_penalties: 0,
    daily_positive_events: 1,
    daily_negative_events: 0,
    company_rank: 4,
    department_rank: 1,
  },
  {
    collaborator_id: "55555555-5555-4555-8555-555555555555",
    collaborator_name: "CHOFER PILOTO 1",
    department: "Transporte",
    role_name: "Chofer",
    avatar_url: null,
    all_time_points: 510,
    daily_points: -15,
    weekly_points: 34,
    monthly_points: 210,
    daily_penalties: 15,
    daily_positive_events: 0,
    daily_negative_events: 1,
    company_rank: 5,
    department_rank: 1,
  },
];

export const DEMO_POINTS: GamificationPoint[] = [
  {
    id: "point-demo-1",
    collaborator_id: DEMO_RANKINGS[0].collaborator_id,
    collaborator_name: DEMO_RANKINGS[0].collaborator_name,
    department: "Produccion",
    rule_id: null,
    rule_code: "orden_a_tiempo",
    rule_title: "Terminar orden a tiempo",
    point_type: "positivo",
    points: 35,
    source_module: "produccion",
    source_table: "production_orders",
    source_id: "OP-DEMO-001",
    reference_code: "OP-DEMO-001",
    evidence_url: null,
    notes: "Orden cerrada antes de la hora prometida.",
    status: "approved",
    awarded_by: "Sistema Produccion",
    approved_by: null,
    awarded_at: isoAgo(2),
  },
  {
    id: "point-demo-2",
    collaborator_id: DEMO_RANKINGS[0].collaborator_id,
    collaborator_name: DEMO_RANKINGS[0].collaborator_name,
    department: "Produccion",
    rule_id: null,
    rule_code: "qr_correcto",
    rule_title: "Escanear QR correctamente",
    point_type: "positivo",
    points: 8,
    source_module: "qr_tracking",
    source_table: "piece_labels",
    source_id: "QR-DEMO-001",
    reference_code: "QR-DEMO-001",
    evidence_url: null,
    notes: "Escaneo correcto de modulo y pieza.",
    status: "approved",
    awarded_by: "QR Tracking",
    approved_by: null,
    awarded_at: isoAgo(1),
  },
  {
    id: "point-demo-3",
    collaborator_id: DEMO_RANKINGS[3].collaborator_id,
    collaborator_name: DEMO_RANKINGS[3].collaborator_name,
    department: "Almacen",
    rule_id: null,
    rule_code: "fotos_requeridas",
    rule_title: "Subir fotos requeridas",
    point_type: "positivo",
    points: 12,
    source_module: "almacen",
    source_table: "warehouse_requisitions",
    source_id: "REQ-DEMO-001",
    reference_code: "REQ-DEMO-001",
    evidence_url: null,
    notes: "Requisicion documentada con evidencias.",
    status: "approved",
    awarded_by: "Almacen",
    approved_by: null,
    awarded_at: isoAgo(4),
  },
  {
    id: "point-demo-4",
    collaborator_id: DEMO_RANKINGS[2].collaborator_id,
    collaborator_name: DEMO_RANKINGS[2].collaborator_name,
    department: "Instalacion",
    rule_id: null,
    rule_code: "cero_errores_qa",
    rule_title: "Cero errores en verificacion",
    point_type: "positivo",
    points: 30,
    source_module: "verificacion",
    source_table: "qa_checks",
    source_id: "QA-DEMO-001",
    reference_code: "QA-DEMO-001",
    evidence_url: null,
    notes: "Modulo aprobado sin observaciones.",
    status: "approved",
    awarded_by: "QA",
    approved_by: null,
    awarded_at: isoAgo(6),
  },
  {
    id: "point-demo-5",
    collaborator_id: DEMO_RANKINGS[4].collaborator_id,
    collaborator_name: DEMO_RANKINGS[4].collaborator_name,
    department: "Transporte",
    rule_id: null,
    rule_code: "falta_foto",
    rule_title: "Falta de foto/evidencia",
    point_type: "negativo",
    points: -15,
    source_module: "transporte",
    source_table: "transport_events",
    source_id: "TR-DEMO-001",
    reference_code: "TR-DEMO-001",
    evidence_url: null,
    notes: "Falto una evidencia de carga.",
    status: "approved",
    awarded_by: "Sistema Transporte",
    approved_by: null,
    awarded_at: isoAgo(3),
  },
];

export const DEMO_REWARDS: GamificationReward[] = [
  {
    id: "reward-demo-1",
    title: "Bono puntualidad semanal",
    description: "Reconocimiento por asistencia perfecta y cero tardanzas.",
    reward_type: "bono",
    points_required: 180,
    department_scope: ["Todos"],
    stock: 5,
    period: "semanal",
    status: "active",
    approval_required: true,
  },
  {
    id: "reward-demo-2",
    title: "Almuerzo premium equipo ganador",
    description: "Premio para el departamento con mejor score mensual.",
    reward_type: "equipo",
    points_required: 650,
    department_scope: ["Todos"],
    stock: 1,
    period: "mensual",
    status: "active",
    approval_required: true,
  },
  {
    id: "reward-demo-3",
    title: "Dia libre operacional",
    description: "Beneficio para colaborador top con cero penalizaciones.",
    reward_type: "beneficio",
    points_required: 900,
    department_scope: ["Todos"],
    stock: 2,
    period: "mensual",
    status: "active",
    approval_required: true,
  },
];

export const DEMO_REDEMPTIONS: GamificationRedemption[] = [
  {
    id: "redemption-demo-1",
    reward_id: DEMO_REWARDS[0].id,
    collaborator_id: DEMO_RANKINGS[0].collaborator_id,
    collaborator_name: DEMO_RANKINGS[0].collaborator_name,
    department: "Produccion",
    points_spent: 180,
    status: "pending",
    requested_at: isoAgo(5),
    approved_at: null,
    approved_by: null,
    notes: "Pendiente de aprobacion del supervisor.",
  },
];

export function departmentLabel(department: string) {
  const labels: Record<string, string> = {
    Produccion: "Produccion",
    Almacen: "Almacen",
    Instalacion: "Instalacion",
    Transporte: "Transporte",
    Oficina: "Oficina",
    Corte: "Corte",
    Ensamblado: "Ensamblado",
  };

  return labels[department] || department || "Sin departamento";
}

export function pointsForPeriod(row: GamificationRanking, period: GamificationPeriod) {
  if (period === "daily") return row.daily_points || 0;
  if (period === "weekly") return row.weekly_points || 0;
  if (period === "monthly") return row.monthly_points || 0;
  return row.all_time_points || 0;
}

export function rankCollaborators(
  rankings: GamificationRanking[],
  period: GamificationPeriod,
  department = "Todos"
) {
  return rankings
    .filter((row) => department === "Todos" || row.department === department)
    .slice()
    .sort((a, b) => pointsForPeriod(b, period) - pointsForPeriod(a, period));
}

export function buildDepartmentRankings(
  rankings: GamificationRanking[],
  period: GamificationPeriod
): GamificationDepartmentRanking[] {
  const map = new Map<string, GamificationDepartmentRanking>();

  rankings.forEach((row) => {
    const current =
      map.get(row.department) ||
      {
        department: row.department,
        points: 0,
        collaborators: 0,
        penalties: 0,
        positiveEvents: 0,
      };

    current.points += pointsForPeriod(row, period);
    current.collaborators += 1;
    current.penalties += row.daily_penalties || 0;
    current.positiveEvents += row.daily_positive_events || 0;
    map.set(row.department, current);
  });

  return Array.from(map.values()).sort((a, b) => b.points - a.points);
}

export function buildGamificationAlerts(rankings: GamificationRanking[], points: GamificationPoint[]) {
  const alerts: string[] = [];
  const penaltyLeader = rankings
    .filter((row) => row.daily_penalties > 0)
    .sort((a, b) => b.daily_penalties - a.daily_penalties)[0];

  if (penaltyLeader) {
    alerts.push(
      `${penaltyLeader.department}: revisar ${penaltyLeader.collaborator_name}, acumula ${penaltyLeader.daily_penalties} puntos negativos hoy.`
    );
  }

  const noQr = points.find((point) => point.rule_code === "no_escanear" && point.status === "approved");
  if (noQr) {
    alerts.push(`QR Tracking detecto movimiento sin escaneo: ${noQr.reference_code || noQr.collaborator_name}.`);
  }

  const top = rankCollaborators(rankings, "daily")[0];
  if (top && top.daily_points > 0) {
    alerts.push(`${top.collaborator_name} lidera el dia con ${top.daily_points} puntos.`);
  }

  if (!alerts.length) {
    alerts.push("IA Operacional: sin riesgos criticos de gamificacion en este corte.");
  }

  return alerts;
}

export function getGamificationTotals(rankings: GamificationRanking[], points: GamificationPoint[]) {
  return {
    collaborators: rankings.length,
    dailyPoints: rankings.reduce((sum, row) => sum + (row.daily_points || 0), 0),
    monthlyPoints: rankings.reduce((sum, row) => sum + (row.monthly_points || 0), 0),
    positiveEvents: points.filter((point) => point.status === "approved" && point.points > 0).length,
    negativeEvents: points.filter((point) => point.status === "approved" && point.points < 0).length,
  };
}

function demoData(message = "Modo demo activo: ejecuta scripts/gamificacion-operacional.sql en Supabase para datos reales."): GamificationData {
  return {
    rankings: DEMO_RANKINGS,
    rules: DEMO_RULES,
    points: DEMO_POINTS,
    rewards: DEMO_REWARDS,
    redemptions: DEMO_REDEMPTIONS,
    usingDemo: true,
    sourceMessage: message,
  };
}

export async function loadGamificationData(): Promise<GamificationData> {
  try {
    const [rankingsResult, rulesResult, pointsResult, rewardsResult, redemptionsResult] =
      await Promise.all([
        supabase
          .from("gamification_rankings_view")
          .select("*")
          .order("company_rank", { ascending: true }),
        supabase
          .from("gamification_rules")
          .select("*")
          .order("category", { ascending: true })
          .order("points", { ascending: false }),
        supabase
          .from("gamification_points")
          .select("*")
          .order("awarded_at", { ascending: false })
          .limit(80),
        supabase
          .from("gamification_rewards")
          .select("*")
          .order("points_required", { ascending: true }),
        supabase
          .from("gamification_redemptions")
          .select("*")
          .order("requested_at", { ascending: false })
          .limit(40),
      ]);

    const firstError =
      rankingsResult.error ||
      rulesResult.error ||
      pointsResult.error ||
      rewardsResult.error ||
      redemptionsResult.error;

    if (firstError) throw firstError;

    const rankings = (rankingsResult.data || []) as GamificationRanking[];
    const rules = (rulesResult.data || []) as GamificationRule[];
    const points = (pointsResult.data || []) as GamificationPoint[];
    const rewards = (rewardsResult.data || []) as GamificationReward[];
    const redemptions = (redemptionsResult.data || []) as GamificationRedemption[];

    if (!rankings.length && !rules.length && !points.length) {
      return demoData("Tablas listas, pero sin datos todavia. Cargue los demos del SQL para probar ranking y TV.");
    }

    return {
      rankings,
      rules,
      points,
      rewards,
      redemptions,
      usingDemo: false,
      sourceMessage: "Datos conectados a Supabase.",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message?: unknown }).message || "No se pudo leer Supabase.")
          : "No se pudo leer Supabase.";
    return demoData(`Modo demo activo: ${message}`);
  }
}

export async function awardGamificationPoints(input: {
  collaboratorId?: string | null;
  collaboratorName: string;
  department: string;
  ruleCode: string;
  sourceModule: string;
  sourceTable?: string | null;
  sourceId?: string | null;
  referenceCode?: string | null;
  evidenceUrl?: string | null;
  notes?: string | null;
  awardedBy?: string | null;
}) {
  const { data: rule, error: ruleError } = await supabase
    .from("gamification_rules")
    .select("*")
    .eq("code", input.ruleCode)
    .eq("is_active", true)
    .maybeSingle();

  if (ruleError) throw ruleError;
  if (!rule) throw new Error(`Regla de gamificacion no encontrada: ${input.ruleCode}`);

  const pointType: GamificationPointType = rule.points >= 0 ? "positivo" : "negativo";

  const { error } = await supabase.from("gamification_points").insert({
    collaborator_id: input.collaboratorId || null,
    collaborator_name: input.collaboratorName,
    department: input.department,
    rule_id: rule.id,
    rule_code: rule.code,
    rule_title: rule.title,
    point_type: pointType,
    points: rule.points,
    source_module: input.sourceModule,
    source_table: input.sourceTable || null,
    source_id: input.sourceId || null,
    reference_code: input.referenceCode || null,
    evidence_url: input.evidenceUrl || null,
    notes: input.notes || null,
    status: rule.requires_approval ? "pending" : "approved",
    awarded_by: input.awardedBy || "Sistema RD Wood",
    awarded_at: new Date().toISOString(),
  });

  if (error) throw error;

  return {
    points: rule.points as number,
    status: rule.requires_approval ? "pending" : "approved",
  };
}
