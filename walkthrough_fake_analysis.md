# Walkthrough - Fake Analysis Mode

I have successfully implemented the `FAKE_ANALYSIS` environment variable toggle in the HumatiQ backend.

## Accomplishments

### 1. Global Toggle Implementation
- Added check for `os.getenv("FAKE_ANALYSIS") == "1"` across all core AI services.
- This allows developers to test the **entire recruitment pipeline** without:
  - Consuming Hugging Face/OpenAI/Ollama API credits.
  - Using local LLMs that require heavy hardware (GPU/RAM).
  - Experiencing long inference wait times.

### 2. Affected Services
- **CV Parser (`backend/utils/cv_parser.py`)**: Returns structured mock data with a `[FAKE]` prefix.
- **AI Matching (`backend/services/ai_matching.py`)**:
  - `generate_embedding`: Returns a random 768-dimensional vector.
  - `evaluate_candidate_with_llm`: Returns a random score (70-95) and mock justification.
  - `evaluate_quiz_performance`: Returns a static professional summary.
- **Quiz Generation (`backend/services/quiz/generation.py`)**: Automatically switches to `LLM_PROVIDER="mock"`.

### 3. Verification
- Created and ran a test script `tmp/test_fake_analysis.py` under the `backend\venv` environment.
- Verified that all services return the expected mock data when the flag is set.
- **All tests passed.**

## How to use
Run the backend with the environment variable set:
```powershell
$env:FAKE_ANALYSIS="1"
./run_dev.ps1
```
Or set it in your `.env` file.

## Files Updated
- [cv_parser.py](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/utils/cv_parser.py)
- [ai_matching.py](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/services/ai_matching.py)
- [generation.py](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/services/quiz/generation.py)
