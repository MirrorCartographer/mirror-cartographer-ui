create extension if not exists pgcrypto;

create table if not exists public.continuity_records (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  collection text not null,
  title text not null default '',
  content jsonb not null default '{}'::jsonb,
  privacy text not null default 'private' check (privacy in ('private', 'shared', 'public-safe')),
  source text not null default 'website',
  tags text[] not null default '{}',
  search_text text generated always as (
    lower(coalesce(title, '') || ' ' || coalesce(content::text, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, owner_id)
);

create index if not exists continuity_owner_collection_updated_idx
  on public.continuity_records (owner_id, collection, updated_at desc);
create index if not exists continuity_search_idx
  on public.continuity_records using gin (to_tsvector('simple', search_text));
create index if not exists continuity_content_idx
  on public.continuity_records using gin (content jsonb_path_ops);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists continuity_records_touch on public.continuity_records;
create trigger continuity_records_touch
before update on public.continuity_records
for each row execute function public.touch_updated_at();

alter table public.continuity_records enable row level security;

drop policy if exists continuity_owner_select on public.continuity_records;
create policy continuity_owner_select on public.continuity_records
for select using (auth.uid() = owner_id or privacy = 'public-safe');

drop policy if exists continuity_owner_insert on public.continuity_records;
create policy continuity_owner_insert on public.continuity_records
for insert with check (auth.uid() = owner_id);

drop policy if exists continuity_owner_update on public.continuity_records;
create policy continuity_owner_update on public.continuity_records
for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists continuity_owner_delete on public.continuity_records;
create policy continuity_owner_delete on public.continuity_records
for delete using (auth.uid() = owner_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('mirror-cartographer-private', 'mirror-cartographer-private', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists mc_storage_owner_read on storage.objects;
create policy mc_storage_owner_read on storage.objects for select
using (bucket_id = 'mirror-cartographer-private' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists mc_storage_owner_write on storage.objects;
create policy mc_storage_owner_write on storage.objects for insert
with check (bucket_id = 'mirror-cartographer-private' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists mc_storage_owner_delete on storage.objects;
create policy mc_storage_owner_delete on storage.objects for delete
using (bucket_id = 'mirror-cartographer-private' and (storage.foldername(name))[1] = auth.uid()::text);
