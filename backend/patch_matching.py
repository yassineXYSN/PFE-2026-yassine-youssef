import os

file_path = 'backend/routes/candidat/jobs.py'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

old_fn = """def _generate_embedding_sync(text: str) -> list:
    \"\"\"Synchronous call to Ollama to generate a text embedding.\"\"\"
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{OLLAMA_BASE_URL}/embeddings",
                json={"model": EMBEDDING_MODEL, "prompt": text}
            )
            response.raise_for_status()
            return response.json().get("embedding", [])
    except Exception as e:
        print(f"Embedding error: {e}")
        return []"""

new_fn = """from utils.ai_settings import fake_analysis_enabled
import random

def _generate_embedding_sync(text: str) -> list:
    \"\"\"Synchronous call to Ollama to generate a text embedding.\"\"\"
    if fake_analysis_enabled():
        return [random.uniform(-1, 1) for _ in range(768)]
        
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{OLLAMA_BASE_URL}/embeddings",
                json={"model": EMBEDDING_MODEL, "prompt": text}
            )
            response.raise_for_status()
            return response.json().get("embedding", [])
    except Exception as e:
        print(f"Embedding error: {e}")
        return []"""

success = False
if old_fn in text:
    text = text.replace(old_fn, new_fn)
    success = True
else:
    print("Could not find exact old function signature string matching")

if success:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed _generate_embedding_sync")