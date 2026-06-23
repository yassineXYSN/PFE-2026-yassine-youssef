import json
import logging
import os
import re
import asyncio
import httpx
from typing import Any, List, Dict

from pydantic import BaseModel

from utils.ai_settings import get_interview_analysis_settings, fake_analysis_enabled
from utils.llm_client import generate_chat_completion

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# ── Local-model performance knobs (shared with llm_client) ─────────────────
_OLLAMA_NUM_GPU    = int(os.getenv("OLLAMA_NUM_GPU_LAYERS", "99"))
_OLLAMA_NUM_THREAD = int(os.getenv("OLLAMA_NUM_THREAD", "0")) or None
_OLLAMA_NUM_CTX    = int(os.getenv("OLLAMA_NUM_CTX", "8192"))


# ── Output schema & Pydantic model ────────────────────────────────────────
class InterviewAnalysisResult(BaseModel):
    summary: str
    strengths: List[str]
    weaknesses: List[str]
    overall_score: int


OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {
            "type": "string",
            "description": "A comprehensive 2-3 paragraph summary of the candidate's performance, "
                           "communication skills, and technical knowledge based on the transcript.",
        },
        "strengths": {
            "type": "array",
            "items": {"type": "string"},
            "description": "3 to 5 key strengths demonstrated by the candidate.",
        },
        "weaknesses": {
            "type": "array",
            "items": {"type": "string"},
            "description": "1 to 3 areas of improvement or weaknesses.",
        },
        "overall_score": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "description": "An overall score out of 100 representing the candidate's fit and performance.",
        },
    },
    "required": ["summary", "strengths", "weaknesses", "overall_score"],
}

SYSTEM_PROMPT = f"""\
You are an expert HR AI Assistant. Your task is to analyze a completed job interview.
You will be provided with:
1. The full transcript of the conversation. Note that:
   - "Recruteur" (Recruiter) is the one asking questions and guiding the interview.
   - "Candidat" (Candidate) is the one answering questions and being evaluated.
2. The sequence of emotions detected on the candidate's face during the interview.

Your goal is to evaluate the candidate's performance, communication, and technical skills \
based ONLY on the provided transcript and emotions.
IMPORTANT: Do not confuse the recruiter's statements with the candidate's responses. \
Focus your analysis on the candidate's answers.

Output your analysis STRICTLY as a JSON object matching the following schema. \
Do not include any markdown formatting outside of the JSON block. \
Do not include any explanations.

Schema:
{json.dumps(OUTPUT_SCHEMA, indent=2)}
"""

_MOCK_RESULT = {
    "summary": "[FAKE] Le candidat a démontré une excellente capacité de communication globale. Les réponses étaient claires et bien structurées. L'analyse émotionnelle a montré une prédominance de confiance ('neutral' et 'happy').",
    "strengths": ["Excellente communication verbale", "Contexte technique solide", "Attitude positive (émotions dominantes: happy)"],
    "weaknesses": ["Manque de détails sur certaines questions d'architecture"],
    "overall_score": 85,
}

_FALLBACK_RESULT = {
    "summary": "The AI analysis failed to generate a strictly formatted response. Please check the raw transcript manually.",
    "strengths": ["Transcript available"],
    "weaknesses": ["AI Processing Error"],
    "overall_score": 0,
}


def _pydantic_dump(model: BaseModel) -> dict:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _extract_json_from_response(raw: str) -> dict:
    text = raw.strip()
    md_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if md_match:
        text = md_match.group(1).strip()

    brace_start = text.find('{')
    if brace_start == -1:
        raise ValueError("No JSON object found in model output.")

    decoder = json.JSONDecoder()
    try:
        data, _ = decoder.raw_decode(text[brace_start:])
        return data
    except Exception as exc:
        logger.error("JSON parsing failed: %s", exc)
        raise


def _messages_to_prompt(messages: list[dict]) -> str:
    """Convert chat messages to a plain-text prompt for Ollama /generate."""
    rendered: list[str] = []
    for m in messages:
        role = (m.get("role") or "user").upper()
        content = m.get("content") or ""
        rendered.append(f"{role}:\n{content}")
    rendered.append("ASSISTANT:")
    return "\n\n".join(rendered)


# ── Provider-specific callers (synchronous, safe to call from sync routes) ─
def _call_ollama(messages: list[dict], settings, *, max_tokens: int = 2048) -> str:
    options: dict[str, Any] = {
        "temperature": 0.1,
        "num_gpu":     _OLLAMA_NUM_GPU,
        "num_ctx":     _OLLAMA_NUM_CTX,
        "num_predict": max_tokens,
    }
    if _OLLAMA_NUM_THREAD:
        options["num_thread"] = _OLLAMA_NUM_THREAD
    if "qwen3" in settings.model.lower():
        options["think"] = False   # disable chain-of-thought for faster JSON output

    generate_payload: dict[str, Any] = {
        "model":   settings.model,
        "prompt":  _messages_to_prompt(messages),
        "stream":  False,
        "format":  "json",
        "options": options,
    }
    chat_payload: dict[str, Any] = {
        "model":    settings.model,
        "messages": messages,
        "stream":   False,
        "format":   "json",
        "options":  options,
    }

    with httpx.Client(timeout=180.0) as client:
        try:
            logger.info(f"[DEBUG AI CALL] Sending /generate request to Ollama: {settings.ollama_base_url}")
            resp = client.post(f"{settings.ollama_base_url}/generate", json=generate_payload)
            resp.raise_for_status()
            logger.info("[DEBUG AI CALL] Ollama /generate success!")
            return (resp.json().get("response") or "").strip()
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "[DEBUG AI CALL] Ollama /generate failed (%s). Retrying with /chat.", exc.response.status_code
            )
            chat_resp = client.post(f"{settings.ollama_base_url}/chat", json=chat_payload)
            chat_resp.raise_for_status()
            logger.info("[DEBUG AI CALL] Ollama /chat success!")
            return (chat_resp.json().get("message", {}).get("content") or "").strip()
        except Exception as e:
            logger.error(f"[DEBUG AI CALL] Ollama Exception: {e}")
            raise


def _call_huggingface(messages: list[dict], settings, *, max_tokens: int = 2048) -> str:
    payload: dict[str, Any] = {
        "model":       settings.model,
        "messages":    messages,
        "temperature": 0.1,
        "max_tokens":  max_tokens,
    }
    with httpx.Client(timeout=120.0) as client:
        resp = client.post(
            "https://router.huggingface.co/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.huggingface_api_key}",
                "Content-Type":  "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
    return (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )


# ── Public API ────────────────────────────────────────────────────────────
async def analyze_interview(
    transcript: List[Dict[str, Any]],
    emotions:   List[Dict[str, Any]],
) -> dict:
    """
    Generate a structured AI report for a completed interview.

    Provider and model are resolved from environment variables:
      INTERVIEW_REPORT_PROVIDER     → 'ollama' | 'huggingface'  (default: huggingface)
      INTERVIEW_REPORT_MODEL_LOCAL  → local model name          (default: qwen3:8b)
      INTERVIEW_REPORT_MODEL_API    → HuggingFace model ID      (default: Qwen/Qwen2.5-72B-Instruct)

    Local-model performance tuning:
      OLLAMA_NUM_GPU_LAYERS  → GPU layers offloaded (default: 99, i.e. full GPU)
      OLLAMA_NUM_THREAD      → CPU threads (default: auto)
      OLLAMA_NUM_CTX         → context window in tokens (default: 8192)
    """
    logger.info("=" * 60)
    logger.info("AI Interview Report Generator")
    logger.info("=" * 60)

    # ── Mock / fast-return mode ───────────────────────────────────────────
    if fake_analysis_enabled():
        logger.info("[FAKE ANALYSIS] Returning mock report.")
        return {
            "summary": (
                "[FAKE] Le candidat a démontré une excellente capacité de communication globale. "
                "Les réponses étaient claires et bien structurées. L'analyse émotionnelle a montré "
                "une prédominance de confiance ('neutral' et 'happy')."
            ),
            "strengths": [
                "Excellente communication verbale",
                "Contexte technique solide",
                "Attitude positive (émotions dominantes: happy)",
            ],
            "weaknesses": ["Manque de détails sur certaines questions d'architecture"],
            "overall_score": 85,
        }

    # ── Resolve settings ──────────────────────────────────────────────────
    settings = get_interview_analysis_settings()
    logger.info("Provider: %s | Model: %s", settings.provider, settings.model)

    # ── Build prompt payload ──────────────────────────────────────────────
    formatted_transcript = "\n".join(
        f"[{t.get('timestamp', '')}] {t.get('sender', 'Unknown')}: {t.get('text', '')}"
        for t in transcript
    )

    simplified_emotions: list[str] = []
    for e in emotions:
        ts      = e.get("timestamp", "")
        results = e.get("emotions", [])
        if results and isinstance(results, list):
            dom = results[0].get("emotion", "unknown")
            simplified_emotions.append(f"[{ts}] {dom}")
    formatted_emotions = "\n".join(simplified_emotions)

    prompt = (
        f"---BEGIN TRANSCRIPT---\n{formatted_transcript}\n---END TRANSCRIPT---\n\n"
        f"---BEGIN EMOTIONS---\n{formatted_emotions}\n---END EMOTIONS---\n\n"
        "Please output the JSON analysis now."
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": prompt},
    ]

    # ── Call selected provider ────────────────────────────────────────────
    try:
        logger.info(
            "[DEBUG ANALYZER] provider=%s model=%s transcript_chars=%s emotion_rows=%s",
            settings.provider,
            settings.model,
            len(formatted_transcript),
            len(simplified_emotions),
        )
        raw_output = await generate_chat_completion(
            messages,
            settings,
            json_mode=True,
            temperature=0.1,
            max_tokens=2048,
        )

        logger.info("[DEBUG ANALYZER] Raw output received (%s chars), extracting JSON...", len(raw_output or ""))
        data      = _extract_json_from_response(raw_output)
        validated = InterviewAnalysisResult(**data)
        logger.info("[DEBUG ANALYZER] ✅ Interview report generated successfully.")
        return _pydantic_dump(validated)

    except Exception as exc:
        import traceback
        logger.error(f"[DEBUG ANALYZER] Failed to generate or parse AI report: {exc}")
        traceback.print_exc()
        return {
            "summary":       "The AI analysis failed to generate a strictly formatted response. "
                             "Please check the raw transcript manually.",
            "strengths":     ["Transcript available"],
            "weaknesses":    ["AI Processing Error"],
            "overall_score": 0,
        }
