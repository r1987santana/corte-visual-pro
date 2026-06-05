export type CompensationUnitType = "pie_lineal" | "pie_cuadrado";

export type OperationalRoleKey =
  | "canteo_maestro"
  | "canteo_ayudante"
  | "ensamble_maestro"
  | "ensamble_ayudante"
  | "transporte_maestro"
  | "transporte_ayudante"
  | "instalacion_maestro"
  | "instalacion_ayudante"
  | "verificacion";

export type OperationalCompensationConfig = {
  roleKey: OperationalRoleKey;
  label: string;
  stage: string;
  stagePercent: number;
  rolePercent: number;
};

export type OperationalCompensationParticipant = {
  name?: string | null;
  roleKey: OperationalRoleKey;
  department?: string | null;
  position?: string | null;
};

export type OperationalCompensationPiece = {
  width_mm?: number | null;
  height_mm?: number | null;
  quantity?: number | null;
};

export type RegisterOperationalCompensationParams = {
  supabase: any;
  orderCode: string;
  moduleName: string;
  projectName?: string | null;
  sourceModule: string;
  sourceId?: string | null;
  unitType?: CompensationUnitType;
  pieces?: OperationalCompensationPiece[];
  participants: OperationalCompensationParticipant[];
  notes?: string | null;
};

export const OPERATIONAL_COMPENSATION_RATES: Record<CompensationUnitType, number> = {
  pie_lineal: 700,
  pie_cuadrado: 500,
};

export const OPERATIONAL_COMPENSATION_CONFIG: Record<OperationalRoleKey, OperationalCompensationConfig> = {
  canteo_maestro: {
    roleKey: "canteo_maestro",
    label: "Canteo maestro",
    stage: "canteo",
    stagePercent: 0.12,
    rolePercent: 0.7,
  },
  canteo_ayudante: {
    roleKey: "canteo_ayudante",
    label: "Canteo ayudante",
    stage: "canteo",
    stagePercent: 0.12,
    rolePercent: 0.3,
  },
  ensamble_maestro: {
    roleKey: "ensamble_maestro",
    label: "Ensamble y limpieza maestro",
    stage: "ensamble_limpieza",
    stagePercent: 0.3,
    rolePercent: 0.7,
  },
  ensamble_ayudante: {
    roleKey: "ensamble_ayudante",
    label: "Ensamble y limpieza ayudante",
    stage: "ensamble_limpieza",
    stagePercent: 0.3,
    rolePercent: 0.3,
  },
  transporte_maestro: {
    roleKey: "transporte_maestro",
    label: "Transporte maestro",
    stage: "transporte",
    stagePercent: 0.1,
    rolePercent: 0.7,
  },
  transporte_ayudante: {
    roleKey: "transporte_ayudante",
    label: "Transporte ayudante",
    stage: "transporte",
    stagePercent: 0.1,
    rolePercent: 0.3,
  },
  instalacion_maestro: {
    roleKey: "instalacion_maestro",
    label: "Instalacion maestro",
    stage: "instalacion",
    stagePercent: 0.4,
    rolePercent: 0.7,
  },
  instalacion_ayudante: {
    roleKey: "instalacion_ayudante",
    label: "Instalacion ayudante",
    stage: "instalacion",
    stagePercent: 0.4,
    rolePercent: 0.3,
  },
  verificacion: {
    roleKey: "verificacion",
    label: "Verificacion QA",
    stage: "verificacion",
    stagePercent: 0.08,
    rolePercent: 1,
  },
};

export function compensationLabel(roleKey?: string | null) {
  if (!roleKey) return "Compensacion operacional";
  return OPERATIONAL_COMPENSATION_CONFIG[roleKey as OperationalRoleKey]?.label || roleKey;
}

export function estimateOperationalFootage(pieces: OperationalCompensationPiece[] = []) {
  const valid = pieces
    .map((piece) => ({
      width: Number(piece.width_mm || 0),
      height: Number(piece.height_mm || 0),
      quantity: Math.max(1, Number(piece.quantity || 1)),
    }))
    .filter((piece) => piece.width > 0 && piece.height > 0);

  if (!valid.length) {
    return { linearFeet: 1, squareFeet: 1 };
  }

  const maxLinearMm = valid.reduce((max, piece) => Math.max(max, piece.width, piece.height), 0);
  const squareMm = valid.reduce((sum, piece) => sum + piece.width * piece.height * piece.quantity, 0);

  return {
    linearFeet: round2(Math.max(1, maxLinearMm / 304.8)),
    squareFeet: round2(Math.max(1, squareMm / 92903.04)),
  };
}

export function calculateOperationalCompensationAmount(
  roleKey: OperationalRoleKey,
  unitType: CompensationUnitType,
  quantity: number
) {
  const config = OPERATIONAL_COMPENSATION_CONFIG[roleKey];
  const baseRate = OPERATIONAL_COMPENSATION_RATES[unitType];
  return round2(Math.max(0, quantity) * baseRate * config.stagePercent * config.rolePercent);
}

export async function registerOperationalCompensationEvents({
  supabase,
  orderCode,
  moduleName,
  projectName,
  sourceModule,
  sourceId,
  unitType = "pie_lineal",
  pieces = [],
  participants,
  notes,
}: RegisterOperationalCompensationParams) {
  const cleanParticipants = participants
    .map((participant) => ({ ...participant, name: String(participant.name || "").trim() }))
    .filter((participant) => participant.name && OPERATIONAL_COMPENSATION_CONFIG[participant.roleKey]);

  if (!cleanParticipants.length) return { inserted: 0, skipped: 0 };

  const footage = estimateOperationalFootage(pieces);
  const quantity = unitType === "pie_cuadrado" ? footage.squareFeet : footage.linearFeet;
  let inserted = 0;
  let skipped = 0;

  for (const participant of cleanParticipants) {
    const config = OPERATIONAL_COMPENSATION_CONFIG[participant.roleKey];
    const eventSourceId =
      sourceId ||
      `${sourceModule}:${config.stage}:${orderCode}:${moduleName}:${participant.roleKey}:${participant.name}`;

    const existing = await supabase
      .from("operational_compensation_events")
      .select("id")
      .eq("source_id", eventSourceId)
      .maybeSingle();

    if (existing.error && !isMissingOperationalTable(existing.error)) {
      throw existing.error;
    }

    if (existing.data?.id) {
      skipped += 1;
      continue;
    }

    const employee = await findEmployeeByName(supabase, participant.name || "");
    const baseRate = OPERATIONAL_COMPENSATION_RATES[unitType];
    const amount = calculateOperationalCompensationAmount(participant.roleKey, unitType, quantity);

    const { error } = await supabase.from("operational_compensation_events").insert({
      employee_id: employee?.id || null,
      employee_name: employee?.full_name || participant.name,
      department: employee?.department || participant.department || stageDepartment(config.stage),
      position: employee?.position || participant.position || config.label,
      role_key: participant.roleKey,
      order_code: orderCode,
      module_name: moduleName,
      source_module: sourceModule,
      source_id: eventSourceId,
      stage: config.stage,
      unit_type: unitType,
      quantity,
      base_rate: baseRate,
      stage_percent: config.stagePercent,
      role_percent: config.rolePercent,
      amount,
      status: "approved",
      notes: notes || `Compensacion ${config.label} ${orderCode} / ${moduleName}`,
      metadata: {
        project_name: projectName || null,
        estimated_linear_feet: footage.linearFeet,
        estimated_square_feet: footage.squareFeet,
        calculation: `${quantity} x ${baseRate} x ${config.stagePercent} x ${config.rolePercent}`,
      },
    });

    if (error) {
      if (isMissingOperationalTable(error)) return { inserted, skipped };
      throw error;
    }

    inserted += 1;
  }

  return { inserted, skipped };
}

function round2(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function stageDepartment(stage: string) {
  if (stage === "ensamble_limpieza") return "Ensamblado";
  if (stage === "transporte") return "Transporte";
  if (stage === "instalacion") return "Instalacion";
  if (stage === "verificacion") return "Verificacion";
  if (stage === "canteo") return "Canteo";
  return "Produccion";
}

function normalizeName(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function findEmployeeByName(supabase: any, name: string) {
  const clean = name.trim();
  if (!clean) return null;

  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, department, position, status")
    .ilike("full_name", `%${clean}%`)
    .limit(5);

  if (error) return null;

  const target = normalizeName(clean);
  return (
    (data || []).find((employee: any) => normalizeName(employee.full_name) === target) ||
    (data || []).find((employee: any) => normalizeName(employee.full_name).includes(target)) ||
    null
  );
}

function isMissingOperationalTable(error: any) {
  const message = String(error?.message || error || "");
  return (
    message.includes("operational_compensation_events") ||
    message.includes("Could not find") ||
    message.includes("schema cache")
  );
}
