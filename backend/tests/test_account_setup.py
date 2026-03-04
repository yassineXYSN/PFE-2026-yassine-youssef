"""
Test script for POST /candidat/account-setup

Usage:
    cd backend
    .\venv\Scripts\Activate.ps1
    python test_account_setup.py

The script will:
  1. Sign in to Supabase with test credentials (edit below).
  2. POST sample account-setup data (with an optional dummy PDF) to the backend.
  3. Print the response status and body.

Prerequisites:
  - Backend running at http://localhost:8000
  - pip install requests python-dotenv supabase
"""

import os
import json
import tempfile
import requests
from dotenv import load_dotenv
from supabase import create_client

# ── Configuration ────────────────────────────────────────────────────

# Load env vars from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

BACKEND_URL = "http://localhost:8000"
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# ⚠️  Replace these with a real test candidate's credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "testpassword123"


# ── Step 1: Authenticate with Supabase to get an access token ────────

def get_access_token():
    print("[1] Signing in to Supabase...")
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    response = sb.auth.sign_in_with_password({"email": TEST_EMAIL, "password": TEST_PASSWORD})
    token = response.session.access_token
    print(f"    ✅ Got access token: {token[:20]}...")
    return token


# ── Step 2: Build sample form data ──────────────────────────────────

SAMPLE_DATA = {
    "firstName": "Yassine",
    "lastName": "Test",
    "birthDate": "1998-05-15",
    "title": "Software Engineer",
    "address": "123 Test Street, Casablanca",
    "linkedinUrl": "https://linkedin.com/in/yassine-test",
    "hobbies": ["coding", "reading"],
    "skills": ["Python", "React", "FastAPI", "MongoDB"],
    "languages": [
        {"language": "French", "level": "Native"},
        {"language": "English", "level": "Fluent"},
    ],
    "educations": [
        {
            "degree": "Master",
            "institution": "University of Test",
            "fieldOfStudy": "Computer Science",
            "startYear": "2018",
            "endYear": "2023",
            "ongoing": False,
        }
    ],
    "experiences": [
        {
            "jobTitle": "Full-Stack Developer",
            "company": "TestCorp",
            "startMonth": "6",
            "startYear": "2023",
            "endMonth": "",
            "endYear": "",
            "ongoing": True,
            "description": "Building web applications",
        }
    ],
    "certificates": [
        {
            "name": "AWS Cloud Practitioner",
            "issuer": "Amazon",
            "year": "2024",
            "url": "https://aws.amazon.com/cert/123",
        }
    ],
    "jobPreferences": {
        "jobTypes": ["full-time", "remote"],
        "workLocation": ["remote", "hybrid"],
        "salaryExpectation": "50000",
        "availability": "immediate",
        "preferredIndustries": ["tech", "finance"],
        "willRelocate": True,
    },
}


# ── Step 3: Send the POST request ───────────────────────────────────

def test_account_setup(token: str, include_cv: bool = True):
    url = f"{BACKEND_URL}/candidat/account-setup"

    # Build multipart form
    files = {}
    form = {"data": json.dumps(SAMPLE_DATA)}

    if include_cv:
        # Create a tiny dummy PDF file for testing
        dummy_pdf_path = os.path.join(tempfile.gettempdir(), "test_cv.pdf")
        with open(dummy_pdf_path, "wb") as f:
            # Minimal PDF header so the content-type looks right
            f.write(b"%PDF-1.4 dummy test CV content")
        files["cv"] = ("test_cv.pdf", open(dummy_pdf_path, "rb"), "application/pdf")

    headers = {"Authorization": f"Bearer {token}"}

    print(f"\n[2] Sending POST to {url}")
    print(f"    Include CV: {include_cv}")
    print(f"    Data keys: {list(SAMPLE_DATA.keys())}")

    response = requests.post(url, data=form, files=files, headers=headers)

    print(f"\n[3] Response:")
    print(f"    Status: {response.status_code}")
    try:
        body = response.json()
        print(f"    Body:   {json.dumps(body, indent=2)}")
    except Exception:
        print(f"    Body:   {response.text}")

    return response


# ── Main ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  Account Setup Route — Test Script")
    print("=" * 60)

    # Authenticate
    try:
        token = get_access_token()
    except Exception as e:
        print(f"\n❌ Authentication failed: {e}")
        print("   Make sure TEST_EMAIL and TEST_PASSWORD are set to valid credentials.")
        exit(1)

    # Test with CV
    print("\n--- Test 1: With CV file ---")
    test_account_setup(token, include_cv=True)

    # Test without CV
    print("\n--- Test 2: Without CV file ---")
    test_account_setup(token, include_cv=False)

    print("\n" + "=" * 60)
    print("  Done!")
    print("=" * 60)
