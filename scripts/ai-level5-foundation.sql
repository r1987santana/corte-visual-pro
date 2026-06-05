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

select pg_notify('pgrst', 'reload schema');
