-- RD Wood System - AI Pricing Learning
-- Ejecutar en Supabase SQL Editor para registrar aprendizaje de precios aplicados/cerrados.

create table if not exists public.ai_pricing_learning (
  id text primary key,
  task_id text,
  decision_id text,
  inventory_id text,
  product_key text not null,
  product_name text not null,
  action text not null,
  suggested_cost numeric,
  suggested_price numeric,
  approved_cost numeric,
  approved_price numeric,
  previous_cost numeric,
  previous_price numeric,
  source_type text,
  source_label text,
  confidence numeric,
  outcome text not null default 'applied',
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  constraint ai_pricing_learning_outcome_check
    check (outcome in ('applied', 'completed', 'adjusted', 'rejected', 'cancelled'))
);

create index if not exists idx_ai_pricing_learning_product_created
  on public.ai_pricing_learning (product_key, created_at desc);

create index if not exists idx_ai_pricing_learning_task
  on public.ai_pricing_learning (task_id);

alter table public.ai_pricing_learning enable row level security;

revoke all on table public.ai_pricing_learning from anon, authenticated;
grant all on table public.ai_pricing_learning to service_role;

select pg_notify('pgrst', 'reload schema');
