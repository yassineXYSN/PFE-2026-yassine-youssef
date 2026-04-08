import asyncio
from database.mongodb_async import get_async_db

async def main():
    db = get_async_db()
    hr_jobs = await db.hr_jobs.find().to_list(1)
    if hr_jobs:
        print("Sample hr_job:")
        print(hr_jobs[0])
    
    companies = await db.hr_companies.find().to_list(1)
    if companies:
        print("Sample hr_company:")
        print(companies[0])
    else:
        # maybe enterprise info is in hr_profiles?
        profiles = await db.hr_profiles.find().to_list(1)
        if profiles:
            print("Sample hr_profile:")
            print(profiles[0])

try:
    asyncio.run(main())
except Exception as e:
    print(e)
