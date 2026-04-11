import asyncio
import logging
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

import sys
from pathlib import Path

# Add the backend root to the system path so we can import services
backend_root = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_root))

from services.ai_matching import AIMatchingService

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

async def run_vectorization():
    logger.info("Démarrage du script de vectorisation des profils...")
    
    # Load .env
    dotenv_path = backend_root / '.env'
    load_dotenv(dotenv_path)
    mongo_url = os.getenv("MONGODB_URL")
    
    if not mongo_url:
        logger.error("MONGODB_URL manquante dans .env")
        return

    # 1. Connect to MongoDB with Motor (Async)
    client = None
    try:
        # Check if we need to disable TLS verification for local/Windows dev
        use_certifi = not os.getenv("MONGODB_ATLAS_TLS_INSECURE", "").lower() in ("1", "true", "yes")
        client_options = {"serverSelectionTimeoutMS": 5000}
        
        if use_certifi:
            import certifi
            client_options["tlsCAFile"] = certifi.where()
        else:
            client_options["tlsAllowInvalidCertificates"] = True

        client = AsyncIOMotorClient(mongo_url, **client_options)
        
        # We need the specific database. Parse it from URL or default to 'HumatiQ'
        db_name = mongo_url.split('/')[-1].split('?')[0]
        if not db_name or db_name == "":
            db_name = "HumatiQ"
            
        db = client[db_name]
        
    except Exception as e:
        logger.error(f"Erreur de connexion à MongoDB (Motor): {e}")
        return

    # 2. Init AI Matching Service
    ai_service = AIMatchingService(db=db)

    try:
        # 3. Find all candidates without an embedding (or all if we want to force refresh)
        # Using 'candidatures' or 'candidates' depending on your schema. Let's check both or the active one.
        collection = db.candidatures 
        
        # We can look for documents where "embedding" field does not exist or is empty
        # Or remove the filter to FORCE re-vectorization
        query = {} # {"embedding": {"$exists": False}}
        
        # If 'candidatures' is empty, try 'candidates'
        count = await collection.count_documents(query)
        if count == 0:
             collection = db.candidates
             count = await collection.count_documents(query)

        logger.info(f"Trouvé {count} profils à vectoriser dans '{collection.name}'.")

        cursor = collection.find(query)
        
        processed = 0
        success = 0
        async for candidate in cursor:
            candidate_id = str(candidate["_id"])
            logger.info(f"Traitement du profil: {candidate_id}")
            
            result = await ai_service.vectorize_and_save_profile(candidate_id)
            if result:
                success += 1
            processed += 1
            
            # Small delay to not overload the local Ollama instance
            await asyncio.sleep(0.5)

        logger.info(f"Vectorisation terminée. {success}/{processed} profils mis à jour.")

    except Exception as e:
        logger.error(f"Erreur durant la vectorisation: {e}")
    finally:
        await ai_service.close()
        if client:
            client.close()

if __name__ == "__main__":
    asyncio.run(run_vectorization())
