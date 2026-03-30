import asyncio
from datetime import datetime
from bson import ObjectId
from utils.schedulers import _send_reminder
from database.mongodb import connect_mongodb
from database.mongodb_async import get_async_db
from utils.notifications import create_notification

async def force_send():
    print("Forcing 5m notification for all scheduled interviews...")
    db = connect_mongodb()["HumatiQ"]
    async_db = get_async_db()
    
    interviews = list(db.hr_interviews.find({"status": "scheduled"}))
    for interview in interviews:
        iid = str(interview["_id"])
        print(f"Triggering for interview {iid}...")
        
        # Force 5m email
        await _send_reminder(interview, "5m")
        print("Email sent!")
        
        # Force in-app notification
        app_id = interview.get("application_id")
        if app_id:
            try:
                app_doc = db.job_applications.find_one({"_id": ObjectId(app_id)})
                if app_doc:
                    candidate_id = app_doc.get("candidate_id") or app_doc.get("user_id")
                    if candidate_id:
                        await create_notification(
                            async_db,
                            user_id=str(candidate_id),
                            title="Entretien imminent (Test)",
                            message="Votre entretien commence dans 5 minutes. Cliquez ici pour rejoindre la salle.",
                            category="interview",
                            notification_type="info",
                            link=f"/candidat/interviews/room/{iid}"
                        )
                        print("In-app notification created!")
            except Exception as e:
                print(f"Error creating in-app: {e}")
        
if __name__ == "__main__":
    asyncio.run(force_send())
