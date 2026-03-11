from fastapi import APIRouter, HTTPException
from database.mongodb import connect_mongodb

router = APIRouter(prefix="/candidat/jobs", tags=["candidat-jobs"])

@router.get("/", summary="Get all jobs for candidat view")
def get_jobs():
    db = connect_mongodb()["HumatiQ"]
    jobs_cursor = db.hr_jobs.find({"status": "published"})
    jobs = []
    for job in jobs_cursor:
        job["_id"] = str(job["_id"])
        jobs.append(job)
    return jobs
