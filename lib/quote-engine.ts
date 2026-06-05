export type QuoteTotals = {
  subtotal: number;
  laborCost: number;
  indirectCost: number;
  totalCost: number;
  marginPercent: number;
  utilityAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalPrice: number;
  amountPaid: number;
  balance: number;
};

export function calculateQuoteTotals(params: {
  subtotal: number;
  laborCost?: number;
  indirectCost?: number;
  marginPercent?: number;
  taxPercent?: number;
  amountPaid?: number;
}): QuoteTotals {
  const subtotal = Number(params.subtotal || 0);
  const laborCost = Number(params.laborCost || 0);
  const indirectCost = Number(params.indirectCost || 0);
  const marginPercent = Number(params.marginPercent ?? 35);
  const taxPercent = Number(params.taxPercent ?? 18);
  const amountPaid = Number(params.amountPaid || 0);
  const totalCost = subtotal + laborCost + indirectCost;
  const utilityAmount = totalCost * (marginPercent / 100);
  const beforeTax = totalCost + utilityAmount;
  const taxAmount = beforeTax * (taxPercent / 100);
  const totalPrice = beforeTax + taxAmount;
  const balance = totalPrice - amountPaid;
  return { subtotal, laborCost, indirectCost, totalCost, marginPercent, utilityAmount, taxPercent, taxAmount, totalPrice, amountPaid, balance };
}

export function calculateQuoteItem(params: { quantity: number; unitCost: number; marginPercent?: number }) {
  const quantity = Number(params.quantity || 0);
  const unitCost = Number(params.unitCost || 0);
  const marginPercent = Number(params.marginPercent ?? 35);
  const totalCost = quantity * unitCost;
  const unitPrice = unitCost * (1 + marginPercent / 100);
  const totalPrice = quantity * unitPrice;
  return { quantity, unitCost, totalCost, marginPercent, unitPrice, totalPrice };
}
