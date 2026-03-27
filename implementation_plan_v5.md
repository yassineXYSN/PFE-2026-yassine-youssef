# Backend Fix & Redesign V5 (Minimalist)

## Proposed Changes

### [Backend]
- **[MODIFY] [applications.py](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/routers/applications.py)**: Swap `get_db()` (sync) for `get_async_db()` (motor) and correctly `await` all DB operations.
- **[MODIFY] [notifications.py (utils)](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/utils/notifications.py)**: Ensure it handles potential connection timeouts gracefully.

### [Frontend]
- **[MODIFY] [Notifications.jsx](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/frontend/src/apps/Candidat/Dashboard/Notifications/Notifications.jsx)**: Implement "Linear Minimalist" V5.
- **[MODIFY] [Notifications.css](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/frontend/src/apps/Candidat/Dashboard/Notifications/Notifications.css)**: New clean CSS with high-contrast, subtle borders, and precise spacing.

## Verification Plan
- Check console for 401/CORS errors after fixing routers.
- Verify `my-applications` grid loads correctly.
- Review V5 design with the user.
