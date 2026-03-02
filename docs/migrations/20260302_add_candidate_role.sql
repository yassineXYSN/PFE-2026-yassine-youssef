-- Add 'candidate' role to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'candidate';

-- Update handle_new_user trigger to support candidate role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role_val user_role;
BEGIN
  BEGIN
    user_role_val := (new.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    user_role_val := 'recruiter'::user_role;
  END;

  IF user_role_val IS NULL THEN
    user_role_val := 'recruiter'::user_role;
  END IF;

  INSERT INTO public.profiles (id, email, first_name, last_name, role, status)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    user_role_val,
    'pending'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy: Candidates can view their own profile
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Candidates can view own profile'
  ) THEN
    CREATE POLICY "Candidates can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id AND role = 'candidate');
  END IF;
END $$;
