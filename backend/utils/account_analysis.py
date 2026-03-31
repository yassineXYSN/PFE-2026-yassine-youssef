import json
import logging
from typing import Any

from database.model import AccountSetupData
from utils.ai_settings import fake_analysis_enabled, get_account_analysis_settings
from utils.cv_parser import (
    EXAMPLE_JSON,
    build_messages,
    clean_text,
    extract_json_from_response,
    extract_text_from_pdf,
)
from utils.llm_client import generate_chat_completion


logger = logging.getLogger(__name__)


def _normalize_account_payload(data: dict[str, Any]) -> dict[str, Any]:
    for field in ["hobbies", "skills", "languages", "educations", "experiences", "certificates"]:
        if field not in data or data[field] is None:
            data[field] = []

    if "jobPreferences" not in data or data["jobPreferences"] is None:
        data["jobPreferences"] = {}

    return data


async def _generate_account_json(messages: list[dict[str, str]]) -> str:
    settings = get_account_analysis_settings()
    return await generate_chat_completion(
        messages,
        settings,
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


async def parse_cv(pdf_path: str) -> dict[str, Any]:
    logger.info("=" * 60)
    logger.info("Account Analysis Engine - %s", pdf_path)
    logger.info("=" * 60)

    if fake_analysis_enabled() or get_account_analysis_settings().is_mock:
        logger.info("[FAKE ANALYSIS] Mode enabled. Returning mock account analysis data.")
        mock_data = json.loads(json.dumps(EXAMPLE_JSON))
        mock_data["title"] = f"[FAKE] {mock_data['title']}"
        return mock_data

    raw_text = extract_text_from_pdf(pdf_path)
    logger.info("Extracted %s characters from PDF.", f"{len(raw_text):,}")

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
