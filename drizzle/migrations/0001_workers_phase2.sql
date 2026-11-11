create type public.worker_status as enum ('active','inactive');

alter table public.companies add column worker_seq integer not null default 0;

-- helper: is the caller owner or manager of a company
create or replace function public.can_manage_workers(_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where company_id = _company and user_id = auth.uid() and role in ('owner','manager'))
$$;

-- workers
create table public.workers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  worker_code text not null,
  full_name text not null,
  mobile text not null,
  alt_mobile text,
  native_state text,
  native_address text,
  kerala_address text,
  emergency_name text,
  emergency_phone text,
  category text,
  joining_date date not null default current_date,
  status public.worker_status not null default 'active',
  notes text,
  photo_path text,
  aadhaar_last4 text not null,
  aadhaar_hash text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, worker_code),
  unique (company_id, aadhaar_hash)
);
create index workers_company_status_idx on public.workers(company_id, status);
grant select on public.workers to authenticated;
grant update (full_name, mobile, alt_mobile, native_state, native_address, kerala_address, emergency_name, emergency_phone, category, joining_date, notes, photo_path) on public.workers to authenticated;
grant all on public.workers to service_role;
alter table public.workers enable row level security;
create policy "members read workers" on public.workers for select to authenticated using (public.is_member(company_id));
create policy "managers edit workers" on public.workers for update to authenticated using (public.can_manage_workers(company_id)) with check (public.can_manage_workers(company_id));

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger workers_touch before update on public.workers for each row execute function public.touch_updated_at();

-- encrypted Aadhaar, owner-only
create table public.worker_aadhaar (
  worker_id uuid primary key references public.workers(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  cipher text not null,
  updated_at timestamptz not null default now()
);
grant select on public.worker_aadhaar to authenticated;
grant all on public.worker_aadhaar to service_role;
alter table public.worker_aadhaar enable row level security;
create policy "owner reads aadhaar" on public.worker_aadhaar for select to authenticated using (public.has_role(company_id,'owner'));

-- daily rate agreements (insert-only)
create table public.commission_agreements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  daily_rate_paise integer not null check (daily_rate_paise > 0),
  effective_from date not null,
  note text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (worker_id, effective_from)
);
grant select, insert on public.commission_agreements to authenticated;
grant all on public.commission_agreements to service_role;
alter table public.commission_agreements enable row level security;
create policy "members read agreements" on public.commission_agreements for select to authenticated using (public.is_member(company_id));
create policy "owner adds agreements" on public.commission_agreements for insert to authenticated
  with check (
    public.has_role(company_id,'owner') and created_by = auth.uid()
    and exists (select 1 from public.workers w where w.id = worker_id and w.company_id = commission_agreements.company_id)
  );

-- status history
create table public.worker_status_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  status public.worker_status not null,
  effective_date date not null,
  reason text,
  changed_by uuid not null,
  changed_at timestamptz not null default now()
);
create index worker_status_history_worker_idx on public.worker_status_history(worker_id, effective_date);
grant select on public.worker_status_history to authenticated;
grant all on public.worker_status_history to service_role;
alter table public.worker_status_history enable row level security;
create policy "members read status history" on public.worker_status_history for select to authenticated using (public.is_member(company_id));

-- documents (Aadhaar copies)
create table public.worker_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  doc_type text not null default 'aadhaar' check (doc_type in ('aadhaar')),
  storage_path text not null,
  file_name text,
  uploaded_by uuid not null default auth.uid(),
  uploaded_at timestamptz not null default now()
);
grant select, insert, delete on public.worker_documents to authenticated;
grant all on public.worker_documents to service_role;
alter table public.worker_documents enable row level security;
create policy "members read documents" on public.worker_documents for select to authenticated using (public.is_member(company_id));
create policy "managers add documents" on public.worker_documents for insert to authenticated
  with check (
    public.can_manage_workers(company_id) and uploaded_by = auth.uid()
    and exists (select 1 from public.workers w where w.id = worker_id and w.company_id = worker_documents.company_id)
  );
create policy "owner deletes documents" on public.worker_documents for delete to authenticated using (public.has_role(company_id,'owner'));

-- audit log
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid not null default auth.uid(),
  entity text not null,
  entity_id uuid,
  action text not null,
  details jsonb,
  at timestamptz not null default now()
);
create index audit_log_company_idx on public.audit_log(company_id, at desc);
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "owner reads audit" on public.audit_log for select to authenticated using (public.has_role(company_id,'owner'));
create policy "members write own audit" on public.audit_log for insert to authenticated
  with check (public.is_member(company_id) and actor_id = auth.uid());

-- create worker atomically: code, aadhaar, first rate, status history
create or replace function public.create_worker(
  _company uuid, _w jsonb, _aadhaar_last4 text, _aadhaar_hash text, _aadhaar_cipher text,
  _rate_paise integer, _rate_from date
) returns uuid language plpgsql security definer set search_path = public as $$
declare seq integer; wid uuid; existing text; jd date;
begin
  if not public.can_manage_workers(_company) then raise exception 'Not allowed'; end if;
  if coalesce(trim(_w->>'full_name'),'') = '' then raise exception 'Name required'; end if;
  if coalesce(trim(_w->>'mobile'),'') = '' then raise exception 'Mobile required'; end if;
  if _aadhaar_last4 !~ '^[0-9]{4}$' or coalesce(_aadhaar_hash,'') = '' or coalesce(_aadhaar_cipher,'') = '' then
    raise exception 'Aadhaar required';
  end if;
  if _rate_paise is null or _rate_paise <= 0 then raise exception 'Daily rate required'; end if;
  select worker_code into existing from public.workers where company_id = _company and aadhaar_hash = _aadhaar_hash;
  if existing is not null then raise exception 'DUPLICATE_AADHAAR:%', existing; end if;

  jd := coalesce(nullif(_w->>'joining_date','')::date, current_date);
  update public.companies set worker_seq = worker_seq + 1 where id = _company returning worker_seq into seq;

  insert into public.workers(company_id, worker_code, full_name, mobile, alt_mobile, native_state, native_address,
    kerala_address, emergency_name, emergency_phone, category, joining_date, notes, aadhaar_last4, aadhaar_hash, created_by)
  values (_company, 'BB-' || lpad(seq::text, 4, '0'), trim(_w->>'full_name'), trim(_w->>'mobile'),
    nullif(trim(_w->>'alt_mobile'),''), nullif(trim(_w->>'native_state'),''), nullif(trim(_w->>'native_address'),''),
    nullif(trim(_w->>'kerala_address'),''), nullif(trim(_w->>'emergency_name'),''), nullif(trim(_w->>'emergency_phone'),''),
    nullif(trim(_w->>'category'),''), jd, nullif(trim(_w->>'notes'),''), _aadhaar_last4, _aadhaar_hash, auth.uid())
  returning id into wid;

  insert into public.worker_aadhaar(worker_id, company_id, cipher) values (wid, _company, _aadhaar_cipher);
  insert into public.commission_agreements(company_id, worker_id, daily_rate_paise, effective_from, created_by, note)
    values (_company, wid, _rate_paise, coalesce(_rate_from, jd), auth.uid(), 'Starting rate');
  insert into public.worker_status_history(company_id, worker_id, status, effective_date, reason, changed_by)
    values (_company, wid, 'active', jd, 'Registered', auth.uid());
  return wid;
end $$;
grant execute on function public.create_worker(uuid, jsonb, text, text, text, integer, date) to authenticated;

-- change Active/Inactive with history
create or replace function public.set_worker_status(_worker uuid, _status public.worker_status, _date date, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid; cur public.worker_status;
begin
  select company_id, status into cid, cur from public.workers where id = _worker;
  if cid is null or not public.can_manage_workers(cid) then raise exception 'Not allowed'; end if;
  if cur = _status then return; end if;
  update public.workers set status = _status where id = _worker;
  insert into public.worker_status_history(company_id, worker_id, status, effective_date, reason, changed_by)
    values (cid, _worker, _status, coalesce(_date, current_date), nullif(trim(_reason),''), auth.uid());
end $$;
grant execute on function public.set_worker_status(uuid, public.worker_status, date, text) to authenticated;

-- correct Aadhaar number (owner only, audited)
create or replace function public.set_worker_aadhaar(_worker uuid, _aadhaar_last4 text, _aadhaar_hash text, _aadhaar_cipher text)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid; existing text;
begin
  select company_id into cid from public.workers where id = _worker;
  if cid is null or not public.has_role(cid,'owner') then raise exception 'Not allowed'; end if;
  if _aadhaar_last4 !~ '^[0-9]{4}$' then raise exception 'Aadhaar required'; end if;
  select worker_code into existing from public.workers where company_id = cid and aadhaar_hash = _aadhaar_hash and id <> _worker;
  if existing is not null then raise exception 'DUPLICATE_AADHAAR:%', existing; end if;
  update public.workers set aadhaar_last4 = _aadhaar_last4, aadhaar_hash = _aadhaar_hash where id = _worker;
  insert into public.worker_aadhaar(worker_id, company_id, cipher) values (_worker, cid, _aadhaar_cipher)
    on conflict (worker_id) do update set cipher = excluded.cipher, updated_at = now();
  insert into public.audit_log(company_id, actor_id, entity, entity_id, action)
    values (cid, auth.uid(), 'worker', _worker, 'aadhaar_changed');
end $$;
grant execute on function public.set_worker_aadhaar(uuid, text, text, text) to authenticated;

-- storage: worker-files/{company_id}/{worker_id}/{photo|aadhaar}/file
create or replace function public.path_company(_name text)
returns uuid language sql immutable set search_path = public as $$
  select case when split_part(_name,'/',1) ~ '^[0-9a-f-]{36}$' then split_part(_name,'/',1)::uuid else null end
$$;

create policy "worker files read" on storage.objects for select to authenticated
  using (
    bucket_id = 'worker-files'
    and public.is_member(public.path_company(name))
    and (split_part(name,'/',3) = 'photo' or public.has_role(public.path_company(name),'owner'))
  );
create policy "worker files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'worker-files' and public.can_manage_workers(public.path_company(name)));
create policy "worker files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'worker-files' and public.has_role(public.path_company(name),'owner'));
