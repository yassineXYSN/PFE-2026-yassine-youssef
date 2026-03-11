from fastapi import APIRouter, HTTPException
from database.mongodb import connect_mongodb

router = APIRouter(prefix="/candidat/jobs", tags=["candidat-jobs"])

@router.get("/", summary="Get all jobs for candidat view")
def get_jobs():
    db = connect_mongodb()["HumatiQ"]
    
    # Aggregation to join with companies
    pipeline = [
        {"$match": {"status": "published"}},
        {
            "$addFields": {
                "company_oid": {
                    "$cond": {
                        "if": {"$and": [
                            {"$ne": ["$company_id", None]},
                            {"$ne": ["$company_id", ""]},
                            {"$eq": [{"$type": "$company_id"}, "string"]},
                            {"$eq": [{"$strLenCP": "$company_id"}, 24]}
                        ]},
                        "then": {"$toObjectId": "$company_id"},
                        "else": "$company_id"
                    }
                }
            }
        },
        {
            "$lookup": {
                "from": "hr_companies",
                "localField": "company_oid",
                "foreignField": "_id",
                "as": "company_info"
            }
        },
        {"$unwind": {"path": "$company_info", "preserveNullAndEmptyArrays": True}},
        {
            "$addFields": {
                "company": {"$ifNull": ["$company_info.name", "HumatiQ Partner"]},
                "logo": {"$ifNull": ["$company_info.logo_url", "https://placeholder.pics/svg/200"]}
            }
        },
        {
            "$project": {
                "company_oid": 0,
                "company_info": 0
            }
        }
    ]
    
    try:
        jobs_cursor = db.hr_jobs.aggregate(pipeline)
        jobs = []
        for job in jobs_cursor:
            job["_id"] = str(job["_id"])
            if "company_id" in job:
                job["company_id"] = str(job["company_id"])
            if "department_id" in job:
                job["department_id"] = str(job["department_id"])
            jobs.append(job)
            
        return jobs
    except Exception as e:
        print(f"Aggregation failed: {e}")
        # Fallback to simple find if aggregation fails
        jobs_cursor = db.hr_jobs.find({"status": "published"})
        jobs = []
        for job in jobs_cursor:
            job["_id"] = str(job["_id"])
            job["company"] = "HumatiQ Partner"
            job["logo"] = "https://placeholder.pics/svg/200"
            jobs.append(job)
        return jobs
