# Task 4 Report: backend/routers/team.py — pending status + activation link for password invites

## Status
DONE

## Changes Implemented

All four changes specified in the task brief have been successfully implemented:

### 1. Added Import
- Added `from utils.verification_tokens import issue_verification_token` at line 9 of `backend/routers/team.py`
- Placed directly after the existing `from utils.email_utils import send_email` line as specified

### 2. MariaDB Profile Status Changed to "pending"
- Modified lines 122-124 to change the status from "active" to "pending" when inserting into the MariaDB profiles table
- Added call to `issue_verification_token(cursor, email.lower().strip())` to generate a verification token within the same transaction
- Token is stored in `verification_token` variable for use in the email

### 3. MongoDB Profile Status Changed to "pending"
- Modified line 151 to change the MongoDB profile's status expression from `"active" if mariadb_user_id else "invited"` to `"pending" if mariadb_user_id else "invited"`
- The "invited" branch for passwordless invites remains untouched as required

### 4. Email Content Updated with Activation Link
- Modified lines 168-177 to include the activation requirement message and verification link
- Added line 168: `verify_link = os.getenv("FRONTEND_URL", "http://localhost:5173") + f"/hr/verify-email?token={verification_token}"`
- Updated email body to include: "Avant de pouvoir vous connecter, vous devez activer votre compte en cliquant sur ce lien (valable 7 jours) :\n\n{verify_link}"
- Kept all existing credential information (email and password) in the email as required

## Verification

### Import Sanity Check
Ran: `cd backend && . ./venv/Scripts/activate && python -c "from main import app; print('ok')"`
Output: `ok` ✓

### Self-Review Checklist
- [x] MariaDB profile status changed from "active" to "pending" only in temp_password branch
- [x] Mongo profile status expression changed from "active" to "pending" while preserving "invited" untouched
- [x] Email content includes activation requirement and verify link with credentials
- [x] else branch (no temp_password) completely untouched

## Files Changed
- `backend/routers/team.py` (8 insertions, 4 deletions)

## Commits Created
- `2bbacfd` - Require email verification for password-based team invites

## Notes
- The verification token is issued within the MariaDB transaction before commit, ensuring atomic operation
- The token is immediately available for use in the email content
- The email maintains the existing French language and structure while adding the new verification requirement
- The activation link uses the FRONTEND_URL environment variable, defaulting to localhost for development
- The "invited" status flow (no password provided) remains completely unmodified
