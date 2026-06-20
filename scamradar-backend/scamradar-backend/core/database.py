import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

client = None
db = None

async def connect_db():
    global client, db
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DB_NAME", "scamradar")
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]

    # Create indexes for fast search
    await db.entities.create_index("value")
    await db.entities.create_index("type")
    await db.entities.create_index([("value", "text")])
    await db.reports.create_index("created_at")
    await db.reports.create_index("entity_ids")
    await db.disputes.create_index("entity_value")

    print("✅ Connected to MongoDB")

async def close_db():
    global client
    if client:
        client.close()
        print("MongoDB connection closed")

def get_db():
    return db
