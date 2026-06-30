"""
=============================================================================
HumatiQ — AI Automation Funnel  •  Full End-to-End Pipeline Test
=============================================================================

Run this from the backend/ directory:

    python test_automation_pipeline.py

The script will:
1. Connect to MongoDB Atlas (uses .env credentials automatically)
2. List all jobs in the DB and let you pick one interactively
3. Create 5 fake candidate profiles with realistic data
4. Submit 5 job applications to the chosen job
5. Run the full automation pipeline:
        - Vector embedding scoring
        - LLM evaluation (AI score + justification)
        - Quiz generation & publication
        - Status promotions
6. Print a complete report with all scores, statuses, and quiz details

Cleanup flags at the bottom control whether test data is deleted after the run.
=============================================================================
"""

'''
Run time started 7.42 PM ended 7.50 PM 8 minutes
'''


import asyncio
import os
import sys
import logging
from datetime import datetime, timedelta, timezone

UTC = timezone.utc


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)
from pathlib import Path
from pprint import pprint

# ── Make sure the backend package is importable ──────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

# Load .env before anything else
from dotenv import load_dotenv
load_dotenv(BACKEND_DIR / ".env")

import certifi
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from services.job_automation import run_deadline_automation_for_job

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("pipeline_test")

# ── Config ────────────────────────────────────────────────────────────────────
CLEANUP_CANDIDATES_AFTER = False   # Set True to delete fake candidates
CLEANUP_APPLICATIONS_AFTER = False # Set True to delete applications
CLEANUP_QUIZZES_AFTER = False      # Set True to delete generated quizzes

# ── Fake candidates ───────────────────────────────────────────────────────────
FAKE_CANDIDATES = [
    {
        "firstName": "Amine",
        "lastName":  "Trabelsi",
        "email":     "amine.trabelsi.fake@humatiq-test.io",
        "title":     "Développeur Full-Stack Senior",
        "about":     (
            "5 ans d'expérience en développement web full-stack. "
            "Expert React, Node.js et MongoDB. Passionné par les architectures micro-services "
            "et l'automatisation des tests. A travaillé sur des plateformes SaaS B2B."
        ),
        "skills":    ["React", "Node.js", "MongoDB", "TypeScript", "Docker", "CI/CD", "REST APIs", "GraphQL"],
        "experiences": [
            {
                "company":   "Sofrecom Tunisia",
                "position":  "Full-Stack Developer",
                "startDate": "2020-01",
                "endDate":   "2024-01",
                "description": "Development of telecom management dashboards using React and Node.js."
            }
        ],
        "educations": [
            {"degree": "Ingénieur en Informatique", "institution": "ESPRIT", "year": 2019}
        ],
        "languages": ["Arabe", "Français", "Anglais"],
    },
    {
        "firstName": "Sarra",
        "lastName":  "Ben Amor",
        "email":     "sarra.benamor.fake@humatiq-test.io",
        "title":     "Développeuse Frontend React",
        "about":     (
            "3 ans d'expérience en développement frontend avec React et Vue.js. "
            "Bonne maîtrise de Tailwind CSS et des tests unitaires avec Jest. "
            "Notions de backend avec Express.js."
        ),
        "skills":    ["React", "Vue.js", "Tailwind CSS", "Jest", "JavaScript", "HTML", "CSS"],
        "experiences": [
            {
                "company":   "Vermeg",
                "position":  "Frontend Developer",
                "startDate": "2021-03",
                "endDate":   "2024-03",
                "description": "Building financial dashboard UIs in React."
            }
        ],
        "educations": [
            {"degree": "Licence en Informatique", "institution": "FST Tunis", "year": 2020}
        ],
        "languages": ["Arabe", "Français"],
    },
    {
        "firstName": "Khalil",
        "lastName":  "Mansour",
        "email":     "khalil.mansour.fake@humatiq-test.io",
        "title":     "Ingénieur DevOps & Backend Python",
        "about":     (
            "Ingénieur DevOps avec 4 ans d'expérience. Expert en Kubernetes, Terraform "
            "et pipelines CI/CD. Compétences solides en Python (FastAPI, Django) et bases "
            "de données PostgreSQL et MongoDB."
        ),
        "skills":    ["Python", "FastAPI", "Kubernetes", "Docker", "Terraform", "PostgreSQL", "MongoDB", "Linux"],
        "experiences": [
            {
                "company":   "Orange Digital Center",
                "position":  "DevOps Engineer",
                "startDate": "2020-06",
                "endDate":   "2024-06",
                "description": "Orchestration des déploiements cloud et automatisation des pipelines."
            }
        ],
        "educations": [
            {"degree": "Ingénieur en Systèmes Informatiques", "institution": "ENIT", "year": 2020}
        ],
        "languages": ["Arabe", "Français", "Anglais"],
    },
    {
        "firstName": "Nour",
        "lastName":  "Jouini",
        "email":     "nour.jouini.fake@humatiq-test.io",
        "title":     "Développeuse Web Junior",
        "about":     (
            "Jeune développeuse avec 1 an d'expérience. Maîtrise HTML, CSS et notions de React. "
            "En cours d'apprentissage de Node.js et des APIs REST."
        ),
        "skills":    ["HTML", "CSS", "JavaScript", "React (notions)", "Git"],
        "experiences": [
            {
                "company":   "Startup locale",
                "position":  "Stagiaire Développement Web",
                "startDate": "2023-07",
                "endDate":   "2024-01",
                "description": "Création de landing pages et intégration de maquettes Figma."
            }
        ],
        "educations": [
            {"degree": "Licence en Multimédia", "institution": "ISAMM Tunis", "year": 2023}
        ],
        "languages": ["Arabe", "Français"],
    },
    {
        "firstName": "Youssef",
        "lastName":  "Chaker",
        "email":     "youssef.chaker.fake@humatiq-test.io",
        "title":     "Lead Développeur Full-Stack & Architecte Cloud",
        "about":     (
            "8 ans d'expérience en développement logiciel. Expert en architecture micro-services, "
            "React, Next.js, Node.js, Python, AWS et Azure. A dirigé des équipes de 10+ développeurs "
            "et livré des projets à grande échelle pour des clients européens."
        ),
        "skills":    [
            "React", "Next.js", "Node.js", "Python", "FastAPI", "AWS", "Azure",
            "MongoDB", "PostgreSQL", "Redis", "Docker", "Kubernetes", "TypeScript",
            "System Design", "Team Leadership"
        ],
        "experiences": [
            {
                "company":   "Capgemini Tunisia",
                "position":  "Lead Full-Stack Developer",
                "startDate": "2016-09",
                "endDate":   "2024-04",
                "description": "Architecture and delivery of SaaS platforms for European clients."
            }
        ],
        "educations": [
            {"degree": "Ingénieur en Génie Logiciel", "institution": "SUP'COM", "year": 2016}
        ],
        "languages": ["Arabe", "Français", "Anglais", "Espagnol"],
    },
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sep(title: str = "") -> None:
    width = 70
    if title:
        pad = (width - len(title) - 2) // 2
        print(f"\n{'─'*pad} {title} {'─'*(width - pad - len(title) - 2)}")
    else:
        print("─" * width)


def _pick(prompt: str, count: int) -> int:
    """Prompt the user to pick a number in [1, count]. Returns 0-based index."""
    while True:
        try:
            raw = input(f"\n{prompt} [1-{count}]: ").strip()
            idx = int(raw) - 1
            if 0 <= idx < count:
                return idx
            print(f"  ⚠️  Please enter a number between 1 and {count}.")
        except (ValueError, EOFError):
            print("  ⚠️  Invalid input, try again.")


# ── Main pipeline test ────────────────────────────────────────────────────────

async def run_test():
    mongo_url = os.getenv("MONGODB_URL")
    if not mongo_url:
        raise RuntimeError("MONGODB_URL not set in .env")

    client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=15000)
    db = client["HumatiQ"]

    created_candidate_ids = []
    created_app_ids       = []
    created_quiz_ids      = []

    try:
        # ── 1. List jobs and let user choose ─────────────────────────────────
        _sep("STEP 1 — Choose a job")

        jobs = await db.hr_jobs.find({}).to_list(length=100)
        if not jobs:
            raise RuntimeError("❌ No jobs found in the database! Create at least one job first.")

        # Build a company name lookup
        company_ids = list({j.get("company_id") for j in jobs if j.get("company_id")})
        companies_cursor = db.hr_companies.find(
            {"_id": {"$in": [ObjectId(c) for c in company_ids if c and len(c) == 24]}}
        )
        company_map = {}
        async for comp in companies_cursor:
            company_map[str(comp["_id"])] = comp.get("name", "Unknown")

        print(f"\n  {'#':<4} {'Job Title':<45} {'Company':<25} {'Status':<12} {'Deadline'}")
        print(f"  {'─'*4} {'─'*45} {'─'*25} {'─'*12} {'─'*20}")
        for i, job in enumerate(jobs, 1):
            company_name = company_map.get(str(job.get("company_id", "")), "—")
            deadline_raw = job.get("deadline", "")
            try:
                deadline_str = deadline_raw[:10] if deadline_raw else "—"
            except Exception:
                deadline_str = str(deadline_raw)[:10]
            print(
                f"  {i:<4} {job.get('title','(no title)')[:44]:<45} "
                f"{company_name[:24]:<25} {job.get('status','?'):<12} {deadline_str}"
            )

        job_idx = _pick("Select a job number", len(jobs))
        chosen_job = jobs[job_idx]
        chosen_job_id = str(chosen_job["_id"])
        chosen_job_title = chosen_job.get("title", "(no title)")
        company_id = str(chosen_job.get("company_id", ""))
        company_name = company_map.get(company_id, "Unknown")

        print(f"\n✅ Selected job : '{chosen_job_title}'")
        print(f"   Job ID       : {chosen_job_id}")
        print(f"   Company      : {company_name}")
        print(f"   Status       : {chosen_job.get('status','?')}")

        # ── 1b. Ensure automation config is complete ─────────────────────────
        _sep("STEP 1b — Verify / patch automation config")
        ai_auto = chosen_job.get("ai_automation") or {}
        quiz_stage_cfg = ai_auto.get("quiz_stage") or {}
        quiz_configs = quiz_stage_cfg.get("quizzes") or []

        automation_ready = (
            ai_auto.get("enabled")
            and quiz_stage_cfg.get("enabled")
            and len(quiz_configs) > 0
        )

        if automation_ready:
            print("   ✅ Job already has a complete automation config — using it as-is.")
        else:
            print("   ⚠️  Automation config is missing or incomplete — patching for test run.")

            # Need a quiz document to generate quizzes
            quiz_doc = await db.quiz_documents.find_one({"status": "ready"})
            if not quiz_doc:
                quiz_doc = await db.quiz_documents.find_one({})
            if not quiz_doc:
                raise RuntimeError(
                    "❌ No quiz documents found in the database!\n"
                    "   Upload at least one document in HR Settings → Quiz Documents\n"
                    "   and make sure its status is 'ready' before running this test."
                )
            doc_id    = str(quiz_doc["_id"])
            doc_title = quiz_doc.get("title") or quiz_doc.get("filename") or "Document Technique"
            doc_status = quiz_doc.get("status", "unknown")
            print(f"   📄 Quiz document: '{doc_title}' (status={doc_status})")

            quiz_deadline = (_now() + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S")
            patched_automation = {
                "enabled":      True,
                "trigger_mode": "deadline",
                "vector_filter": {
                    "enabled":          True,
                    "top_x_candidates": 5,
                    "top_y_candidates": None,
                },
                "ai_score_filter": {
                    "enabled":          True,
                    "top_x_candidates": None,
                    "top_y_candidates": 3,
                },
                "quiz_stage": {
                    "enabled":                    True,
                    "approve_top_z_to_interview": 2,
                    "quizzes": [
                        {
                            "title":             f"Quiz Technique – {doc_title}",
                            "document_id":       doc_id,
                            "document_title":    doc_title,
                            "total_questions":   8,
                            "duration_minutes":  20,
                            "weight_percentage": 100,
                            "difficulty_mix":    {"easy": 0.35, "medium": 0.45, "hard": 0.20},
                            "deadline_mode":     "absolute",
                            "deadline_at":       quiz_deadline,
                        }
                    ],
                },
            }
            await db.hr_jobs.update_one(
                {"_id": ObjectId(chosen_job_id)},
                {"$set": {"ai_automation": patched_automation}},
            )
            print("   ✅ Automation config patched (enabled + quiz stage with top-5 → top-3 → top-2 funnel).")

        # Patch the job's deadline to be in the past so automation fires
        _sep("STEP 1c — Patch job deadline to trigger automation")
        past_deadline = (_now() - timedelta(minutes=5)).isoformat()
        await db.hr_jobs.update_one(
            {"_id": ObjectId(chosen_job_id)},
            {"$set": {"deadline": past_deadline, "allow_hr": False}}
        )
        # Re-fetch with all patches applied
        chosen_job = await db.hr_jobs.find_one({"_id": ObjectId(chosen_job_id)})
        print(f"   ✅ Deadline set to {past_deadline} (past → automation will fire immediately)")

        # ── 2. Create fake candidates + their profiles ────────────────────────
        _sep("STEP 2 — Create 5 fake candidates")
        for cand_data in FAKE_CANDIDATES:
            fake_user_id = f"test-user-{ObjectId()}"
            candidate_doc = {
                **cand_data,
                "user_id":    fake_user_id,
                "created_at": _now(),
                "updated_at": _now(),
            }
            res = await db.candidates.insert_one(candidate_doc)
            created_candidate_ids.append((str(res.inserted_id), fake_user_id, cand_data["firstName"] + " " + cand_data["lastName"]))
            print(f"   ✅ Created candidate: {cand_data['firstName']} {cand_data['lastName']} ({cand_data['title']})")

        # ── 3. Submit applications ────────────────────────────────────────────
        _sep("STEP 3 — Submit job applications")
        for (cand_mongo_id, fake_user_id, full_name) in created_candidate_ids:
            cand = await db.candidates.find_one({"_id": ObjectId(cand_mongo_id)})
            snapshot = {
                k: cand.get(k)
                for k in ["firstName", "lastName", "skills", "experiences",
                          "educations", "languages", "title", "about"]
                if cand.get(k)
            }

            app_doc = {
                "candidate_id":    fake_user_id,
                "job_id":          chosen_job_id,
                "motivation_letter": (
                    f"Bonjour, je suis {full_name} et je souhaite postuler au poste de {chosen_job_title}. "
                    "Mon expérience correspond aux exigences du poste. Merci."
                ),
                "status":          "new",
                "profile_snapshot": snapshot,
                "applied_at":      _now(),
            }
            res = await db.job_applications.insert_one(app_doc)
            app_id = str(res.inserted_id)
            created_app_ids.append(app_id)
            print(f"   ✅ Application submitted by {full_name} (app_id={app_id})")

        # ── 4. Run the AI automation pipeline ────────────────────────────────
        _sep("STEP 4 — Running AI automation pipeline")
        print("   ⏳ This may take 1–3 minutes (embedding + LLM scoring + quiz generation)…\n")

        result = await run_deadline_automation_for_job(db, chosen_job)

        # Collect generated quiz IDs
        quizzes_found = await db.quizzes.find(
            {"automation_run_id": result.get("run_id")}
        ).to_list(length=100)
        created_quiz_ids = [str(q["_id"]) for q in quizzes_found]

        # ── 5. Report ─────────────────────────────────────────────────────────
        _sep("PIPELINE RESULTS")
        print(f"\n  Job Title   : {chosen_job_title}")
        print(f"  Job ID      : {chosen_job_id}")
        print(f"  Run ID      : {result.get('run_id')}")
        print()
        print(f"  Applications considered      : {result.get('applications_considered')}")
        print(f"  Passed vector filter (top-X) : {result.get('vector_shortlist_count')}")
        print(f"  Passed AI filter (top-Y)     : {result.get('ai_shortlist_count')}")
        print(f"  Quizzes published            : {result.get('quizzes_published')}")
        print(f"  Promoted to interview        : {len(result.get('promoted_to_interview', []))}")
        if result.get("promoted_to_interview"):
            for app_id in result["promoted_to_interview"]:
                print(f"    → App ID {app_id}")

        _sep("CANDIDATE-LEVEL BREAKDOWN")
        apps_after = await db.job_applications.find(
            {"job_id": chosen_job_id}
        ).to_list(length=20)

        apps_after.sort(key=lambda a: (a.get("ai_score") or 0), reverse=True)

        print(f"\n  {'Name':<26} {'Status':<18} {'Vector%':>8} {'AI Score':>9} {'Quiz sent':>10}")
        print(f"  {'─'*26} {'─'*18} {'─'*8} {'─'*9} {'─'*10}")
        for app in apps_after:
            cand_id = app.get("candidate_id")
            cand_doc = await db.candidates.find_one({"user_id": cand_id})
            name = (
                f"{cand_doc.get('firstName','')} {cand_doc.get('lastName','')}"
                if cand_doc else cand_id
            )
            status       = app.get("status", "?")
            vector_score = app.get("vector_match_score") or app.get("automation_vector_score") or 0
            ai_score     = app.get("ai_score") or 0
            quiz_status  = app.get("quiz_status") or "—"
            print(f"  {name:<26} {status:<18} {vector_score:>7.1f}% {ai_score:>9} {quiz_status:>10}")

        if quizzes_found:
            _sep("QUIZZES GENERATED")
            for quiz in quizzes_found:
                print(f"\n  Quiz ID     : {quiz['_id']}")
                print(f"  Title       : {quiz.get('title')}")
                print(f"  Application : {quiz.get('application_id')}")
                print(f"  Status      : {quiz.get('status')}")
                print(f"  Questions   : {len(quiz.get('questions', []))}")
                print(f"  Duration    : {quiz.get('duration_minutes')} min")
                print(f"  Weight      : {quiz.get('weight_percentage')}%")
                qs = quiz.get("questions", [])
                if qs:
                    print(f"\n  Sample questions:")
                    for i, q in enumerate(qs[:3], 1):
                        print(f"    {i}. [{q.get('type','?').upper()}] {q.get('question','')[:90]}")
                        if q.get("type") == "mcq":
                            for opt in (q.get("options") or [])[:4]:
                                if isinstance(opt, dict):
                                    marker = "✓" if opt.get("is_correct") else " "
                                    text   = opt.get("text", str(opt))
                                else:
                                    marker = " "
                                    text   = str(opt)
                                print(f"       {marker} {text[:70]}")
                        elif q.get("type") == "tf":
                            print(f"       Answer: {q.get('answer')}")
                    if len(qs) > 3:
                        print(f"    … and {len(qs)-3} more questions.")

        _sep("DONE")
        print(f"\n✅ Pipeline test completed successfully!")
        print(f"\n   To see results in the UI:")
        print(f"   → Log in as HR for company '{company_name}'")
        print(f"   → Go to Jobs → look for: \"{chosen_job_title}\"")
        print(f"   → Check the Applications tab and Quizzes for each candidate\n")

    finally:
        # ── Cleanup ───────────────────────────────────────────────────────────
        if any([CLEANUP_CANDIDATES_AFTER, CLEANUP_APPLICATIONS_AFTER, CLEANUP_QUIZZES_AFTER]):
            _sep("CLEANUP")

        if CLEANUP_QUIZZES_AFTER and created_quiz_ids:
            await db.quizzes.delete_many({"_id": {"$in": [ObjectId(q) for q in created_quiz_ids]}})
            print(f"   🗑  Deleted {len(created_quiz_ids)} quiz(zes)")

        if CLEANUP_APPLICATIONS_AFTER and created_app_ids:
            await db.job_applications.delete_many(
                {"_id": {"$in": [ObjectId(a) for a in created_app_ids]}}
            )
            print(f"   🗑  Deleted {len(created_app_ids)} application(s)")

        if CLEANUP_CANDIDATES_AFTER and created_candidate_ids:
            mongo_ids = [ObjectId(x[0]) for x in created_candidate_ids]
            await db.candidates.delete_many({"_id": {"$in": mongo_ids}})
            print(f"   🗑  Deleted {len(created_candidate_ids)} candidate(s)")

        client.close()


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "═"*70)
    print("  HumatiQ — AI Automation Funnel  •  Pipeline Test")
    print("═"*70)
    asyncio.run(run_test())
