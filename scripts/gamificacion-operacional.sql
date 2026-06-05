-- RD WOOD SYSTEM - Gamificacion Operacional
-- Ejecutar en Supabase SQL Editor.
-- Este modulo usa auth interna de RD Wood, por eso no activa RLS aqui.

create extension if not exists pgcrypto;

create table if not exists public.gamification_collaborators (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid null,
  employee_id uuid null,
  full_name text not null,
  department text not null default 'Produccion',
  role_name text null,
  avatar_url text null,
  status text not null default 'activo',
  accumulated_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gamification_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text null,
  category text not null check (category in ('positivo', 'negativo')),
  points integer not null check (points <> 0),
  department_scope text[] not null default array['Produccion','Almacen','Instalacion','Transporte','Oficina'],
  source_module text not null default 'manual',
  event_type text not null,
  daily_limit integer null,
  requires_approval boolean not null default false,
  is_active boolean not null default true,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gamification_points (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid null references public.gamification_collaborators(id) on delete set null,
  collaborator_name text not null,
  department text not null,
  rule_id uuid null references public.gamification_rules(id) on delete set null,
  rule_code text null,
  rule_title text null,
  point_type text not null check (point_type in ('positivo', 'negativo', 'ajuste')),
  points integer not null,
  source_module text not null default 'manual',
  source_table text null,
  source_id text null,
  reference_code text null,
  evidence_url text null,
  notes text null,
  status text not null default 'approved' check (status in ('pending','approved','rejected','voided')),
  awarded_by text null,
  approved_by text null,
  awarded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.gamification_rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text null,
  reward_type text not null default 'beneficio',
  points_required integer not null check (points_required > 0),
  department_scope text[] not null default array['Todos'],
  stock integer null,
  period text not null default 'mensual',
  status text not null default 'active' check (status in ('active','paused','archived')),
  approval_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gamification_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.gamification_rewards(id) on delete cascade,
  collaborator_id uuid null references public.gamification_collaborators(id) on delete set null,
  collaborator_name text not null,
  department text not null,
  points_spent integer not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','rejected','delivered','cancelled')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz null,
  approved_by text null,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_gamification_points_collaborator on public.gamification_points(collaborator_id);
create index if not exists idx_gamification_points_department on public.gamification_points(department);
create index if not exists idx_gamification_points_awarded_at on public.gamification_points(awarded_at desc);
create index if not exists idx_gamification_points_status on public.gamification_points(status);
create index if not exists idx_gamification_rules_code on public.gamification_rules(code);
create index if not exists idx_gamification_redemptions_status on public.gamification_redemptions(status);

create or replace view public.gamification_rankings_view as
with approved_points as (
  select
    coalesce(gp.collaborator_id, gc.id) as collaborator_id,
    coalesce(gc.full_name, gp.collaborator_name) as collaborator_name,
    coalesce(gc.department, gp.department) as department,
    gp.points,
    gp.awarded_at
  from public.gamification_points gp
  left join public.gamification_collaborators gc on gc.id = gp.collaborator_id
  where gp.status = 'approved'
),
collaborator_totals as (
  select
    gc.id as collaborator_id,
    gc.full_name as collaborator_name,
    gc.department,
    gc.role_name,
    gc.avatar_url,
    coalesce(sum(ap.points), 0)::integer as all_time_points,
    coalesce(sum(ap.points) filter (where ap.awarded_at::date = current_date), 0)::integer as daily_points,
    coalesce(sum(ap.points) filter (where date_trunc('week', ap.awarded_at) = date_trunc('week', now())), 0)::integer as weekly_points,
    coalesce(sum(ap.points) filter (where date_trunc('month', ap.awarded_at) = date_trunc('month', now())), 0)::integer as monthly_points,
    coalesce(sum(abs(ap.points)) filter (where ap.points < 0 and ap.awarded_at::date = current_date), 0)::integer as daily_penalties,
    count(ap.points) filter (where ap.awarded_at::date = current_date and ap.points > 0)::integer as daily_positive_events,
    count(ap.points) filter (where ap.awarded_at::date = current_date and ap.points < 0)::integer as daily_negative_events
  from public.gamification_collaborators gc
  left join approved_points ap on ap.collaborator_id = gc.id
  where gc.status = 'activo'
  group by gc.id, gc.full_name, gc.department, gc.role_name, gc.avatar_url
)
select
  *,
  rank() over (order by monthly_points desc, weekly_points desc, all_time_points desc, collaborator_name asc) as company_rank,
  rank() over (partition by department order by monthly_points desc, weekly_points desc, all_time_points desc, collaborator_name asc) as department_rank
from collaborator_totals;

create or replace function public.register_gamification_event(
  p_collaborator_id uuid,
  p_collaborator_name text,
  p_department text,
  p_rule_code text,
  p_source_module text,
  p_source_table text default null,
  p_source_id text default null,
  p_reference_code text default null,
  p_evidence_url text default null,
  p_notes text default null,
  p_awarded_by text default 'Sistema RD Wood'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_rule public.gamification_rules%rowtype;
  v_point_id uuid;
  v_point_type text;
begin
  select *
  into v_rule
  from public.gamification_rules
  where code = p_rule_code
    and is_active = true
  limit 1;

  if not found then
    raise exception 'Regla de gamificacion no encontrada: %', p_rule_code;
  end if;

  v_point_type := case
    when v_rule.points >= 0 then 'positivo'
    else 'negativo'
  end;

  insert into public.gamification_points (
    collaborator_id,
    collaborator_name,
    department,
    rule_id,
    rule_code,
    rule_title,
    point_type,
    points,
    source_module,
    source_table,
    source_id,
    reference_code,
    evidence_url,
    notes,
    status,
    awarded_by,
    awarded_at
  )
  values (
    p_collaborator_id,
    p_collaborator_name,
    p_department,
    v_rule.id,
    v_rule.code,
    v_rule.title,
    v_point_type,
    v_rule.points,
    p_source_module,
    p_source_table,
    p_source_id,
    p_reference_code,
    p_evidence_url,
    p_notes,
    case when v_rule.requires_approval then 'pending' else 'approved' end,
    p_awarded_by,
    now()
  )
  returning id into v_point_id;

  return v_point_id;
end;
$$;

insert into public.gamification_rules (code, title, description, category, points, department_scope, source_module, event_type, daily_limit, requires_approval)
values
  ('llegada_tiempo', 'Llegar a tiempo', 'Ponche puntual dentro del margen permitido.', 'positivo', 10, array['Produccion','Almacen','Instalacion','Transporte','Oficina'], 'ponchador', 'attendance_on_time', 1, false),
  ('orden_a_tiempo', 'Terminar orden a tiempo', 'Orden o modulo completado dentro de la fecha prometida.', 'positivo', 35, array['Produccion','Corte','Ensamblado'], 'produccion', 'order_completed_on_time', null, false),
  ('cero_errores_qa', 'Cero errores en verificacion', 'Modulo aprobado por calidad sin observaciones.', 'positivo', 30, array['Produccion','Instalacion'], 'verificacion', 'qa_zero_errors', null, false),
  ('fotos_requeridas', 'Subir fotos requeridas', 'Evidencias completas de carga, instalacion o entrega.', 'positivo', 12, array['Almacen','Instalacion','Transporte'], 'evidencias', 'required_photos_uploaded', null, false),
  ('qr_correcto', 'Escanear QR correctamente', 'Escaneo correcto de orden, modulo o pieza.', 'positivo', 8, array['Produccion','Almacen','Instalacion','Transporte'], 'qr_tracking', 'qr_scan_ok', 12, false),
  ('ayuda_departamento', 'Ayudar a otro departamento', 'Soporte documentado entre areas.', 'positivo', 20, array['Produccion','Almacen','Instalacion','Transporte','Oficina'], 'manual', 'cross_department_help', null, true),
  ('mejora_aprobada', 'Proponer mejora aprobada', 'Idea aprobada que mejora costo, calidad, seguridad o velocidad.', 'positivo', 50, array['Produccion','Almacen','Instalacion','Transporte','Oficina'], 'ceo', 'approved_improvement', null, true),
  ('llegada_tarde', 'Llegada tarde', 'Ponche fuera de horario sin aprobacion.', 'negativo', -12, array['Produccion','Almacen','Instalacion','Transporte','Oficina'], 'ponchador', 'attendance_late', 1, false),
  ('no_escanear', 'No escanear orden/modulo', 'Movimiento sin QR o sin trazabilidad.', 'negativo', -15, array['Produccion','Almacen','Instalacion','Transporte'], 'qr_tracking', 'missing_qr_scan', null, false),
  ('error_produccion', 'Error en produccion', 'Error de corte, canteo, armado o material.', 'negativo', -30, array['Produccion','Corte','Ensamblado'], 'produccion', 'production_error', null, false),
  ('falta_foto', 'Falta de foto/evidencia', 'Entrega, transporte o instalacion sin evidencia requerida.', 'negativo', -15, array['Almacen','Instalacion','Transporte'], 'evidencias', 'missing_photo', null, false),
  ('retraso_injustificado', 'Retraso injustificado', 'Tarea vencida sin causa aprobada.', 'negativo', -25, array['Produccion','Almacen','Instalacion','Transporte','Oficina'], 'ceo', 'unjustified_delay', null, true),
  ('reproceso_descuido', 'Reproceso por descuido', 'Trabajo repetido por falta de cuidado o validacion.', 'negativo', -35, array['Produccion','Corte','Ensamblado','Instalacion'], 'verificacion', 'careless_rework', null, true)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  points = excluded.points,
  department_scope = excluded.department_scope,
  source_module = excluded.source_module,
  event_type = excluded.event_type,
  daily_limit = excluded.daily_limit,
  requires_approval = excluded.requires_approval,
  is_active = true,
  updated_at = now();

insert into public.gamification_collaborators (id, full_name, department, role_name, accumulated_points)
values
  ('11111111-1111-4111-8111-111111111111', 'JUAN JULIO SANTANA', 'Produccion', 'Maestro produccion', 0),
  ('22222222-2222-4222-8222-222222222222', 'RUBEN SANTANA', 'Oficina', 'Ventas / proyectos', 0),
  ('33333333-3333-4333-8333-333333333333', 'MARIA ALMACEN', 'Almacen', 'Control almacen', 0),
  ('44444444-4444-4444-8444-444444444444', 'EQUIPO INSTALACION A', 'Instalacion', 'Instalador lider', 0),
  ('55555555-5555-4555-8555-555555555555', 'CHOFER PILOTO 1', 'Transporte', 'Chofer', 0)
on conflict (id) do update set
  full_name = excluded.full_name,
  department = excluded.department,
  role_name = excluded.role_name,
  updated_at = now();

insert into public.gamification_points (id, collaborator_id, collaborator_name, department, rule_code, rule_title, point_type, points, source_module, reference_code, notes, status, awarded_by, awarded_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'JUAN JULIO SANTANA', 'Produccion', 'orden_a_tiempo', 'Terminar orden a tiempo', 'positivo', 35, 'produccion', 'OP-DEMO-001', 'Demo: orden completada a tiempo.', 'approved', 'Sistema Demo', now() - interval '2 hours'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'JUAN JULIO SANTANA', 'Produccion', 'qr_correcto', 'Escanear QR correctamente', 'positivo', 8, 'qr_tracking', 'QR-DEMO-001', 'Demo: escaneo correcto.', 'approved', 'Sistema Demo', now() - interval '1 hour'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '33333333-3333-4333-8333-333333333333', 'MARIA ALMACEN', 'Almacen', 'fotos_requeridas', 'Subir fotos requeridas', 'positivo', 12, 'almacen', 'REQ-DEMO-001', 'Demo: evidencias completas.', 'approved', 'Sistema Demo', now() - interval '4 hours'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', '44444444-4444-4444-8444-444444444444', 'EQUIPO INSTALACION A', 'Instalacion', 'cero_errores_qa', 'Cero errores en verificacion', 'positivo', 30, 'verificacion', 'QA-DEMO-001', 'Demo: instalacion sin observaciones.', 'approved', 'Sistema Demo', now() - interval '1 day'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', '55555555-5555-4555-8555-555555555555', 'CHOFER PILOTO 1', 'Transporte', 'falta_foto', 'Falta de foto/evidencia', 'negativo', -15, 'transporte', 'TR-DEMO-001', 'Demo: evidencia pendiente.', 'approved', 'Sistema Demo', now() - interval '3 hours'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6', '22222222-2222-4222-8222-222222222222', 'RUBEN SANTANA', 'Oficina', 'mejora_aprobada', 'Proponer mejora aprobada', 'positivo', 50, 'ceo', 'IDEA-DEMO-001', 'Demo: mejora de control de caja aprobada.', 'approved', 'Sistema Demo', now() - interval '6 days')
on conflict (id) do nothing;

insert into public.gamification_rewards (id, title, description, reward_type, points_required, department_scope, stock, period, status)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Bono puntualidad semanal', 'Reconocimiento por asistencia perfecta y cero tardanzas.', 'bono', 180, array['Todos'], 5, 'semanal', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Almuerzo premium equipo ganador', 'Premio para departamento con mejor score mensual.', 'equipo', 650, array['Todos'], 1, 'mensual', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'Dia libre operacional', 'Dia libre aprobado para colaborador top con cero penalizaciones.', 'beneficio', 900, array['Todos'], 2, 'mensual', 'active')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  reward_type = excluded.reward_type,
  points_required = excluded.points_required,
  department_scope = excluded.department_scope,
  stock = excluded.stock,
  period = excluded.period,
  status = excluded.status,
  updated_at = now();

insert into public.gamification_redemptions (id, reward_id, collaborator_id, collaborator_name, department, points_spent, status, notes)
values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '11111111-1111-4111-8111-111111111111', 'JUAN JULIO SANTANA', 'Produccion', 180, 'pending', 'Demo: pendiente de aprobacion del supervisor.')
on conflict (id) do nothing;
