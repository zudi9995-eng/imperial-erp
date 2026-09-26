-- ============================================================
-- IMPERIAL PARTNERS ERP -- 001 POYDEVOR
-- Prefiks: ip_   |  Loyiha: davra (lwsdirvewvkworitndrr)
-- ============================================================

-- ---------- ROLLAR ----------
do $$ begin
  create type ip_role_t as enum ('owner','manager','accountant');
exception when duplicate_object then null; end $$;

create table if not exists ip_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text,
  phone         text,
  role          ip_role_t not null default 'manager',
  is_active     boolean not null default true,
  salary        numeric(16,2) not null default 0,
  bonus_pct     numeric(6,3),
  hired_at      date,
  tg_chat_id    bigint unique,
  tg_link_code  text unique,
  tg_linked_at  timestamptz,
  avatar_url    text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- YORDAMCHI FUNKSIYALAR (RLS uchun) ----------
create or replace function ip_role() returns ip_role_t
language sql stable security definer set search_path = public as $$
  select role from ip_profiles where id = auth.uid() and is_active
$$;

create or replace function ip_is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(ip_role() = 'owner', false)
$$;

create or replace function ip_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select ip_role() is not null
$$;

-- ---------- updated_at trigger ----------
create or replace function ip_touch() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create trigger ip_profiles_touch before update on ip_profiles
  for each row execute function ip_touch();

-- ---------- SOZLAMALAR ----------
-- Har sozlama alohida qator. UI shu jadvaldan formani o'zi yasaydi,
-- ya'ni kodga hech qanday raqam qotirilmagan.
create table if not exists ip_settings (
  key          text primary key,
  value        jsonb not null,
  label        text not null,
  hint         text,
  grp          text not null,
  value_type   text not null,
  options      jsonb,
  unit         text,
  sort_order   int not null default 0,
  owner_only   boolean not null default true,
  updated_by   uuid references ip_profiles(id),
  updated_at   timestamptz not null default now()
);
create trigger ip_settings_touch before update on ip_settings
  for each row execute function ip_touch();

-- ---------- AUDIT ----------
create table if not exists ip_audit_log (
  id          bigserial primary key,
  actor_id    uuid references ip_profiles(id),
  action      text not null,
  entity      text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists ip_audit_entity_idx on ip_audit_log(entity, entity_id);
create index if not exists ip_audit_created_idx on ip_audit_log(created_at desc);

-- ============================================================
-- SPRAVOCHNIKLAR -- hammasi UI dan boshqariladi
-- ============================================================

create table if not exists ip_units (
  id         smallserial primary key,
  code       text not null unique,
  name       text not null,
  decimals   smallint not null default 2,
  sort_order int not null default 0
);

create table if not exists ip_categories (
  id             serial primary key,
  parent_id      int references ip_categories(id) on delete set null,
  name           text not null,
  reorder_days   int,
  overstock_days int,
  min_margin_pct numeric(6,3),
  sort_order     int not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists ip_categories_parent_idx on ip_categories(parent_id);

create table if not exists ip_warehouses (
  id         serial primary key,
  code       text not null unique,
  name       text not null,
  address    text,
  is_default boolean not null default false,
  kind       text not null default 'stock',
  is_active  boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists ip_currencies (
  code      text primary key,
  name      text not null,
  symbol    text,
  is_base   boolean not null default false,
  decimals  smallint not null default 2,
  is_active boolean not null default true
);

create table if not exists ip_exchange_rates (
  id         bigserial primary key,
  currency   text not null references ip_currencies(code),
  rate_date  date not null,
  rate       numeric(18,6) not null,
  source     text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (currency, rate_date)
);
create index if not exists ip_rates_date_idx on ip_exchange_rates(rate_date desc);

create table if not exists ip_payment_terms (
  id         serial primary key,
  name       text not null,
  days       int not null default 0,
  is_default boolean not null default false,
  is_active  boolean not null default true,
  sort_order int not null default 0
);

create table if not exists ip_price_tiers (
  id                 serial primary key,
  code               text not null unique,
  name               text not null,
  default_markup_pct numeric(6,3),
  max_discount_pct   numeric(6,3),
  min_margin_pct     numeric(6,3),
  is_default         boolean not null default false,
  is_active          boolean not null default true,
  sort_order         int not null default 0
);

create table if not exists ip_cash_accounts (
  id              serial primary key,
  name            text not null,
  kind            text not null default 'cash',
  currency        text not null default 'UZS' references ip_currencies(code),
  holder          text,
  opening_balance numeric(18,2) not null default 0,
  opening_date    date,
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create table if not exists ip_pipeline_stages (
  id          serial primary key,
  name        text not null,
  probability numeric(5,2) not null default 0,
  is_won      boolean not null default false,
  is_lost     boolean not null default false,
  color       text,
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

create table if not exists ip_expense_categories (
  id         serial primary key,
  name       text not null,
  kind       text not null default 'fixed',
  is_payroll boolean not null default false,
  formula    text,
  is_active  boolean not null default true,
  sort_order int not null default 0
);

create table if not exists ip_loss_reasons (
  id         serial primary key,
  name       text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true
);

-- ============================================================
-- RLS
-- ============================================================
alter table ip_profiles           enable row level security;
alter table ip_settings           enable row level security;
alter table ip_audit_log          enable row level security;
alter table ip_units              enable row level security;
alter table ip_categories         enable row level security;
alter table ip_warehouses         enable row level security;
alter table ip_currencies         enable row level security;
alter table ip_exchange_rates     enable row level security;
alter table ip_payment_terms      enable row level security;
alter table ip_price_tiers        enable row level security;
alter table ip_cash_accounts      enable row level security;
alter table ip_pipeline_stages    enable row level security;
alter table ip_expense_categories enable row level security;
alter table ip_loss_reasons       enable row level security;

-- Profillar
create policy ip_profiles_sel on ip_profiles for select to authenticated
  using (ip_is_staff());
create policy ip_profiles_upd_self on ip_profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from ip_profiles p where p.id = auth.uid()));
create policy ip_profiles_owner_all on ip_profiles for all to authenticated
  using (ip_is_owner()) with check (ip_is_owner());

-- Sozlamalar
create policy ip_settings_sel on ip_settings for select to authenticated
  using (ip_is_staff() and (not owner_only or ip_is_owner()));
create policy ip_settings_wr on ip_settings for all to authenticated
  using (ip_is_owner()) with check (ip_is_owner());

-- Audit
create policy ip_audit_sel on ip_audit_log for select to authenticated using (ip_is_owner());
create policy ip_audit_ins on ip_audit_log for insert to authenticated with check (ip_is_staff());

-- Spravochniklar: hamma o'qiydi, faqat ta'sischi o'zgartiradi
create policy ip_units_sel on ip_units for select to authenticated using (ip_is_staff());
create policy ip_units_wr on ip_units for all to authenticated using (ip_is_owner()) with check (ip_is_owner());

create policy ip_categories_sel on ip_categories for select to authenticated using (ip_is_staff());
create policy ip_categories_wr on ip_categories for all to authenticated using (ip_is_owner()) with check (ip_is_owner());

create policy ip_warehouses_sel on ip_warehouses for select to authenticated using (ip_is_staff());
create policy ip_warehouses_wr on ip_warehouses for all to authenticated using (ip_is_owner()) with check (ip_is_owner());

create policy ip_currencies_sel on ip_currencies for select to authenticated using (ip_is_staff());
create policy ip_currencies_wr on ip_currencies for all to authenticated using (ip_is_owner()) with check (ip_is_owner());

create policy ip_rates_sel on ip_exchange_rates for select to authenticated using (ip_is_staff());
create policy ip_rates_wr on ip_exchange_rates for all to authenticated using (ip_is_owner()) with check (ip_is_owner());

create policy ip_terms_sel on ip_payment_terms for select to authenticated using (ip_is_staff());
create policy ip_terms_wr on ip_payment_terms for all to authenticated using (ip_is_owner()) with check (ip_is_owner());

create policy ip_tiers_sel on ip_price_tiers for select to authenticated using (ip_is_staff());
create policy ip_tiers_wr on ip_price_tiers for all to authenticated using (ip_is_owner()) with check (ip_is_owner());

create policy ip_stages_sel on ip_pipeline_stages for select to authenticated using (ip_is_staff());
create policy ip_stages_wr on ip_pipeline_stages for all to authenticated using (ip_is_owner()) with check (ip_is_owner());

create policy ip_expcat_sel on ip_expense_categories for select to authenticated using (ip_is_staff());
create policy ip_expcat_wr on ip_expense_categories for all to authenticated using (ip_is_owner()) with check (ip_is_owner());

create policy ip_loss_sel on ip_loss_reasons for select to authenticated using (ip_is_staff());
create policy ip_loss_wr on ip_loss_reasons for all to authenticated using (ip_is_owner()) with check (ip_is_owner());

-- Kassa hisoblari: faqat ta'sischi
create policy ip_cash_sel on ip_cash_accounts for select to authenticated using (ip_is_owner());
create policy ip_cash_wr on ip_cash_accounts for all to authenticated using (ip_is_owner()) with check (ip_is_owner());
