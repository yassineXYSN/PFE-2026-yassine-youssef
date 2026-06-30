import os
import sys
from datetime import datetime


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from services.job_automation import (  # noqa: E402
    calculate_weighted_quiz_score,
    resolve_job_deadline,
    resolve_quiz_stage_deadline,
)


def test_resolve_job_deadline_treats_date_only_as_end_of_day():
    deadline = resolve_job_deadline({"deadline": "2026-04-15"})

    assert deadline == datetime(2026, 4, 15, 23, 59, 59, 999999)


def test_resolve_quiz_stage_deadline_returns_latest_quiz_deadline():
    deadline = resolve_quiz_stage_deadline(
        {
            "ai_automation": {
                "quiz_stage": {
                    "quizzes": [
                        {"deadline_at": "2026-04-16T10:59"},
                        {"deadline_at": "2026-04-16T14:15"},
                        {"deadline_at": "2026-04-16T09:00"},
                    ]
                }
            }
        }
    )

    assert deadline == datetime(2026, 4, 16, 14, 15)


def test_calculate_weighted_quiz_score_uses_quiz_weights():
    score = calculate_weighted_quiz_score(
        [
            {"score": 80, "weight_percentage": 60},
            {"score": 50, "weight_percentage": 40},
        ]
    )

    assert score == 68.0


def test_calculate_weighted_quiz_score_ignores_missing_weights():
    score = calculate_weighted_quiz_score(
        [
            {"score": 90, "weight_percentage": 0},
            {"score": 70},
        ]
    )

    assert score == 0.0
