## Task 1: Database schema — `account_verifications` table

**Files:**
- Modify: `docs/schema.sql`

**Interfaces:**
- Produces: `account_verifications` table with columns `id, email, token, expires_at, used, created_at`, consumed by Task 2's utility functions.

- [ ] **Step 1: Add the table definition**

Append to the end of `docs/schema.sql` (after the existing `password_resets` table, which currently ends the file):

```sql

-- Account activation tokens for admin-created accounts (expire after 7 days)
CREATE TABLE IF NOT EXISTS account_verifications (
    id         CHAR(36)     NOT NULL PRIMARY KEY DEFAULT (UUID()),
    email      VARCHAR(255) NOT NULL,
    token      CHAR(64)     NOT NULL UNIQUE,
    expires_at DATETIME     NOT NULL,
    used       TINYINT(1)   NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_av_token (token),
    INDEX idx_av_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: Apply it to the already-running local MariaDB container**

The container's data volume already exists, so `docker-entrypoint-initdb.d` won't re-run `schema.sql` automatically. Re-run the whole (idempotent, `CREATE TABLE IF NOT EXISTS`) file against the live container directly:

Run: `docker exec -i nexthire-mariadb mysql -u root -prootpass nexthire_auth < docs/schema.sql`
Expected: command exits with no output (no errors). `root`/`rootpass` are the local-dev-only credentials defined in `docker-compose.yml`.

- [ ] **Step 3: Verify the table exists**

Run: `docker exec nexthire-mariadb mysql -u root -prootpass nexthire_auth -e "DESCRIBE account_verifications;"`
Expected: a table listing the 6 columns (`id`, `email`, `token`, `expires_at`, `used`, `created_at`).

- [ ] **Step 4: Commit**

```bash
git add docs/schema.sql
git commit -m "Add account_verifications table for admin-created account activation"
```

---

