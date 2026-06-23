from pydantic import Field
from typing import Optional
from datetime import datetime
from .core import MongoBaseModel

class DepartmentBase(MongoBaseModel):
    name: str
    company_id: str
    description: Optional[str] = None
    manager_id: Optional[str] = None
    status: str = "active"
    color: str = "black"
    icon: str = "group"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class DepartmentCreate(MongoBaseModel):
    name: str
    company_id: str
    description: Optional[str] = None
    manager_id: Optional[str] = None
    color: str = "black"
    icon: str = "group"

class DepartmentUpdate(MongoBaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    manager_id: Optional[str] = None
    status: Optional[str] = None
