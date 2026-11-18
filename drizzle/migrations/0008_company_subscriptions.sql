-- Migration: 0008_company_subscriptions.sql
-- Add 14-day trial and 1-year annual activation subscription columns to public.companies

-- 1. Add subscription columns to companies
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_notes text;

-- 2. Backfill existing companies: trial ends 14 days after creation
UPDATE public.companies 
SET trial_ends_at = created_at + interval '14 days' 
WHERE trial_ends_at IS NULL;

-- 3. Update create_company RPC to initialize trial_ends_at
CREATE OR REPLACE FUNCTION public.create_company(_name text, _phone text, _address text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF coalesce(trim(_name),'') = '' THEN RAISE EXCEPTION 'Company name required'; END IF;
  INSERT INTO public.companies(name, phone, address, created_by, trial_ends_at)
  VALUES (trim(_name), _phone, _address, auth.uid(), now() + interval '14 days')
  RETURNING id INTO cid;

  INSERT INTO public.memberships(company_id, user_id, role, company_name)
  VALUES (cid, auth.uid(), 'owner', trim(_name));

  RETURN cid;
END $$;
GRANT EXECUTE ON FUNCTION public.create_company(text,text,text) TO authenticated;
