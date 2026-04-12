import asyncio
import os
import sys

# Ensure backend directory is in the path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database.mongodb_async import get_async_db
from services.ai_matching import AIMatchingService
from routes.candidat.jobs import _extract_text_for_embedding

async def main():
    print("Starting background embedding generation script...")
    db = get_async_db()
    ai_service = AIMatchingService(db=db)

    # 1. Process Jobs
    print("\n--- Processing Jobs (hr_jobs) ---")
    jobs_cursor = db.hr_jobs.find({"$or": [{"embedding": {"$exists": False}}, {"embedding": None}]})
    jobs = await jobs_cursor.to_list(length=None)
    print(f"Found {len(jobs)} jobs without embeddings.")
    
    count_jobs = 0
    for job in jobs:
        desc = job.get("description")
        if desc:
            print(f"Generating embedding for job {job.get('_id')}...")
            try:
                emb = await ai_service.generate_embedding(desc)
                if emb:
                    await db.hr_jobs.update_one(
                        {"_id": job["_id"]},
                        {"$set": {"embedding": emb}}
                    )
                    count_jobs += 1
            except Exception as e:
                print(f"Error generating embedding for job {job.get('_id')}: {e}")
    print(f"Successfully added embeddings to {count_jobs} jobs.")

    # 2. Process Candidates/Profiles
    print("\n--- Processing Profiles ---")
    collections = ["candidates", "candidatures", "hr_profiles"]
    
    for coll_name in collections:
        coll = db[coll_name]
        docs_cursor = coll.find({"$or": [{"embedding": {"$exists": False}}, {"embedding": None}]})
        docs = await docs_cursor.to_list(length=None)
        
        if docs:
            print(f"Found {len(docs)} profiles without embeddings in collection '{coll_name}'.")
            count_docs = 0
            for doc in docs:
                text = _extract_text_for_embedding(doc)
                if text and text != "Profil vide.":
                    print(f"Generating embedding for profile {doc.get('_id')} in '{coll_name}'...")
                    try:
                        emb = await ai_service.generate_embedding(text)
                        if emb:
                            await coll.update_one(
                                {"_id": doc["_id"]},
                                {"$set": {"embedding": emb}}
                            )
                            count_docs += 1
                    except Exception as e:
                        print(f"Error on profile {doc.get('_id')}: {e}")
            print(f"Successfully added embeddings to {count_docs} profiles in '{coll_name}'.")
        else:
            print(f"No profiles without embeddings found in '{coll_name}'.")

    await ai_service.close()
    print("\nBatch vectorization complete!")

if __name__ == "__main__":
    asyncio.run(main())