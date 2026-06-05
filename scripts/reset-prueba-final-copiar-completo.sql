-- RD Wood System - Reset de prueba final
-- USO: en Supabase SQL Editor pulsa Ctrl+A, borra todo, pega este archivo completo y Run.
-- Conserva inventario/productos, empleados/RRHH, usuarios/configuracion, gamificacion base y equipos.
-- Limpia data operativa para probar el flujo desde cero.

create extension if not exists pgcrypto;

create table if not exists public.system_reset_audit (
  id uuid primary key default gen_random_uuid(),
  reset_type text not null,
  kept_scope text not null,
  truncated_tables jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

do $reset$
declare
  v_table text;
  v_done text[] := '{}';
  v_tables text[] := array[
    -- CRM / agenda / levantamientos / clientes de prueba
    'technical_visit_reports',
    'technical_visit_photos',
    'measurement_payment_requests',
    'measurement_payments',
    'measurement_receipts',
    'visit_payments',
    'levantamiento_photos',
    'levantamientos',
    'agenda_events',
    'crm_events',
    'crm_notes',
    'client_requests',
    'client_feedback',
    'client_reviews',
    'client_claims',
    'client_referral_rewards',
    'referral_rewards',
    'referral_bonus_ledger',
    'client_referrals',
    'clients',

    -- IA diseno / portal cliente / cotizaciones / contratos
    'ai_design_variants',
    'ai_design_modules',
    'ai_design_requests',
    'ai_render_jobs',
    'client_portal_events',
    'client_portal_tokens',
    'client_portal_messages',
    'client_portal_recommendations',
    'quote_items',
    'quote_versions',
    'quotes',
    'project_quotes',
    'contract_signatures',
    'contracts',
    'project_contract_signatures',
    'project_contracts',

    -- Caja principal / pagos / ventas / facturas / contabilidad operativa
    'payment_requests',
    'payment_receipts',
    'client_payments',
    'cash_payments',
    'cash_register_entries',
    'cash_transactions',
    'cash_movements',
    'cash_closings',
    'caja_movements',
    'caja_transactions',
    'main_cash_payments',
    'central_cash_payments',
    'income_records',
    'project_payments',
    'project_sales',
    'payments',
    'sale_items',
    'sales',
    'invoice_items',
    'invoices',
    'accounts_receivable',
    'accounting_entries',
    'accounting_journal',
    'accounting_ledger',

    -- Compras / almacen / requisiciones / recepcion
    'warehouse_requisition_items',
    'warehouse_requisitions',
    'purchase_receipt_items',
    'purchase_receipts',
    'purchase_order_items',
    'purchase_orders',
    'supplier_invoices',
    'accounts_payable',
    'accounts_payable_payments',
    'procurement_request_items',
    'procurement_requests',
    'procurement_supplier_quote_items',
    'procurement_supplier_quotes',
    'procurement_purchase_order_items',
    'procurement_purchase_orders',
    'import_shipment_items',
    'import_shipments',

    -- Movimientos de inventario generados por pruebas
    'inventory_movements',
    'movimientos',

    -- Produccion / BOM / corte / CNC / trazabilidad
    'projects',
    'project_photos',
    'project_files',
    'project_activity',
    'project_timeline',
    'project_claims',
    'project_module_pieces',
    'project_modules',
    'production_order_items',
    'production_order_events',
    'production_order_logs',
    'production_order_payments',
    'production_orders',
    'production_bom_items',
    'production_boms',
    'bom_items',
    'boms',
    'recipe_items',
    'recipes',
    'cut_optimization_pieces',
    'cut_optimizations',
    'cut_service_invoice_items',
    'cut_service_invoices',
    'cnc_jobs',
    'cnc_files',
    'custom_vector_paths',
    'custom_vector_exports',
    'custom_vector_projects',
    'cnc_vector_projects',
    'piece_labels',
    'piece_events',
    'piece_scans',

    -- Transporte / instalacion / QA / entrega final
    'transport_module_photos',
    'transport_module_events',
    'transport_handoffs',
    'transport_deliveries',
    'transport_signatures',
    'transport_evidence',
    'installation_module_photos',
    'installation_module_events',
    'installation_assignments',
    'installation_handoffs',
    'installation_reports',
    'installation_report_photos',
    'installation_photos',
    'installation_evidence',
    'installation_signatures',
    'project_installation_scans',
    'project_installation_plans',
    'verification_photos',
    'verification_reports',
    'qa_observations',
    'final_delivery_photos',
    'final_delivery_signatures',
    'final_delivery_reports',
    'final_delivery_events',

    -- Postventa / garantias / tickets
    'after_sales_ticket_events',
    'after_sales_tickets',
    'after_sales_service_visits',
    'after_sales_visit_photos',
    'after_sales_warranty_costs',
    'after_sales_costs',
    'postventa_tickets',
    'postventa_visits',

    -- Puntos, compensaciones y nomina generada por pruebas
    'gamification_points',
    'gamification_redemptions',
    'manual_gamification_events',
    'operational_compensation_events',
    'payroll_run_items',
    'payroll_runs',

    -- Auditoria operativa de pruebas
    'audit_events',
    'audit_logs'
  ];
begin
  foreach v_table in array v_tables loop
    if exists (
      select 1
      from pg_tables
      where schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('truncate table public.%I restart identity cascade', v_table);
      v_done := array_append(v_done, v_table);
    end if;
  end loop;

  insert into public.system_reset_audit (reset_type, kept_scope, truncated_tables, notes)
  values (
    'prueba_final',
    'inventario_productos_empleados_usuarios_configuracion_gamificacion_base_equipos_operativos',
    to_jsonb(v_done),
    'Reset para prueba final desde cero conservando inventario, RRHH base, usuarios, equipos, reglas de gamificacion y configuraciones.'
  );
end
$reset$;

select pg_notify('pgrst', 'reload schema');

select
  'RESET OK' as resultado,
  reset_type,
  kept_scope,
  jsonb_array_length(truncated_tables) as tablas_limpiadas,
  truncated_tables,
  created_at
from public.system_reset_audit
order by created_at desc
limit 1;
