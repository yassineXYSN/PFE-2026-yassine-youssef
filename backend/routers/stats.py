from fastapi import APIRouter, Depends, HTTPException
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from datetime import datetime, timedelta

router = APIRouter(prefix="/stats", tags=["stats"])

def get_db():
    client = connect_mongodb()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection error")
    return client["HumatiQ"]

@router.get("/dashboard")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Returns all the necessary data for the SuperAdmin Dashboard in one optimized call.
    """
    db = get_db()
    # 1. Total counts (Fast individual counts)
    companies_count = db.hr_companies.count_documents({})
    profiles_count = db.hr_profiles.count_documents({})
    jobs_count = db.hr_jobs.count_documents({})
    
    # Check if candidat_applications exists
    apps_count = 0
    try:
        if "candidat_applications" in db.list_collection_names():
            apps_count = db.candidat_applications.count_documents({})
    except:
        pass
    
    # 2. Recent activities (Optimized cursor)
    recent_companies_cursor = db.hr_companies.find({}, {"name": 1, "created_at": 1}).sort("created_at", -1).limit(10)
    recent_activities = [{
        "id": str(c["_id"]),
        "company": c["name"],
        "created_at": c.get("created_at", datetime.utcnow()).isoformat()
    } for c in recent_companies_cursor]
        
    # 3. Top companies by user count (OPTIMIZED: Single Aggregation Pipeline)
    top_companies_pipeline = [
        {"$match": {"company_id": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$company_id", "users_count": {"$sum": 1}}},
        {"$sort": {"users_count": -1}},
        {"$limit": 5},
        # Map string ID to ObjectId for lookup
        {"$addFields": {
            "company_oid": {
                "$cond": {
                    "if": {"$regexMatch": {"input": "$_id", "regex": "^[0-9a-fA-F]{24}$"}},
                    "then": {"$toObjectId": "$_id"},
                    "else": None
                }
            }
        }},
        {"$lookup": {
            "from": "hr_companies",
            "localField": "company_oid",
            "foreignField": "_id",
            "as": "details"
        }},
        {"$unwind": {"path": "$details", "preserveNullAndEmptyArrays": True}},
        # Lookup jobs count
        {"$lookup": {
            "from": "hr_jobs",
            "localField": "_id", # string id
            "foreignField": "company_id",
            "as": "jobs"
        }},
        {"$project": {
            "name": {"$ifNull": ["$details.name", "Inconnu"]},
            "users": "$users_count",
            "jobs": {"$size": "$jobs"},
            "applications": {"$literal": 0}
        }}
    ]
    top_companies = list(db.hr_profiles.aggregate(top_companies_pipeline))
    
    if not top_companies:
        top_companies = [{
            "name": c["name"], "users": 0, "jobs": 0, "applications": 0
        } for c in db.hr_companies.find({}, {"name": 1}).limit(5)]
            
    # 4. Activity series (last 15 days) (OPTIMIZED: Aggregation with group by date)
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = today - timedelta(days=14)
    series = [0] * 15
    
    def fetch_series_data(collection):
        pipe = [
            {"$match": {"created_at": {"$gte": start_date}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "count": {"$sum": 1}
            }}
        ]
        return {item["_id"]: item["count"] for item in db[collection].aggregate(pipe)}

    for coll in ["hr_companies", "hr_profiles", "hr_jobs"]:
        counts_map = fetch_series_data(coll)
        for i in range(15):
            date_str = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
            series[i] += counts_map.get(date_str, 0)

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
