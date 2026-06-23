-- Identity layer: stores only auth identity and role/status. All business data lives in MongoDB.

-- users: identity only — no business data
CREATE TABLE IF NOT EXISTS users (
    id            CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- profiles: role + status, links to MongoDB business data by user id
CREATE TABLE IF NOT EXISTS profiles (
    id         CHAR(36)     NOT NULL PRIMARY KEY,
    role       ENUM('candidat','hr','manager','admin','superadmin') NOT NULL DEFAULT 'candidat',
    status     ENUM('pending','active','inactive','suspended')      NOT NULL DEFAULT 'pending',
    first_name VARCHAR(100),
    last_name  VARCHAR(100),
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_profile_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
