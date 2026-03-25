from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from database.mongodb_async import get_async_db
from models.notification import Notification
from middleware.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])

def _serialize(notif):
    """Convert MongoDB document to a JSON-serializable dict."""
    notif["_id"] = str(notif["_id"])
    if "created_at" in notif and isinstance(notif["created_at"], datetime):
        notif["created_at"] = notif["created_at"].isoformat()
    return notif

@router.get("/", response_model=List[dict])
async def list_notifications(
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    unread_only: bool = False
):
    """List notifications for the current user."""
    db = get_async_db()
    query = {"user_id": current_user["id"]}
    if unread_only:
        query["is_read"] = False
        
    cursor = db.notifications.find(query).sort("created_at", -1).limit(limit)
    notifications = await cursor.to_list(length=limit)
    return [_serialize(n) for n in notifications]

@router.get("/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Return the number of unread notifications."""
    db = get_async_db()
    count = await db.notifications.count_documents({
        "user_id": current_user["id"],
        "is_read": False
    })
    return {"count": count}

@router.patch("/{notif_id}/read")
async def mark_read(
    notif_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a notification as read."""
    db = get_async_db()
    if not ObjectId.is_valid(notif_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")
        
    result = await db.notifications.update_one(
        {"_id": ObjectId(notif_id), "user_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    return {"message": "Notification marked as read"}

@router.patch("/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications for the current user as read."""
    db = get_async_db()
    await db.notifications.update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

@router.delete("/{notif_id}")
async def delete_notif(
    notif_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a notification."""
    db = get_async_db()
    if not ObjectId.is_valid(notif_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")
        
    result = await db.notifications.delete_one({
        "_id": ObjectId(notif_id),
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    return {"message": "Notification deleted"}
