# Implementation Plan - Mock Quiz Generation Mode

This plan outlines the changes required to implement a mock quiz generation mode when the environment variable `QUIZ_METHOD` is set to `3`. This is useful for testing without an active LLM service.

## Proposed Changes

### Backend

#### [MODIFY] [generation.py](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/quiz/generation.py)
- Update the `METHOD` and `LLM_PROVIDER` resolution logic.
- Add an `elif METHOD == 3` block to set `LLM_PROVIDER = "mock"`.
- This will trigger the existing `_generate_mock_question` function during quiz generation.

#### [MODIFY] [.env](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/.env)
- Update `QUIZ_METHOD` documentation or default (though I'll keep it at `0` for the user, I'll just explain to the user how to flip it).

## Verification Plan

### Automated Tests
- Set `QUIZ_METHOD=3` in the backend environment.
- Call `POST /api/quiz/generate` for any document.
- Verify that the response returns questions with the `[MOCK]` prefix and that no actual LLM logs appear.

### Manual Verification
- Test through the HR dashboard by clicking "Créer un Quiz" while the backend is in mode 3.
- Verify that the quiz is generated instantly and displays the mock content.
