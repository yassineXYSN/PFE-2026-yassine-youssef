from pydantic import Field
from typing import Optional
from datetime import datetime
from .core import MongoBaseModel

class SuperAdmin(MongoBaseModel):
    id: str = Field(alias="_id")  # Supabase Auth UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    role: str = "superadmin"
    status: str = "active"
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
