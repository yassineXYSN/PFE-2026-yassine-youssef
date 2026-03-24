import httpx
import asyncio
import json

BASE_URL = "http://127.0.0.1:8000"

async def test_multi_doc_generation():
    async with httpx.AsyncClient(timeout=300.0) as client:
        # 1. Get available documents
        docs_response = await client.get(f"{BASE_URL}/api/quiz/documents")
        docs_response.raise_for_status()
        documents = docs_response.json()
        print(f"Debug: first document keys: {documents[0].keys() if documents else 'Empty'}")
        
        if len(documents) < 1:
            print("Not enough documents to test multi-doc generation.")
            return

        # Prepare request for 2 documents (or 1 if only 1 available)
        doc_configs = []
        for i, doc in enumerate(documents[:2]):
            doc_configs.append({
                "document_id": doc["_id"],
                "total_questions": 5 if i == 0 else 10,
                "question_types": {"mcq": 3, "tf": 2},
                "difficulty_mix": {"easy": 0.6, "medium": 0.4, "hard": 0.0}
            })

        payload = {
            "title": "Combined Multi-Doc Test Quiz",
            "documents": doc_configs
        }

        print(f"Sending multi-doc quiz request with {len(doc_configs)} documents...")
        response = await client.post(f"{BASE_URL}/api/quiz/generate-multi", json=payload)
        
        if response.status_code == 200:
            quiz = response.json()
            if quiz.get('questions'):
                print(f"VERIFY_SOURCE: {quiz['questions'][0].get('source_document')}")
            # Check if we got roughly the expected number (15 if 2 docs, 5 if 1 doc)
            expected = sum(d["total_questions"] for d in doc_configs)
            print(f"Expected questions: {expected}")
            
            # Verify document separation in questions if possible
            # (In reality, we'd check metadata or content)
        else:
            print(f"Failed to generate multi-doc quiz. Status: {response.status_code}")
            print(f"Error: {response.text}")

if __name__ == "__main__":
    asyncio.run(test_multi_doc_generation())
