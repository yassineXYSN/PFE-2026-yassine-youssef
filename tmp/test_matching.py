import asyncio
import logging
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import sys
from pathlib import Path
from bson import ObjectId

# Add the backend root to the system path
backend_root = Path(__file__).resolve().parent.parent / "backend"
sys.path.append(str(backend_root))

from services.ai_matching import AIMatchingService
from database.mongodb_async import get_async_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
logger = logging.getLogger(__name__)

async def test_matching():
    logger.info("Starting AI Matching Verification...")
    db = get_async_db()
    ai_service = AIMatchingService(db=db)
    
    try:
        # 1. Get a sample job
        job = await db.hr_jobs.find_one({})
        if not job:
            logger.error("No jobs found in the database to test with.")
            return

        job_id = str(job["_id"])
        job_title = job.get("title", "Unknown")
        job_desc = job.get("description", "")
        
        logger.info(f"Testing with Job: {job_title} (ID: {job_id})")
        logger.info(f"Description snippet: {job_desc[:100]}...")

        # 2. Phase 2: Vector Search
        logger.info("--- Phase 2: Vector Search ---")
        top_candidates = await ai_service.find_top_candidates_for_job(job_desc, limit=3)
        
        if not top_candidates:
            logger.warning("No candidates returned by Vector Search. Ensure 'default' index is ACTIVE in Atlas.")
            return

        logger.info(f"Found {len(top_candidates)} potential matches.")

        # 3. Phase 3: LLM Analysis
        logger.info("--- Phase 3: Deep Analysis (Qwen) ---")
        for i, cand in enumerate(top_candidates):
            name = f"{cand.get('firstName', '')} {cand.get('lastName', '')}".strip() or "Unknown"
            logger.info(f"Analyzing Candidate {i+1}: {name} (ID: {cand['_id']})")
            
            analysis = await ai_service.evaluate_candidate_with_llm(job_desc, cand)
            
            logger.info(f"  > AI Score: {analysis.get('score')}/100")
            logger.info(f"  > AI Justification: {analysis.get('justification')}")
            print("-" * 50)

    except Exception as e:
        logger.error(f"Error during verification: {e}")
    finally:
        await ai_service.close()

if __name__ == "__main__":
    asyncio.run(test_matching())
