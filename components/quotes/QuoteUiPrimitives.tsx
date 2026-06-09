"use client";

import type { ReactNode } from "react";

export function PanelDark({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[30px] border border-slate-800 bg-[#07111f] p-5 shadow-xl ${className}`}
    >
      <div className="mb-5">
        <h2 className="text-xl font-black text-white">{title}</h2>
        <p className="text-sm font-semibold text-slate-400">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function ModeButton({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-4 rounded-3xl border p-4 text-left transition",
        active
          ? "border-cyan-400 bg-cyan-400/15 text-white shadow-lg shadow-cyan-950/40"
          : "border-slate-800 bg-[#020617] text-slate-300 hover:border-slate-600",
      ].join(" ")}
    >
      <div
        className={
          active
            ? "rounded-2xl bg-cyan-400 p-3 text-slate-950"
            : "rounded-2xl bg-slate-800 p-3 text-slate-400"
        }
      >
        {icon}
      </div>
      <div>
        <h3 className="font-black">{title}</h3>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>
    </button>
  );
}

export function Kpi({
  title,
  value,
  detail,
  icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: "blue" | "green" | "purple" | "slate" | "red";
}) {
  const tones = {
    blue: "bg-blue-600",
    green: "bg-emerald-600",
    purple: "bg-purple-600",
    slate: "bg-slate-700",
    red: "bg-red-600",
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-[#07111f] p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`rounded-2xl p-3 text-white ${tones[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-400">{title}</p>
          <h2 className="truncate text-2xl font-black text-white">{value}</h2>
          <p className="text-xs text-slate-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}

export function InputDark({
  label,
  value,
  setValue,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="input-dark"
      />
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
      {children}
    </label>
  );
}

export function ThDark({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
      {children}
    </th>
  );
}

export function TdDark({
  children,
  strong,
  green,
}: {
  children: ReactNode;
  strong?: boolean;
  green?: boolean;
}) {
  return (
    <td
      className={`px-4 py-4 align-top ${strong ? "font-black text-white" : "text-slate-300"} ${green ? "font-black text-emerald-300" : ""}`}
    >
      {children}
    </td>
  );
}

export function CheckBox({
  label,
  checked,
  setChecked,
}: {
  label: string;
  checked: boolean;
  setChecked: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-700 bg-[#020617] px-3 py-3 text-sm font-black text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => setChecked(event.target.checked)}
        className="h-5 w-5 accent-cyan-400"
      />
      {label}
    </label>
  );
}

export function EditableNumber({
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
      onChange={(event) => onChange(Number(event.target.value) || 0)}
      className="mini-input"
    />
  );
}

export function MiniEdge({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "rounded-lg bg-cyan-400 px-2 py-1 text-xs font-black text-slate-950"
          : "rounded-lg bg-slate-800 px-2 py-1 text-xs font-black text-slate-400"
      }
    >
      {label}
    </button>
  );
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#020617] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

export function TotalRow({
  label,
  value,
  big,
  green,
}: {
  label: string;
  value: string;
  big?: boolean;
  green?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`${big ? "text-lg" : "text-sm"} font-bold text-slate-300`}>
        {label}
      </span>
      <strong
        className={`${big ? "text-2xl text-cyan-300" : ""} ${green ? "text-emerald-300" : ""}`}
      >
        {value}
      </strong>
    </div>
  );
}

export function TypeBadge({ value }: { value: string }) {
  const mode = value.toLowerCase();
  const cls =
    mode === "servicio"
      ? "bg-cyan-400/15 text-cyan-200"
      : "bg-blue-400/15 text-blue-200";
  const label = mode === "servicio" ? "Servicio" : "Articulo";
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>{label}</span>;
}

export function StatusBadge({ value }: { value: string }) {
  const status = value.toLowerCase();
  const cls =
    status === "convertida"
      ? "bg-slate-200 text-slate-950"
      : status === "aprobada"
        ? "bg-emerald-400/15 text-emerald-200"
        : status === "enviada"
          ? "bg-blue-400/15 text-blue-200"
          : status === "vencida" || status === "rechazada"
            ? "bg-red-400/15 text-red-200"
            : "bg-slate-700 text-slate-200";

  return <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>{value}</span>;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="py-16 text-center text-sm font-bold text-slate-500">{text}</div>;
}

export function ActionButton({
  icon,
  label,
  onClick,
  primary,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40",
        primary
          ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
          : "bg-white/10 text-white hover:bg-white/20",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
