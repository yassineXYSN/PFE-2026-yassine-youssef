import sys
sys.path.insert(0, 'backend')
import asyncio
from database.mongodb_async import get_async_db
from bson import ObjectId
from routers.ai_analysis import analyze_candidate_from_db, _extract_skills_from_candidate
from services.job_market_ai_service import get_ai_engine

async def main():
    db = get_async_db()
    candidate_id = "1756b814-65b2-4698-b323-809dd1dd7236"
    
    candidate = None
    if ObjectId.is_valid(candidate_id):
        candidate = await db.candidates.find_one({"_id": ObjectId(candidate_id)})
    if not candidate:
        candidate = await db.candidates.find_one({"user_id": candidate_id})
        
    if not candidate:
        print("Candidate not found in DB")
        return
        
    print("Candidate found:", candidate.get("name") or candidate.get("firstName"))
    skills = _extract_skills_from_candidate(candidate)
    print("Skills:", skills)
    
    try:
        get_ai_engine()
        print("Engine loaded successfully")
    except Exception as e:
        print("Engine Error:", str(e))
        return

if __name__ == '__main__':
    asyncio.run(main())
