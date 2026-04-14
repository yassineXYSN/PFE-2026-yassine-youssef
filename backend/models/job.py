from pydantic import Field, model_validator
from typing import Optional, List, Union
from datetime import datetime
from .core import MongoBaseModel


class AIAutomationFilter(MongoBaseModel):
    enabled: bool = True
    top_x_candidates: Optional[int] = None
    top_y_candidates: Optional[int] = None


class AIAutomationQuizConfig(MongoBaseModel):
    title: str
    document_id: str
    document_title: str
    total_questions: int = 10
    duration_minutes: int = 10
    weight_percentage: int = 100
    difficulty_mix: dict = Field(default_factory=lambda: {"easy": 0.4, "medium": 0.4, "hard": 0.2})
    deadline_mode: str = "absolute"
    deadline_at: str

    @model_validator(mode="after")
    def validate_quiz(self):
        if self.total_questions <= 0:
            raise ValueError("Quiz total_questions must be a positive integer")
        if self.duration_minutes <= 0:
            raise ValueError("Quiz duration_minutes must be a positive integer")
        if self.weight_percentage <= 0 or self.weight_percentage > 100:
            raise ValueError("Quiz weight_percentage must be between 1 and 100")
        if self.deadline_mode != "absolute":
            raise ValueError("Quiz deadline_mode must be 'absolute'")
        if not self.deadline_at:
            raise ValueError("Quiz deadline_at is required")
        if not self.document_id:
            raise ValueError("Quiz document_id is required")
        return self


class AIAutomationQuizStage(MongoBaseModel):
    enabled: bool = False
    approve_top_z_to_interview: Optional[int] = None
    quizzes: List[AIAutomationQuizConfig] = []

    @model_validator(mode="after")
    def validate_quiz_stage(self):
        if self.enabled:
            if self.approve_top_z_to_interview is None or self.approve_top_z_to_interview <= 0:
                raise ValueError("approve_top_z_to_interview must be a positive integer when quiz stage is enabled")
            if len(self.quizzes) == 0:
                raise ValueError("At least one quiz is required when quiz stage is enabled")
            total_weight = sum(quiz.weight_percentage for quiz in self.quizzes)
            if total_weight != 100:
                raise ValueError("Quiz weight_percentage values must sum to 100")
        return self


class AIAutomationConfig(MongoBaseModel):
    enabled: bool = True
    trigger_mode: str = "deadline"
    execution_enabled: bool = False
    vector_filter: AIAutomationFilter = Field(
        default_factory=lambda: AIAutomationFilter(enabled=True, top_x_candidates=25)
    )
    ai_score_filter: AIAutomationFilter = Field(
        default_factory=lambda: AIAutomationFilter(enabled=True, top_y_candidates=10)
    )
    quiz_stage: AIAutomationQuizStage = Field(default_factory=AIAutomationQuizStage)

    @model_validator(mode="after")
    def validate_pipeline(self):
        if self.trigger_mode not in {"deadline", "manual", "both"}:
            raise ValueError("trigger_mode must be one of: deadline, manual, both")

        x_value = self.vector_filter.top_x_candidates
        y_value = self.ai_score_filter.top_y_candidates
        z_value = self.quiz_stage.approve_top_z_to_interview

        if self.enabled:
            if x_value is None or x_value <= 0:
                raise ValueError("vector_filter.top_x_candidates must be a positive integer")
            if y_value is None or y_value <= 0:
                raise ValueError("ai_score_filter.top_y_candidates must be a positive integer")
            if x_value <= y_value:
                raise ValueError("vector_filter.top_x_candidates must be greater than ai_score_filter.top_y_candidates")

            if self.quiz_stage.enabled:
                if z_value is None or z_value <= 0:
                    raise ValueError("quiz_stage.approve_top_z_to_interview must be a positive integer")
                if y_value <= z_value:
                    raise ValueError("ai_score_filter.top_y_candidates must be greater than quiz_stage.approve_top_z_to_interview")
        return self

class JobBase(MongoBaseModel):
    title: str
    company_id: str
    department_id: Optional[str] = None
    description: str
    requirements: List[str] = []
    location: Optional[str] = None
    type: str = "full-time"
    status: str = "published"
    salary_range: Optional[str] = None
    missions: Optional[Union[str, List[str]]] = None
    work_mode: str = "onsite"
    experience_level: str = "junior"
    screening_questions: List[str] = []
    deadline: Optional[str] = None
    notification_email: Optional[str] = ""
    benefits: List[str] = []
    require_motivation_letter: bool = False
    benfits: Optional[List[str]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    # Joined fields
    company: Optional[str] = None
    logo: Optional[str] = None
    company_about: Optional[str] = None
    company_industry: Optional[str] = None
    company_size: Optional[str] = None
    company_founded: Optional[str] = None
    company_address: Optional[str] = None
    candidate_count: int = 0
    avg_ai_score: Optional[int] = None
    best_ai_score: Optional[int] = None
    ai_automation: Optional[AIAutomationConfig] = None

class JobCreate(MongoBaseModel):
    title: str
    company_id: str
    department_id: Optional[str] = None
    description: str
    requirements: List[str] = []
    location: Optional[str] = None
    type: str = "full-time"
    status: str = "open"
    salary_range: Optional[str] = None
    missions: Optional[str] = None
    work_mode: Optional[str] = None
    experience_level: Optional[str] = None
    screening_questions: List[str] = []
    notification_email: Optional[str] = None
    deadline: Optional[str] = None
    benefits: List[str] = []
    require_motivation_letter: bool = False
    ai_automation: Optional[AIAutomationConfig] = None

class JobUpdate(MongoBaseModel):
    title: Optional[str] = None
    company_id: Optional[str] = None
    department_id: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[List[str]] = None
    location: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    salary_range: Optional[str] = None
    missions: Optional[str] = None
    work_mode: Optional[str] = None
    experience_level: Optional[str] = None
    screening_questions: Optional[List[str]] = None
    notification_email: Optional[str] = None
    deadline: Optional[str] = None
    benefits: Optional[List[str]] = None
    require_motivation_letter: Optional[bool] = None
    ai_automation: Optional[AIAutomationConfig] = None
