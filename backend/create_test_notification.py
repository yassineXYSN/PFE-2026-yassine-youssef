import asyncio
import sys
import os

# Add the backend directory to the Python path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.mongodb_async import get_async_db
from utils.notifications import create_notification

async def main():
    if len(sys.argv) < 2:
        print("Usage: python create_test_notification.py <user_id> [title] [message]")
        sys.exit(1)

    user_id = sys.argv[1]
    title = sys.argv[2] if len(sys.argv) > 2 else "Test Notification"
    message = sys.argv[3] if len(sys.argv) > 3 else "This is a test notification generated from the script."

    print(f"Connecting to database...")
    db = get_async_db()
    
    print(f"Creating notification for user: {user_id}")
    try:
        notif_id = await create_notification(
            db=db,
            user_id=user_id,
            title=title,
            message=message,
            category="system",
            notification_type="info",
            link="/candidat/dashboard/notifications" # Or wherever
        )
        print(f"Successfully created notification with ID: {notif_id}")
    except Exception as e:
        print(f"Error creating notification: {e}")

if __name__ == "__main__":
    asyncio.run(main())
