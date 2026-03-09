-- unified_candidate_schema.sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CORE TABLES
-- ============================================================================

-- Candidate Profiles (maps 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.candidat_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  title text,
  birth_date date,
  address text,
  linkedin_url text,
  hobbies jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Candidate Settings
CREATE TABLE IF NOT EXISTS public.candidat_settings (
  candidate_id uuid PRIMARY KEY REFERENCES public.candidat_profiles(id) ON DELETE CASCADE,
  privacy_level text DEFAULT 'public' CHECK (privacy_level IN ('public', 'recruiters_only', 'private')),
  theme text DEFAULT 'system',
  language text DEFAULT 'en',
  date_format text DEFAULT 'DD/MM/YYYY',
  time_format text DEFAULT '24h',
  currency text DEFAULT 'usd',
  notifications_push boolean DEFAULT true,
  notifications_email boolean DEFAULT true,
  notifications_sms boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- Candidate Files (centralized document management for storage buckets)
CREATE TABLE IF NOT EXISTS public.candidat_files (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id uuid NOT NULL REFERENCES public.candidat_profiles(id) ON DELETE CASCADE,
  file_type text NOT NULL CHECK (file_type IN ('cv', 'certificate', 'experience_doc', 'profile_photo')),
  bucket text NOT NULL,
  path text NOT NULL,
  mime_type text,
  size bigint,
  uploaded_at timestamptz DEFAULT now()
);

-- Candidate Skills
CREATE TABLE IF NOT EXISTS public.candidat_skills (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id uuid NOT NULL REFERENCES public.candidat_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  level integer CHECK (level >= 0 AND level <= 100),
  created_at timestamptz DEFAULT now()
);

-- Candidate Languages
CREATE TABLE IF NOT EXISTS public.candidat_languages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id uuid NOT NULL REFERENCES public.candidat_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  level integer CHECK (level >= 0 AND level <= 100),
  created_at timestamptz DEFAULT now()
);

-- Candidate Educations
CREATE TABLE IF NOT EXISTS public.candidat_educations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id uuid NOT NULL REFERENCES public.candidat_profiles(id) ON DELETE CASCADE,
  institution text NOT NULL,
  start_year int,
  end_year int,
  ongoing boolean DEFAULT false,
  social_link text,
  certificate_file_id uuid REFERENCES public.candidat_files(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Candidate Experiences
CREATE TABLE IF NOT EXISTS public.candidat_experiences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id uuid NOT NULL REFERENCES public.candidat_profiles(id) ON DELETE CASCADE,
  company text NOT NULL,
  position text NOT NULL,
  type text CHECK (type IN ('work', 'internship', 'contract', 'freelance')),
  start_date date,
  end_date date,
  ongoing boolean DEFAULT false,
  description text,
  document_file_id uuid REFERENCES public.candidat_files(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Candidate Job Bookmarks
-- NOTE: Assuming the existing jobs table is called "hr-jobs"
CREATE TABLE IF NOT EXISTS public.candidat_job_bookmarks (
  candidate_id uuid NOT NULL REFERENCES public.candidat_profiles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public."hr-jobs"(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (candidate_id, job_id)
);

-- Candidate Applications
-- NOTE: Assuming the existing jobs table is called "hr-jobs"
CREATE TABLE IF NOT EXISTS public.candidat_applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id uuid NOT NULL REFERENCES public.candidat_profiles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public."hr-jobs"(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('applied', 'review', 'interview', 'offer', 'rejected', 'withdrawn')),
  resume_file_id uuid REFERENCES public.candidat_files(id) ON DELETE SET NULL,
  applied_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (candidate_id, job_id)
);

-- Candidate Access/Audit Logs
CREATE TABLE IF NOT EXISTS public.candidat_audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id uuid REFERENCES public.candidat_profiles(id) ON DELETE CASCADE,
  action text NOT NULL, -- e.g., 'login', 'profile_update', 'application_submitted', 'document_uploaded'
  entity_type text,     -- e.g., 'profile', 'application', 'file'
  entity_id uuid,       -- ID of the related record
  ip_address text,
  user_agent text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_candidat_settings_candidate_id ON public.candidat_settings(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidat_files_candidate_id ON public.candidat_files(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidat_skills_candidate_id ON public.candidat_skills(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidat_languages_candidate_id ON public.candidat_languages(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidat_educations_candidate_id ON public.candidat_educations(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidat_experiences_candidate_id ON public.candidat_experiences(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidat_applications_candidate_id ON public.candidat_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidat_applications_job_id ON public.candidat_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_candidat_job_bookmarks_candidate_id ON public.candidat_job_bookmarks(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidat_job_bookmarks_job_id ON public.candidat_job_bookmarks(job_id);
CREATE INDEX IF NOT EXISTS idx_candidat_audit_logs_candidate_id ON public.candidat_audit_logs(candidate_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_candidat_applications_status ON public.candidat_applications(status);
CREATE INDEX IF NOT EXISTS idx_candidat_applications_updated_at ON public.candidat_applications(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidat_audit_logs_created_at ON public.candidat_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidat_audit_logs_action ON public.candidat_audit_logs(action);

-- JSONB GIN Indexes
CREATE INDEX IF NOT EXISTS idx_candidat_profiles_hobbies_gin ON public.candidat_profiles USING gin (hobbies);
CREATE INDEX IF NOT EXISTS idx_candidat_audit_logs_details_gin ON public.candidat_audit_logs USING gin (details);

-- ============================================================================
-- 3. TRIGGERS
-- ============================================================================

-- Function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_candidat_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_candidat_profiles_modtime
BEFORE UPDATE ON public.candidat_profiles
FOR EACH ROW EXECUTE FUNCTION update_candidat_modified_column();

CREATE TRIGGER update_candidat_settings_modtime
BEFORE UPDATE ON public.candidat_settings
FOR EACH ROW EXECUTE FUNCTION update_candidat_modified_column();

CREATE TRIGGER update_candidat_applications_modtime
BEFORE UPDATE ON public.candidat_applications
FOR EACH ROW EXECUTE FUNCTION update_candidat_modified_column();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.candidat_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidat_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidat_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidat_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidat_educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidat_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidat_job_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidat_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidat_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles
CREATE POLICY "Users can view own profile" ON public.candidat_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.candidat_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.candidat_profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.candidat_profiles FOR DELETE USING (auth.uid() = id);

-- 2. Settings
CREATE POLICY "Users can manage own settings" ON public.candidat_settings FOR ALL USING (auth.uid() = candidate_id) WITH CHECK (auth.uid() = candidate_id);

-- 3. Associations (Files, Skills, Languages, Educations, Experiences, Bookmarks)
CREATE POLICY "Manage candidat_files" ON public.candidat_files FOR ALL USING (auth.uid() = candidate_id) WITH CHECK (auth.uid() = candidate_id);
CREATE POLICY "Manage candidat_skills" ON public.candidat_skills FOR ALL USING (auth.uid() = candidate_id) WITH CHECK (auth.uid() = candidate_id);
CREATE POLICY "Manage candidat_languages" ON public.candidat_languages FOR ALL USING (auth.uid() = candidate_id) WITH CHECK (auth.uid() = candidate_id);
CREATE POLICY "Manage candidat_educations" ON public.candidat_educations FOR ALL USING (auth.uid() = candidate_id) WITH CHECK (auth.uid() = candidate_id);
CREATE POLICY "Manage candidat_experiences" ON public.candidat_experiences FOR ALL USING (auth.uid() = candidate_id) WITH CHECK (auth.uid() = candidate_id);
CREATE POLICY "Manage candidat_job_bookmarks" ON public.candidat_job_bookmarks FOR ALL USING (auth.uid() = candidate_id) WITH CHECK (auth.uid() = candidate_id);

-- 4. Applications
CREATE POLICY "Candidates can view own applications" ON public.candidat_applications FOR SELECT USING (auth.uid() = candidate_id AND deleted_at IS NULL);
CREATE POLICY "Candidates can insert applications" ON public.candidat_applications FOR INSERT WITH CHECK (auth.uid() = candidate_id);
CREATE POLICY "Candidates can update own applications" ON public.candidat_applications FOR UPDATE USING (auth.uid() = candidate_id) WITH CHECK (auth.uid() = candidate_id);

-- 5. Audit Logs
CREATE POLICY "Candidates can view own logs" ON public.candidat_audit_logs FOR SELECT USING (auth.uid() = candidate_id);
CREATE POLICY "System can insert logs for candidates" ON public.candidat_audit_logs FOR INSERT WITH CHECK (auth.uid() = candidate_id);
-- Logs should be immutable, so no UPDATE or DELETE policies are provided for regular users
