-- NextHire AI — PostgreSQL schema (local, no Supabase dependency)
-- Run once on a fresh database. Safe to re-run (IF NOT EXISTS guards).

-- ── 1. EXTENSIONS ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 2. ENUMS ──────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'recruiter', 'chef_departement', 'candidate');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE user_status AS ENUM ('active', 'pending', 'inactive');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE job_status AS ENUM ('draft', 'published', 'internal', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE experience_level AS ENUM ('junior', 'mid', 'senior', 'expert');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE contract_type AS ENUM ('cdi', 'cdd', 'internship', 'apprenticeship', 'freelance');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE work_mode AS ENUM ('onsite', 'hybrid', 'remote');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 3. AUTHENTICATION (replaces Supabase Auth) ────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    email         TEXT        UNIQUE NOT NULL,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 4. CORE TABLES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    name          TEXT        NOT NULL,
    siret         TEXT,
    address       TEXT,
    city          TEXT,
    zip_code      TEXT,
    country       TEXT,
    email         TEXT,
    phone         TEXT,
    website       TEXT,
    description   TEXT,
    values        TEXT,
    benefits      JSONB       DEFAULT '[]',
    logo_url      TEXT,
    primary_color TEXT,
    linkedin_url  TEXT,
    twitter_url   TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departments (
    id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id     UUID        REFERENCES companies(id) ON DELETE CASCADE,
    name           TEXT        NOT NULL,
    description    TEXT,
    responsible_id UUID,       -- FK to profiles.id added below
    color          TEXT,
    icon           TEXT,
    created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
    id            UUID        REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
    email         TEXT        UNIQUE NOT NULL,
    first_name    TEXT,
    last_name     TEXT,
    phone         TEXT,
    role          user_role   DEFAULT 'recruiter',
    status        user_status DEFAULT 'pending',
    company_id    UUID        REFERENCES companies(id),
    department_id UUID        REFERENCES departments(id),
    avatar_url    TEXT,
    preferences   JSONB       DEFAULT '{"theme": "dark", "lang": "fr"}',
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
    ALTER TABLE departments
        ADD CONSTRAINT fk_responsible FOREIGN KEY (responsible_id) REFERENCES profiles(id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS jobs (
    id                   UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id           UUID          REFERENCES companies(id) ON DELETE CASCADE,
    department_id        UUID          REFERENCES departments(id) ON DELETE SET NULL,
    title                TEXT          NOT NULL,
    contract_type        contract_type,
    location             TEXT,
    work_mode            work_mode,
    description_company  TEXT,
    missions             TEXT,
    profile_searched     TEXT,
    experience_level     experience_level,
    languages            JSONB         DEFAULT '[]',
    perks                JSONB         DEFAULT '[]',
    salary_min           NUMERIC,
    salary_max           NUMERIC,
    currency             TEXT          DEFAULT 'TND',
    pay_frequency        TEXT,
    filtering_questions  JSONB         DEFAULT '[]',
    attachments_required JSONB         DEFAULT '["cv"]',
    notification_email   TEXT,
    deadline             DATE,
    status               job_status    DEFAULT 'draft',
    platforms            JSONB         DEFAULT '[]',
    created_at           TIMESTAMPTZ   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidates (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id       UUID        REFERENCES jobs(id) ON DELETE CASCADE,
    first_name   TEXT,
    last_name    TEXT,
    email        TEXT,
    avatar_url   TEXT,
    score_ai     INTEGER     DEFAULT 0,
    match_status TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id         BIGSERIAL   PRIMARY KEY,
    user_id    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    action     TEXT        NOT NULL,
    details    JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
    id         TEXT        PRIMARY KEY,
    settings   JSONB       NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 5. SEED: default security settings ───────────────────────────────────────
INSERT INTO system_settings (id, settings)
VALUES ('security', '{
    "minPasswordLength": 8,
    "requireComplexPassword": true,
    "sessionTimeout": 30,
    "require2FA": false,
    "ipWhitelist": ""
}')
ON CONFLICT (id) DO NOTHING;
