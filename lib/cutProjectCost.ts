export type TotalCostInput = {
  materialCost?: number;
  edgeCost?: number;
  hardwareCost?: number;
  cncCost?: number;
  wasteCost?: number;
  productionLinearFeet?: number;
  installationLinearFeet?: number;
  productionMasterRate?: number;
  productionAssistantRate?: number;
  installationMasterRate?: number;
  installationAssistantRate?: number;
  transportCost?: number;
  extraCost?: number;
  profitPercent?: number;
  itbisPercent?: number;
};

export type TotalCostResult = {
  materialCost: number;
  edgeCost: number;
  hardwareCost: number;
  cncCost: number;
  wasteCost: number;
  productionLaborCost: number;
  installationLaborCost: number;
  transportCost: number;
  extraCost: number;
  subtotalCost: number;
  profitAmount: number;
  priceBeforeTax: number;
  itbisAmount: number;
  suggestedPrice: number;
  marginPercent: number;
};

export function calculateTotalProjectCost(input: TotalCostInput): TotalCostResult {
  const materialCost = Number(input.materialCost || 0);
  const edgeCost = Number(input.edgeCost || 0);
  const hardwareCost = Number(input.hardwareCost || 0);
  const cncCost = Number(input.cncCost || 0);
  const wasteCost = Number(input.wasteCost || 0);
  const transportCost = Number(input.transportCost || 0);
  const extraCost = Number(input.extraCost || 0);

  const productionLinearFeet = Number(input.productionLinearFeet || 0);
  const installationLinearFeet = Number(input.installationLinearFeet || 0);

  const productionMasterRate = Number(input.productionMasterRate ?? 200);
  const productionAssistantRate = Number(input.productionAssistantRate ?? 100);
  const installationMasterRate = Number(input.installationMasterRate ?? 200);
  const installationAssistantRate = Number(input.installationAssistantRate ?? 100);

  const productionLaborCost =
    productionLinearFeet * (productionMasterRate + productionAssistantRate);

  const installationLaborCost =
    installationLinearFeet * (installationMasterRate + installationAssistantRate);

  const subtotalCost =
    materialCost +
    edgeCost +
    hardwareCost +
    cncCost +
    wasteCost +
    productionLaborCost +
    installationLaborCost +
    transportCost +
    extraCost;

  const profitPercent = Number(input.profitPercent ?? 35);
  const itbisPercent = Number(input.itbisPercent ?? 18);

  const profitAmount = subtotalCost * (profitPercent / 100);
  const priceBeforeTax = subtotalCost + profitAmount;
  const itbisAmount = priceBeforeTax * (itbisPercent / 100);
  const suggestedPrice = priceBeforeTax + itbisAmount;

  const marginPercent =
    suggestedPrice > 0 ? ((suggestedPrice - subtotalCost) / suggestedPrice) * 100 : 0;

  return {
    materialCost,
    edgeCost,
    hardwareCost,
    cncCost,
    wasteCost,
    productionLaborCost,
    installationLaborCost,
    transportCost,
    extraCost,
    subtotalCost,
    profitAmount,
    priceBeforeTax,
    itbisAmount,
    suggestedPrice,
    marginPercent,
  };
}

export function buildCostBreakdownRows(result: TotalCostResult) {
  return [
    { label: "Materiales / Melamina", amount: result.materialCost },
    { label: "Canto PVC", amount: result.edgeCost },
    { label: "Herrajes", amount: result.hardwareCost },
    { label: "CNC / Corte", amount: result.cncCost },
    { label: "Merma / Desperdicio", amount: result.wasteCost },
    { label: "Mano de obra produccion", amount: result.productionLaborCost },
    { label: "Mano de obra instalacion", amount: result.installationLaborCost },
    { label: "Transporte", amount: result.transportCost },
    { label: "Extras", amount: result.extraCost },
    { label: "Subtotal costo", amount: result.subtotalCost, strong: true },
    { label: "Utilidad", amount: result.profitAmount },
    { label: "Precio antes ITBIS", amount: result.priceBeforeTax, strong: true },
    { label: "ITBIS", amount: result.itbisAmount },
    { label: "Precio sugerido", amount: result.suggestedPrice, strong: true },
  ];
}

export function exportTotalCostCsv(result: TotalCostResult): string {
  const rows = buildCostBreakdownRows(result);
  const headers = ["concepto", "monto"];

  return [
    headers.join(","),
    ...rows.map((row) =>
      [`"${row.label.replace(/"/g, '""')}"`, `"${Number(row.amount || 0).toFixed(2)}"`].join(",")
    ),
  ].join("\n");
}
