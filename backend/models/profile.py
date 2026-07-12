from pydantic import Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from .core import MongoBaseModel

class ProfileBase(MongoBaseModel):
    # 'id' is inherited from MongoBaseModel but we will explicitly set it to str
    id: str = Field(alias="_id") # UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    role: str = "candidat"
    status: str = "pending"
    company_id: Optional[str] = None
    department_id: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    skills: List[Any] = []
    experience: List[Dict[str, Any]] = []
    education: List[Dict[str, Any]] = []
    social_links: Dict[str, str] = {}
    preferences: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}
    profileStrength: Optional[int] = 0
    profileMissing: Optional[List[str]] = []
    is_demo: bool = False
    demo_expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ProfileCreate(MongoBaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: str = "admin"
    status: str = "active"
    company_id: Optional[str] = None
    department_id: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    preferences: Dict[str, Any] = {}
    is_demo: bool = False
    demo_expires_at: Optional[datetime] = None

class ProfileUpdate(MongoBaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    company_id: Optional[str] = None
    department_id: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None
    # Note: PUT filters `v is not None`, so `is_demo=false` persists correctly
    # (False is not None) but `demo_expires_at=null` cannot be used to clear
    # an existing expiry via this endpoint (v1 limitation).
    is_demo: Optional[bool] = None
    demo_expires_at: Optional[datetime] = None
