export type CncPostProcessorId =
  | "blue_elephant_ncstudio"
  | "mach3_tap"
  | "generic_grbl";

export type CncCompensationMode = "centerline" | "outside" | "inside";

export type CncRectPiece = {
  id?: string;
  code?: string;
  name: string;
  moduleName?: string;
  sheetIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  thickness: number;
  rotated?: boolean;
};

export type CncDrillPoint = {
  sheetIndex: number;
  x: number;
  y: number;
  depth: number;
  diameter: number;
  note?: string;
  pieceCode?: string;
};

export type CncPostOptions = {
  processorId: CncPostProcessorId;
  origin: "front_left" | "back_left";
  safeZ: number;
  cutDepth: number;
  stepDown: number;
  plungeFeed: number;
  cutFeed: number;
  drillFeed: number;
  spindleRpm: number;
  toolDiameter: number;
  kerfMm: number;
  offsetX: number;
  offsetY: number;
  compensation: CncCompensationMode;
  includeDrills: boolean;
  includeComments: boolean;
};

export type CncPostProcessorPreset = {
  id: CncPostProcessorId;
  label: string;
  extension: "nc" | "tap" | "gcode";
  description: string;
  wrapPercent: boolean;
  spindleLine: (rpm: number) => string;
  programEnd: string[];
};

type CncProgramInput = {
  orderCode: string;
  projectName?: string;
  clientName?: string;
  materialName?: string;
  sheetNumber: number;
  sheetWidth: number;
  sheetHeight: number;
  pieces: CncRectPiece[];
  drills?: CncDrillPoint[];
  options: CncPostOptions;
};

const PRESETS: Record<CncPostProcessorId, CncPostProcessorPreset> = {
  blue_elephant_ncstudio: {
    id: "blue_elephant_ncstudio",
    label: "Blue Elephant / NC Studio",
    extension: "nc",
    description: "Salida .NC compatible con flujo Blue Elephant / NC Studio.",
    wrapPercent: false,
    spindleLine: (rpm) => `M3 S${fmt(rpm, 0)}`,
    programEnd: ["M5", "M30"],
  },
  mach3_tap: {
    id: "mach3_tap",
    label: "Mach3 / TAP",
    extension: "tap",
    description: "Salida .TAP con bloque porcentual para Mach3.",
    wrapPercent: true,
    spindleLine: (rpm) => `S${fmt(rpm, 0)} M3`,
    programEnd: ["M5", "M30"],
  },
  generic_grbl: {
    id: "generic_grbl",
    label: "Generico GRBL",
    extension: "gcode",
    description: "Salida G-Code basica para pruebas controladas.",
    wrapPercent: false,
    spindleLine: (rpm) => `M3 S${fmt(rpm, 0)}`,
    programEnd: ["M5"],
  },
};

export function getCncPostProcessorPresets() {
  return Object.values(PRESETS);
}

export function defaultCncPostOptions(
  processorId: CncPostProcessorId = "blue_elephant_ncstudio"
): CncPostOptions {
  return {
    processorId,
    origin: "front_left",
    safeZ: 15,
    cutDepth: -19.2,
    stepDown: 6,
    plungeFeed: 650,
    cutFeed: 4200,
    drillFeed: 900,
    spindleRpm: 18000,
    toolDiameter: 6,
    kerfMm: 0,
    offsetX: 0,
    offsetY: 0,
    compensation: "outside",
    includeDrills: true,
    includeComments: true,
  };
}

export function generateCncProgram(input: CncProgramInput) {
  const preset = PRESETS[input.options.processorId] || PRESETS.blue_elephant_ncstudio;
  const options = normalizeOptions(input.options);
  const ref = sanitizeFilePart(input.orderCode || `CORTE-${Date.now()}`);
  const lines: string[] = [];

  if (preset.wrapPercent) lines.push("%");

  comment(lines, options, "RD WOOD SYSTEM - CNC POSTPROCESSOR");
  comment(lines, options, `POST: ${preset.label}`);
  comment(lines, options, `ORDEN: ${input.orderCode}`);
  comment(lines, options, `PROYECTO: ${input.projectName || "-"}`);
  comment(lines, options, `CLIENTE: ${input.clientName || "-"}`);
  comment(lines, options, `MATERIAL: ${input.materialName || "Material"}`);
  comment(lines, options, `HOJA: ${input.sheetNumber} - ${input.sheetHeight} x ${input.sheetWidth} mm`);
  comment(
    lines,
    options,
    `COMPENSACION: ${options.compensation} / herramienta ${fmt(options.toolDiameter)} mm / kerf ${fmt(options.kerfMm)} mm / offset ${fmt(options.offsetX)},${fmt(options.offsetY)}`
  );

  lines.push("G21");
  lines.push("G90");
  lines.push("G17");
  lines.push("G40");
  lines.push("G49");
  lines.push("G80");
  lines.push("G54");
  lines.push(preset.spindleLine(options.spindleRpm));
  lines.push(`G0 Z${fmt(options.safeZ)}`);

  input.pieces.forEach((piece, index) => {
    const rect = compensateRect(piece, input.sheetWidth, options);
    const code = piece.code || `PZ-${String(index + 1).padStart(4, "0")}`;

    comment(lines, options, `${code} - ${piece.moduleName || "Modulo"} - ${piece.name}`);
    comment(lines, options, `RECT ${fmt(rect.width, 1)} x ${fmt(rect.height, 1)} mm${piece.rotated ? " - ROTADA" : ""}`);
    lines.push(...cutRectangle(rect.x, rect.y, rect.width, rect.height, options));
  });

  if (options.includeDrills && input.drills?.length) {
    comment(lines, options, "PERFORACIONES");
    input.drills.forEach((drill) => {
      const point = transformPoint(drill.x, drill.y, 0, 0, input.sheetWidth, options);
      comment(
        lines,
        options,
        `${drill.pieceCode || "PZ"} - ${drill.note || "Perforacion"} diam ${fmt(drill.diameter)} profundidad ${fmt(drill.depth)}`
      );
      lines.push(`G0 Z${fmt(options.safeZ)}`);
      lines.push(`G0 X${fmt(point.x)} Y${fmt(point.y)}`);
      lines.push(`G1 Z${fmt(-Math.abs(drill.depth))} F${fmt(options.drillFeed, 0)}`);
      lines.push(`G0 Z${fmt(options.safeZ)}`);
    });
  }

  lines.push(`G0 Z${fmt(options.safeZ)}`);
  lines.push(`G0 X${fmt(options.offsetX)} Y${fmt(options.offsetY)}`);
  lines.push(...preset.programEnd);

  if (preset.wrapPercent) lines.push("%");

  return {
    fileName: `${ref}_hoja_${input.sheetNumber}_${preset.id}.${preset.extension}`,
    content: lines.join("\n"),
    summary: {
      postProcessor: preset.label,
      extension: preset.extension,
      pieces: input.pieces.length,
      drills: options.includeDrills ? input.drills?.length || 0 : 0,
      compensation: options.compensation,
    },
  };
}

function normalizeOptions(options: CncPostOptions): CncPostOptions {
  const base = defaultCncPostOptions(options.processorId);

  return {
    ...base,
    ...options,
    safeZ: positive(options.safeZ, base.safeZ),
    stepDown: positive(options.stepDown, base.stepDown),
    plungeFeed: positive(options.plungeFeed, base.plungeFeed),
    cutFeed: positive(options.cutFeed, base.cutFeed),
    drillFeed: positive(options.drillFeed, base.drillFeed),
    spindleRpm: positive(options.spindleRpm, base.spindleRpm),
    toolDiameter: positive(options.toolDiameter, base.toolDiameter),
    kerfMm: Math.max(0, Number(options.kerfMm) || 0),
    cutDepth: -Math.abs(Number(options.cutDepth) || Math.abs(base.cutDepth)),
    offsetX: Number(options.offsetX) || 0,
    offsetY: Number(options.offsetY) || 0,
  };
}

function cutRectangle(x: number, y: number, width: number, height: number, options: CncPostOptions) {
  const lines: string[] = [];
  const target = Math.abs(options.cutDepth);
  const step = Math.max(0.5, Math.abs(options.stepDown));
  let current = Math.min(step, target);

  lines.push(`G0 Z${fmt(options.safeZ)}`);
  lines.push(`G0 X${fmt(x)} Y${fmt(y)}`);

  while (current <= target + 0.001) {
    const z = -current;

    lines.push(`G1 Z${fmt(z)} F${fmt(options.plungeFeed, 0)}`);
    lines.push(`G1 X${fmt(x + width)} Y${fmt(y)} F${fmt(options.cutFeed, 0)}`);
    lines.push(`G1 X${fmt(x + width)} Y${fmt(y + height)} F${fmt(options.cutFeed, 0)}`);
    lines.push(`G1 X${fmt(x)} Y${fmt(y + height)} F${fmt(options.cutFeed, 0)}`);
    lines.push(`G1 X${fmt(x)} Y${fmt(y)} F${fmt(options.cutFeed, 0)}`);

    if (current >= target) break;
    current = Math.min(current + step, target);
  }

  lines.push(`G0 Z${fmt(options.safeZ)}`);
  return lines;
}

function compensateRect(piece: CncRectPiece, sheetWidth: number, options: CncPostOptions) {
  const radial =
    options.compensation === "centerline"
      ? 0
      : options.toolDiameter / 2 + options.kerfMm / 2;

  const sign = options.compensation === "inside" ? -1 : 1;
  const x = piece.x - radial * sign;
  const y = piece.y - radial * sign;
  const width = Math.max(1, piece.width + radial * 2 * sign);
  const height = Math.max(1, piece.height + radial * 2 * sign);

  return transformPoint(x, y, width, height, sheetWidth, options);
}

function transformPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  sheetWidth: number,
  options: CncPostOptions
) {
  const nextY =
    options.origin === "back_left"
      ? Math.max(0, sheetWidth - y - height)
      : y;

  return {
    x: x + options.offsetX,
    y: nextY + options.offsetY,
    width,
    height,
  };
}

function comment(lines: string[], options: CncPostOptions, value: string) {
  if (!options.includeComments) return;
  lines.push(`(${sanitizeComment(value)})`);
}

function sanitizeComment(value: string) {
  return String(value || "")
    .replace(/[()]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function sanitizeFilePart(value: string) {
  return String(value || "cnc")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function positive(value: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function fmt(value: number, decimals = 3) {
  const parsed = Number(value);
  const safe = Number.isFinite(parsed) ? parsed : 0;
  return safe.toFixed(decimals);
}
