create type public.attendance_status as enum ('worked','not_worked');

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  work_date date not null,
  status public.attendance_status not null,
  marked_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (worker_id, work_date)
);
create index attendance_company_date_idx on public.attendance(company_id, work_date);
grant select on public.attendance to authenticated;
grant all on public.attendance to service_role;
alter table public.attendance enable row level security;
create policy "members read attendance" on public.attendance for select to authenticated using (public.is_member(company_id));

create table public.attendance_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  old_status public.attendance_status,
  new_status public.attendance_status not null,
  reason text,
  changed_by uuid not null,
  changed_at timestamptz not null default now()
);
create index attendance_history_att_idx on public.attendance_history(attendance_id);
grant select on public.attendance_history to authenticated;
grant all on public.attendance_history to service_role;
alter table public.attendance_history enable row level security;
create policy "members read attendance history" on public.attendance_history for select to authenticated using (public.is_member(company_id));

create table public.commission_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  work_date date not null,
  kind text not null check (kind in ('earn','reversal')),
  amount_paise integer not null,
  reverses_id uuid references public.commission_entries(id),
  reversed_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create unique index commission_one_active_per_attendance on public.commission_entries(attendance_id) where kind = 'earn' and reversed_at is null;
create index commission_company_date_idx on public.commission_entries(company_id, work_date);
create index commission_worker_idx on public.commission_entries(worker_id, work_date);
grant select on public.commission_entries to authenticated;
grant all on public.commission_entries to service_role;
alter table public.commission_entries enable row level security;
create policy "members read commission" on public.commission_entries for select to authenticated using (public.is_member(company_id));

-- internal: mark one worker for one date (permission checks included)
create or replace function public.mark_attendance(_worker uuid, _date date, _status public.attendance_status, _reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  w record; myrole public.app_role; today date := (now() at time zone 'Asia/Kolkata')::date;
  st public.worker_status; att record; att_id uuid; rate integer; earn_id uuid;
begin
  select * into w from public.workers where id = _worker;
  if w.id is null then raise exception 'Worker not found'; end if;
  select role into myrole from public.memberships where company_id = w.company_id and user_id = auth.uid();
  if myrole is null or myrole = 'accountant' then raise exception 'You are not allowed to mark attendance'; end if;
  if _date > today then raise exception 'Cannot mark attendance for a future date'; end if;
  if myrole = 'operator' and _date < today - 1 then raise exception 'Operators can only mark today and yesterday'; end if;
  if _date < w.joining_date then raise exception '% joined on %; cannot mark earlier dates', w.full_name, to_char(w.joining_date,'DD-MM-YYYY'); end if;
  select h.status into st from public.worker_status_history h where h.worker_id = _worker and h.effective_date <= _date order by h.effective_date desc, h.changed_at desc limit 1;
  if coalesce(st, 'active') = 'inactive' then raise exception '% was inactive on %', w.full_name, to_char(_date,'DD-MM-YYYY'); end if;

  select * into att from public.attendance where worker_id = _worker and work_date = _date;
  if att.id is not null and att.status = _status then return att.id; end if;
  if att.id is not null and _date < today and coalesce(trim(_reason),'') = '' then raise exception 'A reason is needed to change past attendance'; end if;

  if _status = 'worked' then
    select daily_rate_paise into rate from public.commission_agreements where worker_id = _worker and effective_from <= _date order by effective_from desc limit 1;
    if rate is null then raise exception 'No daily rate set for % on %', w.full_name, to_char(_date,'DD-MM-YYYY'); end if;
  end if;

  if att.id is null then
    insert into public.attendance(company_id, worker_id, work_date, status, marked_by) values (w.company_id, _worker, _date, _status, auth.uid()) returning id into att_id;
  else
    att_id := att.id;
    update public.attendance set status = _status, marked_by = auth.uid(), updated_at = now() where id = att_id;
  end if;
  insert into public.attendance_history(company_id, attendance_id, old_status, new_status, reason, changed_by)
    values (w.company_id, att_id, att.status, _status, nullif(trim(_reason),''), auth.uid());

  if _status = 'worked' then
    insert into public.commission_entries(company_id, worker_id, attendance_id, work_date, kind, amount_paise, created_by)
      values (w.company_id, _worker, att_id, _date, 'earn', rate, auth.uid());
  else
    select id, amount_paise into earn_id, rate from public.commission_entries where attendance_id = att_id and kind = 'earn' and reversed_at is null;
    if earn_id is not null then
      update public.commission_entries set reversed_at = now() where id = earn_id;
      insert into public.commission_entries(company_id, worker_id, attendance_id, work_date, kind, amount_paise, reverses_id, created_by)
        values (w.company_id, _worker, att_id, _date, 'reversal', -rate, earn_id, auth.uid());
    end if;
  end if;
  return att_id;
end $$;
revoke execute on function public.mark_attendance(uuid, date, public.attendance_status, text) from public, anon;
grant execute on function public.mark_attendance(uuid, date, public.attendance_status, text) to authenticated;

-- bulk: marks only workers with no row yet for that date; returns count marked
create or replace function public.mark_attendance_bulk(_workers uuid[], _date date, _status public.attendance_status)
returns integer language plpgsql security definer set search_path = public as $$
declare wid uuid; n integer := 0;
begin
  foreach wid in array _workers loop
    if not exists (select 1 from public.attendance where worker_id = wid and work_date = _date) then
      perform public.mark_attendance(wid, _date, _status, null);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.mark_attendance_bulk(uuid[], date, public.attendance_status) from public, anon;
grant execute on function public.mark_attendance_bulk(uuid[], date, public.attendance_status) to authenticated;