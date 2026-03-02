-- Add 'candidate' value to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'candidate';

-- Update trigger to respect role metadata (defaults to 'recruiter' for HR users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role, status)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    COALESCE(new.raw_user_meta_data->>'role', 'recruiter')::user_role,
    'pending'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow candidates to insert their own profile (needed if trigger doesn't run)
CREATE POLICY IF NOT EXISTS "Candidates can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
