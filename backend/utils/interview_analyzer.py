import json
import os
import logging
from typing import List, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Import for Pydantic validation (similar to cv_parser)
from pydantic import BaseModel, RootModel

class InterviewAnalysisResult(BaseModel):
    summary: str
    strengths: List[str]
    weaknesses: List[str]
    overall_score: int

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {
            "type": "string",
            "description": "A comprehensive 2-3 paragraph summary of the candidate's performance, communication skills, and technical knowledge based on the transcript."
        },
        "strengths": {
            "type": "array",
            "items": {"type": "string"},
            "description": "3 to 5 key strengths demonstrated by the candidate."
        },
        "weaknesses": {
            "type": "array",
            "items": {"type": "string"},
            "description": "1 to 3 areas of improvement or weaknesses."
        },
        "overall_score": {
            "type": "integer",
            "minimum": 0,
            "maximum": 100,
            "description": "An overall score out of 100 representing the candidate's fit and performance."
        }
    },
    "required": ["summary", "strengths", "weaknesses", "overall_score"]
}

SYSTEM_PROMPT = f"""\
You are an expert HR AI Assistant. Your task is to analyze a completed job interview.
You will be provided with:
1. The full transcript of the conversation between the Recruteur (Recruiter) and the Candidat (Candidate).
2. The sequence of emotions detected on the candidate's face during the interview.

Your goal is to evaluate the candidate's performance, communication, and technical skills based ONLY on the provided transcript and emotions.
Output your analysis STRICTLY as a JSON object matching the following schema. Do not include any markdown formatting outside of the JSON block. Do not include any explanations.

Schema:
{json.dumps(OUTPUT_SCHEMA, indent=2)}
"""

def extract_json_from_response(raw: str) -> dict:
    """Robust string-aware JSON extraction."""
    text = raw.strip()
    import re
    md_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if md_match:
        text = md_match.group(1).strip()
        
    brace_start = text.find('{')
    if brace_start == -1:
        raise ValueError("No JSON object found in model output.")
        
    import json
    decoder = json.JSONDecoder()
    try:
        data, _ = decoder.raw_decode(text[brace_start:])
        return data
    except Exception as e:
        logger.error(f"JSON parsing failed: {e}")
        raise

def analyze_interview(transcript: List[Dict[str, Any]], emotions: List[Dict[str, Any]], hf_token: str = None, model_name: str = "Qwen/Qwen2.5-72B-Instruct") -> dict:
    """Analyze the interview data using HuggingFace API and return structured JSON."""
    
    logger.info("=" * 60)
    logger.info("AI Interview Analyzer Engine")
    logger.info("=" * 60)
    
    effective_token = hf_token or os.getenv("HUGGINGFACE_API_KEY")
    
    if os.getenv("FAKE_ANALYSIS") == "1":
        logger.info("🛠️ [FAKE ANALYSIS] Mode enabled. Returning mock interview analysis.")
        return {
            "summary": "[FAKE] Le candidat a démontré une excellente capacité de communication globale. Les réponses étaient claires et bien structurées. L'analyse émotionnelle a montré une prédominance de confiance ('neutral' et 'happy').",
            "strengths": ["Excellente communication verbale", "Contexte technique solide", "Attitude positive (émotions dominantes: happy)"],
            "weaknesses": ["Manque de détails sur certaines questions d'architecture"],
            "overall_score": 85
        }
        
    if not effective_token:
        raise ValueError("HUGGINGFACE_API_KEY environment variable missing.")
        
    # Format the data for the prompt
    formatted_transcript = "\n".join([f"[{t.get('timestamp', '')}] {t.get('sender', 'Unknown')}: {t.get('text', '')}" for t in transcript])
    
    # Simplify emotions to just the dominant emotion
    simplified_emotions = []
    for e in emotions:
        ts = e.get("timestamp", "")
        # Get dominant emotion from the 'emotions' list (results from faceaffectus)
        results = e.get("emotions", [])
        if results and isinstance(results, list):
            dom = results[0].get("emotion", "unknown")
            simplified_emotions.append(f"[{ts}] {dom}")
            
    formatted_emotions = "\n".join(simplified_emotions)
    
    prompt = (
        f"---BEGIN TRANSCRIPT---\n{formatted_transcript}\n---END TRANSCRIPT---\n\n"
        f"---BEGIN EMOTIONS---\n{formatted_emotions}\n---END EMOTIONS---\n\n"
        f"Please output the JSON analysis now."
    )
    
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt}
    ]
    
    from huggingface_hub import InferenceClient
    logger.info(f"Calling HF API: {model_name}")
    
    client = InferenceClient(token=effective_token)
    response = client.chat_completion(
        model=model_name,
        messages=messages,
        max_tokens=2048,
        temperature=0.1, # Low temperature for consistent JSON
    )
    
    raw_output = response.choices[0].message.content
    try:
        data = extract_json_from_response(raw_output)
        # Validate against Pydantic
        validated = InterviewAnalysisResult(**data)
        logger.info("✅ Interview analysis completed successfully.")
        return validated.model_dump()
    except Exception as e:
        logger.error(f"Failed to parse or validate AI output: {e}")
        # Return graceful fallback
        return {
            "summary": "The AI analysis failed to generate a strictly formatted response. Please check the raw transcript manually.",
            "strengths": ["Transcript available"],
            "weaknesses": ["AI Processing Error"],
            "overall_score": 0
        }
