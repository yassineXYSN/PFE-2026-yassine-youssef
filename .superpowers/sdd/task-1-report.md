# Task 1 Report: Database schema — `account_verifications` table

## Status: DONE

## Implementation Summary

Successfully added the `account_verifications` table to `docs/schema.sql` and applied it to the running MariaDB container.

## What Was Implemented

### Step 1: Table Definition
Added the `account_verifications` table to the end of `docs/schema.sql` (after the `password_resets` table), with the exact specification from the task brief:

- **Columns:** `id`, `email`, `token`, `expires_at`, `used`, `created_at`
- **Primary Key:** `id` (UUID)
- **Unique Constraint:** `token` (CHAR(64))
- **Indexes:** `idx_av_token` (token), `idx_av_email` (email)
- **Engine & Charset:** InnoDB, utf8mb4 (matches existing tables)
- **Idempotent:** Uses `CREATE TABLE IF NOT EXISTS`

### Step 2: Applied to Live Container
Successfully executed the schema file against the running `nexthire-mariadb` container:
```bash
docker exec -i nexthire-mariadb mariadb -u root -prootpass nexthire_auth < docs/schema.sql
```
Result: Command completed with no errors (no output).

### Step 3: Verification
Verified table structure with `DESCRIBE account_verifications;`:

```
Field       Type           Null  Key   Default              Extra
id          char(36)       NO    PRI   uuid()               
email       varchar(255)   NO    MUL   NULL                 
token       char(64)       NO    UNI   NULL                 
expires_at  datetime       NO          NULL                 
used        tinyint(1)     NO          0                    
created_at  datetime       NO          current_timestamp()  
```

All 6 expected columns present with correct types and defaults.

Verified indexes with `SHOW INDEX FROM account_verifications;`:
- PRIMARY KEY on `id`
- UNIQUE constraint on `token`
- Index `idx_av_token` on `token`
- Index `idx_av_email` on `email`

All indexes present and correct.

### Step 4: Committed
```bash
git add docs/schema.sql
git commit -m "Add account_verifications table for admin-created account activation"
```
Commit SHA: `a3e09fd`

## Files Changed

- `docs/schema.sql` - Added 12 lines (lines 34-44): table definition with comment

## Self-Review Findings

✅ Table definition matches task brief exactly (6 columns, all correct types)
✅ SQL is idempotent (`CREATE TABLE IF NOT EXISTS`)
✅ Table styling matches existing `password_resets` table (ENGINE, CHARSET, column conventions)
✅ All indexes created correctly
✅ Applied successfully to live MariaDB container
✅ Verification shows all expected columns and indexes
✅ Committed with correct message

No issues found. Implementation is complete and verified.

## Acceptance Criteria Met

- [x] Table definition added to `docs/schema.sql`
- [x] Applied to running MariaDB container without errors
- [x] Verified table exists with 6 columns as specified
- [x] Committed to branch with appropriate message
