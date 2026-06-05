"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  CheckCircle2,
  Cpu,
  Download,
  FileJson,
  FileText,
  Grid2X2,
  Image as ImageIcon,
  Layers3,
  Package,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Ruler,
  Save,
  Scissors,
  Settings,
  ShieldCheck,
  Sparkles,
  Type,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react";
import {
  BOARD_HEIGHT_MM,
  BOARD_WIDTH_MM,
  CNC_LAYERS,
  CNC_TOOLS,
  DEFAULT_CUT_PASS_DEPTH_MM,
  RDSS_EVOLUTION_MATERIALS,
  RDSS_TEMPLATE_HEIGHT_MM,
  RDSS_TEMPLATE_WIDTH_MM,
  buildCsv,
  buildDxfByMaterial,
  buildNcPrograms,
  buildProjectJson,
  buildSvgByLayer,
  applyAiMaterialClassifier,
  createDxfPathRecords,
  createSvgPathRecords,
  estimateCutSimulation,
  estimateCncMinutes,
  filterIndustrialVectorPaths,
  groupPhysicalVectorPieces,
  layerById,
  materialById,
  nestVectorPaths,
  operationLabel,
  sanitizeFileName,
  summarizeNestingByMaterial,
  updateVectorAssignment,
  validateCncProject,
  type CncLayerId,
  type CncValidationResult,
  type CutSimulationResult,
  type CustomVectorOperation,
  type CustomVectorPath,
  type CustomVectorSourceType,
  type IndustrialVectorFilterSummary,
  type NestingOptions,
  type NestedVectorSheet,
  type VectorizationMode,
} from "@/lib/customVectorCnc";

type UploadedSource = {
  fileName: string;
  sourceType: CustomVectorSourceType;
  text?: string;
  dataUrl?: string;
  buffer?: ArrayBuffer;
  imageData?: ImageData;
  imageWidth?: number;
  imageHeight?: number;
};

type UiMessage = {
  tone: "ok" | "warn" | "error";
  text: string;
};

type CutSimulationStatus = "pendiente" | "simulando" | "pausada" | "completada" | "error";
type CutSimulationMode = "proyecto" | "pieza";

type ImageTracerModule = {
  imagedataToSVG?: (imageData: ImageData, options?: Record<string, unknown>) => string;
  default?: {
    imagedataToSVG?: (imageData: ImageData, options?: Record<string, unknown>) => string;
  };
};

type OpenTypeModule = {
  parse?: (buffer: ArrayBuffer) => {
    getPath: (text: string, x: number, y: number, fontSize: number) => { toPathData: (decimalPlaces?: number) => string };
  };
  default?: {
    parse?: (buffer: ArrayBuffer) => {
      getPath: (text: string, x: number, y: number, fontSize: number) => { toPathData: (decimalPlaces?: number) => string };
    };
  };
};

const OPERATION_OPTIONS: Array<{ id: CustomVectorOperation; label: string }> = [
  { id: "corte_exterior", label: "Corte exterior" },
  { id: "corte_interior", label: "Corte interior" },
  { id: "grabado", label: "Grabado" },
  { id: "perforacion", label: "Perforacion" },
  { id: "no_cortar", label: "No cortar / referencia" },
];

const DEFAULT_NESTING: NestingOptions = {
  gapMm: 12,
  kerfMm: 3,
  allowRotate: true,
  divideOversize: true,
};

const SPACE_PRESETS = [
  { label: "RDSS Evolution", widthMm: RDSS_TEMPLATE_WIDTH_MM, heightMm: RDSS_TEMPLATE_HEIGHT_MM, coverage: 92 },
  { label: "Pared 3m", widthMm: 3000, heightMm: 2700, coverage: 90 },
  { label: "Pared 3.5m", widthMm: 3500, heightMm: 2700, coverage: 90 },
  { label: "Tablero 4x8", widthMm: BOARD_WIDTH_MM, heightMm: BOARD_HEIGHT_MM, coverage: 96 },
];

function formatMm(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(0)} mm`;
}

function formatMeters(valueMm: number) {
  return `${((Number.isFinite(valueMm) ? valueMm : 0) / 1000).toFixed(2)} m`;
}

function formatPercent(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;
}

function formatMin(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)} min`;
}

function downloadText(fileName: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function detectSourceType(file: File): CustomVectorSourceType | null {
  const name = file.name.toLowerCase();
  if (/\.(png|jpg|jpeg)$/i.test(name) || file.type.startsWith("image/")) {
    if (name.endsWith(".svg") || file.type.includes("svg")) return "svg";
    return "bitmap";
  }
  if (name.endsWith(".svg")) return "svg";
  if (name.endsWith(".dxf")) return "dxf";
  if (name.endsWith(".stl")) return "stl";
  return null;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readBitmap(file: File) {
  const dataUrl = await readAsDataUrl(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  const maxSide = 1400;
  const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo crear canvas para vectorizar la imagen.");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return {
    dataUrl,
    imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
    width: canvas.width,
    height: canvas.height,
  };
}

function escapeXml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildManualSvgPath(d: string, color = "#a78bfa") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RDSS_TEMPLATE_WIDTH_MM} ${RDSS_TEMPLATE_HEIGHT_MM}"><path fill="${color}" stroke="${color}" d="${escapeXml(d)}" /></svg>`;
}

function pathFill(path: CustomVectorPath) {
  if (path.noCut || path.operation === "grabado" || !path.closed) return "none";
  return `${path.color || layerById(path.layer).color}33`;
}

function messageClass(tone: UiMessage["tone"]) {
  if (tone === "error") return "border-red-500/40 bg-red-500/10 text-red-100";
  if (tone === "warn") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="rounded-[26px] border border-slate-800 bg-[#07111f] p-5 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-black text-white">{value}</div>
        </div>
        <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300">{icon}</div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#020617] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-base font-black text-white">{value}</div>
    </div>
  );
}

function SelectShell({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-[#020617] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
      >
        {children}
      </select>
    </label>
  );
}

function SheetPreview({ sheet }: { sheet?: NestedVectorSheet }) {
  if (!sheet) {
    return (
      <div className="flex aspect-[2/1] items-center justify-center rounded-[28px] border border-slate-800 bg-[#020617] text-center text-sm font-bold text-slate-500">
        Valida o genera vectores para ver el nesting 4x8.
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#020617] p-4">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs font-black text-slate-400">
        <span>
          Hoja {sheet.sheetNumber} - {sheet.materialLabel}
        </span>
        <span>
          {sheet.width} x {sheet.height} mm - Uso {sheet.usedAreaM2.toFixed(2)} m2
        </span>
      </div>
      <div className="relative aspect-[2/1] overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950">
        {sheet.pieces.map((piece) => {
          const material = materialById(piece.materialId);
          return (
            <div
              key={piece.id}
              className="absolute overflow-hidden rounded-md border border-cyan-100/40 p-1 text-[10px] font-black leading-tight text-slate-950 shadow-lg shadow-black/30"
              style={{
                left: `${(piece.x / sheet.width) * 100}%`,
                top: `${(piece.y / sheet.height) * 100}%`,
                width: `${Math.max(0.6, (piece.width / sheet.width) * 100)}%`,
                height: `${Math.max(1, (piece.height / sheet.height) * 100)}%`,
                backgroundColor: material.color,
              }}
            >
              <div className="truncate">{piece.groupLabel || piece.path.name}</div>
              <div>
                {formatMm(piece.width)} x {formatMm(piece.height)} - {piece.pathIds?.length || 1} path(s)
              </div>
              {piece.segmentLabel && <div>Modulo {piece.segmentLabel}</div>}
              {piece.requiresDivision && <div>Requiere division</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pointsToPolyline(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

function polylineLength(points: Array<{ x: number; y: number }>) {
  return points.slice(1).reduce((sum, point, index) => {
    const previous = points[index];
    return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

function pointAtProgress(points: Array<{ x: number; y: number }>, progress: number) {
  if (!points.length) return null;
  if (points.length === 1) return points[0];
  const target = polylineLength(points) * Math.max(0, Math.min(1, progress / 100));
  let walked = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const segmentLength = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (walked + segmentLength >= target) {
      const ratio = segmentLength > 0 ? (target - walked) / segmentLength : 0;
      return {
        x: previous.x + (current.x - previous.x) * ratio,
        y: previous.y + (current.y - previous.y) * ratio,
      };
    }
    walked += segmentLength;
  }

  return points[points.length - 1];
}

function simulationPlayback(result: CutSimulationResult | null, progress: number) {
  const segments = result?.simulatedSegments || [];
  if (!segments.length) return null;

  const trajectoryKeys = Array.from(new Set(segments.map((segment) => `${segment.pieceId}:${segment.pathId}`)));
  const trajectoryOrder = new Map(trajectoryKeys.map((key, index) => [key, index + 1]));
  const totalLength = segments.reduce((sum, segment) => sum + Math.max(segment.lengthMm, 1), 0);
  const target = totalLength * Math.max(0, Math.min(1, progress / 100));
  let walked = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const length = Math.max(segment.lengthMm, 1);
    if (walked + length >= target) {
      const localProgress = length > 0 ? ((target - walked) / length) * 100 : 100;
      const key = `${segment.pieceId}:${segment.pathId}`;
      return {
        segment,
        point: pointAtProgress(segment.compensatedPoints, localProgress),
        trajectoryIndex: trajectoryOrder.get(key) || 1,
        totalTrajectories: trajectoryKeys.length,
        segmentIndex: index + 1,
        totalSegments: segments.length,
        localProgress,
      };
    }
    walked += length;
  }

  const last = segments[segments.length - 1];
  const key = `${last.pieceId}:${last.pathId}`;
  return {
    segment: last,
    point: pointAtProgress(last.compensatedPoints, 100),
    trajectoryIndex: trajectoryOrder.get(key) || trajectoryKeys.length,
    totalTrajectories: trajectoryKeys.length,
    segmentIndex: segments.length,
    totalSegments: segments.length,
    localProgress: 100,
  };
}

function simulationStatusLabel(status: CutSimulationStatus) {
  if (status === "simulando") return "Simulando";
  if (status === "pausada") return "Pausada";
  if (status === "completada") return "Simulacion completada";
  if (status === "error") return "Error de validacion";
  return "Pendiente";
}

function SimulationPreview({
  result,
  status,
  progress,
}: {
  result: CutSimulationResult | null;
  status: CutSimulationStatus;
  progress: number;
}) {
  const firstPassSegments = (result?.simulatedSegments || []).filter((segment) => segment.passNumber === 1);
  const progressValue = status === "completada" ? 100 : progress;
  const playback = simulationPlayback(result, progressValue);
  const drillPoint = playback?.point || null;

  return (
    <div className="rounded-[28px] border border-slate-800 bg-[#020617] p-4">
      <div className="mb-3 flex flex-col gap-3 text-xs font-black text-slate-400 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1">Tablero 2440 x 1220 mm</span>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1">
            Total paths: {result?.trajectories || 0}
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1">
            Path {playback?.trajectoryIndex || 0} de {playback?.totalTrajectories || 0}
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1">
            {progressValue.toFixed(0)}% completado
          </span>
        </div>
        <span className={status === "error" ? "text-red-200" : status === "completada" ? "text-emerald-200" : "text-cyan-200"}>
          {simulationStatusLabel(status)}
        </span>
      </div>
      <div className="relative aspect-[2/1] overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950">
        <svg viewBox={`0 0 ${BOARD_WIDTH_MM} ${BOARD_HEIGHT_MM}`} className="h-full w-full">
          <rect x="0" y="0" width={BOARD_WIDTH_MM} height={BOARD_HEIGHT_MM} fill="#020617" />
          <g opacity="0.28">
            {Array.from({ length: 9 }, (_, index) => (
              <line key={`sim-v-${index}`} x1={index * 305} y1="0" x2={index * 305} y2={BOARD_HEIGHT_MM} stroke="#164e63" strokeWidth="1" />
            ))}
            {Array.from({ length: 5 }, (_, index) => (
              <line key={`sim-h-${index}`} x1="0" y1={index * 305} x2={BOARD_WIDTH_MM} y2={index * 305} stroke="#164e63" strokeWidth="1" />
            ))}
          </g>

          {firstPassSegments.map((segment) =>
            segment.removedAreaPoints.length > 2 ? (
              <polygon
                key={`${segment.id}-removed`}
                points={pointsToPolyline(segment.removedAreaPoints)}
                fill="#fb923c"
                opacity="0.12"
              />
            ) : null
          )}
          {firstPassSegments.map((segment) => (
            <polyline
              key={`${segment.id}-original`}
              points={pointsToPolyline(segment.originalPoints)}
              fill="none"
              stroke="#38bdf8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
              vectorEffect="non-scaling-stroke"
              opacity="0.9"
            />
          ))}
          {firstPassSegments.map((segment) => (
            <polyline
              key={`${segment.id}-compensated`}
              points={pointsToPolyline(segment.compensatedPoints)}
              fill="none"
              stroke="#fb923c"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={segment.operation === "grabado" ? "12 10" : undefined}
              strokeWidth="5"
              vectorEffect="non-scaling-stroke"
              opacity="0.95"
            />
          ))}
          {drillPoint && (
            <g>
              <circle cx={drillPoint.x} cy={drillPoint.y} r="20" fill="#fde68a" opacity="0.2" />
              <circle cx={drillPoint.x} cy={drillPoint.y} r="9" fill="#fef3c7" stroke="#f97316" strokeWidth="4" vectorEffect="non-scaling-stroke" />
            </g>
          )}
        </svg>

        {!firstPassSegments.length && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-bold text-slate-500">
            Ejecuta Simular corte para ver vector original, trayectoria compensada, broca y material retirado.
          </div>
        )}
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${status === "error" ? "bg-red-400" : "bg-gradient-to-r from-cyan-400 to-orange-400"}`}
          style={{ width: `${Math.max(0, Math.min(100, progressValue))}%` }}
        />
      </div>
      <div className="mt-4 grid gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 sm:grid-cols-4">
        <div className="flex items-center gap-2"><span className="h-2 w-6 rounded-full bg-sky-400" /> Vector original</div>
        <div className="flex items-center gap-2"><span className="h-2 w-6 rounded-full bg-orange-400" /> Trayectoria corte</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-100 shadow-lg shadow-amber-300" /> Broca</div>
        <div className="flex items-center gap-2"><span className="h-3 w-6 rounded bg-orange-400/30" /> Material retirado</div>
      </div>
    </div>
  );
}

export default function DisenosPersonalizadosCncPage() {
  const [source, setSource] = useState<UploadedSource | null>(null);
  const [paths, setPaths] = useState<CustomVectorPath[]>([]);
  const [selectedPathId, setSelectedPathId] = useState("");
  const [materialId, setMaterialId] = useState(RDSS_EVOLUTION_MATERIALS[0].id);
  const [operation, setOperation] = useState<CustomVectorOperation>("corte_exterior");
  const [quantity, setQuantity] = useState(1);
  const [scaleToMm, setScaleToMm] = useState(1);
  const [noiseCleanup, setNoiseCleanup] = useState(6);
  const [curveSmoothing, setCurveSmoothing] = useState(1);
  const [colorCount, setColorCount] = useState(6);
  const [vectorizationMode, setVectorizationMode] = useState<VectorizationMode>("objects_cnc");
  const [filterSummary, setFilterSummary] = useState<IndustrialVectorFilterSummary | null>(null);
  const [gapMm, setGapMm] = useState(DEFAULT_NESTING.gapMm);
  const [kerfMm, setKerfMm] = useState(DEFAULT_NESTING.kerfMm);
  const [allowRotate, setAllowRotate] = useState(DEFAULT_NESTING.allowRotate);
  const [divideOversize, setDivideOversize] = useState(DEFAULT_NESTING.divideOversize);
  const [validation, setValidation] = useState<CncValidationResult | null>(null);
  const [message, setMessage] = useState<UiMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [textValue, setTextValue] = useState("RDSS EVOLUTION");
  const [textSizeMm, setTextSizeMm] = useState(180);
  const [fontBuffer, setFontBuffer] = useState<ArrayBuffer | null>(null);
  const [fontName, setFontName] = useState("");
  const [simulationStatus, setSimulationStatus] = useState<CutSimulationStatus>("pendiente");
  const [simulationResult, setSimulationResult] = useState<CutSimulationResult | null>(null);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationErrors, setSimulationErrors] = useState<string[]>([]);
  const [simulationMode, setSimulationMode] = useState<CutSimulationMode>("proyecto");
  const [spaceWidthMm, setSpaceWidthMm] = useState(RDSS_TEMPLATE_WIDTH_MM);
  const [spaceHeightMm, setSpaceHeightMm] = useState(RDSS_TEMPLATE_HEIGHT_MM);
  const [spaceCoverage, setSpaceCoverage] = useState(92);
  const [calibrationPixels, setCalibrationPixels] = useState(1000);
  const [calibrationRealMm, setCalibrationRealMm] = useState(3000);

  const nestingOptions = useMemo(
    () => ({ gapMm, kerfMm, allowRotate, divideOversize }),
    [gapMm, kerfMm, allowRotate, divideOversize]
  );
  const sheets = useMemo(() => nestVectorPaths(paths, nestingOptions), [paths, nestingOptions]);
  const physicalGroups = useMemo(() => groupPhysicalVectorPieces(paths), [paths]);
  const materialSummaries = useMemo(() => summarizeNestingByMaterial(sheets), [sheets]);
  const selectedPath = paths.find((path) => path.id === selectedPathId) || paths[0];
  const activeSheet = sheets[selectedSheetIndex] || sheets[0];
  const materialOptimizationSummaries = useMemo(
    () =>
      materialSummaries.map((summary) => {
        const material = materialById(summary.materialId);
        const boardAreaM2 = (material.boardWidthMm * material.boardHeightMm) / 1_000_000;
        const sheetCount = Math.max(1, summary.sheets);
        const totalBoardAreaM2 = boardAreaM2 * sheetCount;
        const utilizationPct = totalBoardAreaM2 > 0 ? (summary.usedAreaM2 / totalBoardAreaM2) * 100 : 0;

        return {
          ...summary,
          boardWidthMm: material.boardWidthMm,
          boardHeightMm: material.boardHeightMm,
          boardAreaM2,
          freeAreaM2: Math.max(0, totalBoardAreaM2 - summary.usedAreaM2),
          utilizationPct,
        };
      }),
    [materialSummaries]
  );
  const activeSheetBoardAreaM2 = activeSheet ? (activeSheet.width * activeSheet.height) / 1_000_000 : 0;
  const activeSheetUsedAreaM2 = activeSheet?.usedAreaM2 || 0;
  const activeSheetFreeAreaM2 = Math.max(0, activeSheetBoardAreaM2 - activeSheetUsedAreaM2);
  const activeSheetUtilizationPct =
    activeSheetBoardAreaM2 > 0 ? (activeSheetUsedAreaM2 / activeSheetBoardAreaM2) * 100 : 0;
  const activePaths = paths.filter((path) => !path.noCut && path.operation !== "no_cortar");
  const activeMaterials = Array.from(new Set(activePaths.map((path) => path.materialId)));
  const totalNestedPieces = sheets.reduce((sum, sheet) => sum + sheet.pieces.length, 0);
  const cncMinutes = estimateCncMinutes(paths);
  const sourceScaleSuggestion = useMemo(() => {
    const sourceWidth = source?.imageWidth || RDSS_TEMPLATE_WIDTH_MM;
    const sourceHeight = source?.imageHeight || RDSS_TEMPLATE_HEIGHT_MM;
    const coverage = Math.max(10, Math.min(100, spaceCoverage)) / 100;
    const scale = Math.min((spaceWidthMm * coverage) / sourceWidth, (spaceHeightMm * coverage) / sourceHeight);
    return Number(Math.max(0.0001, scale).toFixed(4));
  }, [source?.imageWidth, source?.imageHeight, spaceWidthMm, spaceHeightMm, spaceCoverage]);
  const sourcePhysicalWidthMm = Math.round((source?.imageWidth || RDSS_TEMPLATE_WIDTH_MM) * scaleToMm);
  const sourcePhysicalHeightMm = Math.round((source?.imageHeight || RDSS_TEMPLATE_HEIGHT_MM) * scaleToMm);
  const largestPhysicalGroup = physicalGroups[0];
  const oversizedGroups = physicalGroups.filter((group) => group.requiresDivision);
  const projectedCoverageWidth = spaceWidthMm > 0 ? Math.min(999, Math.round((sourcePhysicalWidthMm / spaceWidthMm) * 100)) : 0;
  const projectedCoverageHeight = spaceHeightMm > 0 ? Math.min(999, Math.round((sourcePhysicalHeightMm / spaceHeightMm) * 100)) : 0;
  const calibrationScale = calibrationPixels > 0 ? Number((calibrationRealMm / calibrationPixels).toFixed(4)) : 0;
  const liveSimulationPlayback = simulationPlayback(simulationResult, simulationStatus === "completada" ? 100 : simulationProgress);
  const liveWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (source?.sourceType === "bitmap" && !paths.length) {
      warnings.push("La imagen esta cargada solo como referencia. Genera vector IA antes de validar o exportar CNC.");
    }
    if (source?.sourceType === "stl" && !paths.length) {
      warnings.push("STL cargado solo como referencia 3D. Este modulo no genera CNC desde STL.");
    }
    if (paths.some((path) => path.sourceType === "bitmap")) {
      warnings.push("Los vectores nacieron de imagen raster; revisa los paths y asigna material antes de generar NC.");
    }
    if (paths.some((path) => path.sourceType === "stl")) {
      warnings.push("Hay paths STL heredados. Revisalos como referencia; para relieve 3D se necesita CAM/postprocesador 3D.");
    }
    if (physicalGroups.some((group) => group.boundsMm.width > BOARD_WIDTH_MM || group.boundsMm.height > BOARD_HEIGHT_MM)) {
      warnings.push("Hay objetos fisicos mayores de 2440 x 1220 mm. El modo A/B debe permanecer activo.");
    }
    return warnings;
  }, [paths, physicalGroups, source]);
  const productionChecklist = [
    { label: "Archivo cargado", ok: !!source },
    { label: "Paths CNC generados", ok: paths.length > 0 },
    { label: "Materiales y brocas asignados", ok: activePaths.length > 0 && activePaths.every((path) => Boolean(path.materialId && path.toolId && path.layer)) },
    { label: "Escala real en mm", ok: Number.isFinite(scaleToMm) && scaleToMm > 0 },
    { label: "Nesting por material", ok: sheets.length > 0 && totalNestedPieces > 0 },
    { label: "Division A/B si excede 4x8", ok: !oversizedGroups.length || divideOversize },
    { label: "Validacion CNC aprobada", ok: Boolean(validation?.ok) },
  ];
  const productionReadyCount = productionChecklist.filter((item) => item.ok).length;
  const productionReady = productionReadyCount === productionChecklist.length;

  useEffect(() => {
    setSelectedSheetIndex((current) => (current < sheets.length ? current : Math.max(0, sheets.length - 1)));
  }, [sheets.length]);

  useEffect(() => {
    setSimulationStatus("pendiente");
    setSimulationResult(null);
    setSimulationProgress(0);
    setSimulationErrors([]);
  }, [paths, selectedSheetIndex, gapMm, kerfMm, allowRotate, divideOversize, simulationMode]);

  useEffect(() => {
    if (simulationStatus !== "simulando" || !simulationResult?.simulatedSegments.length) return;

    const durationMs = Math.max(2800, Math.min(14000, simulationResult.estimatedMinutes * 1600));
    const increment = 100 / Math.max(1, durationMs / 120);
    const timer = window.setInterval(() => {
      setSimulationProgress((current) => {
        const nextProgress = Math.min(100, current + increment);
        if (nextProgress >= 100) {
          window.clearInterval(timer);
          setSimulationStatus("completada");
        }
        return nextProgress;
      });
    }, 120);

    return () => window.clearInterval(timer);
  }, [simulationResult, simulationStatus]);

  function resetSimulationState() {
    setSimulationStatus("pendiente");
    setSimulationResult(null);
    setSimulationProgress(0);
    setSimulationErrors([]);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const sourceType = detectSourceType(file);
    if (!sourceType) {
      setMessage({ tone: "error", text: "Formato no soportado. Usa PNG, JPG, SVG, DXF o STL." });
      return;
    }

    setBusy(true);
    setValidation(null);
    setFilterSummary(null);
    resetSimulationState();
    try {
      if (sourceType === "bitmap") {
        const bitmap = await readBitmap(file);
        const autoScale = Math.min(RDSS_TEMPLATE_WIDTH_MM / bitmap.width, RDSS_TEMPLATE_HEIGHT_MM / bitmap.height);
        setSource({
          fileName: file.name,
          sourceType,
          dataUrl: bitmap.dataUrl,
          imageData: bitmap.imageData,
          imageWidth: bitmap.width,
          imageHeight: bitmap.height,
        });
        setScaleToMm(Number(autoScale.toFixed(4)));
        setPaths([]);
        setSelectedPathId("");
        setMessage({ tone: "warn", text: `${file.name} quedo como referencia. Ejecuta Generar Vector IA para crear paths CNC.` });
        return;
      }

      if (sourceType === "stl") {
        setSource({ fileName: file.name, sourceType });
        setScaleToMm(1);
        setPaths([]);
        setSelectedPathId("");
        setMessage({
          tone: "warn",
          text: `${file.name} cargado como referencia 3D. Este modulo no convierte STL a CNC; usa CAM 3D/postprocesador dedicado para mecanizado real.`,
        });
        return;
      }

      const text = await file.text();
      setSource({ fileName: file.name, sourceType, text });
      setPaths([]);
      setSelectedPathId("");
      setMessage({ tone: "ok", text: `${file.name} cargado. Puedes generar los paths y asignar capas CNC.` });
    } catch (error) {
      setMessage({ tone: "error", text: `No se pudo cargar el archivo: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setBusy(false);
    }
  }

  async function generateVectorAI() {
    if (!source) {
      setMessage({ tone: "warn", text: "Primero sube un PNG, JPG, SVG o DXF. STL se acepta solo como referencia 3D." });
      return;
    }

    setBusy(true);
    setValidation(null);
    resetSimulationState();
    try {
      let records: CustomVectorPath[] = [];

      if (source.sourceType === "stl") {
        setPaths([]);
        setSelectedPathId("");
        setFilterSummary(null);
        setMessage({
          tone: "warn",
          text: "STL queda como referencia 3D: no se vectoriza, no se anida y no genera DXF/NC desde este modulo. Para relieve o talla 3D hace falta CAM real.",
        });
        return;
      }

      if (source.sourceType === "bitmap") {
        if (!source.imageData) throw new Error("La imagen no tiene datos disponibles para vectorizar.");
        const module = (await import("imagetracerjs")) as ImageTracerModule;
        const trace = module.imagedataToSVG || module.default?.imagedataToSVG;
        if (!trace) throw new Error("No se encontro el motor ImageTracer.");
        const svgText = trace(source.imageData, {
          numberofcolors: colorCount,
          ltres: Math.max(0.1, curveSmoothing),
          qtres: Math.max(0.1, curveSmoothing),
          pathomit: Math.max(0, noiseCleanup),
          rightangleenhance: true,
          strokewidth: 1,
          blurradius: 0,
        });
        records = createSvgPathRecords({
          svgText,
          sourceType: "bitmap",
          sourceFileName: source.fileName,
          scaleToMm,
          materialId,
          operation,
          quantity,
        });
      } else if (source.sourceType === "svg") {
        records = createSvgPathRecords({
          svgText: source.text || "",
          sourceType: "svg",
          sourceFileName: source.fileName,
          scaleToMm,
          materialId,
          operation,
          quantity,
        });
      } else if (source.sourceType === "dxf") {
        records = createDxfPathRecords({
          dxfText: source.text || "",
          sourceFileName: source.fileName,
          scaleToMm,
          materialId,
          operation,
          quantity,
        });
      }

      const filterResult = filterIndustrialVectorPaths(records, {
        mode: vectorizationMode,
        minPathLengthMm: 20,
        minClosedAreaMm2: 100,
      });
      records = applyAiMaterialClassifier(filterResult.kept);
      const groupedObjects = groupPhysicalVectorPieces(records);
      setFilterSummary(filterResult.summary);

      if (!records.length) {
        const suffix =
          filterResult.summary.removed > 0
            ? ` El detector de objetos descarto ${filterResult.summary.removed} trazos; cambia a Bitmap si necesitas revisarlos como referencia.`
            : "";
        setMessage({ tone: "error", text: `No se detectaron paths utiles. Ajusta limpieza/suavizado o prueba otro archivo.${suffix}` });
        return;
      }

      setPaths(records);
      setSelectedPathId(records[0].id);
      const roleCounts = filterResult.summary.roleCounts;
      const textGroups = filterResult.summary.roleGroups.texto || 0;
      setMessage({
        tone: "ok",
        text:
          vectorizationMode === "objects_cnc"
            ? `Objetos CNC detectados: ${records.length} paths, ${groupedObjects.length} objetos agrupados. Ondas ${roleCounts.onda_principal || 0}, logo ${roleCounts.logo_rdss || 0}, textos ${textGroups} grupos, CAD ${roleCounts.cad_cocina || 0}. Revisa materiales y valida CNC.`
            : `Bitmap vectorizado: ${records.length} paths revisables. Usa Objetos CNC antes de exportar produccion real.`,
      });
    } catch (error) {
      setMessage({ tone: "error", text: `Error vectorizando: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setBusy(false);
    }
  }

  async function handleFontUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFontBuffer(await file.arrayBuffer());
    setFontName(file.name);
    setMessage({ tone: "ok", text: `Fuente ${file.name} lista para convertir textos a curvas.` });
  }

  async function convertTextToCurves() {
    if (!fontBuffer) {
      setMessage({ tone: "warn", text: "Sube una fuente TTF/OTF para convertir el texto a paths reales." });
      return;
    }

    setBusy(true);
    try {
      const module = (await import("opentype.js")) as OpenTypeModule;
      const parse = module.parse || module.default?.parse;
      if (!parse) throw new Error("No se encontro el motor opentype.");
      const font = parse(fontBuffer);
      const fontPath = font.getPath(textValue, 0, textSizeMm, textSizeMm);
      const d = fontPath.toPathData(2);
      const records = applyAiMaterialClassifier(
        createSvgPathRecords({
          svgText: buildManualSvgPath(d, layerById("CAPA_TEXTOS").color),
          sourceType: "texto",
          sourceFileName: fontName || "texto-a-curvas.svg",
          scaleToMm: 1,
          materialId,
          operation,
          quantity: 1,
        }).map((path) =>
          updateVectorAssignment(
            {
              ...path,
              name: `Texto: ${textValue}`,
              vectorRole: "texto",
              color: layerById("CAPA_TEXTOS").color,
            },
            { layer: "CAPA_TEXTOS", operation }
          )
        )
      );
      setPaths((current) => [...records, ...current]);
      setSelectedPathId(records[0]?.id || "");
      resetSimulationState();
      setMessage({ tone: "ok", text: "Texto convertido a curvas SVG. Ya no depende de fuentes instaladas." });
    } catch (error) {
      setMessage({ tone: "error", text: `Error convirtiendo texto: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setBusy(false);
    }
  }

  function updateSelectedAssignment(patch: Parameters<typeof updateVectorAssignment>[1]) {
    if (!selectedPath) return;
    setPaths((current) => current.map((path) => (path.id === selectedPath.id ? updateVectorAssignment(path, patch) : path)));
    setValidation(null);
    resetSimulationState();
  }

  function updateSelectedRaw(patch: Partial<Pick<CustomVectorPath, "quantity" | "name" | "notes">>) {
    if (!selectedPath) return;
    setPaths((current) =>
      current.map((path) =>
        path.id === selectedPath.id
          ? {
              ...path,
              ...patch,
              quantity: patch.quantity !== undefined ? Math.max(1, Math.floor(patch.quantity || 1)) : path.quantity,
            }
          : path
      )
    );
    setValidation(null);
    resetSimulationState();
  }

  function deleteSelectedPath() {
    if (!selectedPath) return;
    setPaths((current) => current.filter((path) => path.id !== selectedPath.id));
    setSelectedPathId("");
    setValidation(null);
    resetSimulationState();
  }

  function simulateCutNow() {
    if (simulationStatus === "pausada" && simulationResult?.simulatedSegments.length) {
      setSimulationStatus("simulando");
      setMessage({ tone: "ok", text: "Simulacion reanudada." });
      return;
    }

    if (simulationStatus === "completada" && simulationResult?.simulatedSegments.length) {
      setSimulationProgress(0);
    }

    const selectedIsActive = selectedPath && !selectedPath.noCut && selectedPath.operation !== "no_cortar";
    const pathsToSimulate = simulationMode === "pieza" ? (selectedIsActive ? [selectedPath] : []) : activePaths;

    if (!pathsToSimulate.length) {
      const errors = [
        simulationMode === "pieza"
          ? "Selecciona un path activo para simular una pieza individual."
          : "Genera vectores activos antes de simular el proyecto completo.",
      ];
      setSimulationResult(null);
      setSimulationErrors(errors);
      setSimulationProgress(0);
      setSimulationStatus("error");
      setMessage({ tone: "error", text: errors[0] });
      return;
    }

    const result = estimateCutSimulation(pathsToSimulate, undefined, undefined, sheets, DEFAULT_CUT_PASS_DEPTH_MM);
    setSimulationResult(result);
    setSimulationProgress(0);

    if (!result.simulatedSegments.length) {
      const errors = result.warnings.length ? result.warnings : ["La simulacion no produjo trayectorias validas."];
      setSimulationErrors(errors);
      setSimulationStatus("error");
      setMessage({ tone: "error", text: "La simulacion encontro errores de validacion antes de mover la broca." });
      return;
    }

    setSimulationErrors(result.warnings);
    setSimulationStatus("simulando");
    const modeLabel = simulationMode === "proyecto" ? "proyecto completo" : selectedPath?.name || "pieza individual";
    setMessage({
      tone: result.warnings.length ? "warn" : "ok",
      text: result.warnings.length
        ? `Simulando ${modeLabel} con ${result.warnings.length} advertencia(s): ${result.trajectories} trayectoria(s), ${result.passes} pasada(s).`
        : `Simulando ${modeLabel}: ${result.trajectories} trayectoria(s), ${result.passes} pasada(s), ${formatMin(result.estimatedMinutes)} estimados.`,
    });
  }

  function pauseSimulation() {
    if (simulationStatus !== "simulando") return;
    setSimulationStatus("pausada");
    setMessage({ tone: "warn", text: "Simulacion pausada." });
  }

  function restartSimulation() {
    setSimulationProgress(0);
    if (simulationResult?.simulatedSegments.length) {
      setSimulationStatus("pendiente");
      setMessage({ tone: "ok", text: "Simulacion reiniciada. Pulsa iniciar para recorrer el proyecto." });
    }
  }

  function validateNow() {
    const result = validateCncProject(paths, sheets, nestingOptions);
    setValidation(result);
    setMessage({
      tone: result.ok ? "ok" : "error",
      text: result.ok ? "Validacion CNC aprobada. El paquete se puede exportar." : "La validacion encontro bloqueos antes de generar NC.",
    });
    return result;
  }

  function exportPackage() {
    const result = validateNow();
    if (!result.ok) return;

    const stamp = sanitizeFileName(`RDSS_EVOLUTION_${Date.now()}`);
    const usedLayers = CNC_LAYERS.filter((layer) => paths.some((path) => path.layer === layer.id));

    usedLayers.forEach((layer) => {
      downloadText(`${stamp}_${sanitizeFileName(layer.id)}.svg`, buildSvgByLayer(paths, layer.id), "image/svg+xml");
    });

    activeMaterials.forEach((id) => {
      const dxf = buildDxfByMaterial(paths, id);
      downloadText(`${stamp}_${dxf.fileName}`, dxf.content, "application/dxf");
    });

    downloadText(`${stamp}_lista_piezas.csv`, buildCsv(paths, sheets), "text/csv");
    downloadText(`${stamp}_proyecto.json`, buildProjectJson(paths, sheets, result), "application/json");
    buildNcPrograms(sheets).forEach((program) => {
      downloadText(`${stamp}_${program.fileName}`, program.content, "text/plain");
    });

    setMessage({ tone: "ok", text: "Paquete CNC exportado: SVG por capa, DXF por material, CSV, JSON y NC." });
  }

  function applySpacePreset(preset: (typeof SPACE_PRESETS)[number]) {
    setSpaceWidthMm(preset.widthMm);
    setSpaceHeightMm(preset.heightMm);
    setSpaceCoverage(preset.coverage);
    setValidation(null);
    resetSimulationState();
    setMessage({
      tone: "ok",
      text: `Preset aplicado: ${preset.label} (${formatMm(preset.widthMm)} x ${formatMm(preset.heightMm)}).`,
    });
  }

  function useSourceWidthForCalibration() {
    if (!source?.imageWidth) {
      setMessage({ tone: "warn", text: "Sube una imagen o vector antes de usar el ancho como calibracion." });
      return;
    }
    const realWidth = Math.max(100, Math.round(spaceWidthMm * (Math.max(10, Math.min(100, spaceCoverage)) / 100)));
    setCalibrationPixels(source.imageWidth);
    setCalibrationRealMm(realWidth);
    setMessage({ tone: "ok", text: `Calibracion preparada: ancho del archivo = ${formatMm(realWidth)} reales.` });
  }

  function applyCalibrationScale() {
    if (!Number.isFinite(calibrationScale) || calibrationScale <= 0) {
      setMessage({ tone: "error", text: "La calibracion necesita pixeles y milimetros reales mayores que cero." });
      return;
    }
    const nextWidthMm = Math.round((source?.imageWidth || RDSS_TEMPLATE_WIDTH_MM) * calibrationScale);
    const nextHeightMm = Math.round((source?.imageHeight || RDSS_TEMPLATE_HEIGHT_MM) * calibrationScale);
    setScaleToMm(calibrationScale);
    setValidation(null);
    resetSimulationState();
    setMessage({
      tone: "ok",
      text: `Calibracion aplicada: 1 px = ${calibrationScale} mm. Render real ${formatMm(nextWidthMm)} x ${formatMm(nextHeightMm)}.`,
    });
  }

  function savePackage() {
    const payload = {
      source: source ? { ...source, imageData: undefined } : null,
      paths,
      sheets,
      nestingOptions,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem("rdwood-custom-vector-cnc-package", JSON.stringify(payload));
    setMessage({ tone: "ok", text: "Paquete guardado localmente para continuar la revision luego." });
  }

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-6 text-white sm:px-6 lg:px-10">
      <section className="mx-auto max-w-[1780px] space-y-6">
        <header className="rounded-[32px] border border-cyan-500/20 bg-gradient-to-br from-[#07111f] via-[#08182c] to-[#111c4a] p-6 shadow-2xl shadow-black/40 lg:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.34em] text-cyan-200">
                <Sparkles size={16} />
                Vector IA + CNC 2D seguro
              </div>
              <h1 className="mt-5 text-4xl font-black leading-tight text-white lg:text-6xl">
                Diseños Personalizados CNC
              </h1>
              <p className="mt-3 max-w-4xl text-sm font-bold leading-relaxed text-slate-300 lg:text-base">
                Convierte PNG/JPG/SVG/DXF simples en vectores 2D revisables para logos, textos, ondas, patrones y piezas planas. STL queda solo como referencia 3D, sin salida directa a CNC.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="/corte"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-700 px-5 text-sm font-black text-slate-200 hover:border-cyan-400"
              >
                <ArrowLeft size={18} />
                Volver
              </a>
              <button
                onClick={validateNow}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-950 hover:bg-cyan-100"
              >
                <ShieldCheck size={18} />
                Validar CNC
              </button>
              <button
                onClick={simulateCutNow}
                disabled={!activePaths.length || simulationStatus === "simulando"}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-400 px-5 text-sm font-black text-slate-950 hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlayCircle size={18} />
                Simular proyecto
              </button>
              <button
                onClick={exportPackage}
                disabled={!paths.length}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-lime-400 px-5 text-sm font-black text-slate-950 hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Package size={18} />
                Exportar paquete CNC
              </button>
            </div>
          </div>
        </header>

        {message && (
          <div className={`rounded-2xl border px-5 py-4 text-sm font-black ${messageClass(message.tone)}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Stat label="Paths" value={paths.length} icon={<Layers3 size={22} />} />
          <Stat label="Objetos" value={physicalGroups.length} icon={<Grid2X2 size={22} />} />
          <Stat label="Piezas fisicas" value={totalNestedPieces} icon={<Box size={22} />} />
          <Stat label="Hojas 4x8" value={sheets.length} icon={<FileText size={22} />} />
          <Stat label="Materiales" value={activeMaterials.length} icon={<Package size={22} />} />
          <Stat label="Tiempo" value={formatMin(cncMinutes)} icon={<Cpu size={22} />} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)_420px]">
          <aside className="space-y-5">
            <section className="rounded-[28px] border border-cyan-500/25 bg-[#07111f] p-5 shadow-xl shadow-black/25">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Entrada</div>
                  <h2 className="mt-2 text-2xl font-black">Generar Vector IA</h2>
                </div>
                <Wand2 className="text-cyan-300" size={28} />
              </div>

              <label className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-cyan-400/40 bg-cyan-500/10 px-4 py-8 text-center hover:border-cyan-300 hover:bg-cyan-500/15">
                <Upload className="text-cyan-300" size={34} />
                <span className="mt-3 text-lg font-black text-cyan-50">Subir PNG, JPG, SVG, DXF o STL</span>
                <span className="mt-1 text-xs font-bold text-slate-400">PNG/JPG/SVG/DXF generan paths 2D; STL se guarda solo como referencia 3D.</span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg,.dxf,.stl,image/png,image/jpeg,image/svg+xml,model/stl,application/sla,application/vnd.ms-pki.stl"
                  className="hidden"
                  onChange={handleUpload}
                />
              </label>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Mini label="Archivo" value={source?.fileName || "Sin archivo"} />
                <Mini label="Tipo" value={source?.sourceType || "Pendiente"} />
              </div>

              {source?.dataUrl && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-[#020617]">
                  <img src={source.dataUrl} alt="Referencia cargada" className="h-44 w-full object-contain" />
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-cyan-500/25 bg-[#020617] p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Modo de vectorizacion</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVectorizationMode("bitmap")}
                    className={`rounded-xl border px-3 py-3 text-left text-xs font-black transition ${
                      vectorizationMode === "bitmap"
                        ? "border-purple-300 bg-purple-500/20 text-purple-100"
                        : "border-slate-800 bg-slate-950 text-slate-500 hover:border-slate-600"
                    }`}
                  >
                    {vectorizationMode === "bitmap" ? "[?]" : "[ ]"} Bitmap
                  </button>
                  <button
                    type="button"
                    onClick={() => setVectorizationMode("objects_cnc")}
                    className={`rounded-xl border px-3 py-3 text-left text-xs font-black transition ${
                      vectorizationMode === "objects_cnc"
                        ? "border-cyan-300 bg-cyan-500/20 text-cyan-100"
                        : "border-slate-800 bg-slate-950 text-slate-500 hover:border-slate-600"
                    }`}
                  >
                    {vectorizationMode === "objects_cnc" ? "[?]" : "[ ]"} Objetos CNC
                  </button>
                </div>
                <p className="mt-3 text-xs font-bold leading-relaxed text-slate-400">
                  Objetos CNC no manda píxeles a producción. Conserva solo logo RDSS, textos corporativos, ondas nogal,
                  plano CAD cocina y arbol decorativo. Bloquea piso, pared, ranuras, sombras, reflejos, LED y texturas.
                </p>
              </div>

              <div className="mt-5 grid gap-3">
                <SelectShell label="Material base" value={materialId} onChange={setMaterialId}>
                  {RDSS_EVOLUTION_MATERIALS.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.label}
                    </option>
                  ))}
                </SelectShell>

                <SelectShell label="Operacion inicial" value={operation} onChange={(value) => setOperation(value as CustomVectorOperation)}>
                  {OPERATION_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </SelectShell>

                <div className="grid grid-cols-3 gap-3">
                  <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Escala px-mm
                    <input
                      type="number"
                      step="0.0001"
                      value={scaleToMm}
                      onChange={(event) => setScaleToMm(Math.max(0.0001, Number(event.target.value) || 1))}
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-[#020617] px-3 text-sm font-bold text-white outline-none focus:border-cyan-400"
                    />
                  </label>
                  <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Cantidad
                    <input
                      type="number"
                      value={quantity}
                      onChange={(event) => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-[#020617] px-3 text-sm font-bold text-white outline-none focus:border-cyan-400"
                    />
                  </label>
                  <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Colores
                    <input
                      type="number"
                      value={colorCount}
                      onChange={(event) => setColorCount(Math.max(2, Math.min(16, Math.floor(Number(event.target.value) || 6))))}
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-[#020617] px-3 text-sm font-bold text-white outline-none focus:border-cyan-400"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Limpiar ruido
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={noiseCleanup}
                      onChange={(event) => setNoiseCleanup(Number(event.target.value))}
                      className="mt-4 w-full accent-cyan-400"
                    />
                  </label>
                  <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Suavizar curvas
                    <input
                      type="range"
                      min="0.2"
                      max="4"
                      step="0.1"
                      value={curveSmoothing}
                      onChange={(event) => setCurveSmoothing(Number(event.target.value))}
                      className="mt-4 w-full accent-cyan-400"
                    />
                  </label>
                </div>

                {filterSummary && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200">
                          Detector de objetos CNC
                        </div>
                        <div className="mt-1 text-sm font-black text-white">
                          {filterSummary.mode === "objects_cnc" ? "Objetos CNC" : "Bitmap"}
                        </div>
                      </div>
                      <div className="text-right text-xs font-black text-slate-300">
                        <div>Conservados: {filterSummary.kept}</div>
                        <div>Eliminados: {filterSummary.removed}</div>
                      </div>
                    </div>
                    {filterSummary.mode === "objects_cnc" && (
                      <div className="mt-3 grid gap-2">
                        {filterSummary.expected.map((item) => (
                          <div
                            key={item.role}
                            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[11px] font-black ${
                              item.ok
                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                : "border-amber-400/25 bg-amber-400/10 text-amber-100"
                            }`}
                          >
                            <span>{item.label}</span>
                            <span>
                              {item.count}/{item.min}-{item.max} {item.unit}
                            </span>
                          </div>
                        ))}
                        <div
                          className={`rounded-xl border px-3 py-2 text-[11px] font-black ${
                            filterSummary.totalExpected.ok
                              ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
                              : "border-amber-400/25 bg-amber-400/10 text-amber-100"
                          }`}
                        >
                          Total detectado: {filterSummary.kept}/{filterSummary.totalExpected.min}-{filterSummary.totalExpected.max} paths
                        </div>
                      </div>
                    )}
                    {Object.entries(filterSummary.reasons).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(filterSummary.reasons).map(([reason, count]) => (
                          <span key={reason} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
                            {reason}: {count}
                          </span>
                        ))}
                      </div>
                    )}
                    {filterSummary.warnings.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {filterSummary.warnings.slice(0, 4).map((warning, index) => (
                          <div key={`filter-warning-${index}-${warning}`} className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-100">
                            {warning}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={generateVectorAI}
                disabled={busy || !source}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-3 font-black text-slate-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Wand2 size={18} />
                {busy ? "Procesando..." : "Generar Vector IA"}
              </button>
            </section>

            <section className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5 shadow-xl shadow-black/20">
              <div className="flex items-center gap-3">
                <Type className="text-cyan-300" size={22} />
                <h2 className="text-xl font-black">Texto a curvas</h2>
              </div>
              <div className="mt-4 grid gap-3">
                <input
                  value={textValue}
                  onChange={(event) => setTextValue(event.target.value)}
                  className="h-12 rounded-2xl border border-slate-700 bg-[#020617] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={textSizeMm}
                    onChange={(event) => setTextSizeMm(Math.max(10, Number(event.target.value) || 180))}
                    className="h-12 rounded-2xl border border-slate-700 bg-[#020617] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                  />
                  <label className="flex h-12 cursor-pointer items-center justify-center rounded-2xl border border-slate-700 bg-[#020617] px-4 text-sm font-black text-slate-200 hover:border-cyan-400">
                    {fontName || "Subir fuente"}
                    <input type="file" accept=".ttf,.otf,font/*" className="hidden" onChange={handleFontUpload} />
                  </label>
                </div>
                <button
                  onClick={convertTextToCurves}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-500 px-5 py-3 font-black text-white hover:bg-purple-400 disabled:opacity-50"
                >
                  <Type size={18} />
                  Convertir texto
                </button>
              </div>
            </section>

            <section className="rounded-[28px] border border-cyan-500/20 bg-[#07111f] p-5 shadow-xl shadow-black/20">
              <div className="flex items-center gap-3">
                <Ruler className="text-cyan-300" size={22} />
                <h2 className="text-xl font-black">Espacio de instalacion</h2>
              </div>
              <p className="mt-2 text-xs font-bold leading-relaxed text-slate-400">
                Plantilla RDSS EVOLUTION por defecto: 4400 x 2900 mm. El sistema propone la escala para que el diseno quepa con margen antes de vectorizar.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {SPACE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applySpacePreset(preset)}
                    className="min-h-[68px] rounded-2xl border border-slate-800 bg-[#020617] px-3 py-3 text-left hover:border-cyan-400 hover:bg-cyan-500/10"
                  >
                    <div className="text-xs font-black text-white">{preset.label}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200">
                      {formatMeters(preset.widthMm)} x {formatMeters(preset.heightMm)}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Ancho mm
                  <input
                    type="number"
                    value={spaceWidthMm}
                    onChange={(event) => setSpaceWidthMm(Math.max(100, Number(event.target.value) || RDSS_TEMPLATE_WIDTH_MM))}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-[#020617] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                  />
                </label>
                <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Alto mm
                  <input
                    type="number"
                    value={spaceHeightMm}
                    onChange={(event) => setSpaceHeightMm(Math.max(100, Number(event.target.value) || RDSS_TEMPLATE_HEIGHT_MM))}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-[#020617] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                  />
                </label>
              </div>
              <label className="mt-4 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Ocupacion segura {spaceCoverage}%
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={spaceCoverage}
                  onChange={(event) => setSpaceCoverage(Number(event.target.value))}
                  className="mt-4 w-full accent-cyan-400"
                />
              </label>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Mini label="Escala sugerida" value={`${sourceScaleSuggestion}x`} />
                <Mini label="Referencia" value={`${spaceWidthMm} x ${spaceHeightMm}`} />
              </div>
              <div className="mt-4 rounded-3xl border border-slate-800 bg-[#020617] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Calibracion por medida conocida</div>
                <p className="mt-2 text-xs font-bold leading-relaxed text-slate-500">
                  Usa una distancia real del render, por ejemplo una pared de 3000 mm, para ajustar la escala industrial.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Pixeles
                    <input
                      type="number"
                      value={calibrationPixels}
                      onChange={(event) => setCalibrationPixels(Math.max(1, Number(event.target.value) || 1))}
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-[#020617] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                    />
                  </label>
                  <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Real mm
                    <input
                      type="number"
                      value={calibrationRealMm}
                      onChange={(event) => setCalibrationRealMm(Math.max(1, Number(event.target.value) || 1))}
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-[#020617] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                    />
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Mini label="1 px =" value={`${calibrationScale} mm`} />
                  <Mini label="Calibrado" value={`${formatMm(Math.round((source?.imageWidth || 0) * calibrationScale))}`} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={useSourceWidthForCalibration}
                    disabled={!source?.imageWidth}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-slate-700 px-3 text-xs font-black text-slate-200 hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Ancho archivo
                  </button>
                  <button
                    type="button"
                    onClick={applyCalibrationScale}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-3 text-xs font-black text-slate-950 hover:bg-cyan-400"
                  >
                    Aplicar escala
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setScaleToMm(sourceScaleSuggestion);
                  setMessage({ tone: "ok", text: `Proporcion aplicada: ${sourceScaleSuggestion}x para ${spaceWidthMm} x ${spaceHeightMm} mm.` });
                }}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-3 font-black text-cyan-100 hover:bg-cyan-500/20"
              >
                <Ruler size={18} />
                Aplicar proporcion al vector
              </button>
            </section>

            <section className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5 shadow-xl shadow-black/20">
              <div className="flex items-center gap-3">
                <Settings className="text-cyan-300" size={22} />
                <h2 className="text-xl font-black">Nesting 4x8</h2>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Separacion
                  <input
                    type="number"
                    value={gapMm}
                    onChange={(event) => setGapMm(Math.max(0, Number(event.target.value) || 0))}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-[#020617] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                  />
                </label>
                <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Kerf
                  <input
                    type="number"
                    value={kerfMm}
                    onChange={(event) => setKerfMm(Math.max(0, Number(event.target.value) || 0))}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-[#020617] px-4 text-sm font-bold text-white outline-none focus:border-cyan-400"
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#020617] px-4 py-3 text-sm font-black">
                  Rotacion automatica 0/90
                  <input type="checkbox" checked={allowRotate} onChange={(event) => setAllowRotate(event.target.checked)} className="h-5 w-5 accent-cyan-400" />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#020617] px-4 py-3 text-sm font-black">
                  Dividir ondas mayores A/B
                  <input
                    type="checkbox"
                    checked={divideOversize}
                    onChange={(event) => setDivideOversize(event.target.checked)}
                    className="h-5 w-5 accent-cyan-400"
                  />
                </label>
              </div>
            </section>
          </aside>

          <section className="space-y-5">
            <section className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5 shadow-xl shadow-black/20">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">RDSS EVOLUTION</div>
                  <h2 className="mt-2 text-2xl font-black">Plantilla 4400 x 2900 mm</h2>
                </div>
                <div className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-100">
                  Referencia visual + paths CNC
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-800 bg-[#020617] p-4">
                <div className="relative aspect-[44/29] w-full overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950">
                  <svg viewBox={`0 0 ${RDSS_TEMPLATE_WIDTH_MM} ${RDSS_TEMPLATE_HEIGHT_MM}`} className="h-full w-full">
                    <rect x="0" y="0" width={RDSS_TEMPLATE_WIDTH_MM} height={RDSS_TEMPLATE_HEIGHT_MM} fill="#020617" />
                    <g opacity="0.3">
                      {Array.from({ length: 11 }, (_, index) => (
                        <line key={`v-${index}`} x1={index * 440} y1="0" x2={index * 440} y2={RDSS_TEMPLATE_HEIGHT_MM} stroke="#164e63" strokeWidth="1" />
                      ))}
                      {Array.from({ length: 8 }, (_, index) => (
                        <line key={`h-${index}`} x1="0" y1={index * 414} x2={RDSS_TEMPLATE_WIDTH_MM} y2={index * 414} stroke="#164e63" strokeWidth="1" />
                      ))}
                    </g>
                    {source?.dataUrl && (
                      <image
                        href={source.dataUrl}
                        x="0"
                        y="0"
                        width={(source.imageWidth || RDSS_TEMPLATE_WIDTH_MM) * scaleToMm}
                        height={(source.imageHeight || RDSS_TEMPLATE_HEIGHT_MM) * scaleToMm}
                        preserveAspectRatio="xMinYMin meet"
                        opacity="0.32"
                      />
                    )}
                    {paths.map((path) => (
                      <path
                        key={path.id}
                        d={path.d}
                        transform={`scale(${path.scaleToMm})`}
                        fill={pathFill(path)}
                        stroke={path.id === selectedPath?.id ? "#facc15" : path.noCut ? "#94a3b8" : path.color || layerById(path.layer).color}
                        strokeWidth={path.id === selectedPath?.id ? 4 : 2}
                        vectorEffect="non-scaling-stroke"
                        opacity={path.noCut ? 0.55 : 0.92}
                      />
                    ))}
                  </svg>
                  {!source && !paths.length && (
                    <div className="absolute inset-0 flex items-center justify-center text-center text-sm font-bold text-slate-500">
                      Sube un archivo para comenzar la conversion.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5 shadow-xl shadow-black/20">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Paths revisables</div>
                  <h2 className="mt-2 text-2xl font-black">Asignacion manual CNC</h2>
                </div>
                <button
                  onClick={savePackage}
                  disabled={!paths.length}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 text-sm font-black text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={18} />
                  Guardar revision
                </button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="max-h-[520px] overflow-auto rounded-2xl border border-slate-800 bg-[#020617]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 bg-[#020617] text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Path</th>
                        <th className="px-4 py-3">Capa</th>
                        <th className="px-4 py-3">Material</th>
                        <th className="px-4 py-3">Operacion</th>
                        <th className="px-4 py-3">Medida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paths.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center font-bold text-slate-500">
                            Sin paths generados.
                          </td>
                        </tr>
                      ) : (
                        paths.map((path) => (
                          <tr
                            key={path.id}
                            onClick={() => setSelectedPathId(path.id)}
                            className={`cursor-pointer border-t border-slate-800 hover:bg-cyan-500/10 ${
                              path.id === selectedPath?.id ? "bg-cyan-500/15" : ""
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="font-black text-white">{path.name}</div>
                              <div className="mt-1 text-xs font-bold text-slate-500">{path.closed ? "cerrado" : "abierto"} - {path.sourceType}</div>
                            </td>
                            <td className="px-4 py-3 font-bold text-cyan-200">{path.layer}</td>
                            <td className="px-4 py-3 font-bold text-slate-300">{materialById(path.materialId).label}</td>
                            <td className="px-4 py-3 font-bold text-slate-300">{operationLabel(path.operation)}</td>
                            <td className="px-4 py-3 font-bold text-slate-300">
                              {formatMm(path.boundsMm.width)} x {formatMm(path.boundsMm.height)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#020617] p-4">
                  {selectedPath ? (
                    <div className="space-y-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Path seleccionado</div>
                        <input
                          value={selectedPath.name}
                          onChange={(event) => updateSelectedRaw({ name: event.target.value })}
                          className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-[#07111f] px-4 text-sm font-black text-white outline-none focus:border-cyan-400"
                        />
                      </div>
                      <SelectShell label="Material" value={selectedPath.materialId} onChange={(value) => updateSelectedAssignment({ materialId: value })}>
                        {RDSS_EVOLUTION_MATERIALS.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.label}
                          </option>
                        ))}
                      </SelectShell>
                      <SelectShell label="Capa" value={selectedPath.layer} onChange={(value) => updateSelectedAssignment({ layer: value as CncLayerId })}>
                        {CNC_LAYERS.map((layer) => (
                          <option key={layer.id} value={layer.id}>
                            {layer.label}
                          </option>
                        ))}
                      </SelectShell>
                      <SelectShell
                        label="Operacion"
                        value={selectedPath.operation}
                        onChange={(value) => updateSelectedAssignment({ operation: value as CustomVectorOperation })}
                      >
                        {OPERATION_OPTIONS.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </SelectShell>
                      <SelectShell label="Broca" value={selectedPath.toolId} onChange={(value) => updateSelectedAssignment({ toolId: value })}>
                        {CNC_TOOLS.map((tool) => (
                          <option key={tool.id} value={tool.id}>
                            {tool.label}
                          </option>
                        ))}
                      </SelectShell>
                      <div className="grid grid-cols-3 gap-3">
                        <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          Espesor
                          <input
                            type="number"
                            value={selectedPath.thicknessMm}
                            onChange={(event) => updateSelectedAssignment({ thicknessMm: Math.max(0.5, Number(event.target.value) || 1) })}
                            className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-[#07111f] px-3 text-sm font-bold text-white outline-none focus:border-cyan-400"
                          />
                        </label>
                        <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          Prof.
                          <input
                            type="number"
                            value={selectedPath.depthMm}
                            onChange={(event) => updateSelectedAssignment({ depthMm: Math.max(0, Number(event.target.value) || 0) })}
                            className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-[#07111f] px-3 text-sm font-bold text-white outline-none focus:border-cyan-400"
                          />
                        </label>
                        <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          Cant.
                          <input
                            type="number"
                            value={selectedPath.quantity}
                            onChange={(event) => updateSelectedRaw({ quantity: Number(event.target.value) })}
                            className="mt-2 h-12 w-full rounded-2xl border border-slate-700 bg-[#07111f] px-3 text-sm font-bold text-white outline-none focus:border-cyan-400"
                          />
                        </label>
                      </div>
                      <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#07111f] px-4 py-3 text-sm font-black">
                        No cortar, solo referencia
                        <input
                          type="checkbox"
                          checked={selectedPath.noCut}
                          onChange={(event) =>
                            updateSelectedAssignment({
                              noCut: event.target.checked,
                              operation: event.target.checked ? "no_cortar" : "corte_exterior",
                            })
                          }
                          className="h-5 w-5 accent-cyan-400"
                        />
                      </label>
                      <button
                        onClick={deleteSelectedPath}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-3 font-black text-red-100 hover:bg-red-500/20"
                      >
                        <XCircle size={18} />
                        Eliminar path
                      </button>
                    </div>
                  ) : (
                    <div className="flex min-h-80 items-center justify-center text-center text-sm font-bold text-slate-500">
                      Selecciona un path para asignar material, broca y operacion.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5 shadow-xl shadow-black/20">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Plancha real 4x8</div>
                  <h2 className="mt-2 text-2xl font-black">Preview de nesting 2440 x 1220</h2>
                  <p className="mt-2 max-w-3xl text-sm font-bold leading-relaxed text-slate-400">
                    Optimiza piezas fisicas por material. El espacio de instalacion define proporcion; la plancha de corte sigue siendo 4x8.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sheets.map((sheet, index) => (
                    <button
                      key={sheet.id}
                      onClick={() => setSelectedSheetIndex(index)}
                      className={`rounded-full px-4 py-2 text-xs font-black ${
                        index === selectedSheetIndex ? "bg-cyan-400 text-slate-950" : "border border-slate-700 text-slate-300"
                      }`}
                    >
                      Hoja {sheet.sheetNumber}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Mini label="Plancha activa" value={activeSheet ? `${formatMm(activeSheet.width)} x ${formatMm(activeSheet.height)}` : "2440 x 1220 mm"} />
                <Mini label="Espesor activo" value={activeSheet ? `${activeSheet.thicknessMm} mm` : "-"} />
                <Mini label="Aprovechamiento" value={formatPercent(activeSheetUtilizationPct)} />
                <Mini label="Area libre" value={`${activeSheetFreeAreaM2.toFixed(2)} m2`} />
                <Mini label="Paths detectados" value={paths.length} />
                <Mini label="Objetos agrupados" value={physicalGroups.length} />
                <Mini label="Piezas fisicas" value={totalNestedPieces} />
                <Mini label="Materiales con hojas" value={materialOptimizationSummaries.length} />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {materialOptimizationSummaries.map((summary) => (
                  <div key={summary.materialId} className="rounded-2xl border border-slate-800 bg-[#020617] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">{summary.materialLabel}</div>
                        <div className="mt-1 text-sm font-black text-white">
                          {summary.boardWidthMm} x {summary.boardHeightMm} mm / espesor {summary.thicknessMm} mm
                        </div>
                      </div>
                      <div className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100">
                        {summary.sheets} hoja(s)
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
                      <Mini label="Piezas" value={summary.pieces} />
                      <Mini label="Paths" value={summary.paths} />
                      <Mini label="Uso" value={`${summary.usedAreaM2.toFixed(2)} m2`} />
                      <Mini label="Libre" value={`${summary.freeAreaM2.toFixed(2)} m2`} />
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        <span>Aprovechamiento real</span>
                        <span className="text-cyan-100">{formatPercent(summary.utilizationPct)}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-900">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300"
                          style={{ width: `${Math.min(100, Math.max(0, summary.utilizationPct))}%` }}
                        />
                      </div>
                      <div className="mt-2 text-xs font-bold text-slate-500">
                        Base: {summary.sheets} plancha(s) 4x8. El 3 mm del acrilico es espesor, no largo.
                      </div>
                    </div>
                  </div>
                ))}
                {!materialOptimizationSummaries.length && (
                  <div className="rounded-2xl border border-slate-800 bg-[#020617] p-4 text-sm font-bold text-slate-500">
                    Sin hojas calculadas. Genera vectores CNC para ver el consumo por material.
                  </div>
                )}
              </div>

              <div className="mt-5">
                <SheetPreview sheet={activeSheet} />
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5 shadow-xl shadow-black/20">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-300">Corte simulado</div>
                  <h2 className="mt-2 text-2xl font-black">Simulacion visual de corte</h2>
                  <p className="mt-2 max-w-3xl text-sm font-bold leading-relaxed text-slate-400">
                    Revisa trayectoria compensada por broca, pasadas, material retirado y tiempo estimado antes de generar G-code.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSimulationMode("proyecto")}
                    className={`h-12 rounded-2xl px-4 text-xs font-black ${
                      simulationMode === "proyecto"
                        ? "bg-cyan-400 text-slate-950"
                        : "border border-slate-700 bg-slate-950 text-slate-300"
                    }`}
                  >
                    Proyecto completo
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulationMode("pieza")}
                    className={`h-12 rounded-2xl px-4 text-xs font-black ${
                      simulationMode === "pieza"
                        ? "bg-cyan-400 text-slate-950"
                        : "border border-slate-700 bg-slate-950 text-slate-300"
                    }`}
                  >
                    Pieza individual
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={simulateCutNow}
                  disabled={!activePaths.length || simulationStatus === "simulando"}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-400 px-5 text-sm font-black text-slate-950 hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlayCircle size={18} />
                  {simulationStatus === "pausada" ? "Reanudar" : "Iniciar simulacion"}
                </button>
                <button
                  onClick={pauseSimulation}
                  disabled={simulationStatus !== "simulando"}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-700 px-5 text-sm font-black text-slate-200 hover:border-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PauseCircle size={18} />
                  Pausar
                </button>
                <button
                  onClick={restartSimulation}
                  disabled={!simulationResult?.simulatedSegments.length}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-700 px-5 text-sm font-black text-slate-200 hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw size={18} />
                  Reiniciar
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Mini label="Modo" value={simulationMode === "proyecto" ? "Proyecto completo" : "Pieza individual"} />
                <Mini
                  label="Path actual"
                  value={
                    liveSimulationPlayback
                      ? `${liveSimulationPlayback.trajectoryIndex} de ${liveSimulationPlayback.totalTrajectories}`
                      : "0 de 0"
                  }
                />
                <Mini label="Progreso global" value={`${(simulationStatus === "completada" ? 100 : simulationProgress).toFixed(0)}%`} />
              </div>

              <div className="mt-5">
                <SimulationPreview result={simulationResult} status={simulationStatus} progress={simulationProgress} />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Mini label="Piezas" value={simulationResult?.pieces || 0} />
                <Mini label="Trayectorias" value={simulationResult?.trajectories || 0} />
                <Mini label="Distancia total" value={formatMm(simulationResult?.totalLengthMm || 0)} />
                <Mini label="Tiempo estimado" value={formatMin(simulationResult?.estimatedMinutes || 0)} />
                <Mini label="Pasadas" value={simulationResult?.passes || 0} />
                <Mini label="Material" value={simulationResult?.materials.join(" / ") || "Pendiente"} />
                <Mini label="Broca" value={simulationResult?.tools.join(" / ") || "Pendiente"} />
                <Mini label="Paso Z" value={`${DEFAULT_CUT_PASS_DEPTH_MM} mm`} />
              </div>

              {simulationErrors.length > 0 && (
                <div className="mt-5 space-y-2">
                  {simulationErrors.map((error, index) => {
                    const blocking = simulationStatus === "error";
                    return (
                      <div
                        key={`simulation-error-${index}-${error}`}
                        className={`flex gap-3 rounded-2xl border p-4 text-sm font-bold ${
                          blocking ? "border-red-500/30 bg-red-500/10 text-red-100" : "border-amber-400/30 bg-amber-400/10 text-amber-100"
                        }`}
                      >
                        {blocking ? <XCircle className="mt-0.5 shrink-0" size={18} /> : <AlertTriangle className="mt-0.5 shrink-0" size={18} />}
                        {error}
                      </div>
                    );
                  })}
                </div>
              )}

              {simulationResult?.simulatedSegments.length ? (
                <div className="mt-5 overflow-auto rounded-2xl border border-slate-800 bg-[#020617]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#020617] text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Orden</th>
                        <th className="px-4 py-3">Path</th>
                        <th className="px-4 py-3">Operacion</th>
                        <th className="px-4 py-3">Broca</th>
                        <th className="px-4 py-3">Pasada</th>
                        <th className="px-4 py-3">Prof.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulationResult.simulatedSegments.slice(0, 10).map((segment) => (
                        <tr key={segment.id} className="border-t border-slate-800">
                          <td className="px-4 py-3 font-black text-cyan-200">#{segment.order}</td>
                          <td className="px-4 py-3 font-black text-white">{segment.pathName}</td>
                          <td className="px-4 py-3 font-bold text-slate-300">{segment.operationLabel}</td>
                          <td className="px-4 py-3 font-bold text-orange-100">
                            {segment.toolLabel} ({segment.toolDiameterMm} mm)
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-300">
                            {segment.passNumber}/{segment.passCount}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-300">{formatMm(segment.passTargetDepthMm)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          </section>

          <aside className="space-y-5">
            <section className="rounded-[28px] border border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-[#07111f] to-blue-950/30 p-5 shadow-xl shadow-black/20">
              <div className="flex items-center gap-3">
                <Ruler className="text-cyan-300" size={24} />
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Proporcion industrial</div>
                  <h2 className="mt-1 text-2xl font-black">Espacio activo</h2>
                </div>
              </div>
              <div className="mt-5 rounded-3xl border border-cyan-400/20 bg-[#020617]/80 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Instalacion / pared</div>
                <div className="mt-2 text-3xl font-black text-white">
                  {formatMeters(spaceWidthMm)} <span className="text-slate-500">x</span> {formatMeters(spaceHeightMm)}
                </div>
                <div className="mt-1 text-xs font-bold text-cyan-100">
                  {formatMm(spaceWidthMm)} x {formatMm(spaceHeightMm)}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Mini label="Escala px-mm" value={`${scaleToMm.toFixed(4)}x`} />
                <Mini label="Sugerida" value={`${sourceScaleSuggestion}x`} />
                <Mini label="Render real" value={`${formatMeters(sourcePhysicalWidthMm)} x ${formatMeters(sourcePhysicalHeightMm)}`} />
                <Mini label="Uso espacio" value={`${projectedCoverageWidth}% x ${projectedCoverageHeight}%`} />
                <Mini label="Objetos fisicos" value={physicalGroups.length} />
                <Mini label="Hojas 4x8" value={sheets.length} />
              </div>
              {largestPhysicalGroup ? (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-[#020617] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Mayor pieza detectada</div>
                  <div className="mt-2 font-black text-white">{largestPhysicalGroup.label}</div>
                  <div className="mt-1 text-sm font-bold text-cyan-100">
                    {formatMm(largestPhysicalGroup.boundsMm.width)} x {formatMm(largestPhysicalGroup.boundsMm.height)}
                  </div>
                  <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                    oversizedGroups.length ? "bg-amber-500/15 text-amber-100" : "bg-emerald-500/15 text-emerald-100"
                  }`}>
                    {oversizedGroups.length ? `${oversizedGroups.length} requiere A/B` : "Cabe en 4x8"}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-[#020617] p-4 text-sm font-bold text-slate-500">
                  Genera Vector IA para ver piezas fisicas y hojas reales.
                </div>
              )}
              <div className="mt-4 space-y-2">
                {materialOptimizationSummaries.slice(0, 4).map((summary) => (
                  <div key={summary.materialId} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#020617] px-4 py-3">
                    <div>
                      <div className="text-sm font-black text-white">{summary.materialLabel}</div>
                      <div className="text-[11px] font-bold text-slate-500">
                        {summary.pieces} piezas / {formatPercent(summary.utilizationPct)} uso / libre {summary.freeAreaM2.toFixed(2)} m2
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-cyan-200">{summary.sheets}</div>
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">hojas</div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setScaleToMm(sourceScaleSuggestion);
                  setMessage({ tone: "ok", text: `Proporcion aplicada desde panel derecho: ${sourceScaleSuggestion}x para ${spaceWidthMm} x ${spaceHeightMm} mm.` });
                }}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 font-black text-slate-950 hover:bg-cyan-400"
              >
                <Ruler size={18} />
                Aplicar proporcion
              </button>
            </section>

            <section className={`rounded-[28px] border p-5 shadow-xl shadow-black/20 ${
              productionReady
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-[#07111f] to-[#07111f]"
            }`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className={productionReady ? "text-emerald-300" : "text-amber-300"} size={24} />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Salida CNC</div>
                    <h2 className="mt-1 text-2xl font-black">Checklist maquina</h2>
                  </div>
                </div>
                <div className={`rounded-2xl px-4 py-2 text-sm font-black ${
                  productionReady ? "bg-emerald-500 text-slate-950" : "bg-amber-500/20 text-amber-100"
                }`}>
                  {productionReadyCount}/{productionChecklist.length}
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {productionChecklist.map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${
                      item.ok
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                        : "border-slate-800 bg-[#020617] text-slate-400"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.ok ? <CheckCircle2 className="shrink-0 text-emerald-300" size={18} /> : <XCircle className="shrink-0 text-slate-600" size={18} />}
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={validateNow}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-3 text-xs font-black text-cyan-100 hover:bg-cyan-500/20"
                >
                  Validar CNC
                </button>
                <button
                  type="button"
                  onClick={exportPackage}
                  disabled={!productionReady}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-lime-400 px-3 text-xs font-black text-slate-950 hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Exportar CNC
                </button>
              </div>
              {!productionReady && (
                <p className="mt-3 text-xs font-bold leading-relaxed text-slate-500">
                  El paquete no se libera hasta completar escala, materiales, nesting y validacion. Esto evita cortar una referencia como si fuera pieza real.
                </p>
              )}
            </section>

            <section className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5 shadow-xl shadow-black/20">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-cyan-300" size={24} />
                <h2 className="text-2xl font-black">Seguridad CNC</h2>
              </div>
              <div className="mt-5 space-y-3">
                {liveWarnings.map((warning, index) => (
                  <div key={`live-warning-${index}-${warning}`} className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
                    <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                    {warning}
                  </div>
                ))}
                {validation?.errors.map((error, index) => (
                  <div key={`validation-error-${index}-${error}`} className="flex gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                    <XCircle className="mt-0.5 shrink-0" size={18} />
                    {error}
                  </div>
                ))}
                {validation?.warnings.map((warning, index) => (
                  <div key={`validation-warning-${index}-${warning}`} className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
                    <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                    {warning}
                  </div>
                ))}
                {validation?.ok && (
                  <div className="flex gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
                    <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
                    Proyecto validado para exportacion CNC.
                  </div>
                )}
                {!validation && !liveWarnings.length && (
                  <div className="rounded-2xl border border-slate-800 bg-[#020617] p-4 text-sm font-bold text-slate-500">
                    Sin validacion ejecutada.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5 shadow-xl shadow-black/20">
              <div className="flex items-center gap-3">
                <Layers3 className="text-cyan-300" size={24} />
                <h2 className="text-2xl font-black">Capas CNC</h2>
              </div>
              <div className="mt-5 space-y-3">
                {CNC_LAYERS.map((layer) => {
                  const count = paths.filter((path) => path.layer === layer.id).length;
                  return (
                    <div key={layer.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#020617] p-4">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: layer.color }} />
                        <div>
                          <div className="font-black text-white">{layer.label}</div>
                          <div className="text-xs font-bold text-slate-500">{layer.id}</div>
                        </div>
                      </div>
                      <div className="text-xl font-black text-cyan-200">{count}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5 shadow-xl shadow-black/20">
              <div className="flex items-center gap-3">
                <Scissors className="text-cyan-300" size={24} />
                <h2 className="text-2xl font-black">Exportaciones</h2>
              </div>
              <div className="mt-5 grid gap-3">
                <button
                  onClick={() => downloadText(`rdss_evolution_${Date.now()}.csv`, buildCsv(paths, sheets), "text/csv")}
                  disabled={!paths.length}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-700 px-4 text-sm font-black text-slate-100 hover:border-cyan-400 disabled:opacity-50"
                >
                  <FileText size={18} />
                  CSV CNC
                </button>
                <button
                  onClick={() =>
                    downloadText(
                      `rdss_evolution_${Date.now()}.json`,
                      buildProjectJson(paths, sheets, validation || { ok: false, errors: [], warnings: liveWarnings }),
                      "application/json"
                    )
                  }
                  disabled={!paths.length}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-700 px-4 text-sm font-black text-slate-100 hover:border-cyan-400 disabled:opacity-50"
                >
                  <FileJson size={18} />
                  JSON proyecto
                </button>
                <button
                  onClick={exportPackage}
                  disabled={!paths.length}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 text-sm font-black text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
                >
                  <Download size={18} />
                  Paquete completo
                </button>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-800 bg-[#07111f] p-5 shadow-xl shadow-black/20">
              <div className="flex items-center gap-3">
                <ImageIcon className="text-cyan-300" size={24} />
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Inventario CNC</div>
                  <h2 className="text-2xl font-black">Planchas reales RDSS</h2>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {RDSS_EVOLUTION_MATERIALS.map((material) => {
                  const summary = materialOptimizationSummaries.find((item) => item.materialId === material.id);

                  return (
                    <div key={material.id} className="rounded-2xl border border-slate-800 bg-[#020617] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-black text-white">{material.label}</div>
                          <div className="text-xs font-bold text-slate-500">
                            Plancha {formatMeters(material.boardWidthMm)} x {formatMeters(material.boardHeightMm)} / espesor {material.thicknessMm} mm
                          </div>
                        </div>
                        <span className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: material.color }} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <Mini label="Hojas" value={summary?.sheets || 0} />
                        <Mini label="Uso" value={summary ? formatPercent(summary.utilizationPct) : "0.0%"} />
                        <Mini label="Libre" value={summary ? `${summary.freeAreaM2.toFixed(2)} m2` : "-"} />
                      </div>
                      {material.id.includes("acrilico") ? (
                        <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
                          Aclaracion: acrilico 3 mm significa espesor. La plancha sigue siendo 4x8: 2440 x 1220 mm.
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
