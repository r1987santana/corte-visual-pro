-- RD Wood System - Reset compacto de prueba final
-- Copia este archivo COMPLETO en Supabase SQL Editor y ejecuta Run.
-- Conserva inventario/productos, RRHH, usuarios, equipos operativos y reglas base.

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
    'clients','agenda_events','crm_events','crm_notes',
    'technical_visit_reports','technical_visit_photos','measurement_payment_requests',
    'measurement_payments','measurement_receipts','visit_payments','levantamientos','levantamiento_photos',
    'projects','project_photos','project_files','project_activity','project_timeline','project_claims',
    'ai_design_requests','ai_design_variants','ai_design_modules','ai_render_jobs',
    'client_portal_events','client_portal_tokens','client_requests','client_feedback','client_reviews',
    'client_referrals','client_referral_rewards','referral_rewards','referral_bonus_ledger',
    'quotes','quote_items','quote_versions','project_quotes',
    'contracts','contract_signatures','project_contracts','project_contract_signatures',
    'payment_requests','payments','client_payments','payment_receipts','cash_payments',
    'income_records','cash_transactions','cash_movements','main_cash_payments','central_cash_payments',
    'sales','sale_items','invoices','invoice_items','accounts_receivable',
    'accounting_entries','accounting_journal','accounting_ledger',
    'warehouse_requisitions','warehouse_requisition_items',
    'purchase_orders','purchase_order_items','purchase_receipts','purchase_receipt_items',
    'supplier_invoices','accounts_payable','accounts_payable_payments',
    'inventory_movements','movimientos',
    'production_orders','production_order_items','production_order_events','production_order_logs',
    'production_boms','production_bom_items','boms','bom_items','recipes','recipe_items',
    'cut_optimizations','cut_optimization_pieces','cut_service_invoices','cut_service_invoice_items',
    'cnc_jobs','cnc_files','custom_vector_projects','custom_vector_paths','custom_vector_exports',
    'project_modules','project_module_pieces','piece_labels','piece_events','piece_scans',
    'transport_handoffs','transport_module_events','transport_module_photos','transport_deliveries',
    'installation_handoffs','installation_assignments','installation_module_events','installation_module_photos',
    'installation_reports','installation_report_photos','installation_signatures',
    'verification_reports','verification_photos','qa_observations',
    'final_delivery_reports','final_delivery_photos','final_delivery_signatures',
    'after_sales_tickets','after_sales_ticket_events','postventa_tickets','postventa_visits',
    'gamification_points','gamification_redemptions','operational_compensation_events',
    'payroll_runs','payroll_run_items','audit_events','audit_logs'
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
    'prueba_final_compacto',
    'conserva_inventario_rrhh_usuarios_equipos_gamificacion_base',
    to_jsonb(v_done),
    'Reset compacto para prueba final. Data operativa limpiada sin tocar inventario base ni equipos.'
  );
end
$reset$;

select pg_notify('pgrst', 'reload schema');

select
  'RESET OK' as resultado,
  jsonb_array_length(truncated_tables) as tablas_limpiadas,
  truncated_tables,
  created_at
from public.system_reset_audit
order by created_at desc
limit 1;
