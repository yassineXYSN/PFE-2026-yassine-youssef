from pydantic import Field, field_validator
from typing import Optional, List, Any
from datetime import datetime
from .core import MongoBaseModel

class CompanyBase(MongoBaseModel):
    name: str
    siret: Optional[str] = None
    domain: Optional[str] = None          # sector / domain d'activité
    size: Optional[str] = None            # company size
    description: Optional[str] = None
    values: Optional[List[str]] = []
    benefits: Optional[List[str]] = []

    @field_validator('values', 'benefits', mode='before')
    @classmethod
    def convert_string_to_list(cls, v: Any) -> Any:
        if isinstance(v, str):
            return [item.strip() for item in v.split(',') if item.strip()]
        return v
    # Contact
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_email: Optional[str] = None   # alias used by onboarding form
    contact_phone: Optional[str] = None   # alias used by onboarding form
    website: Optional[str] = None
    # Address
    address: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Branding
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    # Social
    linkedin: Optional[str] = None
    twitter: Optional[str] = None
    # Company Info
    employee_count: Optional[int] = None
    # Stats (virtual / aggregated fields)
    users_count: Optional[int] = 0
    jobs_count: Optional[int] = 0
    # Meta
    status: str = "active"
    onboarding_done: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CompanyCreate(MongoBaseModel):
    name: str
    siret: Optional[str] = None
    domain: Optional[str] = None
    description: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class CompanyUpdate(MongoBaseModel):
    name: Optional[str] = None
    siret: Optional[str] = None
    domain: Optional[str] = None
    size: Optional[str] = None
    description: Optional[str] = None
    values: Optional[List[str]] = None
    benefits: Optional[List[str]] = None
    # Contact (both aliases accepted)
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    # Address
    address: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Branding
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    # Social
    linkedin: Optional[str] = None
    twitter: Optional[str] = None
    # Company Info
    employee_count: Optional[int] = None
    # Status
    status: Optional[str] = None
    onboarding_done: Optional[bool] = None

    @field_validator('values', 'benefits', mode='before')
    @classmethod
    def convert_string_to_list(cls, v: Any) -> Any:
        if isinstance(v, str):
            return [item.strip() for item in v.split(',') if item.strip()]
        return v
