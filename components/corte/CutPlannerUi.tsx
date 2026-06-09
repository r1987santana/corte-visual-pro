"use client";

import type { ReactNode } from "react";
import type { SheetLayout } from "@/lib/corteOptimizerPRO";

export function SheetView({
  sheet,
  sheetWidth,
  sheetHeight,
  material,
}: {
  sheet: SheetLayout;
  sheetWidth: number;
  sheetHeight: number;
  material: string;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-slate-800 bg-[#020617] p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black">Hoja #{sheet.numero}</h3>
          <p className="text-xs font-bold text-slate-500">{material}</p>
        </div>
        <div className="text-right text-xs font-bold text-slate-400">
          {sheetHeight} x {sheetWidth} mm · Usado {sheet.usadoM2.toFixed(2)} m²
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950"
        style={{ aspectRatio: `${sheetHeight}/${sheetWidth}` }}
      >
        {sheet.piezas.map((piece, index) => {
          const left = (piece.x / sheetHeight) * 100;
          const top = (piece.y / sheetWidth) * 100;
          const width = (piece.w / sheetHeight) * 100;
          const height = (piece.h / sheetWidth) * 100;

          return (
            <div
              key={`${piece.id}-${index}`}
              className="absolute overflow-hidden rounded-md border border-white/40 bg-cyan-400/80 p-1 text-[10px] font-black text-slate-950"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
            >
              <div className="truncate">{piece.nombre}</div>
              <div>
                {Math.round(piece.w)} x {Math.round(piece.h)}
              </div>
              {piece.rotada && <div>ROTADA</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Stat({
  title,
  value,
  icon,
  accent = "text-white",
}: {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  accent?: string;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-slate-800 bg-[#07111f] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            {title}
          </div>
          <div className={`mt-3 text-xl font-black ${accent}`}>{value}</div>
        </div>
        <div className="text-cyan-400">{icon}</div>
      </div>
    </div>
  );
}

export function Mini({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#020617] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-black text-white">{value}</div>
    </div>
  );
}

export function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-[#020617] px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400"
      />
    </div>
  );
}

export function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-2xl border border-slate-700 bg-[#020617] px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-400"
      />
    </div>
  );
}

export function SmallNumber({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-24 rounded-xl border border-slate-700 bg-[#020617] px-3 py-2 text-right font-bold text-white outline-none focus:border-cyan-400"
    />
  );
}
