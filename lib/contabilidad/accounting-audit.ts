export type AccountingSeverity = "critical" | "warning" | "info";
export type LedgerType = "income" | "expense" | "receivable" | "payable" | "audit";

export type LedgerEntry = {
  id: string;
  type: LedgerType;
  source: string;
  code: string;
  party: string;
  description: string;
  amount: number;
  paid: number;
  balance: number;
  method?: string;
  status?: string;
  createdAt?: string;
};

export type AccountingIssue = {
  severity: AccountingSeverity;
  area: string;
  title: string;
  detail: string;
  action: string;
  entryId?: string;
};

export type AccountingAuditResult = {
  score: number;
  ledger: LedgerEntry[];
  issues: AccountingIssue[];
  metrics: {
    invoicedIncome: number;
    cashIn: number;
    cashOut: number;
    receivableOpen: number;
    payableOpen: number;
    purchaseOrders: number;
    payrollNet: number;
    auditLogs: number;
    criticalIssues: number;
    warningIssues: number;
  };
  controls: string[];
};

function n(value: any) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function txt(value: any) {
  return String(value ?? "").trim();
}

function norm(value: any) {
  return txt(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function amountFrom(row: any, keys: string[]) {
  for (const key of keys) {
    const value = n(row?.[key]);
    if (value !== 0) return value;
  }
  return 0;
}

function dateKey(value: any) {
  return txt(value).slice(0, 10);
}

function rowId(row: any) {
  return txt(row?.id);
}

function sourceId(row: any) {
  return txt(row?.source_id || row?.payment_id || row?.entity_id || row?.client_payment_id);
}

function addIssue(issues: AccountingIssue[], issue: AccountingIssue) {
  issues.push(issue);
}

export function analyzeAccountingAudit(input: {
  sales?: any[];
  projectContracts?: any[];
  payments?: any[];
  clientPayments?: any[];
  incomeRecords?: any[];
  accountsPayable?: any[];
  payablePayments?: any[];
  purchaseOrders?: any[];
  payrollRuns?: any[];
  auditLogs?: any[];
}): AccountingAuditResult {
  const sales = input.sales || [];
  const projectContracts = input.projectContracts || [];
  const payments = input.payments || [];
  const clientPayments = input.clientPayments || [];
  const incomeRecords = input.incomeRecords || [];
  const accountsPayable = input.accountsPayable || [];
  const payablePayments = input.payablePayments || [];
  const purchaseOrders = input.purchaseOrders || [];
  const payrollRuns = input.payrollRuns || [];
  const auditLogs = input.auditLogs || [];

  const issues: AccountingIssue[] = [];
  const ledger: LedgerEntry[] = [];
  const paymentIds = new Set(payments.map(rowId).filter(Boolean));
  const clientPaymentIds = new Set(clientPayments.map(rowId).filter(Boolean));
  const linkedIncomeIds = new Set(
    clientPayments
      .map((payment) => txt(payment?.income_record_id || payment?.income_id))
      .filter(Boolean),
  );
  const saleContractIds = new Set(sales.map((sale) => txt(sale?.contract_id || sale?.project_contract_id)).filter(Boolean));

  projectContracts.forEach((contract) => {
    if (saleContractIds.has(rowId(contract))) return;

    const total = amountFrom(contract, ["total_amount", "total_price", "final_amount", "amount", "total"]);
    const paid = amountFrom(contract, ["amount_paid", "paid_amount", "initial_paid", "paid", "pagado"]);
    const storedBalance = amountFrom(contract, ["balance", "balance_due", "pending_amount"]);
    const balance = storedBalance || Math.max(total - paid, 0);

    if (total <= 0) return;

    ledger.push({
      id: `contract:${contract.id || contract.contract_code}`,
      type: "receivable",
      source: "project_contracts",
      code: txt(contract.contract_code || contract.quote_no || contract.id || "CONTRATO"),
      party: txt(contract.client_name || contract.customer_name || "Cliente"),
      description: txt(contract.project_name || contract.project_type || "Contrato de proyecto"),
      amount: total,
      paid,
      balance,
      status: txt(contract.status || contract.workflow_status),
      createdAt: txt(contract.created_at),
    });

    if (total > 0 && Math.abs(total - paid - balance) > 1) {
      addIssue(issues, {
        severity: "warning",
        area: "CxC",
        title: "Contrato no cuadra",
        detail: `${contract.contract_code || contract.id}: total - pagado no coincide con balance.`,
        action: "Reconciliar contrato contra Caja Principal antes del cierre.",
        entryId: `contract:${contract.id || contract.contract_code}`,
      });
    }
  });

  sales.forEach((sale) => {
    const total = amountFrom(sale, ["total", "total_amount", "subtotal"]);
    const paid = amountFrom(sale, ["amount_paid", "paid", "pagado"]);
    const balance = amountFrom(sale, ["balance", "balance_due"]);
    ledger.push({
      id: `sale:${sale.id || sale.invoice_number}`,
      type: "receivable",
      source: "sales",
      code: txt(sale.invoice_number || sale.sale_code || sale.id || "VENTA"),
      party: txt(sale.client_name || sale.customer_name || "Cliente"),
      description: "Factura / venta emitida",
      amount: total,
      paid,
      balance,
      status: txt(sale.status),
      createdAt: txt(sale.created_at),
    });

    if (total > 0 && Math.abs(total - paid - balance) > 1) {
      addIssue(issues, {
        severity: "critical",
        area: "CxC",
        title: "Factura no cuadra",
        detail: `${sale.invoice_number || sale.id}: total - pagado no coincide con balance.`,
        action: "Bloquear nuevos cobros sobre esta factura hasta reconciliar.",
        entryId: `sale:${sale.id || sale.invoice_number}`,
      });
    }
  });

  payments.forEach((payment) => {
    const amount = amountFrom(payment, ["monto", "amount", "total"]);
    ledger.push({
      id: `payment:${payment.id}`,
      type: "income",
      source: "payments",
      code: txt(payment.reference || payment.id || "PAGO"),
      party: txt(payment.client_name || payment.cliente_nombre || payment.sale_id || "Cliente"),
      description: txt(payment.nota || payment.notes || "Cobro registrado"),
      amount,
      paid: amount,
      balance: 0,
      method: txt(payment.metodo || payment.payment_method),
      status: txt(payment.status || "registrado"),
      createdAt: txt(payment.created_at),
    });

    if (amount <= 0) {
      addIssue(issues, {
        severity: "critical",
        area: "Ingresos",
        title: "Pago con monto invalido",
        detail: `Pago ${payment.id || ""} tiene monto cero o negativo.`,
        action: "Anular o corregir con soporte firmado.",
        entryId: `payment:${payment.id}`,
      });
    }

    const method = norm(payment.metodo || payment.payment_method);
    const hasReference = txt(payment.reference || payment.referencia || payment.transaction_id || payment.nota).length > 0;
    if (method && method !== "efectivo" && !hasReference) {
      addIssue(issues, {
        severity: "warning",
        area: "Ingresos",
        title: "Cobro no efectivo sin referencia",
        detail: `Pago ${payment.id || ""} fue marcado ${method}, pero no tiene referencia.`,
        action: "Solicitar comprobante bancario antes de cierre de caja.",
        entryId: `payment:${payment.id}`,
      });
    }
  });

  clientPayments.forEach((payment) => {
    const amount = amountFrom(payment, ["amount", "monto", "total"]);
    ledger.push({
      id: `client_payment:${payment.id}`,
      type: "income",
      source: "caja_principal",
      code: txt(payment.payment_code || payment.code || payment.reference || payment.id || "INGRESO"),
      party: txt(payment.client_name || payment.customer_name || payment.client_id || "Cliente"),
      description: txt(payment.description || payment.notes || "Pago cliente"),
      amount,
      paid: amount,
      balance: 0,
      method: txt(payment.payment_method || payment.method),
      status: txt(payment.status || "registrado"),
      createdAt: txt(payment.created_at),
    });
  });

  incomeRecords.forEach((income) => {
    const sourceType = norm(income.source_type || income.entity_name || income.source);
    const linkedPaymentId = sourceId(income);
    const isClientPaymentMirror =
      sourceType === "client_payments" &&
      (clientPaymentIds.has(linkedPaymentId) || linkedIncomeIds.has(rowId(income)));
    const isPaymentMirror = sourceType === "payments" && paymentIds.has(linkedPaymentId);

    if (isClientPaymentMirror || isPaymentMirror) return;

    const amount = amountFrom(income, ["amount", "monto", "total"]);
    ledger.push({
      id: `income:${income.id}`,
      type: "income",
      source: "ingreso_manual",
      code: txt(income.income_code || income.code || income.id || "INGRESO"),
      party: txt(income.client_name || income.customer_name || income.client_id || "Cliente"),
      description: txt(income.description || income.concept || "Ingreso auditable"),
      amount,
      paid: amount,
      balance: 0,
      method: txt(income.payment_method || income.method),
      status: txt(income.status || "registrado"),
      createdAt: txt(income.created_at),
    });
  });

  accountsPayable.forEach((payable) => {
    const total = amountFrom(payable, ["total_amount", "amount", "total"]);
    const paid = amountFrom(payable, ["amount_paid", "paid"]);
    const balance = amountFrom(payable, ["balance_due", "balance"]);
    ledger.push({
      id: `payable:${payable.id}`,
      type: "payable",
      source: "accounts_payable",
      code: txt(payable.bill_no || payable.invoice_number || payable.id || "CXP"),
      party: txt(payable.supplier_name || payable.vendor_name || "Suplidor"),
      description: txt(payable.description || payable.category || "Cuenta por pagar"),
      amount: total,
      paid,
      balance,
      method: "",
      status: txt(payable.status),
      createdAt: txt(payable.created_at),
    });

    if (total > 0 && Math.abs(total - paid - balance) > 1) {
      addIssue(issues, {
        severity: "critical",
        area: "CxP",
        title: "Cuenta por pagar no cuadra",
        detail: `${payable.bill_no || payable.id}: total - pagado no coincide con balance.`,
        action: "No autorizar mas pagos hasta reconciliar la cuenta.",
        entryId: `payable:${payable.id}`,
      });
    }
  });

  payablePayments.forEach((payment) => {
    const amount = amountFrom(payment, ["amount", "monto", "total"]);
    ledger.push({
      id: `payable_payment:${payment.id}`,
      type: "expense",
      source: "accounts_payable_payments",
      code: txt(payment.reference || payment.id || "EGRESO"),
      party: txt(payment.supplier_name || payment.payable_id || "Suplidor"),
      description: txt(payment.notes || payment.description || "Pago suplidor"),
      amount,
      paid: amount,
      balance: 0,
      method: txt(payment.payment_method || payment.metodo),
      status: txt(payment.status || "registrado"),
      createdAt: txt(payment.created_at),
    });
  });

  purchaseOrders.forEach((po) => {
    const total = amountFrom(po, ["total_amount", "total", "amount"]);
    ledger.push({
      id: `po:${po.id}`,
      type: "payable",
      source: "purchase_orders",
      code: txt(po.po_number || po.order_number || po.id || "OC"),
      party: txt(po.supplier_name || po.vendor_name || "Suplidor"),
      description: txt(po.notes || po.description || "Orden de compra"),
      amount: total,
      paid: 0,
      balance: total,
      status: txt(po.status),
      createdAt: txt(po.created_at),
    });

    if (total > 25000 && !txt(po.supplier_name || po.vendor_name)) {
      addIssue(issues, {
        severity: "warning",
        area: "Compras",
        title: "Orden alta sin suplidor claro",
        detail: `${po.po_number || po.id} supera RD$25,000 y no tiene suplidor legible.`,
        action: "Exigir suplidor, cotizacion y aprobacion antes de recibir.",
        entryId: `po:${po.id}`,
      });
    }
  });

  payrollRuns.forEach((run) => {
    const net = amountFrom(run, ["net_total", "total_net", "amount"]);
    ledger.push({
      id: `payroll:${run.id}`,
      type: "expense",
      source: "payroll_runs",
      code: txt(run.payroll_code || run.id || "NOMINA"),
      party: "Equipo RD Wood",
      description: `Nomina ${txt(run.period_start)} - ${txt(run.period_end)}`,
      amount: net,
      paid: norm(run.status).includes("pag") ? net : 0,
      balance: norm(run.status).includes("pag") ? 0 : net,
      status: txt(run.status),
      createdAt: txt(run.created_at),
    });
  });

  const duplicatePaymentMap = new Map<string, LedgerEntry[]>();
  ledger
    .filter((entry) => entry.type === "income" || entry.type === "expense")
    .forEach((entry) => {
      const key = `${entry.type}|${entry.party}|${entry.amount.toFixed(2)}|${dateKey(entry.createdAt)}`;
      const current = duplicatePaymentMap.get(key) || [];
      current.push(entry);
      duplicatePaymentMap.set(key, current);
    });

  duplicatePaymentMap.forEach((entries) => {
    if (entries.length <= 1 || entries[0].amount <= 0) return;
    const distinctSources = new Set(entries.map((entry) => entry.source));
    const distinctCodes = new Set(entries.map((entry) => entry.code).filter(Boolean));
    if (distinctSources.size <= 1 && distinctCodes.size <= 1) return;

    addIssue(issues, {
      severity: "warning",
      area: "Duplicados",
      title: "Movimiento posiblemente duplicado",
      detail: `${entries.length} movimientos iguales para ${entries[0].party} por ${entries[0].amount.toFixed(2)} el mismo dia.`,
      action: "Reconciliar contra recibo, transferencia o caja diaria.",
      entryId: entries[0].id,
    });
  });

  const transactionCount = ledger.filter((entry) => entry.type !== "audit").length;
  if (transactionCount > 0 && auditLogs.length < Math.min(transactionCount, 10)) {
    addIssue(issues, {
      severity: "warning",
      area: "Auditoria",
      title: "Baja cobertura de audit_logs",
      detail: `${auditLogs.length} logs para ${transactionCount} movimientos financieros cargados.`,
      action: "Registrar cada ingreso, egreso, anulacion y cambio de balance en audit_logs.",
    });
  }

  const cashIn = ledger.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0);
  const cashOut = ledger.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0);
  const invoicedIncome = ledger.filter((entry) => entry.type === "receivable").reduce((sum, entry) => sum + entry.amount, 0);
  const receivableOpen = ledger.filter((entry) => entry.type === "receivable").reduce((sum, entry) => sum + Math.max(entry.balance, 0), 0);
  const payableOpen = ledger.filter((entry) => entry.type === "payable").reduce((sum, entry) => sum + Math.max(entry.balance, 0), 0);
  const purchaseOrderTotal = purchaseOrders.reduce((sum, po) => sum + amountFrom(po, ["total_amount", "total", "amount"]), 0);
  const payrollNet = payrollRuns.reduce((sum, run) => sum + amountFrom(run, ["net_total", "total_net", "amount"]), 0);

  const criticalIssues = issues.filter((issue) => issue.severity === "critical").length;
  const warningIssues = issues.filter((issue) => issue.severity === "warning").length;
  const score = Math.max(0, Math.min(100, 100 - criticalIssues * 20 - warningIssues * 6));

  const controls = [
    "Todo ingreso debe tener codigo, metodo, soporte y quedar en audit_logs.",
    "Todo egreso mayor a RD$25,000 debe requerir doble autorizacion y soporte.",
    "Caja diaria debe cuadrar ventas, cobros, ingresos manuales y depositos.",
    "No permitir borrar movimientos financieros: solo reversos auditados.",
    "Separar funciones: quien crea la cuenta no debe ser quien autoriza el pago final.",
  ];

  return {
    score,
    ledger: ledger.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    issues: issues.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    }),
    metrics: {
      invoicedIncome,
      cashIn,
      cashOut,
      receivableOpen,
      payableOpen,
      purchaseOrders: purchaseOrderTotal,
      payrollNet,
      auditLogs: auditLogs.length,
      criticalIssues,
      warningIssues,
    },
    controls,
  };
}
