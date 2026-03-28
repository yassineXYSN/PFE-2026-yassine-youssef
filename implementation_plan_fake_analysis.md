# Implementation Plan - Fake Analysis Mode

Implement a global "Fake Analysis" toggle to bypass real AI API calls and local model inference for testing purposes.

## Proposed Changes

### Backend Utilities

#### [MODIFY] [cv_parser.py](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/utils/cv_parser.py)
- In `parse_cv`, check `os.getenv("FAKE_ANALYSIS") == "1"`.
- If enabled, return `EXAMPLE_JSON` (already defined in the file) with some minor randomizations or just the static mock.

### Backend Services

#### [MODIFY] [ai_matching.py](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/services/ai_matching.py)
- In `generate_embedding`, check `FAKE_ANALYSIS`. Return a random vector of length 768 or 1536 (depending on the model).
- In `evaluate_candidate_with_llm`, check `FAKE_ANALYSIS`. Return a mock score (e.g., 85) and a generic justification.
- In `evaluate_quiz_performance`, check `FAKE_ANALYSIS`. Return a mock technical evaluation string.

#### [MODIFY] [generation.py](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/services/quiz/generation.py)
- Update `LLM_PROVIDER` logic to set it to `"mock"` if `os.getenv("FAKE_ANALYSIS") == "1"`.

## Verification Plan

### Automated Tests
- Create a test script `tmp/test_fake_analysis.py` that sets `os.environ["FAKE_ANALYSIS"] = "1"` and calls the affected functions.
- Assert that no actual API calls are made (can check logs or mock the `httpx` client).

### Manual Verification
- Run the dev server with `FAKE_ANALYSIS=1` and upload a CV or trigger a match.
- Verify that response is near-instant and contains mock markers.
