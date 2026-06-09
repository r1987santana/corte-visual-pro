import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(fileName) {
  const envPath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

const TABLES_TO_CLEAR = [
  "technical_visit_photos",
  "technical_visit_reports",
  "field_measurement_photos",
  "field_measurement_modules",
  "field_measurements",
  "measurement_payment_requests",
  "measurement_payments",
  "measurement_receipts",
  "visit_payments",
  "levantamiento_photos",
  "levantamientos",
  "calendar_events",
  "agenda_events",
  "crm_notes",
  "crm_events",
  "crm_leads",
  "project_module_pieces",
  "project_module_items",
  "project_modules",
  "project_photos",
  "project_files",
  "project_activity",
  "project_timeline",
  "project_claims",
  "projects",
  "client_referral_rewards",
  "client_referrals",
  "clients",
  "ai_design_parts",
  "ai_design_variants",
  "ai_design_modules",
  "ai_render_jobs",
  "ai_design_renders",
  "ai_design_requests",
  "client_portal_events",
  "client_portal_tokens",
  "client_requests",
  "client_feedback",
  "client_reviews",
  "quote_items",
  "quote_versions",
  "project_quotes",
  "quotes",
  "contract_signatures",
  "project_contract_signatures",
  "project_contracts",
  "contracts",
  "payment_receipts",
  "cash_payments",
  "client_payments",
  "payment_requests",
  "payments",
  "income_records",
  "cash_transactions",
  "cash_movements",
  "main_cash_payments",
  "central_cash_payments",
  "sale_items",
  "sales",
  "invoice_items",
  "invoices",
  "accounts_receivable",
  "accounting_entries",
  "accounting_journal",
  "accounting_ledger",
  "warehouse_requisition_items",
  "warehouse_requisitions",
  "purchase_receipt_items",
  "purchase_receipts",
  "purchase_order_items",
  "purchase_orders",
  "supplier_invoices",
  "accounts_payable_payments",
  "accounts_payable",
  "inventory_movements",
  "inventory_scraps",
  "movimientos",
  "production_order_items",
  "production_order_events",
  "production_order_logs",
  "production_orders",
  "production_bom_items",
  "production_boms",
  "bom_items",
  "boms",
  "recipe_items",
  "recipes",
  "product_bom_items",
  "product_bom_recipes",
  "cut_optimization_pieces",
  "cut_optimizations",
  "cut_service_invoice_items",
  "cut_service_invoices",
  "cnc_files",
  "cnc_jobs",
  "custom_vector_exports",
  "custom_vector_paths",
  "custom_vector_projects",
  "piece_labels",
  "piece_events",
  "piece_scans",
  "transport_module_photos",
  "transport_module_events",
  "transport_handoffs",
  "transport_deliveries",
  "installation_module_photos",
  "installation_module_events",
  "installation_assignments",
  "installation_handoffs",
  "installation_reports",
  "installation_report_photos",
  "installation_signatures",
  "project_installation_scans",
  "project_installation_plans",
  "verification_photos",
  "verification_reports",
  "qa_observations",
  "final_delivery_photos",
  "final_delivery_signatures",
  "final_delivery_reports",
  "after_sales_ticket_events",
  "after_sales_tickets",
  "postventa_visits",
  "postventa_tickets",
  "gamification_points",
  "gamification_redemptions",
  "operational_compensation_events",
  "payroll_run_items",
  "payroll_runs",
  "audit_events",
  "audit_logs",
  "furniture_parts",
  "furniture_modules",
  "furniture_projects",
];

const KEEP_TABLE_PATTERNS = [
  /^inventory$/,
  /^inventory_items$/,
  /^inventory_available_for_cut$/,
  /^products$/,
  /^product_categories$/,
  /^categories$/,
  /^subcategories$/,
  /^app_users$/,
  /^app_roles$/,
  /^app_permissions$/,
  /^app_sessions$/,
  /^employees$/,
  /^operational_teams$/,
  /^operational_team_members$/,
  /^gamification_rules$/,
  /^gamification_collaborators$/,
  /^gamification_rewards$/,
];

function isKeptTable(table) {
  return KEEP_TABLE_PATTERNS.some((pattern) => pattern.test(table));
}

async function tableExists(supabase, table) {
  const { error } = await supabase.from(table).select("*").limit(1);
  return !error;
}

async function deleteAllRows(supabase, table) {
  const filters = [
    ["id", "not", "is", null],
    ["created_at", "not", "is", null],
    ["updated_at", "not", "is", null],
    ["code", "not", "is", null],
  ];

  let lastError = null;
  for (const [column, op, modifier, value] of filters) {
    let query = supabase.from(table).delete({ count: "exact" });
    query = op === "not" ? query.not(column, modifier, value) : query;
    const { count, error } = await query;
    if (!error) return { ok: true, count: count || 0 };
    lastError = error;
  }

  return { ok: false, count: 0, error: lastError?.message || "No se pudo limpiar la tabla" };
}

async function countRows(supabase, table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) return null;
  return count || 0;
}

async function updateAllRows(supabase, table, payload) {
  const filters = [
    ["id", "not", "is", null],
    ["created_at", "not", "is", null],
    ["updated_at", "not", "is", null],
    ["code", "not", "is", null],
  ];

  let lastError = null;
  for (const [column, op, modifier, value] of filters) {
    let query = supabase.from(table).update(payload, { count: "exact" });
    query = op === "not" ? query.not(column, modifier, value) : query;
    const { count, error } = await query;
    if (!error) return { ok: true, count: count || 0 };
    lastError = error;
  }

  return { ok: false, count: 0, error: lastError?.message || "No se pudo actualizar la tabla" };
}

async function resetInventoryStock(supabase, table, stockValue) {
  if (!(await tableExists(supabase, table))) return { table, skipped: true, reason: "no existe" };

  const { data, error } = await supabase.from(table).select("*").limit(1);
  if (error) return { table, skipped: true, reason: error.message };
  if (!data?.length) return { table, rows: 0, updated: 0, payload: {} };

  const columns = new Set(Object.keys(data[0] || {}));
  const payload = {};

  for (const column of ["stock", "quantity", "qty", "cantidad", "available_stock", "stock_actual", "existencia"]) {
    if (columns.has(column)) payload[column] = stockValue;
  }

  for (const column of ["reserved_stock", "stock_reserved", "reserved", "reservado", "quantity_reserved"]) {
    if (columns.has(column)) payload[column] = 0;
  }

  if (Object.keys(payload).length === 0) {
    return { table, rows: await countRows(supabase, table), updated: 0, payload, warning: "sin columnas de stock conocidas" };
  }

  const result = await updateAllRows(supabase, table, payload);
  return {
    table,
    rows: await countRows(supabase, table),
    updated: result.count,
    payload,
    error: result.ok ? undefined : result.error,
  };
}

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("Uso: node scripts/reset-operational-data-keep-inventory.mjs --yes [--stock=200]");
    process.exit(2);
  }

  const stockArg = process.argv.find((arg) => arg.startsWith("--stock="));
  const stockValue = stockArg ? Number(stockArg.split("=").pop()) : null;
  if (stockArg && (!Number.isFinite(stockValue) || stockValue < 0)) {
    throw new Error("--stock debe ser un numero positivo o cero.");
  }

  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tables = [...new Set(TABLES_TO_CLEAR)].filter((table) => !isKeptTable(table));
  const cleared = [];
  const skipped = [];
  const failed = [];

  for (let pass = 1; pass <= 3; pass += 1) {
    for (const table of tables) {
      if (cleared.includes(table) || skipped.includes(table)) continue;
      if (!(await tableExists(supabase, table))) {
        skipped.push(table);
        continue;
      }

      const before = await countRows(supabase, table);
      if (before === 0) {
        cleared.push(table);
        continue;
      }

      const result = await deleteAllRows(supabase, table);
      const after = await countRows(supabase, table);
      if (result.ok && after === 0) {
        cleared.push(table);
      } else if (pass === 3) {
        failed.push({ table, before, after, error: result.error || "Quedaron filas" });
      }
    }
  }

  const inventoryChecks = [];
  for (const table of ["inventory", "inventory_items", "products"]) {
    if (await tableExists(supabase, table)) {
      inventoryChecks.push({ table, rows: await countRows(supabase, table) });
    }
  }

  const inventoryStockReset = [];
  if (stockValue !== null) {
    for (const table of ["inventory", "inventory_items", "products"]) {
      inventoryStockReset.push(await resetInventoryStock(supabase, table, stockValue));
    }
  }

  console.log(JSON.stringify({ cleared, skipped, failed, inventoryChecks, inventoryStockReset }, null, 2));

  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
