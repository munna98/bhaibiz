-- Migration: 0006_staff_username_direct_add.sql
-- Add username column to public.profiles with case-insensitive unique constraint
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles(lower(username)) WHERE username IS NOT NULL;

-- Update handle_new_user trigger to populate username from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, full_name, email, username)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email,
    NULLIF(TRIM(LOWER(new.raw_user_meta_data->>'username')), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    username = COALESCE(public.profiles.username, EXCLUDED.username);
  RETURN new;
END $$;

-- RPC to add team member directly by company owner
CREATE OR REPLACE FUNCTION public.add_team_member(_company uuid, _user uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(_company, 'owner') THEN
    RAISE EXCEPTION 'Only the owner can add team members';
  END IF;
  IF _role = 'owner' THEN
    RAISE EXCEPTION 'Cannot add another owner';
  END IF;
  INSERT INTO public.memberships(company_id, user_id, role)
  VALUES (_company, _user, _role);
END $$;

GRANT EXECUTE ON FUNCTION public.add_team_member(uuid, uuid, public.app_role) TO authenticated;
