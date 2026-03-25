import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database.mongodb_async import get_async_db

async def reset():
    db = get_async_db()
    print("Resetting all published quizzes to 'draft'...")
    res = await db.quizzes.update_many(
        {"status": "published"},
        {"$set": {"status": "draft"}}
    )
    print(f"Quizzes reset: {res.modified_count}")

    print("Resetting job_applications with quiz_status to pending...")
    res2 = await db.job_applications.update_many(
        {"quiz_status": {"$exists": True}},
        {"$unset": {"quiz_status": "", "last_quiz_sent_at": ""}}
    )
    print(f"Applications reset: {res2.modified_count}")
    
if __name__ == "__main__":
    asyncio.run(reset())
