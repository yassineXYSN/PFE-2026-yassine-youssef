from pydantic import Field
from typing import Optional, List, Union
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
    status: str = "published"
    salary_range: Optional[str] = None
    missions: Optional[Union[str, List[str]]] = None
    work_mode: str = "onsite"
    experience_level: str = "junior"
    screening_questions: List[str] = []
    deadline: Optional[str] = None
    notification_email: Optional[str] = ""
    benefits: List[str] = []
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

class JobCreate(MongoBaseModel):
    title: str
    company_id: str
    department_id: Optional[str] = None
    description: str
    requirements: List[str] = []
    location: Optional[str] = None
    type: str = "full-time"
    salary_range: Optional[str] = None
    missions: Optional[Union[str, List[str]]] = None
    work_mode: str = "onsite"
    experience_level: str = "junior"
    screening_questions: List[str] = []
    deadline: Optional[str] = None
    notification_email: Optional[str] = ""
    benefits: List[str] = []

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
    missions: Optional[Union[str, List[str]]] = None
    work_mode: Optional[str] = None
    experience_level: Optional[str] = None
    screening_questions: Optional[List[str]] = None
    deadline: Optional[str] = None
    notification_email: Optional[str] = None
    benefits: Optional[List[str]] = None
