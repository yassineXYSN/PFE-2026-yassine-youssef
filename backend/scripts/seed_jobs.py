"""
Seed 15 jobs — 3 per company — across all 5 companies in hr_companies.

Usage (from the backend/ directory):
    python scripts/seed_jobs.py
"""

import os
import sys
import random
import math
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

from database.mongodb import connect_mongodb


def _random_embedding(dim: int = 768, seed: int = None) -> list:
    """Random unit vector — simulates a job embedding for demo purposes."""
    rng = random.Random(seed)
    vec = [rng.gauss(0, 1) for _ in range(dim)]
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0:
        return [0.0] * dim
    return [x / norm for x in vec]


def _deadline(days: int) -> str:
    return (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S")


JOBS_BY_DOMAIN = {
    "tech": [
        {
            "title": "Full Stack Developer",
            "description": (
                "We are looking for a skilled Full Stack Developer to join Nexasoft's product team. "
                "You will design and build scalable web applications using React and Node.js, "
                "collaborate with UX designers, and contribute to our microservices architecture. "
                "Strong knowledge of REST APIs, PostgreSQL, Docker, and CI/CD pipelines is expected."
            ),
            "requirements": [
                "3+ years of experience with React and Node.js",
                "Proficiency in TypeScript and REST API design",
                "Familiarity with Docker and cloud deployment (AWS or Azure)",
                "Experience with PostgreSQL or MongoDB",
                "Strong communication skills and team spirit",
            ],
            "location": "Ben Arous, Tunisia",
            "type": "full-time",
            "work_mode": "remote",
            "experience_level": "mid",
            "salary_range": "2500-3500 TND",
            "benefits": ["Remote work", "Health insurance", "Annual bonus", "Training budget"],
            "missions": (
                "- Develop and maintain React front-end features\n"
                "- Build Node.js microservices and REST endpoints\n"
                "- Participate in code reviews and sprint planning\n"
                "- Monitor application performance and optimize bottlenecks"
            ),
            "deadline": _deadline(45),
            "seed": 101,
        },
        {
            "title": "DevOps Engineer",
            "description": (
                "Nexasoft seeks a senior DevOps Engineer to own our cloud infrastructure. "
                "You will automate deployments on Kubernetes, manage CI/CD pipelines with GitHub Actions, "
                "and ensure 99.9% availability of our SaaS platform. "
                "Experience with Terraform, Prometheus/Grafana, and security hardening is a must."
            ),
            "requirements": [
                "5+ years in DevOps or SRE roles",
                "Strong Kubernetes and Helm chart expertise",
                "Terraform / Infrastructure-as-Code proficiency",
                "Experience with observability stacks (Prometheus, Grafana, ELK)",
                "Linux system administration skills",
            ],
            "location": "Ben Arous, Tunisia",
            "type": "full-time",
            "work_mode": "hybrid",
            "experience_level": "senior",
            "salary_range": "4000-5500 TND",
            "benefits": ["Flexible hours", "Stock options", "Health insurance", "Home office equipment"],
            "missions": (
                "- Manage and scale Kubernetes clusters on AWS EKS\n"
                "- Design GitOps workflows and deployment pipelines\n"
                "- Conduct capacity planning and cost optimization\n"
                "- Lead incident response and post-mortems"
            ),
            "deadline": _deadline(30),
            "seed": 102,
        },
        {
            "title": "Data Scientist",
            "description": (
                "Join Nexasoft's AI team as a junior Data Scientist and help build intelligent product features. "
                "You will work on NLP models for automated HR document processing, "
                "develop predictive analytics dashboards, and perform A/B testing. "
                "A solid background in Python, machine learning, and data visualization is expected."
            ),
            "requirements": [
                "Bachelor or Master degree in Computer Science, Statistics, or related field",
                "Proficiency in Python (pandas, scikit-learn, PyTorch or TensorFlow)",
                "Experience with NLP techniques (embeddings, transformers)",
                "Ability to communicate findings clearly to non-technical stakeholders",
                "Familiarity with SQL and data pipelines",
            ],
            "location": "Ben Arous, Tunisia",
            "type": "full-time",
            "work_mode": "onsite",
            "experience_level": "junior",
            "salary_range": "1800-2400 TND",
            "benefits": ["Learning budget", "Annual conference pass", "Lunch vouchers"],
            "missions": (
                "- Build and evaluate ML models for CV parsing and matching\n"
                "- Create data pipelines from raw HR data to model-ready features\n"
                "- Produce analytical reports for product and leadership teams\n"
                "- Collaborate with backend engineers to deploy models to production"
            ),
            "deadline": _deadline(60),
            "seed": 103,
        },
    ],
    "finance": [
        {
            "title": "Financial Analyst",
            "description": (
                "CapitaLink Finance is hiring a Financial Analyst to support investment decisions "
                "and portfolio monitoring. You will build financial models, analyze market trends, "
                "and produce detailed reports for institutional clients. "
                "CFA candidacy and strong Excel/Power BI skills are a plus."
            ),
            "requirements": [
                "2+ years of experience in financial analysis or investment banking",
                "Strong Excel and financial modelling skills",
                "Knowledge of accounting principles (IFRS/GAAP)",
                "Experience with Bloomberg Terminal or equivalent data platforms",
                "Excellent written and verbal communication in French and English",
            ],
            "location": "Ariana, Tunisia",
            "type": "full-time",
            "work_mode": "onsite",
            "experience_level": "mid",
            "salary_range": "3000-4000 TND",
            "benefits": ["Performance bonus", "Health insurance", "Professional development fund"],
            "missions": (
                "- Build DCF and comparable company analysis models\n"
                "- Monitor portfolio performance and generate weekly reports\n"
                "- Support due diligence for M&A transactions\n"
                "- Present findings to senior management and clients"
            ),
            "deadline": _deadline(40),
            "seed": 201,
        },
        {
            "title": "Risk & Compliance Manager",
            "description": (
                "CapitaLink Finance is looking for a Risk & Compliance Manager to lead our regulatory "
                "framework and internal control processes. "
                "You will ensure adherence to BCT regulations, manage operational risk assessments, "
                "and coordinate audits with external reviewers. "
                "Proven experience in the Tunisian financial sector is required."
            ),
            "requirements": [
                "7+ years in risk management or compliance within financial services",
                "In-depth knowledge of BCT regulations and AML/CFT frameworks",
                "Experience with Basel III / credit risk methodologies",
                "Strong analytical mindset and attention to detail",
                "Certified Risk Manager (CRM) or equivalent is a plus",
            ],
            "location": "Ariana, Tunisia",
            "type": "full-time",
            "work_mode": "onsite",
            "experience_level": "senior",
            "salary_range": "5500-7000 TND",
            "benefits": ["Executive bonus", "Company car", "Full health coverage", "Pension plan"],
            "missions": (
                "- Design and implement the enterprise risk management framework\n"
                "- Perform quarterly risk assessments and stress tests\n"
                "- Liaise with the BCT and external auditors during inspections\n"
                "- Train operational teams on compliance procedures"
            ),
            "deadline": _deadline(35),
            "seed": 202,
        },
        {
            "title": "Junior Investment Advisor",
            "description": (
                "CapitaLink Finance invites recent graduates to join our Wealth Management division "
                "as Junior Investment Advisors. You will support senior advisors in portfolio construction, "
                "conduct client onboarding, and prepare investment proposals tailored to client risk profiles. "
                "Strong interpersonal skills and a passion for financial markets are essential."
            ),
            "requirements": [
                "Bachelor degree in Finance, Economics, or Business Administration",
                "Knowledge of financial products (equities, bonds, mutual funds)",
                "Excellent customer-facing communication skills",
                "High motivation to pursue CFA or CISI certifications",
                "Proficiency in MS Office Suite",
            ],
            "location": "Ariana, Tunisia",
            "type": "full-time",
            "work_mode": "hybrid",
            "experience_level": "junior",
            "salary_range": "1600-2200 TND",
            "benefits": ["Exam fee sponsorship (CFA/CISI)", "Mentorship programme", "Health insurance"],
            "missions": (
                "- Assist in building client investment portfolios\n"
                "- Prepare pitch decks and investment recommendations\n"
                "- Conduct market research and summarize sector reports\n"
                "- Handle client inquiries and meeting coordination"
            ),
            "deadline": _deadline(50),
            "seed": 203,
        },
    ],
    "autre": [
        {
            "title": "Civil Engineer – Structural",
            "description": (
                "BâtiPro Groupe recruits a Civil Engineer specializing in structural design "
                "to join large-scale commercial and residential construction projects in Hammamet. "
                "You will produce technical drawings, conduct site inspections, "
                "and ensure compliance with Tunisian and international building codes. "
                "Proficiency in AutoCAD and Robot Structural Analysis is required."
            ),
            "requirements": [
                "Engineering degree in Civil or Structural Engineering",
                "3+ years of structural design experience",
                "Mastery of AutoCAD, Revit, and Robot Structural Analysis",
                "Knowledge of Tunisian and Eurocode standards",
                "Ability to manage subcontractors and site teams",
            ],
            "location": "Hammamet, Tunisia",
            "type": "full-time",
            "work_mode": "onsite",
            "experience_level": "mid",
            "salary_range": "2800-3800 TND",
            "benefits": ["Company vehicle", "Site allowances", "Health insurance", "Annual leave bonus"],
            "missions": (
                "- Design structural elements (foundations, columns, slabs) using Eurocode\n"
                "- Prepare and review technical specifications and bill of quantities\n"
                "- Coordinate with architects and MEP engineers\n"
                "- Conduct weekly site inspections and progress reporting"
            ),
            "deadline": _deadline(55),
            "seed": 301,
        },
        {
            "title": "Construction Project Manager",
            "description": (
                "BâtiPro Groupe is seeking a seasoned Construction Project Manager to lead "
                "a landmark mixed-use development in Hammamet worth over 40M TND. "
                "You will manage the full project lifecycle from planning and tendering "
                "to delivery and handover, ensuring quality, budget, and schedule targets are met."
            ),
            "requirements": [
                "10+ years of construction project management experience",
                "PMP or Prince2 certification preferred",
                "Expertise in contract management (FIDIC contracts)",
                "Strong leadership and negotiation skills",
                "Experience with MS Project or Primavera P6",
            ],
            "location": "Hammamet, Tunisia",
            "type": "full-time",
            "work_mode": "onsite",
            "experience_level": "senior",
            "salary_range": "6000-8500 TND",
            "benefits": ["Performance bonus up to 2 months salary", "Company vehicle", "Full health coverage"],
            "missions": (
                "- Define project scope, schedule, and budget baselines\n"
                "- Manage relationships with contractors, consultants, and the client\n"
                "- Chair weekly progress meetings and resolve blockers\n"
                "- Prepare monthly executive reports and risk registers"
            ),
            "deadline": _deadline(25),
            "seed": 302,
        },
        {
            "title": "Site Supervisor",
            "description": (
                "BâtiPro Groupe is looking for a motivated Site Supervisor to oversee daily "
                "construction activities across residential housing projects in Hammamet. "
                "You will coordinate trades on-site, monitor quality standards, "
                "and enforce health & safety regulations. "
                "This is a great entry-level opportunity for engineering graduates."
            ),
            "requirements": [
                "Degree in Civil Engineering or Construction Technology",
                "0–2 years of site experience (internships count)",
                "Basic AutoCAD reading skills",
                "Strong organizational skills and attention to detail",
                "Valid driving licence",
            ],
            "location": "Hammamet, Tunisia",
            "type": "full-time",
            "work_mode": "onsite",
            "experience_level": "junior",
            "salary_range": "1500-2000 TND",
            "benefits": ["Transportation allowance", "Meals on site", "Training programme"],
            "missions": (
                "- Oversee day-to-day construction activities and trade coordination\n"
                "- Ensure compliance with plans, specs, and safety regulations\n"
                "- Maintain site daily reports and photo logs\n"
                "- Assist the senior engineer with quantity take-offs"
            ),
            "deadline": _deadline(70),
            "seed": 303,
        },
    ],
    "sante": [
        {
            "title": "General Practitioner",
            "description": (
                "MediCare Algérie is looking for an experienced General Practitioner to join "
                "our primary care network in Béjaïa region. "
                "You will provide comprehensive outpatient consultations, manage chronic disease follow-up, "
                "and coordinate referrals to specialists. "
                "Strong patient communication skills and commitment to evidence-based medicine are essential."
            ),
            "requirements": [
                "Medical degree (Doctorat en Médecine) and valid Algerian Medical Council registration",
                "7+ years of clinical practice experience",
                "Proficiency in Electronic Medical Records (EMR) systems",
                "Excellent diagnostic and patient management skills",
                "Ability to work in a multidisciplinary team",
            ],
            "location": "Béjaïa, Algeria",
            "type": "full-time",
            "work_mode": "onsite",
            "experience_level": "senior",
            "salary_range": "90000-120000 DZD",
            "benefits": ["Malpractice insurance covered", "CME budget", "Housing allowance", "Annual performance bonus"],
            "missions": (
                "- Conduct daily outpatient consultations (30–40 patients/day)\n"
                "- Manage chronic disease programs (diabetes, hypertension, asthma)\n"
                "- Coordinate care pathways and specialist referrals\n"
                "- Mentor resident doctors during rotations"
            ),
            "deadline": _deadline(45),
            "seed": 401,
        },
        {
            "title": "Medical Laboratory Technician",
            "description": (
                "MediCare Algérie seeks a junior Medical Laboratory Technician to join "
                "the diagnostic lab at our Béjaïa medical centre. "
                "You will perform routine and specialized biological analyses, maintain lab equipment, "
                "and ensure strict quality control procedures. "
                "Recent graduates with hands-on lab internship experience are welcome to apply."
            ),
            "requirements": [
                "Bachelor or Licence in Medical Biology or Biomedical Sciences",
                "Knowledge of hematology, biochemistry, microbiology analyzers",
                "Familiarity with ISO 15189 quality standards",
                "Attention to detail and accuracy in data recording",
                "Computer proficiency in LIMS software",
            ],
            "location": "Béjaïa, Algeria",
            "type": "full-time",
            "work_mode": "onsite",
            "experience_level": "junior",
            "salary_range": "40000-55000 DZD",
            "benefits": ["Uniform and PPE provided", "Health insurance", "Paid certification courses"],
            "missions": (
                "- Perform routine clinical analyses (CBC, metabolic panels, urinalysis)\n"
                "- Calibrate and maintain analytical instruments\n"
                "- Record results in LIMS and flag critical values to clinicians\n"
                "- Participate in internal quality audits and proficiency testing"
            ),
            "deadline": _deadline(60),
            "seed": 402,
        },
        {
            "title": "Nurse Coordinator – Chronic Disease Unit",
            "description": (
                "MediCare Algérie is recruiting a Nurse Coordinator to manage patient care plans "
                "in our Chronic Disease Unit in Béjaïa. "
                "You will lead a team of 6 nurses, coordinate multidisciplinary care meetings, "
                "implement nursing protocols, and liaise with patient families. "
                "Certified in advanced nursing practice with diabetes or cardiology experience preferred."
            ),
            "requirements": [
                "State Registered Nurse (IDE) licence",
                "3–5 years of clinical nursing with 1+ year in a coordination role",
                "Experience in chronic disease management (diabetes, heart failure)",
                "Strong leadership and conflict-resolution skills",
                "Proficiency in healthcare IT systems",
            ],
            "location": "Béjaïa, Algeria",
            "type": "full-time",
            "work_mode": "onsite",
            "experience_level": "mid",
            "salary_range": "65000-85000 DZD",
            "benefits": ["Shift allowances", "Leadership training sponsorship", "Health & dental coverage"],
            "missions": (
                "- Supervise and mentor a team of 6 registered nurses\n"
                "- Develop individualized care plans for chronic disease patients\n"
                "- Chair weekly multidisciplinary team meetings\n"
                "- Track clinical KPIs and report to the medical director"
            ),
            "deadline": _deadline(38),
            "seed": 403,
        },
    ],
    "education": [
        {
            "title": "E-Learning Instructor – Digital Marketing",
            "description": (
                "EduVision is expanding its online programme catalogue and needs an experienced "
                "E-Learning Instructor specialising in Digital Marketing. "
                "You will design engaging video modules, interactive assessments, and live webinars "
                "for working professionals across North Africa. "
                "A proven track record in content creation and adult learning methodologies is required."
            ),
            "requirements": [
                "3+ years of experience teaching or training in Digital Marketing",
                "Hands-on expertise in SEO, SEM, social media ads, email marketing, and analytics",
                "Experience designing courses on LMS platforms (Moodle, Canvas, or similar)",
                "Strong presentation and on-camera communication skills",
                "Instructional design certification is a plus (CPTD, ATD)",
            ],
            "location": "Sfax, Tunisia (Remote-first)",
            "type": "part-time",
            "work_mode": "remote",
            "experience_level": "mid",
            "salary_range": "1500-2200 TND",
            "benefits": ["Flexible schedule", "Platform revenue sharing", "CPD budget"],
            "missions": (
                "- Script and record high-quality video lessons (2–4 new modules/month)\n"
                "- Design quizzes, assignments, and rubrics aligned with learning outcomes\n"
                "- Host monthly live Q&A webinars for enrolled learners\n"
                "- Monitor learner engagement metrics and iterate on course content"
            ),
            "deadline": _deadline(50),
            "seed": 501,
        },
        {
            "title": "Curriculum Designer",
            "description": (
                "EduVision is hiring a senior Curriculum Designer to lead the development "
                "of a new MBA-equivalent professional certification programme. "
                "You will map competency frameworks, work with subject matter experts, "
                "and ensure alignment with international standards such as AACSB and QF-EHEA. "
                "Experience in higher education or professional training at scale is essential."
            ),
            "requirements": [
                "Master degree in Education, Instructional Design, or relevant discipline",
                "7+ years of curriculum development experience in higher education or corporate L&D",
                "Familiarity with competency-based education and micro-credentialing",
                "Strong project management skills and ability to coordinate multiple SMEs",
                "Fluency in French and English; Arabic is a plus",
            ],
            "location": "Sfax, Tunisia",
            "type": "full-time",
            "work_mode": "hybrid",
            "experience_level": "senior",
            "salary_range": "3500-5000 TND",
            "benefits": ["Academic sabbatical options", "International conference sponsorship", "Full health coverage"],
            "missions": (
                "- Lead curriculum mapping for the new professional certification\n"
                "- Draft programme outcomes, learning objectives, and assessment blueprints\n"
                "- Coordinate with 15+ subject matter experts to produce course materials\n"
                "- Submit accreditation documentation to international bodies"
            ),
            "deadline": _deadline(42),
            "seed": 502,
        },
        {
            "title": "LMS Administrator",
            "description": (
                "EduVision is looking for a junior LMS Administrator to manage the day-to-day "
                "operations of our Moodle-based learning platform serving 12,000 active learners. "
                "You will handle user enrolments, technical troubleshooting, plugin configuration, "
                "and learner analytics reporting. "
                "This is an ideal role for a recent IT graduate passionate about ed-tech."
            ),
            "requirements": [
                "Degree in Computer Science, Information Systems, or IT",
                "Basic experience with Moodle or another LMS (internship counts)",
                "Familiarity with HTML/CSS for minor platform customisations",
                "Strong analytical skills and comfort with data dashboards",
                "Good communication skills for learner support tickets",
            ],
            "location": "Sfax, Tunisia",
            "type": "full-time",
            "work_mode": "onsite",
            "experience_level": "junior",
            "salary_range": "1400-1900 TND",
            "benefits": ["Free access to all EduVision courses", "Mentoring by senior EdTech team", "Health insurance"],
            "missions": (
                "- Manage learner and instructor accounts on Moodle\n"
                "- Configure courses, activities, and grading rubrics\n"
                "- Resolve Level-1 technical support tickets within 24h\n"
                "- Produce monthly usage and completion rate reports"
            ),
            "deadline": _deadline(65),
            "seed": 503,
        },
    ],
}


def main():
    client = connect_mongodb()
    if not client:
        print("ERROR: Could not connect to MongoDB.")
        sys.exit(1)

    db = client["HumatiQ"]

    companies = list(db.hr_companies.find(
        {},
        {"_id": 1, "name": 1, "domain": 1}
    ))

    if not companies:
        print("ERROR: No companies found in hr_companies collection.")
        sys.exit(1)

    print(f"Found {len(companies)} companies.\n")

    inserted = 0
    for company in companies:
        company_id = str(company["_id"])
        company_name = company.get("name", "Unknown")
        domain = company.get("domain", "autre").lower()

        jobs_template = JOBS_BY_DOMAIN.get(domain, JOBS_BY_DOMAIN["autre"])

        print(f"  Company: {company_name} (domain={domain})")

        for job_tpl in jobs_template:
            seed = job_tpl.pop("seed")
            now = datetime.utcnow()
            doc = {
                **job_tpl,
                "company_id": company_id,
                "status": "published",
                "screening_questions": [],
                "require_motivation_letter": False,
                "allow_hr": True,
                "created_at": now,
                "updated_at": now,
                "embedding": _random_embedding(dim=768, seed=seed),
            }
            result = db.hr_jobs.insert_one(doc)
            print(f"    [+] Inserted: {doc['title']} (id={result.inserted_id})")
            inserted += 1

    print(f"\nDone. {inserted} jobs inserted.")


if __name__ == "__main__":
    main()
