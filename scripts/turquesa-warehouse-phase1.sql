-- Turquesa Restaurant OS - Warehouse / Inventory Phase 1
-- Additive migration. Apply after scripts/turquesa-restaurant-core.sql.
-- This file does not rename, drop, or replace existing Turquesa tables.

create extension if not exists pgcrypto;

create table if not exists public.turquesa_storage_locations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  code text not null,
  name text not null,
  kind text not null check (
    kind in (
      'main',
      'kitchen',
      'bar',
      'beach_pool',
      'cleaning',
      'dry_storage',
      'refrigerated',
      'frozen'
    )
  ),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, code)
);

create table if not exists public.turquesa_suppliers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  name text not null,
  rnc text,
  contact_name text,
  phone text,
  email text,
  address text,
  category text check (
    category is null or category in (
      'cocina',
      'bar',
      'playa_piscina',
      'limpieza',
      'secos',
      'congelados',
      'refrigerados'
    )
  ),
  payment_terms text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create table if not exists public.turquesa_inventory_units (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  code text not null,
  name text not null,
  unit_kind text not null check (unit_kind in ('mass', 'volume', 'count')),
  base_unit text not null check (base_unit in ('g', 'kg', 'ml', 'l', 'u')),
  to_base_factor numeric(18,6) not null check (to_base_factor > 0),
  is_package boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, code)
);

create table if not exists public.turquesa_purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  supplier_id uuid references public.turquesa_suppliers(id) on delete set null,
  purchase_request_id uuid references public.turquesa_purchase_requests(id) on delete set null,
  receipt_code text not null,
  invoice_number text,
  document_date date,
  received_at timestamptz not null default now(),
  status text not null default 'draft' check (status in ('draft', 'received', 'void')),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  tax_total numeric(14,2) not null default 0 check (tax_total >= 0),
  discount_total numeric(14,2) not null default 0 check (discount_total >= 0),
  freight_total numeric(14,2) not null default 0 check (freight_total >= 0),
  grand_total numeric(14,2) not null default 0 check (grand_total >= 0),
  received_by_email text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, receipt_code)
);

create table if not exists public.turquesa_purchase_receipt_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  purchase_receipt_id uuid not null references public.turquesa_purchase_receipts(id) on delete cascade,
  inventory_item_id uuid not null references public.turquesa_inventory_items(id) on delete restrict,
  storage_location_id uuid references public.turquesa_storage_locations(id) on delete set null,
  supplier_id uuid references public.turquesa_suppliers(id) on delete set null,
  invoice_number text,
  lot_code text,
  expiration_date date,
  category text not null check (
    category in (
      'cocina',
      'bar',
      'playa_piscina',
      'limpieza',
      'secos',
      'congelados',
      'refrigerados'
    )
  ),
  quantity numeric(14,4) not null check (quantity > 0),
  unit text not null,
  base_quantity numeric(14,4) not null check (base_quantity > 0),
  base_unit text not null check (base_unit in ('g', 'kg', 'ml', 'l', 'u')),
  package_label text,
  package_size_base_quantity numeric(14,4) check (package_size_base_quantity is null or package_size_base_quantity > 0),
  unit_cost numeric(14,4) not null check (unit_cost >= 0),
  total_cost numeric(14,2) not null check (total_cost >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.turquesa_inventory_batches (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  inventory_item_id uuid not null references public.turquesa_inventory_items(id) on delete restrict,
  supplier_id uuid references public.turquesa_suppliers(id) on delete set null,
  purchase_receipt_id uuid references public.turquesa_purchase_receipts(id) on delete set null,
  purchase_receipt_item_id uuid references public.turquesa_purchase_receipt_items(id) on delete set null,
  storage_location_id uuid references public.turquesa_storage_locations(id) on delete set null,
  batch_code text,
  invoice_number text,
  category text not null check (
    category in (
      'cocina',
      'bar',
      'playa_piscina',
      'limpieza',
      'secos',
      'congelados',
      'refrigerados'
    )
  ),
  received_at timestamptz not null default now(),
  expiration_date date,
  quantity_received numeric(14,4) not null check (quantity_received >= 0),
  quantity_remaining numeric(14,4) not null check (quantity_remaining >= 0),
  unit text not null,
  base_quantity_received numeric(14,4) not null check (base_quantity_received >= 0),
  base_quantity_remaining numeric(14,4) not null check (base_quantity_remaining >= 0),
  base_unit text not null check (base_unit in ('g', 'kg', 'ml', 'l', 'u')),
  unit_cost numeric(14,4) not null check (unit_cost >= 0),
  total_cost numeric(14,2) not null default 0 check (total_cost >= 0),
  status text not null default 'active' check (status in ('active', 'depleted', 'expired', 'void')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.turquesa_stock_balances (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  storage_location_id uuid not null references public.turquesa_storage_locations(id) on delete cascade,
  inventory_item_id uuid not null references public.turquesa_inventory_items(id) on delete restrict,
  inventory_batch_id uuid references public.turquesa_inventory_batches(id) on delete set null,
  quantity_on_hand numeric(14,4) not null default 0,
  unit text not null,
  base_quantity_on_hand numeric(14,4) not null default 0,
  base_unit text not null check (base_unit in ('g', 'kg', 'ml', 'l', 'u')),
  avg_cost numeric(14,4) not null default 0 check (avg_cost >= 0),
  last_movement_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists turquesa_stock_balances_batch_uidx
  on public.turquesa_stock_balances (restaurant_id, storage_location_id, inventory_item_id, inventory_batch_id)
  where inventory_batch_id is not null;

create unique index if not exists turquesa_stock_balances_no_batch_uidx
  on public.turquesa_stock_balances (restaurant_id, storage_location_id, inventory_item_id)
  where inventory_batch_id is null;

create table if not exists public.turquesa_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  inventory_item_id uuid not null references public.turquesa_inventory_items(id) on delete restrict,
  inventory_batch_id uuid references public.turquesa_inventory_batches(id) on delete set null,
  source_location_id uuid references public.turquesa_storage_locations(id) on delete set null,
  destination_location_id uuid references public.turquesa_storage_locations(id) on delete set null,
  movement_type text not null check (
    movement_type in (
      'purchase_receipt',
      'transfer_out',
      'transfer_in',
      'pos_consumption',
      'spoilage',
      'production_input',
      'production_output',
      'weekly_count_adjustment',
      'manual_adjustment'
    )
  ),
  quantity numeric(14,4) not null,
  unit text not null,
  base_quantity numeric(14,4) not null,
  base_unit text not null check (base_unit in ('g', 'kg', 'ml', 'l', 'u')),
  unit_cost numeric(14,4) not null default 0 check (unit_cost >= 0),
  total_cost numeric(14,2) not null default 0 check (total_cost >= 0),
  reason text,
  source_type text,
  source_id uuid,
  actor_email text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.turquesa_internal_transfers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  transfer_code text not null,
  source_location_id uuid not null references public.turquesa_storage_locations(id) on delete restrict,
  destination_location_id uuid not null references public.turquesa_storage_locations(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'sent', 'received', 'cancelled')),
  requested_by_email text,
  sent_by_email text,
  received_by_email text,
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  received_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_location_id <> destination_location_id),
  unique (restaurant_id, transfer_code)
);

create table if not exists public.turquesa_internal_transfer_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  transfer_id uuid not null references public.turquesa_internal_transfers(id) on delete cascade,
  inventory_item_id uuid not null references public.turquesa_inventory_items(id) on delete restrict,
  inventory_batch_id uuid references public.turquesa_inventory_batches(id) on delete set null,
  quantity numeric(14,4) not null check (quantity > 0),
  unit text not null,
  base_quantity numeric(14,4) not null check (base_quantity > 0),
  base_unit text not null check (base_unit in ('g', 'kg', 'ml', 'l', 'u')),
  unit_cost numeric(14,4) not null default 0 check (unit_cost >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.turquesa_weekly_inventory_counts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  storage_location_id uuid references public.turquesa_storage_locations(id) on delete set null,
  week_year integer not null check (week_year >= 2020),
  week_number integer not null check (week_number between 1 and 53),
  week_start date not null,
  week_end date not null,
  responsible_email text,
  responsible_name text,
  status text not null default 'abierto' check (status in ('abierto', 'en_revision', 'cerrado')),
  observation text,
  signed_by_email text,
  signed_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (week_end >= week_start)
);

create table if not exists public.turquesa_weekly_inventory_count_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  weekly_count_id uuid not null references public.turquesa_weekly_inventory_counts(id) on delete cascade,
  inventory_item_id uuid not null references public.turquesa_inventory_items(id) on delete restrict,
  inventory_batch_id uuid references public.turquesa_inventory_batches(id) on delete set null,
  storage_location_id uuid references public.turquesa_storage_locations(id) on delete set null,
  physical_quantity numeric(14,4) not null default 0,
  expected_quantity numeric(14,4) not null default 0,
  difference_quantity numeric(14,4) generated always as (physical_quantity - expected_quantity) stored,
  unit text not null,
  unit_cost numeric(14,4) not null default 0 check (unit_cost >= 0),
  difference_cost numeric(14,2) generated always as ((physical_quantity - expected_quantity) * unit_cost) stored,
  observation text,
  evidence_url text,
  confirmed_by_email text,
  confirmed_at timestamptz,
  adjustment_movement_id uuid references public.turquesa_inventory_movements(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.turquesa_internal_productions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  production_code text not null,
  process_type text not null check (
    process_type in (
      'limpieza_camarones',
      'salsa',
      'porcionado_carne',
      'jugo',
      'base_cocina',
      'otro'
    )
  ),
  product_name text not null,
  source_location_id uuid references public.turquesa_storage_locations(id) on delete set null,
  destination_location_id uuid references public.turquesa_storage_locations(id) on delete set null,
  production_date timestamptz not null default now(),
  responsible_email text,
  responsible_name text,
  input_quantity numeric(14,4) not null default 0 check (input_quantity >= 0),
  output_quantity numeric(14,4) not null default 0 check (output_quantity >= 0),
  waste_quantity numeric(14,4) generated always as (input_quantity - output_quantity) stored,
  waste_percent numeric(8,4) generated always as (
    case
      when input_quantity = 0 then 0
      else ((input_quantity - output_quantity) / input_quantity) * 100
    end
  ) stored,
  unit text not null,
  status text not null default 'completed' check (status in ('draft', 'completed', 'void')),
  observation text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (output_quantity <= input_quantity),
  unique (restaurant_id, production_code)
);

create table if not exists public.turquesa_internal_production_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  production_id uuid not null references public.turquesa_internal_productions(id) on delete cascade,
  line_role text not null check (line_role in ('input', 'output', 'waste')),
  inventory_item_id uuid not null references public.turquesa_inventory_items(id) on delete restrict,
  inventory_batch_id uuid references public.turquesa_inventory_batches(id) on delete set null,
  quantity numeric(14,4) not null check (quantity >= 0),
  unit text not null,
  base_quantity numeric(14,4) not null default 0,
  base_unit text not null check (base_unit in ('g', 'kg', 'ml', 'l', 'u')),
  unit_cost numeric(14,4) not null default 0 check (unit_cost >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.turquesa_bar_yield_profiles (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  inventory_item_id uuid not null references public.turquesa_inventory_items(id) on delete restrict,
  menu_item_id uuid references public.turquesa_menu_items(id) on delete set null,
  bottle_volume_ml numeric(14,4) not null check (bottle_volume_ml > 0),
  pour_ml numeric(14,4) not null check (pour_ml > 0),
  expected_servings numeric(14,4) generated always as (bottle_volume_ml / pour_ml) stored,
  loss_allowance_percent numeric(8,4) not null default 0 check (loss_allowance_percent >= 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.turquesa_recipe_versions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  menu_item_id uuid not null references public.turquesa_menu_items(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  yield_quantity numeric(14,4) not null default 1 check (yield_quantity > 0),
  yield_unit text not null default 'u',
  cost_theoretical numeric(14,4) not null default 0 check (cost_theoretical >= 0),
  approved_by_email text,
  approved_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, menu_item_id, version_number)
);

create table if not exists public.turquesa_recipe_version_ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.turquesa_restaurants(id) on delete cascade,
  recipe_version_id uuid not null references public.turquesa_recipe_versions(id) on delete cascade,
  inventory_item_id uuid not null references public.turquesa_inventory_items(id) on delete restrict,
  quantity numeric(14,4) not null check (quantity > 0),
  unit text not null,
  base_quantity numeric(14,4) not null default 0,
  base_unit text not null check (base_unit in ('g', 'kg', 'ml', 'l', 'u')),
  waste_percent numeric(8,4) not null default 0 check (waste_percent >= 0),
  cost_snapshot numeric(14,4) not null default 0 check (cost_snapshot >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_version_id, inventory_item_id)
);

create or replace function public.prevent_turquesa_inventory_movement_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'turquesa_inventory_movements is immutable; create a compensating movement instead';
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'prevent_turquesa_inventory_movement_update'
  ) then
    create trigger prevent_turquesa_inventory_movement_update
    before update or delete on public.turquesa_inventory_movements
    for each row execute function public.prevent_turquesa_inventory_movement_mutation();
  end if;
end $$;

do $$
declare
  table_name text;
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'touch_turquesa_updated_at'
  ) then
    foreach table_name in array array[
      'turquesa_storage_locations',
      'turquesa_suppliers',
      'turquesa_inventory_units',
      'turquesa_purchase_receipts',
      'turquesa_inventory_batches',
      'turquesa_stock_balances',
      'turquesa_internal_transfers',
      'turquesa_weekly_inventory_counts',
      'turquesa_weekly_inventory_count_items',
      'turquesa_internal_productions',
      'turquesa_bar_yield_profiles',
      'turquesa_recipe_versions',
      'turquesa_recipe_version_ingredients'
    ]
    loop
      if not exists (
        select 1
        from pg_trigger
        where tgname = table_name || '_updated_at'
      ) then
        execute format(
          'create trigger %I before update on public.%I for each row execute function public.touch_turquesa_updated_at()',
          table_name || '_updated_at',
          table_name
        );
      end if;
    end loop;
  end if;
end $$;

alter table public.turquesa_storage_locations enable row level security;
alter table public.turquesa_suppliers enable row level security;
alter table public.turquesa_inventory_units enable row level security;
alter table public.turquesa_purchase_receipts enable row level security;
alter table public.turquesa_purchase_receipt_items enable row level security;
alter table public.turquesa_inventory_batches enable row level security;
alter table public.turquesa_stock_balances enable row level security;
alter table public.turquesa_inventory_movements enable row level security;
alter table public.turquesa_internal_transfers enable row level security;
alter table public.turquesa_internal_transfer_items enable row level security;
alter table public.turquesa_weekly_inventory_counts enable row level security;
alter table public.turquesa_weekly_inventory_count_items enable row level security;
alter table public.turquesa_internal_productions enable row level security;
alter table public.turquesa_internal_production_items enable row level security;
alter table public.turquesa_bar_yield_profiles enable row level security;
alter table public.turquesa_recipe_versions enable row level security;
alter table public.turquesa_recipe_version_ingredients enable row level security;

create index if not exists turquesa_storage_locations_restaurant_idx
  on public.turquesa_storage_locations (restaurant_id, is_active, kind);

create index if not exists turquesa_suppliers_restaurant_idx
  on public.turquesa_suppliers (restaurant_id, is_active, category);

create index if not exists turquesa_purchase_receipts_restaurant_idx
  on public.turquesa_purchase_receipts (restaurant_id, received_at desc, status);

create index if not exists turquesa_purchase_receipt_items_receipt_idx
  on public.turquesa_purchase_receipt_items (purchase_receipt_id);

create index if not exists turquesa_inventory_batches_item_idx
  on public.turquesa_inventory_batches (restaurant_id, inventory_item_id, status, expiration_date);

create index if not exists turquesa_stock_balances_lookup_idx
  on public.turquesa_stock_balances (restaurant_id, storage_location_id, inventory_item_id);

create index if not exists turquesa_inventory_movements_lookup_idx
  on public.turquesa_inventory_movements (restaurant_id, inventory_item_id, occurred_at desc);

create index if not exists turquesa_inventory_movements_source_idx
  on public.turquesa_inventory_movements (source_type, source_id);

create index if not exists turquesa_internal_transfers_restaurant_idx
  on public.turquesa_internal_transfers (restaurant_id, requested_at desc, status);

create index if not exists turquesa_weekly_inventory_counts_restaurant_idx
  on public.turquesa_weekly_inventory_counts (restaurant_id, week_year desc, week_number desc, status);

create unique index if not exists turquesa_weekly_inventory_counts_location_uidx
  on public.turquesa_weekly_inventory_counts (restaurant_id, storage_location_id, week_year, week_number)
  where storage_location_id is not null;

create unique index if not exists turquesa_weekly_inventory_counts_all_uidx
  on public.turquesa_weekly_inventory_counts (restaurant_id, week_year, week_number)
  where storage_location_id is null;

create index if not exists turquesa_weekly_inventory_count_items_count_idx
  on public.turquesa_weekly_inventory_count_items (weekly_count_id);

create unique index if not exists turquesa_weekly_inventory_count_items_batch_uidx
  on public.turquesa_weekly_inventory_count_items (weekly_count_id, inventory_item_id, inventory_batch_id)
  where inventory_batch_id is not null;

create unique index if not exists turquesa_weekly_inventory_count_items_no_batch_uidx
  on public.turquesa_weekly_inventory_count_items (weekly_count_id, inventory_item_id)
  where inventory_batch_id is null;

create index if not exists turquesa_internal_productions_restaurant_idx
  on public.turquesa_internal_productions (restaurant_id, production_date desc, process_type);

create index if not exists turquesa_bar_yield_profiles_item_idx
  on public.turquesa_bar_yield_profiles (restaurant_id, inventory_item_id, is_active);

create unique index if not exists turquesa_bar_yield_profiles_menu_uidx
  on public.turquesa_bar_yield_profiles (restaurant_id, inventory_item_id, menu_item_id)
  where menu_item_id is not null;

create unique index if not exists turquesa_bar_yield_profiles_no_menu_uidx
  on public.turquesa_bar_yield_profiles (restaurant_id, inventory_item_id)
  where menu_item_id is null;

create index if not exists turquesa_recipe_versions_menu_idx
  on public.turquesa_recipe_versions (restaurant_id, menu_item_id, status);

create index if not exists turquesa_recipe_version_ingredients_version_idx
  on public.turquesa_recipe_version_ingredients (recipe_version_id);

insert into public.turquesa_storage_locations (restaurant_id, code, name, kind, is_primary)
select
  restaurants.id,
  locations.code,
  locations.name,
  locations.kind,
  locations.is_primary
from public.turquesa_restaurants restaurants
cross join (
  values
    ('MAIN', 'Almacen principal', 'main', true),
    ('COCINA', 'Cocina', 'kitchen', false),
    ('BAR', 'Bar', 'bar', false),
    ('PLAYA', 'Playa/Piscina', 'beach_pool', false),
    ('LIMPIEZA', 'Limpieza', 'cleaning', false),
    ('SECO', 'Almacen seco', 'dry_storage', false),
    ('REFRIGERADO', 'Refrigerado', 'refrigerated', false),
    ('CONGELADO', 'Congelado', 'frozen', false)
) as locations(code, name, kind, is_primary)
on conflict (restaurant_id, code) do nothing;

insert into public.turquesa_inventory_units (
  restaurant_id,
  code,
  name,
  unit_kind,
  base_unit,
  to_base_factor,
  is_package
)
select
  restaurants.id,
  units.code,
  units.name,
  units.unit_kind,
  units.base_unit,
  units.to_base_factor,
  units.is_package
from public.turquesa_restaurants restaurants
cross join (
  values
    ('g', 'Gramo', 'mass', 'g', 1.000000, false),
    ('kg', 'Kilogramo', 'mass', 'g', 1000.000000, false),
    ('lb', 'Libra', 'mass', 'g', 453.592370, false),
    ('ml', 'Mililitro', 'volume', 'ml', 1.000000, false),
    ('l', 'Litro', 'volume', 'ml', 1000.000000, false),
    ('u', 'Unidad', 'count', 'u', 1.000000, false),
    ('caja', 'Caja', 'count', 'u', 1.000000, true),
    ('funda', 'Funda', 'count', 'u', 1.000000, true),
    ('botella', 'Botella', 'volume', 'ml', 1.000000, true),
    ('paquete', 'Paquete', 'count', 'u', 1.000000, true)
) as units(code, name, unit_kind, base_unit, to_base_factor, is_package)
on conflict (restaurant_id, code) do nothing;

comment on table public.turquesa_storage_locations is
  'Logical main warehouse and subwarehouse locations for Turquesa Restaurant inventory.';

comment on table public.turquesa_inventory_movements is
  'Immutable inventory movement ledger. Adjustments must be compensating rows, never edits/deletes.';

comment on table public.turquesa_weekly_inventory_counts is
  'Weekly physical inventory sessions. Turquesa does not use daily or monthly physical counts.';
