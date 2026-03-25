from pydantic import Field
from typing import Optional, Dict, Any
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
