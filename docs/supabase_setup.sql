
-- 1. ENUMS & TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'recruiter', 'chef_departement');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'pending', 'inactive');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('draft', 'published', 'internal', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE experience_level AS ENUM ('junior', 'mid', 'senior', 'expert');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE contract_type AS ENUM ('cdi', 'cdd', 'internship', 'apprenticeship', 'freelance');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE work_mode AS ENUM ('onsite', 'hybrid', 'remote');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. CORE TABLES --

-- Companies
CREATE TABLE IF NOT EXISTS public.companies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    siret text,
    address text,
    city text,
    zip_code text,
    country text,
    email text,
    phone text,
    website text,
    description text,
    values text,
    benefits jsonb DEFAULT '[]'::jsonb,
    logo_url text,
    primary_color text,
    linkedin_url text,
    twitter_url text,
    created_at timestamptz DEFAULT now()
);

-- Departments
CREATE TABLE IF NOT EXISTS public.departments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    responsible_id uuid, -- Link to profiles.id later
    color text,
    icon text,
    created_at timestamptz DEFAULT now()
);

-- Profiles (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email text UNIQUE NOT NULL,
    first_name text,
    last_name text,
    phone text,
    role user_role DEFAULT 'recruiter',
    status user_status DEFAULT 'pending',
    company_id uuid REFERENCES public.companies(id),
    department_id uuid REFERENCES public.departments(id),
    avatar_url text,
    preferences jsonb DEFAULT '{"theme": "dark", "lang": "fr"}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add missing Foreign Key for departments.responsible_id
ALTER TABLE public.departments 
ADD CONSTRAINT fk_responsible 
FOREIGN KEY (responsible_id) REFERENCES public.profiles(id);

-- Jobs
CREATE TABLE IF NOT EXISTS public.jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
    title text NOT NULL,
    contract_type contract_type,
    location text,
    work_mode work_mode,
    description_company text,
    missions text,
    profile_searched text,
    experience_level experience_level,
    languages jsonb DEFAULT '[]'::jsonb,
    perks jsonb DEFAULT '[]'::jsonb,
    salary_min numeric,
    salary_max numeric,
    currency text DEFAULT 'TND',
    pay_frequency text,
    filtering_questions jsonb DEFAULT '[]'::jsonb,
    attachments_required jsonb DEFAULT '["cv"]'::jsonb,
    notification_email text,
    deadline date,
    status job_status DEFAULT 'draft',
    platforms jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Candidates
CREATE TABLE IF NOT EXISTS public.candidates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
    first_name text,
    last_name text,
    email text,
    avatar_url text,
    score_ai integer DEFAULT 0,
    match_status text,
    created_at timestamptz DEFAULT now()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id bigserial PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    action text NOT NULL,
    details jsonb,
    created_at timestamptz DEFAULT now()
);

-- 3. TRIGGER: AUTO-CREATE PROFILE --
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role, status)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'first_name', 
    new.raw_user_meta_data->>'last_name',
    'recruiter', 
    'pending'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger creation (only if it doesn't exist)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
    END IF;
END $$;

-- 4. ROW LEVEL SECURITY (Initial Settings) --
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Profiles Policy
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Jobs Policy (Public can see published jobs, recruiters see their own company jobs)
CREATE POLICY "Anyone can view published jobs" ON public.jobs FOR SELECT USING (status = 'published');
CREATE POLICY "Recruiters can view company jobs" ON public.jobs FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.company_id = jobs.company_id)
);
