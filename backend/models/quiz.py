"""
Pydantic models for the Quiz Generation System.
Defines request/response schemas and database document models.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


# ── Enums ────────────────────────────────────────────────────────────────────

class FileType(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    PPTX = "pptx"
    IMAGE = "image"


class DocumentStatus(str, Enum):
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


class QuestionType(str, Enum):
    MCQ = "mcq"
    TF = "tf"
    SCENARIO = "scenario"
    FILL_IN = "fill_in"


class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class QuizStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class AuditAction(str, Enum):
    DOCUMENT_UPLOADED = "document_uploaded"
    QUIZ_GENERATED = "quiz_generated"
    QUIZ_EXPORTED = "quiz_exported"
    TEMPLATE_CREATED = "template_created"


# ── Document Models ──────────────────────────────────────────────────────────

class SectionInfo(BaseModel):
    title: str
    start_chunk: int
    end_chunk: int


class DocumentMetadata(BaseModel):
    page_count: Optional[int] = None
    language: Optional[str] = "en"
    category: Optional[str] = None


class QuizDocument(BaseModel):
    """Represents an uploaded HR training document."""
    title: str
    filename: str
    file_type: FileType
    gridfs_file_id: Optional[str] = None
    uploaded_by: str = "system"
    company_id: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    status: DocumentStatus = DocumentStatus.PROCESSING
    total_chunks: int = 0
    total_tokens: int = 0
    sections: List[SectionInfo] = []
    metadata: DocumentMetadata = DocumentMetadata()


# ── Chunk Models ─────────────────────────────────────────────────────────────

class QuizChunk(BaseModel):
    """A text chunk with embedding for vector search."""
    document_id: str
    chunk_index: int
    text: str
    token_count: int
    section: str = ""
    embedding: Optional[List[float]] = None
    usage_count: int = 0
    last_used_at: Optional[datetime] = None
    question_types_generated: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ── Question Models ──────────────────────────────────────────────────────────

class QuizQuestion(BaseModel):
    """A single quiz question with provenance tracking."""
    id: str = Field(default_factory=lambda: f"q_{uuid.uuid4().hex[:8]}")
    type: QuestionType
    difficulty: Difficulty
    question: str
    options: Optional[List[str]] = None          # For MCQ
    correct_index: Optional[int] = None           # For MCQ
    correct_answer: Optional[Any] = None          # For TF (bool), fill_in (str)
    explanation: str = ""
    source_chunks: List[str] = []                 # chunk ObjectId references
    rubric: Optional[str] = None                  # For scenario questions


# ── Quiz Models ──────────────────────────────────────────────────────────────

class Quiz(BaseModel):
    """A generated quiz with questions and provenance."""
    title: str
    document_id: str
    template_id: Optional[str] = None
    generated_by: str = "system"
    company_id: Optional[str] = None
    application_id: Optional[str] = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    duration_minutes: int = Field(default=10, ge=1, le=180)
    difficulty_distribution: Dict[str, int] = {"easy": 0, "medium": 0, "hard": 0}
    questions: List[QuizQuestion] = []
    source_chunk_ids: List[str] = []
    overlap_score: Optional[float] = None
    status: QuizStatus = QuizStatus.DRAFT


# ── Template Models ──────────────────────────────────────────────────────────

class QuestionTypeConfig(BaseModel):
    count: int
    options_count: Optional[int] = 4  # Only for MCQ


class DistractorRules(BaseModel):
    min_plausibility: str = "medium"  # low, medium, high
    avoid_obvious_wrong: bool = True


class TemplateConfig(BaseModel):
    total_questions: int = 10
    question_types: Dict[str, QuestionTypeConfig] = {
        "mcq": QuestionTypeConfig(count=7, options_count=4),
        "tf": QuestionTypeConfig(count=3)
    }
    difficulty_mix: Dict[str, float] = {"easy": 0.3, "medium": 0.5, "hard": 0.2}
    distractor_rules: DistractorRules = DistractorRules()
    sections_filter: List[str] = []
    max_chunk_reuse: int = 3


class QuizTemplate(BaseModel):
    """A template for quiz generation parameters."""
    name: str
    description: str = ""
    created_by: str = "system"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    config: TemplateConfig = TemplateConfig()


# ── Request/Response Models ──────────────────────────────────────────────────

class GenerateQuizRequest(BaseModel):
    """Request body for quiz generation."""
    document_id: str
    template_id: Optional[str] = None
    application_id: Optional[str] = None
    title: Optional[str] = None
    total_questions: int = 10
    duration_minutes: int = Field(default=10, ge=1, le=180)
    difficulty_mix: Optional[Dict[str, float]] = None
    question_types: Optional[Dict[str, int]] = None  # e.g., {"mcq": 7, "tf": 3}
    sections_filter: Optional[List[str]] = None


class UploadDocumentResponse(BaseModel):
    document_id: str
    filename: str
    status: str
    message: str


class QuizSummary(BaseModel):
    """Lightweight quiz representation for list views."""
    id: str
    title: str
    document_id: str
    generated_at: str
    total_questions: int
    duration_minutes: int = 10
    status: str
    difficulty_distribution: Dict[str, int]

class AnswerSubmission(BaseModel):
    """Candidate's answer to a single question."""
    question_id: str
    answer: Any # index for MCQ, bool for TF, string for others

class QuizSubmissionRequest(BaseModel):
    """Request body for submitting quiz answers."""
    answers: List[AnswerSubmission]

class UpdateQuizQuestionsRequest(BaseModel):
    """Request body for modifying the quiz questions array."""
    questions: List[QuizQuestion]

class GenerateSingleQuestionRequest(BaseModel):
    """Request body for generating a single new question for a given quiz."""
    document_id: str
    difficulty: Optional[str] = "medium"
    type: Optional[str] = "mcq"
