import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check_db():
    env_path = r"c:\Users\youss\Documents\PFE-2026-yassine-youssef\backend\.env"
    load_dotenv(env_path)
    mongo_url = os.getenv("MONGODB_URL")
    
    if not mongo_url:
        print(f"Error: MONGODB_URL not found in {env_path}")
        return

    client = AsyncIOMotorClient(mongo_url, tlsAllowInvalidCertificates=True)
    db = client["HumatiQ"]
    print(f"--- Collections in {db.name} ---")
    collections = await db.list_collection_names()
    for coll_name in collections:
        count = await db[coll_name].count_documents({})
        print(f"- {coll_name}: {count} documents")
    
    if "jobs" in collections:
        print("\n--- Sample Job ---")
        job = await db.jobs.find_one({})
        print(job)

    client.close()
    print("Done. Results saved to tmp/candidates_dump.txt")

if __name__ == "__main__":
    asyncio.run(check_db())
