-- Migration: 0009_accommodations_and_operator_scoping.sql
-- 1. Accommodations table
CREATE TABLE IF NOT EXISTS public.accommodations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS accommodations_company_idx ON public.accommodations(company_id);
GRANT SELECT ON public.accommodations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.accommodations TO authenticated;
GRANT ALL ON public.accommodations TO service_role;
ALTER TABLE public.accommodations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read accommodations" ON public.accommodations FOR SELECT TO authenticated
  USING (public.is_member(company_id));

CREATE POLICY "managers manage accommodations" ON public.accommodations FOR ALL TO authenticated
  USING (public.can_manage_workers(company_id))
  WITH CHECK (public.can_manage_workers(company_id));

DROP TRIGGER IF EXISTS accommodations_touch ON public.accommodations;
CREATE TRIGGER accommodations_touch BEFORE UPDATE ON public.accommodations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Add accommodation_id to workers
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS accommodation_id uuid REFERENCES public.accommodations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS workers_accommodation_idx ON public.workers(accommodation_id);

GRANT SELECT (accommodation_id) ON public.workers TO authenticated;
GRANT UPDATE (accommodation_id) ON public.workers TO authenticated;

-- 3. Operator accommodations assignment table
CREATE TABLE IF NOT EXISTS public.operator_accommodations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  accommodation_id uuid NOT NULL REFERENCES public.accommodations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, accommodation_id)
);

CREATE INDEX IF NOT EXISTS operator_accommodations_user_idx ON public.operator_accommodations(company_id, user_id);
CREATE INDEX IF NOT EXISTS operator_accommodations_acc_idx ON public.operator_accommodations(accommodation_id);
GRANT SELECT, INSERT, DELETE ON public.operator_accommodations TO authenticated;
GRANT ALL ON public.operator_accommodations TO service_role;
ALTER TABLE public.operator_accommodations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read operator accommodations" ON public.operator_accommodations FOR SELECT TO authenticated
  USING (public.is_member(company_id));

CREATE POLICY "managers manage operator accommodations" ON public.operator_accommodations FOR ALL TO authenticated
  USING (public.can_manage_workers(company_id))
  WITH CHECK (public.can_manage_workers(company_id));

-- 4. Helper function to check operator worker access
CREATE OR REPLACE FUNCTION public.operator_can_access_worker(_worker_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workers w
    JOIN public.operator_accommodations oa ON oa.accommodation_id = w.accommodation_id
    WHERE w.id = _worker_id AND oa.user_id = auth.uid() AND oa.company_id = w.company_id
  );
$$;

-- 5. Update RLS policies to scope operator access
-- Workers
DROP POLICY IF EXISTS "members read workers" ON public.workers;
CREATE POLICY "members read workers" ON public.workers FOR SELECT TO authenticated
  USING (
    public.is_member(company_id) AND (
      NOT public.has_role(company_id, 'operator')
      OR (
        accommodation_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.operator_accommodations oa
          WHERE oa.user_id = auth.uid() AND oa.company_id = workers.company_id AND oa.accommodation_id = workers.accommodation_id
        )
      )
    )
  );

-- Attendance
DROP POLICY IF EXISTS "members read attendance" ON public.attendance;
CREATE POLICY "members read attendance" ON public.attendance FOR SELECT TO authenticated
  USING (
    public.is_member(company_id) AND (
      NOT public.has_role(company_id, 'operator')
      OR public.operator_can_access_worker(worker_id)
    )
  );

-- Attendance history
DROP POLICY IF EXISTS "members read attendance history" ON public.attendance_history;
CREATE POLICY "members read attendance history" ON public.attendance_history FOR SELECT TO authenticated
  USING (
    public.is_member(company_id) AND (
      NOT public.has_role(company_id, 'operator')
      OR EXISTS (
        SELECT 1 FROM public.attendance a
        WHERE a.id = attendance_history.attendance_id AND public.operator_can_access_worker(a.worker_id)
      )
    )
  );

-- Commission entries
DROP POLICY IF EXISTS "members read commission" ON public.commission_entries;
CREATE POLICY "members read commission" ON public.commission_entries FOR SELECT TO authenticated
  USING (
    public.is_member(company_id) AND (
      NOT public.has_role(company_id, 'operator')
      OR public.operator_can_access_worker(worker_id)
    )
  );

-- Payments
DROP POLICY IF EXISTS "members read payments" ON public.payments;
CREATE POLICY "members read payments" ON public.payments FOR SELECT TO authenticated
  USING (
    public.is_member(company_id) AND (
      NOT public.has_role(company_id, 'operator')
      OR public.operator_can_access_worker(worker_id)
    )
  );

-- Payment allocations
DROP POLICY IF EXISTS "members read allocations" ON public.payment_allocations;
CREATE POLICY "members read allocations" ON public.payment_allocations FOR SELECT TO authenticated
  USING (
    public.is_member(company_id) AND (
      NOT public.has_role(company_id, 'operator')
      OR EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.id = payment_allocations.payment_id AND public.operator_can_access_worker(p.worker_id)
      )
    )
  );

-- Worker status history
DROP POLICY IF EXISTS "members read status history" ON public.worker_status_history;
CREATE POLICY "members read status history" ON public.worker_status_history FOR SELECT TO authenticated
  USING (
    public.is_member(company_id) AND (
      NOT public.has_role(company_id, 'operator')
      OR public.operator_can_access_worker(worker_id)
    )
  );

-- 6. Update create_worker to support accommodation_id from jsonb
CREATE OR REPLACE FUNCTION public.create_worker(
  _company uuid, _w jsonb, _aadhaar_last4 text, _aadhaar_hash text, _aadhaar_cipher text,
  _rate_paise integer, _rate_from date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE seq integer; wid uuid; existing text; jd date; acc_id uuid;
BEGIN
  IF NOT public.can_manage_workers(_company) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF coalesce(trim(_w->>'full_name'),'') = '' THEN RAISE EXCEPTION 'Name required'; END IF;
  IF coalesce(trim(_w->>'mobile'),'') = '' THEN RAISE EXCEPTION 'Mobile required'; END IF;
  IF _aadhaar_last4 !~ '^[0-9]{4}$' OR coalesce(_aadhaar_hash,'') = '' OR coalesce(_aadhaar_cipher,'') = '' THEN
    RAISE EXCEPTION 'Aadhaar required';
  END IF;
  IF _rate_paise IS NULL OR _rate_paise <= 0 THEN RAISE EXCEPTION 'Daily rate required'; END IF;
  SELECT worker_code INTO existing FROM public.workers WHERE company_id = _company AND aadhaar_hash = _aadhaar_hash;
  IF existing IS NOT NULL THEN RAISE EXCEPTION 'DUPLICATE_AADHAAR:%', existing; END IF;

  jd := coalesce(nullif(_w->>'joining_date','')::date, current_date);
  acc_id := nullif(_w->>'accommodation_id','')::uuid;
  UPDATE public.companies SET worker_seq = worker_seq + 1 WHERE id = _company RETURNING worker_seq INTO seq;

  INSERT INTO public.workers(company_id, worker_code, full_name, mobile, alt_mobile, native_state, native_address,
    kerala_address, emergency_name, emergency_phone, category, joining_date, notes, aadhaar_last4, aadhaar_hash, accommodation_id, created_by)
  VALUES (_company, 'BB-' || lpad(seq::text, 4, '0'), trim(_w->>'full_name'), trim(_w->>'mobile'),
    nullif(trim(_w->>'alt_mobile'),''), nullif(trim(_w->>'native_state'),''), nullif(trim(_w->>'native_address'),''),
    nullif(trim(_w->>'kerala_address'),''), nullif(trim(_w->>'emergency_name'),''), nullif(trim(_w->>'emergency_phone'),''),
    nullif(trim(_w->>'category'),''), jd, nullif(trim(_w->>'notes'),''), _aadhaar_last4, _aadhaar_hash, acc_id, auth.uid())
  RETURNING id INTO wid;

  INSERT INTO public.worker_aadhaar(worker_id, company_id, cipher) VALUES (wid, _company, _aadhaar_cipher);
  INSERT INTO public.commission_agreements(company_id, worker_id, daily_rate_paise, effective_from, created_by, note)
    VALUES (_company, wid, _rate_paise, coalesce(_rate_from, jd), auth.uid(), 'Starting rate');
  INSERT INTO public.worker_status_history(company_id, worker_id, status, effective_date, reason, changed_by)
    VALUES (_company, wid, 'active', jd, 'Registered', auth.uid());
  RETURN wid;
END $$;

-- 7. Update mark_attendance to verify operator access
CREATE OR REPLACE FUNCTION public.mark_attendance(_worker uuid, _date date, _status public.attendance_status, _reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w record; myrole public.app_role; today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  st public.worker_status; att record; att_id uuid; rate integer; earn_id uuid;
BEGIN
  SELECT * INTO w FROM public.workers WHERE id = _worker;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Worker not found'; END IF;
  SELECT role INTO myrole FROM public.memberships WHERE company_id = w.company_id AND user_id = auth.uid();
  IF myrole IS NULL OR myrole = 'accountant' THEN RAISE EXCEPTION 'You are not allowed to mark attendance'; END IF;
  IF myrole = 'operator' AND NOT public.operator_can_access_worker(_worker) THEN
    RAISE EXCEPTION 'You can only mark attendance for your assigned workers';
  END IF;
  IF _date > today THEN RAISE EXCEPTION 'Cannot mark attendance for a future date'; END IF;
  IF myrole = 'operator' AND _date < today - 1 THEN RAISE EXCEPTION 'Operators can only mark today and yesterday'; END IF;
  IF _date < w.joining_date THEN RAISE EXCEPTION '% joined on %; cannot mark earlier dates', w.full_name, to_char(w.joining_date,'DD-MM-YYYY'); END IF;
  SELECT h.status INTO st FROM public.worker_status_history h WHERE h.worker_id = _worker AND h.effective_date <= _date ORDER BY h.effective_date DESC, h.changed_at DESC LIMIT 1;
  IF coalesce(st, 'active') = 'inactive' THEN RAISE EXCEPTION '% was inactive on %', w.full_name, to_char(_date,'DD-MM-YYYY'); END IF;

  SELECT * INTO att FROM public.attendance WHERE worker_id = _worker AND work_date = _date;
  IF att.id IS NOT NULL AND att.status = _status THEN RETURN att.id; END IF;
  IF att.id IS NOT NULL AND _date < today AND coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'A reason is needed to change past attendance'; END IF;

  IF _status = 'worked' THEN
    SELECT daily_rate_paise INTO rate FROM public.commission_agreements WHERE worker_id = _worker AND effective_from <= _date ORDER BY effective_from DESC LIMIT 1;
    IF rate IS NULL THEN RAISE EXCEPTION 'No daily rate set for % on %', w.full_name, to_char(_date,'DD-MM-YYYY'); END IF;
  END IF;

  IF att.id IS NULL THEN
    INSERT INTO public.attendance(company_id, worker_id, work_date, status, marked_by) VALUES (w.company_id, _worker, _date, _status, auth.uid()) RETURNING id INTO att_id;
  ELSE
    att_id := att.id;
    UPDATE public.attendance SET status = _status, marked_by = auth.uid(), updated_at = now() WHERE id = att_id;
  END IF;
  INSERT INTO public.attendance_history(company_id, attendance_id, old_status, new_status, reason, changed_by)
    VALUES (w.company_id, att_id, att.status, _status, nullif(trim(_reason),''), auth.uid());

  IF _status = 'worked' THEN
    INSERT INTO public.commission_entries(company_id, worker_id, attendance_id, work_date, kind, amount_paise, created_by)
      VALUES (w.company_id, _worker, att_id, _date, 'earn', rate, auth.uid());
  ELSE
    SELECT id, amount_paise INTO earn_id, rate FROM public.commission_entries WHERE attendance_id = att_id AND kind = 'earn' AND reversed_at IS NULL;
    IF earn_id IS NOT NULL THEN
      UPDATE public.commission_entries SET reversed_at = now() WHERE id = earn_id;
      INSERT INTO public.commission_entries(company_id, worker_id, attendance_id, work_date, kind, amount_paise, reverses_id, created_by)
        VALUES (w.company_id, _worker, att_id, _date, 'reversal', -rate, earn_id, auth.uid());
    END IF;
  END IF;
  RETURN att_id;
END $$;

-- 8. Update record_payment to allow operators for assigned workers
CREATE OR REPLACE FUNCTION public.record_payment(_worker uuid, _amount integer, _paid_on date, _method public.pay_method, _reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w record; due bigint; yr integer; n integer; pfx text; pid uuid; left_ integer := _amount; e record; take integer;
  today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  myrole public.app_role;
BEGIN
  SELECT * INTO w FROM public.workers WHERE id = _worker FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Worker not found'; END IF;
  SELECT role INTO myrole FROM public.memberships WHERE company_id = w.company_id AND user_id = auth.uid();
  IF myrole IS NULL THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF myrole = 'operator' THEN
    IF NOT public.operator_can_access_worker(_worker) THEN
      RAISE EXCEPTION 'You can only record payments for your assigned workers';
    END IF;
  ELSIF NOT public.can_handle_money(w.company_id) THEN
    RAISE EXCEPTION 'You are not allowed to record payments';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Enter an amount above zero'; END IF;
  IF _paid_on > today THEN RAISE EXCEPTION 'Payment date cannot be in the future'; END IF;
  due := public.worker_outstanding(_worker);
  IF _amount > due THEN RAISE EXCEPTION 'Amount is more than the ₹% due', round(due/100.0, 2); END IF;

  yr := extract(year FROM _paid_on)::int;
  INSERT INTO public.receipt_counters(company_id, year, seq) VALUES (w.company_id, yr, 1)
    ON CONFLICT (company_id, year) DO UPDATE SET seq = public.receipt_counters.seq + 1 RETURNING seq INTO n;
  SELECT receipt_prefix INTO pfx FROM public.companies WHERE id = w.company_id;

  INSERT INTO public.payments(company_id, worker_id, amount_paise, paid_on, method, reference, receipt_no, recorded_by)
    VALUES (w.company_id, _worker, _amount, _paid_on, _method, nullif(trim(_reference),''), pfx || '-' || yr || '-' || lpad(n::text, 5, '0'), auth.uid())
    RETURNING id INTO pid;

  FOR e IN
    SELECT c.id, c.amount_paise - coalesce((SELECT sum(pa.amount_paise) FROM public.payment_allocations pa JOIN public.payments p ON p.id = pa.payment_id
      WHERE pa.commission_entry_id = c.id AND p.voided_at IS NULL),0) AS unpaid
    FROM public.commission_entries c
    WHERE c.worker_id = _worker AND c.kind = 'earn' AND c.reversed_at IS NULL
    ORDER BY c.work_date, c.created_at
  LOOP
    EXIT WHEN left_ <= 0;
    CONTINUE WHEN e.unpaid <= 0;
    take := least(left_, e.unpaid);
    INSERT INTO public.payment_allocations(company_id, payment_id, commission_entry_id, amount_paise) VALUES (w.company_id, pid, e.id, take);
    left_ := left_ - take;
  END LOOP;
  RETURN pid;
END $$;
