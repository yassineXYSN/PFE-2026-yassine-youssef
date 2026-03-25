# Implementation Plan - Quiz Visualization & Candidate Delivery

This plan outlines the changes to refine the HR Quiz View with a professional monochrome theme and implement the "Send to Candidate" workflow.

## Proposed Changes

### Frontend

#### [MODIFY] [QuizView.css](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/frontend/src/apps/HR/applications/QuizView.css)
- Implement a monochrome color palette using CSS variables (Surface: #f9f9f9, Primary: #000000, etc.).
- Replace all blue accents (#3b82f6) with black/gray/white.
- Update card shadows and borders to feel more premium.
- Add styling for the new `.qz-send-btn`.

#### [MODIFY] [QuizView.jsx](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/frontend/src/apps/HR/applications/QuizView.jsx)
- Add "Envoyer au Candidat" button in the sidebar.
- Implement `handleSendToCandidate` using `apiFetch` to update the quiz status.
- Add visual feedback (success toast/state) after sending.

### Backend

#### [MODIFY] [router.py](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/quiz/router.py)
- [NEW] `PATCH /api/quiz/{quiz_id}/status` endpoint.
- This endpoint will update the `status` of the quiz (e.g., to `published`).
- If an `application_id` is linked to the quiz, it should also update the `Application` status in the database to reflect that the test is "Sent".

## Verification Plan

### Automated Tests
- Component rendering check for `QuizView`.
- API test for the new PATCH endpoint.

### Manual Verification
1. Open a generated quiz in the HR dashboard.
2. Verify the theme is strictly monochrome (Black, White, Grays).
3. Click "Envoyer au Candidat".
4. Verify the status updates in the UI and the application track shows the quiz as sent.
