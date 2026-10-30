create extension if not exists pgcrypto;

create sequence if not exists public.customer_number_seq;
create sequence if not exists public.order_number_seq;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'admin' check (role = 'admin'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_shop_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin' and is_active
  );
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_number text not null unique,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  mobile_number text not null unique check (mobile_number ~ '^\+?[0-9 ()-]{8,16}$'),
  alternate_number text check (alternate_number is null or alternate_number ~ '^\+?[0-9 ()-]{8,16}$'),
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create or replace function public.assign_customer_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.customer_number is null or new.customer_number = '' then
    new.customer_number := 'CUS-' || lpad(nextval('public.customer_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

alter table public.customers alter column customer_number set default '';
drop trigger if exists customers_assign_number on public.customers;
create trigger customers_assign_number
before insert on public.customers
for each row execute function public.assign_customer_number();

create table if not exists public.measurement_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  garment_type text not null check (length(trim(garment_type)) between 1 and 60),
  unit text not null check (unit in ('in', 'cm')),
  measurements jsonb not null default '{}'::jsonb check (jsonb_typeof(measurements) = 'object'),
  fit_type text,
  notes text,
  measured_at date not null default current_date,
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, garment_type)
);

create table if not exists public.measurement_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.measurement_profiles(id) on delete restrict,
  version integer not null check (version > 0),
  unit text not null check (unit in ('in', 'cm')),
  measurements jsonb not null check (jsonb_typeof(measurements) = 'object'),
  fit_type text,
  notes text,
  measured_at date not null,
  created_at timestamptz not null default now(),
  unique (profile_id, version)
);

create table if not exists public.measurement_values (
  id uuid primary key default gen_random_uuid(),
  measurement_version_id uuid not null references public.measurement_versions(id) on delete restrict,
  field_name text not null check (length(trim(field_name)) between 1 and 80),
  value numeric(8, 2) not null check (value >= 0),
  unique (measurement_version_id, field_name)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default '',
  customer_id uuid not null references public.customers(id) on delete restrict,
  order_date date not null default current_date,
  expected_delivery_date date not null,
  status text not null default 'New' check (status in ('New', 'Cutting', 'Stitching', 'Trial', 'Ready', 'Delivered', 'Cancelled')),
  special_instructions text,
  notes text,
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  advance_amount numeric(12, 2) not null default 0 check (advance_amount >= 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expected_delivery_date >= order_date)
);

create or replace function public.generate_order_number()
returns text
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select 'RK-' || to_char(current_date, 'YYMM') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

alter table public.orders alter column order_number set default public.generate_order_number();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  garment_type text not null check (length(trim(garment_type)) between 1 and 60),
  quantity integer not null check (quantity > 0),
  stitching_charge numeric(12, 2) not null check (stitching_charge >= 0),
  measurement_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(measurement_snapshot) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  previous_status text check (previous_status is null or previous_status in ('New', 'Cutting', 'Stitching', 'Trial', 'Ready', 'Delivered', 'Cancelled')),
  new_status text not null check (new_status in ('New', 'Cutting', 'Stitching', 'Trial', 'Ready', 'Delivered', 'Cancelled')),
  changed_by uuid not null default auth.uid() references auth.users(id),
  changed_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null check (method in ('Cash', 'UPI', 'Card', 'Other')),
  reference text,
  paid_at timestamptz not null default now(),
  recorded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists customers_name_idx on public.customers using gin (to_tsvector('simple', full_name));
create index if not exists customers_mobile_idx on public.customers (mobile_number);
create unique index if not exists customers_mobile_normalized_idx
  on public.customers (regexp_replace(mobile_number, '[^0-9+]', '', 'g'));
create index if not exists measurement_profiles_customer_garment_idx on public.measurement_profiles (customer_id, garment_type);
create index if not exists measurement_versions_profile_date_idx on public.measurement_versions (profile_id, measured_at desc);
create index if not exists orders_customer_date_idx on public.orders (customer_id, order_date desc);
create index if not exists orders_status_delivery_idx on public.orders (status, expected_delivery_date);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_status_history_order_date_idx on public.order_status_history (order_id, changed_at desc);
create index if not exists payments_order_date_idx on public.payments (order_id, paid_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at before update on public.customers for each row execute function public.touch_updated_at();
drop trigger if exists measurement_profiles_touch_updated_at on public.measurement_profiles;
create trigger measurement_profiles_touch_updated_at before update on public.measurement_profiles for each row execute function public.touch_updated_at();
drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders for each row execute function public.touch_updated_at();

create or replace function public.save_measurement_version(
  p_customer_id uuid,
  p_garment_type text,
  p_unit text,
  p_measurements jsonb,
  p_fit_type text,
  p_notes text,
  p_measured_at date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid;
  v_version integer;
  v_key text;
  v_value text;
begin
  if not public.is_shop_admin() then
    raise exception 'Shop administrator access required' using errcode = '42501';
  end if;
  if p_unit not in ('in', 'cm') or jsonb_typeof(p_measurements) <> 'object' then
    raise exception 'Invalid measurement unit or payload';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id and archived_at is null) then
    raise exception 'Customer not found or archived';
  end if;
  if exists (
    select 1 from jsonb_each_text(p_measurements) e
    where e.value !~ '^[0-9]+([.][0-9]{1,2})?$' or e.value::numeric < 0
  ) then
    raise exception 'Measurements must be non-negative numeric values';
  end if;

  insert into public.measurement_profiles (customer_id, garment_type, unit, measurements, fit_type, notes, measured_at, version)
  values (p_customer_id, trim(p_garment_type), p_unit, p_measurements, p_fit_type, p_notes, p_measured_at, 0)
  on conflict (customer_id, garment_type) do nothing;
  select id, version + 1 into v_profile_id, v_version
  from public.measurement_profiles
  where customer_id = p_customer_id and garment_type = trim(p_garment_type)
  for update;

  update public.measurement_profiles
  set unit = p_unit, measurements = p_measurements, fit_type = p_fit_type, notes = p_notes,
      measured_at = p_measured_at, version = v_version
  where id = v_profile_id;

  insert into public.measurement_versions (profile_id, version, unit, measurements, fit_type, notes, measured_at)
  values (v_profile_id, v_version, p_unit, p_measurements, p_fit_type, p_notes, p_measured_at);

  for v_key, v_value in select key, value from jsonb_each_text(p_measurements)
  loop
    insert into public.measurement_values (measurement_version_id, field_name, value)
    select id, v_key, v_value::numeric
    from public.measurement_versions where profile_id = v_profile_id and version = v_version;
  end loop;
  return v_profile_id;
end;
$$;

create or replace function public.create_stitching_order(
  p_customer_id uuid,
  p_order_date date,
  p_expected_delivery_date date,
  p_discount numeric,
  p_advance_amount numeric,
  p_advance_method text,
  p_special_instructions text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_subtotal numeric(12, 2);
  v_total numeric(12, 2);
  v_item jsonb;
begin
  if not public.is_shop_admin() then
    raise exception 'Shop administrator access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id and archived_at is null) then
    raise exception 'Customer not found or archived';
  end if;
  if p_expected_delivery_date < p_order_date or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Invalid delivery date or empty order items';
  end if;
  if p_discount < 0 or p_advance_amount < 0 or p_advance_method not in ('Cash', 'UPI', 'Card', 'Other') then
    raise exception 'Invalid discount, advance or payment method';
  end if;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce((v_item->>'quantity')::integer, 0) <= 0
       or coalesce((v_item->>'stitching_charge')::numeric, -1) < 0
       or length(trim(coalesce(v_item->>'garment_type', ''))) = 0
       or jsonb_typeof(coalesce(v_item->'measurement_snapshot', '{}'::jsonb)) <> 'object' then
      raise exception 'Invalid garment item';
    end if;
  end loop;

  select round(coalesce(sum((item->>'quantity')::integer * (item->>'stitching_charge')::numeric), 0), 2)
  into v_subtotal from jsonb_array_elements(p_items) item;
  if p_discount > v_subtotal then
    raise exception 'Discount cannot exceed order subtotal';
  end if;
  v_total := v_subtotal - p_discount;
  if p_advance_amount > v_total then
    raise exception 'Advance cannot exceed order total';
  end if;

  insert into public.orders (
    customer_id, order_date, expected_delivery_date, discount, total_amount, advance_amount,
    special_instructions, notes
  ) values (
    p_customer_id, p_order_date, p_expected_delivery_date, p_discount, v_total, p_advance_amount,
    nullif(trim(p_special_instructions), ''), nullif(trim(p_notes), '')
  ) returning id into v_order_id;

  insert into public.order_items (order_id, garment_type, quantity, stitching_charge, measurement_snapshot)
  select v_order_id, trim(item->>'garment_type'), (item->>'quantity')::integer,
         (item->>'stitching_charge')::numeric, coalesce(item->'measurement_snapshot', '{}'::jsonb)
  from jsonb_array_elements(p_items) item;

  insert into public.order_status_history (order_id, previous_status, new_status)
  values (v_order_id, null, 'New');

  if p_advance_amount > 0 then
    insert into public.payments (order_id, amount, method, reference)
    values (v_order_id, p_advance_amount, p_advance_method, 'Advance payment');
  end if;
  return v_order_id;
end;
$$;

create or replace function public.record_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total numeric(12, 2);
  v_paid numeric(12, 2);
  v_payment_id uuid;
begin
  if not public.is_shop_admin() then
    raise exception 'Shop administrator access required' using errcode = '42501';
  end if;
  if p_amount <= 0 or p_method not in ('Cash', 'UPI', 'Card', 'Other') then
    raise exception 'Payment amount or method is invalid';
  end if;
  select total_amount into v_total from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments where order_id = p_order_id;
  if v_paid + p_amount > v_total then
    raise exception 'Payment exceeds the outstanding order balance';
  end if;
  insert into public.payments (order_id, amount, method, reference)
  values (p_order_id, p_amount, p_method, nullif(trim(p_reference), ''))
  returning id into v_payment_id;
  return v_payment_id;
end;
$$;

create or replace function public.update_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous text;
begin
  if not public.is_shop_admin() then
    raise exception 'Shop administrator access required' using errcode = '42501';
  end if;
  if p_status not in ('New', 'Cutting', 'Stitching', 'Trial', 'Ready', 'Delivered', 'Cancelled') then
    raise exception 'Invalid order status';
  end if;
  select status into v_previous from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_previous = p_status then return; end if;
  update public.orders set status = p_status where id = p_order_id;
  insert into public.order_status_history (order_id, previous_status, new_status)
  values (p_order_id, v_previous, p_status);
end;
$$;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.measurement_profiles enable row level security;
alter table public.measurement_versions enable row level security;
alter table public.measurement_values enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;

drop policy if exists "Admins can view own profile" on public.profiles;
create policy "Admins can view own profile" on public.profiles
  for select to authenticated using (user_id = auth.uid() and public.is_shop_admin());

drop policy if exists "Shop admins can manage customers" on public.customers;
create policy "Shop admins can manage customers" on public.customers
  for all to authenticated using (public.is_shop_admin()) with check (public.is_shop_admin());

drop policy if exists "Shop admins can view measurement profiles" on public.measurement_profiles;
create policy "Shop admins can view measurement profiles" on public.measurement_profiles
  for select to authenticated using (public.is_shop_admin());
drop policy if exists "Shop admins can view measurement versions" on public.measurement_versions;
create policy "Shop admins can view measurement versions" on public.measurement_versions
  for select to authenticated using (public.is_shop_admin());
drop policy if exists "Shop admins can view measurement values" on public.measurement_values;
create policy "Shop admins can view measurement values" on public.measurement_values
  for select to authenticated using (public.is_shop_admin());

drop policy if exists "Shop admins can view orders" on public.orders;
create policy "Shop admins can view orders" on public.orders
  for select to authenticated using (public.is_shop_admin());
drop policy if exists "Shop admins can view order items" on public.order_items;
create policy "Shop admins can view order items" on public.order_items
  for select to authenticated using (public.is_shop_admin());
drop policy if exists "Shop admins can view status history" on public.order_status_history;
create policy "Shop admins can view status history" on public.order_status_history
  for select to authenticated using (public.is_shop_admin());
drop policy if exists "Shop admins can view payments" on public.payments;
create policy "Shop admins can view payments" on public.payments
  for select to authenticated using (public.is_shop_admin());

grant usage on schema public to authenticated;
grant select on public.profiles, public.customers, public.measurement_profiles,
  public.measurement_versions, public.measurement_values, public.orders,
  public.order_items, public.order_status_history, public.payments to authenticated;
grant insert, update on public.customers to authenticated;
grant execute on function public.is_shop_admin() to authenticated;
grant execute on function public.save_measurement_version(uuid, text, text, jsonb, text, text, date) to authenticated;
grant execute on function public.create_stitching_order(uuid, date, date, numeric, numeric, text, text, text, jsonb) to authenticated;
grant execute on function public.record_order_payment(uuid, numeric, text, text) to authenticated;
grant execute on function public.update_order_status(uuid, text) to authenticated;

revoke all on table public.profiles, public.customers, public.measurement_profiles,
  public.measurement_versions, public.measurement_values, public.orders,
  public.order_items, public.order_status_history, public.payments from public, anon;
revoke all on sequence public.customer_number_seq, public.order_number_seq from public, anon, authenticated;
revoke all on function public.is_shop_admin() from public, anon;
revoke all on function public.save_measurement_version(uuid, text, text, jsonb, text, text, date) from public, anon;
revoke all on function public.create_stitching_order(uuid, date, date, numeric, numeric, text, text, text, jsonb) from public, anon;
revoke all on function public.record_order_payment(uuid, numeric, text, text) from public, anon;
revoke all on function public.update_order_status(uuid, text) from public, anon;
revoke all on function public.generate_order_number() from public, anon, authenticated;
revoke all on function public.assign_customer_number() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
