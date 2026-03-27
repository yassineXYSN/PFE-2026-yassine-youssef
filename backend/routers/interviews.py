from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from models.interview import InterviewBase, InterviewCreate, InterviewUpdate, InterviewProposalCreate
from datetime import datetime
from bson import ObjectId
from services.google_calendar import GoogleCalendarService
from utils.email import send_email

router = APIRouter(prefix="/interviews", tags=["interviews"])

def get_db():
    client = connect_mongodb()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection error")
    return client["HumatiQ"]

def serialize(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serialisable dict."""
    doc["_id"] = str(doc["_id"])
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        elif isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

# ── POST Create Interview ──────────────────────────────────────────────────
@router.post("/", response_model=InterviewBase)
async def create_interview(
    interview: InterviewCreate,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["admin", "recruiter", "chef_departement"]:
        raise HTTPException(status_code=403, detail="Only HR can schedule interviews")
    
    db = get_db()
    
    new_interview = {
        "company_id": interview.company_id,
        "candidate_name": interview.candidate_name,
        "candidate_email": interview.candidate_email,
        "type": interview.type,
        "start_time": interview.start_time,
        "end_time": interview.end_time,
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    
    result = db.hr_interviews.insert_one(new_interview)
    new_interview["_id"] = str(result.inserted_id)
    
    # ── Push to Google Calendar if connected ──────────────────────────────
    try:
        profile = db.hr_profiles.find_one({"_id": current_user["id"]})
        if profile and profile.get("preferences", {}).get("google_calendar", {}).get("connected"):
            tokens = profile["preferences"]["google_calendar"].get("tokens")
            if tokens:
                google_service = GoogleCalendarService(db)
                service = google_service.get_calendar_service(current_user["id"], tokens)
                if service:
                    event_id = google_service.create_event(service, {
                        "candidate_name": interview.candidate_name,
                        "candidate_email": interview.candidate_email,
                        "type": interview.type,
                        "start_time": interview.start_time.isoformat() if isinstance(interview.start_time, datetime) else interview.start_time,
                        "end_time": interview.end_time.isoformat() if isinstance(interview.end_time, datetime) else interview.end_time
                    })
                    if event_id:
                        db.hr_interviews.update_one(
                            {"_id": result.inserted_id},
                            {"$set": {"google_event_id": event_id}}
                        )
                        new_interview["google_event_id"] = event_id
    except Exception as e:
        print(f"Error syncing to Google Calendar: {e}")
        # We don't fail the create_interview just because Google sync failed
    
    return new_interview

# ── GET all interviews for a company ───────────────────────────────────────
@router.get("/company/{company_id}")
async def get_interviews_for_company(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    cursor = db.hr_interviews.find({"company_id": company_id}).sort("start_time", 1)
    interviews = []
    for interview in cursor:
        interviews.append(serialize(interview))
    return interviews

# ── GET single interview ───────────────────────────────────────────────────
@router.get("/{interview_id}")
async def get_interview(
    interview_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(interview_id):
        raise HTTPException(status_code=400, detail="Invalid interview ID")
    db = get_db()
    interview = db.hr_interviews.find_one({"_id": ObjectId(interview_id)})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return serialize(interview)

# ── PATCH interview ────────────────────────────────────────────────────────
@router.patch("/{interview_id}")
async def update_interview(
    interview_id: str,
    update_data: InterviewUpdate,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["admin", "recruiter", "chef_departement", "candidat"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    if not ObjectId.is_valid(interview_id):
        raise HTTPException(status_code=400, detail="Invalid interview ID")
        
    db = get_db()
    
    update_dict = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
        
    result = db.hr_interviews.update_one(
        {"_id": ObjectId(interview_id)},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Interview not found")
        
    interview = db.hr_interviews.find_one({"_id": ObjectId(interview_id)})
    
    # Push update to Google Calendar if linked
    try:
        if "google_event_id" in interview:
            profile = db.hr_profiles.find_one({"_id": current_user["id"]})
            if profile and profile.get("preferences", {}).get("google_calendar", {}).get("connected"):
                tokens = profile["preferences"]["google_calendar"].get("tokens")
                if tokens:
                    google_service = GoogleCalendarService(db)
                    service = google_service.get_calendar_service(current_user["id"], tokens)
                    if service:
                        google_service.update_event(service, interview["google_event_id"], interview)
    except Exception as e:
        print(f"Error updating Google Calendar event: {e}")
        
    return serialize(interview)

# ── DELETE interview ───────────────────────────────────────────────────────
@router.delete("/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interview(
    interview_id: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["admin", "recruiter", "chef_departement"]:
        raise HTTPException(status_code=403, detail="Only HR can delete interviews")
        
    if not ObjectId.is_valid(interview_id):
        raise HTTPException(status_code=400, detail="Invalid interview ID")
        
    db = get_db()
    
    interview = db.hr_interviews.find_one({"_id": ObjectId(interview_id)})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
        
    # Delete from Google Calendar if linked
    try:
        if "google_event_id" in interview:
            profile = db.hr_profiles.find_one({"_id": current_user["id"]})
            if profile and profile.get("preferences", {}).get("google_calendar", {}).get("connected"):
                tokens = profile["preferences"]["google_calendar"].get("tokens")
                if tokens:
                    google_service = GoogleCalendarService(db)
                    service = google_service.get_calendar_service(current_user["id"], tokens)
                    if service:
                        google_service.delete_event(service, interview["google_event_id"])
    except Exception as e:
        print(f"Error deleting Google Calendar event: {e}")
        
    result = db.hr_interviews.delete_one({"_id": ObjectId(interview_id)})
    
    return None

# ── POST Propose Interview Slots ──────────────────────────────────────────
@router.post("/proposals", status_code=status.HTTP_201_CREATED)
async def propose_interview_slots(
    proposal: InterviewProposalCreate,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["admin", "recruiter", "chef_departement"]:
        raise HTTPException(status_code=403, detail="Only HR can propose interview slots")
    
    db = get_db()
    
    new_proposal = {
        "application_id": proposal.application_id,
        "company_id": proposal.company_id,
        "candidate_name": proposal.candidate_name,
        "candidate_email": proposal.candidate_email,
        "slots": proposal.slots,
        "duration_minutes": proposal.duration_minutes,
        "interview_type": proposal.interview_type,
        "message": proposal.message,
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    
    result = db.hr_interview_proposals.insert_one(new_proposal)
    new_proposal["_id"] = str(result.inserted_id)
    
    # Update application status to reflect that a proposal has been sent
    db.applications.update_one(
        {"_id": ObjectId(proposal.application_id)},
        {"$set": {"interview_proposal_id": str(result.inserted_id)}}
    )
    
    # ── Send Email notification to candidate ──────────────────────────
    try:
        # Format slots for the email: "Jour dd Mois at HH:MM"
        slots_text = "\n".join([s.strftime("%A %d %B - %H:%M") for s in proposal.slots])
        
        email_content = f"Bonjour {proposal.candidate_name},\n\n"
        email_content += f"L'équipe HumatiQ souhaite vous inviter à un entretien ({proposal.interview_type}).\n\n"
        email_content += f"Veuillez choisir l'un des créneaux suivants qui vous conviendrait :\n\n{slots_text}\n\n"
        
        if proposal.message:
            email_content += f"Message du recruteur :\n\"{proposal.message}\"\n\n"
            
        email_content += "Merci de confirmer votre choix en répondant directement à cet email ou via votre espace candidat.\n\n"
        email_content += "Cordialement,\nL'équipe HumatiQ"

        await send_email(
            to_email=proposal.candidate_email,
            subject="Invitation à un entretien - HumatiQ",
            content=email_content
        )
    except Exception as e:
        print(f"Error in slot proposal email process: {e}")

    return serialize(new_proposal)
