create table if not exists public.users (
  username text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender text not null references public.users(username) on delete cascade,
  receiver text not null references public.users(username) on delete cascade,
  content text not null check (char_length(content) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.contacts (
  owner text not null references public.users(username) on delete cascade,
  contact text not null references public.users(username) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, contact),
  check (owner <> contact)
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 28),
  created_by text not null references public.users(username) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  username text not null references public.users(username) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, username)
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender text not null references public.users(username) on delete cascade,
  content text not null check (char_length(content) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.messages enable row level security;
alter table public.contacts enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

drop policy if exists "Public users read" on public.users;
drop policy if exists "Public users insert" on public.users;
drop policy if exists "Public users update" on public.users;
drop policy if exists "Public messages read" on public.messages;
drop policy if exists "Public messages insert" on public.messages;
drop policy if exists "Public messages update" on public.messages;
drop policy if exists "Public messages delete" on public.messages;
drop policy if exists "Public contacts read" on public.contacts;
drop policy if exists "Public contacts insert" on public.contacts;
drop policy if exists "Public contacts update" on public.contacts;
drop policy if exists "Public groups read" on public.groups;
drop policy if exists "Public groups insert" on public.groups;
drop policy if exists "Public groups update" on public.groups;
drop policy if exists "Public group members read" on public.group_members;
drop policy if exists "Public group members insert" on public.group_members;
drop policy if exists "Public group members update" on public.group_members;
drop policy if exists "Public group messages read" on public.group_messages;
drop policy if exists "Public group messages insert" on public.group_messages;
drop policy if exists "Public group messages update" on public.group_messages;
drop policy if exists "Public group messages delete" on public.group_messages;

create policy "Public users read"
on public.users for select
to anon
using (true);

create policy "Public users insert"
on public.users for insert
to anon
with check (true);

create policy "Public users update"
on public.users for update
to anon
using (true)
with check (true);

create policy "Public messages read"
on public.messages for select
to anon
using (true);

create policy "Public messages insert"
on public.messages for insert
to anon
with check (true);

create policy "Public messages update"
on public.messages for update
to anon
using (true)
with check (true);

create policy "Public messages delete"
on public.messages for delete
to anon
using (true);

create policy "Public contacts read"
on public.contacts for select
to anon
using (true);

create policy "Public contacts insert"
on public.contacts for insert
to anon
with check (true);

create policy "Public contacts update"
on public.contacts for update
to anon
using (true)
with check (true);

create policy "Public groups read"
on public.groups for select
to anon
using (true);

create policy "Public groups insert"
on public.groups for insert
to anon
with check (true);

create policy "Public groups update"
on public.groups for update
to anon
using (true)
with check (true);

create policy "Public group members read"
on public.group_members for select
to anon
using (true);

create policy "Public group members insert"
on public.group_members for insert
to anon
with check (true);

create policy "Public group members update"
on public.group_members for update
to anon
using (true)
with check (true);

create policy "Public group messages read"
on public.group_messages for select
to anon
using (true);

create policy "Public group messages insert"
on public.group_messages for insert
to anon
with check (true);

create policy "Public group messages update"
on public.group_messages for update
to anon
using (true)
with check (true);

create policy "Public group messages delete"
on public.group_messages for delete
to anon
using (true);

do $$
begin
  alter publication supabase_realtime add table public.users;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.contacts;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.groups;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.group_members;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.group_messages;
exception
  when duplicate_object then null;
end $$;
