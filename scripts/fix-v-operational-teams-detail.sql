-- Reparacion de vista de equipos operativos.
-- Ejecutar si Supabase marca error cerca de:
-- 'employee_id', m.employee_id,;

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

grant select, insert, update, delete on public.operational_teams to anon, authenticated;
grant select, insert, update, delete on public.operational_team_members to anon, authenticated;
grant select on public.v_operational_teams_detail to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
