# Secure Quiz Timer Implementation Plan

## Goal Description
Implement a secure 10-minute timer for taking a quiz and ensure that only the candidate associated with the job application can take the quiz.

## Proposed Changes

### Backend Updates
#### [MODIFY] backend/quiz/models.py
- Update the `Quiz` model to include an optional `started_at` datetime field.

#### [MODIFY] backend/quiz/router.py
- **New endpoint `POST /api/quiz/{quiz_id}/start`**:
  - Requires user authentication.
  - Verifies that the quiz belongs to the user by looking up the `application_id` from the quiz and comparing `application["candidate_id"]` with `current_user["id"]`.
  - Sets the `started_at` field to `datetime.utcnow()` if it hasn't been set yet.
  - Returns the `started_at` time.
- **Update endpoint `GET /api/quiz/{quiz_id}`**:
  - Add authentication (`Depends(get_current_user)`).
  - Verify access: User must either be HR/Admin, OR the candidate whose `application["candidate_id"]` matches `current_user["id"]`. 
  - If the user is a candidate, check if the quiz has been started and if the 10-minute time has already elapsed.
- **Update endpoint `POST /api/quiz/{quiz_id}/submit`**:
  - Verify access (same logic as above).
  - Verify the time limit constraint: `datetime.utcnow() - quiz.started_at` must be <= 10.5 minutes (to allow for light network delay).
  - Return a `400 Bad Request` explicitly if the time has been exceeded, or process the submission normally.

### Frontend Updates
#### [MODIFY] src/pages/candidat/QuizTakingPage.jsx (or similar)
- Modify the page to hit the `POST /api/quiz/{quiz_id}/start` endpoint immediately, receiving the start time.
- Implement a client-side countdown timer (10 minutes) based on `started_at`.
- When the timer reaches 0, invoke the automatic submission of the current state of answers.
- Display a modal or alert if the backend rejects the submission for exceeding the time limit.

## Verification Plan
### Automated Tests
- The backend API endpoints can be manually tested using `curl` or Postman via temporary scripts.

### Manual Verification
- Log in as the candidate.
- Navigate to the quiz.
- Observe the timer counts down correctly from 10 minutes.
- Verify that submission is disabled or auto-triggered when time strikes 0.
- Use a database script to modify `started_at` to > 10 minutes in the past and attempt to submit through the UI, ensuring the backend rejects it.
- Try accessing the quiz as a different candidate and verify Access Denied.
