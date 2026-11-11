create type public.pay_method as enum ('cash','upi','bank','other');

create or replace function public.can_handle_money(_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where company_id = _company and user_id = auth.uid() and role in ('owner','manager','accountant'))
$$;

create table public.receipt_counters (
  company_id uuid not null references public.companies(id) on delete cascade,
  year integer not null,
  seq integer not null default 0,
  primary key (company_id, year)
);
grant all on public.receipt_counters to service_role;
alter table public.receipt_counters enable row level security;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  paid_on date not null,
  method public.pay_method not null,
  reference text,
  receipt_no text not null,
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text,
  voided_by uuid,
  unique (company_id, receipt_no)
);
create index payments_company_date_idx on public.payments(company_id, paid_on);
create index payments_worker_idx on public.payments(worker_id);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "members read payments" on public.payments for select to authenticated using (public.is_member(company_id));

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  commission_entry_id uuid not null references public.commission_entries(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0)
);
create index alloc_payment_idx on public.payment_allocations(payment_id);
create index alloc_entry_idx on public.payment_allocations(commission_entry_id);
grant select on public.payment_allocations to authenticated;
grant all on public.payment_allocations to service_role;
alter table public.payment_allocations enable row level security;
create policy "members read allocations" on public.payment_allocations for select to authenticated using (public.is_member(company_id));

create table public.advances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  given_on date not null,
  reason text,
  recorded_by uuid not null,
  created_at timestamptz not null default now()
);
create index advances_worker_idx on public.advances(worker_id);
grant select on public.advances to authenticated;
grant all on public.advances to service_role;
alter table public.advances enable row level security;
create policy "members read advances" on public.advances for select to authenticated using (public.is_member(company_id));

create table public.advance_repayments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  paid_on date not null,
  method public.pay_method not null,
  reference text,
  recorded_by uuid not null,
  created_at timestamptz not null default now()
);
create index advance_repay_worker_idx on public.advance_repayments(worker_id);
grant select on public.advance_repayments to authenticated;
grant all on public.advance_repayments to service_role;
alter table public.advance_repayments enable row level security;
create policy "members read advance repayments" on public.advance_repayments for select to authenticated using (public.is_member(company_id));

create table public.adjustments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  kind text not null check (kind in ('waiver','credit','debit')),
  amount_paise integer not null check (amount_paise > 0),
  on_date date not null,
  reason text not null,
  recorded_by uuid not null,
  created_at timestamptz not null default now()
);
create index adjustments_worker_idx on public.adjustments(worker_id);
grant select on public.adjustments to authenticated;
grant all on public.adjustments to service_role;
alter table public.adjustments enable row level security;
create policy "members read adjustments" on public.adjustments for select to authenticated using (public.is_member(company_id));

-- balances per worker (RLS of underlying tables applies)
create view public.worker_balances with (security_invoker = on) as
select w.id as worker_id, w.company_id, w.status,
  coalesce((select sum(amount_paise) from public.commission_entries c where c.worker_id = w.id),0)::bigint as earned_paise,
  coalesce((select sum(amount_paise) from public.payments p where p.worker_id = w.id and p.voided_at is null),0)::bigint as collected_paise,
  coalesce((select sum(case kind when 'debit' then -amount_paise else amount_paise end) from public.adjustments a where a.worker_id = w.id),0)::bigint as adjusted_paise,
  coalesce((select sum(amount_paise) from public.advances a where a.worker_id = w.id),0)::bigint
    - coalesce((select sum(amount_paise) from public.advance_repayments r where r.worker_id = w.id),0)::bigint as advance_balance_paise
from public.workers w;
grant select on public.worker_balances to authenticated;

create or replace function public.worker_outstanding(_worker uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select earned_paise - collected_paise - adjusted_paise from public.worker_balances where worker_id = _worker
$$;

-- a paid commission day cannot be reversed until its payment is voided
create or replace function public.guard_paid_reversal()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.reversed_at is not null and old.reversed_at is null and exists (
    select 1 from public.payment_allocations pa join public.payments p on p.id = pa.payment_id
    where pa.commission_entry_id = new.id and p.voided_at is null) then
    raise exception 'This day is already paid. Void the payment first, then change attendance.';
  end if;
  return new;
end $$;
create trigger commission_guard_paid before update on public.commission_entries for each row execute function public.guard_paid_reversal();

create or replace function public.record_payment(_worker uuid, _amount integer, _paid_on date, _method public.pay_method, _reference text)
returns uuid language plpgsql security definer set search_path = public as $$
declare w record; due bigint; yr integer; n integer; pfx text; pid uuid; left_ integer := _amount; e record; take integer;
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  select * into w from public.workers where id = _worker for update;
  if w.id is null or not public.can_handle_money(w.company_id) then raise exception 'You are not allowed to record payments'; end if;
  if _amount is null or _amount <= 0 then raise exception 'Enter an amount above zero'; end if;
  if _paid_on > today then raise exception 'Payment date cannot be in the future'; end if;
  due := public.worker_outstanding(_worker);
  if _amount > due then raise exception 'Amount is more than the ₹% due', round(due/100.0, 2); end if;

  yr := extract(year from _paid_on)::int;
  insert into public.receipt_counters(company_id, year, seq) values (w.company_id, yr, 1)
    on conflict (company_id, year) do update set seq = public.receipt_counters.seq + 1 returning seq into n;
  select receipt_prefix into pfx from public.companies where id = w.company_id;

  insert into public.payments(company_id, worker_id, amount_paise, paid_on, method, reference, receipt_no, recorded_by)
    values (w.company_id, _worker, _amount, _paid_on, _method, nullif(trim(_reference),''), pfx || '-' || yr || '-' || lpad(n::text, 5, '0'), auth.uid())
    returning id into pid;

  for e in
    select c.id, c.amount_paise - coalesce((select sum(pa.amount_paise) from public.payment_allocations pa join public.payments p on p.id = pa.payment_id
      where pa.commission_entry_id = c.id and p.voided_at is null),0) as unpaid
    from public.commission_entries c
    where c.worker_id = _worker and c.kind = 'earn' and c.reversed_at is null
    order by c.work_date, c.created_at
  loop
    exit when left_ <= 0;
    continue when e.unpaid <= 0;
    take := least(left_, e.unpaid);
    insert into public.payment_allocations(company_id, payment_id, commission_entry_id, amount_paise) values (w.company_id, pid, e.id, take);
    left_ := left_ - take;
  end loop;
  return pid;
end $$;

create or replace function public.void_payment(_payment uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.payments where id = _payment;
  if p.id is null or not public.has_role(p.company_id, 'owner') then raise exception 'Only the owner can void a payment'; end if;
  if p.voided_at is not null then raise exception 'Payment is already void'; end if;
  if coalesce(trim(_reason),'') = '' then raise exception 'A reason is needed'; end if;
  update public.payments set voided_at = now(), void_reason = trim(_reason), voided_by = auth.uid() where id = _payment;
end $$;

create or replace function public.give_advance(_worker uuid, _amount integer, _given_on date, _reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare w record; id_ uuid;
begin
  select * into w from public.workers where id = _worker;
  if w.id is null or not public.can_handle_money(w.company_id) then raise exception 'You are not allowed to record advances'; end if;
  if _amount is null or _amount <= 0 then raise exception 'Enter an amount above zero'; end if;
  if _given_on > (now() at time zone 'Asia/Kolkata')::date then raise exception 'Date cannot be in the future'; end if;
  insert into public.advances(company_id, worker_id, amount_paise, given_on, reason, recorded_by)
    values (w.company_id, _worker, _amount, _given_on, nullif(trim(_reason),''), auth.uid()) returning id into id_;
  return id_;
end $$;

create or replace function public.repay_advance(_worker uuid, _amount integer, _paid_on date, _method public.pay_method, _reference text)
returns uuid language plpgsql security definer set search_path = public as $$
declare w record; bal bigint; id_ uuid;
begin
  select * into w from public.workers where id = _worker for update;
  if w.id is null or not public.can_handle_money(w.company_id) then raise exception 'You are not allowed to record repayments'; end if;
  if _amount is null or _amount <= 0 then raise exception 'Enter an amount above zero'; end if;
  if _paid_on > (now() at time zone 'Asia/Kolkata')::date then raise exception 'Date cannot be in the future'; end if;
  select advance_balance_paise into bal from public.worker_balances where worker_id = _worker;
  if _amount > bal then raise exception 'Amount is more than the ₹% advance balance', round(bal/100.0, 2); end if;
  insert into public.advance_repayments(company_id, worker_id, amount_paise, paid_on, method, reference, recorded_by)
    values (w.company_id, _worker, _amount, _paid_on, _method, nullif(trim(_reference),''), auth.uid()) returning id into id_;
  return id_;
end $$;

create or replace function public.add_adjustment(_worker uuid, _kind text, _amount integer, _on_date date, _reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare w record; id_ uuid;
begin
  select * into w from public.workers where id = _worker for update;
  if w.id is null or not public.has_role(w.company_id, 'owner') then raise exception 'Only the owner can add waivers or adjustments'; end if;
  if _kind not in ('waiver','credit','debit') then raise exception 'Unknown adjustment type'; end if;
  if _amount is null or _amount <= 0 then raise exception 'Enter an amount above zero'; end if;
  if coalesce(trim(_reason),'') = '' then raise exception 'A reason is needed'; end if;
  if _kind in ('waiver','credit') and _amount > public.worker_outstanding(_worker) then raise exception 'Amount is more than what is due'; end if;
  insert into public.adjustments(company_id, worker_id, kind, amount_paise, on_date, reason, recorded_by)
    values (w.company_id, _worker, _kind, _amount, coalesce(_on_date, (now() at time zone 'Asia/Kolkata')::date), trim(_reason), auth.uid()) returning id into id_;
  return id_;
end $$;

revoke execute on function public.record_payment(uuid, integer, date, public.pay_method, text) from public, anon;
revoke execute on function public.void_payment(uuid, text) from public, anon;
revoke execute on function public.give_advance(uuid, integer, date, text) from public, anon;
revoke execute on function public.repay_advance(uuid, integer, date, public.pay_method, text) from public, anon;
revoke execute on function public.add_adjustment(uuid, text, integer, date, text) from public, anon;
revoke execute on function public.worker_outstanding(uuid) from public, anon;
grant execute on function public.record_payment(uuid, integer, date, public.pay_method, text) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;
grant execute on function public.give_advance(uuid, integer, date, text) to authenticated;
grant execute on function public.repay_advance(uuid, integer, date, public.pay_method, text) to authenticated;
grant execute on function public.add_adjustment(uuid, text, integer, date, text) to authenticated;
grant execute on function public.worker_outstanding(uuid) to authenticated;