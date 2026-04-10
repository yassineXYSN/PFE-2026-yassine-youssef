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
    
    # Check if job_applications exists
    apps_count = 0
    try:
        if "job_applications" in db.list_collection_names():
            apps_count = db.job_applications.count_documents({})
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

@router.get("/company/{company_id}")
async def get_company_stats(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Returns stats for a specific company (Jobs, Applicants, Trends, etc.)
    Optimized with single-pass aggregations.
    """
    db = get_db()
    
    # Initialize defaults
    apps_count = 0
    avg_score = 0
    top_profiles = 0
    department_distribution = []
    
    # 1. Core Metrics (Calculated in one aggregation pass)
    # First get all job IDs for this company
    jobs_cursor = db.hr_jobs.find({"company_id": company_id}, {"_id": 1})
    job_ids = [str(job["_id"]) for job in jobs_cursor]
    
    interviews_count = db.hr_interviews.count_documents({"company_id": company_id})
    
    metrics_pipeline = [
        {"$match": {"job_id": {"$in": job_ids}}},
        {"$facet": {
            "counts": [
                {"$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "avg_score": {"$avg": "$ai_score"},
                    "top_count": {"$sum": {"$cond": [{"$gte": ["$ai_score", 90]}, 1, 0]}}
                }}
            ],
            "department_dist": [
                {
                    "$addFields": {
                        "job_oid": {
                            "$cond": {
                                "if": {
                                    "$and": [
                                        {"$ne": ["$job_id", None]},
                                        {"$eq": [{"$type": "$job_id"}, "string"]},
                                        {"$eq": [{"$strLenCP": "$job_id"}, 24]}
                                    ]
                                },
                                "then": {"$toObjectId": "$job_id"},
                                "else": None
                            }
                        }
                    }
                },
                {"$lookup": {
                    "from": "hr_jobs",
                    "localField": "job_oid",
                    "foreignField": "_id",
                    "as": "job"
                }},
                {"$unwind": {"path": "$job", "preserveNullAndEmptyArrays": True}},
                {
                    "$addFields": {
                        "department_oid": {
                            "$cond": {
                                "if": {
                                    "$and": [
                                        {"$ne": ["$job.department_id", None]},
                                        {"$eq": [{"$type": "$job.department_id"}, "string"]},
                                        {"$eq": [{"$strLenCP": "$job.department_id"}, 24]}
                                    ]
                                },
                                "then": {"$toObjectId": "$job.department_id"},
                                "else": None
                            }
                        }
                    }
                },
                {"$lookup": {
                    "from": "hr_departments",
                    "localField": "department_oid",
                    "foreignField": "_id",
                    "as": "department"
                }},
                {"$unwind": {"path": "$department", "preserveNullAndEmptyArrays": True}},
                {"$group": {
                    "_id": {
                        "$ifNull": [
                            "$department.name",
                            {"$ifNull": ["$job.department_name", "Non Spécifié"]}
                        ]
                    },
                    "count": {"$sum": 1}
                }},
                {"$sort": {"count": -1}}
            ]
        }}
    ]
    
    try:
        agg_results = list(db.job_applications.aggregate(metrics_pipeline))
        if agg_results:
            metrics_result = agg_results[0]
            
            stats_data = metrics_result.get("counts", [{}])[0] if metrics_result.get("counts") else {}
            apps_count = stats_data.get("total", 0)
            avg_score = round(stats_data.get("avg_score", 0))
            top_profiles = stats_data.get("top_count", 0)
            
            raw_dist = metrics_result.get("department_dist", [])
            if apps_count > 0:
                for d in raw_dist:
                    department_distribution.append({
                        "label": d["_id"] or "Non Spécifié",
                        "percentage": round((d["count"] / apps_count) * 100)
                    })
    except Exception as e:
        print(f"Error in aggregation: {e}")

    # 2. Jobs count
    jobs_count = db.hr_jobs.count_documents({"company_id": company_id})
    
    # 3. Application Trend (Last 30 days)
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    start_date_30 = today - timedelta(days=29)
    
    application_series = [0] * 30
    try:
        trend_pipeline = [
            {"$match": {
                "job_id": {"$in": job_ids},
                "applied_at": {"$gte": start_date_30}
            }},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$applied_at"}},
                "count": {"$sum": 1}
            }}
        ]
        trend_data = {item["_id"]: item["count"] for item in db.job_applications.aggregate(trend_pipeline)}
        application_series = [(trend_data.get((start_date_30 + timedelta(days=i)).strftime("%Y-%m-%d"), 0)) for i in range(30)]
    except Exception as e:
        print(f"Error in trend aggregation: {e}")

    return {
        "jobs_count": jobs_count,
        "applications_count": apps_count,
        "interviews_count": interviews_count,
        "average_score": avg_score,
        "top_profiles_count": top_profiles,
        "application_series": application_series,
        "department_distribution": department_distribution
    }
