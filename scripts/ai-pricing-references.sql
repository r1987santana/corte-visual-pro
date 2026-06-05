-- RD Wood System - AI Pricing References
-- Ejecutar en Supabase SQL Editor para activar referencias internas/externas de precio.

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
  ('service_installation_base', 'servicio instalacion ser instalacion', 'Servicio instalacion', 'SERVICIOS', 'servicio', 'system', 'RD Wood baseline', 2500, 5000, 0.45, 'Base provisional hasta alimentar costos reales.', '{"rule":"fallback"}'::jsonb),
  ('service_transport_base', 'servicio transporte ser transporte', 'Servicio transporte', 'SERVICIOS', 'servicio', 'system', 'RD Wood baseline', 1500, 3000, 0.45, 'Base provisional hasta alimentar costos reales.', '{"rule":"fallback"}'::jsonb),
  ('service_render_base', 'servicio render y levantamiento ser render', 'Servicio render y levantamiento', 'SERVICIOS', 'servicio', 'system', 'RD Wood baseline', 2750, 5000, 0.45, 'Base provisional hasta alimentar costos reales.', '{"rule":"fallback"}'::jsonb),
  ('service_canteo_base', 'servicio de canteo ser canteo', 'Servicio de canteo', 'SERVICIOS', 'metro', 'system', 'RD Wood baseline', 18, 35, 0.45, 'Base provisional hasta alimentar costos reales.', '{"rule":"fallback"}'::jsonb),
  ('service_perforacion_base', 'servicio de perforacion ser perforacion', 'Servicio de perforacion', 'SERVICIOS', 'servicio', 'system', 'RD Wood baseline', 10, 25, 0.45, 'Base provisional hasta alimentar costos reales.', '{"rule":"fallback"}'::jsonb),
  ('service_corte_cnc_base', 'servicio corte cnc ser corte cnc', 'Servicio corte CNC', 'SERVICIOS', 'servicio', 'system', 'RD Wood baseline', 700, 1500, 0.45, 'Base provisional hasta alimentar costos reales.', '{"rule":"fallback"}'::jsonb)
on conflict (id) do update set
  observed_cost = excluded.observed_cost,
  observed_price = excluded.observed_price,
  confidence = excluded.confidence,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

select pg_notify('pgrst', 'reload schema');
