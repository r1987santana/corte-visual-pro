-- RD Wood System - Single Session Enforcement
-- Ejecutar en Supabase SQL Editor para impedir mas de una sesion activa por usuario.

with ranked_sessions as (
  select
    id,
    row_number() over (
      partition by app_user_id
      order by last_seen_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.app_sessions
  where status = 'active'
)
update public.app_sessions as s
set
  status = 'closed',
  closed_at = now(),
  closed_reason = 'single_session_cleanup'
from ranked_sessions as r
where s.id = r.id
  and r.rn > 1;

create unique index if not exists idx_app_sessions_one_active_per_user
  on public.app_sessions (app_user_id)
  where status = 'active';

select pg_notify('pgrst', 'reload schema');
