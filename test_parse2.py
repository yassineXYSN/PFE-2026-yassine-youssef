import logging
import os
import sys

# load dotenv
from dotenv import load_dotenv
load_dotenv(r"c:\Users\ASUS\Documents\GitHub\PFE-2026-yassine-youssef\backend\.env")

from backend.utils.cv_parser import ResumeParser, build_messages
logging.basicConfig(level=logging.INFO)

try:
    print("Testing generate_api...")
    hf_token = os.getenv("HF_CV_PARSING_TOKEN")
    parser = ResumeParser()
    messages = build_messages("Candidate Name: Yassine. Experience: 5 years in Python.")
    res = parser.generate_api(messages, "Qwen/Qwen2.5-72B-Instruct", hf_token)
    print("Success:", res)
except Exception as e:
    import traceback
    traceback.print_exc()
