from pydantic import Field
from typing import Optional, List
from datetime import datetime
from .core import MongoBaseModel

class JobBase(MongoBaseModel):
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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Metrics (Computed)
    candidate_count: Optional[int] = 0
    best_ai_score: Optional[int] = 0

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

class JobUpdate(MongoBaseModel):
    title: Optional[str] = None
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
