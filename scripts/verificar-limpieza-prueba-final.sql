-- RD Wood System - Verificacion despues del reset de prueba final
-- USO: Ejecutar despues de scripts/reset-prueba-final-copiar-completo.sql.
-- Esperado:
-- - Inventario/productos, empleados/RRHH, equipos y reglas base conservan datos.
-- - Clientes, proyectos, pagos, produccion, requisiciones y documentos de prueba quedan en 0.

select pg_notify('pgrst', 'reload schema');

select *
from public.system_reset_audit
order by created_at desc
limit 5;

create temp table if not exists tmp_reset_check (
  tipo text,
  tabla text,
  filas bigint,
  esperado text
);

truncate table tmp_reset_check;

do $check$
declare
  v_table text;
  v_count bigint;
  v_keep_tables text[] := array[
    'products',
    'employees',
    'operational_teams',
    'operational_team_members',
    'gamification_rules',
    'gamification_collaborators',
    'gamification_rewards'
  ];
  v_clean_tables text[] := array[
    'clients',
    'projects',
    'quotes',
    'contracts',
    'sales',
    'sale_items',
    'invoices',
    'invoice_items',
    'payments',
    'client_payments',
    'income_records',
    'cash_payments',
    'production_orders',
    'production_order_items',
    'warehouse_requisitions',
    'warehouse_requisition_items',
    'purchase_orders',
    'purchase_order_items',
    'cut_optimizations',
    'cut_optimization_pieces',
    'project_modules',
    'project_module_pieces',
    'piece_labels',
    'piece_events',
    'transport_handoffs',
    'installation_handoffs',
    'verification_reports',
    'qa_observations',
    'final_delivery_reports',
    'after_sales_tickets',
    'gamification_points',
    'operational_compensation_events',
    'payroll_runs'
  ];
begin
  foreach v_table in array v_keep_tables loop
    if exists (
      select 1 from pg_tables where schemaname = 'public' and tablename = v_table
    ) then
      execute format('select count(*) from public.%I', v_table) into v_count;
      insert into tmp_reset_check values ('conservado', v_table, v_count, 'debe conservar datos si existian');
    else
      insert into tmp_reset_check values ('conservado', v_table, null, 'tabla no existe');
    end if;
  end loop;

  foreach v_table in array v_clean_tables loop
    if exists (
      select 1 from pg_tables where schemaname = 'public' and tablename = v_table
    ) then
      execute format('select count(*) from public.%I', v_table) into v_count;
      insert into tmp_reset_check values ('limpiado', v_table, v_count, 'debe quedar en 0 para prueba final');
    else
      insert into tmp_reset_check values ('limpiado', v_table, null, 'tabla no existe');
    end if;
  end loop;
end
$check$;

select *
from tmp_reset_check
order by tipo, tabla;
