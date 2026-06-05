-- RD Wood System - Limpieza de datos para prueba final
-- Conserva: inventario/productos, grupos/subgrupos, empleados RRHH, usuarios, configuracion,
-- reglas de gamificacion, equipos operativos y datos maestros.
-- Limpia: clientes/proyectos/cotizaciones/contratos/ventas/pagos/produccion/corte/trazabilidad/
-- transporte/instalacion/postventa/requisiciones/compras de prueba.
--
-- IMPORTANTE: ejecutar solo cuando quieras reiniciar el flujo operativo desde cero.

create extension if not exists pgcrypto;

create table if not exists public.system_reset_audit (
  id uuid primary key default gen_random_uuid(),
  reset_type text not null,
  kept_scope text not null,
  truncated_tables jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

do $$
declare
  v_table text;
  v_truncated text[] := '{}';
  v_tables text[] := array[
    -- CRM / agenda / levantamientos / proyectos
    'technical_visit_reports',
    'technical_visit_photos',
    'measurement_payments',
    'measurement_receipts',
    'visit_payments',
    'levantamiento_photos',
    'levantamientos',
    'agenda_events',
    'crm_events',
    'crm_notes',
    'projects',
    'project_photos',
    'project_files',
    'project_activity',
    'project_timeline',
    'project_claims',
    'client_referral_rewards',
    'client_referrals',
    'clients',

    -- IA diseno / portal cliente / render
    'ai_design_variants',
    'ai_design_modules',
    'ai_design_requests',
    'ai_render_jobs',
    'client_portal_events',
    'client_portal_tokens',

    -- Cotizaciones / contratos / pagos / ventas
    'quote_items',
    'quotes',
    'contract_signatures',
    'contracts',
    'payment_receipts',
    'cash_payments',
    'payments',
    'sale_items',
    'sales',
    'invoices',
    'invoice_items',
    'accounts_receivable',

    -- Compras operativas / requisiciones / almacen
    'warehouse_requisition_items',
    'warehouse_requisitions',
    'purchase_receipt_items',
    'purchase_receipts',
    'purchase_order_items',
    'purchase_orders',
    'supplier_invoices',
    'accounts_payable',
    'inventory_movements',
    'movimientos',

    -- Produccion / BOM / corte / CNC / trazabilidad
    'production_order_items',
    'production_orders',
    'production_bom_items',
    'production_boms',
    'bom_items',
    'boms',
    'recipes',
    'recipe_items',
    'cut_optimization_pieces',
    'cut_optimizations',
    'cnc_jobs',
    'cnc_files',
    'piece_labels',
    'piece_events',
    'piece_scans',
    'project_module_pieces',
    'project_modules',

    -- Transporte / instalacion / QA / entrega final
    'transport_module_photos',
    'transport_module_events',
    'transport_handoffs',
    'installation_module_photos',
    'installation_module_events',
    'installation_assignments',
    'installation_handoffs',
    'project_installation_scans',
    'project_installation_plans',
    'verification_photos',
    'verification_reports',
    'qa_observations',
    'final_delivery_photos',
    'final_delivery_signatures',
    'final_delivery_reports',

    -- Postventa / cultura operativa / nomina generada
    'after_sales_tickets',
    'after_sales_ticket_events',
    'postventa_tickets',
    'postventa_visits',
    'gamification_points',
    'gamification_redemptions',
    'operational_compensation_events',
    'payroll_run_items',
    'payroll_runs',
    'audit_events',
    'audit_logs'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is not null then
      execute format('truncate table public.%I restart identity cascade', v_table);
      v_truncated := array_append(v_truncated, v_table);
    end if;
  end loop;

  insert into public.system_reset_audit (
    reset_type,
    kept_scope,
    truncated_tables,
    notes
  ) values (
    'prueba_final',
    'inventario_productos_empleados_usuarios_configuracion_equipos',
    to_jsonb(v_truncated),
    'Limpieza ejecutada para iniciar prueba final desde cero conservando inventario y RRHH base.'
  );

  raise notice 'Limpieza completada. Tablas limpiadas: %', array_to_string(v_truncated, ', ');
end $$;

select pg_notify('pgrst', 'reload schema');
