import asyncio
import os
import sys
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Ensure backend root is in path
sys.path.append(os.getcwd())

from services.ai_matching import AIMatchingService

async def test():
    load_dotenv()
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL'))
    
    # Parse DB name from URL or use HumatiQ
    db_name = os.getenv('MONGODB_URL').split('/')[-1].split('?')[0] or "HumatiQ"
    db = client[db_name]
    
    ai = AIMatchingService(db=db)
    job_id = '69affdd57e0a5b9f7d231423'
    
    print(f"Finding job {job_id}...")
    job = await db.hr_jobs.find_one({'_id': ObjectId(job_id)})
    if not job:
        print("Job not found!")
        return

    print(f"Finding matches for: {job.get('title')}...")
    results = await ai.find_top_candidates_for_job(job['description'], limit=5)
    
    print(f"\nFound {len(results)} matches:")
    for r in results:
        print(f" - {r.get('firstName')} {r.get('lastName')} (ID: {r.get('_id')}): score={r.get('score')}")
        
    await ai.close()
    client.close()

if __name__ == "__main__":
    asyncio.run(test())
