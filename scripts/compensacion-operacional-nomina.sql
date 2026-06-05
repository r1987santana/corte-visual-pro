-- RD Wood System - Compensacion operacional integrada a nomina
-- Ejecutar en Supabase antes de usar el pago por pies en RRHH.

create extension if not exists pgcrypto;

create table if not exists public.operational_compensation_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  employee_name text not null,
  department text,
  position text,
  role_key text not null,
  project_id uuid,
  order_code text,
  module_name text,
  source_module text not null default 'produccion',
  source_id text,
  stage text not null,
  unit_type text not null check (unit_type in ('pie_lineal', 'pie_cuadrado')),
  quantity numeric(12, 2) not null default 0,
  base_rate numeric(12, 2) not null default 0,
  stage_percent numeric(8, 4) not null default 0,
  role_percent numeric(8, 4) not null default 1,
  amount numeric(12, 2) not null default 0,
  status text not null default 'approved'
    check (status in ('pending', 'approved', 'included_in_payroll', 'voided')),
  payroll_run_id uuid references public.payroll_runs(id) on delete set null,
  payroll_item_id uuid references public.payroll_run_items(id) on delete set null,
  approved_by uuid,
  approved_at timestamptz default now(),
  included_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_operational_comp_events_employee_status
  on public.operational_compensation_events(employee_id, status);

create index if not exists idx_operational_comp_events_period
  on public.operational_compensation_events(approved_at, created_at);

create unique index if not exists idx_operational_comp_events_source_id
  on public.operational_compensation_events(source_id)
  where source_id is not null;

alter table public.payroll_run_items
  add column if not exists operational_compensation numeric(12, 2) not null default 0,
  add column if not exists operational_compensation_detail jsonb not null default '[]'::jsonb;

alter table public.payroll_runs
  add column if not exists operational_compensation_total numeric(12, 2) not null default 0;

create or replace view public.v_operational_compensation_pending as
select
  employee_id,
  employee_name,
  department,
  position,
  role_key,
  status,
  count(*) as events_count,
  sum(quantity) as total_quantity,
  sum(amount) as total_amount,
  min(approved_at) as first_approved_at,
  max(approved_at) as last_approved_at
from public.operational_compensation_events
where status = 'approved'
group by employee_id, employee_name, department, position, role_key, status;

create or replace function public.register_operational_compensation_event(
  p_employee_id uuid,
  p_employee_name text,
  p_department text,
  p_position text,
  p_role_key text,
  p_stage text,
  p_unit_type text,
  p_quantity numeric,
  p_base_rate numeric,
  p_stage_percent numeric,
  p_role_percent numeric,
  p_order_code text default null,
  p_module_name text default null,
  p_source_module text default 'produccion',
  p_source_id text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
  v_amount numeric(12, 2);
begin
  v_amount := round(coalesce(p_quantity, 0) * coalesce(p_base_rate, 0) * coalesce(p_stage_percent, 0) * coalesce(p_role_percent, 1), 2);

  insert into public.operational_compensation_events (
    employee_id,
    employee_name,
    department,
    position,
    role_key,
    stage,
    unit_type,
    quantity,
    base_rate,
    stage_percent,
    role_percent,
    amount,
    order_code,
    module_name,
    source_module,
    source_id,
    notes,
    metadata
  ) values (
    p_employee_id,
    coalesce(nullif(p_employee_name, ''), 'Colaborador'),
    p_department,
    p_position,
    p_role_key,
    p_stage,
    p_unit_type,
    coalesce(p_quantity, 0),
    coalesce(p_base_rate, 0),
    coalesce(p_stage_percent, 0),
    coalesce(p_role_percent, 1),
    v_amount,
    p_order_code,
    p_module_name,
    p_source_module,
    p_source_id,
    p_notes,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;
