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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class JobCreate(MongoBaseModel):
    title: str
    company_id: str
    department_id: Optional[str] = None
    description: str
    requirements: List[str] = []
    location: Optional[str] = None
    type: str = "full-time"
    salary_range: Optional[str] = None

class JobUpdate(MongoBaseModel):
    title: Optional[str] = None
    department_id: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[List[str]] = None
    location: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    salary_range: Optional[str] = None
