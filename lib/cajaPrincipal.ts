export type PaymentStage = "measurement_5000" | "initial_60" | "delivery_20" | "final_20" | "other";

export type CajaContract = {
  id?: string | null;
  contract_code?: string | null;
  quote_id?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  project_name?: string | null;
  total_amount?: number | string | null;
  total_price?: number | string | null;
  credit_applied?: number | string | null;
  initial_required?: number | string | null;
  initial_60?: number | string | null;
  initial_paid?: number | string | null;
  paid_amount?: number | string | null;
  amount_paid?: number | string | null;
  delivery_20?: number | string | null;
  delivery_paid?: number | string | null;
  final_20?: number | string | null;
  final_paid?: number | string | null;
  status?: string | null;
  [key: string]: any;
};

export type CajaPayment = {
  id?: string | null;
  contract_id?: string | null;
  quote_id?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  payment_code?: string | null;
  code?: string | null;
  amount?: number | string | null;
  monto?: number | string | null;
  concept?: string | null;
  notes?: string | null;
  entity_type?: string | null;
  entity_name?: string | null;
  status?: string | null;
  [key: string]: any;
};

export type ContractPaymentSummary = {
  total: number;
  credit: number;
  initialRequired: number;
  initialPaid: number;
  initialDue: number;
  deliveryRequired: number;
  deliveryPaid: number;
  deliveryDue: number;
  finalRequired: number;
  finalPaid: number;
  finalDue: number;
  paidApplied: number;
  balance: number;
  initialCovered: boolean;
  deliveryCovered: boolean;
  finalCovered: boolean;
  stageTotals: Record<PaymentStage, number>;
};

export function toNumber(value: any) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeText(value: any) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function moneyDop(value: any) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(toNumber(value));
}

export function paymentAmount(payment?: CajaPayment | null) {
  return toNumber(payment?.amount ?? payment?.monto);
}

export function classifyClientPayment(payment?: CajaPayment | null): PaymentStage {
  const text = normalizeText(
    [
      payment?.concept,
      payment?.notes,
      payment?.entity_type,
      payment?.entity_name,
      payment?.payment_code,
      payment?.code,
    ].filter(Boolean).join(" ")
  );
  const amount = paymentAmount(payment);

  if ((text.includes("medicion") || text.includes("levantamiento") || text.includes("render")) && amount <= 10000) {
    return "measurement_5000";
  }

  if (text.includes("inicial") || text.includes("60%") || text.includes("60")) {
    return "initial_60";
  }

  if (
    text.includes("entrega final") ||
    text.includes("final") ||
    text.includes("cierre") ||
    text.includes("instalacion terminada") ||
    text.includes("finalizar")
  ) {
    return "final_20";
  }

  if (
    text.includes("entrega") ||
    text.includes("transporte") ||
    text.includes("despacho") ||
    text.includes("salida") ||
    text.includes("llevar") ||
    text.includes("modulos")
  ) {
    return "delivery_20";
  }

  return "other";
}

export function paymentBelongsToContract(payment: CajaPayment, contract: CajaContract) {
  const contractId = String(contract.id || "");
  const quoteId = String(contract.quote_id || "");
  const clientId = String(contract.client_id || "");
  const clientName = normalizeText(contract.client_name);

  if (contractId && String(payment.contract_id || "") === contractId) return true;
  if (quoteId && String(payment.quote_id || "") === quoteId) return true;
  if (clientId && String(payment.client_id || "") === clientId) return true;

  const paymentClient = normalizeText(payment.client_name);
  return Boolean(clientName && paymentClient && (clientName === paymentClient || clientName.includes(paymentClient) || paymentClient.includes(clientName)));
}

export function contractPaymentSummary(contract?: CajaContract | null, payments: CajaPayment[] = []): ContractPaymentSummary {
  const total = toNumber(contract?.total_amount ?? contract?.total_price);
  const credit = toNumber(contract?.credit_applied);
  const initialRequired = toNumber(contract?.initial_required ?? contract?.initial_60) || total * 0.6;
  const deliveryRequired = toNumber(contract?.delivery_20) || total * 0.2;
  const finalRequired = toNumber(contract?.final_20) || total * 0.2;

  const related = contract ? payments.filter((payment) => paymentBelongsToContract(payment, contract)) : [];
  const stageTotals: Record<PaymentStage, number> = {
    measurement_5000: 0,
    initial_60: 0,
    delivery_20: 0,
    final_20: 0,
    other: 0,
  };

  for (const payment of related) {
    const status = normalizeText(payment.status);
    if (status.includes("anulad") || status.includes("cancel")) continue;
    stageTotals[classifyClientPayment(payment)] += paymentAmount(payment);
  }

  const dbInitialPaid = toNumber(contract?.initial_paid ?? contract?.paid_amount ?? contract?.amount_paid);
  const initialPaid = Math.max(dbInitialPaid, stageTotals.initial_60);
  const deliveryPaid = Math.max(toNumber(contract?.delivery_paid), stageTotals.delivery_20);
  const finalPaid = Math.max(toNumber(contract?.final_paid), stageTotals.final_20);

  const initialDue = Math.max(initialRequired - initialPaid, 0);
  const deliveryDue = Math.max(deliveryRequired - deliveryPaid, 0);
  const finalDue = Math.max(finalRequired - credit - finalPaid, 0);
  const paidApplied = Math.min(total, credit + initialPaid + deliveryPaid + finalPaid);

  return {
    total,
    credit,
    initialRequired,
    initialPaid,
    initialDue,
    deliveryRequired,
    deliveryPaid,
    deliveryDue,
    finalRequired,
    finalPaid,
    finalDue,
    paidApplied,
    balance: Math.max(total - paidApplied, 0),
    initialCovered: total > 0 && initialDue <= 0,
    deliveryCovered: total > 0 && deliveryDue <= 0,
    finalCovered: total > 0 && finalDue <= 0,
    stageTotals,
  };
}

export function centralPaymentConcept(stage: PaymentStage, contract?: CajaContract | null) {
  const code = contract?.contract_code ? ` contrato ${contract.contract_code}` : "";
  if (stage === "measurement_5000") return `Abono medicion + render${code}`;
  if (stage === "initial_60") return `Pago inicial 60%${code}`;
  if (stage === "delivery_20") return `Pago 20% entrega/transporte${code}`;
  if (stage === "final_20") return `Pago 20% final instalacion${code}`;
  return `Ingreso Caja Principal${code}`;
}

export function matchContractToProject(
  input: {
    contractId?: any;
    quoteId?: any;
    orderCode?: any;
    clientName?: any;
    clientPhone?: any;
    projectName?: any;
  },
  contracts: CajaContract[] = []
) {
  const contractId = String(input.contractId || "");
  const quoteId = String(input.quoteId || "");
  const orderCode = normalizeText(input.orderCode);
  const clientName = normalizeText(input.clientName);
  const clientPhone = normalizeText(String(input.clientPhone || "").replace(/\D/g, ""));
  const projectName = normalizeText(input.projectName);

  let best: { contract: CajaContract; score: number } | null = null;

  for (const contract of contracts) {
    let score = 0;
    if (contractId && String(contract.id || "") === contractId) score += 100;
    if (quoteId && String(contract.quote_id || "") === quoteId) score += 80;

    const contractOrder = normalizeText(
      contract.order_code || contract.production_order_code || contract.production_code || contract.work_order_code
    );
    if (orderCode && contractOrder && (orderCode === contractOrder || orderCode.includes(contractOrder) || contractOrder.includes(orderCode))) {
      score += 45;
    }

    const contractClient = normalizeText(contract.client_name);
    if (clientName && contractClient && (clientName === contractClient || clientName.includes(contractClient) || contractClient.includes(clientName))) {
      score += 35;
    }

    const contractProject = normalizeText(contract.project_name);
    if (projectName && contractProject && (projectName === contractProject || projectName.includes(contractProject) || contractProject.includes(projectName))) {
      score += 35;
    }

    const contractPhone = normalizeText(String(contract.client_phone || "").replace(/\D/g, ""));
    if (clientPhone && contractPhone && (clientPhone === contractPhone || clientPhone.endsWith(contractPhone) || contractPhone.endsWith(clientPhone))) {
      score += 20;
    }

    if (!best || score > best.score) best = { contract, score };
  }

  return best && best.score >= 35 ? best.contract : null;
}
