"use client";

import { AlertTriangle, CheckCircle2, Cpu, Lightbulb, ShieldAlert } from "lucide-react";
import type { CutAIResult } from "@/lib/ai/cut-ai";

function tone(type: string) {
  if (type === "success") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (type === "danger") return "border-red-400/30 bg-red-400/10 text-red-200";
  if (type === "warning") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
}

function scoreColor(score: number) {
  if (score >= 85) return "text-emerald-300";
  if (score >= 70) return "text-cyan-300";
  if (score >= 45) return "text-amber-300";
  return "text-red-300";
}

export default function CutAIWidget({ result }: { result: CutAIResult }) {
  return (
    <section className="rounded-[28px] border border-cyan-500/30 bg-slate-950/80 p-5 shadow-2xl shadow-cyan-950/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-300">
            IA Corte Industrial
          </p>
          <h3 className="mt-1 flex items-center gap-2 text-xl font-black text-white">
            <Cpu size={20} className="text-cyan-300" />
            Supervisor CNC
          </h3>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
          <p className="text-[10px] font-black uppercase text-slate-500">Score</p>
          <p className={`text-3xl font-black ${scoreColor(result.score)}`}>{result.score}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Eficiencia</p>
          <p className="mt-1 text-lg font-black text-white">{result.efficiency.toFixed(1)}%</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Merma</p>
          <p className="mt-1 text-lg font-black text-white">{result.wastePercent.toFixed(1)}%</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {result.alerts.slice(0, 5).map((alert, index) => (
          <div key={`${alert.title}-${index}`} className={`rounded-2xl border p-3 ${tone(alert.type)}`}>
            <div className="flex items-start gap-2">
              {alert.type === "success" ? <CheckCircle2 size={16} /> : alert.type === "danger" ? <ShieldAlert size={16} /> : <AlertTriangle size={16} />}
              <div>
                <p className="text-sm font-black">{alert.title}</p>
                <p className="mt-1 text-xs font-bold opacity-80">{alert.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {result.recommendations.length > 0 && (
        <div className="mt-4 rounded-2xl border border-purple-400/20 bg-purple-400/10 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-black text-purple-200">
            <Lightbulb size={16} /> Recomendaciones IA
          </p>
          <div className="space-y-2">
            {result.recommendations.slice(0, 4).map((rec, index) => (
              <div key={`${rec.title}-${index}`} className="text-xs text-purple-100/90">
                <strong>{rec.title}:</strong> {rec.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
