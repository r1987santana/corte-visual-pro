"use client";

import { AlertTriangle, CheckCircle2, Lightbulb, ShieldAlert, Sparkles } from "lucide-react";
import type { QuoteAiAnalysis } from "@/lib/ai/modules/cotizaciones";

function tone(level: string) {
  if (level === "danger") return "border-red-500/40 bg-red-500/10 text-red-200";
  if (level === "warning") return "border-yellow-500/40 bg-yellow-500/10 text-yellow-200";
  if (level === "ok") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
}

function icon(level: string) {
  if (level === "danger") return <ShieldAlert size={15} />;
  if (level === "warning") return <AlertTriangle size={15} />;
  if (level === "ok") return <CheckCircle2 size={15} />;
  return <Sparkles size={15} />;
}

export default function ModuleAIInsightCard({ analysis }: { analysis: QuoteAiAnalysis }) {
  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-[#020617]/80 p-4 text-white shadow-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300">Análisis IA operativo</p>
          <h3 className="mt-1 text-sm font-black">Salud: {analysis.health.toUpperCase()}</h3>
        </div>
        <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-lg font-black text-cyan-200">
          {analysis.score}%
        </div>
      </div>

      <p className="mb-3 text-xs font-semibold leading-relaxed text-slate-300">{analysis.summary}</p>

      <div className="space-y-2">
        {analysis.alerts.slice(0, 4).map((alert, index) => (
          <div key={`${alert.title}-${index}`} className={`rounded-xl border p-3 ${tone(alert.level)}`}>
            <div className="flex items-center gap-2 text-xs font-black">
              {icon(alert.level)}
              {alert.title}
            </div>
            <p className="mt-1 text-xs font-semibold leading-relaxed opacity-90">{alert.message}</p>
          </div>
        ))}
      </div>

      {analysis.recommendations.length > 0 && (
        <div className="mt-4 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-black text-purple-200">
            <Lightbulb size={15} /> Recomendaciones
          </div>
          <div className="space-y-2">
            {analysis.recommendations.slice(0, 3).map((rec, index) => (
              <div key={`${rec.title}-${index}`} className="text-xs text-slate-200">
                <strong>{rec.title}:</strong> {rec.detail}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Próximos pasos</p>
        <ul className="space-y-1 text-xs font-semibold text-slate-300">
          {analysis.nextSteps.slice(0, 4).map((step, index) => (
            <li key={`${step}-${index}`}>• {step}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
