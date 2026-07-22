"""
CV/Resume PDF text extraction and prompt-building helpers, used by
utils/account_analysis.py's aiproxy-based parsing pipeline.
"""

import json
import re
import os
import logging
import unicodedata

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

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
        "firstName": {"type": ["string", "null"], "description": "Candidate's first name"},
        "lastName": {"type": ["string", "null"], "description": "Candidate's last name"},
        "birthDate": {"type": ["string", "null"], "description": "Candidate's date of birth (preferably YYYY-MM-DD)"},
        "address": {"type": ["string", "null"], "description": "Candidate's physical address, city, country, or location"},
        "linkedinUrl": {"type": ["string", "null"], "description": "Candidate's LinkedIn profile URL"},
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
    "required": [
        "firstName", "lastName", "birthDate", "address", "linkedinUrl",
        "title", "hobbies", "skills", "languages", "educations",
        "experiences", "certificates", "jobPreferences"
    ],
    "additionalProperties": False
}

EXAMPLE_JSON = {
  "firstName": "John",
  "lastName": "Doe",
  "birthDate": "1993-05-12",
  "address": "New York, NY, USA",
  "linkedinUrl": "https://www.linkedin.com/in/johndoe",
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
You are an expert CV/resume parser. Extract ALL information from the candidate's resume into a strict JSON structure.

OUTPUT: valid JSON only. No markdown, no explanations, no extra text.

━━━ RULE 1 — LEVEL VALUES (CRITICAL) ━━━
The "level" field for EVERY skill and language MUST be a plain INTEGER between 0 and 100.
NEVER output a string, percentage, or word like "native", "80%", "fluent", "advanced".

Language level lookup table (use ONLY these numbers):
  Native / Mother tongue                → 100
  Fluent / Professional / C2 / Bilingue → 90
  Advanced / C1                          → 80
  Upper-Intermediate / B2               → 70
  Intermediate / B1                     → 55
  Elementary / A2                       → 40
  Beginner / A1                         → 25

Skill level lookup table:
  Expert / Master                        → 90
  Advanced / Confirmed / Senior          → 75
  Intermediate / Proficient              → 55
  Basic / Beginner / Junior              → 30

WRONG examples (NEVER do this):
  {{"name": "Arabic", "level": "native"}}
  {{"name": "English", "level": "80%"}}
  {{"name": "Python", "level": "advanced"}}

CORRECT examples:
  {{"name": "Arabic", "level": 100}}
  {{"name": "English", "level": 80}}
  {{"name": "Python", "level": 75}}

━━━ RULE 2 — EXPERIENCES vs CERTIFICATES (CRITICAL) ━━━
"experiences" = ONLY real jobs / internships / freelance employment where the person WORKED for a company.
  Required: company name + job title + employment period
  Examples: "Backend Developer at Acme Corp", "Intern at Startup"

"certificates" = certifications, diplomas, online courses, training programs, professional certifications.
  Examples: "AWS Certified Solutions Architect", "Machine Learning – Coursera", "CCNA"

NEVER put a course, training, or certification inside "experiences".
NEVER put an actual job inside "certificates".

If an entry has a certificate/course name with an issuing organization but NO job title → put it in "certificates".
If an entry has a company name, a job title, and employment dates → put it in "experiences".

━━━ OTHER RULES ━━━
- Use null for any field not found in the CV.
- Dates: use year strings like "2023" and month strings like "06".
- Set "ongoing": true if the position or education is current / present.
- "id" fields: sequential integers starting from 1.
- Extract the professional title from the CV summary or most recent role.
- For experience "description": summarize into 2-3 concise bullet points focused on achievements and technologies.
- Hobbies: Extract personal interests or hobbies into the "hobbies" list of objects.
- birthDate: Extract the candidate's date of birth (preferably formatted as YYYY-MM-DD). Use null if absent.
- address: Extract the candidate's location, city, country, or street address. Use null if absent.
- firstName/lastName: Extract the candidate's first and last name separately. Use null if absent.
- linkedinUrl: Extract the candidate's LinkedIn profile URL if present. Use null if absent.
- For jobPreferences: infer from stated preferences; use null if absent.
- Column Interleaving: Multi-column PDFs might have interleaved text blocks (e.g. school names or contact info showing up under "Hobbies" or "Languages" in the raw text stream). Filter out non-matching content (like school names, degree institutions, or locations) from the hobbies list.
- Empty Sections: If a section header like "Hobbies" is present in the text but has no actual items listed under it (or only contains noise/interleaved text from other columns), return an empty list `[]` for that field. Do not guess or hallucinate.

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
# 4. JSON EXTRACTION & PYDANTIC VALIDATION
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
