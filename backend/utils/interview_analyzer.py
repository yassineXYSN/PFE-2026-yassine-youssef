import json
import logging
import re
from typing import List, Dict, Any

from pydantic import BaseModel

logger = logging.getLogger(__name__)


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
            "description": "A comprehensive 2-3 paragraph summary of the candidate's performance, communication skills, and technical knowledge based on the transcript."
        },
        "strengths": {
            "type": "array",
            "items": {"type": "string"},
            "description": "3 to 5 key strengths demonstrated by the candidate."
        },
        "weaknesses": {
            "type": "array",
            "items": {"type": "string"},
            "description": "1 to 3 areas of improvement or weaknesses."
        },
        "overall_score": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "description": "An overall score out of 100 representing the candidate's fit and performance."
        }
    },
    "required": ["summary", "strengths", "weaknesses", "overall_score"]
}

SYSTEM_PROMPT = f"""\
You are an expert HR AI Assistant. Your task is to analyze a completed job interview.
You will be provided with:
1. The full transcript of the conversation. Note that:
   - "Recruteur" (Recruiter) is the one asking questions and guiding the interview.
   - "Candidat" (Candidate) is the one answering questions and being evaluated.
2. The sequence of emotions detected on the candidate's face during the interview.

Your goal is to evaluate the candidate's performance, communication, and technical skills based ONLY on the provided transcript and emotions.
IMPORTANT: Do not confuse the recruiter's statements with the candidate's responses. Focus your analysis on the candidate's answers.

Output your analysis STRICTLY as a JSON object matching the following schema. Do not include any markdown formatting outside of the JSON block. Do not include any explanations.

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
    except Exception as e:
        logger.error("JSON parsing failed: %s", e)
        raise


async def analyze_interview(
    transcript: List[Dict[str, Any]],
    emotions: List[Dict[str, Any]],
) -> dict:
    from utils.ai_settings import get_interview_analysis_settings, fake_analysis_enabled
    from utils.llm_client import generate_chat_completion

    if fake_analysis_enabled():
        logger.info("[FAKE ANALYSIS] Returning mock interview analysis.")
        return _MOCK_RESULT

    settings = get_interview_analysis_settings()

    if settings.is_mock:
        logger.info("[MOCK PROVIDER] Returning mock interview analysis.")
        return _MOCK_RESULT

    formatted_transcript = "\n".join(
        f"[{t.get('timestamp', '')}] {t.get('sender', 'Unknown')}: {t.get('text', '')}"
        for t in transcript
    )

    simplified_emotions = []
    for e in emotions:
        ts = e.get("timestamp", "")
        results = e.get("emotions", [])
        if results and isinstance(results, list):
            dom = results[0].get("emotion", "unknown")
            simplified_emotions.append(f"[{ts}] {dom}")
    formatted_emotions = "\n".join(simplified_emotions)

    user_prompt = (
        f"---BEGIN TRANSCRIPT---\n{formatted_transcript}\n---END TRANSCRIPT---\n\n"
        f"---BEGIN EMOTIONS---\n{formatted_emotions}\n---END EMOTIONS---\n\n"
        "Please output the JSON analysis now."
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    logger.info("Calling %s/%s for interview analysis", settings.provider, settings.model)
    raw_output = await generate_chat_completion(
        messages,
        settings,
        json_mode=True,
        temperature=0.1,
        max_tokens=2048,
    )

    try:
        data = _extract_json_from_response(raw_output)
        validated = InterviewAnalysisResult(**data)
        logger.info("Interview analysis completed successfully.")
        return validated.model_dump()
    except Exception as e:
        logger.error("Failed to parse or validate AI output: %s", e)
        return _FALLBACK_RESULT
