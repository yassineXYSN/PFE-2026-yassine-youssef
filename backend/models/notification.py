from pydantic import Field
from typing import Optional, Dict, Any
from datetime import datetime
from .core import MongoBaseModel

class Notification(MongoBaseModel):
    user_id: str
    type: str  # 'info', 'success', 'warning', 'error'
    category: str # 'quiz', 'application', 'system'
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class NotificationCreate(MongoBaseModel):
    user_id: str
    type: str = "info"
    category: str = "system"
    title: str
    message: str
    link: Optional[str] = None
    metadata: Dict[str, Any] = {}
