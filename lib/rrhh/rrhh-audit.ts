export type RrhhSeverity = "critical" | "warning" | "info";

export type RrhhIssue = {
  severity: RrhhSeverity;
  area: string;
  title: string;
  detail: string;
  action: string;
  employeeId?: string;
};

export type RrhhAuditResult = {
  score: number;
  issues: RrhhIssue[];
  metrics: {
    employees: number;
    activeEmployees: number;
    missingBank: number;
    missingDocs: number;
    attendanceEvents: number;
    lowConfidenceEvents: number;
    payrollRuns: number;
    payrollMismatch: number;
  };
  recommendations: string[];
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

function isActive(employee: any) {
  const status = norm(employee?.status || "activo");
  return status.includes("activo") && !status.includes("inactivo");
}

function dayKey(value: any) {
  return txt(value).slice(0, 10);
}

function addIssue(issues: RrhhIssue[], issue: RrhhIssue) {
  issues.push(issue);
}

export function analyzeRrhhAudit(input: {
  employees?: any[];
  documents?: any[];
  attendanceEvents?: any[];
  payrollRuns?: any[];
  payrollItems?: any[];
}): RrhhAuditResult {
  const employees = input.employees || [];
  const documents = input.documents || [];
  const attendanceEvents = input.attendanceEvents || [];
  const payrollRuns = input.payrollRuns || [];
  const payrollItems = input.payrollItems || [];
  const issues: RrhhIssue[] = [];

  const activeEmployees = employees.filter(isActive);
  const docsByEmployee = new Map<string, number>();
  documents.forEach((doc) => {
    const employeeId = txt(doc.employee_id);
    if (!employeeId) return;
    docsByEmployee.set(employeeId, (docsByEmployee.get(employeeId) || 0) + 1);
  });

  const idMap = new Map<string, any[]>();
  employees.forEach((employee) => {
    const identification = norm(employee.identification || employee.document_id || employee.cedula);
    if (!identification) return;
    const rows = idMap.get(identification) || [];
    rows.push(employee);
    idMap.set(identification, rows);
  });

  idMap.forEach((rows) => {
    if (rows.length <= 1) return;
    addIssue(issues, {
      severity: "critical",
      area: "Empleados",
      title: "Identificacion duplicada",
      detail: `${rows.length} empleados comparten la misma cedula/documento.`,
      action: "Bloquear cambios de nomina hasta depurar el expediente duplicado.",
      employeeId: rows[0]?.id,
    });
  });

  activeEmployees.forEach((employee) => {
    const salary = n(employee.salary);
    if (salary <= 0 && norm(employee.salary_type || "mensual") !== "por_hora") {
      addIssue(issues, {
        severity: "warning",
        area: "Nomina",
        title: "Empleado activo sin salario",
        detail: `${employee.full_name || "Empleado"} esta activo con salario cero.`,
        action: "Completar salario antes de calcular nomina.",
        employeeId: employee.id,
      });
    }

    if (salary > 0 && (!txt(employee.bank_name) || !txt(employee.bank_account))) {
      addIssue(issues, {
        severity: "warning",
        area: "Banco",
        title: "Cuenta bancaria incompleta",
        detail: `${employee.full_name || "Empleado"} tiene salario, pero no tiene banco/cuenta completo.`,
        action: "Completar datos bancarios o marcar pago manual autorizado.",
        employeeId: employee.id,
      });
    }

    if (!docsByEmployee.get(employee.id)) {
      addIssue(issues, {
        severity: "info",
        area: "Expediente",
        title: "Expediente sin documentos",
        detail: `${employee.full_name || "Empleado"} no tiene documentos adjuntos.`,
        action: "Subir cedula, contrato, cuenta bancaria y documentos obligatorios.",
        employeeId: employee.id,
      });
    }
  });

  const employeeIds = new Set(employees.map((employee) => txt(employee.id)).filter(Boolean));
  const eventBuckets = new Map<string, any[]>();
  let lowConfidenceEvents = 0;

  attendanceEvents.forEach((event) => {
    const employeeId = txt(event.employee_id);
    const type = txt(event.event_type);
    const key = `${employeeId}|${dayKey(event.created_at)}|${type}`;
    const current = eventBuckets.get(key) || [];
    current.push(event);
    eventBuckets.set(key, current);

    if (employeeId && !employeeIds.has(employeeId)) {
      addIssue(issues, {
        severity: "critical",
        area: "Asistencia",
        title: "Ponche sin empleado valido",
        detail: `Evento ${event.id || ""} apunta a un empleado inexistente.`,
        action: "Auditar origen del dispositivo y corregir employee_id.",
      });
    }

    const confidence = n(event.confidence_score);
    if (confidence > 0 && confidence < 65) {
      lowConfidenceEvents += 1;
    }
  });

  eventBuckets.forEach((events) => {
    if (events.length <= 1) return;
    const sorted = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const minutes = Math.abs(new Date(last.created_at).getTime() - new Date(first.created_at).getTime()) / 60000;
    if (minutes <= 5) {
      addIssue(issues, {
        severity: "warning",
        area: "Asistencia",
        title: "Ponche duplicado cercano",
        detail: `${events.length} eventos iguales en menos de 5 minutos.`,
        action: "Revisar si fue doble lectura facial o intento repetido.",
        employeeId: txt(first.employee_id),
      });
    }
  });

  if (lowConfidenceEvents > 0) {
    addIssue(issues, {
      severity: "warning",
      area: "IA Facial",
      title: "Confianza facial baja",
      detail: `${lowConfidenceEvents} ponche(s) quedaron por debajo de 65%.`,
      action: "Verificar foto, iluminacion y usuario antes de pagar horas.",
    });
  }

  const itemsByRun = new Map<string, any[]>();
  payrollItems.forEach((item) => {
    const runId = txt(item.payroll_run_id);
    if (!runId) return;
    const current = itemsByRun.get(runId) || [];
    current.push(item);
    itemsByRun.set(runId, current);
  });

  let payrollMismatch = 0;
  payrollRuns.forEach((run) => {
    const runItems = itemsByRun.get(txt(run.id)) || [];
    const netItems = runItems.reduce((sum, item) => sum + n(item.net_pay), 0);
    const runNet = n(run.net_total);
    if (runItems.length > 0 && Math.abs(netItems - runNet) > 1) {
      payrollMismatch += 1;
      addIssue(issues, {
        severity: "critical",
        area: "Nomina",
        title: "Nomina no cuadra",
        detail: `Run ${run.id} tiene neto ${runNet.toFixed(2)} y partidas por ${netItems.toFixed(2)}.`,
        action: "No pagar hasta recalcular o corregir partidas.",
      });
    }
  });

  const periodMap = new Map<string, any[]>();
  payrollRuns.forEach((run) => {
    const key = `${txt(run.period_start)}|${txt(run.period_end)}`;
    if (!key.trim()) return;
    const current = periodMap.get(key) || [];
    current.push(run);
    periodMap.set(key, current);
  });
  periodMap.forEach((runs) => {
    const activeRuns = runs.filter((run) => !norm(run.status).includes("cancel"));
    if (activeRuns.length > 1) {
      addIssue(issues, {
        severity: "critical",
        area: "Nomina",
        title: "Periodo de nomina duplicado",
        detail: `${activeRuns.length} corridas activas comparten el mismo periodo.`,
        action: "Aprobar solo una corrida y cancelar las duplicadas.",
      });
    }
  });

  const missingBank = activeEmployees.filter((employee) => n(employee.salary) > 0 && (!txt(employee.bank_name) || !txt(employee.bank_account))).length;
  const missingDocs = activeEmployees.filter((employee) => !docsByEmployee.get(employee.id)).length;
  const critical = issues.filter((issue) => issue.severity === "critical").length;
  const warning = issues.filter((issue) => issue.severity === "warning").length;
  const score = Math.max(0, Math.min(100, 100 - critical * 18 - warning * 7 - missingDocs * 1));

  const recommendations = [
    "Nomina no debe pagarse si hay corridas duplicadas o totales que no cuadran.",
    "Todo empleado activo con salario debe tener expediente, banco/cuenta y documento de identidad.",
    "Ponches con confianza facial baja deben revisarse antes de cerrar asistencia.",
    "Cambios de salario, banco o estado deben quedar en audit_logs con usuario y fecha.",
  ];

  return {
    score,
    issues: issues.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    }),
    metrics: {
      employees: employees.length,
      activeEmployees: activeEmployees.length,
      missingBank,
      missingDocs,
      attendanceEvents: attendanceEvents.length,
      lowConfidenceEvents,
      payrollRuns: payrollRuns.length,
      payrollMismatch,
    },
    recommendations,
  };
}
