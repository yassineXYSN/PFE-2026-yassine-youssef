from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from bson.objectid import ObjectId
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from models.department import DepartmentBase, DepartmentCreate, DepartmentUpdate

router = APIRouter(prefix="/departments", tags=["departments"])

def get_db():
    client = connect_mongodb()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection error")
    return client["HumatiQ"]

@router.get("/", response_model=List[DepartmentBase])
async def get_departments(
    current_user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    company_id: Optional[str] = None
):
    db = get_db()
    query = {}
    if company_id:
        query["company_id"] = company_id
        
    departments_cursor = db.hr_departments.find(query).skip(skip).limit(limit)
    return list(departments_cursor)

@router.get("/{department_id}", response_model=DepartmentBase)
async def get_department(
    department_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(department_id):
        raise HTTPException(status_code=400, detail="Invalid Department ID")
        
    db = get_db()
    department = db.hr_departments.find_one({"_id": ObjectId(department_id)})
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    return department

@router.post("/", response_model=DepartmentBase, status_code=status.HTTP_201_CREATED)
async def create_department(
    department_in: DepartmentCreate,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    dept_data = department_in.model_dump()
    from datetime import datetime
    dept_data["created_at"] = datetime.utcnow()
    dept_data["updated_at"] = datetime.utcnow()
    
    result = db.hr_departments.insert_one(dept_data)
    created = db.hr_departments.find_one({"_id": result.inserted_id})
    return created

@router.put("/{department_id}", response_model=DepartmentBase)
async def update_department(
    department_id: str,
    department_in: DepartmentUpdate,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(department_id):
        raise HTTPException(status_code=400, detail="Invalid Department ID")
        
    db = get_db()
    update_data = {k: v for k, v in department_in.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
        
    from datetime import datetime
    update_data["updated_at"] = datetime.utcnow()
    
    result = db.hr_departments.update_one(
        {"_id": ObjectId(department_id)}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
        
    updated = db.hr_departments.find_one({"_id": ObjectId(department_id)})
    return updated

@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    department_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(department_id):
        raise HTTPException(status_code=400, detail="Invalid Department ID")
        
    db = get_db()
    result = db.hr_departments.delete_one({"_id": ObjectId(department_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    return None
