from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List, Optional
from bson.objectid import ObjectId
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from models.company import CompanyBase, CompanyCreate, CompanyUpdate
import os
import shutil
import uuid

router = APIRouter(prefix="/companies", tags=["companies"])

def get_db():
    client = connect_mongodb()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection error")
    return client["HumatiQ"]

@router.get("/", response_model=List[CompanyBase])
async def get_companies(
    current_user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    db = get_db()
    
    # Aggregation pipeline to count users and jobs for each company
    pipeline = [
        {"$skip": skip},
        {"$limit": limit},
        # Join with profiles to count users
        {"$lookup": {
            "from": "hr_profiles",
            "let": {"company_str_id": {"$toString": "$_id"}},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$company_id", "$$company_str_id"]}}},
                {"$count": "count"}
            ],
            "as": "users_data"
        }},
        # Join with jobs to count jobs
        {"$lookup": {
            "from": "hr_jobs",
            "let": {"company_str_id": {"$toString": "$_id"}},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$company_id", "$$company_str_id"]}}},
                {"$count": "count"}
            ],
            "as": "jobs_data"
        }},
        # Project the counts
        {"$addFields": {
            "users_count": {"$ifNull": [{"$arrayElemAt": ["$users_data.count", 0]}, 0]},
            "jobs_count": {"$ifNull": [{"$arrayElemAt": ["$jobs_data.count", 0]}, 0]}
        }},
        {"$project": {"users_data": 0, "jobs_data": 0}}
    ]
    
    companies = list(db.hr_companies.aggregate(pipeline))
    return companies

@router.get("/{company_id}", response_model=CompanyBase)
async def get_company(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail="Invalid Company ID")
        
    db = get_db()
    company = db.hr_companies.find_one({"_id": ObjectId(company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company

@router.post("/", response_model=CompanyBase, status_code=status.HTTP_201_CREATED)
async def create_company(
    company_in: CompanyCreate,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    company_data = company_in.model_dump()
    from datetime import datetime
    company_data["created_at"] = datetime.utcnow()
    company_data["updated_at"] = datetime.utcnow()
    
    result = db.hr_companies.insert_one(company_data)
    created_company = db.hr_companies.find_one({"_id": result.inserted_id})
    return created_company

@router.put("/{company_id}", response_model=CompanyBase)
async def update_company(
    company_id: str,
    company_in: CompanyUpdate,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail="Invalid Company ID")
        
    db = get_db()
    # Exclude None values so we only update what was sent
    update_data = {k: v for k, v in company_in.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
        
    from datetime import datetime
    update_data["updated_at"] = datetime.utcnow()
    
    result = db.hr_companies.update_one(
        {"_id": ObjectId(company_id)}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
        
    updated = db.hr_companies.find_one({"_id": ObjectId(company_id)})
    return updated

@router.post("/{company_id}/logo")
async def upload_company_logo(
    company_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a company logo and store it on disk. Returns the public URL."""
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail="Invalid Company ID")

    # Validate content type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Validate file size (max 5 MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be under 5 MB")

    # Build storage path: static/logos/<company_id>/<uuid>.<ext>
    ext = os.path.splitext(file.filename)[-1] or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    base_dir = os.path.dirname(os.path.abspath(__file__))
    logo_dir = os.path.join(base_dir, "..", "static", "logos", company_id)
    os.makedirs(logo_dir, exist_ok=True)
    logo_path = os.path.join(logo_dir, filename)

    with open(logo_path, "wb") as f:
        f.write(contents)

    # Public URL (served by FastAPI StaticFiles at /static)
    logo_url = f"/static/logos/{company_id}/{filename}"

    # Persist logo_url in DB
    db = get_db()
    from datetime import datetime
    db.hr_companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$set": {"logo_url": logo_url, "updated_at": datetime.utcnow()}}
    )

    return {"logo_url": logo_url}

@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail="Invalid Company ID")
        
    db = get_db()
    result = db.hr_companies.delete_one({"_id": ObjectId(company_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    return None
