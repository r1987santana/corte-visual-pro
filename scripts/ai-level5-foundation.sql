-- RD Wood System - IA Nivel 5 Foundation
-- Ejecutar en Supabase SQL Editor para activar memoria persistente y cola de decisiones.

create extension if not exists pgcrypto;

create table if not exists public.ai_operational_memory (
  id text primary key,
  scope text not null default 'global',
  title text not null,
  summary text not null default '',
  entity_type text,
  entity_id text,
  priority text not null default 'normal',
  metadata jsonb not null default '{}'::jsonb,
  user_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_operational_memory_scope_updated
  on public.ai_operational_memory (scope, updated_at desc);

create index if not exists idx_ai_operational_memory_entity
  on public.ai_operational_memory (entity_type, entity_id);

create table if not exists public.ai_decision_queue (
  id text primary key,
  module text not null default 'global',
  action_type text not null,
  title text not null,
  summary text not null default '',
  risk text not null default 'medium',
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  route text,
  requires_approval boolean not null default true,
  created_by text,
  decided_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  executed_at timestamptz,
  constraint ai_decision_queue_risk_check
    check (risk in ('low', 'medium', 'high', 'critical')),
  constraint ai_decision_queue_status_check
    check (status in ('pending', 'approved', 'rejected', 'executed', 'cancelled'))
);

create index if not exists idx_ai_decision_queue_status_created
  on public.ai_decision_queue (status, created_at desc);

create index if not exists idx_ai_decision_queue_module_status
  on public.ai_decision_queue (module, status);

create table if not exists public.ai_monitor_events (
  id uuid primary key default gen_random_uuid(),
  module text not null default 'global',
  event_type text not null,
  title text not null,
  summary text not null default '',
  severity text not null default 'info',
  risk_score integer not null default 0,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint ai_monitor_events_severity_check
    check (severity in ('info', 'warning', 'danger', 'critical')),
  constraint ai_monitor_events_status_check
    check (status in ('open', 'acknowledged', 'resolved', 'dismissed'))
);

create index if not exists idx_ai_monitor_events_status_created
  on public.ai_monitor_events (status, created_at desc);

create table if not exists public.ai_tasks (
  id text primary key,
  decision_id text,
  module text not null default 'global',
  title text not null,
  summary text not null default '',
  status text not null default 'open',
  priority text not null default 'normal',
  route text,
  payload jsonb not null default '{}'::jsonb,
  created_by text,
  assigned_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ai_tasks_status_check
    check (status in ('open', 'in_progress', 'done', 'cancelled')),
  constraint ai_tasks_priority_check
    check (priority in ('low', 'normal', 'high', 'critical'))
);

create index if not exists idx_ai_tasks_status_created
  on public.ai_tasks (status, created_at desc);

create index if not exists idx_ai_tasks_decision
  on public.ai_tasks (decision_id);

create table if not exists public.ai_pricing_references (
  id text primary key,
  product_key text not null,
  product_name text not null,
  category text,
  unit text,
  source_type text not null default 'manual',
  source_name text,
  source_url text,
  observed_cost numeric,
  observed_price numeric,
  currency text not null default 'DOP',
  confidence numeric not null default 0.70,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_pricing_references_source_type_check
    check (source_type in ('manual', 'supplier', 'internet', 'internal', 'system')),
  constraint ai_pricing_references_confidence_check
    check (confidence >= 0 and confidence <= 1)
);

create index if not exists idx_ai_pricing_references_product_observed
  on public.ai_pricing_references (product_key, observed_at desc);

create index if not exists idx_ai_pricing_references_source_type
  on public.ai_pricing_references (source_type, observed_at desc);

insert into public.ai_pricing_references (
  id, product_key, product_name, category, unit, source_type, source_name,
  observed_cost, observed_price, confidence, notes, metadata
) values
  ('service_installation_base', 'servicio instalacion ser-instalacion', 'Servicio instalacion', 'SERVICIOS', 'servicio', 'system', 'RD Wood baseline', 2500, 5000, 0.45, 'Base provisional hasta alimentar costos reales.', '{"rule":"fallback"}'::jsonb),
  ('service_transport_base', 'servicio transporte ser-transporte', 'Servicio transporte', 'SERVICIOS', 'servicio', 'system', 'RD Wood baseline', 1500, 3000, 0.45, 'Base provisional hasta alimentar costos reales.', '{"rule":"fallback"}'::jsonb),
  ('service_render_base', 'servicio render y levantamiento ser-render', 'Servicio render y levantamiento', 'SERVICIOS', 'servicio', 'system', 'RD Wood baseline', 2750, 5000, 0.45, 'Base provisional hasta alimentar costos reales.', '{"rule":"fallback"}'::jsonb),
  ('service_canteo_base', 'servicio de canteo ser-canteo', 'Servicio de canteo', 'SERVICIOS', 'metro', 'system', 'RD Wood baseline', 18, 35, 0.45, 'Base provisional hasta alimentar costos reales.', '{"rule":"fallback"}'::jsonb),
  ('service_perforacion_base', 'servicio de perforacion ser-perforacion', 'Servicio de perforacion', 'SERVICIOS', 'servicio', 'system', 'RD Wood baseline', 10, 25, 0.45, 'Base provisional hasta alimentar costos reales.', '{"rule":"fallback"}'::jsonb),
  ('service_corte_cnc_base', 'servicio corte cnc ser-corte-cnc', 'Servicio corte CNC', 'SERVICIOS', 'servicio', 'system', 'RD Wood baseline', 700, 1500, 0.45, 'Base provisional hasta alimentar costos reales.', '{"rule":"fallback"}'::jsonb)
on conflict (id) do update set
  observed_cost = excluded.observed_cost,
  observed_price = excluded.observed_price,
  confidence = excluded.confidence,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

select pg_notify('pgrst', 'reload schema');
