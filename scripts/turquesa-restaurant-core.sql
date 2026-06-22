-- Turquesa Restaurante OS - nucleo operativo
-- Ejecutar completo en Supabase SQL Editor.
-- Fecha base: 2026-06-21

create extension if not exists pgcrypto;

create table if not exists public.turquesa_restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  location text,
  timezone text not null default 'America/Santo_Domingo',
  currency text not null default 'DOP',
  tax_rate numeric(7, 4) not null default 0.18,
  service_charge_rate numeric(7, 4) not null default 0.10,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turquesa_restaurants_status_check check (status in ('active', 'paused', 'archived')),
  constraint turquesa_restaurants_rates_check check (tax_rate >= 0 and service_charge_rate >= 0)
);

create table if not exists public.turquesa_dining_areas (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create table if not exists public.turquesa_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  dining_area_id uuid references public.turquesa_dining_areas(id) on delete set null,
  code text not null,
  seats integer not null default 2,
  status text not null default 'free',
  current_order_id uuid,
  current_server_name text,
  current_started_at timestamptz,
  notes text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, code),
  constraint turquesa_tables_status_check check (status in ('free', 'open', 'reserved', 'attention', 'cleaning')),
  constraint turquesa_tables_seats_check check (seats > 0)
);

create table if not exists public.turquesa_staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  employee_id uuid,
  display_name text not null,
  role text not null default 'server',
  tip_points numeric(8, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, display_name),
  constraint turquesa_staff_role_check check (role in ('manager', 'cashier', 'server', 'host', 'bar', 'kitchen', 'inventory', 'runner'))
);

alter table public.turquesa_staff
  drop constraint if exists turquesa_staff_employee_id_fkey;

create table if not exists public.turquesa_menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create table if not exists public.turquesa_menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  category_id uuid references public.turquesa_menu_categories(id) on delete set null,
  sku text,
  name text not null,
  category_name text not null,
  station text not null default 'Cocina',
  price numeric(14, 2) not null default 0,
  cost numeric(14, 2) not null default 0,
  prep_minutes integer not null default 10,
  taxable boolean not null default true,
  service_chargeable boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name),
  constraint turquesa_menu_items_price_check check (price >= 0 and cost >= 0 and prep_minutes >= 0)
);

create table if not exists public.turquesa_shifts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  shift_code text not null,
  label text not null,
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by_email text,
  closed_by_email text,
  opening_cash numeric(14, 2) not null default 0,
  cash_sales numeric(14, 2) not null default 0,
  card_sales numeric(14, 2) not null default 0,
  transfer_sales numeric(14, 2) not null default 0,
  service_charge_total numeric(14, 2) not null default 0,
  tax_total numeric(14, 2) not null default 0,
  tip_pool numeric(14, 2) not null default 0,
  expected_cash_drawer numeric(14, 2) not null default 0,
  counted_cash numeric(14, 2),
  cash_difference numeric(14, 2),
  closing_summary jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, shift_code),
  constraint turquesa_shifts_status_check check (status in ('open', 'closed', 'cancelled'))
);

create unique index if not exists ux_turquesa_one_open_shift
  on public.turquesa_shifts(restaurant_id)
  where status = 'open';

alter table public.turquesa_shifts
  add column if not exists expected_cash_drawer numeric(14, 2) not null default 0,
  add column if not exists counted_cash numeric(14, 2),
  add column if not exists cash_difference numeric(14, 2),
  add column if not exists closing_summary jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'turquesa_shifts_amounts_check'
      and conrelid = 'public.turquesa_shifts'::regclass
  ) then
    alter table public.turquesa_shifts
      add constraint turquesa_shifts_amounts_check
      check (
        opening_cash >= 0
        and cash_sales >= 0
        and card_sales >= 0
        and transfer_sales >= 0
        and service_charge_total >= 0
        and tax_total >= 0
        and tip_pool >= 0
        and expected_cash_drawer >= 0
        and (counted_cash is null or counted_cash >= 0)
      );
  end if;
end $$;

create table if not exists public.turquesa_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  shift_id uuid references public.turquesa_shifts(id) on delete set null,
  table_id uuid references public.turquesa_tables(id) on delete set null,
  order_number text not null,
  order_type text not null default 'dine_in',
  status text not null default 'open',
  guest_name text,
  pax integer not null default 1,
  server_name text,
  subtotal numeric(14, 2) not null default 0,
  service_charge numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  paid_total numeric(14, 2) not null default 0,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, order_number),
  constraint turquesa_orders_type_check check (order_type in ('dine_in', 'takeout', 'delivery', 'bar')),
  constraint turquesa_orders_status_check check (status in ('open', 'sent', 'ready', 'paid', 'void', 'cancelled')),
  constraint turquesa_orders_amounts_check check (subtotal >= 0 and service_charge >= 0 and tax >= 0 and discount >= 0 and total >= 0 and paid_total >= 0)
);

create table if not exists public.turquesa_order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  order_id uuid not null references public.turquesa_orders(id) on delete cascade,
  menu_item_id uuid references public.turquesa_menu_items(id) on delete set null,
  item_name text not null,
  station text not null default 'Cocina',
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(14, 2) not null default 0,
  line_total numeric(14, 2) generated always as (quantity * unit_price) stored,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turquesa_order_items_status_check check (status in ('open', 'sent', 'cooking', 'ready', 'served', 'void')),
  constraint turquesa_order_items_qty_check check (quantity > 0 and unit_price >= 0)
);

create table if not exists public.turquesa_kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  shift_id uuid references public.turquesa_shifts(id) on delete set null,
  order_id uuid references public.turquesa_orders(id) on delete cascade,
  table_id uuid references public.turquesa_tables(id) on delete set null,
  ticket_number text not null,
  station text not null default 'Mixta',
  status text not null default 'new',
  server_name text,
  fired_at timestamptz not null default now(),
  cooking_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  priority integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, ticket_number),
  constraint turquesa_kitchen_tickets_status_check check (status in ('new', 'cooking', 'ready', 'served', 'void'))
);

create table if not exists public.turquesa_kitchen_ticket_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  ticket_id uuid not null references public.turquesa_kitchen_tickets(id) on delete cascade,
  order_item_id uuid references public.turquesa_order_items(id) on delete set null,
  item_name text not null,
  quantity numeric(12, 2) not null default 1,
  station text not null default 'Cocina',
  notes text,
  created_at timestamptz not null default now(),
  constraint turquesa_kitchen_ticket_items_qty_check check (quantity > 0)
);

create table if not exists public.turquesa_payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  shift_id uuid references public.turquesa_shifts(id) on delete set null,
  order_id uuid not null references public.turquesa_orders(id) on delete cascade,
  method text not null default 'cash',
  amount numeric(14, 2) not null,
  reference text,
  received_by_email text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint turquesa_payments_method_check check (method in ('cash', 'card', 'transfer', 'room_charge', 'comp')),
  constraint turquesa_payments_amount_check check (amount > 0)
);

create table if not exists public.turquesa_reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  table_id uuid references public.turquesa_tables(id) on delete set null,
  reservation_at timestamptz not null,
  guest_name text not null,
  phone text,
  email text,
  pax integer not null default 2,
  source text not null default 'directa',
  status text not null default 'confirmed',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turquesa_reservations_status_check check (status in ('pending', 'confirmed', 'seated', 'cancelled', 'no_show')),
  constraint turquesa_reservations_pax_check check (pax > 0)
);

create table if not exists public.turquesa_inventory_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  item_name text not null,
  category text not null default 'Cocina',
  unit text not null default 'u',
  on_hand numeric(14, 3) not null default 0,
  minimum_stock numeric(14, 3) not null default 0,
  reorder_stock numeric(14, 3) not null default 0,
  avg_cost numeric(14, 2) not null default 0,
  supplier text,
  is_active boolean not null default true,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, item_name),
  constraint turquesa_inventory_amounts_check check (on_hand >= 0 and minimum_stock >= 0 and reorder_stock >= 0 and avg_cost >= 0)
);

create table if not exists public.turquesa_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  menu_item_id uuid not null references public.turquesa_menu_items(id) on delete cascade,
  inventory_item_id uuid not null references public.turquesa_inventory_items(id) on delete restrict,
  quantity numeric(14, 3) not null,
  unit text not null default 'u',
  yield_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, menu_item_id, inventory_item_id),
  constraint turquesa_recipe_ingredients_qty_check check (quantity > 0)
);

create table if not exists public.turquesa_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  shift_id uuid references public.turquesa_shifts(id) on delete set null,
  request_code text not null,
  status text not null default 'draft',
  priority text not null default 'normal',
  reason text,
  total_estimated numeric(14, 2) not null default 0,
  requested_by_email text,
  requested_at timestamptz not null default now(),
  approved_by_email text,
  approved_at timestamptz,
  received_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, request_code),
  constraint turquesa_purchase_requests_status_check check (status in ('draft', 'requested', 'approved', 'received', 'cancelled')),
  constraint turquesa_purchase_requests_priority_check check (priority in ('normal', 'urgent')),
  constraint turquesa_purchase_requests_amount_check check (total_estimated >= 0)
);

create table if not exists public.turquesa_purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  purchase_request_id uuid not null references public.turquesa_purchase_requests(id) on delete cascade,
  inventory_item_id uuid references public.turquesa_inventory_items(id) on delete set null,
  item_name text not null,
  quantity numeric(14, 3) not null,
  unit text not null default 'u',
  supplier text,
  estimated_unit_cost numeric(14, 2) not null default 0,
  estimated_cost numeric(14, 2) not null default 0,
  received_quantity numeric(14, 3) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turquesa_purchase_request_items_qty_check check (quantity > 0 and received_quantity >= 0),
  constraint turquesa_purchase_request_items_amount_check check (estimated_unit_cost >= 0 and estimated_cost >= 0)
);

create table if not exists public.turquesa_wifi_leads (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  source text not null default 'Portal Wi-Fi',
  status text not null default 'nuevo',
  visits integer not null default 1,
  consent_marketing boolean not null default true,
  last_seen_at timestamptz not null default now(),
  raw_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turquesa_wifi_leads_status_check check (status in ('nuevo', 'promocion', 'cliente', 'no_contactar'))
);

create table if not exists public.turquesa_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.turquesa_restaurants(id) on delete cascade,
  shift_id uuid references public.turquesa_shifts(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  actor_email text,
  description text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.turquesa_cash_closures (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  shift_id uuid not null references public.turquesa_shifts(id) on delete cascade,
  expected_cash numeric(14, 2) not null default 0,
  counted_cash numeric(14, 2) not null default 0,
  cash_difference numeric(14, 2) not null default 0,
  card_total numeric(14, 2) not null default 0,
  transfer_total numeric(14, 2) not null default 0,
  service_charge_total numeric(14, 2) not null default 0,
  tax_total numeric(14, 2) not null default 0,
  closed_by_email text,
  status text not null default 'draft',
  notes text,
  audit_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, shift_id),
  constraint turquesa_cash_closures_status_check check (status in ('draft', 'balanced', 'difference', 'approved')),
  constraint turquesa_cash_closures_amounts_check check (
    expected_cash >= 0
    and counted_cash >= 0
    and card_total >= 0
    and transfer_total >= 0
    and service_charge_total >= 0
    and tax_total >= 0
  )
);

create table if not exists public.turquesa_accounting_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  shift_id uuid references public.turquesa_shifts(id) on delete set null,
  entry_date date not null default current_date,
  account_code text not null,
  account_name text not null,
  debit numeric(14, 2) not null default 0,
  credit numeric(14, 2) not null default 0,
  reference_type text not null default 'shift',
  reference_id uuid,
  memo text,
  status text not null default 'posted',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turquesa_accounting_entries_status_check check (status in ('draft', 'posted', 'void')),
  constraint turquesa_accounting_entries_amount_check check (debit >= 0 and credit >= 0 and (debit > 0 or credit > 0))
);

create table if not exists public.turquesa_ai_decisions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  shift_id uuid references public.turquesa_shifts(id) on delete set null,
  area text not null,
  title text not null,
  summary text not null,
  risk text not null default 'medium',
  status text not null default 'draft',
  action_label text not null default 'Preparar aprobacion',
  requested_by_email text,
  approved_by_email text,
  approved_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turquesa_ai_decisions_area_check check (area in ('cocina', 'caja', 'inventario', 'compras', 'reservas', 'wifi', 'impresoras', 'gerencia')),
  constraint turquesa_ai_decisions_risk_check check (risk in ('low', 'medium', 'high', 'critical')),
  constraint turquesa_ai_decisions_status_check check (status in ('draft', 'pending', 'approved', 'rejected', 'executed'))
);

create table if not exists public.turquesa_ai_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.turquesa_restaurants(id) on delete cascade,
  shift_id uuid references public.turquesa_shifts(id) on delete set null,
  area text not null default 'gerencia',
  title text not null,
  summary text not null,
  severity text not null default 'info',
  risk_score integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint turquesa_ai_events_severity_check check (severity in ('info', 'success', 'warning', 'danger', 'critical')),
  constraint turquesa_ai_events_score_check check (risk_score >= 0 and risk_score <= 100)
);

create table if not exists public.turquesa_print_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  shift_id uuid references public.turquesa_shifts(id) on delete set null,
  order_id uuid references public.turquesa_orders(id) on delete set null,
  target_station text not null,
  printer_name text not null,
  job_type text not null default 'ticket',
  status text not null default 'queued',
  copies integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turquesa_print_jobs_status_check check (status in ('queued', 'printing', 'printed', 'failed', 'cancelled')),
  constraint turquesa_print_jobs_copies_check check (copies > 0)
);

create index if not exists turquesa_dining_areas_restaurant_idx on public.turquesa_dining_areas(restaurant_id, sort_order);
create index if not exists turquesa_tables_restaurant_status_idx on public.turquesa_tables(restaurant_id, status, sort_order);
create index if not exists turquesa_tables_area_idx on public.turquesa_tables(dining_area_id);
create index if not exists turquesa_staff_restaurant_role_idx on public.turquesa_staff(restaurant_id, role, is_active);
create index if not exists turquesa_menu_categories_restaurant_idx on public.turquesa_menu_categories(restaurant_id, sort_order);
create index if not exists turquesa_menu_items_restaurant_active_idx on public.turquesa_menu_items(restaurant_id, is_active, sort_order);
create index if not exists turquesa_shifts_restaurant_status_idx on public.turquesa_shifts(restaurant_id, status, opened_at desc);
create index if not exists turquesa_orders_shift_status_idx on public.turquesa_orders(shift_id, status, opened_at desc);
create index if not exists turquesa_orders_table_status_idx on public.turquesa_orders(table_id, status, opened_at desc);
create index if not exists turquesa_order_items_order_idx on public.turquesa_order_items(order_id, status);
create index if not exists turquesa_order_items_menu_item_idx on public.turquesa_order_items(menu_item_id);
create index if not exists turquesa_kitchen_tickets_shift_status_idx on public.turquesa_kitchen_tickets(shift_id, status, fired_at asc);
create index if not exists turquesa_kitchen_tickets_order_idx on public.turquesa_kitchen_tickets(order_id);
create index if not exists turquesa_kitchen_ticket_items_ticket_idx on public.turquesa_kitchen_ticket_items(ticket_id);
create index if not exists turquesa_payments_order_idx on public.turquesa_payments(order_id);
create index if not exists turquesa_payments_shift_method_idx on public.turquesa_payments(shift_id, method, paid_at desc);
create index if not exists turquesa_reservations_restaurant_time_idx on public.turquesa_reservations(restaurant_id, reservation_at);
create index if not exists turquesa_inventory_restaurant_active_idx on public.turquesa_inventory_items(restaurant_id, is_active, item_name);
create index if not exists turquesa_recipe_ingredients_menu_idx on public.turquesa_recipe_ingredients(menu_item_id, is_active);
create index if not exists turquesa_recipe_ingredients_inventory_idx on public.turquesa_recipe_ingredients(inventory_item_id);
create index if not exists turquesa_purchase_requests_restaurant_status_idx on public.turquesa_purchase_requests(restaurant_id, status, requested_at desc);
create index if not exists turquesa_purchase_requests_shift_idx on public.turquesa_purchase_requests(shift_id, requested_at desc);
create index if not exists turquesa_purchase_request_items_request_idx on public.turquesa_purchase_request_items(purchase_request_id);
create index if not exists turquesa_purchase_request_items_inventory_idx on public.turquesa_purchase_request_items(inventory_item_id);
create index if not exists turquesa_wifi_leads_restaurant_seen_idx on public.turquesa_wifi_leads(restaurant_id, last_seen_at desc);
create index if not exists turquesa_events_restaurant_created_idx on public.turquesa_events(restaurant_id, created_at desc);
create index if not exists turquesa_cash_closures_shift_idx on public.turquesa_cash_closures(shift_id, status);
create index if not exists turquesa_accounting_entries_shift_idx on public.turquesa_accounting_entries(shift_id, entry_date desc);
create index if not exists turquesa_accounting_entries_account_idx on public.turquesa_accounting_entries(restaurant_id, account_code, entry_date desc);
create index if not exists turquesa_ai_decisions_restaurant_status_idx on public.turquesa_ai_decisions(restaurant_id, status, created_at desc);
create index if not exists turquesa_ai_events_restaurant_created_idx on public.turquesa_ai_events(restaurant_id, created_at desc);
create index if not exists turquesa_print_jobs_station_status_idx on public.turquesa_print_jobs(restaurant_id, target_station, status, created_at asc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'turquesa_tables_current_order_fkey'
      and conrelid = 'public.turquesa_tables'::regclass
  ) then
    alter table public.turquesa_tables
      add constraint turquesa_tables_current_order_fkey
      foreign key (current_order_id)
      references public.turquesa_orders(id)
      on delete set null
      not valid;
  end if;
end $$;

alter table public.turquesa_tables validate constraint turquesa_tables_current_order_fkey;

create or replace function public.touch_turquesa_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_turquesa_restaurants_updated_at on public.turquesa_restaurants;
create trigger trg_turquesa_restaurants_updated_at before update on public.turquesa_restaurants
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_dining_areas_updated_at on public.turquesa_dining_areas;
create trigger trg_turquesa_dining_areas_updated_at before update on public.turquesa_dining_areas
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_tables_updated_at on public.turquesa_tables;
create trigger trg_turquesa_tables_updated_at before update on public.turquesa_tables
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_menu_items_updated_at on public.turquesa_menu_items;
create trigger trg_turquesa_menu_items_updated_at before update on public.turquesa_menu_items
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_orders_updated_at on public.turquesa_orders;
create trigger trg_turquesa_orders_updated_at before update on public.turquesa_orders
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_order_items_updated_at on public.turquesa_order_items;
create trigger trg_turquesa_order_items_updated_at before update on public.turquesa_order_items
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_kitchen_tickets_updated_at on public.turquesa_kitchen_tickets;
create trigger trg_turquesa_kitchen_tickets_updated_at before update on public.turquesa_kitchen_tickets
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_reservations_updated_at on public.turquesa_reservations;
create trigger trg_turquesa_reservations_updated_at before update on public.turquesa_reservations
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_inventory_updated_at on public.turquesa_inventory_items;
create trigger trg_turquesa_inventory_updated_at before update on public.turquesa_inventory_items
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_recipe_ingredients_updated_at on public.turquesa_recipe_ingredients;
create trigger trg_turquesa_recipe_ingredients_updated_at before update on public.turquesa_recipe_ingredients
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_purchase_requests_updated_at on public.turquesa_purchase_requests;
create trigger trg_turquesa_purchase_requests_updated_at before update on public.turquesa_purchase_requests
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_purchase_request_items_updated_at on public.turquesa_purchase_request_items;
create trigger trg_turquesa_purchase_request_items_updated_at before update on public.turquesa_purchase_request_items
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_wifi_leads_updated_at on public.turquesa_wifi_leads;
create trigger trg_turquesa_wifi_leads_updated_at before update on public.turquesa_wifi_leads
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_cash_closures_updated_at on public.turquesa_cash_closures;
create trigger trg_turquesa_cash_closures_updated_at before update on public.turquesa_cash_closures
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_accounting_entries_updated_at on public.turquesa_accounting_entries;
create trigger trg_turquesa_accounting_entries_updated_at before update on public.turquesa_accounting_entries
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_ai_decisions_updated_at on public.turquesa_ai_decisions;
create trigger trg_turquesa_ai_decisions_updated_at before update on public.turquesa_ai_decisions
for each row execute function public.touch_turquesa_updated_at();

drop trigger if exists trg_turquesa_print_jobs_updated_at on public.turquesa_print_jobs;
create trigger trg_turquesa_print_jobs_updated_at before update on public.turquesa_print_jobs
for each row execute function public.touch_turquesa_updated_at();

alter table public.turquesa_restaurants enable row level security;
alter table public.turquesa_dining_areas enable row level security;
alter table public.turquesa_tables enable row level security;
alter table public.turquesa_staff enable row level security;
alter table public.turquesa_menu_categories enable row level security;
alter table public.turquesa_menu_items enable row level security;
alter table public.turquesa_shifts enable row level security;
alter table public.turquesa_orders enable row level security;
alter table public.turquesa_order_items enable row level security;
alter table public.turquesa_kitchen_tickets enable row level security;
alter table public.turquesa_kitchen_ticket_items enable row level security;
alter table public.turquesa_payments enable row level security;
alter table public.turquesa_reservations enable row level security;
alter table public.turquesa_inventory_items enable row level security;
alter table public.turquesa_recipe_ingredients enable row level security;
alter table public.turquesa_purchase_requests enable row level security;
alter table public.turquesa_purchase_request_items enable row level security;
alter table public.turquesa_wifi_leads enable row level security;
alter table public.turquesa_events enable row level security;
alter table public.turquesa_cash_closures enable row level security;
alter table public.turquesa_accounting_entries enable row level security;
alter table public.turquesa_ai_decisions enable row level security;
alter table public.turquesa_ai_events enable row level security;
alter table public.turquesa_print_jobs enable row level security;

-- Sin politicas publicas: anon/authenticated no leen ni escriben directo.
-- El software accede mediante APIs protegidas con service role.

insert into public.turquesa_restaurants (slug, name, legal_name, location, timezone, currency, tax_rate, service_charge_rate)
values ('turquesa-restaurante', 'Turquesa Restaurante', 'Turquesa Restaurant by RDSS Santana Group', 'Cadaques Caribe, Bayahibe', 'America/Santo_Domingo', 'DOP', 0.18, 0.10)
on conflict (slug) do update
set name = excluded.name,
    legal_name = excluded.legal_name,
    location = excluded.location,
    timezone = excluded.timezone,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    service_charge_rate = excluded.service_charge_rate,
    status = 'active',
    updated_at = now();

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
)
insert into public.turquesa_dining_areas (restaurant_id, name, sort_order)
select r.id, area.name, area.sort_order
from r
cross join (values
  ('Terraza mar', 10),
  ('Salon', 20),
  ('Bar', 30),
  ('Eventos', 40),
  ('Privado', 50)
) as area(name, sort_order)
on conflict (restaurant_id, name) do update
set sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
),
areas as (
  select id, name from public.turquesa_dining_areas where restaurant_id = (select id from r)
)
insert into public.turquesa_tables (restaurant_id, dining_area_id, code, seats, status, current_server_name, sort_order)
select r.id, areas.id, t.code, t.seats, t.status, t.server_name, t.sort_order
from r
join (values
  ('M1', 'Terraza mar', 2, 'open', 'Laura', 10),
  ('M2', 'Terraza mar', 4, 'reserved', 'Mesa 8:30', 20),
  ('M3', 'Salon', 4, 'attention', 'Rafael', 30),
  ('M4', 'Salon', 6, 'open', 'Mia', 40),
  ('M5', 'Bar', 2, 'free', 'Libre', 50),
  ('M6', 'Eventos', 8, 'open', 'Carlos', 60),
  ('B1', 'Bar', 2, 'open', 'Nadia', 70),
  ('VIP', 'Privado', 10, 'reserved', '9:15 PM', 80)
) as t(code, area_name, seats, status, server_name, sort_order) on true
left join areas on areas.name = t.area_name
on conflict (restaurant_id, code) do update
set dining_area_id = excluded.dining_area_id,
    seats = excluded.seats,
    status = excluded.status,
    current_server_name = excluded.current_server_name,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
)
insert into public.turquesa_staff (restaurant_id, display_name, role, tip_points)
select r.id, s.display_name, s.role, s.tip_points
from r
cross join (values
  ('Laura', 'server', 1.00),
  ('Rafael', 'server', 1.00),
  ('Mia', 'server', 1.00),
  ('Carlos', 'server', 1.00),
  ('Nadia', 'bar', 1.00),
  ('Cocina Caliente', 'kitchen', 1.20)
) as s(display_name, role, tip_points)
on conflict (restaurant_id, display_name) do update
set role = excluded.role,
    tip_points = excluded.tip_points,
    is_active = true,
    updated_at = now();

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
)
insert into public.turquesa_menu_categories (restaurant_id, name, sort_order)
select r.id, c.name, c.sort_order
from r
cross join (values
  ('Mar', 10),
  ('Especial', 20),
  ('Entrada', 30),
  ('Bar', 40),
  ('Coctel', 50),
  ('Postre', 60)
) as c(name, sort_order)
on conflict (restaurant_id, name) do update
set sort_order = excluded.sort_order,
    is_active = true;

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
),
categories as (
  select id, name from public.turquesa_menu_categories where restaurant_id = (select id from r)
)
insert into public.turquesa_menu_items (restaurant_id, category_id, name, category_name, station, price, prep_minutes, sort_order)
select r.id, categories.id, m.name, m.category_name, m.station, m.price, m.prep_minutes, m.sort_order
from r
join (values
  ('Pescado local al coco', 'Mar', 'Cocina caliente', 1250::numeric, 18, 10),
  ('Ceviche Turquesa', 'Mar', 'Fria', 880::numeric, 10, 20),
  ('Langosta grill', 'Especial', 'Parrilla', 2850::numeric, 24, 30),
  ('Tostones de la casa', 'Entrada', 'Fritura', 420::numeric, 8, 40),
  ('Mojito de chinola', 'Bar', 'Bar', 390::numeric, 4, 50),
  ('Atardecer Turquesa', 'Coctel', 'Bar', 520::numeric, 5, 60),
  ('Arroz marinero', 'Mar', 'Cocina caliente', 1480::numeric, 20, 70),
  ('Flan de coco', 'Postre', 'Postres', 360::numeric, 6, 80)
) as m(name, category_name, station, price, prep_minutes, sort_order) on true
left join categories on categories.name = m.category_name
on conflict (restaurant_id, name) do update
set category_id = excluded.category_id,
    category_name = excluded.category_name,
    station = excluded.station,
    price = excluded.price,
    prep_minutes = excluded.prep_minutes,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
)
insert into public.turquesa_shifts (
  restaurant_id,
  shift_code,
  label,
  status,
  opening_cash,
  cash_sales,
  card_sales,
  transfer_sales,
  service_charge_total,
  tax_total,
  tip_pool,
  expected_cash_drawer
)
select r.id, '2026-06-21-noche', 'Turno noche', 'open', 12000, 15462, 29475, 3383, 4320, 7776, 4320, 27462
from r
on conflict (restaurant_id, shift_code) do update
set label = excluded.label,
    status = 'open',
    opening_cash = excluded.opening_cash,
    cash_sales = excluded.cash_sales,
    card_sales = excluded.card_sales,
    transfer_sales = excluded.transfer_sales,
    service_charge_total = excluded.service_charge_total,
    tax_total = excluded.tax_total,
    tip_pool = excluded.tip_pool,
    expected_cash_drawer = excluded.expected_cash_drawer,
    counted_cash = null,
    cash_difference = null,
    closed_at = null,
    closed_by_email = null,
    closing_summary = '{}'::jsonb,
    updated_at = now();

with r as (
  select id, tax_rate, service_charge_rate from public.turquesa_restaurants where slug = 'turquesa-restaurante'
),
shift as (
  select id from public.turquesa_shifts where restaurant_id = (select id from r) and status = 'open' limit 1
),
seed_orders as (
  select * from (values
    ('ORD-DEMO-M1', 'M1', 'Laura', 2850::numeric, now() - interval '18 minutes'),
    ('ORD-DEMO-M3', 'M3', 'Rafael', 6120::numeric, now() - interval '42 minutes'),
    ('ORD-DEMO-M4', 'M4', 'Mia', 4480::numeric, now() - interval '27 minutes'),
    ('ORD-DEMO-M6', 'M6', 'Carlos', 14350::numeric, now() - interval '55 minutes'),
    ('ORD-DEMO-B1', 'B1', 'Nadia', 1620::numeric, now() - interval '12 minutes')
  ) as o(order_number, table_code, server_name, subtotal, opened_at)
),
orders_inserted as (
  insert into public.turquesa_orders (
    restaurant_id,
    shift_id,
    table_id,
    order_number,
    status,
    server_name,
    subtotal,
    service_charge,
    tax,
    total,
    opened_at
  )
  select
    r.id,
    shift.id,
    t.id,
    o.order_number,
    'open',
    o.server_name,
    o.subtotal,
    round(o.subtotal * r.service_charge_rate, 2),
    round(o.subtotal * r.tax_rate, 2),
    round(o.subtotal + (o.subtotal * r.service_charge_rate) + (o.subtotal * r.tax_rate), 2),
    o.opened_at
  from r
  join shift on true
  join seed_orders o on true
  join public.turquesa_tables t on t.restaurant_id = r.id and t.code = o.table_code
  on conflict (restaurant_id, order_number) do update
  set status = excluded.status,
      server_name = excluded.server_name,
      subtotal = excluded.subtotal,
      service_charge = excluded.service_charge,
      tax = excluded.tax,
      total = excluded.total,
      opened_at = excluded.opened_at,
      updated_at = now()
  returning id, table_id, opened_at, server_name
)
update public.turquesa_tables t
set current_order_id = o.id,
    current_started_at = o.opened_at,
    current_server_name = o.server_name,
    updated_at = now()
from orders_inserted o
where t.id = o.table_id;

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
),
shift as (
  select id from public.turquesa_shifts where restaurant_id = (select id from r) and status = 'open' limit 1
)
insert into public.turquesa_kitchen_tickets (restaurant_id, shift_id, order_id, table_id, ticket_number, station, status, server_name, fired_at, cooking_at, ready_at)
select r.id, shift.id, o.id, o.table_id, k.ticket_number, k.station, k.status, o.server_name, now() - (k.minutes || ' minutes')::interval,
       case when k.status in ('cooking', 'ready') then now() - ((k.minutes - 1) || ' minutes')::interval else null end,
       case when k.status = 'ready' then now() - interval '1 minute' else null end
from r
join shift on true
join (values
  ('K-104', 'ORD-DEMO-M3', 'Parrilla', 'cooking', 14),
  ('K-105', 'ORD-DEMO-M6', 'Cocina caliente', 'new', 9),
  ('B-041', 'ORD-DEMO-B1', 'Bar', 'ready', 3),
  ('F-018', 'ORD-DEMO-M1', 'Fria', 'cooking', 6)
) as k(ticket_number, order_number, station, status, minutes) on true
join public.turquesa_orders o on o.restaurant_id = r.id and o.order_number = k.order_number
on conflict (restaurant_id, ticket_number) do update
set station = excluded.station,
    status = excluded.status,
    server_name = excluded.server_name,
    fired_at = excluded.fired_at,
    cooking_at = excluded.cooking_at,
    ready_at = excluded.ready_at,
    updated_at = now();

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
),
ticket_items as (
  select * from (values
    ('K-104', 'Langosta grill', 1::numeric, 'Parrilla'),
    ('K-104', 'Tostones de la casa', 1::numeric, 'Fritura'),
    ('K-105', 'Pescado local al coco', 1::numeric, 'Cocina caliente'),
    ('K-105', 'Arroz marinero', 1::numeric, 'Cocina caliente'),
    ('B-041', 'Mojito de chinola', 1::numeric, 'Bar'),
    ('B-041', 'Atardecer Turquesa', 1::numeric, 'Bar'),
    ('F-018', 'Ceviche Turquesa', 1::numeric, 'Fria')
  ) as ti(ticket_number, item_name, quantity, station)
)
insert into public.turquesa_kitchen_ticket_items (restaurant_id, ticket_id, item_name, quantity, station)
select r.id, kt.id, ti.item_name, ti.quantity, ti.station
from r
join ticket_items ti on true
join public.turquesa_kitchen_tickets kt on kt.restaurant_id = r.id and kt.ticket_number = ti.ticket_number
where not exists (
  select 1
  from public.turquesa_kitchen_ticket_items existing
  where existing.ticket_id = kt.id
    and existing.item_name = ti.item_name
);

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
)
insert into public.turquesa_reservations (restaurant_id, reservation_at, guest_name, pax, source, status, note)
select r.id, (current_date + v.time_value)::timestamptz, v.guest_name, v.pax, v.source, 'confirmed', v.note
from r
cross join (values
  (time '19:30', 'Familia Perez', 5, 'WhatsApp', 'Cumpleanos'),
  (time '20:30', 'Mesa hotel', 4, 'WhatsApp', 'Confirmada por WhatsApp'),
  (time '21:15', 'VIP Cadaques', 10, 'Directa', 'Menu fijo')
) as v(time_value, guest_name, pax, source, note)
where not exists (
  select 1
  from public.turquesa_reservations existing
  where existing.restaurant_id = r.id
    and existing.guest_name = v.guest_name
    and existing.reservation_at::date = current_date
);

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
)
insert into public.turquesa_inventory_items (restaurant_id, item_name, category, unit, on_hand, minimum_stock, reorder_stock, avg_cost, supplier)
select r.id, i.item_name, i.category, i.unit, i.on_hand, i.minimum_stock, i.reorder_stock, i.avg_cost, i.supplier
from r
cross join (values
  ('Langosta', 'Cocina', 'lb', 9::numeric, 12::numeric, 18::numeric, 450::numeric, 'Proveedor costa'),
  ('Pescado fresco', 'Cocina', 'lb', 28::numeric, 20::numeric, 30::numeric, 210::numeric, 'Pescaderia local'),
  ('Chinola', 'Bar', 'lb', 14::numeric, 18::numeric, 25::numeric, 167::numeric, 'Mercado local'),
  ('Ron blanco', 'Bar', 'bot', 11::numeric, 8::numeric, 12::numeric, 820::numeric, 'Distribuidor bebidas')
) as i(item_name, category, unit, on_hand, minimum_stock, reorder_stock, avg_cost, supplier)
on conflict (restaurant_id, item_name) do update
set category = excluded.category,
    unit = excluded.unit,
    on_hand = excluded.on_hand,
    minimum_stock = excluded.minimum_stock,
    reorder_stock = excluded.reorder_stock,
    avg_cost = excluded.avg_cost,
    supplier = excluded.supplier,
    is_active = true,
    updated_at = now();

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
),
menu as (
  select id, name from public.turquesa_menu_items where restaurant_id = (select id from r)
),
inventory as (
  select id, item_name, unit from public.turquesa_inventory_items where restaurant_id = (select id from r)
),
recipes as (
  select * from (values
    ('Pescado local al coco', 'Pescado fresco', 1.250::numeric, 'filete + merma limpia'),
    ('Ceviche Turquesa', 'Pescado fresco', 0.650::numeric, 'porcion ceviche'),
    ('Ceviche Turquesa', 'Chinola', 0.150::numeric, 'acido y salsa'),
    ('Langosta grill', 'Langosta', 1.200::numeric, 'cola grill'),
    ('Mojito de chinola', 'Chinola', 0.350::numeric, 'pulpa natural'),
    ('Mojito de chinola', 'Ron blanco', 0.080::numeric, 'base coctel'),
    ('Atardecer Turquesa', 'Chinola', 0.250::numeric, 'pulpa natural'),
    ('Atardecer Turquesa', 'Ron blanco', 0.070::numeric, 'base coctel'),
    ('Arroz marinero', 'Pescado fresco', 0.750::numeric, 'mixto marino'),
    ('Arroz marinero', 'Langosta', 0.350::numeric, 'mixto marino')
  ) as recipe(menu_name, inventory_name, quantity, yield_note)
)
insert into public.turquesa_recipe_ingredients (restaurant_id, menu_item_id, inventory_item_id, quantity, unit, yield_note)
select r.id, menu.id, inventory.id, recipes.quantity, inventory.unit, recipes.yield_note
from r
join recipes on true
join menu on menu.name = recipes.menu_name
join inventory on inventory.item_name = recipes.inventory_name
on conflict (restaurant_id, menu_item_id, inventory_item_id) do update
set quantity = excluded.quantity,
    unit = excluded.unit,
    yield_note = excluded.yield_note,
    is_active = true,
    updated_at = now();

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
)
insert into public.turquesa_wifi_leads (restaurant_id, full_name, phone, email, source, status, visits, last_seen_at)
select r.id, l.full_name, l.phone, l.email, l.source, l.status, l.visits, now() - (l.minutes_ago || ' minutes')::interval
from r
cross join (values
  ('Ana M.', '8090000001', 'ana@example.com', 'Wi-Fi', 'nuevo', 1, 28),
  ('Jean P.', '8090000002', 'jean@example.com', 'Wi-Fi', 'promocion', 2, 6),
  ('Carlos R.', '8090000003', 'carlos@example.com', 'Reserva', 'cliente', 3, 1)
) as l(full_name, phone, email, source, status, visits, minutes_ago)
where not exists (
  select 1
  from public.turquesa_wifi_leads existing
  where existing.restaurant_id = r.id
    and (
      existing.phone = l.phone
      or existing.email = l.email
    )
);

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
),
shift as (
  select id, cash_sales, card_sales, transfer_sales, service_charge_total, tax_total, expected_cash_drawer
  from public.turquesa_shifts
  where restaurant_id = (select id from r)
    and status = 'open'
  limit 1
)
insert into public.turquesa_cash_closures (
  restaurant_id,
  shift_id,
  expected_cash,
  counted_cash,
  cash_difference,
  card_total,
  transfer_total,
  service_charge_total,
  tax_total,
  status,
  notes,
  audit_payload
)
select
  r.id,
  shift.id,
  shift.expected_cash_drawer,
  shift.expected_cash_drawer,
  0,
  shift.card_sales,
  shift.transfer_sales,
  shift.service_charge_total,
  shift.tax_total,
  'balanced',
  'Seed inicial Turquesa Restaurante OS.',
  jsonb_build_object('source', 'turquesa-restaurant-core.sql')
from r
join shift on true
on conflict (restaurant_id, shift_id) do update
set expected_cash = excluded.expected_cash,
    counted_cash = excluded.counted_cash,
    cash_difference = excluded.cash_difference,
    card_total = excluded.card_total,
    transfer_total = excluded.transfer_total,
    service_charge_total = excluded.service_charge_total,
    tax_total = excluded.tax_total,
    status = excluded.status,
    audit_payload = excluded.audit_payload,
    updated_at = now();

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
),
shift as (
  select id, cash_sales, card_sales, transfer_sales, service_charge_total, tax_total
  from public.turquesa_shifts
  where restaurant_id = (select id from r)
    and status = 'open'
  limit 1
),
entries as (
  select * from (values
    ('1010', 'Caja restaurante', (select cash_sales from shift), 0::numeric, 'Ventas en efectivo'),
    ('1020', 'Tarjetas por cobrar', (select card_sales from shift), 0::numeric, 'Ventas por tarjeta'),
    ('1030', 'Transferencias por cobrar', (select transfer_sales from shift), 0::numeric, 'Ventas por transferencia'),
    ('4010', 'Ventas restaurante', 0::numeric, (select cash_sales + card_sales + transfer_sales from shift), 'Ingreso del turno'),
    ('2105', 'ITBIS por pagar', 0::numeric, (select tax_total from shift), 'ITBIS del turno'),
    ('2110', '10% servicio por distribuir', 0::numeric, (select service_charge_total from shift), 'Servicio legal del turno')
  ) as entry(account_code, account_name, debit, credit, memo)
)
insert into public.turquesa_accounting_entries (restaurant_id, shift_id, account_code, account_name, debit, credit, memo, metadata)
select r.id, shift.id, entries.account_code, entries.account_name, entries.debit, entries.credit, entries.memo,
       jsonb_build_object('source', 'turquesa-restaurant-core.sql')
from r
join shift on true
join entries on true
where not exists (
  select 1
  from public.turquesa_accounting_entries existing
  where existing.shift_id = shift.id
    and existing.account_code = entries.account_code
    and existing.memo = entries.memo
);

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
),
shift as (
  select id from public.turquesa_shifts where restaurant_id = (select id from r) and status = 'open' limit 1
)
insert into public.turquesa_ai_decisions (restaurant_id, shift_id, area, title, summary, risk, status, action_label, payload)
select r.id, shift.id, d.area, d.title, d.summary, d.risk, d.status, d.action_label,
       jsonb_build_object('source', 'turquesa-restaurant-core.sql')
from r
join shift on true
cross join (values
  ('compras', 'Aprobar compra critica', 'Langosta y chinola estan bajo punto de reposicion para el proximo servicio.', 'high', 'pending', 'Generar orden'),
  ('caja', 'Revisar cierre del turno', 'Validar efectivo esperado, tarjetas, transferencias, ITBIS y 10% servicio antes de cerrar.', 'medium', 'draft', 'Auditar caja'),
  ('impresoras', 'Confirmar despacho cocina/bar', 'Mantener colas separadas para cocina caliente, fria y bar antes del servicio.', 'medium', 'draft', 'Probar impresion')
) as d(area, title, summary, risk, status, action_label)
where not exists (
  select 1
  from public.turquesa_ai_decisions existing
  where existing.restaurant_id = r.id
    and existing.title = d.title
);

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
),
shift as (
  select id from public.turquesa_shifts where restaurant_id = (select id from r) and status = 'open' limit 1
)
insert into public.turquesa_ai_events (restaurant_id, shift_id, area, title, summary, severity, risk_score, payload)
select r.id, shift.id, e.area, e.title, e.summary, e.severity, e.risk_score,
       jsonb_build_object('source', 'turquesa-restaurant-core.sql')
from r
join shift on true
cross join (values
  ('inventario', 'Stock critico detectado', 'Langosta bajo minimo operativo.', 'warning', 76),
  ('cocina', 'KDS supervisado', 'Tickets activos monitoreados para cocina y bar.', 'info', 34),
  ('caja', 'Libro del turno generado', 'Asientos iniciales de ventas, ITBIS y servicio creados.', 'success', 22)
) as e(area, title, summary, severity, risk_score)
where not exists (
  select 1
  from public.turquesa_ai_events existing
  where existing.restaurant_id = r.id
    and existing.title = e.title
    and existing.created_at::date = current_date
);

with r as (
  select id from public.turquesa_restaurants where slug = 'turquesa-restaurante'
),
shift as (
  select id from public.turquesa_shifts where restaurant_id = (select id from r) and status = 'open' limit 1
)
insert into public.turquesa_print_jobs (restaurant_id, shift_id, target_station, printer_name, job_type, status, payload)
select r.id, shift.id, p.target_station, p.printer_name, p.job_type, p.status,
       jsonb_build_object('source', 'turquesa-restaurant-core.sql', 'sample', true)
from r
join shift on true
cross join (values
  ('cocina-caliente', 'Despacho Cocina', 'kitchen_ticket', 'queued'),
  ('bar', 'Despacho Bar', 'bar_ticket', 'queued'),
  ('caja', 'Caja Principal', 'receipt', 'queued')
) as p(target_station, printer_name, job_type, status)
where not exists (
  select 1
  from public.turquesa_print_jobs existing
  where existing.restaurant_id = r.id
    and existing.target_station = p.target_station
    and existing.job_type = p.job_type
    and existing.status = p.status
);

select pg_notify('pgrst', 'reload schema');
