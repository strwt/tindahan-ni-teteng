-- Optional normalized schema (use this if you want separate entity tables)
-- Keep using schema.sql if you prefer the current single-table JSON model.

create table if not exists public.taxi_rent_records (
    id bigint primary key,
    room_name text not null,
    renter_name text not null,
    record_date date not null,
    period text not null check (period in ('daily', 'weekly', 'monthly')),
    rent_amount numeric(12,2) not null default 0,
    paid_amount numeric(12,2) not null default 0,
    excepted boolean not null default false,
    except_note text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.taxi_rent_payments (
    id text primary key,
    rent_record_id bigint not null references public.taxi_rent_records(id) on delete cascade,
    payment_date date not null,
    amount numeric(12,2) not null default 0,
    note text not null default '',
    created_at timestamptz not null default now()
);

create table if not exists public.room_rent_records (
    id bigint primary key,
    room_name text not null,
    renter_name text not null,
    record_date date not null,
    period text not null check (period in ('weekly', 'monthly')),
    rent_amount numeric(12,2) not null default 0,
    paid_amount numeric(12,2) not null default 0,
    excepted boolean not null default false,
    except_note text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.room_rent_payments (
    id text primary key,
    rent_record_id bigint not null references public.room_rent_records(id) on delete cascade,
    payment_date date not null,
    amount numeric(12,2) not null default 0,
    note text not null default '',
    created_at timestamptz not null default now()
);

create table if not exists public.borrow_records (
    id bigint primary key,
    borrower text not null,
    record_date date not null,
    amount numeric(12,2) not null default 0,
    interest_rate numeric(8,2) not null default 0,
    installment_months integer not null default 0,
    due_date date,
    total_with_interest numeric(12,2) not null default 0,
    status text not null check (status in ('pending', 'paid')),
    paid_amount numeric(12,2) not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.borrow_payments (
    id text primary key,
    borrow_record_id bigint not null references public.borrow_records(id) on delete cascade,
    payment_date date not null,
    amount numeric(12,2) not null default 0,
    note text not null default '',
    created_at timestamptz not null default now()
);

create table if not exists public.expense_records (
    id bigint primary key,
    name text not null,
    category text not null,
    record_date date not null,
    amount numeric(12,2) not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.sales_records (
    id bigint primary key,
    sales numeric(12,2) not null default 0,
    status text not null check (status in ('Daily', 'Weekly', 'Monthly')),
    record_date date not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at_entities()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists taxi_rent_records_touch_updated_at on public.taxi_rent_records;
create trigger taxi_rent_records_touch_updated_at
before update on public.taxi_rent_records
for each row execute function public.touch_updated_at_entities();

drop trigger if exists room_rent_records_touch_updated_at on public.room_rent_records;
create trigger room_rent_records_touch_updated_at
before update on public.room_rent_records
for each row execute function public.touch_updated_at_entities();

drop trigger if exists borrow_records_touch_updated_at on public.borrow_records;
create trigger borrow_records_touch_updated_at
before update on public.borrow_records
for each row execute function public.touch_updated_at_entities();

drop trigger if exists expense_records_touch_updated_at on public.expense_records;
create trigger expense_records_touch_updated_at
before update on public.expense_records
for each row execute function public.touch_updated_at_entities();

drop trigger if exists sales_records_touch_updated_at on public.sales_records;
create trigger sales_records_touch_updated_at
before update on public.sales_records
for each row execute function public.touch_updated_at_entities();

create index if not exists idx_taxi_rent_records_renter_name on public.taxi_rent_records(renter_name);
create index if not exists idx_room_rent_records_renter_name on public.room_rent_records(renter_name);
create index if not exists idx_borrow_records_borrower on public.borrow_records(borrower);
create index if not exists idx_taxi_rent_payments_record on public.taxi_rent_payments(rent_record_id);
create index if not exists idx_room_rent_payments_record on public.room_rent_payments(rent_record_id);
create index if not exists idx_borrow_payments_record on public.borrow_payments(borrow_record_id);

-- Service-role-only default (same approach as schema.sql)
-- For backend-only access, we disable RLS since the service role key controls access
alter table public.taxi_rent_records disable row level security;
alter table public.taxi_rent_payments disable row level security;
alter table public.room_rent_records disable row level security;
alter table public.room_rent_payments disable row level security;
alter table public.borrow_records disable row level security;
alter table public.borrow_payments disable row level security;
alter table public.expense_records disable row level security;
alter table public.sales_records disable row level security;
