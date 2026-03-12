from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from bson.objectid import ObjectId
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from models.job import JobBase, JobCreate, JobUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])

def get_db():
    client = connect_mongodb()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection error")
    return client["HumatiQ"]

@router.get("/", response_model=List[JobBase])
async def get_jobs(
    current_user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    company_id: Optional[str] = None,
    department_id: Optional[str] = None
):
    db = get_db()
    
    # Base query
    query = {}
    if company_id:
        query["company_id"] = company_id
    if department_id:
        query["department_id"] = department_id
        
    pipeline = [
        {"$match": query},
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
                "logo": {"$ifNull": ["$company_info.logo_url", "https://placeholder.pics/svg/200"]},
                "company_about": {"$ifNull": ["$company_info.description", "No description available."]},
                "company_industry": {"$ifNull": ["$company_info.domain", "Technology"]},
                "company_size": {"$ifNull": ["$company_info.size", "10-50 Employees"]},
                "company_founded": {"$ifNull": ["$company_info.founded", "2020"]},
                "company_address": {"$ifNull": ["$company_info.address", "Not specified"]}
            }
        },
        {"$skip": skip},
        {"$limit": limit},
        {
            "$project": {
                "company_oid": 0,
                "company_info": 0
            }
        }
    ]
    
    try:
        jobs_cursor = db.hr_jobs.aggregate(pipeline)
        jobs_list = []
        for job in jobs_cursor:
            job["_id"] = str(job["_id"])
            if "company_id" in job:
                job["company_id"] = str(job["company_id"])
            if "department_id" in job:
                job["department_id"] = str(job["department_id"])
            jobs_list.append(job)
        return jobs_list
    except Exception as e:
        print(f"Aggregation failed in general jobs: {e}")
        # Fallback
        jobs_cursor = db.hr_jobs.find(query).skip(skip).limit(limit)
        jobs_list = []
        for job in jobs_cursor:
            job["_id"] = str(job["_id"])
            job["company"] = "Unknown Company"
            job["logo"] = "https://placeholder.pics/svg/200"
            jobs_list.append(job)
        return jobs_list

@router.get("/{job_id}", response_model=JobBase)
async def get_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid Job ID")
        
    db = get_db()
    
    pipeline = [
        {"$match": {"_id": ObjectId(job_id)}},
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
                "logo": {"$ifNull": ["$company_info.logo_url", "https://placeholder.pics/svg/200"]},
                "company_about": {"$ifNull": ["$company_info.description", "No description available."]},
                "company_industry": {"$ifNull": ["$company_info.domain", "Technology"]},
                "company_size": {"$ifNull": ["$company_info.size", "10-50 Employees"]},
                "company_founded": {"$ifNull": ["$company_info.founded", "2020"]},
                "company_address": {"$ifNull": ["$company_info.address", "Not specified"]}
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
        job = next(jobs_cursor, None)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
            
        job["_id"] = str(job["_id"])
        if "company_id" in job:
            job["company_id"] = str(job["company_id"])
        if "department_id" in job:
            job["department_id"] = str(job["department_id"])
            
        return job
    except HTTPException:
        raise
    except Exception as e:
        print(f"Aggregation failed in get_job: {e}")
        # Fallback
        job = db.hr_jobs.find_one({"_id": ObjectId(job_id)})
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        job["_id"] = str(job["_id"])
        job["company"] = "Unknown Company"
        job["logo"] = "https://placeholder.pics/svg/200"
        return job

@router.post("/", response_model=JobBase, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_in: JobCreate,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    job_data = job_in.model_dump()
    from datetime import datetime
    job_data["created_at"] = datetime.utcnow()
    job_data["updated_at"] = datetime.utcnow()
    
    result = db.hr_jobs.insert_one(job_data)
    created = db.hr_jobs.find_one({"_id": result.inserted_id})
    return created

@router.put("/{job_id}", response_model=JobBase)
async def update_job(
    job_id: str,
    job_in: JobUpdate,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid Job ID")
        
    db = get_db()
    update_data = {k: v for k, v in job_in.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
        
    from datetime import datetime
    update_data["updated_at"] = datetime.utcnow()
    
    result = db.hr_jobs.update_one(
        {"_id": ObjectId(job_id)}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
        
    updated = db.hr_jobs.find_one({"_id": ObjectId(job_id)})
    return updated

@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid Job ID")
        
    db = get_db()
    result = db.hr_jobs.delete_one({"_id": ObjectId(job_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return None
