"""One-off test data seed: configures an enterprise for mehdichtourou@gmail.com
and creates an ML Engineer job under it, with a real embedding.
"""
import asyncio
import os
import sys
from datetime import datetime

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import pymysql
import pymysql.cursors

from database.mysql import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
from database.mongodb_async import get_async_db
from services.ai_matching import AIMatchingService

TARGET_EMAIL = "mehdichtourou@gmail.com"

JOB_DESCRIPTION = (
    "We are looking for a Machine Learning Engineer to design, build, and deploy "
    "production-grade ML models. You will work closely with data engineers and "
    "product teams to turn business problems into ML solutions, from data pipeline "
    "design to model training, evaluation, and deployment at scale."
)

JOB_REQUIREMENTS = [
    "3+ years of experience building and deploying ML models in production",
    "Strong proficiency in Python and ML frameworks (PyTorch, TensorFlow, or scikit-learn)",
    "Experience with data pipelines and feature engineering",
    "Solid understanding of MLOps practices (model versioning, monitoring, CI/CD for ML)",
    "Familiarity with cloud platforms (AWS, GCP, or Azure)",
    "Strong background in statistics and applied machine learning",
]

JOB_BENEFITS = [
    "Competitive salary",
    "Remote-friendly / hybrid work",
    "Health insurance",
    "Training & conference budget",
]


async def main():
    # 1. Fetch the MariaDB identity for the target user
    conn = pymysql.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, cursorclass=pymysql.cursors.DictCursor,
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT u.id, u.email, p.role, p.status, p.first_name, p.last_name
                FROM users u JOIN profiles p ON p.id = u.id
                WHERE u.email = %s
                """,
                (TARGET_EMAIL,),
            )
            user = cursor.fetchone()
    finally:
        conn.close()

    if not user:
        print(f"ERROR: no user found in MariaDB for {TARGET_EMAIL}")
        sys.exit(1)

    user_id = user["id"]
    first_name = user["first_name"] or "Mehdi"
    last_name = user["last_name"] or "Chtourou"
    role = user["role"]
    print(f"Found MariaDB user: {user_id} ({user['email']}, role={role})")

    db = get_async_db()

    # 2. Create (or reuse) the enterprise for this user
    existing_company = await db.hr_companies.find_one({"contact_email": TARGET_EMAIL})
    now = datetime.utcnow()
    if existing_company:
        company_id = str(existing_company["_id"])
        print(f"Reusing existing company {company_id}")
    else:
        company_doc = {
            "name": "Chtourou AI Solutions",
            "siret": None,
            "domain": "Technology",
            "size": "11-50",
            "description": (
                "AI and machine learning consultancy building predictive models "
                "and data-driven products for clients across industries."
            ),
            "values": ["Innovation", "Data-driven", "Ownership"],
            "benefits": JOB_BENEFITS,
            "email": TARGET_EMAIL,
            "phone": None,
            "contact_email": TARGET_EMAIL,
            "contact_phone": None,
            "website": None,
            "address": None,
            "city": "Tunis",
            "zip_code": None,
            "country": "Tunisia",
            "latitude": None,
            "longitude": None,
            "logo_url": None,
            "primary_color": None,
            "linkedin": None,
            "twitter": None,
            "employee_count": 25,
            "users_count": 0,
            "jobs_count": 0,
            "status": "active",
            "onboarding_done": True,
            "created_at": now,
            "updated_at": now,
        }
        result = await db.hr_companies.insert_one(company_doc)
        company_id = str(result.inserted_id)
        print(f"Created company {company_id}")

    # 3. Ensure the user has an hr_profiles doc linked to the company
    existing_profile = await db.hr_profiles.find_one({"_id": user_id})
    if existing_profile:
        await db.hr_profiles.update_one(
            {"_id": user_id},
            {"$set": {"company_id": company_id, "updated_at": now}},
        )
        print(f"Updated existing hr_profiles doc for {user_id} -> company {company_id}")
    else:
        profile_doc = {
            "_id": user_id,
            "email": TARGET_EMAIL,
            "first_name": first_name,
            "last_name": last_name,
            "role": role,
            "status": "active",
            "company_id": company_id,
            "department_id": None,
            "phone": None,
            "position": "Administrator",
            "avatar_url": None,
            "bio": None,
            "skills": [],
            "experience": [],
            "education": [],
            "social_links": {},
            "preferences": {"onboarding_done": True},
            "metadata": {},
            "profileStrength": 0,
            "profileMissing": [],
            "created_at": now,
            "updated_at": now,
        }
        await db.hr_profiles.insert_one(profile_doc)
        print(f"Created hr_profiles doc for {user_id} -> company {company_id}")

    # 4. Create the ML Engineer job, with a real (manually-triggered) embedding
    ai_svc = AIMatchingService(db)
    try:
        embedding = await ai_svc.generate_embedding(JOB_DESCRIPTION)
    finally:
        await ai_svc.close()

    if not embedding:
        print("WARNING: embedding generation returned nothing; job will be saved without an embedding.")

    job_doc = {
        "title": "ML Engineer",
        "company_id": company_id,
        "department_id": None,
        "description": JOB_DESCRIPTION,
        "requirements": JOB_REQUIREMENTS,
        "location": "Tunis, Tunisia",
        "type": "full-time",
        "status": "open",
        "salary_range": "3000-4500 TND",
        "missions": (
            "- Design and train ML models for real business use cases\n"
            "- Build and maintain data/feature pipelines\n"
            "- Deploy and monitor models in production\n"
            "- Collaborate with data engineers and product teams"
        ),
        "work_mode": "hybrid",
        "experience_level": "mid",
        "screening_questions": [],
        "notification_email": TARGET_EMAIL,
        "deadline": None,
        "benefits": JOB_BENEFITS,
        "require_motivation_letter": False,
        "allow_hr": True,
        "ai_automation": None,
        "created_at": now,
        "updated_at": now,
    }
    if embedding:
        job_doc["embedding"] = embedding

    result = await db.hr_jobs.insert_one(job_doc)
    print(f"Created job {result.inserted_id} (title='ML Engineer', embedding_dim={len(embedding) if embedding else 0})")

    print("\nDone.")
    print(f"  company_id = {company_id}")
    print(f"  job_id     = {result.inserted_id}")


if __name__ == "__main__":
    asyncio.run(main())
