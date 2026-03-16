from pydantic import Field
from typing import Optional, Dict, Any
from datetime import datetime
from .core import MongoBaseModel

class JobApplicationBase(MongoBaseModel):
    candidate_id: str
    job_id: str
    motivation_letter: str
    status: str = "pending"
    profile_snapshot: Dict[str, Any]
    applied_at: datetime = Field(default_factory=datetime.utcnow)
    # Enriched fields for candidate view
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    location: Optional[str] = None
    salary: Optional[str] = None

class JobApplicationCreate(MongoBaseModel):
    job_id: str
    motivation_letter: str
