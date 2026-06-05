export type CncLayerId =
  | "CAPA_REFERENCIA"
  | "CAPA_MDF_18"
  | "CAPA_MDF_6"
  | "CAPA_ACRILICO_3"
  | "CAPA_LED_REFERENCIA"
  | "CAPA_TEXTOS"
  | "CAPA_CAD_DECORATIVO";

export type CustomVectorOperation =
  | "no_cortar"
  | "corte_exterior"
  | "corte_interior"
  | "grabado"
  | "perforacion";

export type CustomVectorSourceType = "bitmap" | "svg" | "dxf" | "texto" | "stl";
export type VectorizationMode = "bitmap" | "objects_cnc";
export type CustomVectorRole =
  | "logo_rdss"
  | "texto"
  | "onda_principal"
  | "cad_cocina"
  | "arbol"
  | "referencia"
  | "ruido";

export type CustomVectorPhysicalRole = CustomVectorRole | "detalle_decorativo";

export type CustomVectorMaterial = {
  id: string;
  label: string;
  layer: CncLayerId;
  thicknessMm: number;
  color: string;
  boardWidthMm: number;
  boardHeightMm: number;
};

export type CustomVectorTool = {
  id: string;
  label: string;
  diameterMm: number;
  feedMmMin: number;
  plungeMmMin: number;
  spindleRpm: number;
};

export type CustomVectorBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CustomVectorPath = {
  id: string;
  name: string;
  sourceType: CustomVectorSourceType;
  sourceFileName: string;
  d: string;
  color: string;
  layer: CncLayerId;
  materialId: string;
  operation: CustomVectorOperation;
  toolId: string;
  thicknessMm: number;
  depthMm: number;
  closed: boolean;
  noCut: boolean;
  scaleToMm: number;
  boundsPx: CustomVectorBounds;
  boundsMm: CustomVectorBounds;
  pathLengthMm: number;
  quantity: number;
  vectorRole?: CustomVectorRole;
  filterReason?: string;
  notes?: string;
};

export type CustomVectorPhysicalGroup = {
  id: string;
  key: string;
  label: string;
  role: CustomVectorPhysicalRole;
  materialId: string;
  materialLabel: string;
  layer: CncLayerId;
  thicknessMm: number;
  boundsMm: CustomVectorBounds;
  pathIds: string[];
  paths: CustomVectorPath[];
  quantity: number;
  requiresDivision: boolean;
};

export type NestedVectorPiece = {
  id: string;
  pathId: string;
  copyIndex: number;
  sheetId: string;
  sheetNumber: number;
  materialId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  segmentLabel?: string;
  segmentOffsetX?: number;
  segmentOffsetY?: number;
  path: CustomVectorPath;
  groupId?: string;
  groupKey?: string;
  groupLabel?: string;
  groupRole?: CustomVectorPhysicalRole;
  groupBoundsMm?: CustomVectorBounds;
  pathIds?: string[];
  paths?: CustomVectorPath[];
  requiresDivision?: boolean;
};

export type NestedVectorSheet = {
  id: string;
  materialId: string;
  materialLabel: string;
  thicknessMm: number;
  sheetNumber: number;
  width: number;
  height: number;
  pieces: NestedVectorPiece[];
  usedAreaM2: number;
};

export type NestingOptions = {
  gapMm: number;
  kerfMm: number;
  allowRotate: boolean;
  divideOversize: boolean;
};

export type NestingMaterialSummary = {
  materialId: string;
  materialLabel: string;
  thicknessMm: number;
  sheets: number;
  pieces: number;
  paths: number;
  usedAreaM2: number;
};

export type CncValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type CutSimulationPoint = {
  x: number;
  y: number;
};

export type SimulatedCutSegment = {
  id: string;
  pathId: string;
  pieceId: string;
  sheetNumber: number;
  pathName: string;
  operation: CustomVectorOperation;
  operationLabel: string;
  materialId: string;
  materialLabel: string;
  thicknessMm: number;
  toolId: string;
  toolLabel: string;
  toolDiameterMm: number;
  depthMm: number;
  passNumber: number;
  passTargetDepthMm: number;
  passCount: number;
  order: number;
  lengthMm: number;
  estimatedMinutes: number;
  originalPoints: CutSimulationPoint[];
  compensatedPoints: CutSimulationPoint[];
  removedAreaPoints: CutSimulationPoint[];
};

export type CutSimulationResult = {
  totalLengthMm: number;
  passes: number;
  estimatedMinutes: number;
  warnings: string[];
  simulatedSegments: SimulatedCutSegment[];
  pieces: number;
  trajectories: number;
  materials: string[];
  tools: string[];
};

export type IndustrialVectorFilterOptions = {
  mode: VectorizationMode;
  minPathLengthMm?: number;
  minClosedAreaMm2?: number;
};

export type IndustrialVectorFilterSummary = {
  mode: VectorizationMode;
  kept: number;
  removed: number;
  reasons: Record<string, number>;
  roleCounts: Partial<Record<CustomVectorRole, number>>;
  roleGroups: Partial<Record<CustomVectorRole, number>>;
  expected: Array<{
    role: CustomVectorRole;
    label: string;
    unit: "paths" | "grupos";
    min: number;
    max: number;
    count: number;
    ok: boolean;
  }>;
  totalExpected: {
    min: number;
    max: number;
    ok: boolean;
  };
  warnings: string[];
};

export type IndustrialVectorFilterResult = {
  kept: CustomVectorPath[];
  removed: CustomVectorPath[];
  summary: IndustrialVectorFilterSummary;
};

export const RDSS_TEMPLATE_WIDTH_MM = 4400;
export const RDSS_TEMPLATE_HEIGHT_MM = 2900;
export const BOARD_WIDTH_MM = 2440;
export const BOARD_HEIGHT_MM = 1220;
export const DEFAULT_CUT_PASS_DEPTH_MM = 6;

const CNC_ALLOWED_ROLES: CustomVectorRole[] = ["logo_rdss", "texto", "onda_principal", "cad_cocina", "arbol"];
const CNC_TOTAL_EXPECTED = { min: 50, max: 150 };
const CNC_OBJECT_EXPECTATIONS: IndustrialVectorFilterSummary["expected"] = [
  { role: "onda_principal", label: "Ondas nogal", unit: "paths", min: 7, max: 15, count: 0, ok: false },
  { role: "logo_rdss", label: "Logo RDSS", unit: "paths", min: 4, max: 10, count: 0, ok: false },
  { role: "texto", label: "Textos corporativos", unit: "grupos", min: 4, max: 4, count: 0, ok: false },
  { role: "cad_cocina", label: "Plano CAD cocina", unit: "paths", min: 20, max: 50, count: 0, ok: false },
  { role: "arbol", label: "Arbol decorativo", unit: "paths", min: 0, max: 20, count: 0, ok: true },
];
const CNC_ROLE_MAX_PATHS: Partial<Record<CustomVectorRole, number>> = {
  onda_principal: 15,
  logo_rdss: 10,
  texto: 40,
  cad_cocina: 50,
  arbol: 20,
};

export const CNC_LAYERS: Array<{ id: CncLayerId; label: string; color: string }> = [
  { id: "CAPA_REFERENCIA", label: "Referencia", color: "#64748b" },
  { id: "CAPA_MDF_18", label: "MDF 18 mm", color: "#b45309" },
  { id: "CAPA_MDF_6", label: "MDF 6 mm", color: "#334155" },
  { id: "CAPA_ACRILICO_3", label: "Acrilico 3 mm", color: "#facc15" },
  { id: "CAPA_LED_REFERENCIA", label: "LED referencia", color: "#38bdf8" },
  { id: "CAPA_TEXTOS", label: "Textos a curvas", color: "#a78bfa" },
  { id: "CAPA_CAD_DECORATIVO", label: "CAD decorativo", color: "#22c55e" },
];

export const RDSS_EVOLUTION_MATERIALS: CustomVectorMaterial[] = [
  {
    id: "mdf_nogal_18",
    label: "MDF Nogal 18 mm",
    layer: "CAPA_MDF_18",
    thicknessMm: 18,
    color: "#9a5b24",
    boardWidthMm: BOARD_WIDTH_MM,
    boardHeightMm: BOARD_HEIGHT_MM,
  },
  {
    id: "mdf_negro_18",
    label: "MDF Negro 18 mm",
    layer: "CAPA_MDF_18",
    thicknessMm: 18,
    color: "#101318",
    boardWidthMm: BOARD_WIDTH_MM,
    boardHeightMm: BOARD_HEIGHT_MM,
  },
  {
    id: "mdf_negro_6",
    label: "MDF Negro 6 mm",
    layer: "CAPA_MDF_6",
    thicknessMm: 6,
    color: "#1f2937",
    boardWidthMm: BOARD_WIDTH_MM,
    boardHeightMm: BOARD_HEIGHT_MM,
  },
  {
    id: "acrilico_espejo_dorado_3",
    label: "Acrilico Espejo Dorado 3 mm",
    layer: "CAPA_ACRILICO_3",
    thicknessMm: 3,
    color: "#f7c948",
    boardWidthMm: BOARD_WIDTH_MM,
    boardHeightMm: BOARD_HEIGHT_MM,
  },
];

export const CNC_TOOLS: CustomVectorTool[] = [
  { id: "fresa_compresion_6", label: "Fresa compresion 6 mm", diameterMm: 6, feedMmMin: 4200, plungeMmMin: 650, spindleRpm: 18000 },
  { id: "fresa_compresion_4", label: "Fresa compresion 4 mm", diameterMm: 4, feedMmMin: 3600, plungeMmMin: 600, spindleRpm: 18000 },
  { id: "fresa_acrilico_3", label: "Fresa acrilico 3 mm", diameterMm: 3, feedMmMin: 2200, plungeMmMin: 450, spindleRpm: 15000 },
  { id: "fresa_grabado_v", label: "V-bit grabado 60 grados", diameterMm: 3, feedMmMin: 1800, plungeMmMin: 350, spindleRpm: 16000 },
  { id: "broca_5", label: "Broca madera 5 mm", diameterMm: 5, feedMmMin: 900, plungeMmMin: 500, spindleRpm: 12000 },
  { id: "broca_8", label: "Broca madera 8 mm", diameterMm: 8, feedMmMin: 800, plungeMmMin: 450, spindleRpm: 12000 },
];

export function uid(prefix = "VEC") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function moneyNumber(value: number, decimals = 2) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toFixed(decimals);
}

export function sanitizeFileName(value: string) {
  return String(value || "cnc")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);
}

export function materialById(id: string) {
  return RDSS_EVOLUTION_MATERIALS.find((item) => item.id === id) || RDSS_EVOLUTION_MATERIALS[0];
}

export function layerById(id: CncLayerId) {
  return CNC_LAYERS.find((item) => item.id === id) || CNC_LAYERS[0];
}

export function toolById(id: string) {
  return CNC_TOOLS.find((tool) => tool.id === id) || CNC_TOOLS[0];
}

export function operationLabel(operation: CustomVectorOperation) {
  const labels: Record<CustomVectorOperation, string> = {
    no_cortar: "No cortar / referencia",
    corte_exterior: "Corte exterior",
    corte_interior: "Corte interior",
    grabado: "Grabado",
    perforacion: "Perforacion",
  };
  return labels[operation];
}

export function suggestTool(materialId: string, operation: CustomVectorOperation, thicknessMm: number) {
  const material = materialById(materialId);
  if (operation === "perforacion") return thicknessMm >= 18 ? "broca_8" : "broca_5";
  if (operation === "grabado") return "fresa_grabado_v";
  if (material.id.includes("acrilico")) return "fresa_acrilico_3";
  if (thicknessMm <= 6) return "fresa_compresion_4";
  return "fresa_compresion_6";
}

export function defaultDepthFor(operation: CustomVectorOperation, thicknessMm: number) {
  if (operation === "no_cortar") return 0;
  if (operation === "grabado") return Math.min(1.5, Math.max(0.5, thicknessMm / 3));
  if (operation === "perforacion") return Math.min(thicknessMm, Math.max(3, thicknessMm * 0.8));
  return Math.min(thicknessMm, thicknessMm);
}

export function defaultLayerForMaterial(materialId: string): CncLayerId {
  return materialById(materialId).layer;
}

export function createSvgPathRecords(input: {
  svgText: string;
  sourceType: CustomVectorSourceType;
  sourceFileName: string;
  scaleToMm: number;
  materialId: string;
  operation: CustomVectorOperation;
  quantity?: number;
}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input.svgText, "image/svg+xml");
  const records: CustomVectorPath[] = [];
  const material = materialById(input.materialId);
  const operation = input.operation;
  const toolId = suggestTool(material.id, operation, material.thicknessMm);

  doc.querySelectorAll("path, polygon, polyline, rect, circle, ellipse, line").forEach((node, index) => {
    const d = svgNodeToPath(node);
    if (!d) return;

    const points = svgPathToPoints(d);
    const boundsPx = boundsFromPoints(points);
    if (!boundsPx || boundsPx.width <= 0.5 || boundsPx.height <= 0.5) return;

    const closed = isPathClosed(d, node.tagName.toLowerCase());
    const pathLengthMm = estimateLength(points) * input.scaleToMm;
    const boundsMm = scaleBounds(boundsPx, input.scaleToMm);
    const color = getNodeColor(node) || layerById(material.layer).color;
    const nodeLabel = getNodeLabel(node);
    const vectorRole = inferVectorRoleFromText(`${input.sourceFileName} ${nodeLabel}`);

    records.push({
      id: uid("PATH"),
      name: nodeLabel ? `${input.sourceFileName} - ${nodeLabel}` : `${input.sourceFileName} #${index + 1}`,
      sourceType: input.sourceType,
      sourceFileName: input.sourceFileName,
      d,
      color,
      layer: material.layer,
      materialId: material.id,
      operation,
      toolId,
      thicknessMm: material.thicknessMm,
      depthMm: defaultDepthFor(operation, material.thicknessMm),
      closed,
      noCut: operation === "no_cortar",
      scaleToMm: input.scaleToMm,
      boundsPx,
      boundsMm,
      pathLengthMm,
      quantity: Math.max(1, input.quantity || 1),
      vectorRole,
      notes: nodeLabel ? `Etiqueta vectorial: ${nodeLabel}` : undefined,
    });
  });

  return records;
}

export function createDxfPathRecords(input: {
  dxfText: string;
  sourceFileName: string;
  scaleToMm: number;
  materialId: string;
  operation: CustomVectorOperation;
  quantity?: number;
}) {
  const lines = input.dxfText.split(/\r?\n/);
  const paths: string[] = [];
  const material = materialById(input.materialId);
  const toolId = suggestTool(material.id, input.operation, material.thicknessMm);

  for (let i = 0; i < lines.length; i += 1) {
    const entity = lines[i]?.trim().toUpperCase();
    if (entity === "LINE") {
      const values: Record<string, number> = {};
      for (let j = i + 1; j < Math.min(lines.length, i + 28); j += 2) {
        const code = lines[j]?.trim();
        const val = Number(lines[j + 1]?.trim());
        if (code && Number.isFinite(val)) values[code] = val;
      }
      if (Number.isFinite(values["10"]) && Number.isFinite(values["20"]) && Number.isFinite(values["11"]) && Number.isFinite(values["21"])) {
        paths.push(`M ${values["10"]} ${values["20"]} L ${values["11"]} ${values["21"]}`);
      }
    }
  }

  if (!paths.length) {
    paths.push(`M 0 0 L 420 0 L 420 280 L 0 280 Z`);
  }

  return paths.map((d, index) => {
    const points = svgPathToPoints(d);
    const boundsPx = boundsFromPoints(points) || { x: 0, y: 0, width: 1, height: 1 };
    const boundsMm = scaleBounds(boundsPx, input.scaleToMm);
    const vectorRole = inferVectorRoleFromText(input.sourceFileName);
    return {
      id: uid("DXF"),
      name: `${input.sourceFileName} #${index + 1}`,
      sourceType: "dxf" as CustomVectorSourceType,
      sourceFileName: input.sourceFileName,
      d,
      color: layerById(material.layer).color,
      layer: material.layer,
      materialId: material.id,
      operation: input.operation,
      toolId,
      thicknessMm: material.thicknessMm,
      depthMm: defaultDepthFor(input.operation, material.thicknessMm),
      closed: isPathClosed(d, "path"),
      noCut: input.operation === "no_cortar",
      scaleToMm: input.scaleToMm,
      boundsPx,
      boundsMm,
      pathLengthMm: estimateLength(points) * input.scaleToMm,
      quantity: Math.max(1, input.quantity || 1),
      vectorRole,
    };
  });
}

type StlVertex = {
  x: number;
  y: number;
  z: number;
};

type StlPoint2D = {
  x: number;
  y: number;
};

function stlNumber(value: number) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3)).toString();
}

function readBinaryStlMeta(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 84) return null;

  const triangleCount = view.getUint32(80, true);
  const expectedLength = 84 + triangleCount * 50;
  if (!triangleCount || expectedLength > view.byteLength) return null;
  return { view, triangleCount, expectedLength };
}

function parseAsciiStlVertices(buffer: ArrayBuffer) {
  const text = new TextDecoder("utf-8").decode(buffer);
  const number = "[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?";
  const vertexRegex = new RegExp(`vertex\\s+(${number})\\s+(${number})\\s+(${number})`, "gi");
  const vertices: StlVertex[] = [];
  let match: RegExpExecArray | null;

  while ((match = vertexRegex.exec(text))) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    const z = Number(match[3]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      vertices.push({ x, y, z });
    }
  }

  return vertices;
}

function sampledNormalizedStlPoints(samples: StlVertex[], minX: number, minY: number, maxPoints = 32000) {
  const pointsByKey = new Map<string, StlPoint2D>();

  samples.forEach((vertex) => {
    const x = vertex.x - minX;
    const y = vertex.y - minY;
    const key = `${Math.round(x * 100)}:${Math.round(y * 100)}`;
    if (!pointsByKey.has(key)) {
      if (pointsByKey.size >= maxPoints) return;
      pointsByKey.set(key, { x, y });
    }
  });

  return Array.from(pointsByKey.values());
}

function analyzeBinaryStlProjection(buffer: ArrayBuffer) {
  const meta = readBinaryStlMeta(buffer);
  if (!meta) return null;

  const { view, triangleCount } = meta;
  const targetSamples = 26000;
  const sampleStride = Math.max(1, Math.ceil((triangleCount * 3) / targetSamples));
  const samples: StlVertex[] = [];
  let seenVertices = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const triangleOffset = 84 + triangleIndex * 50;
    for (let vertexIndex = 0; vertexIndex < 3; vertexIndex += 1) {
      const offset = triangleOffset + 12 + vertexIndex * 12;
      const x = view.getFloat32(offset, true);
      const y = view.getFloat32(offset + 4, true);
      const z = view.getFloat32(offset + 8, true);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        seenVertices += 1;
        continue;
      }

      let touchedBounds = false;
      if (x < minX) {
        minX = x;
        touchedBounds = true;
      }
      if (y < minY) {
        minY = y;
        touchedBounds = true;
      }
      if (z < minZ) {
        minZ = z;
        touchedBounds = true;
      }
      if (x > maxX) {
        maxX = x;
        touchedBounds = true;
      }
      if (y > maxY) {
        maxY = y;
        touchedBounds = true;
      }
      if (z > maxZ) {
        maxZ = z;
        touchedBounds = true;
      }

      if (touchedBounds || seenVertices % sampleStride === 0) {
        samples.push({ x, y, z });
      }
      seenVertices += 1;
    }
  }

  if (![minX, minY, minZ, maxX, maxY, maxZ].every(Number.isFinite)) return null;

  return {
    points: sampledNormalizedStlPoints(samples, minX, minY),
    bounds3d: { width: maxX - minX, height: maxY - minY, depth: maxZ - minZ },
    triangleCount,
    sampled: sampleStride > 1,
  };
}

function analyzeStlProjection(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const binaryExpectedLength = view.byteLength >= 84 ? 84 + view.getUint32(80, true) * 50 : 0;
  const header = view.byteLength
    ? new TextDecoder("utf-8").decode(buffer.slice(0, Math.min(80, view.byteLength))).trim().toLowerCase()
    : "";
  const looksAscii = header.startsWith("solid");

  if (!looksAscii && binaryExpectedLength >= 84 && binaryExpectedLength <= view.byteLength) {
    const binaryAnalysis = analyzeBinaryStlProjection(buffer);
    if (binaryAnalysis?.points.length) return binaryAnalysis;
  }

  const asciiVertices = parseAsciiStlVertices(buffer);
  if (asciiVertices.length) {
    const { points, bounds3d } = uniqueNormalizedStlPoints(asciiVertices);
    return { points, bounds3d, triangleCount: Math.floor(asciiVertices.length / 3), sampled: false };
  }

  return analyzeBinaryStlProjection(buffer);
}

function uniqueNormalizedStlPoints(vertices: StlVertex[]) {
  if (!vertices.length) return { points: [] as StlPoint2D[], bounds3d: { width: 0, height: 0, depth: 0 } };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  vertices.forEach((vertex) => {
    if (vertex.x < minX) minX = vertex.x;
    if (vertex.y < minY) minY = vertex.y;
    if (vertex.z < minZ) minZ = vertex.z;
    if (vertex.x > maxX) maxX = vertex.x;
    if (vertex.y > maxY) maxY = vertex.y;
    if (vertex.z > maxZ) maxZ = vertex.z;
  });

  if (![minX, minY, minZ, maxX, maxY, maxZ].every(Number.isFinite)) {
    return { points: [] as StlPoint2D[], bounds3d: { width: 0, height: 0, depth: 0 } };
  }

  const pointsByKey = new Map<string, StlPoint2D>();

  vertices.forEach((vertex) => {
    const x = vertex.x - minX;
    const y = vertex.y - minY;
    const key = `${Math.round(x * 100)}:${Math.round(y * 100)}`;
    if (!pointsByKey.has(key)) pointsByKey.set(key, { x, y });
  });

  return {
    points: Array.from(pointsByKey.values()),
    bounds3d: {
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
      depth: Math.max(0, maxZ - minZ),
    },
  };
}

function convexHull(points: StlPoint2D[]) {
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const unique = sorted.filter((point, index) => {
    const previous = sorted[index - 1];
    return !previous || point.x !== previous.x || point.y !== previous.y;
  });

  if (unique.length <= 3) return unique;

  const cross = (origin: StlPoint2D, a: StlPoint2D, b: StlPoint2D) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);

  const lower: StlPoint2D[] = [];
  unique.forEach((point) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  });

  const upper: StlPoint2D[] = [];
  [...unique].reverse().forEach((point) => {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  });

  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function reduceHullPoints(points: StlPoint2D[], maxPoints = 180) {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, index) => index % step === 0);
}

function rectangleFromBounds(bounds: CustomVectorBounds) {
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + width, y: bounds.y },
    { x: bounds.x + width, y: bounds.y + height },
    { x: bounds.x, y: bounds.y + height },
  ];
}

function pathFromPoints(points: StlPoint2D[]) {
  const [first, ...rest] = points;
  if (!first) return "";
  return [`M ${stlNumber(first.x)} ${stlNumber(first.y)}`, ...rest.map((point) => `L ${stlNumber(point.x)} ${stlNumber(point.y)}`), "Z"].join(" ");
}

export function createStlProjectionRecords(input: {
  stlBuffer: ArrayBuffer;
  sourceFileName: string;
  scaleToMm: number;
  materialId: string;
  operation: CustomVectorOperation;
  quantity?: number;
}) {
  const stlAnalysis = analyzeStlProjection(input.stlBuffer);
  if (!stlAnalysis || stlAnalysis.points.length < 3) {
    throw new Error("El STL no contiene triangulos validos para proyectar a CNC.");
  }

  const material = materialById(input.materialId);
  const scaleToMm = Number.isFinite(input.scaleToMm) && input.scaleToMm > 0 ? input.scaleToMm : 1;
  const toolId = suggestTool(material.id, input.operation, material.thicknessMm);
  const { points: normalizedPoints, bounds3d } = stlAnalysis;
  const rawBounds = boundsFromPoints(normalizedPoints) || { x: 0, y: 0, width: 1, height: 1 };
  const hull = reduceHullPoints(convexHull(normalizedPoints));
  const hullPoints = hull.length >= 3 ? hull : rectangleFromBounds(rawBounds);
  const closedPoints = [...hullPoints, hullPoints[0]];
  const boundsPx = boundsFromPoints(hullPoints) || rawBounds;
  const boundsMm = scaleBounds(boundsPx, scaleToMm);
  const d = pathFromPoints(hullPoints);
  const stlDimensions = `${stlNumber(bounds3d.width * scaleToMm)} x ${stlNumber(bounds3d.height * scaleToMm)} x ${stlNumber(
    bounds3d.depth * scaleToMm
  )} mm`;

  return [
    {
      id: uid("STL"),
      name: `${input.sourceFileName} - proyeccion XY`,
      sourceType: "stl" as CustomVectorSourceType,
      sourceFileName: input.sourceFileName,
      d,
      color: material.color || layerById(material.layer).color,
      layer: material.layer,
      materialId: material.id,
      operation: input.operation,
      toolId,
      thicknessMm: material.thicknessMm,
      depthMm: defaultDepthFor(input.operation, material.thicknessMm),
      closed: true,
      noCut: input.operation === "no_cortar",
      scaleToMm,
      boundsPx,
      boundsMm,
      pathLengthMm: estimateLength(closedPoints) * scaleToMm,
      quantity: Math.max(1, input.quantity || 1),
      vectorRole: "cad_cocina" as CustomVectorRole,
      notes: `STL proyectado a contorno XY. Dimensiones aproximadas ${stlDimensions}. ${
        stlAnalysis.sampled ? `Archivo pesado: contorno calculado con muestra segura de ${stlAnalysis.triangleCount.toLocaleString("es-DO")} triangulos. ` : ""
      }Revisar escala, material y trayectoria antes de generar NC; no es relieve 3D.`,
    },
  ] satisfies CustomVectorPath[];
}

export function svgPathToPoints(d: string, curveSteps = 12) {
  const tokens = String(d || "").match(/[a-zA-Z]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/g) || [];
  const points: Array<{ x: number; y: number }> = [];
  let i = 0;
  let command = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  const hasNumber = () => i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i]);
  const nextNumber = () => Number(tokens[i++]);

  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++];
    const relative = command === command.toLowerCase();
    const cmd = command.toUpperCase();

    if (cmd === "M") {
      while (hasNumber()) {
        const nx = nextNumber();
        const ny = nextNumber();
        x = relative ? x + nx : nx;
        y = relative ? y + ny : ny;
        startX = x;
        startY = y;
        points.push({ x, y });
        command = relative ? "l" : "L";
        break;
      }
      continue;
    }

    if (cmd === "L") {
      while (hasNumber()) {
        const nx = nextNumber();
        const ny = nextNumber();
        x = relative ? x + nx : nx;
        y = relative ? y + ny : ny;
        points.push({ x, y });
      }
      continue;
    }

    if (cmd === "H") {
      while (hasNumber()) {
        const nx = nextNumber();
        x = relative ? x + nx : nx;
        points.push({ x, y });
      }
      continue;
    }

    if (cmd === "V") {
      while (hasNumber()) {
        const ny = nextNumber();
        y = relative ? y + ny : ny;
        points.push({ x, y });
      }
      continue;
    }

    if (cmd === "C") {
      while (hasNumber()) {
        const x1 = relative ? x + nextNumber() : nextNumber();
        const y1 = relative ? y + nextNumber() : nextNumber();
        const x2 = relative ? x + nextNumber() : nextNumber();
        const y2 = relative ? y + nextNumber() : nextNumber();
        const x3 = relative ? x + nextNumber() : nextNumber();
        const y3 = relative ? y + nextNumber() : nextNumber();
        const sx = x;
        const sy = y;
        for (let step = 1; step <= curveSteps; step += 1) {
          const t = step / curveSteps;
          const mt = 1 - t;
          points.push({
            x: mt ** 3 * sx + 3 * mt ** 2 * t * x1 + 3 * mt * t ** 2 * x2 + t ** 3 * x3,
            y: mt ** 3 * sy + 3 * mt ** 2 * t * y1 + 3 * mt * t ** 2 * y2 + t ** 3 * y3,
          });
        }
        x = x3;
        y = y3;
      }
      continue;
    }

    if (cmd === "Q") {
      while (hasNumber()) {
        const x1 = relative ? x + nextNumber() : nextNumber();
        const y1 = relative ? y + nextNumber() : nextNumber();
        const x2 = relative ? x + nextNumber() : nextNumber();
        const y2 = relative ? y + nextNumber() : nextNumber();
        const sx = x;
        const sy = y;
        for (let step = 1; step <= curveSteps; step += 1) {
          const t = step / curveSteps;
          const mt = 1 - t;
          points.push({
            x: mt ** 2 * sx + 2 * mt * t * x1 + t ** 2 * x2,
            y: mt ** 2 * sy + 2 * mt * t * y1 + t ** 2 * y2,
          });
        }
        x = x2;
        y = y2;
      }
      continue;
    }

    if (cmd === "A") {
      while (hasNumber()) {
        i += 5;
        const nx = nextNumber();
        const ny = nextNumber();
        x = relative ? x + nx : nx;
        y = relative ? y + ny : ny;
        points.push({ x, y });
      }
      continue;
    }

    if (cmd === "Z") {
      x = startX;
      y = startY;
      points.push({ x, y });
      continue;
    }

    i += 1;
  }

  return points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function boundsFromPoints(points: Array<{ x: number; y: number }> | null | undefined) {
  if (!points?.length) return null;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  points.forEach((point) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  });

  if (![minX, maxX, minY, maxY].every(Number.isFinite)) return null;

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

export function scaleBounds(bounds: CustomVectorBounds, scale: number) {
  return {
    x: bounds.x * scale,
    y: bounds.y * scale,
    width: bounds.width * scale,
    height: bounds.height * scale,
  };
}

export function estimateLength(points: Array<{ x: number; y: number }>) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

function polygonArea(points: Array<{ x: number; y: number }>) {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area / 2);
}

export function isPathClosed(d: string, tagName = "path") {
  if (/^(polygon|rect|circle|ellipse)$/i.test(tagName)) return true;
  return /z\s*$/i.test(String(d).trim()) || /\bz\b/i.test(String(d));
}

export function closedPathAreaMm2(path: CustomVectorPath) {
  if (!path.closed) return 0;
  const points = svgPathToPoints(path.d);
  const areaPx2 = polygonArea(points);
  return areaPx2 * path.scaleToMm * path.scaleToMm;
}

export function filterIndustrialVectorPaths(paths: CustomVectorPath[], options: IndustrialVectorFilterOptions): IndustrialVectorFilterResult {
  const minPathLengthMm = options.minPathLengthMm ?? 20;
  const minClosedAreaMm2 = options.minClosedAreaMm2 ?? 100;
  const reasons: Record<string, number> = {};

  if (options.mode === "bitmap") {
    const kept = paths.map((path) => ({
      ...path,
      vectorRole: path.vectorRole || inferVectorRoleFromText(`${path.sourceFileName} ${path.name} ${path.notes || ""}`),
    }));
    return {
      kept,
      removed: [],
      summary: buildIndustrialFilterSummary(options.mode, kept, [], reasons),
    };
  }

  const removed: CustomVectorPath[] = [];
  const groupedCandidates = new Map<CustomVectorRole, Array<{ path: CustomVectorPath; score: number; index: number }>>();

  paths.forEach((path, index) => {
    const roleText = `${path.sourceFileName} ${path.name} ${path.notes || ""}`;
    const vectorRole = path.vectorRole || inferVectorRoleFromText(roleText);
    const enriched = { ...path, vectorRole };
    const explicitAllowed = isAllowedCncRole(vectorRole);
    const areaMm2 = closedPathAreaMm2(enriched);
    let reason = "";

    if (vectorRole === "ruido" || vectorRole === "referencia") {
      reason = "objeto_prohibido";
    } else if (!explicitAllowed && enriched.pathLengthMm < minPathLengthMm) {
      reason = "menor_20mm";
    } else if (!explicitAllowed && enriched.closed && areaMm2 > 0 && areaMm2 < minClosedAreaMm2) {
      reason = "area_menor_100mm2";
    } else {
      reason = detectForbiddenCncObject(enriched, areaMm2);
    }

    if (reason) {
      reasons[reason] = (reasons[reason] || 0) + 1;
      removed.push({ ...enriched, filterReason: reason });
      return;
    }

    const detectedRole = explicitAllowed ? vectorRole : classifyCncObjectPath(enriched, areaMm2);
    if (!isAllowedCncRole(detectedRole)) {
      const rejectReason = "objeto_no_permitido";
      reasons[rejectReason] = (reasons[rejectReason] || 0) + 1;
      removed.push({ ...enriched, filterReason: rejectReason });
      return;
    }

    const finalPath = { ...enriched, vectorRole: detectedRole };
    const candidates = groupedCandidates.get(detectedRole) || [];
    candidates.push({
      path: finalPath,
      score: scoreCncObjectPath(finalPath, detectedRole, areaMm2),
      index,
    });
    groupedCandidates.set(detectedRole, candidates);
  });

  const keptItems: Array<{ path: CustomVectorPath; index: number }> = [];
  CNC_ALLOWED_ROLES.forEach((role) => {
    const limit = CNC_ROLE_MAX_PATHS[role] || Number.MAX_SAFE_INTEGER;
    const candidates = (groupedCandidates.get(role) || []).sort((a, b) => b.score - a.score);
    candidates.forEach((candidate, rank) => {
      if (rank < limit) {
        keptItems.push({ path: candidate.path, index: candidate.index });
        return;
      }
      const reason = `excede_rango_${role}`;
      reasons[reason] = (reasons[reason] || 0) + 1;
      removed.push({ ...candidate.path, filterReason: reason });
    });
  });

  const kept = keptItems.sort((a, b) => a.index - b.index).map((item) => item.path);

  return {
    kept,
    removed,
    summary: buildIndustrialFilterSummary(options.mode, kept, removed, reasons),
  };
}

function inferVectorRoleFromText(value: string): CustomVectorRole | undefined {
  const text = normalizeVectorText(value);

  if (/\b(sombra|shadow|reflejo|reflection|led|light|lighting|iluminacion|ranura|groove|piso|floor|pared|wall|texture|textura|noise|ruido)\b/.test(text)) {
    return "ruido";
  }
  if (/\b(referencia|reference|background|fondo|guide|guia)\b/.test(text)) return "referencia";
  if (/\b(rdss|rd\s*wood|logo|marca)\b/.test(text)) return "logo_rdss";
  if (/\b(texto|text|letra|letters?|font|typography|tipografia|corporativo|corporativa)\b/.test(text)) return "texto";
  if (/\b(onda|ondas|nogal|wave|curva principal|swoosh)\b/.test(text)) return "onda_principal";
  if (/\b(cad|cocina|kitchen|plano|layout|alzado|modulo)\b/.test(text)) return "cad_cocina";
  if (/\b(arbol|tree|palm|palma)\b/.test(text)) return "arbol";
  return undefined;
}

function normalizeVectorText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildIndustrialFilterSummary(
  mode: VectorizationMode,
  kept: CustomVectorPath[],
  removed: CustomVectorPath[],
  reasons: Record<string, number>
): IndustrialVectorFilterSummary {
  const roleCounts: Partial<Record<CustomVectorRole, number>> = {};
  kept.forEach((path) => {
    if (!path.vectorRole) return;
    roleCounts[path.vectorRole] = (roleCounts[path.vectorRole] || 0) + 1;
  });

  const roleGroups: Partial<Record<CustomVectorRole, number>> = {
    texto: estimateTextGroups(kept.filter((path) => path.vectorRole === "texto")),
  };

  const expected = CNC_OBJECT_EXPECTATIONS.map((rule) => {
    const count = rule.unit === "grupos" ? roleGroups[rule.role] || 0 : roleCounts[rule.role] || 0;
    return {
      ...rule,
      count,
      ok: count >= rule.min && count <= rule.max,
    };
  });

  const totalExpected = {
    ...CNC_TOTAL_EXPECTED,
    ok: mode === "bitmap" || (kept.length >= CNC_TOTAL_EXPECTED.min && kept.length <= CNC_TOTAL_EXPECTED.max),
  };
  const warnings: string[] = [];

  if (mode === "objects_cnc") {
    expected.forEach((item) => {
      if (!item.ok) warnings.push(`${item.label}: esperado ${item.min}-${item.max} ${item.unit}, detectado ${item.count}.`);
    });
    if (!totalExpected.ok) warnings.push(`Total esperado ${CNC_TOTAL_EXPECTED.min}-${CNC_TOTAL_EXPECTED.max} paths; detectado ${kept.length}.`);
  }

  return {
    mode,
    kept: kept.length,
    removed: removed.length,
    reasons,
    roleCounts,
    roleGroups,
    expected,
    totalExpected,
    warnings,
  };
}

function estimateTextGroups(paths: CustomVectorPath[]) {
  if (!paths.length) return 0;

  const explicitGroups = new Set<string>();
  paths.forEach((path) => {
    const text = normalizeVectorText(`${path.sourceFileName} ${path.name} ${path.notes || ""}`);
    const match = text.match(/\b(grupo|group|bloque|texto)[\s_-]*(\d+|[a-d])\b/);
    if (match) explicitGroups.add(match[2]);
  });
  if (explicitGroups.size) return Math.min(4, explicitGroups.size);

  const yBands = new Set(paths.map((path) => Math.round(path.boundsMm.y / 180)));
  return Math.max(1, Math.min(4, yBands.size));
}

function isAllowedCncRole(role: CustomVectorRole | undefined): role is CustomVectorRole {
  return !!role && CNC_ALLOWED_ROLES.includes(role);
}

function classifyCncObjectPath(path: CustomVectorPath, areaMm2: number): CustomVectorRole | undefined {
  const textRole = inferVectorRoleFromText(`${path.sourceFileName} ${path.name} ${path.notes || ""}`);
  if (isAllowedCncRole(textRole)) return textRole;

  if (path.sourceType === "texto" || path.layer === "CAPA_TEXTOS") return "texto";
  if (path.layer === "CAPA_CAD_DECORATIVO") return "cad_cocina";

  const profile = colorProfile(path.color);
  const boundsArea = path.boundsMm.width * path.boundsMm.height;
  const minSide = Math.min(path.boundsMm.width, path.boundsMm.height);
  const maxSide = Math.max(path.boundsMm.width, path.boundsMm.height);
  const aspectRatio =
    minSide > 0 ? maxSide / minSide : 999;

  if (!profile) return undefined;

  const darkOrSaturated = profile.lightness < 0.55 || profile.saturation > 0.18;
  const textLike =
    path.closed &&
    darkOrSaturated &&
    path.boundsMm.width >= 3 &&
    path.boundsMm.height >= 3 &&
    path.boundsMm.width <= 260 &&
    path.boundsMm.height <= 260 &&
    areaMm2 < 16000 &&
    path.pathLengthMm < 1600;
  if (textLike) return "texto";

  const logoLike =
    path.closed &&
    darkOrSaturated &&
    boundsArea >= 80 &&
    boundsArea <= 60000 &&
    path.boundsMm.width <= 520 &&
    path.boundsMm.height <= 520 &&
    path.pathLengthMm >= 80;
  if (logoLike && profile.saturation >= 0.16) return "logo_rdss";

  const warmWood =
    profile.saturation >= 0.12 &&
    profile.lightness >= 0.18 &&
    profile.lightness <= 0.78;
  const organicWave = warmWood && maxSide >= 180 && aspectRatio >= 2.2 && path.pathLengthMm >= 320;
  if (organicWave) return "onda_principal";

  const cadLike =
    (!path.closed && path.pathLengthMm >= 80) ||
    aspectRatio >= 8 ||
    (path.closed && boundsArea >= 1000 && profile.saturation <= 0.22 && path.pathLengthMm >= 160);
  if (cadLike) return "cad_cocina";

  const treeLike =
    path.pathLengthMm >= 160 &&
    path.boundsMm.height >= 80 &&
    path.boundsMm.width >= 35 &&
    profile.saturation >= 0.16 &&
    profile.lightness > 0.12;
  if (treeLike) return "arbol";

  return undefined;
}

function scoreCncObjectPath(path: CustomVectorPath, role: CustomVectorRole, areaMm2: number) {
  const profile = colorProfile(path.color);
  const boundsArea = path.boundsMm.width * path.boundsMm.height;
  const minSide = Math.min(path.boundsMm.width, path.boundsMm.height);
  const maxSide = Math.max(path.boundsMm.width, path.boundsMm.height);
  const aspectRatio = minSide > 0 ? maxSide / minSide : 999;
  let score = path.pathLengthMm + Math.sqrt(Math.max(areaMm2, boundsArea, 1));

  if (role === "onda_principal") score += aspectRatio * 120 + (profile?.saturation || 0) * 180;
  if (role === "logo_rdss") score += (profile?.saturation || 0) * 220 + (path.closed ? 120 : 0);
  if (role === "texto") score += path.closed ? 80 : 40;
  if (role === "cad_cocina") score += path.closed ? 30 : 140;
  if (role === "arbol") score += path.boundsMm.height * 0.8;

  return score;
}

function detectForbiddenCncObject(path: CustomVectorPath, areaMm2: number) {
  const text = normalizeVectorText(`${path.sourceFileName} ${path.name} ${path.notes || ""}`);
  if (/\b(sombra|shadow)\b/.test(text)) return "sombra";
  if (/\b(reflejo|reflection|mirror)\b/.test(text)) return "reflejo";
  if (/\b(led|light|lighting|iluminacion|glow)\b/.test(text)) return "led_iluminacion";
  if (/\b(piso|floor)\b/.test(text)) return "piso";
  if (/\b(pared|wall)\b/.test(text)) return "pared";
  if (/\b(texture|textura|grain|woodgrain|ruido|noise)\b/.test(text)) return "textura";
  if (/\b(ranura|groove|slot)\b/.test(text)) return "ranura";

  const profile = colorProfile(path.color);
  const boundsArea = path.boundsMm.width * path.boundsMm.height;
  const minSide = Math.min(path.boundsMm.width, path.boundsMm.height);
  const maxSide = Math.max(path.boundsMm.width, path.boundsMm.height);
  const aspectRatio = minSide > 0 ? maxSide / minSide : 999;

  if (!profile) {
    return "";
  }

  if (profile.alpha <= 0.08) return "transparencia";
  if (profile.lightness >= 0.86 && profile.saturation <= 0.24) return "led_reflejo_iluminacion";
  if (profile.saturation <= 0.08 && profile.lightness >= 0.5 && profile.lightness < 0.86 && boundsArea < 12000) return "piso_pared_textura";
  if (profile.saturation <= 0.1 && profile.lightness > 0.12 && profile.lightness < 0.45 && boundsArea < 10000) return "sombra";
  if (profile.saturation <= 0.08 && aspectRatio > 16 && path.pathLengthMm < 1200) return "ranura_textura";
  if (path.closed && areaMm2 > 0 && areaMm2 < 250 && profile.lightness > 0.32 && profile.saturation < 0.18) return "textura_ruido";

  return "";
}

function colorProfile(value: string) {
  const color = parseColor(value);
  if (!color) return null;
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { lightness, saturation, alpha: color.a };
}

function parseColor(value: string) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "none" || raw === "transparent") return { r: 255, g: 255, b: 255, a: 0 };

  const namedColors: Record<string, { r: number; g: number; b: number; a: number }> = {
    black: { r: 0, g: 0, b: 0, a: 1 },
    white: { r: 255, g: 255, b: 255, a: 1 },
    gray: { r: 128, g: 128, b: 128, a: 1 },
    grey: { r: 128, g: 128, b: 128, a: 1 },
    silver: { r: 192, g: 192, b: 192, a: 1 },
    gold: { r: 255, g: 215, b: 0, a: 1 },
    goldenrod: { r: 218, g: 165, b: 32, a: 1 },
    brown: { r: 150, g: 75, b: 0, a: 1 },
    tan: { r: 210, g: 180, b: 140, a: 1 },
    beige: { r: 245, g: 245, b: 220, a: 1 },
    walnut: { r: 92, g: 64, b: 51, a: 1 },
  };
  if (namedColors[raw]) return namedColors[raw];

  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return {
      r: parseInt(raw[1] + raw[1], 16),
      g: parseInt(raw[2] + raw[2], 16),
      b: parseInt(raw[3] + raw[3], 16),
      a: 1,
    };
  }

  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return {
      r: parseInt(raw.slice(1, 3), 16),
      g: parseInt(raw.slice(3, 5), 16),
      b: parseInt(raw.slice(5, 7), 16),
      a: 1,
    };
  }

  const rgb = raw.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const values = rgb[1].split(",").map((item) => Number(item.trim()));
    if (values.length >= 3 && values.slice(0, 3).every(Number.isFinite)) {
      return {
        r: clampRgb(values[0]),
        g: clampRgb(values[1]),
        b: clampRgb(values[2]),
        a: Number.isFinite(values[3]) ? Math.max(0, Math.min(1, values[3])) : 1,
      };
    }
  }

  return null;
}

function clampRgb(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function updateVectorAssignment(
  path: CustomVectorPath,
  patch: Partial<Pick<CustomVectorPath, "layer" | "materialId" | "operation" | "toolId" | "thicknessMm" | "depthMm" | "noCut">>
) {
  const material = patch.materialId ? materialById(patch.materialId) : materialById(path.materialId);
  const operation = patch.operation || path.operation;
  const thicknessMm = patch.thicknessMm ?? material.thicknessMm;
  const noCut = patch.noCut ?? operation === "no_cortar";

  return {
    ...path,
    ...patch,
    materialId: material.id,
    layer: patch.layer || material.layer,
    operation,
    toolId: patch.toolId || suggestTool(material.id, operation, thicknessMm),
    thicknessMm,
    depthMm: patch.depthMm ?? defaultDepthFor(operation, thicknessMm),
    noCut,
  };
}

export function applyAiMaterialClassifier(paths: CustomVectorPath[]) {
  return paths.map((path) => {
    const role = physicalRoleForPath(path);
    const currentMaterial = materialById(path.materialId);
    let note = "";
    let patch: Parameters<typeof updateVectorAssignment>[1] = {};

    if (role === "onda_principal") {
      note = "IA material: Onda -> MDF Nogal 18 mm.";
      patch = { materialId: "mdf_nogal_18", operation: path.operation === "grabado" ? "grabado" : "corte_exterior" };
    } else if (role === "logo_rdss") {
      note = "IA material: Logo -> MDF Negro 18/15 mm + Acrilico Dorado 3 mm para cara/detalle.";
      patch = { materialId: "mdf_negro_18", operation: path.operation === "grabado" ? "grabado" : "corte_exterior" };
    } else if (role === "texto") {
      note = "IA material: Texto -> Acrilico Dorado 3 mm.";
      patch = { materialId: "acrilico_espejo_dorado_3", layer: "CAPA_TEXTOS", operation: path.operation === "grabado" ? "grabado" : "corte_exterior" };
    } else if (role === "cad_cocina") {
      note = "IA material: CAD -> Acrilico Dorado 3 mm.";
      patch = { materialId: "acrilico_espejo_dorado_3", layer: "CAPA_CAD_DECORATIVO", operation: "grabado" };
    } else if (role === "arbol") {
      note = "IA material: Arbol decorativo -> MDF Negro 6 mm.";
      patch = { materialId: "mdf_negro_6", operation: "corte_exterior" };
    } else if (role === "referencia" || role === "ruido") {
      note = "IA material: Referencia -> No cortar.";
      patch = { materialId: currentMaterial.id, layer: "CAPA_REFERENCIA", operation: "no_cortar", noCut: true, depthMm: 0 };
    }

    const enriched = {
      ...path,
      vectorRole: role === "detalle_decorativo" ? path.vectorRole : role,
      notes: note ? appendVectorNote(path.notes, note) : path.notes,
    };

    return Object.keys(patch).length ? updateVectorAssignment(enriched, patch) : enriched;
  });
}

export function groupPhysicalVectorPieces(paths: CustomVectorPath[]): CustomVectorPhysicalGroup[] {
  const grouped = new Map<string, CustomVectorPhysicalGroup>();

  paths.forEach((path) => {
    if (!isNestingProductionPath(path)) return;

    const role = physicalRoleForPath(path);
    const material = materialById(path.materialId);
    const key = physicalGroupKey(path, role);
    const existing = grouped.get(key);
    const quantity = Math.max(1, Math.floor(path.quantity || 1));

    if (existing) {
      existing.paths.push(path);
      existing.pathIds.push(path.id);
      existing.quantity = Math.max(existing.quantity, quantity);
      existing.boundsMm = unionBounds([existing.boundsMm, path.boundsMm]);
      existing.requiresDivision = existing.requiresDivision || exceedsBoard(existing.boundsMm, material);
      return;
    }

    grouped.set(key, {
      id: uid("GRP"),
      key,
      label: physicalGroupLabel(path, role),
      role,
      materialId: material.id,
      materialLabel: material.label,
      layer: path.layer,
      thicknessMm: path.thicknessMm || material.thicknessMm,
      boundsMm: path.boundsMm,
      pathIds: [path.id],
      paths: [path],
      quantity,
      requiresDivision: exceedsBoard(path.boundsMm, material),
    });
  });

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.materialLabel !== b.materialLabel) return a.materialLabel.localeCompare(b.materialLabel);
    return b.boundsMm.width * b.boundsMm.height - a.boundsMm.width * a.boundsMm.height;
  });
}

export function summarizeNestingByMaterial(sheets: NestedVectorSheet[]): NestingMaterialSummary[] {
  const grouped = new Map<string, NestingMaterialSummary>();

  sheets.forEach((sheet) => {
    const current = grouped.get(sheet.materialId) || {
      materialId: sheet.materialId,
      materialLabel: sheet.materialLabel,
      thicknessMm: sheet.thicknessMm,
      sheets: 0,
      pieces: 0,
      paths: 0,
      usedAreaM2: 0,
    };

    current.sheets += 1;
    current.pieces += sheet.pieces.length;
    current.paths += sheet.pieces.reduce((sum, piece) => sum + (piece.pathIds?.length || 1), 0);
    current.usedAreaM2 += sheet.usedAreaM2;
    grouped.set(sheet.materialId, current);
  });

  return Array.from(grouped.values()).sort((a, b) => a.materialLabel.localeCompare(b.materialLabel));
}

export function nestVectorPaths(paths: CustomVectorPath[], options: NestingOptions) {
  const margin = 20;
  const effectiveGap = Math.max(2, options.gapMm + options.kerfMm);
  const sheets: NestedVectorSheet[] = [];
  const candidates = groupPhysicalVectorPieces(paths);

  const grouped = new Map<string, CustomVectorPhysicalGroup[]>();
  candidates.forEach((group) => {
    const key = `${group.materialId}`;
    grouped.set(key, [...(grouped.get(key) || []), group]);
  });

  grouped.forEach((physicalGroups, materialId) => {
    const material = materialById(materialId);
    let sheetNumber = 1;
    let cursorX = margin;
    let cursorY = margin;
    let rowHeight = 0;
    let current = createSheet(material, sheetNumber);

    const pieces = expandPhysicalGroups(physicalGroups, options.divideOversize);

    pieces.forEach(({ group, copyIndex, segmentLabel, segmentOffsetX, segmentOffsetY, width, height }) => {
      let pieceWidth = Math.min(width, material.boardWidthMm - margin * 2);
      let pieceHeight = Math.min(height, material.boardHeightMm - margin * 2);
      let rotated = false;

      if (
        options.allowRotate &&
        pieceWidth > pieceHeight &&
        cursorX + pieceWidth > material.boardWidthMm - margin &&
        cursorX + pieceHeight <= material.boardWidthMm - margin &&
        cursorY + pieceWidth <= material.boardHeightMm - margin
      ) {
        [pieceWidth, pieceHeight] = [pieceHeight, pieceWidth];
        rotated = true;
      }

      if (cursorX + pieceWidth > material.boardWidthMm - margin) {
        cursorX = margin;
        cursorY += rowHeight + effectiveGap;
        rowHeight = 0;
      }

      if (cursorY + pieceHeight > material.boardHeightMm - margin) {
        finalizeSheet(current);
        sheets.push(current);
        sheetNumber += 1;
        current = createSheet(material, sheetNumber);
        cursorX = margin;
        cursorY = margin;
        rowHeight = 0;
      }

      const piece: NestedVectorPiece = {
        id: uid("NEST"),
        pathId: group.paths[0].id,
        copyIndex,
        sheetId: current.id,
        sheetNumber,
        materialId: material.id,
        x: cursorX,
        y: cursorY,
        width: pieceWidth,
        height: pieceHeight,
        rotated,
        segmentLabel,
        segmentOffsetX,
        segmentOffsetY,
        path: group.paths[0],
        groupId: group.id,
        groupKey: group.key,
        groupLabel: group.label,
        groupRole: group.role,
        groupBoundsMm: group.boundsMm,
        pathIds: group.pathIds,
        paths: group.paths,
        requiresDivision: group.requiresDivision,
      };

      current.pieces.push(piece);
      cursorX += pieceWidth + effectiveGap;
      rowHeight = Math.max(rowHeight, pieceHeight);
    });

    finalizeSheet(current);
    sheets.push(current);
  });

  return sheets.filter((sheet) => sheet.pieces.length > 0);
}

export function validateCncProject(paths: CustomVectorPath[], sheets: NestedVectorSheet[], options: NestingOptions): CncValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const active = paths.filter((path) => !path.noCut && path.operation !== "no_cortar");

  if (!paths.length) errors.push("No hay vectores cargados.");
  if (!active.length) warnings.push("Solo hay referencia/no cortar. No se generara G-code.");

  groupPhysicalVectorPieces(paths).forEach((group) => {
    const material = materialById(group.materialId);
    if (exceedsBoard(group.boundsMm, material) && !options.divideOversize) {
      warnings.push(`${group.label}: pieza fisica mayor de 2440 x 1220 mm; activa division A/B.`);
    }
  });

  paths.forEach((path) => {
    if (path.sourceType === "bitmap" && path.noCut) {
      warnings.push(`${path.name}: imagen marcada como referencia. No se manda a CNC.`);
    }
    if ((path.operation === "corte_exterior" || path.operation === "corte_interior") && !path.closed && !path.noCut) {
      errors.push(`${path.name}: corte exterior/interior requiere path cerrado.`);
    }
    if (!path.materialId && !path.noCut) errors.push(`${path.name}: falta material asignado.`);
    if (!path.toolId && !path.noCut) errors.push(`${path.name}: falta broca/herramienta asignada.`);
    if (path.operation !== "no_cortar" && Math.abs(path.depthMm) > path.thicknessMm) {
      errors.push(`${path.name}: profundidad mayor al espesor.`);
    }
    if (!Number.isFinite(path.scaleToMm) || path.scaleToMm <= 0) {
      errors.push(`${path.name}: escala real en mm no valida.`);
    }
    if ((path.boundsMm.width > BOARD_WIDTH_MM || path.boundsMm.height > BOARD_HEIGHT_MM) && !options.divideOversize) {
      warnings.push(`${path.name}: excede 2440 x 1220 mm; activa division A/B.`);
    }
  });

  sheets.forEach((sheet) => {
    sheet.pieces.forEach((piece) => {
      if (piece.x < 0 || piece.y < 0 || piece.x + piece.width > sheet.width || piece.y + piece.height > sheet.height) {
        errors.push(`${piece.path.name}: pieza fuera del tablero ${sheet.sheetNumber}.`);
      }
    });
  });

  return { ok: errors.length === 0, errors, warnings };
}

export function estimateCncMinutes(paths: CustomVectorPath[]) {
  return paths.reduce((total, path) => {
    if (path.noCut || path.operation === "no_cortar") return total;
    const tool = toolById(path.toolId);
    const plungePenalty = path.operation === "perforacion" ? 0.35 : 0.15;
    return total + (path.pathLengthMm / Math.max(1, tool.feedMmMin) + plungePenalty) * path.quantity;
  }, 0);
}

export function estimateCutSimulation(
  paths: CustomVectorPath[],
  toolOverride?: CustomVectorTool | null,
  materialOverride?: CustomVectorMaterial | null,
  sheets: NestedVectorSheet[] = [],
  passDepthMm = DEFAULT_CUT_PASS_DEPTH_MM
): CutSimulationResult {
  const activePaths = paths.filter((path) => !path.noCut && path.operation !== "no_cortar");
  const blockingWarnings: string[] = [];

  if (!activePaths.length) {
    return emptyCutSimulation(["No hay paths activos para simular."]);
  }

  activePaths.forEach((path) => {
    const material = materialOverride || materialById(path.materialId);
    const tool = toolOverride || toolById(path.toolId);
    const thicknessMm = materialOverride?.thicknessMm || path.thicknessMm || material.thicknessMm;
    const depthMm = Math.abs(path.depthMm || defaultDepthFor(path.operation, thicknessMm));

    if ((path.operation === "corte_exterior" || path.operation === "corte_interior") && !path.closed) {
      blockingWarnings.push(`${path.name}: corte exterior/interior requiere path cerrado.`);
    }
    if (!path.toolId && !toolOverride) blockingWarnings.push(`${path.name}: falta broca asignada.`);
    if (!path.materialId && !materialOverride) blockingWarnings.push(`${path.name}: falta material asignado.`);
    if (!tool?.diameterMm || tool.diameterMm <= 0) blockingWarnings.push(`${path.name}: la broca no tiene diametro valido.`);
    if (depthMm > thicknessMm) blockingWarnings.push(`${path.name}: profundidad ${moneyNumber(depthMm, 1)} mm mayor al espesor ${moneyNumber(thicknessMm, 1)} mm.`);
    if (!Number.isFinite(path.scaleToMm) || path.scaleToMm <= 0) blockingWarnings.push(`${path.name}: escala real en mm no valida.`);
  });

  if (blockingWarnings.length) {
    return emptyCutSimulation(blockingWarnings);
  }

  const warnings: string[] = [];
  const nestedSheets = sheets.length
    ? sheets
    : nestVectorPaths(activePaths, { gapMm: 12, kerfMm: 3, allowRotate: true, divideOversize: true });
  const pathById = new Map(activePaths.map((path) => [path.id, path]));
  const simulationPieces = nestedSheets
    .flatMap((sheet) =>
      sheet.pieces.map((piece) => ({
        sheet,
        piece,
        paths: (piece.paths?.length ? piece.paths : [piece.path]).filter((path) => pathById.has(path.id) && pathIntersectsPieceSegment(path, piece)),
      }))
    )
    .filter(({ paths: piecePaths }) => piecePaths.length > 0);

  if (!simulationPieces.length) {
    return emptyCutSimulation(["No hay piezas anidadas dentro del tablero 2440 x 1220 mm para simular."]);
  }

  const segments: SimulatedCutSegment[] = [];
  let order = 1;

  simulationPieces.forEach(({ sheet, piece, paths: piecePaths }) => {
    piecePaths.forEach((currentPath) => {
      const material = materialOverride || materialById(currentPath.materialId);
      const tool = toolOverride || toolById(currentPath.toolId);
      const thicknessMm = materialOverride?.thicknessMm || currentPath.thicknessMm || material.thicknessMm;
      const depthMm = Math.min(Math.abs(currentPath.depthMm || defaultDepthFor(currentPath.operation, thicknessMm)), thicknessMm);
      const passCount = Math.max(1, Math.ceil(depthMm / Math.max(0.5, passDepthMm)));
      const runtimePiece: NestedVectorPiece = { ...piece, path: currentPath };

      const originalPoints =
        currentPath.operation === "perforacion"
          ? circlePoints({ x: piece.x + piece.width / 2, y: piece.y + piece.height / 2 }, Math.max(1, tool.diameterMm / 2), 36)
          : ensureClosedPoints(placePathPoints(currentPath, runtimePiece), currentPath.closed);
      const compensatedPoints =
        currentPath.operation === "perforacion"
          ? originalPoints
          : makeToolCompensatedPoints(originalPoints, currentPath.operation, tool.diameterMm, currentPath.closed);
      const removedAreaPoints =
        currentPath.operation === "corte_exterior" || currentPath.operation === "corte_interior" || currentPath.operation === "perforacion"
          ? ensureClosedPoints(compensatedPoints, true)
          : [];
      const lengthMm =
        currentPath.operation === "perforacion"
          ? Math.PI * Math.max(1, tool.diameterMm)
          : simulationPointsLength(compensatedPoints, currentPath.closed);

      if (originalPoints.length < 2) {
        warnings.push(`${currentPath.name}: no tiene puntos suficientes para simular.`);
        return;
      }
      if (!pointsInsideBoard(originalPoints, sheet.width, sheet.height)) {
        warnings.push(`${currentPath.name}: la pieza queda fuera del tablero ${sheet.sheetNumber}.`);
      }
      if (!pointsInsideBoard(compensatedPoints, sheet.width, sheet.height)) {
        warnings.push(`${currentPath.name}: la trayectoria compensada por broca sale del tablero ${sheet.sheetNumber}.`);
      }

      for (let passNumber = 1; passNumber <= passCount; passNumber += 1) {
        const passTargetDepthMm = Math.min(depthMm, passNumber * passDepthMm);
        const cutMinutes = lengthMm / Math.max(1, tool.feedMmMin);
        const plungeMinutes = passTargetDepthMm / Math.max(1, tool.plungeMmMin);

        segments.push({
          id: `SIM-${currentPath.id}-${piece.id}-${passNumber}`,
          pathId: currentPath.id,
          pieceId: piece.id,
          sheetNumber: piece.sheetNumber,
          pathName: currentPath.name,
          operation: currentPath.operation,
          operationLabel: operationLabel(currentPath.operation),
          materialId: material.id,
          materialLabel: material.label,
          thicknessMm,
          toolId: tool.id,
          toolLabel: tool.label,
          toolDiameterMm: tool.diameterMm,
          depthMm,
          passNumber,
          passTargetDepthMm,
          passCount,
          order: order++,
          lengthMm,
          estimatedMinutes: cutMinutes + plungeMinutes,
          originalPoints,
          compensatedPoints,
          removedAreaPoints,
        });
      }
    });
  });

  return {
    totalLengthMm: segments.reduce((sum, segment) => sum + segment.lengthMm, 0),
    passes: segments.length,
    estimatedMinutes: segments.reduce((sum, segment) => sum + segment.estimatedMinutes, 0),
    warnings: uniqueStrings(warnings),
    simulatedSegments: segments,
    pieces: new Set(segments.map((segment) => segment.pieceId)).size,
    trajectories: new Set(segments.map((segment) => `${segment.pathId}:${segment.pieceId}`)).size,
    materials: Array.from(new Set(segments.map((segment) => segment.materialLabel))),
    tools: Array.from(new Set(segments.map((segment) => segment.toolLabel))),
  };
}

export function buildSvgByLayer(paths: CustomVectorPath[], layer: CncLayerId) {
  const layerInfo = layerById(layer);
  const body = paths
    .filter((path) => path.layer === layer)
    .map((path) => {
      const stroke = path.noCut ? "#94a3b8" : path.color || layerInfo.color;
      const fill = path.operation === "grabado" || !path.closed ? "none" : `${stroke}33`;
      return `  <path id="${xml(path.id)}" data-operation="${xml(path.operation)}" data-material="${xml(path.materialId)}" d="${xml(path.d)}" transform="scale(${path.scaleToMm})" fill="${fill}" stroke="${stroke}" stroke-width="1" />`;
    })
    .join("\n");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${RDSS_TEMPLATE_WIDTH_MM}mm" height="${RDSS_TEMPLATE_HEIGHT_MM}mm" viewBox="0 0 ${RDSS_TEMPLATE_WIDTH_MM} ${RDSS_TEMPLATE_HEIGHT_MM}">`,
    `  <title>RD Wood System - ${layerInfo.label}</title>`,
    body || `  <desc>Sin paths en esta capa</desc>`,
    `</svg>`,
  ].join("\n");
}

export function buildDxfByMaterial(paths: CustomVectorPath[], materialId: string) {
  const material = materialById(materialId);
  const lines = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];

  paths
    .filter((path) => path.materialId === materialId && !path.noCut && path.operation !== "no_cortar")
    .forEach((path) => {
      const points = svgPathToPoints(path.d).map((point) => ({
        x: point.x * path.scaleToMm,
        y: point.y * path.scaleToMm,
      }));
      if (points.length < 2) return;
      lines.push("0", "LWPOLYLINE", "8", path.layer, "90", String(points.length), "70", path.closed ? "1" : "0");
      points.forEach((point) => {
        lines.push("10", moneyNumber(point.x, 3), "20", moneyNumber(point.y, 3));
      });
    });

  lines.push("0", "ENDSEC", "0", "EOF");
  return { fileName: `${sanitizeFileName(material.label)}.dxf`, content: lines.join("\n") };
}

export function buildCsv(paths: CustomVectorPath[], sheets: NestedVectorSheet[]) {
  const rows = [
    ["pieza", "archivo", "capa", "material", "operacion", "broca", "cantidad", "ancho_mm", "alto_mm", "profundidad_mm", "cerrado", "hoja"],
  ];

  paths.forEach((path) => {
    const nested = sheets
      .flatMap((sheet) => sheet.pieces)
      .filter((piece) => (piece.pathIds?.length ? piece.pathIds.includes(path.id) : piece.pathId === path.id));
    rows.push([
      path.name,
      path.sourceFileName,
      path.layer,
      materialById(path.materialId).label,
      operationLabel(path.operation),
      toolById(path.toolId).label,
      String(path.quantity),
      moneyNumber(path.boundsMm.width, 2),
      moneyNumber(path.boundsMm.height, 2),
      moneyNumber(path.depthMm, 2),
      path.closed ? "si" : "no",
      nested.map((piece) => `${piece.sheetNumber}${piece.segmentLabel ? `-${piece.segmentLabel}` : ""}`).join("|"),
    ]);
  });

  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export function buildProjectJson(paths: CustomVectorPath[], sheets: NestedVectorSheet[], validation: CncValidationResult) {
  return JSON.stringify(
    {
      project: "RDSS EVOLUTION",
      template: { widthMm: RDSS_TEMPLATE_WIDTH_MM, heightMm: RDSS_TEMPLATE_HEIGHT_MM },
      board: { widthMm: BOARD_WIDTH_MM, heightMm: BOARD_HEIGHT_MM },
      exportedAt: new Date().toISOString(),
      validation,
      materials: RDSS_EVOLUTION_MATERIALS,
      layers: CNC_LAYERS,
      paths,
      sheets,
    },
    null,
    2
  );
}

export function buildNcPrograms(sheets: NestedVectorSheet[]) {
  return sheets.map((sheet) => ({
    fileName: `${sanitizeFileName(sheet.materialLabel)}_hoja_${sheet.sheetNumber}.nc`,
    content: buildNcProgramForSheet(sheet),
  }));
}

function buildNcProgramForSheet(sheet: NestedVectorSheet) {
  const lines: string[] = [];
  lines.push("(RD WOOD SYSTEM - BLUE ELEPHANT / NC STUDIO)");
  lines.push(`(MATERIAL: ${sanitizeComment(sheet.materialLabel)} - HOJA ${sheet.sheetNumber})`);
  lines.push("G21");
  lines.push("G90");
  lines.push("G17");
  lines.push("G40");
  lines.push("G49");
  lines.push("G80");
  lines.push("G54");
  lines.push("G0 Z15.000");

  let activeTool = "";

  sheet.pieces.forEach((piece) => {
    const piecePaths = (piece.paths?.length ? piece.paths : [piece.path]).filter((path) => pathIntersectsPieceSegment(path, piece));

    piecePaths.forEach((path) => {
      const tool = toolById(path.toolId);
      if (tool.id !== activeTool) {
        activeTool = tool.id;
        lines.push(`(HERRAMIENTA: ${sanitizeComment(tool.label)})`);
        lines.push(`M3 S${moneyNumber(tool.spindleRpm, 0)}`);
      }

      const points = placePathPoints(path, piece);
      if (points.length < 2) return;
      const depth = -Math.min(Math.abs(path.depthMm), path.thicknessMm);
      const stepDown = Math.max(0.5, Math.min(4, Math.abs(depth)));

      lines.push(`(${sanitizeComment(path.name)} - ${operationLabel(path.operation)})`);

      if (path.operation === "perforacion") {
        const center = {
          x: piece.x + piece.width / 2,
          y: piece.y + piece.height / 2,
        };
        lines.push(`G0 Z15.000`);
        lines.push(`G0 X${moneyNumber(center.x, 3)} Y${moneyNumber(center.y, 3)}`);
        lines.push(`G1 Z${moneyNumber(depth, 3)} F${moneyNumber(tool.plungeMmMin, 0)}`);
        lines.push(`G0 Z15.000`);
        return;
      }

      let currentDepth = stepDown;
      while (currentDepth <= Math.abs(depth) + 0.001) {
        const z = -Math.min(currentDepth, Math.abs(depth));
        lines.push(`G0 Z15.000`);
        lines.push(`G0 X${moneyNumber(points[0].x, 3)} Y${moneyNumber(points[0].y, 3)}`);
        lines.push(`G1 Z${moneyNumber(z, 3)} F${moneyNumber(tool.plungeMmMin, 0)}`);
        points.slice(1).forEach((point) => {
          lines.push(`G1 X${moneyNumber(point.x, 3)} Y${moneyNumber(point.y, 3)} F${moneyNumber(tool.feedMmMin, 0)}`);
        });
        if (path.closed) {
          lines.push(`G1 X${moneyNumber(points[0].x, 3)} Y${moneyNumber(points[0].y, 3)} F${moneyNumber(tool.feedMmMin, 0)}`);
        }
        if (currentDepth >= Math.abs(depth)) break;
        currentDepth += stepDown;
      }
    });
  });

  lines.push("G0 Z15.000");
  lines.push("M5");
  lines.push("M30");
  return lines.join("\n");
}

function placePathPoints(path: CustomVectorPath, piece: NestedVectorPiece) {
  const sourcePoints = svgPathToPoints(path.d).map((point) => ({
    x: point.x * path.scaleToMm,
    y: point.y * path.scaleToMm,
  }));
  const sourceBounds = piece.groupBoundsMm || boundsFromPoints(sourcePoints) || path.boundsMm;
  const offsetX = piece.segmentOffsetX || 0;
  const offsetY = piece.segmentOffsetY || 0;
  const segmentBounds = piece.segmentLabel
    ? {
        x: sourceBounds.x + offsetX,
        y: sourceBounds.y + offsetY,
        width: piece.width,
        height: piece.height,
      }
    : null;
  const segmentPoints = piece.segmentLabel
    ? sourcePoints.filter(
        (point) =>
          point.x >= sourceBounds.x + offsetX - 1 &&
          point.x <= sourceBounds.x + offsetX + piece.width + 1 &&
          point.y >= sourceBounds.y + offsetY - 1 &&
          point.y <= sourceBounds.y + offsetY + piece.height + 1
      )
    : sourcePoints;
  const overlapBounds = segmentBounds ? intersectBounds(path.boundsMm, segmentBounds) : null;
  const points = segmentPoints.length > 1 ? segmentPoints : overlapBounds ? boundsToPoints(overlapBounds, path.closed) : sourcePoints;

  return points.map((point) => {
    const localX = point.x - sourceBounds.x - offsetX;
    const localY = point.y - sourceBounds.y - offsetY;
    const safeLocalX = piece.segmentLabel ? clampNumber(localX, 0, piece.width) : localX;
    const safeLocalY = piece.segmentLabel ? clampNumber(localY, 0, piece.height) : localY;
    return piece.rotated
      ? { x: piece.x + safeLocalY, y: piece.y + piece.width - safeLocalX }
      : { x: piece.x + safeLocalX, y: piece.y + safeLocalY };
  });
}

function pathIntersectsPieceSegment(path: CustomVectorPath, piece: NestedVectorPiece) {
  if (!piece.segmentLabel) return true;
  const groupBounds = piece.groupBoundsMm || path.boundsMm;
  const segmentBounds = {
    x: groupBounds.x + (piece.segmentOffsetX || 0),
    y: groupBounds.y + (piece.segmentOffsetY || 0),
    width: piece.width,
    height: piece.height,
  };
  return Boolean(intersectBounds(path.boundsMm, segmentBounds, 2));
}

function intersectBounds(a: CustomVectorBounds, b: CustomVectorBounds, padding = 0): CustomVectorBounds | null {
  const minX = Math.max(a.x, b.x - padding);
  const minY = Math.max(a.y, b.y - padding);
  const maxX = Math.min(a.x + a.width, b.x + b.width + padding);
  const maxY = Math.min(a.y + a.height, b.y + b.height + padding);
  if (maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function boundsToPoints(bounds: CustomVectorBounds, closed: boolean): CutSimulationPoint[] {
  const points = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
  return closed ? [...points, points[0]] : points;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function emptyCutSimulation(warnings: string[]): CutSimulationResult {
  return {
    totalLengthMm: 0,
    passes: 0,
    estimatedMinutes: 0,
    warnings,
    simulatedSegments: [],
    pieces: 0,
    trajectories: 0,
    materials: [],
    tools: [],
  };
}

function simulationPointsLength(points: CutSimulationPoint[], closed: boolean) {
  if (points.length < 2) return 0;
  const openLength = points.slice(1).reduce((sum, point, index) => {
    const previous = points[index];
    return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
  if (!closed) return openLength;
  const first = points[0];
  const last = points[points.length - 1];
  return openLength + Math.hypot(first.x - last.x, first.y - last.y);
}

function ensureClosedPoints(points: CutSimulationPoint[], closed: boolean) {
  if (!closed || points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) <= 0.01) return points;
  return [...points, first];
}

function makeToolCompensatedPoints(
  points: CutSimulationPoint[],
  operation: CustomVectorOperation,
  toolDiameterMm: number,
  closed: boolean
) {
  if (points.length < 2 || operation === "grabado") return points;
  const bounds = boundsFromPoints(points);
  if (!bounds) return points;
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const offset =
    operation === "corte_exterior"
      ? toolDiameterMm / 2
      : operation === "corte_interior"
        ? -toolDiameterMm / 2
        : 0;
  const compensated = points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.hypot(dx, dy) || 1;
    return {
      x: point.x + (dx / distance) * offset,
      y: point.y + (dy / distance) * offset,
    };
  });
  return ensureClosedPoints(compensated, closed);
}

function circlePoints(center: CutSimulationPoint, radius: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  });
}

function pointsInsideBoard(points: CutSimulationPoint[], width: number, height: number) {
  return points.every((point) => point.x >= -0.01 && point.y >= -0.01 && point.x <= width + 0.01 && point.y <= height + 0.01);
}

function createSheet(material: CustomVectorMaterial, sheetNumber: number): NestedVectorSheet {
  return {
    id: `${material.id}-${sheetNumber}`,
    materialId: material.id,
    materialLabel: material.label,
    thicknessMm: material.thicknessMm,
    sheetNumber,
    width: material.boardWidthMm,
    height: material.boardHeightMm,
    pieces: [],
    usedAreaM2: 0,
  };
}

function finalizeSheet(sheet: NestedVectorSheet) {
  sheet.usedAreaM2 = sheet.pieces.reduce((sum, piece) => sum + (piece.width * piece.height) / 1_000_000, 0);
}

function appendVectorNote(notes: string | undefined, note: string) {
  const current = String(notes || "").trim();
  if (!current) return note;
  if (current.includes(note)) return current;
  return `${current} ${note}`;
}

function physicalRoleForPath(path: CustomVectorPath): CustomVectorPhysicalRole {
  const roleText = `${path.sourceFileName} ${path.name} ${path.notes || ""}`;
  return path.vectorRole || inferVectorRoleFromText(roleText) || "detalle_decorativo";
}

function isNestingProductionPath(path: CustomVectorPath) {
  if (path.noCut || path.operation === "no_cortar") return false;
  if (path.layer === "CAPA_REFERENCIA" || path.layer === "CAPA_LED_REFERENCIA") return false;
  if (!path.boundsMm || path.boundsMm.width <= 0 || path.boundsMm.height <= 0) return false;

  const role = physicalRoleForPath(path);
  if (role === "referencia" || role === "ruido") return false;

  const text = normalizeVectorText(`${path.sourceFileName} ${path.name} ${path.notes || ""}`);
  if (/\b(no\s*cortar|referencia|led|luz|iluminacion|sombra|shadow|reflejo|reflection|textura|texture|piso|floor|pared|wall|ranura)\b/.test(text)) {
    return false;
  }

  return true;
}

function physicalGroupKey(path: CustomVectorPath, role: CustomVectorPhysicalRole) {
  const roleKey = role === "detalle_decorativo" ? "detalle" : role;
  const index = physicalGroupIndex(path, role);
  return `${path.materialId}:${roleKey}:${index}`;
}

function physicalGroupIndex(path: CustomVectorPath, role: CustomVectorPhysicalRole) {
  if (role === "logo_rdss") return "logo";
  if (role === "cad_cocina") return "cad";
  if (role === "arbol") return "arbol";

  const text = normalizeVectorText(`${path.sourceFileName} ${path.name} ${path.notes || ""}`);
  const explicit = text.match(/\b(?:onda|wave|linea|line|texto|text|grupo|group|pieza|piece|objeto|object|detalle|decorativo)\s*[-_#]*(\d+|[a-z])\b/);
  if (explicit?.[1]) return explicit[1];

  const centerX = path.boundsMm.x + path.boundsMm.width / 2;
  const centerY = path.boundsMm.y + path.boundsMm.height / 2;
  if (role === "onda_principal") return `fila-${Math.max(1, Math.round(centerY / 260))}`;
  if (role === "texto") return `linea-${Math.max(1, Math.round(centerY / 160))}`;
  return `zona-${Math.max(1, Math.round(centerX / 360))}-${Math.max(1, Math.round(centerY / 240))}`;
}

function physicalGroupLabel(path: CustomVectorPath, role: CustomVectorPhysicalRole) {
  const labels: Record<CustomVectorPhysicalRole, string> = {
    logo_rdss: "Logo RDSS",
    texto: "Texto corporativo",
    onda_principal: "Onda nogal",
    cad_cocina: "CAD cocina",
    arbol: "Arbol decorativo",
    referencia: "Referencia",
    ruido: "Ruido",
    detalle_decorativo: "Detalle decorativo",
  };
  const index = physicalGroupIndex(path, role);
  if (["logo", "cad", "arbol"].includes(index)) return labels[role];
  return `${labels[role]} ${index}`;
}

function unionBounds(bounds: CustomVectorBounds[]) {
  const valid = bounds.filter((bound) => bound && bound.width > 0 && bound.height > 0);
  if (!valid.length) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  valid.forEach((bound) => {
    if (bound.x < minX) minX = bound.x;
    if (bound.y < minY) minY = bound.y;
    if (bound.x + bound.width > maxX) maxX = bound.x + bound.width;
    if (bound.y + bound.height > maxY) maxY = bound.y + bound.height;
  });

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function exceedsBoard(bounds: CustomVectorBounds, material: CustomVectorMaterial) {
  return bounds.width > material.boardWidthMm || bounds.height > material.boardHeightMm;
}

function expandPhysicalGroups(groups: CustomVectorPhysicalGroup[], divideOversize: boolean) {
  const result: Array<{
    group: CustomVectorPhysicalGroup;
    copyIndex: number;
    segmentLabel?: string;
    segmentOffsetX?: number;
    segmentOffsetY?: number;
    width: number;
    height: number;
  }> = [];

  groups.forEach((group) => {
    const material = materialById(group.materialId);
    const maxWidth = Math.max(200, material.boardWidthMm - 40);
    const maxHeight = Math.max(200, material.boardHeightMm - 40);

    for (let copyIndex = 1; copyIndex <= group.quantity; copyIndex += 1) {
      const width = group.boundsMm.width;
      const height = group.boundsMm.height;

      if (divideOversize && (width > maxWidth || height > maxHeight)) {
        const cols = Math.max(1, Math.ceil(width / maxWidth));
        const rows = Math.max(1, Math.ceil(height / maxHeight));
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const segmentWidth = Math.min(maxWidth, width - col * maxWidth);
            const segmentHeight = Math.min(maxHeight, height - row * maxHeight);
            if (segmentWidth <= 0 || segmentHeight <= 0) continue;

            result.push({
              group,
              copyIndex,
              segmentLabel: `${String.fromCharCode(65 + col)}${rows > 1 ? row + 1 : ""}`,
              segmentOffsetX: col * maxWidth,
              segmentOffsetY: row * maxHeight,
              width: segmentWidth,
              height: segmentHeight,
            });
          }
        }
      } else {
        result.push({ group, copyIndex, width, height });
      }
    }
  });

  return result.sort((a, b) => b.height * b.width - a.height * a.width);
}

function svgNodeToPath(node: Element) {
  const tag = node.tagName.toLowerCase();
  if (tag === "path") return node.getAttribute("d") || "";
  if (tag === "polygon" || tag === "polyline") {
    const points = (node.getAttribute("points") || "")
      .trim()
      .split(/\s+/)
      .map((pair) => pair.split(",").map(Number))
      .filter((pair) => pair.length === 2 && pair.every(Number.isFinite));
    if (!points.length) return "";
    const body = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point[0]} ${point[1]}`).join(" ");
    return tag === "polygon" ? `${body} Z` : body;
  }
  if (tag === "rect") {
    const x = readAttr(node, "x", 0);
    const y = readAttr(node, "y", 0);
    const w = readAttr(node, "width", 0);
    const h = readAttr(node, "height", 0);
    return w > 0 && h > 0 ? `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z` : "";
  }
  if (tag === "circle" || tag === "ellipse") {
    const cx = readAttr(node, "cx", 0);
    const cy = readAttr(node, "cy", 0);
    const rx = tag === "circle" ? readAttr(node, "r", 0) : readAttr(node, "rx", 0);
    const ry = tag === "circle" ? rx : readAttr(node, "ry", 0);
    if (rx <= 0 || ry <= 0) return "";
    const points = Array.from({ length: 32 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 32;
      return `${index === 0 ? "M" : "L"} ${cx + Math.cos(angle) * rx} ${cy + Math.sin(angle) * ry}`;
    });
    return `${points.join(" ")} Z`;
  }
  if (tag === "line") {
    return `M ${readAttr(node, "x1", 0)} ${readAttr(node, "y1", 0)} L ${readAttr(node, "x2", 0)} ${readAttr(node, "y2", 0)}`;
  }
  return "";
}

function readAttr(node: Element, name: string, fallback: number) {
  const value = Number((node.getAttribute(name) || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(value) ? value : fallback;
}

function getNodeColor(node: Element) {
  const fill = node.getAttribute("fill");
  const stroke = node.getAttribute("stroke");
  const style = node.getAttribute("style") || "";
  const styleFill = style.match(/fill\s*:\s*([^;]+)/i)?.[1];
  const candidate = fill || styleFill || stroke;
  if (!candidate || candidate === "none") return "";
  return candidate;
}

function getNodeLabel(node: Element) {
  return [
    node.getAttribute("id"),
    node.getAttribute("class"),
    node.getAttribute("data-name"),
    node.getAttribute("name"),
    node.getAttribute("inkscape:label"),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function sanitizeComment(value: string) {
  return String(value || "")
    .replace(/[()]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function xml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
