import json
import logging
import re
from typing import Any, List, Dict

from pydantic import BaseModel

import aiproxy
from utils.ai_settings import get_interview_analysis_settings, fake_analysis_enabled

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


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
        raw_output = await aiproxy.chat(
            messages,
            capability="interview_analysis",
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
