from fastapi import APIRouter, Depends, HTTPException
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from datetime import datetime, timedelta

router = APIRouter(prefix="/stats", tags=["stats"])

def get_db():
    client = connect_mongodb()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection error")
    return client["nexthire"]

@router.get("/dashboard")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Returns all the necessary data for the SuperAdmin Dashboard in one optimized call.
    """
    db = get_db()
    
    # 1. Total counts
    companies_count = db.hr_companies.count_documents({})
    profiles_count = db.hr_profiles.count_documents({})
    jobs_count = db.hr_jobs.count_documents({})
    
    # For candidatures (Wait, this wasn't migrated yet but let's assume it's hr_applications or candidat_applications)
    apps_count = db.candidat_applications.count_documents({}) if "candidat_applications" in db.list_collection_names() else 0
    
    # 2. Recent activities (Last 10 created companies)
    recent_companies_cursor = db.hr_companies.find({}, {"name": 1, "created_at": 1}).sort("created_at", -1).limit(10)
    recent_activities = []
    for c in recent_companies_cursor:
        recent_activities.append({
            "id": str(c["_id"]),
            "company": c["name"],
            "created_at": c.get("created_at", datetime.utcnow()).isoformat()
        })
        
    # 3. Top companies by user count
    # Aggregation: Group profiles by company_id, then lookup companies
    pipeline = [
        {"$group": {"_id": "$company_id", "users_count": {"$sum": 1}}},
        {"$sort": {"users_count": -1}},
        {"$limit": 5}
    ]
    top_profiles_cursor = db.hr_profiles.aggregate(pipeline)
    top_companies = []
    for tp in top_profiles_cursor:
        if tp["_id"]: # If company_id is not null
            from bson import ObjectId
            # company_id is stored as string in profile, so we need to match it
            c_id = tp["_id"]
            if ObjectId.is_valid(c_id):
                company = db.hr_companies.find_one({"_id": ObjectId(c_id)}, {"name": 1})
                if company:
                    # also count jobs for this company
                    jobs_count_for_c = db.hr_jobs.count_documents({"company_id": c_id})
                    top_companies.append({
                        "name": company["name"],
                        "users": tp["users_count"],
                        "jobs": jobs_count_for_c,
                        "applications": 0
                    })
    
    # If no top companies found, just return the most recent ones with 0 counts
    if not top_companies:
        fallback = db.hr_companies.find({}, {"name": 1}).limit(5)
        for c in fallback:
            top_companies.append({
                "name": c["name"], "users": 0, "jobs": 0, "applications": 0
            })
            
    # 4. Activity series (last 15 days)
    # This is slightly complex in Mongo, we will fetch dates and group them in python for simplicity
    today = datetime.utcnow()
    start_date = today - timedelta(days=14)
    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    series = [0] * 15
    
    def accumulate_dates(collection_name):
        cursor = db[collection_name].find({"created_at": {"$gte": start_date}}, {"created_at": 1})
        for doc in cursor:
            d = doc.get("created_at")
            if d:
                d = d.replace(hour=0, minute=0, second=0, microsecond=0)
                diff_days = (d - start_date).days
                if 0 <= diff_days < 15:
                    series[diff_days] += 1
                    
    accumulate_dates("hr_companies")
    accumulate_dates("hr_profiles")
    accumulate_dates("hr_jobs")

    return {
        "counts": {
            "companies": companies_count,
            "profiles": profiles_count,
            "jobs": jobs_count,
            "applications": apps_count
        },
        "recent_activities": recent_activities,
        "top_companies": top_companies,
        "activity_series": series
    }
