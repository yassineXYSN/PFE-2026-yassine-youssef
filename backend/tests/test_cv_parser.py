"""
CV/Resume PDF Parser using PyMuPDF + Hugging Face Transformers

Extracts structured candidate data from a PDF resume and outputs it
in the exact format defined by database/model.py (AccountSetupData).

Usage:
    cd backend
    pip install pymupdf transformers torch accelerate sentencepiece
    python tests/test_cv_parser.py path/to/resume.pdf

    # Use --device cpu  if you don't have a GPU
    python tests/test_cv_parser.py path/to/resume.pdf --device cpu

    # Use HuggingFace Inference API instead of local model (no GPU needed)
    python tests/test_cv_parser.py path/to/resume.pdf --api --hf-token YOUR_TOKEN

Model used:
    Qwen/Qwen2.5-7B-Instruct  (local, needs ~16 GB RAM / VRAM)
    — or —
    Qwen/Qwen2.5-72B-Instruct (via HF Inference API, best accuracy)
"""

import argparse
import json
import re
import sys
import os
import unicodedata

# ---------------------------------------------------------------------------
# 1. PDF TEXT EXTRACTION  (PyMuPDF / fitz)
# ---------------------------------------------------------------------------

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract raw text from every page of a PDF using PyMuPDF."""
    import fitz  # PyMuPDF

    if not os.path.isfile(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(pdf_path)
    pages = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        if text.strip():
            pages.append(text)
    doc.close()

    if not pages:
        raise ValueError("Could not extract any text from the PDF. It may be image-based.")

    return "\n\n".join(pages)


# ---------------------------------------------------------------------------
# 2. TEXT CLEANING
# ---------------------------------------------------------------------------

def clean_text(raw: str) -> str:
    """
    Clean raw PDF text:
    - Normalise unicode (accented chars, ligatures)
    - Collapse whitespace / blank lines
    - Strip page headers/footers artifacts
    - Remove non-printable characters
    """
    # Normalise unicode
    text = unicodedata.normalize("NFKD", raw)

    # Remove non-printable / control chars (keep newlines and tabs)
    text = re.sub(r'[^\x20-\x7E\n\t\xA0-\xFF\u0100-\uFFFF]', '', text)

    # Replace tabs with spaces
    text = text.replace('\t', ' ')

    # Collapse multiple spaces into one
    text = re.sub(r'[ ]{2,}', ' ', text)

    # Collapse 3+ consecutive newlines into 2
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Strip each line
    lines = [line.strip() for line in text.splitlines()]
    text = '\n'.join(lines)

    # Remove common PDF artifacts (page numbers like "Page 1 of 3", standalone numbers)
    text = re.sub(r'(?i)^page\s+\d+\s*(of\s+\d+)?$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\d{1,3}$', '', text, flags=re.MULTILINE)

    # Final trim
    text = text.strip()
    return text


# ---------------------------------------------------------------------------
# 3. BUILD THE EXTRACTION PROMPT
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are an expert CV/resume parser. You receive the full text of a candidate's \
resume and you must extract ALL information into a strict JSON structure.

Rules:
- Output ONLY valid JSON. No markdown, no explanation, no extra text.
- Use null for any field you cannot find in the CV.
- For skill/language levels, use an integer 0-100 (estimate from context: \
  Beginner=25, Intermediate=50, Fluent/Advanced=75, Native/Expert=95).
- For dates, use strings like "2023", "06", etc.
- ongoing should be true if the position/education is current.
- id fields should be sequential integers starting from 1.
- Extract the professional title/headline from the CV summary or current role.
- For hobbies, only include if explicitly mentioned.
- For jobPreferences, infer from any stated preferences; leave defaults if absent.
"""

OUTPUT_SCHEMA = """\
{
  "firstName": "string",
  "lastName": "string",
  "birthDate": "string or null (YYYY-MM-DD)",
  "title": "string (professional title/headline)",
  "address": "string or null",
  "linkedinUrl": "string or null",
  "hobbies": [{"id": 1, "name": "string"}],
  "skills": [{"id": 1, "name": "string", "level": 0-100}],
  "languages": [{"id": 1, "name": "string", "level": 0-100}],
  "educations": [{
    "id": 1,
    "degree": "string",
    "institution": "string",
    "fieldOfStudy": "string or null",
    "startYear": "string",
    "endYear": "string or null",
    "ongoing": false
  }],
  "experiences": [{
    "id": 1,
    "jobTitle": "string",
    "company": "string",
    "startMonth": "string or null",
    "startYear": "string",
    "endMonth": "string or null",
    "endYear": "string or null",
    "ongoing": false,
    "description": "string"
  }],
  "certificates": [{
    "id": 1,
    "name": "string",
    "issuer": "string or null",
    "year": "string or null",
    "url": "string or null"
  }],
  "jobPreferences": {
    "jobTypes": [],
    "workLocation": [],
    "salaryExpectation": "",
    "availability": "",
    "preferredIndustries": [],
    "willRelocate": false
  }
}
"""


def build_messages(cv_text: str) -> list[dict]:
    """Build the chat messages for the instruct model."""
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Here is the exact JSON schema you must follow:\n"
                f"```json\n{OUTPUT_SCHEMA}\n```\n\n"
                f"Now parse this CV and return ONLY the JSON:\n\n"
                f"---BEGIN CV---\n{cv_text}\n---END CV---"
            ),
        },
    ]


# ---------------------------------------------------------------------------
# 4a. LOCAL INFERENCE  (transformers pipeline)
# ---------------------------------------------------------------------------

def parse_with_local_model(cv_text: str, model_name: str, device: str) -> dict:
    """
    Run inference locally using transformers.
    Default model: Qwen/Qwen2.5-7B-Instruct
    """
    from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
    import torch

    print(f"[*] Loading model: {model_name} (device={device})")

    dtype = torch.float16 if device != "cpu" else torch.float32

    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=dtype,
        device_map=device if device != "cpu" else None,
        trust_remote_code=True,
    )
    if device == "cpu":
        model = model.to("cpu")

    pipe = pipeline(
        "text-generation",
        model=model,
        tokenizer=tokenizer,
        device_map=device if device != "cpu" else None,
    )

    messages = build_messages(cv_text)

    print("[*] Running inference (this may take a minute)...")
    outputs = pipe(
        messages,
        max_new_tokens=4096,
        temperature=0.1,       # Low temperature for deterministic output
        top_p=0.9,
        do_sample=True,
        return_full_text=False,
    )

    raw_output = outputs[0]["generated_text"]
    if isinstance(raw_output, list):
        # Some pipelines return list of dicts with 'content' key
        raw_output = raw_output[-1].get("content", str(raw_output))

    return extract_json_from_response(raw_output)


# ---------------------------------------------------------------------------
# 4b. HF INFERENCE API
# ---------------------------------------------------------------------------

def parse_with_hf_api(cv_text: str, model_name: str, hf_token: str) -> dict:
    """
    Use HuggingFace Inference API (serverless) for zero-setup inference.
    Default model: Qwen/Qwen2.5-72B-Instruct (much more powerful).
    """
    from huggingface_hub import InferenceClient

    print(f"[*] Calling HF Inference API: {model_name}")

    client = InferenceClient(token=hf_token)
    messages = build_messages(cv_text)

    response = client.chat_completion(
        model=model_name,
        messages=messages,
        max_tokens=4096,
        temperature=0.1,
        top_p=0.9,
    )

    raw_output = response.choices[0].message.content
    return extract_json_from_response(raw_output)


# ---------------------------------------------------------------------------
# 5. JSON EXTRACTION & VALIDATION
# ---------------------------------------------------------------------------

def extract_json_from_response(raw: str) -> dict:
    """
    Robustly extract JSON from model output.
    Handles markdown code blocks, trailing text, etc.
    """
    text = raw.strip()

    # Try to find JSON inside ```json ... ``` blocks
    md_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if md_match:
        text = md_match.group(1).strip()

    # Try to find outermost { ... }
    brace_start = text.find('{')
    if brace_start == -1:
        raise ValueError(f"No JSON object found in model output:\n{raw[:500]}")

    # Find matching closing brace
    depth = 0
    brace_end = -1
    for i in range(brace_start, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                brace_end = i
                break

    if brace_end == -1:
        # Fallback: take everything from first { to last }
        brace_end = text.rfind('}')

    json_str = text[brace_start:brace_end + 1]

    # Fix common model mistakes
    json_str = re.sub(r',\s*}', '}', json_str)   # trailing commas before }
    json_str = re.sub(r',\s*]', ']', json_str)   # trailing commas before ]

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"[!] JSON parsing failed: {e}")
        print(f"[!] Raw output:\n{raw[:1000]}")
        raise

    return data


def validate_and_build_model(data: dict) -> dict:
    """
    Validate extracted data against the Pydantic models and return
    a clean dict matching AccountSetupData.
    """
    # Add parent path so we can import database.model
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from database.model import AccountSetupData

    # Ensure all list fields are lists
    for field in ["hobbies", "skills", "languages", "educations", "experiences", "certificates"]:
        if field not in data or data[field] is None:
            data[field] = []

    if "jobPreferences" not in data or data["jobPreferences"] is None:
        data["jobPreferences"] = {}

    # Assign sequential IDs if missing
    for field in ["hobbies", "skills", "languages", "educations", "experiences", "certificates"]:
        for i, item in enumerate(data[field], start=1):
            if isinstance(item, dict):
                item.setdefault("id", i)

    # Convert level strings to ints for skills/languages
    for field in ["skills", "languages"]:
        for item in data[field]:
            if isinstance(item, dict) and isinstance(item.get("level"), str):
                level_map = {
                    "beginner": 25, "basic": 25,
                    "intermediate": 50, "conversational": 50,
                    "advanced": 75, "fluent": 75, "proficient": 75,
                    "expert": 95, "native": 100, "mother tongue": 100,
                }
                item["level"] = level_map.get(item["level"].lower().strip(), 50)

    # Validate with Pydantic
    account_data = AccountSetupData(**data)
    return account_data.model_dump()


# ---------------------------------------------------------------------------
# 6. MAIN
# ---------------------------------------------------------------------------

def parse_cv(pdf_path: str, use_api: bool = False, hf_token: str = None,
             model_name: str = None, device: str = "auto") -> dict:
    """
    Full pipeline: PDF → clean text → LLM extraction → validated JSON.

    Args:
        pdf_path:   Path to the PDF resume.
        use_api:    If True, use HF Inference API instead of local model.
        hf_token:   HuggingFace API token (required if use_api=True).
        model_name: Override the default model.
        device:     Device for local inference ("auto", "cpu", "cuda").

    Returns:
        dict matching AccountSetupData schema.
    """
    # Step 1 — Extract text
    print(f"\n{'='*60}")
    print(f"  CV Parser — {os.path.basename(pdf_path)}")
    print(f"{'='*60}\n")

    print("[1] Extracting text from PDF...")
    raw_text = extract_text_from_pdf(pdf_path)
    print(f"    Extracted {len(raw_text):,} characters from PDF.")

    # Step 2 — Clean
    print("[2] Cleaning text...")
    cleaned = clean_text(raw_text)
    print(f"    Cleaned text: {len(cleaned):,} characters.")

    # Truncate if extremely long (most models have context limits)
    MAX_CHARS = 12_000
    if len(cleaned) > MAX_CHARS:
        print(f"    [!] Text too long, truncating to {MAX_CHARS:,} chars.")
        cleaned = cleaned[:MAX_CHARS]

    # Step 3 — LLM Extraction
    print("[3] Analysing CV with LLM...")
    if use_api:
        default_api_model = "Qwen/Qwen2.5-72B-Instruct"
        raw_data = parse_with_hf_api(
            cleaned,
            model_name or default_api_model,
            hf_token,
        )
    else:
        default_local_model = "Qwen/Qwen2.5-7B-Instruct"
        raw_data = parse_with_local_model(
            cleaned,
            model_name or default_local_model,
            device,
        )

    # Step 4 — Validate
    print("[4] Validating and structuring data...")
    result = validate_and_build_model(raw_data)
    print("    ✅ Done!\n")

    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Parse a PDF CV/resume into structured JSON (AccountSetupData)."
    )
    parser.add_argument("pdf", help="Path to the PDF resume file.")
    parser.add_argument("--api", action="store_true",
                        help="Use HuggingFace Inference API instead of local model.")
    parser.add_argument("--hf-token", default=os.getenv("HF_TOKEN"),
                        help="HuggingFace API token (or set HF_TOKEN env var).")
    parser.add_argument("--model", default=None,
                        help="Override the model name.")
    parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"],
                        help="Device for local inference (default: auto).")
    parser.add_argument("--output", "-o", default=None,
                        help="Save JSON output to file (default: print to stdout).")

    args = parser.parse_args()

    if args.api and not args.hf_token:
        print("[!] Error: --hf-token is required when using --api mode.")
        print("    Set it via --hf-token YOUR_TOKEN or env var HF_TOKEN.")
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
        print(f"[*] Output saved to: {args.output}")
    else:
        print("\n" + "=" * 60)
        print("  PARSED CV DATA (AccountSetupData)")
        print("=" * 60)
        print(output_json)


if __name__ == "__main__":
    main()
