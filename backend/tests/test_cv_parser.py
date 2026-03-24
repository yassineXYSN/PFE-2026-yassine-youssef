"""
Production-grade CV/Resume PDF Parser using PyMuPDF + Hugging Face Transformers

Extracts structured candidate data from a PDF resume and outputs it
in the exact format defined by database/model.py (AccountSetupData).
"""

import argparse
import json
import re
import os
import sys
import time
import logging
import unicodedata
from functools import wraps

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Relative import for the database model (portable)
try:
    from database.model import AccountSetupData
    from pydantic import ValidationError
except ImportError:
    logger.warning("Could not import database.model.AccountSetupData. Validation will be bypassed.")
    AccountSetupData = None
    ValidationError = Exception

# ---------------------------------------------------------------------------
# 1. PDF TEXT EXTRACTION (Layout-Aware)
# ---------------------------------------------------------------------------

def extract_text_with_ocr(pdf_path: str) -> str:
    """Fallback OCR extraction for image-based PDFs."""
    try:
        from pdf2image import convert_from_path
        import pytesseract
    except ImportError:
        logger.warning("pdf2image or pytesseract not installed. Cannot perform OCR fallback.")
        return ""
        
    logger.info("Starting OCR fallback extraction...")
    try:
        images = convert_from_path(pdf_path)
        text_pages = []
        for img in images:
            text = pytesseract.image_to_string(img)
            text_pages.append(text)
        return "\n\n".join(text_pages)
    except Exception as e:
        logger.error(f"OCR conversion failed: {e}")
        return ""


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract raw text using PyMuPDF block-sorting logic."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise ImportError("PyMuPDF (fitz) is required. Please install it with 'pip install pymupdf'.")

    if not os.path.isfile(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(pdf_path)
    pages = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # Extract blocks: (x0, y0, x1, y1, "text", block_no, block_type)
        blocks = page.get_text("blocks")
        
        # Filter out images (block_type == 1 usually means image)
        text_blocks = [b for b in blocks if len(b) >= 7 and b[6] == 0]
        
        # Sort blocks by y-coordinates (5px tolerance for baseline jitter) and then x-coordinates
        # Round y0 to nearest 5px
        text_blocks.sort(key=lambda b: (round(b[1] / 5.0) * 5.0, b[0]))
        
        text = "\n".join([b[4] for b in text_blocks])
        if text.strip():
            pages.append(text)
    doc.close()

    extracted_text = "\n\n".join(pages)
    if len(extracted_text.strip()) < 50:
        logger.info("Extracted text is less than 50 characters. Triggering OCR fallback.")
        extracted_text = extract_text_with_ocr(pdf_path)
        if not extracted_text.strip():
            raise ValueError("Could not extract any text from the PDF, even with OCR.")

    return extracted_text


# ---------------------------------------------------------------------------
# 2. TEXT CLEANING
# ---------------------------------------------------------------------------

def clean_text(raw: str) -> str:
    """Clean raw PDF text with unicode normalisation and targeted artifact removal."""
    try:
        import ftfy
        text = ftfy.fix_text(raw)
    except ImportError:
        logger.debug("ftfy not installed. Skipping mojibake fixing.")
        text = raw

    # Map Ghost Characters (FontAwesome PUA)
    pua_mapping = {
        '\uf0e0': '[Email]',
        '\uf095': '[Phone]',
        '\uf08c': '[LinkedIn]',
        '\uf015': '[Address]',
        '\uf113': '[GitHub]',
    }
    for char, replacement in pua_mapping.items():
        text = text.replace(char, replacement)
        
    # Strip remaining unmapped PUA characters in the \uf000-\uf8ff range
    text = re.sub(r'[\uf000-\uf8ff]', '', text)

    # Normalise unicode (NFKC)
    text = unicodedata.normalize("NFKC", text)

    # Remove only non-printable / control chars (keep newlines/tabs)
    # Control chars excluding \t, \n, \r
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

    # Replace tabs with spaces
    text = text.replace('\t', ' ')
    
    # Collapse multiple spaces
    text = re.sub(r'[ ]{2,}', ' ', text)
    
    # Collapse 3+ consecutive newlines -> 2
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Specific target for page numbers bounded by word boundaries
    text = re.sub(r'(?i)\bpage\s+\d+\b(\s+of\s+\d+\b)?', '', text)
    
    lines = [line.strip() for line in text.splitlines()]
    text = '\n'.join(lines)

    return text.strip()


# ---------------------------------------------------------------------------
# 3. SCHEMA & PROMPT ENGINEERING
# ---------------------------------------------------------------------------

OUTPUT_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "title": {"type": ["string", "null"], "description": "Professional title/headline"},
        "hobbies": {
            "type": "array",
            "items": {"type": "object", "properties": {"id": {"type": "integer"}, "name": {"type": "string"}}, "required": ["id", "name"]}
        },
        "skills": {
            "type": "array",
            "items": {"type": "object", "properties": {"id": {"type": "integer"}, "name": {"type": "string"}, "level": {"type": "integer", "minimum": 0, "maximum": 100}}, "required": ["id", "name", "level"]}
        },
        "languages": {
            "type": "array",
            "items": {"type": "object", "properties": {"id": {"type": "integer"}, "name": {"type": "string"}, "level": {"type": "integer", "minimum": 0, "maximum": 100}}, "required": ["id", "name", "level"]}
        },
        "educations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"}, "degree": {"type": "string"}, "institution": {"type": "string"},
                    "fieldOfStudy": {"type": ["string", "null"]}, "startYear": {"type": "string"},
                    "endYear": {"type": ["string", "null"]}, "ongoing": {"type": "boolean"}
                }, "required": ["id", "degree", "institution", "startYear", "ongoing"]
            }
        },
        "experiences": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"}, "jobTitle": {"type": "string"}, "company": {"type": "string"},
                    "startMonth": {"type": ["string", "null"]}, "startYear": {"type": "string"},
                    "endMonth": {"type": ["string", "null"]}, "endYear": {"type": ["string", "null"]},
                    "ongoing": {"type": "boolean"}, "description": {"type": "string"}
                }, "required": ["id", "jobTitle", "company", "startYear", "ongoing", "description"]
            }
        },
        "certificates": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"}, "name": {"type": "string"}, "issuer": {"type": ["string", "null"]},
                    "year": {"type": ["string", "null"]}, "url": {"type": ["string", "null"]}
                }, "required": ["id", "name"]
            }
        },
        "jobPreferences": {
            "type": "object",
            "description": "Candidate's job preferences.",
            "properties": {
                "expectedSalary": {"type": ["integer", "null"]},
                "location": {"type": ["string", "null"]},
                "jobType": {"type": ["string", "null"], "enum": ["Full-time", "Part-time", "Contract", "Internship", "Freelance", None]},
                "workModel": {"type": ["string", "null"], "enum": ["Remote", "On-site", "Hybrid", None]}
            }
        }
    },
    "required": ["title", "hobbies", "skills", "languages", "educations", "experiences", "certificates", "jobPreferences"],
    "additionalProperties": False
}

EXAMPLE_JSON = {
  "title": "Senior Software Engineer",
  "hobbies": [{"id": 1, "name": "Photography"}],
  "skills": [
    {"id": 1, "name": "Python", "level": 95},
    {"id": 2, "name": "React", "level": 75}
  ],
  "languages": [
    {"id": 1, "name": "English", "level": 100},
    {"id": 2, "name": "French", "level": 50}
  ],
  "educations": [
    {
      "id": 1,
      "degree": "BSc Computer Science",
      "institution": "University of Tech",
      "fieldOfStudy": "Software Engineering",
      "startYear": "2015",
      "endYear": "2019",
      "ongoing": False
    }
  ],
  "experiences": [
    {
      "id": 1,
      "jobTitle": "Senior Backend Engineer",
      "company": "Tech Corp",
      "startMonth": "06",
      "startYear": "2020",
      "endMonth": "null",
      "endYear": "null",
      "ongoing": True,
      "description": "Lead developer for backend services."
    },
    {
      "id": 2,
      "jobTitle": "Junior Developer",
      "company": "Web Solutions",
      "startMonth": "01",
      "startYear": "2019",
      "endMonth": "05",
      "endYear": "2020",
      "ongoing": False,
      "description": "Maintained client websites and added new features."
    }
  ],
  "certificates": [
    {
      "id": 1,
      "name": "AWS Certified Solutions Architect",
      "issuer": "Amazon",
      "year": "2021",
      "url": "https://aws.amazon.com/certification"
    }
  ],
  "jobPreferences": {
    "expectedSalary": 100000,
    "location": "New York",
    "jobType": "Full-time",
    "workModel": "Hybrid"
  }
}

SYSTEM_PROMPT = f"""\
You are an expert CV/resume parser. You receive the full text of a candidate's resume and you must extract ALL information into a strict JSON structure.

Rules:
- Output ONLY valid JSON matching the provided schema exactly. No markdown headers outside the code block, no explanations.
- Use null for any field you cannot find in the CV.
- For skill/language levels, use an integer 0-100 (estimate from context: Beginner=25, Intermediate=50, Fluent/Advanced=75, Native/Expert=95).
- For dates, use logical strings like "2023", "06", etc.
- 'ongoing' should be true if the position/education is current.
- id fields should be sequential integers starting from 1.
- Extract the professional title/headline from the CV summary or current role.
- For jobPreferences, infer from any stated preferences; leave defaults or nulls if absent.
- For experience descriptions, heavily summarize the original text into 2-3 concise, keyword-rich bullet points. Remove all fluff and focus strictly on achievements and technologies.

Example Output:
{json.dumps(EXAMPLE_JSON, indent=2)}
"""

def build_messages(cv_text: str) -> list[dict]:
    """Build the chat messages for the model."""
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Here is the exact JSON schema you must follow:\n"
                f"```json\n{json.dumps(OUTPUT_SCHEMA, indent=2)}\n```\n\n"
                f"Now parse this CV and return ONLY the JSON:\n\n"
                f"---BEGIN CV---\n{cv_text}\n---END CV---"
            ),
        },
    ]


# ---------------------------------------------------------------------------
# 4. ARCHITECTURE & RESILIENCE
# ---------------------------------------------------------------------------

def retry_hf_api(max_retries=5, base_delay=2.0):
    """Exponential backoff decorator for HuggingFace API 429/503 errors."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            delay = base_delay
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    err_str = str(e).lower()
                    if "429" in err_str or "503" in err_str or "rate limit" in err_str or "overloaded" in err_str:
                        if attempt < max_retries - 1:
                            logger.warning(f"HF API Rate limit/Overloaded (Attempt {attempt+1}/{max_retries}). Retrying in {delay}s...")
                            time.sleep(delay)
                            delay *= 2
                            continue
                    raise
            return func(*args, **kwargs)
        return wrapper
    return decorator


class ResumeParser:
    """Singleton pattern to keep LLM model loaded in memory."""
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(ResumeParser, cls).__new__(cls)
            cls._instance.loaded_pipelines = {}
        return cls._instance

    def load_local_model(self, model_name: str, device: str):
        pass  # Ollama manages its own models in memory

    def generate_local(self, messages: list[dict], model_name: str, device: str) -> str:
        import requests
        logger.info(f"Running local inference via Ollama (model: {model_name})...")
        try:
            response = requests.post(
                "http://localhost:11434/api/chat",
                json={
                    "model": model_name,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": 0.0
                    }
                },
                timeout=300
            )
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "")
        except Exception as e:
            logger.error(f"Ollama API call failed: {e}. Ensure Ollama is running and has model '{model_name}'.")
            raise

    @retry_hf_api(max_retries=5, base_delay=2.0)
    def generate_api(self, messages: list[dict], model_name: str, hf_token: str) -> str:
        from huggingface_hub import InferenceClient
        logger.info(f"Calling HF API: {model_name}")

        client = InferenceClient(token=hf_token)
        response = client.chat_completion(
            model=model_name,
            messages=messages,
            max_tokens=4096,
            temperature=0.0, # Greedy
            seed=42,         # Enforce deterministic constraints
        )
        return response.choices[0].message.content


# ---------------------------------------------------------------------------
# 5. JSON EXTRACTION & PYDANTIC VALIDATION
# ---------------------------------------------------------------------------

def extract_json_from_response(raw: str) -> dict:
    """Robust string-aware JSON extraction."""
    text = raw.strip()

    # Find typical markdown JSON code blocks
    md_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if md_match:
        text = md_match.group(1).strip()

    try:
        import json_repair
        data = json_repair.loads(text)
        if isinstance(data, dict):
            return data
    except ImportError:
        logger.debug("json_repair not available, falling back to raw decoder.")
    except Exception as e:
        logger.warning(f"json_repair parsing failed: {e}")

    # Fallback to standard robust JSON scanning
    brace_start = text.find('{')
    if brace_start == -1:
        raise ValueError("No JSON object found in model output.")
        
    decoder = json.JSONDecoder()
    try:
        # raw_decode reads just one object ignoring trailing unparseable stuff
        data, _ = decoder.raw_decode(text[brace_start:])
        return data
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing failed: {e}")
        logger.debug(f"Raw context: {text[brace_start:brace_start+500]}")
        raise


def validate_and_correct(data: dict, parser_instance: ResumeParser, messages: list,
                         use_api: bool, model_name: str, hf_token: str = None, device: str = "auto") -> dict:
    """Run Pydantic v2 validation. If fails, self-correct once."""
    
    # Pre-validation cleanup map to assure structure matches schema
    for field in ["hobbies", "skills", "languages", "educations", "experiences", "certificates"]:
        if field not in data or data[field] is None:
            data[field] = []
            
    if "jobPreferences" not in data or data["jobPreferences"] is None:
        data["jobPreferences"] = {}

    if AccountSetupData is None:
        return data

    try:
        # Validate with Pydantic v2
        account_data = AccountSetupData(**data)
        return account_data.model_dump()
    except Exception as e:
        logger.warning(f"Validation failed. Attempting 1 self-correction pass. Error details: {e}")
        
        flawed_json_str = json.dumps(data)
        if len(flawed_json_str) > 4000:
            flawed_json_str = flawed_json_str[:4000] + "\n...[TRUNCATED]"
            
        correction_prompt = f"""
        You are a JSON fixer. Your previous output failed Pydantic validation with these errors:
        {e}
        
        Here is your flawed output:
        ```json
        {flawed_json_str}
        ```
        
        Fix the structure to match the requested schema perfectly. OUTPUT ONLY VALID JSON. Do not hallucinate new candidate data. Only fix structural syntax errors (like missing brackets or unescaped quotes) and ensure the types match the schema.
        """
        correction_messages = [
            {"role": "system", "content": "You are a JSON correctness engine. Fix the JSON and output ONLY valid JSON."},
            {"role": "user", "content": correction_prompt}
        ]
        
        try:
            if use_api:
                corrected_raw = parser_instance.generate_api(correction_messages, model_name, hf_token)
            else:
                corrected_raw = parser_instance.generate_local(correction_messages, model_name, device)
            
            corrected_data = extract_json_from_response(corrected_raw)
            account_data = AccountSetupData(**corrected_data)
            return account_data.model_dump()
        except Exception as correction_err:
            logger.error(f"Self-correction failed: {correction_err}. Returning flawed data as best effort.")
            return data


# ---------------------------------------------------------------------------
# 6. MAIN PIPELINE
# ---------------------------------------------------------------------------

def parse_cv(pdf_path: str, use_api: bool = False, hf_token: str = None,
             model_name: str = None, device: str = "auto") -> dict:
                 
    logger.info("=" * 60)
    logger.info(f"CV Parser Engine — {os.path.basename(pdf_path)}")
    logger.info("=" * 60)

    # 1. Extraction
    raw_text = extract_text_from_pdf(pdf_path)
    logger.info(f"Extracted {len(raw_text):,} characters from PDF.")

    # 2. Cleaning
    cleaned = clean_text(raw_text)
    logger.info(f"Cleaned text: {len(cleaned):,} characters.")

    # Optimize Context Window (32k tokens = ~128000 chars based on 4 chars/token average)
    MAX_CHARS = 128_000
    if len(cleaned) > MAX_CHARS:
        logger.warning(f"Text too long, truncating to {MAX_CHARS:,} chars.")
        cleaned = cleaned[:MAX_CHARS]

    # 3. Prompt Building
    messages = build_messages(cleaned)
    parser = ResumeParser()

    # 4. LLM Generation
    if use_api:
        curr_model = model_name or "Qwen/Qwen2.5-72B-Instruct"
        raw_output = parser.generate_api(messages, curr_model, hf_token)
    else:
        curr_model = model_name or "qwen2.5:14b"
        raw_output = parser.generate_local(messages, curr_model, device)

    # 5. JSON parse and Verification
    raw_data = extract_json_from_response(raw_output)
    result = validate_and_correct(raw_data, parser, messages, use_api, curr_model, hf_token, device)
    
    logger.info("✅ Done!")
    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Production Grade PDF CV/resume Parser.")
    parser.add_argument("pdf", help="Path to the PDF resume file.")
    parser.add_argument("--api", action="store_true", help="Use HuggingFace Inference API.")
    parser.add_argument("--hf-token", default=os.getenv("HF_TOKEN"), help="HuggingFace API token.")
    parser.add_argument("--model", default=None, help="Override the model name.")
    parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"], help="Local Inference Device.")
    parser.add_argument("--output", "-o", default=None, help="Save JSON output to file.")

    args = parser.parse_args()

    if args.api and not args.hf_token:
        logger.error("--hf-token is required when using --api mode.")
        sys.exit(1)

    result = parse_cv(
        pdf_path=args.pdf,
        use_api=args.api,
        hf_token=args.hf_token,
        model_name=args.model,
        device=args.device,
    )

    output_json = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_json)
        logger.info(f"Output saved to: {args.output}")
    else:
        print("\n" + "=" * 60)
        print("  PARSED CV DATA (AccountSetupData)")
        print("=" * 60)
        print(output_json)

if __name__ == "__main__":
    main()
