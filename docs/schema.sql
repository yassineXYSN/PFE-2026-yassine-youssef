-- NextHire AI — MariaDB / MySQL schema
-- Run once on a fresh nexthire database. Safe to re-run (IF NOT EXISTS guards).

SET NAMES utf8mb4;

-- ── 1. CORE TABLES ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id            CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS companies (
    id            CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    siret         VARCHAR(50),
    address       TEXT,
    city          VARCHAR(100),
    zip_code      VARCHAR(20),
    country       VARCHAR(100),
    email         VARCHAR(255),
    phone         VARCHAR(50),
    website       VARCHAR(255),
    description   TEXT,
    `values`      TEXT,
    benefits      JSON,
    logo_url      TEXT,
    primary_color VARCHAR(20),
    linkedin_url  VARCHAR(255),
    twitter_url   VARCHAR(255),
    created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS departments (
    id             CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    company_id     CHAR(36),
    name           VARCHAR(255) NOT NULL,
    description    TEXT,
    responsible_id CHAR(36),
    color          VARCHAR(20),
    icon           VARCHAR(50),
    created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dept_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS profiles (
    id            CHAR(36)     NOT NULL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    first_name    VARCHAR(100),
    last_name     VARCHAR(100),
    phone         VARCHAR(50),
    role          ENUM('superadmin','admin','recruiter','chef_departement','candidate') DEFAULT 'recruiter',
    status        ENUM('active','pending','inactive') DEFAULT 'pending',
    company_id    CHAR(36),
    department_id CHAR(36),
    avatar_url    TEXT,
    preferences   JSON,
    created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_profile_user    FOREIGN KEY (id)            REFERENCES users(id)        ON DELETE CASCADE,
    CONSTRAINT fk_profile_company FOREIGN KEY (company_id)    REFERENCES companies(id),
    CONSTRAINT fk_profile_dept    FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

ALTER TABLE departments
    ADD CONSTRAINT fk_dept_responsible
    FOREIGN KEY (responsible_id) REFERENCES profiles(id);

CREATE TABLE IF NOT EXISTS jobs (
    id                   CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    company_id           CHAR(36),
    department_id        CHAR(36),
    title                VARCHAR(255) NOT NULL,
    contract_type        ENUM('cdi','cdd','internship','apprenticeship','freelance'),
    location             VARCHAR(255),
    work_mode            ENUM('onsite','hybrid','remote'),
    description_company  TEXT,
    missions             TEXT,
    profile_searched     TEXT,
    experience_level     ENUM('junior','mid','senior','expert'),
    languages            JSON,
    perks                JSON,
    salary_min           DECIMAL(12,2),
    salary_max           DECIMAL(12,2),
    currency             VARCHAR(10)  DEFAULT 'TND',
    pay_frequency        VARCHAR(50),
    filtering_questions  JSON,
    attachments_required JSON,
    notification_email   VARCHAR(255),
    deadline             DATE,
    status               ENUM('draft','published','internal','closed') DEFAULT 'draft',
    platforms            JSON,
    created_at           DATETIME     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_job_company FOREIGN KEY (company_id)    REFERENCES companies(id)   ON DELETE CASCADE,
    CONSTRAINT fk_job_dept    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS candidates (
    id           CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    job_id       CHAR(36),
    first_name   VARCHAR(100),
    last_name    VARCHAR(100),
    email        VARCHAR(255),
    avatar_url   TEXT,
    score_ai     INT          DEFAULT 0,
    match_status VARCHAR(50),
    created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_candidate_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    CHAR(36),
    action     TEXT NOT NULL,
    details    JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS system_settings (
    id         VARCHAR(50) PRIMARY KEY,
    settings   JSON        NOT NULL,
    updated_at DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── 2. SEED ───────────────────────────────────────────────────────────────────
INSERT IGNORE INTO system_settings (id, settings) VALUES (
    'security',
    '{"minPasswordLength":8,"requireComplexPassword":true,"sessionTimeout":30,"require2FA":false,"ipWhitelist":""}'
);
