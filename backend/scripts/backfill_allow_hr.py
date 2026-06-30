import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.mongodb_async import get_async_db

async def backfill_allow_hr():
    db = get_async_db()
    print("Starting backfill for allow_hr...")
    
    jobs = await db.hr_jobs.find({}).to_list(length=None)
    updated_count = 0
    
    for job in jobs:
        if "allow_hr" in job:
            continue
            
        allow_hr = True
        
        # If AI automation is enabled and quiz stage is enabled
        if job.get("ai_automation") and job["ai_automation"].get("enabled"):
            quiz_config = job["ai_automation"].get("quiz_stage", {})
            if quiz_config.get("enabled"):
                # If deadline has not been processed yet, HR should not access it
                if not job.get("deadline_processed", False):
                    allow_hr = False
                    
        await db.hr_jobs.update_one(
            {"_id": job["_id"]},
            {"$set": {"allow_hr": allow_hr}}
        )
        updated_count += 1
        
    print(f"Successfully backfilled {updated_count} jobs with 'allow_hr' flag.")

if __name__ == "__main__":
    asyncio.run(backfill_allow_hr())
