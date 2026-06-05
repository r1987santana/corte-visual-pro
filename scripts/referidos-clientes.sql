-- RD Wood System - Sistema de referidos y bonos
-- Copiar y pegar completo en Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table if exists public.clients
  add column if not exists referral_code text,
  add column if not exists referred_by_code text,
  add column if not exists referred_by_client_id uuid,
  add column if not exists referral_bonus_balance numeric default 0;

create unique index if not exists clients_referral_code_uidx
  on public.clients (referral_code)
  where referral_code is not null;

create table if not exists public.client_referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null,
  referral_link text,
  source text default 'portal_cliente',
  status text default 'lead_registrado',
  project_id uuid,
  referrer_client_id uuid,
  referrer_name text,
  referrer_phone text,
  referred_client_id uuid,
  referred_name text not null,
  referred_phone text not null,
  referred_email text,
  referred_project_id uuid,
  referred_contract_id uuid,
  project_interest text,
  completed_project_amount numeric default 0,
  completed_at timestamptz,
  bonus_type text default 'descuento_proxima_compra',
  bonus_amount numeric default 0,
  bonus_status text default 'pendiente_proyecto',
  bonus_granted_at timestamptz,
  bonus_redeemed_at timestamptz,
  portal_token text,
  crm_lead_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Si la tabla ya existia, CREATE TABLE IF NOT EXISTS no agrega columnas.
-- Este bloque actualiza el esquema viejo sin borrar data.
alter table if exists public.client_referrals
  add column if not exists referral_code text,
  add column if not exists referral_link text,
  add column if not exists source text default 'portal_cliente',
  add column if not exists status text default 'lead_registrado',
  add column if not exists project_id uuid,
  add column if not exists referrer_client_id uuid,
  add column if not exists referrer_name text,
  add column if not exists referrer_phone text,
  add column if not exists referred_client_id uuid,
  add column if not exists referred_name text,
  add column if not exists referred_phone text,
  add column if not exists referred_email text,
  add column if not exists referred_project_id uuid,
  add column if not exists referred_contract_id uuid,
  add column if not exists project_interest text,
  add column if not exists completed_project_amount numeric default 0,
  add column if not exists completed_at timestamptz,
  add column if not exists bonus_type text default 'descuento_proxima_compra',
  add column if not exists bonus_amount numeric default 0,
  add column if not exists bonus_status text default 'pendiente_proyecto',
  add column if not exists bonus_granted_at timestamptz,
  add column if not exists bonus_redeemed_at timestamptz,
  add column if not exists portal_token text,
  add column if not exists crm_lead_code text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Compatibilidad con esquemas viejos:
-- Los referidos pueden entrar como lead antes de tener proyecto/contrato.
alter table if exists public.client_referrals
  alter column project_id drop not null,
  alter column referrer_client_id drop not null,
  alter column referred_client_id drop not null,
  alter column referred_project_id drop not null,
  alter column referred_contract_id drop not null,
  alter column referral_link drop not null,
  alter column portal_token drop not null,
  alter column crm_lead_code drop not null;

update public.client_referrals
   set referral_code = coalesce(referral_code, 'RDW-' || upper(substr(replace(id::text, '-', ''), 1, 10))),
       status = coalesce(status, 'lead_registrado'),
       bonus_status = coalesce(bonus_status, 'pendiente_proyecto'),
       source = coalesce(source, 'portal_cliente'),
       bonus_type = coalesce(bonus_type, 'descuento_proxima_compra'),
       completed_project_amount = coalesce(completed_project_amount, 0),
       bonus_amount = coalesce(bonus_amount, 0),
       updated_at = coalesce(updated_at, now())
 where referral_code is null
    or status is null
    or bonus_status is null
    or source is null
    or bonus_type is null
    or completed_project_amount is null
    or bonus_amount is null
    or updated_at is null;

create index if not exists client_referrals_code_idx on public.client_referrals (referral_code);
create index if not exists client_referrals_referrer_idx on public.client_referrals (referrer_client_id);
create index if not exists client_referrals_status_idx on public.client_referrals (status, bonus_status);
create index if not exists client_referrals_phone_idx on public.client_referrals (referred_phone);

create table if not exists public.client_referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid references public.client_referrals(id) on delete cascade,
  client_id uuid,
  client_name text,
  reward_code text not null unique,
  reward_type text default 'descuento_proxima_compra',
  amount numeric not null default 0,
  status text not null default 'disponible',
  reason text,
  source text default 'referido_completado',
  expires_at date,
  redeemed_sale_id uuid,
  redeemed_contract_id uuid,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);

create or replace function public.fn_referral_code_from_id(p_id uuid)
returns text
language sql
stable
as $$
  select 'RDW-' || upper(substr(replace(p_id::text, '-', ''), 1, 10));
$$;

create or replace function public.fn_ensure_client_referral_codes()
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  update public.clients
     set referral_code = public.fn_referral_code_from_id(id)
   where referral_code is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.fn_complete_referral(
  p_referral_id uuid,
  p_project_amount numeric default 0,
  p_bonus_amount numeric default 2500
)
returns uuid
language plpgsql
as $$
declare
  v_ref public.client_referrals%rowtype;
  v_reward_id uuid;
  v_reward_code text;
begin
  select * into v_ref
    from public.client_referrals
   where id = p_referral_id
   for update;

  if not found then
    raise exception 'Referral not found: %', p_referral_id;
  end if;

  v_reward_code := 'BONO-' || upper(substr(replace(p_referral_id::text, '-', ''), 1, 10));

  update public.client_referrals
     set status = 'proyecto_completado',
         completed_project_amount = coalesce(p_project_amount, completed_project_amount, 0),
         completed_at = coalesce(completed_at, now()),
         bonus_amount = coalesce(nullif(p_bonus_amount, 0), bonus_amount, 2500),
         bonus_status = 'disponible',
         bonus_granted_at = coalesce(bonus_granted_at, now()),
         updated_at = now()
   where id = p_referral_id;

  insert into public.client_referral_rewards (
    referral_id,
    client_id,
    client_name,
    reward_code,
    reward_type,
    amount,
    status,
    reason,
    expires_at
  )
  values (
    p_referral_id,
    v_ref.referrer_client_id,
    v_ref.referrer_name,
    v_reward_code,
    coalesce(v_ref.bonus_type, 'descuento_proxima_compra'),
    coalesce(nullif(p_bonus_amount, 0), v_ref.bonus_amount, 2500),
    'disponible',
    'Bono por referido que completo proyecto',
    current_date + interval '180 days'
  )
  on conflict (reward_code) do update set
    amount = excluded.amount,
    status = 'disponible'
  returning id into v_reward_id;

  if v_ref.referrer_client_id is not null then
    update public.clients
       set referral_bonus_balance = coalesce(referral_bonus_balance, 0) + coalesce(nullif(p_bonus_amount, 0), v_ref.bonus_amount, 2500)
     where id = v_ref.referrer_client_id;
  end if;

  return v_reward_id;
end;
$$;

create or replace view public.v_client_referral_summary as
select
  r.*,
  coalesce(c.name, r.referrer_name) as resolved_referrer_name,
  c.phone as resolved_referrer_phone,
  rw.reward_code,
  rw.amount as reward_amount,
  rw.status as reward_status,
  rw.expires_at as reward_expires_at
from public.client_referrals r
left join public.clients c on c.id = r.referrer_client_id
left join public.client_referral_rewards rw on rw.referral_id = r.id;

select public.fn_ensure_client_referral_codes();

insert into public.client_referrals (
  referral_code,
  referrer_name,
  referred_name,
  referred_phone,
  project_interest,
  source,
  status,
  bonus_status,
  notes
)
values (
  'RDW-DEMO',
  'CLIENTE DEMO',
  'REFERIDO DEMO',
  '8090000000',
  'Demo sistema referidos',
  'demo',
  'lead_registrado',
  'pendiente_proyecto',
  'Fila demo segura para probar el panel.'
)
on conflict do nothing;
