"use client";

import { AlertTriangle, Calculator, CheckCircle2 } from "lucide-react";
import {
  EmptyState,
  FieldLabel,
  InputDark,
  MiniStat,
  PanelDark,
} from "@/components/quotes/QuoteUiPrimitives";

type GrainDirection = "sin_veta" | "vertical" | "horizontal";
type MaterialOwner = "cliente" | "rdwood";
type BoardSize = "4x8" | "7x8" | "personalizada";
type QuoteMode = "articulos" | "servicio";
type AIInsightSeverity = "success" | "warning" | "danger" | "info";

type NestedPiece = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  color: string;
};

type NestingBoard = {
  index: number;
  width: number;
  height: number;
  pieces: NestedPiece[];
  wastePercent: number;
};

type NestingResult = {
  boards: NestingBoard[];
  oversized: unknown[];
  totalPieces: number;
  placedPieces: number;
  usedArea: number;
  totalArea: number;
  wastePercent: number;
};

type AIInsight = {
  id: string;
  severity: AIInsightSeverity;
  title: string;
  message: string;
  action?: string;
};

const percent = (value: number) => `${Number(value || 0).toFixed(1)}%`;

const money = (value: number) =>
  `RD$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function BoardOptimizerPreview({
  result,
  boardWidth,
  boardHeight,
  grainDirection,
}: {
  result: NestingResult;
  boardWidth: number;
  boardHeight: number;
  grainDirection: GrainDirection;
}) {
  const efficiency = result.totalArea > 0 ? (result.usedArea / result.totalArea) * 100 : 0;
  const mainBoard = result.boards[0];
  const boardLabel = `${Math.round(boardWidth)} x ${Math.round(boardHeight)} mm`;

  return (
    <PanelDark
      title="Optimizador de plancha"
      subtitle="Preview visible antes del pago. Al convertir en venta pasa a la orden interna de corte."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Planchas" value={String(result.boards.length)} />
        <MiniStat label="Aprovechamiento" value={percent(efficiency)} />
        <MiniStat label="Merma" value={percent(result.wastePercent)} />
        <MiniStat label="Piezas ubicadas" value={`${result.placedPieces}/${result.totalPieces}`} />
      </div>

      {result.oversized.length > 0 && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-200">
          Hay {result.oversized.length} pieza(s) fuera de medida para la plancha seleccionada. Revisa largo/ancho, veta o tamano de tablero.
        </div>
      )}

      <div className="mt-4 rounded-[24px] border border-cyan-400/20 bg-[#020617] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
              Plancha 1 · {boardLabel}
            </p>
            <p className="mt-1 text-[11px] font-bold text-slate-500">
              Veta: {grainDirection === "sin_veta" ? "sin restriccion" : grainDirection}. Preview aproximado para cotizar y validar.
            </p>
          </div>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-200">
            {result.boards.length > 0 ? `${result.boards.length} plancha(s)` : "Sin despiece"}
          </span>
        </div>

        {mainBoard ? (
          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-3">
            <svg
              viewBox={`0 0 ${mainBoard.width} ${mainBoard.height}`}
              className="h-[330px] w-full rounded-xl bg-[#111827]"
              preserveAspectRatio="xMidYMid meet"
            >
              <rect x="0" y="0" width={mainBoard.width} height={mainBoard.height} fill="#0f172a" stroke="#22d3ee" strokeWidth="10" />
              {mainBoard.pieces.map((piece) => (
                <g key={piece.id}>
                  <rect
                    x={piece.x}
                    y={piece.y}
                    width={piece.width}
                    height={piece.height}
                    fill={piece.color}
                    opacity="0.9"
                    stroke="#020617"
                    strokeWidth="8"
                    rx="8"
                  />
                  <text x={piece.x + 18} y={piece.y + 34} fill="white" fontSize="34" fontWeight="800">
                    {piece.name.slice(0, 18)}
                  </text>
                  <text x={piece.x + 18} y={piece.y + 72} fill="white" fontSize="28" opacity="0.85">
                    {Math.round(piece.width)} x {Math.round(piece.height)} mm{piece.rotated ? " · rotada" : ""}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        ) : (
          <EmptyState text="Agrega piezas al despiece para ver el optimizador de plancha." />
        )}

        {result.boards.length > 1 && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {result.boards.slice(1, 4).map((board) => (
              <div key={board.index} className="rounded-2xl border border-slate-700 bg-slate-950 p-3">
                <p className="mb-2 text-xs font-black text-slate-300">Plancha {board.index + 1}</p>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: `${Math.max(3, 100 - board.wastePercent)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] font-bold text-slate-500">
                  Uso {(100 - board.wastePercent).toFixed(1)}% · {board.pieces.length} piezas
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelDark>
  );
}

export function ServiceConfiguration(props: {
  materialOwner: MaterialOwner;
  setMaterialOwner: (value: MaterialOwner) => void;
  boardType: string;
  setBoardType: (value: string) => void;
  boardSize: BoardSize;
  setBoardSize: (value: BoardSize) => void;
  boardWidthMm: string;
  setBoardWidthMm: (value: string) => void;
  boardHeightMm: string;
  setBoardHeightMm: (value: string) => void;
  thicknessMm: string;
  setThicknessMm: (value: string) => void;
  boardColor: string;
  setBoardColor: (value: string) => void;
  grainDirection: GrainDirection;
  setGrainDirection: (value: GrainDirection) => void;
  cutPrice: string;
  setCutPrice: (value: string) => void;
  edgePrice: string;
  setEdgePrice: (value: string) => void;
  cncPrice: string;
  setCncPrice: (value: string) => void;
  serviceDescription: string;
  setServiceDescription: (value: string) => void;
}) {
  return (
    <PanelDark
      title="Configuracion tecnica del servicio"
      subtitle="Material, tablero, veta, precios y condiciones de corte"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>Material suministrado por</FieldLabel>
          <select
            value={props.materialOwner}
            onChange={(event) => props.setMaterialOwner(event.target.value as MaterialOwner)}
            className="input-dark"
          >
            <option value="cliente">Cliente</option>
            <option value="rdwood">RD Wood</option>
          </select>
        </div>
        <InputDark label="Tipo de tablero" value={props.boardType} setValue={props.setBoardType} placeholder="Melamina, MDF, plywood..." />
        <div>
          <FieldLabel>Medida tablero</FieldLabel>
          <select
            value={props.boardSize}
            onChange={(event) => props.setBoardSize(event.target.value as BoardSize)}
            className="input-dark"
          >
            <option value="4x8">4 x 8 · 1220 x 2440 mm</option>
            <option value="7x8">7 x 8 · 2135 x 2440 mm</option>
            <option value="personalizada">Personalizada</option>
          </select>
        </div>
        <InputDark label="Espesor mm" value={props.thicknessMm} setValue={props.setThicknessMm} type="number" placeholder="18" />
        <InputDark label="Ancho tablero mm" value={props.boardWidthMm} setValue={props.setBoardWidthMm} type="number" placeholder="1220" />
        <InputDark label="Alto tablero mm" value={props.boardHeightMm} setValue={props.setBoardHeightMm} type="number" placeholder="2440" />
        <InputDark label="Color / acabado" value={props.boardColor} setValue={props.setBoardColor} placeholder="Blanco, Bardolino, Wengue..." />
        <div>
          <FieldLabel>Veta</FieldLabel>
          <select
            value={props.grainDirection}
            onChange={(event) => props.setGrainDirection(event.target.value as GrainDirection)}
            className="input-dark"
          >
            <option value="sin_veta">Sin veta</option>
            <option value="vertical">Veta vertical</option>
            <option value="horizontal">Veta horizontal</option>
          </select>
        </div>
        <InputDark label="Precio corte / pie" value={props.cutPrice} setValue={props.setCutPrice} type="number" placeholder="30" />
        <InputDark label="Precio canto / metro" value={props.edgePrice} setValue={props.setEdgePrice} type="number" placeholder="35" />
        <InputDark label="Precio CNC / unidad" value={props.cncPrice} setValue={props.setCncPrice} type="number" placeholder="0" />
        <div className="md:col-span-2">
          <FieldLabel>Descripcion del servicio</FieldLabel>
          <textarea
            value={props.serviceDescription}
            onChange={(event) => props.setServiceDescription(event.target.value)}
            className="textarea-dark h-16"
            placeholder="Ej: Despiece de closet, canto PVC 22mm, perforaciones minifix, ranuras, observaciones del cliente..."
          />
        </div>
      </div>
    </PanelDark>
  );
}

export function QuoteAIControlPanel({
  score,
  insights,
  mode,
  margin,
  total,
  profitTotal,
  serviceBoards,
  serviceWaste,
}: {
  score: number;
  insights: AIInsight[];
  mode: QuoteMode;
  margin: number;
  total: number;
  profitTotal: number;
  serviceBoards: number;
  serviceWaste: number;
}) {
  const dangerCount = insights.filter((insight) => insight.severity === "danger").length;
  const warningCount = insights.filter((insight) => insight.severity === "warning").length;
  const statusLabel =
    dangerCount > 0
      ? "Riesgo alto"
      : warningCount > 0
        ? "Revisar"
        : total > 0
          ? "Saludable"
          : "Esperando datos";
  const statusClass =
    dangerCount > 0
      ? "text-red-300 bg-red-500/15 border-red-400/30"
      : warningCount > 0
        ? "text-amber-200 bg-amber-500/15 border-amber-400/30"
        : total > 0
          ? "text-emerald-200 bg-emerald-500/15 border-emerald-400/30"
          : "text-slate-300 bg-slate-700/40 border-slate-600";

  return (
    <div className="overflow-hidden rounded-[30px] border border-cyan-500/25 bg-gradient-to-br from-[#07111f] via-[#081426] to-[#171130] shadow-2xl">
      <div className="border-b border-cyan-500/20 bg-cyan-400/10 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">
              IA Operativa Viva
            </div>
            <h3 className="mt-3 text-xl font-black text-white">Cotizaciones IA</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              Analiza margen, stock, errores, plancha y proximos pasos.
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-cyan-300">{score}</div>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Score</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniAIKpi label="Margen" value={percent(margin)} />
          <MiniAIKpi label="Utilidad" value={money(profitTotal)} />
          <MiniAIKpi label={mode === "servicio" ? "Planchas" : "Total"} value={mode === "servicio" ? String(serviceBoards) : money(total)} />
        </div>

        {mode === "servicio" && (
          <div className="mt-2 rounded-2xl border border-slate-700 bg-[#020617]/70 px-3 py-2 text-xs font-bold text-slate-300">
            Merma estimada: <span className={serviceWaste > 35 ? "text-amber-300" : "text-emerald-300"}>{percent(serviceWaste)}</span>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className={`mb-4 inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass}`}>
          {statusLabel}
        </div>

        <div className="space-y-3">
          {insights.map((insight) => (
            <AIInsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniAIKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-[#020617]/70 p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function AIInsightCard({ insight }: { insight: AIInsight }) {
  const styles: Record<AIInsightSeverity, string> = {
    success: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    warning: "border-amber-400/25 bg-amber-500/10 text-amber-200",
    danger: "border-red-400/25 bg-red-500/10 text-red-200",
    info: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200",
  };

  const icon =
    insight.severity === "success" ? (
      <CheckCircle2 size={16} />
    ) : insight.severity === "danger" || insight.severity === "warning" ? (
      <AlertTriangle size={16} />
    ) : (
      <Calculator size={16} />
    );

  return (
    <div className={`rounded-2xl border p-4 ${styles[insight.severity]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-black text-white">{insight.title}</h4>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-300">{insight.message}</p>
          {insight.action && (
            <div className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
              {insight.action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
