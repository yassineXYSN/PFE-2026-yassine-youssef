import asyncio
from database.mongodb_async import get_async_db

async def main():
    db = get_async_db()
    jobs = await db.jobs.find().to_list(10)
    hr_jobs = await db.hr_jobs.find().to_list(10)
    print(f"db.jobs count: {len(jobs)}")
    print(f"db.hr_jobs count: {len(hr_jobs)}")
    
    companies = await db.companies.find().to_list(10)
    print(f"db.companies count: {len(companies)}")
    
    notifs = await db.notifications.find().sort("created_at", -1).to_list(5)
    print("Recent notifications:")
    for n in notifs:
        print(f" - {n.get('title')}: metadata={n.get('metadata')}")

try:
    asyncio.run(main())
except Exception as e:
    print(e)
