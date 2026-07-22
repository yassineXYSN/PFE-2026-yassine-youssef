import json
import logging
import os
from typing import Any

import aiproxy
from database.model import AccountSetupData
from utils.ai_settings import fake_analysis_enabled, get_account_analysis_settings
from utils.cv_parser import (
    EXAMPLE_JSON,
    build_messages,
    clean_text,
    extract_json_from_response,
    extract_text_from_pdf,
)


logger = logging.getLogger(__name__)


_LANGUAGE_LEVEL_MAP = {
    "native": 100, "mother tongue": 100, "langue maternelle": 100, "bilingue": 100,
    "fluent": 90, "professional": 90, "c2": 90, "full professional": 90,
    "advanced": 80, "c1": 80, "courant": 90,
    "upper-intermediate": 70, "b2": 70, "upper intermediate": 70,
    "intermediate": 55, "b1": 55, "intermédiaire": 55,
    "elementary": 40, "a2": 40, "pre-intermediate": 40,
    "beginner": 25, "a1": 25, "débutant": 25, "basic": 25, "notions": 20,
}

_SKILL_LEVEL_MAP = {
    "expert": 90, "master": 90, "mastery": 90,
    "advanced": 75, "confirmed": 75, "senior": 75, "expérimenté": 75,
    "intermediate": 55, "proficient": 55, "intermédiaire": 55,
    "basic": 30, "beginner": 30, "junior": 30, "débutant": 30, "notions": 20,
}


def _coerce_level(value: Any, level_map: dict) -> int:
    """Convert a string/percentage/float level to an integer 0-100."""
    if isinstance(value, int):
        return max(0, min(100, value))
    if isinstance(value, float):
        return max(0, min(100, int(value)))
    if isinstance(value, str):
        cleaned = value.strip().lower().rstrip("%").strip()
        if cleaned in level_map:
            return level_map[cleaned]
        try:
            return max(0, min(100, int(float(cleaned))))
        except ValueError:
            pass
        for key, mapped in level_map.items():
            if key in cleaned:
                return mapped
    return 50


def _normalize_account_payload(data: dict[str, Any]) -> dict[str, Any]:
    for field in ["hobbies", "skills", "languages", "educations", "experiences", "certificates"]:
        if field not in data or data[field] is None:
            data[field] = []

    if "jobPreferences" not in data or data["jobPreferences"] is None:
        data["jobPreferences"] = {}

    for skill in data.get("skills", []):
        if "level" in skill:
            skill["level"] = _coerce_level(skill["level"], _SKILL_LEVEL_MAP)

    for lang in data.get("languages", []):
        if "level" in lang:
            lang["level"] = _coerce_level(lang["level"], _LANGUAGE_LEVEL_MAP)

    # Move misplaced certificate-like entries out of experiences
    real_experiences = []
    extra_certs = []
    for exp in data.get("experiences", []):
        has_company = bool((exp.get("company") or exp.get("jobTitle") or "").strip())
        has_dates = bool(exp.get("startYear") or exp.get("startMonth"))
        if not has_company or not has_dates:
            cert_entry = {
                "id": exp.get("id", len(data["certificates"]) + len(extra_certs) + 1),
                "name": exp.get("jobTitle") or exp.get("company") or "Unknown",
                "issuer": exp.get("company") or None,
                "year": exp.get("startYear") or exp.get("endYear") or None,
                "url": None,
            }
            extra_certs.append(cert_entry)
        else:
            real_experiences.append(exp)
    data["experiences"] = real_experiences
    data["certificates"] = data.get("certificates", []) + extra_certs

    return data


async def _generate_account_json(messages: list[dict[str, str]]) -> str:
    return await aiproxy.chat(
        messages,
        capability="account_analysis",
        json_mode=True,
        temperature=0.0,
        max_tokens=4096,
    )


async def _validate_and_correct(data: dict[str, Any], messages: list[dict[str, str]]) -> dict[str, Any]:
    normalized = _normalize_account_payload(data)

    try:
        account_data = AccountSetupData(**normalized)
        return account_data.model_dump()
    except Exception as validation_error:
        logger.warning("Account analysis validation failed. Running one correction pass: %s", validation_error)

        flawed_json_str = json.dumps(normalized)
        if len(flawed_json_str) > 4000:
            flawed_json_str = flawed_json_str[:4000] + "\n...[TRUNCATED]"

        correction_messages = [
            {
                "role": "system",
                "content": "You are a JSON correctness engine. Fix the JSON and output ONLY valid JSON.",
            },
            {
                "role": "user",
                "content": (
                    "Your previous JSON failed validation.\n"
                    f"Validation errors:\n{validation_error}\n\n"
                    f"Broken JSON:\n```json\n{flawed_json_str}\n```\n\n"
                    "Return ONLY corrected JSON that matches the requested schema."
                ),
            },
        ]

        try:
            corrected_raw = await _generate_account_json(correction_messages)
            corrected_data = extract_json_from_response(corrected_raw)
            account_data = AccountSetupData(**_normalize_account_payload(corrected_data))
            return account_data.model_dump()
        except Exception as correction_error:
            logger.error("Account analysis correction failed: %s", correction_error)
            return normalized


async def _parse_cv_raw_text(raw_text: str) -> dict[str, Any]:
    cleaned = clean_text(raw_text)
    logger.info("Cleaned text: %s characters.", f"{len(cleaned):,}")

    max_chars = 128_000
    if len(cleaned) > max_chars:
        logger.warning("Text too long, truncating to %s chars.", f"{max_chars:,}")
        cleaned = cleaned[:max_chars]

    messages = build_messages(cleaned)
    raw_output = await _generate_account_json(messages)
    raw_data = extract_json_from_response(raw_output)
    result = await _validate_and_correct(raw_data, messages)
    logger.info("Account analysis completed successfully.")
    return result


def _fake_account_analysis_result() -> dict[str, Any]:
    mock_data = json.loads(json.dumps(EXAMPLE_JSON))
    mock_data["title"] = f"[FAKE] {mock_data['title']}"
    return mock_data


async def parse_cv(pdf_path: str) -> dict[str, Any]:
    logger.info("=" * 60)
    logger.info("Account Analysis Engine - %s", pdf_path)
    logger.info("=" * 60)

    if fake_analysis_enabled() or get_account_analysis_settings().is_mock:
        logger.info("[FAKE ANALYSIS] Mode enabled. Returning mock account analysis data.")
        return _fake_account_analysis_result()

    raw_text = extract_text_from_pdf(pdf_path)
    logger.info("Extracted %s characters from PDF.", f"{len(raw_text):,}")
    return await _parse_cv_raw_text(raw_text)


async def parse_cv_bytes(file_bytes: bytes, filename: str) -> dict[str, Any]:
    """Parse a CV from raw bytes, dispatching on file extension.

    Supports .pdf (via PyMuPDF) and .doc/.docx (via python-docx, reusing the
    quiz-document ingestion extractor). Legacy binary .doc files are accepted
    for the upload but python-docx can only read them if they're actually
    OOXML underneath — same limitation the quiz document ingester already has.
    """
    logger.info("=" * 60)
    logger.info("Account Analysis Engine (bytes) - %s", filename)
    logger.info("=" * 60)

    # Validate extension early (before fake analysis check)
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in (".pdf", ".doc", ".docx"):
        raise ValueError(f"Unsupported CV file type: {ext or '(none)'}")

    if fake_analysis_enabled() or get_account_analysis_settings().is_mock:
        logger.info("[FAKE ANALYSIS] Mode enabled. Returning mock account analysis data.")
        return _fake_account_analysis_result()

    if ext == ".pdf":
        import tempfile

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
        try:
            raw_text = extract_text_from_pdf(tmp_path)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    elif ext in (".doc", ".docx"):
        from services.quiz.ingestion import extract_text_from_docx

        raw_text, _ = extract_text_from_docx(file_bytes)

    logger.info("Extracted %s characters from %s.", f"{len(raw_text):,}", ext)
    return await _parse_cv_raw_text(raw_text)
