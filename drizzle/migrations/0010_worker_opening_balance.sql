-- 1. Add opening_balance_paise column to workers table
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS opening_balance_paise integer NOT NULL DEFAULT 0;
ALTER TABLE public.workers DROP CONSTRAINT IF EXISTS workers_opening_balance_check;
ALTER TABLE public.workers ADD CONSTRAINT workers_opening_balance_check CHECK (opening_balance_paise >= 0);

-- 2. Grant permissions on opening_balance_paise to authenticated
GRANT SELECT (opening_balance_paise) ON public.workers TO authenticated;
GRANT UPDATE (opening_balance_paise) ON public.workers TO authenticated;

-- 3. Update public.worker_balances view
DROP VIEW IF EXISTS public.worker_balances CASCADE;

CREATE VIEW public.worker_balances WITH (security_invoker = on) AS
SELECT w.id AS worker_id, w.company_id, w.status,
  COALESCE(w.opening_balance_paise, 0)::bigint AS opening_balance_paise,
  COALESCE((SELECT sum(amount_paise) FROM public.commission_entries c WHERE c.worker_id = w.id),0)::bigint AS earned_paise,
  COALESCE((SELECT sum(amount_paise) FROM public.payments p WHERE p.worker_id = w.id AND p.voided_at IS NULL),0)::bigint AS collected_paise,
  COALESCE((SELECT sum(CASE kind WHEN 'debit' THEN -amount_paise ELSE amount_paise END) FROM public.adjustments a WHERE a.worker_id = w.id),0)::bigint AS adjusted_paise,
  COALESCE((SELECT sum(amount_paise) FROM public.advances a WHERE a.worker_id = w.id),0)::bigint
    - COALESCE((SELECT sum(amount_paise) FROM public.advance_repayments r WHERE r.worker_id = w.id),0)::bigint AS advance_balance_paise
FROM public.workers w;

GRANT SELECT ON public.worker_balances TO authenticated;

-- 4. Update worker_outstanding function
CREATE OR REPLACE FUNCTION public.worker_outstanding(_worker uuid)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; result bigint;
BEGIN
  SELECT company_id INTO cid FROM public.workers WHERE id = _worker;
  IF cid IS NULL OR NOT public.is_member(cid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT opening_balance_paise + earned_paise - collected_paise - adjusted_paise INTO result FROM public.worker_balances WHERE worker_id = _worker;
  RETURN result;
END $$;

-- 5. Update create_worker function to support opening_balance_paise
CREATE OR REPLACE FUNCTION public.create_worker(
  _company uuid, _w jsonb, _aadhaar_last4 text, _aadhaar_hash text, _aadhaar_cipher text,
  _rate_paise integer, _rate_from date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE seq integer; wid uuid; existing text; jd date; acc_id uuid; open_bal integer;
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

  jd := coalesce(nullif(_w->>'joining_date','')::date, current_date);
  acc_id := nullif(_w->>'accommodation_id','')::uuid;
  UPDATE public.companies SET worker_seq = worker_seq + 1 WHERE id = _company RETURNING worker_seq INTO seq;

  INSERT INTO public.workers(company_id, worker_code, full_name, mobile, alt_mobile, native_state, native_address,
    kerala_address, emergency_name, emergency_phone, category, joining_date, notes, aadhaar_last4, aadhaar_hash, accommodation_id, opening_balance_paise, created_by)
  VALUES (_company, 'BB-' || lpad(seq::text, 4, '0'), trim(_w->>'full_name'), trim(_w->>'mobile'),
    nullif(trim(_w->>'alt_mobile'),''), nullif(trim(_w->>'native_state'),''), nullif(trim(_w->>'native_address'),''),
    nullif(trim(_w->>'kerala_address'),''), nullif(trim(_w->>'emergency_name'),''), nullif(trim(_w->>'emergency_phone'),''),
    nullif(trim(_w->>'category'),''), jd, nullif(trim(_w->>'notes'),''), _aadhaar_last4, _aadhaar_hash, acc_id, open_bal, auth.uid())
  RETURNING id INTO wid;

  INSERT INTO public.worker_aadhaar(worker_id, company_id, cipher) VALUES (wid, _company, _aadhaar_cipher);
  INSERT INTO public.commission_agreements(company_id, worker_id, daily_rate_paise, effective_from, created_by, note)
    VALUES (_company, wid, _rate_paise, coalesce(_rate_from, jd), auth.uid(), 'Starting rate');
  INSERT INTO public.worker_status_history(company_id, worker_id, status, effective_date, reason, changed_by)
    VALUES (_company, wid, 'active', jd, 'Registered', auth.uid());
  RETURN wid;
END $$;
