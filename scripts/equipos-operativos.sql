-- RD Wood System - Equipos operativos desde RRHH
-- Ejecutar en Supabase SQL Editor antes de usar /rrhh/equipos.
-- Objetivo: formar equipos de 2 personas por area usando empleados de public.employees.

create extension if not exists pgcrypto;

create table if not exists public.operational_teams (
  id uuid primary key default gen_random_uuid(),
  team_code text not null unique,
  team_name text not null,
  work_area text not null default 'corte_ensamble_limpieza'
    check (
      work_area in (
        'corte',
        'canteo',
        'ensamble_limpieza',
        'corte_ensamble_limpieza',
        'transporte',
        'instalacion',
        'qa',
        'almacen'
      )
    ),
  department text not null default 'Produccion',
  shift text not null default 'diurno',
  status text not null default 'activo'
    check (status in ('activo', 'pausado', 'inactivo')),
  is_initial_combo boolean not null default false,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operational_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.operational_teams(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  employee_name text not null,
  employee_code text,
  department text,
  position text,
  role_in_team text not null default 'ayudante'
    check (role_in_team in ('maestro', 'ayudante', 'chofer', 'supervisor', 'qa')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_operational_team_members_team_employee
  on public.operational_team_members(team_id, employee_id)
  where employee_id is not null;

create index if not exists idx_operational_teams_area_status
  on public.operational_teams(work_area, status);

create index if not exists idx_operational_team_members_employee
  on public.operational_team_members(employee_id, active);

create or replace function public.set_operational_team_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_operational_teams_updated_at on public.operational_teams;
create trigger trg_operational_teams_updated_at
before update on public.operational_teams
for each row execute function public.set_operational_team_updated_at();

drop trigger if exists trg_operational_team_members_updated_at on public.operational_team_members;
create trigger trg_operational_team_members_updated_at
before update on public.operational_team_members
for each row execute function public.set_operational_team_updated_at();

create or replace view public.v_operational_teams_detail as
select
  t.id,
  t.team_code,
  t.team_name,
  t.work_area,
  t.department,
  t.shift,
  t.status,
  t.is_initial_combo,
  t.notes,
  t.created_at,
  t.updated_at,
  count(m.id) filter (where m.active) as active_members,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'employee_id', m.employee_id,
        'employee_code', m.employee_code,
        'employee_name', m.employee_name,
        'department', m.department,
        'position', m.position,
        'role_in_team', m.role_in_team,
        'active', m.active
      )
      order by
        case m.role_in_team
          when 'maestro' then 1
          when 'chofer' then 1
          when 'supervisor' then 1
          when 'qa' then 1
          else 2
        end,
        m.employee_name
    ) filter (where m.id is not null),
    '[]'::jsonb
  ) as members
from public.operational_teams t
left join public.operational_team_members m on m.team_id = t.id
group by t.id;

-- Equipo inicial para pruebas: Corte tambien cubre ensamble y limpieza.
insert into public.operational_teams (
  team_code,
  team_name,
  work_area,
  department,
  shift,
  status,
  is_initial_combo,
  notes
)
values (
  'EQ-INICIO-001',
  'Equipo 1 - Corte + Ensamble + Limpieza',
  'corte_ensamble_limpieza',
  'Produccion',
  'diurno',
  'activo',
  true,
  'Arranque operativo: el mismo equipo corta, ensambla y limpia hasta separar posiciones.'
)
on conflict (team_code) do update set
  team_name = excluded.team_name,
  work_area = excluded.work_area,
  department = excluded.department,
  shift = excluded.shift,
  status = excluded.status,
  is_initial_combo = excluded.is_initial_combo,
  notes = excluded.notes,
  updated_at = now();

grant select, insert, update, delete on public.operational_teams to anon, authenticated;
grant select, insert, update, delete on public.operational_team_members to anon, authenticated;
grant select on public.v_operational_teams_detail to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
