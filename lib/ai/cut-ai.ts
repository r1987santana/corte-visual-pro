export type CutAIAlertType = "success" | "warning" | "danger" | "info";

export type CutAIAlert = {
  type: CutAIAlertType;
  title: string;
  message: string;
};

export type CutAIRecommendation = {
  title: string;
  message: string;
};

export type CutAIInput = {
  pieces?: any[];
  layouts?: any[];
  materialOptions?: any[];
  selectedMaterial?: any;
  efficiency?: number;
  wasteM2?: number;
  totalSheetM2?: number;
  serviceTotalCost?: number;
  drillingOperations?: any[];
  sheetsCount?: number;
  respectGrain?: boolean;
  hasGrain?: boolean;
};

export type CutAIResult = {
  score: number;
  status: "excelente" | "bueno" | "revisar" | "critico";
  efficiency: number;
  wastePercent: number;
  alerts: CutAIAlert[];
  recommendations: CutAIRecommendation[];
};

const n = (value: any) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function analyzeCutJob(input: CutAIInput): CutAIResult {
  const pieces = input.pieces || [];
  const layouts = input.layouts || [];
  const efficiency = n(input.efficiency);
  const totalSheetM2 = n(input.totalSheetM2);
  const wasteM2 = n(input.wasteM2);
  const wastePercent = totalSheetM2 > 0 ? (wasteM2 / totalSheetM2) * 100 : 0;
  const drillingCount = (input.drillingOperations || []).length;
  const alerts: CutAIAlert[] = [];
  const recommendations: CutAIRecommendation[] = [];
  let score = 100;

  if (!pieces.length) {
    return {
      score: 0,
      status: "critico",
      efficiency: 0,
      wastePercent: 0,
      alerts: [{ type: "info", title: "Sin piezas", message: "Carga piezas para analizar corte." }],
      recommendations: [{ title: "Cargar orden", message: "Selecciona una orden de producción o agrega piezas manuales." }],
    };
  }

  if (!layouts.length) {
    score -= 45;
    alerts.push({ type: "danger", title: "Sin layout", message: "No se generó optimización válida." });
  }

  if (efficiency >= 85) {
    alerts.push({ type: "success", title: "Eficiencia excelente", message: `Aprovechamiento ${efficiency.toFixed(1)}%.` });
  } else if (efficiency >= 70) {
    score -= 10;
    alerts.push({ type: "info", title: "Eficiencia aceptable", message: `Aprovechamiento ${efficiency.toFixed(1)}%.` });
  } else if (efficiency > 0) {
    score -= 25;
    alerts.push({ type: "warning", title: "Merma elevada", message: `Aprovechamiento ${efficiency.toFixed(1)}%. Revisa 7x8/retazos.` });
  }

  if (wastePercent > 25) {
    score -= 20;
    alerts.push({ type: "warning", title: "Desperdicio alto", message: `Merma ${wastePercent.toFixed(1)}%.` });
  }

  if (input.hasGrain && input.respectGrain) {
    alerts.push({ type: "info", title: "Veta protegida", message: "Rotación bloqueada por dirección de veta." });
  }

  if (drillingCount > 0) {
    alerts.push({ type: "info", title: "CNC detectado", message: `${drillingCount} operaciones CNC.` });
  }

  recommendations.push({
    title: "Planchas requeridas",
    message: `La orden requiere ${input.sheetsCount ?? layouts.length} plancha(s).`,
  });

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    status: score >= 85 ? "excelente" : score >= 70 ? "bueno" : score >= 45 ? "revisar" : "critico",
    efficiency,
    wastePercent,
    alerts,
    recommendations,
  };
}
