# Walkthrough - Reset Application Feature

I have added a "Reset Application" feature to help with testing the end-to-end recruitment flow.

## Accomplishments

### 1. Backend Reset Endpoint
- Added `POST /applications/{application_id}/reset` in `applications.py`.
- **What it does**:
    - Reverts status to `new`.
    - Wipes all AI Match scores and justifications.
    - Resets Quiz status, scores, and AI performance analysis.
    - **Deletes associated quizzes** from the database to allow fresh generation.

### 2. Frontend RESET Button
- Added a new button in the top-right header (next to "See CV").
- Styled with a subtle red border/background to indicate it's a "destructive" testing action.
- Includes a confirmation dialog to prevent accidental resets.

## How to use
1.  Navigate to a candidate's application track.
2.  Click the **RESET** button in the top right.
3.  Confirm the action.
4.  The page will refresh, and you can start the flow again from scratch (Analyze -> Approve -> Quiz -> etc.).

## Files Modified
- [applications.py](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/routers/applications.py)
- [ApplicationTrack.jsx](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/frontend/src/apps/HR/applications/ApplicationTrack.jsx)
