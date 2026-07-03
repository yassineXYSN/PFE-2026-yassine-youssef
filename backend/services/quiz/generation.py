"""
Quiz Generation Service.
Accepts a context package (retrieved chunks) + template instructions and produces
structured quiz JSON using Ollama qwen3:8b.

Includes prompt templates for:
- MCQ with 4 options and plausible distractors
- True/False questions
- Scenario questions with rubric
- Fill-in-the-blank questions

How to switch from mocked LLM to real model:
    - The service uses Ollama by default (same as ai_matching)
    - To use OpenAI: set QUIZ_LLM_PROVIDER=openai and OPENAI_API_KEY env var
    - To use a fine-tuned model: set QUIZ_LLM_MODEL to your model name
"""

import json
import logging
import asyncio
import os
import uuid
import re
import random
from typing import List, Dict, Any
from datetime import datetime

QUIZ_LLM_MAX_CONCURRENT = int(os.getenv("QUIZ_LLM_MAX_CONCURRENT", "4"))

from utils.ai_settings import get_quiz_generation_settings
from utils.llm_client import generate_chat_completion

logger = logging.getLogger(__name__)


def _shuffle_mcq_options(question: Dict) -> Dict:
    """
    Randomize MCQ option order so the correct answer isn't predictably in the
    same slot (LLMs tend to place the correct option first).
    """
    if question.get("type") != "mcq":
        return question
    options = question.get("options")
    correct_idx = question.get("correct_index")
    if not isinstance(options, list) or not isinstance(correct_idx, int) or not (0 <= correct_idx < len(options)):
        return question
    correct_option = options[correct_idx]
    shuffled = options[:]
    random.shuffle(shuffled)
    question["options"] = shuffled
    question["correct_index"] = shuffled.index(correct_option)
    return question

# ── Configuration ────────────────────────────────────────────────────────────
# ── Prompt Templates ─────────────────────────────────────────────────────────

MCQ_PROMPT = """You are an expert HR training quiz creator. Generate a {difficulty} difficulty multiple-choice question based on the following context.

CONTEXT (Document: {doc_title}):
{context}
{existing_note}
RULES:
1. Write the question as a standalone factual question. Do NOT use phrases like "according to the context", "based on the provided context", "in the context", or any similar meta-references. The question must read naturally as if testing real-world knowledge.
1b. Never ask about the document's own structure or layout — no questions about chapter numbers, chapter titles, section names, table of contents, page numbers, or "which chapter/section covers X". The candidate taking this quiz may not have access to the source document, so test the underlying knowledge itself, not where it appears in the document.
2. Create exactly {options_count} options where:
   - One is clearly correct
   - The distractors are plausible but definitively wrong
   - Avoid "All of the above" or "None of the above"
3. Provide a brief explanation of why the correct answer is right.
4. For {difficulty} difficulty:
   - easy: Direct recall of a specific fact
   - medium: Requires understanding and application
   - hard: Requires analysis, synthesis, or evaluation

RESPOND WITH ONLY THIS JSON (no other text):
{{
  "type": "mcq",
  "difficulty": "{difficulty}",
  "question": "Your question here",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_index": 0,
  "explanation": "Brief explanation of why the answer is correct"
}}"""

TF_PROMPT = """You are an expert HR training quiz creator. Generate a {difficulty} difficulty true/false question based on the following context.

CONTEXT (Document: {doc_title}):
{context}
{existing_note}
RULES:
1. Write the statement as a standalone factual claim. Do NOT use phrases like "according to the context", "based on the provided context", or any similar meta-references. The statement must read naturally as a real-world fact claim.
1b. Never make the statement about the document's own structure or layout — no claims about chapter numbers, chapter titles, section names, table of contents, or page numbers. The candidate may not have access to the source document, so test the underlying knowledge itself.
2. For false statements, make them subtly wrong (change a key detail, not obviously absurd).
3. Provide a brief explanation.
4. Vary between true and false answers — do not always make the statement true.

RESPOND WITH ONLY THIS JSON (no other text):
{{
  "type": "tf",
  "difficulty": "{difficulty}",
  "question": "Statement that is either true or false",
  "correct_answer": true,
  "explanation": "Brief explanation"
}}"""

SCENARIO_PROMPT = """You are an expert HR training quiz creator. Generate a {difficulty} difficulty scenario-based question based on the following context.

CONTEXT (Document: {doc_title}):
{context}
{existing_note}
RULES:
1. Create a realistic workplace scenario that requires applying the knowledge from the content. Do NOT reference "the context", "the provided document", or any meta-source — write it as a real situation.
1b. Never ask the candidate to recall the document's own structure (chapter numbers, chapter titles, section names, page numbers) — the candidate may not have access to the source document.
2. The scenario should present a situation an employee might actually face.
3. Provide a rubric for evaluating the response.
4. For {difficulty} difficulty:
   - medium: Clear-cut scenario with one best response
   - hard: Complex scenario requiring nuanced judgment

RESPOND WITH ONLY THIS JSON (no other text):
{{
  "type": "scenario",
  "difficulty": "{difficulty}",
  "question": "Describe the scenario and ask what the employee should do",
  "correct_answer": "The ideal response/action",
  "explanation": "Why this is the correct approach",
  "rubric": "Key points to look for in the response"
}}"""

FILL_IN_PROMPT = """You are an expert HR training quiz creator. Generate a {difficulty} difficulty fill-in-the-blank question based on the following context.

CONTEXT (Document: {doc_title}):
{context}
{existing_note}
RULES:
1. Take a key sentence from the content and replace ONE important term with a blank (___). Write it as a standalone statement — do NOT reference "the context", "the document", or any meta-source.
1b. Never build the blank around the document's own structure (chapter numbers, chapter titles, section names, page numbers) — the candidate may not have access to the source document.
2. The blank should test knowledge of a specific, important concept.
3. Provide a brief explanation.

RESPOND WITH ONLY THIS JSON (no other text):
{{
  "type": "fill_in",
  "difficulty": "{difficulty}",
  "question": "Sentence with ___ for the blank",
  "correct_answer": "The word or phrase that fills the blank",
  "explanation": "Brief explanation"
}}"""


# ── Mock Generator (for testing without LLM) ────────────────────────────────

def _generate_mock_question(
    question_type: str,
    difficulty: str,
    context: str,
    chunk_ids: List[str],
    doc_title: str = "Mock Document"
) -> Dict:
    """
    Generate a mock quiz question for testing without an LLM.
    Useful for development and CI/CD pipelines.
    """
    qid = f"q_{uuid.uuid4().hex[:8]}"
    context_preview = context[:100].replace('"', "'")

    if question_type == "mcq":
        return {
            "id": qid,
            "type": "mcq",
            "difficulty": difficulty,
            "question": f"[MOCK] Based on: '{context_preview}...', which statement is correct?",
            "options": [
                "Option A — correct answer",
                "Option B — plausible distractor",
                "Option C — plausible distractor",
                "Option D — plausible distractor"
            ],
            "correct_index": 0,
            "explanation": "[MOCK] This is a mock question generated from the document context.",
            "source_chunks": chunk_ids,
            "source_document": doc_title,
        }
    elif question_type == "tf":
        return {
            "id": qid,
            "type": "tf",
            "difficulty": difficulty,
            "question": f"[MOCK] '{context_preview}...' is an accurate statement.",
            "correct_answer": True,
            "explanation": "[MOCK] This is a mock true/false question.",
            "source_chunks": chunk_ids,
            "source_document": doc_title,
        }
    elif question_type == "scenario":
        return {
            "id": qid,
            "type": "scenario",
            "difficulty": difficulty,
            "question": f"[MOCK] Scenario: An employee encounters a situation related to '{context_preview}...'. What should they do?",
            "correct_answer": "Follow the established procedure as outlined in the training material.",
            "explanation": "[MOCK] Mock scenario explanation.",
            "source_chunks": chunk_ids,
            "rubric": "Key points: identify the issue, follow procedure, report appropriately.",
            "source_document": doc_title,
        }
    else:  # fill_in
        return {
            "id": qid,
            "type": "fill_in",
            "difficulty": difficulty,
            "question": "[MOCK] The key concept described in the training is ___.",
            "correct_answer": "compliance",
            "explanation": "[MOCK] Mock fill-in question.",
            "source_chunks": chunk_ids,
            "source_document": doc_title,
        }


# ── LLM Generation ──────────────────────────────────────────────────────────

def _parse_json_response(raw: str) -> Dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw or "", re.DOTALL)
        if match:
            return json.loads(match.group())
        raise


async def generate_question(
    question_type: str,
    difficulty: str,
    context: str,
    chunk_ids: List[str],
    doc_title: str = "Unknown Document",
    options_count: int = 4,
    existing_questions: List[str] = None
) -> Dict:
    """
    Generate a single quiz question using the configured LLM.

    Args:
        question_type: "mcq", "tf", "scenario", or "fill_in"
        difficulty: "easy", "medium", or "hard"
        context: Concatenated text from retrieved chunks
        chunk_ids: Source chunk ObjectId references
        options_count: Number of MCQ options (default 4)

    Returns:
        Question dict matching QuizQuestion schema.
    """
    # Build the existing-questions note to prevent repetition
    if existing_questions:
        existing_list = "\n".join(f"  - {q}" for q in existing_questions[:20])
        existing_note = (
            f"\nAVOID REPETITION — these questions already exist in this quiz. "
            f"Your new question MUST cover a different aspect or topic:\n{existing_list}\n"
        )
    else:
        existing_note = ""

    # Select prompt template
    prompts = {
        "mcq": MCQ_PROMPT,
        "tf": TF_PROMPT,
        "scenario": SCENARIO_PROMPT,
        "fill_in": FILL_IN_PROMPT,
    }
    template = prompts.get(question_type, MCQ_PROMPT)
    prompt = template.format(
        difficulty=difficulty,
        context=context,
        doc_title=doc_title,
        options_count=options_count,
        existing_note=existing_note,
    )

    llm_settings = get_quiz_generation_settings()

    # Use mock for testing or if LLM is unavailable
    if llm_settings.is_mock:
        return _shuffle_mcq_options(
            _generate_mock_question(question_type, difficulty, context, chunk_ids, doc_title=doc_title)
        )

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            raw = await generate_chat_completion(
                [
                    {"role": "system", "content": "You are a professional quiz generator. Respond ONLY with valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                llm_settings,
                json_mode=True,
                temperature=0.7,
                max_tokens=512,
            )
            result = _parse_json_response(raw)
            question = _validate_question(result, question_type, difficulty, chunk_ids)
            question["source_document"] = doc_title
            return _shuffle_mcq_options(question)
        except Exception as e:
            last_error = e
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)

    logger.error(f"LLM generation failed for {question_type}/{difficulty} after 3 attempts: {last_error}")
    logger.info("Falling back to mock question generator")
    return _shuffle_mcq_options(_generate_mock_question(question_type, difficulty, context, chunk_ids))


def _validate_question(
    raw: Dict,
    expected_type: str,
    expected_difficulty: str,
    chunk_ids: List[str]
) -> Dict:
    """Validate and normalize LLM output to match QuizQuestion schema."""
    qid = f"q_{uuid.uuid4().hex[:8]}"

    question = {
        "id": qid,
        "type": raw.get("type", expected_type),
        "difficulty": raw.get("difficulty", expected_difficulty),
        "question": raw.get("question", ""),
        "explanation": raw.get("explanation", ""),
        "source_chunks": chunk_ids,
    }

    # Type-specific validation
    if expected_type == "mcq":
        options = raw.get("options", [])
        if not isinstance(options, list) or len(options) < 2:
            options = ["Option A", "Option B", "Option C", "Option D"]
        question["options"] = options
        correct_idx = raw.get("correct_index", 0)
        if not isinstance(correct_idx, int) or correct_idx >= len(options):
            correct_idx = 0
        question["correct_index"] = correct_idx

    elif expected_type == "tf":
        answer = raw.get("correct_answer")
        if not isinstance(answer, bool):
            answer = str(answer).lower() in ("true", "1", "yes")
        question["correct_answer"] = answer

    elif expected_type == "scenario":
        question["correct_answer"] = raw.get("correct_answer", "")
        question["rubric"] = raw.get("rubric", "")

    elif expected_type == "fill_in":
        question["correct_answer"] = raw.get("correct_answer", "")

    # Ensure question text is not empty
    if not question["question"]:
        raise ValueError("Generated question has empty text")

    return question


# ── Full Quiz Generation ─────────────────────────────────────────────────────

async def generate_quiz(
    chunks: List[Dict],
    question_types: Dict[str, int],
    difficulty_mix: Dict[str, float],
    title: str = "Generated Quiz",
    options_count: int = 4,
    existing_questions: List[str] = None
) -> Dict:
    """
    Generate a complete quiz from retrieved chunks.

    Args:
        chunks: Retrieved chunk dicts (with text, _id, section).
        question_types: e.g., {"mcq": 7, "tf": 3}
        difficulty_mix: e.g., {"easy": 0.3, "medium": 0.5, "hard": 0.2}
        title: Quiz title.
        options_count: Number of MCQ options.

    Returns:
        Quiz dict matching Quiz schema.
    """
    total_questions = sum(question_types.values())
    questions = []
    all_chunk_ids = []
    difficulty_counts = {"easy": 0, "medium": 0, "hard": 0}

    # Calculate difficulty distribution
    difficulty_targets = {
        d: max(1, round(total_questions * pct))
        for d, pct in difficulty_mix.items()
        if pct > 0
    }
    # Adjust to match total
    while sum(difficulty_targets.values()) > total_questions:
        # Remove from the largest
        max_d = max(difficulty_targets, key=difficulty_targets.get)
        difficulty_targets[max_d] -= 1
    while sum(difficulty_targets.values()) < total_questions:
        max_d = max(difficulty_mix, key=difficulty_mix.get)
        difficulty_targets[max_d] = difficulty_targets.get(max_d, 0) + 1

    # Create a difficulty queue
    difficulty_queue = []
    for d, count in difficulty_targets.items():
        difficulty_queue.extend([d] * count)

    # Pre-compute per-question assignments so we can fire them all in parallel
    task_specs = []
    chunk_idx = 0
    question_idx = 0

    for q_type, count in question_types.items():
        for i in range(count):
            if question_idx >= len(difficulty_queue):
                break

            difficulty = difficulty_queue[question_idx]

            selected_chunks = []
            if chunks:
                c1 = chunks[chunk_idx % len(chunks)]
                selected_chunks.append(c1)
                chunk_idx += 1
                if q_type == "scenario" and len(chunks) > 1:
                    c2 = chunks[chunk_idx % len(chunks)]
                    selected_chunks.append(c2)
                    chunk_idx += 1

            context = "\n\n".join(c["text"][:800] for c in selected_chunks)
            chunk_ids = [str(c["_id"]) for c in selected_chunks]
            all_chunk_ids.extend(chunk_ids)
            task_specs.append((q_type, difficulty, context, chunk_ids))
            question_idx += 1

    # Generate all questions concurrently (semaphore caps Ollama concurrency)
    sem = asyncio.Semaphore(QUIZ_LLM_MAX_CONCURRENT)

    async def _gen(q_type, difficulty, context, chunk_ids):
        async with sem:
            return await generate_question(
                question_type=q_type,
                difficulty=difficulty,
                context=context,
                chunk_ids=chunk_ids,
                doc_title=title,
                options_count=options_count,
                existing_questions=existing_questions,
            )

    questions = list(await asyncio.gather(*[
        _gen(qt, d, ctx, cids) for qt, d, ctx, cids in task_specs
    ]))

    for _, difficulty, _, _ in task_specs:
        difficulty_counts[difficulty] = difficulty_counts.get(difficulty, 0) + 1

    # Build quiz document
    quiz = {
        "title": title,
        "generated_at": datetime.utcnow(),
        "difficulty_distribution": difficulty_counts,
        "questions": questions,
        "source_chunk_ids": list(set(all_chunk_ids)),
        "overlap_score": None,
        "status": "draft",
    }

    logger.info(f"Generated quiz '{title}' with {len(questions)} questions: "
                f"{difficulty_counts}")
    return quiz
