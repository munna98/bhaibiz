-- Migration: 0007_membership_company_name.sql
-- Store company_name directly in public.memberships

-- 1. Add company_name column to memberships
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS company_name text;

-- 2. Backfill existing memberships with company names from companies
UPDATE public.memberships m
SET company_name = c.name
FROM public.companies c
WHERE m.company_id = c.id
  AND (m.company_name IS NULL OR m.company_name = '');

-- 3. Trigger to automatically populate company_name on insert/update of memberships if not provided
CREATE OR REPLACE FUNCTION public.sync_membership_company_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_name IS NULL OR trim(NEW.company_name) = '' THEN
    SELECT name INTO NEW.company_name FROM public.companies WHERE id = NEW.company_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_memberships_company_name ON public.memberships;
CREATE TRIGGER trg_memberships_company_name
BEFORE INSERT OR UPDATE OF company_id, company_name ON public.memberships
FOR EACH ROW
EXECUTE FUNCTION public.sync_membership_company_name();

-- 4. Trigger to propagate company name changes to memberships
CREATE OR REPLACE FUNCTION public.sync_company_name_to_memberships()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.memberships
    SET company_name = NEW.name
    WHERE company_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_companies_sync_memberships_name ON public.companies;
CREATE TRIGGER trg_companies_sync_memberships_name
AFTER UPDATE OF name ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.sync_company_name_to_memberships();

-- 5. Update create_company RPC to store company_name on membership creation
CREATE OR REPLACE FUNCTION public.create_company(_name text, _phone text, _address text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF coalesce(trim(_name),'') = '' THEN RAISE EXCEPTION 'Company name required'; END IF;
  INSERT INTO public.companies(name, phone, address, created_by)
  VALUES (trim(_name), _phone, _address, auth.uid())
  RETURNING id INTO cid;

  INSERT INTO public.memberships(company_id, user_id, role, company_name)
  VALUES (cid, auth.uid(), 'owner', trim(_name));

  RETURN cid;
END $$;
GRANT EXECUTE ON FUNCTION public.create_company(text,text,text) TO authenticated;

-- 6. Update accept_my_invites RPC to include company_name
CREATE OR REPLACE FUNCTION public.accept_my_invites()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE em text; n integer;
BEGIN
  SELECT lower(email) INTO em FROM auth.users WHERE id = auth.uid();
  IF em IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.memberships(company_id, user_id, role, company_name)
    SELECT i.company_id, auth.uid(), i.role, c.name
    FROM public.invites i
    JOIN public.companies c ON c.id = i.company_id
    WHERE lower(i.email) = em
    ON CONFLICT (company_id, user_id) DO UPDATE SET
      company_name = EXCLUDED.company_name;
  GET DIAGNOSTICS n = row_count;
  DELETE FROM public.invites WHERE lower(email) = em;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.accept_my_invites() TO authenticated;

-- 7. Update add_team_member RPC to include company_name
CREATE OR REPLACE FUNCTION public.add_team_member(_company uuid, _user uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cname text;
BEGIN
  IF NOT public.has_role(_company, 'owner') THEN
    RAISE EXCEPTION 'Only the owner can add team members';
  END IF;
  IF _role = 'owner' THEN
    RAISE EXCEPTION 'Cannot add another owner';
  END IF;
  SELECT name INTO cname FROM public.companies WHERE id = _company;
  INSERT INTO public.memberships(company_id, user_id, role, company_name)
  VALUES (_company, _user, _role, cname);
END $$;
GRANT EXECUTE ON FUNCTION public.add_team_member(uuid, uuid, public.app_role) TO authenticated;
