from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from bson.objectid import ObjectId
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from models.company import CompanyBase, CompanyCreate, CompanyUpdate

router = APIRouter(prefix="/companies", tags=["companies"])

def get_db():
    client = connect_mongodb()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection error")
    return client["nexthire"]

@router.get("/", response_model=List[CompanyBase])
async def get_companies(
    current_user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    db = get_db()
    companies_cursor = db.hr_companies.find().skip(skip).limit(limit)
    return list(companies_cursor)

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
