from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from bson.objectid import ObjectId
from database.mongodb_async import get_async_db
from middleware.auth import get_current_user
from models.job import JobBase, JobCreate, JobUpdate
from services.ai_matching import AIMatchingService

router = APIRouter(prefix="/jobs", tags=["jobs"])

# get_db is deprecated in favor of get_async_db from database.mongodb_async


def _normalize_job_ids(job: dict) -> dict:
    job["_id"] = str(job["_id"])
    if "company_id" in job and job["company_id"] is not None:
        job["company_id"] = str(job["company_id"])
    if "department_id" in job and job["department_id"] is not None:
        job["department_id"] = str(job["department_id"])
    return job


def _round_metric(value):
    return int(round(value)) if value is not None else None


async def _attach_application_stats(db, job: dict) -> dict:
    job_id = str(job["_id"])
    stats_pipeline = [
        {"$match": {"job_id": job_id}},
        {
            "$group": {
                "_id": None,
                "candidate_count": {"$sum": 1},
                "avg_ai_score": {"$avg": "$ai_score"},
                "best_ai_score": {"$max": "$ai_score"},
            }
        },
    ]
    stats = await db.job_applications.aggregate(stats_pipeline).to_list(length=1)
    metrics = stats[0] if stats else {}
    job["candidate_count"] = int(metrics.get("candidate_count", 0) or 0)
    job["avg_ai_score"] = _round_metric(metrics.get("avg_ai_score"))
    job["best_ai_score"] = _round_metric(metrics.get("best_ai_score"))
    return job

@router.get("/", response_model=List[JobBase])
async def get_jobs(
    current_user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    company_id: Optional[str] = None,
    department_id: Optional[str] = None
):
    db = get_async_db()
    
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
                "job_id_str": {"$toString": "$_id"},
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
                "from": "job_applications",
                "let": {"job_id_str": "$job_id_str"},
                "pipeline": [
                    {
                        "$match": {
                            "$expr": {"$eq": ["$job_id", "$$job_id_str"]}
                        }
                    },
                    {
                        "$group": {
                            "_id": None,
                            "candidate_count": {"$sum": 1},
                            "avg_ai_score": {"$avg": "$ai_score"},
                            "best_ai_score": {"$max": "$ai_score"},
                        }
                    }
                ],
                "as": "application_stats"
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
                "company_address": {"$ifNull": ["$company_info.address", "Not specified"]},
                "candidate_count": {
                    "$ifNull": [
                        {"$arrayElemAt": ["$application_stats.candidate_count", 0]},
                        0
                    ]
                },
                "avg_ai_score": {
                    "$let": {
                        "vars": {
                            "avg": {"$arrayElemAt": ["$application_stats.avg_ai_score", 0]}
                        },
                        "in": {
                            "$cond": [
                                {"$ne": ["$$avg", None]},
                                {"$toInt": {"$round": ["$$avg", 0]}},
                                None
                            ]
                        }
                    }
                },
                "best_ai_score": {
                    "$let": {
                        "vars": {
                            "best": {"$arrayElemAt": ["$application_stats.best_ai_score", 0]}
                        },
                        "in": {
                            "$cond": [
                                {"$ne": ["$$best", None]},
                                {"$toInt": {"$round": ["$$best", 0]}},
                                None
                            ]
                        }
                    }
                }
            }
        },
        {"$skip": skip},
        {"$limit": limit},
        {
            "$project": {
                "job_id_str": 0,
                "company_oid": 0,
                "company_info": 0,
                "application_stats": 0
            }
        }
    ]
    
    try:
        cursor = db.hr_jobs.aggregate(pipeline)
        jobs_list = await cursor.to_list(length=limit)
        for job in jobs_list:
            _normalize_job_ids(job)
        return jobs_list
    except Exception as e:
        print(f"Aggregation failed in general jobs: {e}")
        # Fallback
        cursor = db.hr_jobs.find(query).skip(skip).limit(limit)
        jobs_list = await cursor.to_list(length=limit)
        for job in jobs_list:
            _normalize_job_ids(job)
            job["company"] = "Unknown Company"
            job["logo"] = "https://placeholder.pics/svg/200"
            await _attach_application_stats(db, job)
        return jobs_list

@router.get("/{job_id}", response_model=JobBase)
async def get_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid Job ID")
        
    db = get_async_db()
    
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
        cursor = db.hr_jobs.aggregate(pipeline)
        job = await cursor.next() if cursor else None
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
        job = await db.hr_jobs.find_one({"_id": ObjectId(job_id)})
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
    db = get_async_db()
    
    job_data = job_in.model_dump()
    from datetime import datetime
    job_data["created_at"] = datetime.utcnow()
    job_data["updated_at"] = datetime.utcnow()

    try:
        if job_data.get("description"):
            ai_svc = AIMatchingService(db)
            emb = await ai_svc.generate_embedding(job_data["description"])
            if emb:
                job_data["embedding"] = emb
            await ai_svc.close()
    except Exception as e:
        print(f"Warning: failed to generate embedding for new job: {e}")

    result = await db.hr_jobs.insert_one(job_data)
    created = await db.hr_jobs.find_one({"_id": result.inserted_id})
    return created

@router.put("/{job_id}", response_model=JobBase)
async def update_job(
    job_id: str,
    job_in: JobUpdate,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid Job ID")
        
    db = get_async_db()
    update_data = {k: v for k, v in job_in.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
        
    from datetime import datetime
    update_data["updated_at"] = datetime.utcnow()

    # If description changes, regenerate embedding
    if update_data.get("description"):
        try:
            ai_svc = AIMatchingService(db)
            emb = await ai_svc.generate_embedding(update_data["description"])
            if emb:
                update_data["embedding"] = emb
            await ai_svc.close()
        except Exception as e:
            print(f"Warning: failed to generate embedding for updated job: {e}")

    result = await db.hr_jobs.update_one(
        {"_id": ObjectId(job_id)}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
        
    updated = await db.hr_jobs.find_one({"_id": ObjectId(job_id)})
    return updated

@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid Job ID")
        
    db = get_async_db()
    result = await db.hr_jobs.delete_one({"_id": ObjectId(job_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return None
