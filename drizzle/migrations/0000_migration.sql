create type public.app_role as enum ('owner','manager','operator','accountant');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  receipt_prefix text not null default 'RCPT',
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select, update on public.companies to authenticated;
grant all on public.companies to service_role;
alter table public.companies enable row level security;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
grant select, update, delete on public.memberships to authenticated;
grant all on public.memberships to service_role;
alter table public.memberships enable row level security;

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role public.app_role not null,
  invited_by uuid not null,
  created_at timestamptz not null default now(),
  unique (company_id, email)
);
grant select, insert, delete on public.invites to authenticated;
grant all on public.invites to service_role;
alter table public.invites enable row level security;

create or replace function public.is_member(_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where company_id = _company and user_id = auth.uid())
$$;

create or replace function public.has_role(_company uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where company_id = _company and user_id = auth.uid() and role = _role)
$$;

create or replace function public.shares_company(_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships a join public.memberships b on a.company_id = b.company_id
    where a.user_id = auth.uid() and b.user_id = _user)
$$;

-- profiles
create policy "own or teammate profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_company(id));
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid());

-- companies
create policy "members read company" on public.companies for select to authenticated using (public.is_member(id));
create policy "owner updates company" on public.companies for update to authenticated using (public.has_role(id,'owner'));

-- memberships
create policy "members read memberships" on public.memberships for select to authenticated using (public.is_member(company_id));
create policy "owner updates memberships" on public.memberships for update to authenticated
  using (public.has_role(company_id,'owner') and user_id <> auth.uid());
create policy "owner removes memberships" on public.memberships for delete to authenticated
  using (public.has_role(company_id,'owner') and user_id <> auth.uid());

-- invites
create policy "owner reads invites" on public.invites for select to authenticated using (public.has_role(company_id,'owner'));
create policy "owner creates invites" on public.invites for insert to authenticated
  with check (public.has_role(company_id,'owner') and invited_by = auth.uid() and role <> 'owner');
create policy "owner deletes invites" on public.invites for delete to authenticated using (public.has_role(company_id,'owner'));

-- create company + owner membership
create or replace function public.create_company(_name text, _phone text, _address text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if coalesce(trim(_name),'') = '' then raise exception 'Company name required'; end if;
  insert into public.companies(name, phone, address, created_by) values (trim(_name), _phone, _address, auth.uid()) returning id into cid;
  insert into public.memberships(company_id, user_id, role) values (cid, auth.uid(), 'owner');
  return cid;
end $$;
grant execute on function public.create_company(text,text,text) to authenticated;

-- accept pending invites for current user email
create or replace function public.accept_my_invites()
returns integer language plpgsql security definer set search_path = public as $$
declare em text; n integer;
begin
  select lower(email) into em from auth.users where id = auth.uid();
  if em is null then return 0; end if;
  insert into public.memberships(company_id, user_id, role)
    select company_id, auth.uid(), role from public.invites where lower(email) = em
    on conflict (company_id, user_id) do nothing;
  get diagnostics n = row_count;
  delete from public.invites where lower(email) = em;
  return n;
end $$;
grant execute on function public.accept_my_invites() to authenticated;

-- profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.email)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- prevent removing the last owner / changing owner role via update
create or replace function public.guard_membership_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.role = 'owner' and old.role <> 'owner' then
    raise exception 'Cannot promote to owner';
  end if;
  return new;
end $$;
create trigger memberships_guard before update on public.memberships
  for each row execute function public.guard_membership_role();