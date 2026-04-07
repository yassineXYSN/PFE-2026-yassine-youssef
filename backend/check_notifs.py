from database.mongodb_async import db_client
async def check():
    db = db_client.get_database()
    async for n in db.notifications.find({}):
        print(n)
import asyncio
asyncio.run(check())
