-- Migration: 0011_worker_monthly_rent.sql

-- 1. Add monthly_rent_paise column to workers table
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS monthly_rent_paise integer NOT NULL DEFAULT 0;
ALTER TABLE public.workers DROP CONSTRAINT IF EXISTS workers_monthly_rent_check;
ALTER TABLE public.workers ADD CONSTRAINT workers_monthly_rent_check CHECK (monthly_rent_paise >= 0);

GRANT SELECT (monthly_rent_paise) ON public.workers TO authenticated;
GRANT UPDATE (monthly_rent_paise) ON public.workers TO authenticated;

-- 2. Add monthly_rent_paise column to accommodations table
ALTER TABLE public.accommodations ADD COLUMN IF NOT EXISTS monthly_rent_paise integer NOT NULL DEFAULT 0;
ALTER TABLE public.accommodations DROP CONSTRAINT IF EXISTS accommodations_monthly_rent_check;
ALTER TABLE public.accommodations ADD CONSTRAINT accommodations_monthly_rent_check CHECK (monthly_rent_paise >= 0);

GRANT SELECT (monthly_rent_paise) ON public.accommodations TO authenticated;
GRANT INSERT (monthly_rent_paise), UPDATE (monthly_rent_paise) ON public.accommodations TO authenticated;

-- 3. Create rent_charges table
CREATE TABLE IF NOT EXISTS public.rent_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  due_date date NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, worker_id, period)
);

CREATE INDEX IF NOT EXISTS rent_charges_company_period_idx ON public.rent_charges(company_id, period);
CREATE INDEX IF NOT EXISTS rent_charges_worker_idx ON public.rent_charges(worker_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rent_charges TO authenticated;
GRANT ALL ON public.rent_charges TO service_role;
ALTER TABLE public.rent_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read rent charges" ON public.rent_charges FOR SELECT TO authenticated
  USING (
    public.is_member(company_id) AND (
      NOT public.has_role(company_id, 'operator')
      OR public.operator_can_access_worker(worker_id)
    )
  );

CREATE POLICY "managers manage rent charges" ON public.rent_charges FOR ALL TO authenticated
  USING (public.can_manage_workers(company_id))
  WITH CHECK (public.can_manage_workers(company_id));

-- 4. Create rent_payments table
CREATE TABLE IF NOT EXISTS public.rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  paid_on date NOT NULL,
  method public.pay_method NOT NULL,
  reference text,
  receipt_no text NOT NULL,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  void_reason text,
  voided_by uuid,
  UNIQUE (company_id, receipt_no)
);

CREATE INDEX IF NOT EXISTS rent_payments_company_date_idx ON public.rent_payments(company_id, paid_on);
CREATE INDEX IF NOT EXISTS rent_payments_worker_idx ON public.rent_payments(worker_id);
GRANT SELECT, INSERT, UPDATE ON public.rent_payments TO authenticated;
GRANT ALL ON public.rent_payments TO service_role;
ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read rent payments" ON public.rent_payments FOR SELECT TO authenticated
  USING (
    public.is_member(company_id) AND (
      NOT public.has_role(company_id, 'operator')
      OR public.operator_can_access_worker(worker_id)
    )
  );

-- 5. Function to automatically compute rent accrued since joining
CREATE OR REPLACE FUNCTION public.worker_auto_rent_charged(_worker_id uuid)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w record;
  m record;
  total bigint := 0;
  cur_period text;
  override_amt integer;
  now_month date := date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata')::date);
  start_month date;
BEGIN
  SELECT id, company_id, status, joining_date, coalesce(monthly_rent_paise, 0) as monthly_rent_paise INTO w
  FROM public.workers WHERE id = _worker_id;

  IF w.id IS NULL THEN RETURN 0; END IF;

  start_month := date_trunc('month', coalesce(w.joining_date, (now() AT TIME ZONE 'Asia/Kolkata')::date));
  IF start_month > now_month THEN
    SELECT coalesce(sum(amount_paise), 0) INTO override_amt
    FROM public.rent_charges WHERE worker_id = _worker_id;
    RETURN coalesce(override_amt, 0);
  END IF;

  FOR m IN
    SELECT generate_series(start_month, now_month, '1 month'::interval)::date AS period_date
  LOOP
    cur_period := to_char(m.period_date, 'YYYY-MM');
    SELECT amount_paise INTO override_amt
    FROM public.rent_charges
    WHERE worker_id = _worker_id AND period = cur_period;

    IF override_amt IS NOT NULL THEN
      total := total + override_amt;
    ELSIF w.monthly_rent_paise > 0 THEN
      total := total + w.monthly_rent_paise;
    END IF;
  END LOOP;

  -- Also add any explicit overrides for periods outside this window (if any)
  SELECT coalesce(sum(amount_paise), 0) INTO override_amt
  FROM public.rent_charges
  WHERE worker_id = _worker_id
    AND (period < to_char(start_month, 'YYYY-MM') OR period > to_char(now_month, 'YYYY-MM'));

  total := total + coalesce(override_amt, 0);

  RETURN total;
END $$;

REVOKE EXECUTE ON FUNCTION public.worker_auto_rent_charged(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.worker_auto_rent_charged(uuid) TO authenticated;

-- Create worker_rent_balances view using automatic rent accrual
DROP VIEW IF EXISTS public.worker_rent_balances CASCADE;

CREATE VIEW public.worker_rent_balances WITH (security_invoker = on) AS
SELECT w.id AS worker_id, w.company_id, w.status, w.monthly_rent_paise,
  public.worker_auto_rent_charged(w.id) AS rent_charged_paise,
  COALESCE((SELECT sum(amount_paise) FROM public.rent_payments rp WHERE rp.worker_id = w.id AND rp.voided_at IS NULL), 0)::bigint AS rent_collected_paise,
  public.worker_auto_rent_charged(w.id)
    - COALESCE((SELECT sum(amount_paise) FROM public.rent_payments rp WHERE rp.worker_id = w.id AND rp.voided_at IS NULL), 0)::bigint AS rent_due_paise
FROM public.workers w;

GRANT SELECT ON public.worker_rent_balances TO authenticated;

-- 6. Update create_worker function to support monthly_rent_paise
CREATE OR REPLACE FUNCTION public.create_worker(
  _company uuid, _w jsonb, _aadhaar_last4 text, _aadhaar_hash text, _aadhaar_cipher text,
  _rate_paise integer, _rate_from date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  seq integer; wid uuid; existing text; jd date; acc_id uuid; open_bal integer; rent_bal integer;
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

  open_bal := coalesce((_w->>'opening_balance_paise')::integer, 0);
  IF open_bal < 0 THEN RAISE EXCEPTION 'Opening balance cannot be negative'; END IF;

  rent_bal := coalesce((_w->>'monthly_rent_paise')::integer, 0);
  IF rent_bal < 0 THEN RAISE EXCEPTION 'Monthly rent cannot be negative'; END IF;

  jd := coalesce(nullif(_w->>'joining_date','')::date, current_date);
  acc_id := nullif(_w->>'accommodation_id','')::uuid;
  UPDATE public.companies SET worker_seq = worker_seq + 1 WHERE id = _company RETURNING worker_seq INTO seq;

  INSERT INTO public.workers(company_id, worker_code, full_name, mobile, alt_mobile, native_state, native_address,
    kerala_address, emergency_name, emergency_phone, category, joining_date, notes, aadhaar_last4, aadhaar_hash, accommodation_id, opening_balance_paise, monthly_rent_paise, created_by)
  VALUES (_company, 'BB-' || lpad(seq::text, 4, '0'), trim(_w->>'full_name'), trim(_w->>'mobile'),
    nullif(trim(_w->>'alt_mobile'),''), nullif(trim(_w->>'native_state'),''), nullif(trim(_w->>'native_address'),''),
    nullif(trim(_w->>'kerala_address'),''), nullif(trim(_w->>'emergency_name'),''), nullif(trim(_w->>'emergency_phone'),''),
    nullif(trim(_w->>'category'),''), jd, nullif(trim(_w->>'notes'),''), _aadhaar_last4, _aadhaar_hash, acc_id, open_bal, rent_bal, auth.uid())
  RETURNING id INTO wid;

  INSERT INTO public.worker_aadhaar(worker_id, company_id, cipher) VALUES (wid, _company, _aadhaar_cipher);
  INSERT INTO public.commission_agreements(company_id, worker_id, daily_rate_paise, effective_from, created_by, note)
    VALUES (_company, wid, _rate_paise, coalesce(_rate_from, jd), auth.uid(), 'Starting rate');
  INSERT INTO public.worker_status_history(company_id, worker_id, status, effective_date, reason, changed_by)
    VALUES (_company, wid, 'active', jd, 'Registered', auth.uid());
  RETURN wid;
END $$;

-- 7. Function: charge_monthly_rent
CREATE OR REPLACE FUNCTION public.charge_monthly_rent(_company uuid, _period text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w record;
  cnt integer := 0;
  first_date date;
BEGIN
  IF NOT public.can_manage_workers(_company) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _period !~ '^\d{4}-\d{2}$' THEN RAISE EXCEPTION 'Invalid period format (YYYY-MM expected)'; END IF;
  first_date := to_date(_period || '-01', 'YYYY-MM-DD');

  FOR w IN
    SELECT id, monthly_rent_paise FROM public.workers
    WHERE company_id = _company AND status = 'active' AND monthly_rent_paise > 0
  LOOP
    INSERT INTO public.rent_charges(company_id, worker_id, period, amount_paise, due_date, notes, created_by)
    VALUES (_company, w.id, _period, w.monthly_rent_paise, first_date, 'Monthly room rent', auth.uid())
    ON CONFLICT (company_id, worker_id, period) DO NOTHING;
    IF FOUND THEN cnt := cnt + 1; END IF;
  END LOOP;

  RETURN cnt;
END $$;

-- 8. Function: charge_worker_rent
CREATE OR REPLACE FUNCTION public.charge_worker_rent(
  _worker uuid, _period text, _amount integer, _due_date date, _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w record;
  rc_id uuid;
  due_d date;
BEGIN
  SELECT * INTO w FROM public.workers WHERE id = _worker;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Worker not found'; END IF;
  IF NOT public.can_manage_workers(w.company_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _period !~ '^\d{4}-\d{2}$' THEN RAISE EXCEPTION 'Invalid period format (YYYY-MM expected)'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Rent amount must be greater than zero'; END IF;
  due_d := coalesce(_due_date, to_date(_period || '-01', 'YYYY-MM-DD'));

  INSERT INTO public.rent_charges(company_id, worker_id, period, amount_paise, due_date, notes, created_by)
  VALUES (w.company_id, _worker, _period, _amount, due_d, nullif(trim(_notes),''), auth.uid())
  ON CONFLICT (company_id, worker_id, period)
  DO UPDATE SET amount_paise = EXCLUDED.amount_paise, due_date = EXCLUDED.due_date, notes = EXCLUDED.notes
  RETURNING id INTO rc_id;

  RETURN rc_id;
END $$;

-- 9. Function: record_rent_payment
CREATE OR REPLACE FUNCTION public.record_rent_payment(
  _worker uuid, _period text, _amount integer, _paid_on date, _method public.pay_method, _reference text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w record;
  myrole public.app_role;
  yr integer;
  n integer;
  pfx text;
  pid uuid;
  today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  SELECT * INTO w FROM public.workers WHERE id = _worker FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Worker not found'; END IF;
  SELECT role INTO myrole FROM public.memberships WHERE company_id = w.company_id AND user_id = auth.uid();
  IF myrole IS NULL THEN RAISE EXCEPTION 'Not allowed'; END IF;

  IF myrole = 'operator' THEN
    IF NOT public.operator_can_access_worker(_worker) THEN
      RAISE EXCEPTION 'You can only record rent collections for your assigned workers';
    END IF;
  ELSIF NOT public.can_handle_money(w.company_id) THEN
    RAISE EXCEPTION 'You are not allowed to record payments';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Enter an amount above zero'; END IF;
  IF _paid_on > today THEN RAISE EXCEPTION 'Payment date cannot be in the future'; END IF;
  IF _period !~ '^\d{4}-\d{2}$' THEN RAISE EXCEPTION 'Invalid period format (YYYY-MM expected)'; END IF;

  yr := extract(year FROM _paid_on)::int;
  INSERT INTO public.receipt_counters(company_id, year, seq) VALUES (w.company_id, yr, 1)
    ON CONFLICT (company_id, year) DO UPDATE SET seq = public.receipt_counters.seq + 1 RETURNING seq INTO n;
  SELECT receipt_prefix INTO pfx FROM public.companies WHERE id = w.company_id;

  INSERT INTO public.rent_payments(company_id, worker_id, period, amount_paise, paid_on, method, reference, receipt_no, recorded_by)
  VALUES (w.company_id, _worker, _period, _amount, _paid_on, _method, nullif(trim(_reference),''), pfx || '-RNT-' || yr || '-' || lpad(n::text, 5, '0'), auth.uid())
  RETURNING id INTO pid;

  RETURN pid;
END $$;

-- 10. Function: void_rent_payment
CREATE OR REPLACE FUNCTION public.void_rent_payment(_payment uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  SELECT * INTO p FROM public.rent_payments WHERE id = _payment;
  IF p.id IS NULL OR NOT public.has_role(p.company_id, 'owner') THEN RAISE EXCEPTION 'Only the owner can void a rent payment'; END IF;
  IF p.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Rent payment is already void'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'A reason is needed'; END IF;
  UPDATE public.rent_payments SET voided_at = now(), void_reason = trim(_reason), voided_by = auth.uid() WHERE id = _payment;
END $$;

REVOKE EXECUTE ON FUNCTION public.charge_monthly_rent(uuid, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.charge_worker_rent(uuid, text, integer, date, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.record_rent_payment(uuid, text, integer, date, public.pay_method, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.void_rent_payment(uuid, text) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.charge_monthly_rent(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.charge_worker_rent(uuid, text, integer, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_rent_payment(uuid, text, integer, date, public.pay_method, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_rent_payment(uuid, text) TO authenticated;
