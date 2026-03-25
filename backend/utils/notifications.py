from typing import Optional, Dict, Any
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from models.notification import Notification

async def create_notification(
    db: AsyncIOMotorDatabase,
    user_id: str,
    title: str,
    message: str,
    category: str = "system",
    notification_type: str = "info",
    link: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Create a notification in the database.
    """
    notif_data = {
        "user_id": user_id,
        "title": title,
        "message": message,
        "category": category,
        "type": notification_type,
        "link": link,
        "is_read": False,
        "metadata": metadata or {},
        "created_at": datetime.utcnow()
    }
    
    result = await db.notifications.insert_one(notif_data)
    return str(result.inserted_id)

async def mark_notification_read(db: AsyncIOMotorDatabase, notif_id: str, user_id: str):
    """Mark a notification as read."""
    from bson import ObjectId
    await db.notifications.update_one(
        {"_id": ObjectId(notif_id), "user_id": user_id},
        {"$set": {"is_read": True}}
    )

async def delete_notification(db: AsyncIOMotorDatabase, notif_id: str, user_id: str):
    """Delete a notification."""
    from bson import ObjectId
    await db.notifications.delete_one({"_id": ObjectId(notif_id), "user_id": user_id})
