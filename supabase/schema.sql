create table if not exists public.app_collections (
    name text primary key,
    payload jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists app_collections_touch_updated_at on public.app_collections;
create trigger app_collections_touch_updated_at
before update on public.app_collections
for each row execute function public.touch_updated_at();

alter table public.app_collections enable row level security;

drop policy if exists "deny_all_client_reads" on public.app_collections;
create policy "deny_all_client_reads"
on public.app_collections
for select
to public
using (false);

drop policy if exists "deny_all_client_writes" on public.app_collections;
create policy "deny_all_client_writes"
on public.app_collections
for all
to public
using (false)
with check (false);
