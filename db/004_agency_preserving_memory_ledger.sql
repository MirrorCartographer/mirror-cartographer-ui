-- Agency-Preserving Memory Ledger.
-- Every durable item is owner-scoped, source-labelled, inspectable, revisable and deletable.
create table if not exists public.memory_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  memory_class text not null check (memory_class in ('user-stated','user-approved','system-inferred','session-local','public-safe-abstraction')),
  source_scope text not null check (source_scope in ('user-stated','user-approved','system-inferred','research-derived','public-safe-abstraction')),
  retention_class text not null check (retention_class in ('discard','session-local','private-durable','public-safe')),
  content jsonb not null default '{}'::jsonb,
  source_pointer text,
  source_summary text not null default '',
  confidence text not null default 'unknown' check (confidence in ('direct','high','medium','low','unknown')),
  sensitivity_class text not null default 'private' check (sensitivity_class in ('low','medium','high','restricted')),
  claim_status text not null default 'observed' check (claim_status in ('observed','measured','reported','derived','inferred','hypothesized','interpreted','fact','interpretation','hypothesis','design-pattern','needs-review','contradicted','superseded','unresolved','unknown')),
  allowed_uses text[] not null default '{}',
  prohibited_uses text[] not null default '{}',
  reason_for_retention text not null default '',
  expiration_or_review_date timestamptz,
  redaction_notes text not null default '',
  user_visible boolean not null default true,
  user_editable boolean not null default true,
  last_user_reviewed_at timestamptz,
  derived_from_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_ledger_private_is_reviewable check (
    retention_class <> 'private-durable' or (user_visible = true and user_editable = true)
  ),
  constraint memory_ledger_public_is_abstract check (
    retention_class <> 'public-safe'
    or (source_scope = 'public-safe-abstraction' and sensitivity_class = 'low')
  ),
  constraint memory_ledger_unique_source unique (owner_id, source_key)
);

create index if not exists memory_ledger_owner_updated_idx
  on public.memory_ledger(owner_id, updated_at desc);
create index if not exists memory_ledger_owner_class_idx
  on public.memory_ledger(owner_id, memory_class, retention_class);
create index if not exists memory_ledger_review_idx
  on public.memory_ledger(owner_id, expiration_or_review_date)
  where retention_class = 'private-durable';
create index if not exists memory_ledger_content_idx
  on public.memory_ledger using gin(content jsonb_path_ops);

create or replace function public.touch_memory_ledger_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memory_ledger_touch on public.memory_ledger;
create trigger memory_ledger_touch
before update on public.memory_ledger
for each row execute function public.touch_memory_ledger_updated_at();

alter table public.memory_ledger enable row level security;
drop policy if exists memory_ledger_owner_select on public.memory_ledger;
create policy memory_ledger_owner_select on public.memory_ledger
for select using (auth.uid() = owner_id);
drop policy if exists memory_ledger_owner_insert on public.memory_ledger;
create policy memory_ledger_owner_insert on public.memory_ledger
for insert with check (auth.uid() = owner_id);
drop policy if exists memory_ledger_owner_update on public.memory_ledger;
create policy memory_ledger_owner_update on public.memory_ledger
for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists memory_ledger_owner_delete on public.memory_ledger;
create policy memory_ledger_owner_delete on public.memory_ledger
for delete using (auth.uid() = owner_id);
