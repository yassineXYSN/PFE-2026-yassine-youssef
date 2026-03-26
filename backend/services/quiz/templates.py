"""
Template Engine.
Enforces quiz schema, difficulty mix, question type distribution, and distractor rules.
Provides built-in templates and validates generated quiz output.

Example templates:
- Compliance Basic MCQ: 10 questions (7 MCQ + 3 T/F), 30/50/20 difficulty mix
- Managerial Scenario: 5 questions (3 scenario + 2 MCQ), hard-focused
- Onboarding Quick Check: 5 easy questions (3 MCQ + 1 T/F + 1 fill-in)
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


# ── Built-in Templates ───────────────────────────────────────────────────────

BUILTIN_TEMPLATES = [
    {
        "name": "Compliance Basic MCQ",
        "description": "Standard 10-question MCQ quiz for compliance training. "
                       "Balanced difficulty with focus on recall and application.",
        "created_by": "system",
        "config": {
            "total_questions": 10,
            "question_types": {
                "mcq": {"count": 7, "options_count": 4},
                "tf": {"count": 3}
            },
            "difficulty_mix": {"easy": 0.3, "medium": 0.5, "hard": 0.2},
            "distractor_rules": {
                "min_plausibility": "medium",
                "avoid_obvious_wrong": True
            },
            "sections_filter": [],
            "max_chunk_reuse": 3
        }
    },
    {
        "name": "Managerial Scenario",
        "description": "5-question scenario-based quiz for managers and senior staff. "
                       "Focus on complex situations requiring judgment and analysis.",
        "created_by": "system",
        "config": {
            "total_questions": 5,
            "question_types": {
                "scenario": {"count": 3},
                "mcq": {"count": 2, "options_count": 4}
            },
            "difficulty_mix": {"easy": 0.0, "medium": 0.4, "hard": 0.6},
            "distractor_rules": {
                "min_plausibility": "high",
                "avoid_obvious_wrong": True
            },
            "sections_filter": [],
            "max_chunk_reuse": 2
        }
    },
    {
        "name": "Onboarding Quick Check",
        "description": "Quick 5-question knowledge check for new employees. "
                       "Easy to medium difficulty, mixed question types.",
        "created_by": "system",
        "config": {
            "total_questions": 5,
            "question_types": {
                "mcq": {"count": 3, "options_count": 4},
                "tf": {"count": 1},
                "fill_in": {"count": 1}
            },
            "difficulty_mix": {"easy": 0.6, "medium": 0.4, "hard": 0.0},
            "distractor_rules": {
                "min_plausibility": "low",
                "avoid_obvious_wrong": True
            },
            "sections_filter": [],
            "max_chunk_reuse": 2
        }
    }
]


# ── Template Validation ──────────────────────────────────────────────────────

def validate_template_config(config: Dict) -> List[str]:
    """
    Validate a template configuration.
    Returns a list of validation errors (empty = valid).
    """
    errors = []

    # Total questions
    total = config.get("total_questions", 0)
    if total < 1:
        errors.append("total_questions must be at least 1")
    if total > 50:
        errors.append("total_questions must not exceed 50")

    # Question types must sum to total
    q_types = config.get("question_types", {})
    if not q_types:
        errors.append("question_types must not be empty")
    else:
        q_sum = sum(qt.get("count", 0) for qt in q_types.values())
        if q_sum != total:
            errors.append(f"question_types counts ({q_sum}) must equal total_questions ({total})")

        # Validate each question type
        valid_types = {"mcq", "tf", "scenario", "fill_in"}
        for qt_name, qt_config in q_types.items():
            if qt_name not in valid_types:
                errors.append(f"Unknown question type: {qt_name}. Valid: {valid_types}")
            if qt_config.get("count", 0) < 0:
                errors.append(f"Question type {qt_name} count must be non-negative")
            if qt_name == "mcq":
                opts = qt_config.get("options_count", 4)
                if opts < 2 or opts > 6:
                    errors.append(f"MCQ options_count must be 2-6, got {opts}")

    # Difficulty mix must sum to ~1.0
    diff_mix = config.get("difficulty_mix", {})
    if diff_mix:
        diff_sum = sum(diff_mix.values())
        if abs(diff_sum - 1.0) > 0.05:
            errors.append(f"difficulty_mix must sum to 1.0, got {diff_sum:.2f}")
        for level in diff_mix:
            if level not in {"easy", "medium", "hard"}:
                errors.append(f"Unknown difficulty level: {level}")

    # Max chunk reuse
    max_reuse = config.get("max_chunk_reuse", 3)
    if max_reuse < 1:
        errors.append("max_chunk_reuse must be at least 1")

    return errors


def validate_quiz_output(quiz: Dict, template_config: Optional[Dict] = None) -> List[str]:
    """
    Validate generated quiz JSON against schema and template rules.
    Returns list of validation issues.
    """
    errors = []

    # Basic structure
    if not quiz.get("questions"):
        errors.append("Quiz has no questions")
        return errors

    questions = quiz["questions"]

    # Check each question
    for i, q in enumerate(questions):
        prefix = f"Question {i+1}"
        if not q.get("question"):
            errors.append(f"{prefix}: Missing question text")
        if not q.get("type"):
            errors.append(f"{prefix}: Missing type")
        if not q.get("difficulty"):
            errors.append(f"{prefix}: Missing difficulty")

        # Type-specific validation
        if q.get("type") == "mcq":
            options = q.get("options", [])
            if len(options) < 2:
                errors.append(f"{prefix}: MCQ must have at least 2 options")
            if q.get("correct_index") is None:
                errors.append(f"{prefix}: MCQ missing correct_index")
            elif q["correct_index"] >= len(options):
                errors.append(f"{prefix}: correct_index out of range")
        elif q.get("type") == "tf":
            if q.get("correct_answer") is None:
                errors.append(f"{prefix}: T/F missing correct_answer")
        elif q.get("type") in ("scenario", "fill_in"):
            if not q.get("correct_answer"):
                errors.append(f"{prefix}: {q['type']} missing correct_answer")

    # Template compliance
    if template_config:
        total = template_config.get("total_questions", 0)
        if len(questions) != total:
            errors.append(f"Expected {total} questions, got {len(questions)}")

        # Check question type distribution
        expected_types = template_config.get("question_types", {})
        actual_counts = {}
        for q in questions:
            qt = q.get("type", "unknown")
            actual_counts[qt] = actual_counts.get(qt, 0) + 1

        for qt, qt_config in expected_types.items():
            expected = qt_config.get("count", 0)
            actual = actual_counts.get(qt, 0)
            if actual != expected:
                errors.append(f"Expected {expected} {qt} questions, got {actual}")

    return errors


# ── Template CRUD ────────────────────────────────────────────────────────────

async def seed_builtin_templates(db: AsyncIOMotorDatabase):
    """Insert built-in templates if they don't exist."""
    for template in BUILTIN_TEMPLATES:
        existing = await db.quiz_templates.find_one({"name": template["name"]})
        if not existing:
            template["created_at"] = datetime.utcnow()
            await db.quiz_templates.insert_one(template)
            logger.info(f"Seeded template: {template['name']}")


async def get_template(db: AsyncIOMotorDatabase, template_id: str) -> Optional[Dict]:
    """Get a template by ID."""
    if not ObjectId.is_valid(template_id):
        return None
    return await db.quiz_templates.find_one({"_id": ObjectId(template_id)})


async def get_template_by_name(db: AsyncIOMotorDatabase, name: str) -> Optional[Dict]:
    """Get a template by name."""
    return await db.quiz_templates.find_one({"name": name})


async def list_templates(db: AsyncIOMotorDatabase) -> List[Dict]:
    """List all templates."""
    templates = await db.quiz_templates.find({}).to_list(length=100)
    return templates


async def create_template(db: AsyncIOMotorDatabase, template_data: Dict) -> Dict:
    """
    Create a new template after validation.
    Raises ValueError if config is invalid.
    """
    errors = validate_template_config(template_data.get("config", {}))
    if errors:
        raise ValueError(f"Invalid template config: {'; '.join(errors)}")

    template_data["created_at"] = datetime.utcnow()
    result = await db.quiz_templates.insert_one(template_data)
    template_data["_id"] = result.inserted_id
    logger.info(f"Created template: {template_data.get('name')}")
    return template_data


def resolve_template_config(
    template: Optional[Dict],
    overrides: Optional[Dict] = None
) -> Dict:
    """
    Resolve final quiz generation config from template + overrides.
    Overrides take precedence over template defaults.
    """
    # Start with sensible defaults
    config = {
        "total_questions": 10,
        "question_types": {"mcq": {"count": 7, "options_count": 4}, "tf": {"count": 3}},
        "difficulty_mix": {"easy": 0.3, "medium": 0.5, "hard": 0.2},
        "distractor_rules": {"min_plausibility": "medium", "avoid_obvious_wrong": True},
        "sections_filter": [],
        "max_chunk_reuse": 3,
    }

    # Apply template
    if template:
        template_config = template.get("config", {})
        config.update({k: v for k, v in template_config.items() if v is not None})

    # Apply overrides
    if overrides:
        if "total_questions" in overrides:
            config["total_questions"] = overrides["total_questions"]
        if "difficulty_mix" in overrides and overrides["difficulty_mix"]:
            config["difficulty_mix"] = overrides["difficulty_mix"]
        if "sections_filter" in overrides and overrides["sections_filter"]:
            config["sections_filter"] = overrides["sections_filter"]
        if "question_types" in overrides and overrides["question_types"]:
            # Convert simple {"mcq": 7, "tf": 3} to full format
            qt = {}
            for k, v in overrides["question_types"].items():
                if isinstance(v, int):
                    qt[k] = {"count": v, "options_count": 4}
                else:
                    qt[k] = v
            config["question_types"] = qt

    return config
