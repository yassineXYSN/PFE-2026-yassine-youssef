import sys
import logging
from dotenv import load_dotenv

load_dotenv(r"c:\Users\ASUS\Documents\GitHub\PFE-2026-yassine-youssef\backend\.env")

from backend.utils.cv_parser import parse_cv

logging.basicConfig(level=logging.INFO)

try:
    print("Testing parse_cv...")
    res = parse_cv(
        pdf_path=r"c:\Users\ASUS\Documents\GitHub\PFE-2026-yassine-youssef\backend\tests\test_cv_parser.py", # Just passing any file, the parser might fail to read it as PDF but let's see where it gets
        use_api=True
    )
    print("Success:", res)
except Exception as e:
    import traceback
    traceback.print_exc()
