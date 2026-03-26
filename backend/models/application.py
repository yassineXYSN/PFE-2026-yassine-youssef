from pydantic import Field
from typing import Optional, Dict, Any
from datetime import datetime
from .core import MongoBaseModel

class JobApplicationBase(MongoBaseModel):
    candidate_id: str
    job_id: str
    motivation_letter: str
    status: str = "pending"
    profile_snapshot: Optional[Dict[str, Any]] = None
    applied_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Quiz related fields
    quiz_score: Optional[float] = None
    quiz_status: Optional[str] = None
    quiz_attempts: int = 0
    quiz_completed_at: Optional[datetime] = None
    quiz_ai_analysis: Optional[str] = None
    quiz_ai_evaluated_at: Optional[datetime] = None

    # Enriched fields for candidate view
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    location: Optional[str] = None
    salary: Optional[str] = None

class JobApplicationCreate(MongoBaseModel):
    job_id: str
    motivation_letter: str
