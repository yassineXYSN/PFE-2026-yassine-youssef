from pydantic import Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from .core import MongoBaseModel

class InterviewBase(MongoBaseModel):
    company_id: str
    candidate_name: str
    candidate_email: str
    type: str
    start_time: datetime
    end_time: datetime
    status: str = "pending"
    emotion_history: List[Dict[str, Any]] = []
    transcript: List[Dict[str, Any]] = []
    ai_analysis: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
class InterviewCreate(MongoBaseModel):
    company_id: str
    candidate_name: str
    candidate_email: str
    type: str
    start_time: datetime
    end_time: datetime

class InterviewUpdate(MongoBaseModel):
    status: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class InterviewProposalCreate(MongoBaseModel):
    application_id: str
    company_id: Optional[str] = None
    candidate_name: str
    candidate_email: str
    slots: List[datetime]
    duration_minutes: int = 45
    interview_type: str = "Video call"
    message: Optional[str] = None
    recruiter_id: Optional[str] = None

class InterviewSlotConfirm(MongoBaseModel):
    proposal_id: str
    selected_slot: datetime
