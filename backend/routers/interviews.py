from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from typing import List, Optional, Dict, Any
from database.mongodb import connect_mongodb
from middleware.auth import get_current_user
from models.interview import InterviewBase, InterviewCreate, InterviewUpdate, InterviewProposalCreate, InterviewSlotConfirm
from datetime import datetime
from bson import ObjectId
from services.google_calendar import GoogleCalendarService
from utils.email import send_email
from database.mongodb_async import get_async_db
from utils.notifications import create_notification
from utils.interview_detection_ai.audio_analyzer import AudioAnalyzer
from utils.interview_detection_ai.face_analyzer import (
    ConnectionAnalyzer,
    build_error_payload,
    decode_base64_frame,
)
import numpy as np
import asyncio
import json
from utils.interview_no_show import mark_interview_no_show

router = APIRouter(prefix="/interviews", tags=["interviews"])

def get_db():
    client = connect_mongodb()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection error")
    return client["HumatiQ"]

from datetime import timedelta

def serialize(data: Any) -> Any:
    """Convert MongoDB document or list of documents to JSON-serialisable format."""
    if isinstance(data, list):
        return [serialize(item) for item in data]
    
    if isinstance(data, datetime):
        return data.isoformat()
    
    if isinstance(data, ObjectId):
        return str(data)
    
    if not isinstance(data, dict):
        return data
        
    doc = data.copy()
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
        
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        elif isinstance(v, datetime):
            doc[k] = v.isoformat()
        elif isinstance(v, list):
            doc[k] = [serialize(i) for i in v]
        elif isinstance(v, dict):
            doc[k] = serialize(v)
            
    return doc

# ── WebRTC Signaling Manager ──────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast(self, message: str, room_id: str, sender: WebSocket):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                if connection != sender:
                    try:
                        await connection.send_text(message)
                    except Exception:
                        pass

manager = ConnectionManager()


def _mark_participant_joined(room_id: str, client_id: str) -> None:
    """Track who actually entered the interview room from signaling joins."""
    if not ObjectId.is_valid(room_id):
        return

    if client_id.startswith("recruiter_"):
        role = "hr"
    elif client_id.startswith("candidate_"):
        role = "candidate"
    else:
        return

    db = get_db()
    joined_at = datetime.utcnow()
    update = {
        f"{role}_joined_at": joined_at,
        f"{role}_last_seen_at": joined_at,
    }

    if role == "hr":
        interview = db.hr_interviews.find_one({"_id": ObjectId(room_id)})
        if interview and interview.get("status") == "scheduled":
            update["status"] = "in_progress"
            update.setdefault("started_at", joined_at)
            app_id = interview.get("application_id")
            if app_id and ObjectId.is_valid(str(app_id)):
                db.job_applications.update_one(
                    {"_id": ObjectId(str(app_id))},
                    {"$set": {"interview_status": "in_progress"}},
                )

    db.hr_interviews.update_one({"_id": ObjectId(room_id)}, {"$set": update})


def _participant_role(client_id: str) -> str:
    if client_id.startswith("recruiter_"):
        return "recruiter"
    if client_id.startswith("candidate_"):
        return "candidate"
    return "participant"

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

# ── GET active interview for candidate ─────────────────────────────────────
@router.get("/active-candidate")
async def get_active_interview_for_candidate(
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "candidat":
        return None
        
    db = get_db()
    # Find applications for this candidate
    apps = list(db.job_applications.find({"candidate_id": current_user["id"]}, {"_id": 1}))
    app_ids = [str(a["_id"]) for a in apps]
    
    if not app_ids:
        return None
        
    now = datetime.utcnow() + timedelta(hours=1) # Db has naive local time
    # High fidelity check for active interview:
    # 1. Scheduled and within strictly bounded time window (starts 10m before, ends at end_time)
    # 2. OR explicitly marked as in_progress (even if slightly past end_time)
    interview = db.hr_interviews.find_one({
        "application_id": {"$in": app_ids},
        "$or": [
            {
                "status": "scheduled",
                "start_time": {"$lte": now + timedelta(minutes=10)},
                "end_time": {"$gte": now} 
            },
            {
                "status": "in_progress",
                "end_time": {"$gte": now - timedelta(hours=2)} # Hard cutoff of 2 hours for in-progress too
            }
        ]
    }, sort=[("start_time", 1)])
    
    if not interview:
        return None
        
    return serialize(interview)

# ── GET all interviews for candidate ───────────────────────────────────────
@router.get("/candidate")
async def get_interviews_for_candidate(
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "candidat":
        raise HTTPException(status_code=403, detail="Only candidates can access this endpoint")
        
    db = get_db()
    # Find all applications for this candidate
    apps = list(db.job_applications.find({"candidate_id": current_user["id"]}, {"_id": 1}))
    app_ids = [str(a["_id"]) for a in apps]
    
    if not app_ids:
        return []
        
    cursor = db.hr_interviews.find({"application_id": {"$in": app_ids}}).sort("start_time", 1)
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

# ── GET Completed Interviews for Application ──────────────────────────────
@router.get("/application/{application_id}/completed")
async def get_completed_interviews(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Returns all COMPLETED interviews for a specific application,
    sorted by start_time descending. This allows viewing past AI analyses.
    """
    if not ObjectId.is_valid(application_id):
        raise HTTPException(status_code=400, detail="Invalid application ID")
        
    db = get_db()
    interviews = list(db.hr_interviews.find({
        "application_id": application_id,
        "status": "completed"
    }).sort("start_time", -1))
    
    return serialize(interviews)

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
    async_db = get_async_db()
    
    # Cancel any existing pending proposals for this application before creating a new one
    db.hr_interview_proposals.update_many(
        {"application_id": proposal.application_id, "status": "pending"},
        {"$set": {"status": "canceled"}}
    )
    
    new_proposal = {
        "application_id": proposal.application_id,
        "company_id": proposal.company_id,
        "candidate_name": proposal.candidate_name,
        "candidate_email": proposal.candidate_email,
        "slots": proposal.slots,
        "duration_minutes": proposal.duration_minutes,
        "interview_type": proposal.interview_type,
        "message": proposal.message,
        "recruiter_id": str(current_user["id"]),
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    
    result = db.hr_interview_proposals.insert_one(new_proposal)
    new_proposal["_id"] = str(result.inserted_id)
    
    # Update application status to reflect that a proposal has been sent
    db.job_applications.update_one(
        {"_id": ObjectId(proposal.application_id)},
        {"$set": {
            "interview_proposal_id": str(result.inserted_id),
            "interview_status": "pending_candidate"
        }}
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
        
        # ── Trigger Notification for Candidate ──────────────────────────
        app_doc = await async_db.job_applications.find_one({"_id": ObjectId(proposal.application_id)})
        if app_doc:
            candidate_id = app_doc.get("candidate_id") or app_doc.get("user_id")
            if candidate_id:
                metadata = {}
                j_id = app_doc.get("job_id")
                if j_id:
                    job = await async_db.hr_jobs.find_one({"_id": ObjectId(j_id) if ObjectId.is_valid(j_id) else j_id})
                    if job:
                        metadata["job_title"] = job.get("title", "Poste sans titre")
                        c_id = job.get("company_id") or job.get("recruiter_id")
                        if c_id:
                            comp = await async_db.hr_companies.find_one({"_id": ObjectId(c_id) if ObjectId.is_valid(c_id) else c_id})
                            if comp:
                                metadata["company_name"] = comp.get("name", "Entreprise")

                await create_notification(
                    async_db,
                    user_id=str(candidate_id),
                    title="Invitation à un entretien",
                    message="Vous avez reçu une proposition d'entretien. Veuillez choisir un créneau.",
                    category="interview",
                    notification_type="info",
                    link=f"/candidat/interviews/select/{proposal.application_id}",
                    metadata=metadata
                )
    except Exception as e:
        print(f"Error in slot proposal notification process: {e}")

    return serialize(new_proposal)

# ── GET Interview Proposal by Application ───────────────────────────────────────
@router.get("/proposals/application/{application_id}")
async def get_proposal_by_application(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    # Try pending first
    proposal = db.hr_interview_proposals.find_one({
        "application_id": application_id,
        "status": "pending"
    })
    if proposal:
        return serialize(proposal)

    # If already accepted, return it so the frontend can show a locked screen
    accepted = db.hr_interview_proposals.find_one({
        "application_id": application_id,
        "status": "accepted"
    })
    if accepted:
        data = serialize(accepted)
        data["already_confirmed"] = True
        return data

    raise HTTPException(status_code=404, detail="No interview proposal found for this application")

# ── GET Recruiter Busy Slots ──────────────────────────────────────────────
@router.get("/busy-slots/{recruiter_id}")
async def get_recruiter_busy_slots(
    recruiter_id: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    busy_slots = []
    
    from datetime import timedelta
    
    # 1. Fetch confirmed scheduled interviews
    cursor_interviews = db.hr_interviews.find({
        "status": "scheduled",
        "start_time": {"$gte": datetime.utcnow() + timedelta(hours=1)} # Only future ones
    })
    
    for doc in cursor_interviews:
        busy_slots.append({
            "start": doc["start_time"].isoformat() if isinstance(doc["start_time"], datetime) else doc["start_time"],
            "end": doc["end_time"].isoformat() if isinstance(doc["end_time"], datetime) else doc["end_time"],
            "is_pending": False
        })
        
    # 2. Fetch slots from pending proposals (to prevent double-proposing)
    # Filter by recruiter_id to only block their own proposed slots
    cursor_proposals = db.hr_interview_proposals.find({
        "recruiter_id": recruiter_id,
        "status": "pending"
    })
    
    for doc in cursor_proposals:
        duration = doc.get("duration_minutes", 45)
        for slot in doc.get("slots", []):
            if isinstance(slot, str):
                try:
                    slot_dt = datetime.fromisoformat(slot.replace("Z", "+00:00"))
                except ValueError:
                    continue  # skip invalid format
            elif isinstance(slot, datetime):
                slot_dt = slot
            else:
                continue
                
            if slot_dt >= (datetime.utcnow() + timedelta(hours=1)):
                end_dt = slot_dt + timedelta(minutes=duration)
                busy_slots.append({
                    "start": slot_dt.isoformat(),
                    "end": end_dt.isoformat(),
                    "is_pending": True,
                    "proposal_id": str(doc["_id"])
                })

    return busy_slots

# ── POST Confirm Interview Slot ──────────────────────────────────────────
@router.post("/proposals/confirm")
async def confirm_interview_slot(
    confirmation: InterviewSlotConfirm,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    if not ObjectId.is_valid(confirmation.proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID")
        
    proposal = db.hr_interview_proposals.find_one({"_id": ObjectId(confirmation.proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Interview proposal not found")
        
    if proposal["status"] != "pending":
        raise HTTPException(status_code=400, detail="Proposal already processed")

    # 0. Check for conflicts (double-booking)
    start_time = confirmation.selected_slot
    from datetime import timedelta
    duration = proposal.get("duration_minutes", 45)
    end_time = start_time + timedelta(minutes=duration)

    existing_conflict = db.hr_interviews.find_one({
        "status": "scheduled",
        "$or": [
            {"start_time": {"$lt": end_time, "$gte": start_time}},
            {"end_time": {"$gt": start_time, "$lte": end_time}}
        ]
    })
    
    if existing_conflict:
        raise HTTPException(status_code=409, detail="Ce créneau vient d'être réservé. Veuillez en choisir un autre.")

    # 1. Create the actual interview
    new_interview = {
        "application_id": proposal["application_id"],
        "company_id": proposal["company_id"],
        "recruiter_id": proposal.get("recruiter_id"),
        "candidate_name": proposal["candidate_name"],
        "candidate_email": proposal["candidate_email"],
        "type": proposal["interview_type"],
        "start_time": start_time,
        "end_time": end_time,
        "status": "scheduled",
        "reminder_24h_sent": False,
        "reminder_1h_sent": False,
        "created_at": datetime.utcnow()
    }
    
    result = db.hr_interviews.insert_one(new_interview)
    
    # 2. Update Proposal status
    db.hr_interview_proposals.update_one(
        {"_id": ObjectId(confirmation.proposal_id)},
        {"$set": {"status": "accepted", "selected_slot": start_time}}
    )
    
    # 3. Update Application status
    db.job_applications.update_one(
        {"_id": ObjectId(proposal["application_id"])},
        {"$set": {
            "status": "interview", 
            "interview_id": str(result.inserted_id),
            "interview_status": "scheduled",  # Was 'confirmed' — now aligned with frontend checks
            "interview_start_time": start_time,
            "interview_end_time": end_time
        }}
    )
    
    # 4. Notify Recruiter via Email
    try:
        recruiter_id = proposal.get("recruiter_id")
        if recruiter_id:
            recruiter_profile = db.hr_profiles.find_one({"_id": recruiter_id}) or db.hr_profiles.find_one({"_id": ObjectId(recruiter_id)})
            
            if recruiter_profile and recruiter_profile.get("email"):
                recruiter_email = recruiter_profile["email"]
                email_content = f"Bonjour,\n\n"
                email_content += f"Le candidat {proposal['candidate_name']} a confirmé l'entretien suivant :\n\n"
                email_content += f"Date : {start_time.strftime('%A %d %B %Y')}\n"
                email_content += f"Heure : {start_time.strftime('%H:%M')}\n"
                email_content += f"Type : {proposal['interview_type']}\n\n"
                email_content += "Vous pouvez retrouver les détails dans votre tableau de bord HumatiQ.\n\n"
                email_content += "Cordialement,\nL'équipe HumatiQ"
                
                from utils.email import send_email
                await send_email(
                    to_email=recruiter_email,
                    subject=f"Entretien confirmé - {proposal['candidate_name']}",
                    content=email_content
                )
    except Exception as e:
        print(f"Error notifying recruiter about interview confirmation: {e}")

    # 5. Confirmation email to Candidate
    try:
        candidate_email = proposal.get("candidate_email")
        candidate_name  = proposal.get("candidate_name", "Candidat")
        if candidate_email:
            content = (
                f"Bonjour {candidate_name},\n\n"
                f"Votre entretien est officiel ! Voici les détails de votre rendez-vous :\n\n"
                f"Date  : {start_time.strftime('%A %d %B %Y')}\n"
                f"Heure : {start_time.strftime('%H:%M')}\n"
                f"Type  : {proposal['interview_type']}\n\n"
                f"Des rappels vous seront envoyés 24h et 1h avant l'entretien.\n\n"
                f"Cordialement,\nL'équipe HumatiQ"
            )
            await send_email(
                to_email=candidate_email,
                subject="Confirmation de votre entretien - HumatiQ",
                content=content,
            )
    except Exception as e:
        print(f"Error sending candidate confirmation email: {e}")

    # 6. In-app notification to Candidate
    try:
        async_db = get_async_db()
        app_doc = await async_db.job_applications.find_one({"_id": ObjectId(proposal["application_id"])})
        if app_doc:
            candidate_user_id = app_doc.get("candidate_id") or app_doc.get("user_id")
            if candidate_user_id:
                metadata = {}
                j_id = app_doc.get("job_id")
                if j_id:
                    job = await async_db.hr_jobs.find_one({"_id": ObjectId(j_id) if ObjectId.is_valid(j_id) else j_id})
                    if job:
                        metadata["job_title"] = job.get("title", "Poste sans titre")
                        c_id = job.get("company_id") or job.get("recruiter_id")
                        if c_id:
                            comp = await async_db.hr_companies.find_one({"_id": ObjectId(c_id) if ObjectId.is_valid(c_id) else c_id})
                            if comp:
                                metadata["company_name"] = comp.get("name", "Entreprise")

                date_label = start_time.strftime("%A %d %B à %H:%M")
                await create_notification(
                    async_db,
                    user_id=str(candidate_user_id),
                    title="🎉 Entretien confirmé !",
                    message=f"Votre entretien est planifié le {date_label} ({proposal['interview_type']}). Consultez votre tableau de bord pour plus de détails.",
                    category="interview",
                    notification_type="success",
                    link=f"/candidat/dashboard",
                    metadata=metadata
                )
    except Exception as e:
        print(f"Error creating in-app notification for candidate: {e}")

    return {"status": "success", "interview_id": str(result.inserted_id)}

# ── WebSocket Signaling Endpoint ──────────────────────────────────────────
# ── POST Mark Interview No-Show ─────────────────────────────────────────────
@router.post("/{interview_id}/no-show")
async def mark_no_show(
    interview_id: str,
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["admin", "recruiter", "chef_departement", "candidat"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if not ObjectId.is_valid(interview_id):
        raise HTTPException(status_code=400, detail="Invalid interview ID")

    fault = body.get("fault")
    if fault not in {"hr", "candidate"}:
        raise HTTPException(status_code=400, detail="fault must be 'hr' or 'candidate'")

    if current_user["role"] == "candidat" and fault != "hr":
        raise HTTPException(status_code=403, detail="Candidates can only report HR absence")

    db = get_db()
    interview = db.hr_interviews.find_one({"_id": ObjectId(interview_id)})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    async_db = get_async_db()
    try:
        updated = await mark_interview_no_show(
            db,
            async_db,
            interview,
            fault,
            marked_by=current_user.get("id"),
            source="manual",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"status": "success", "interview": serialize(updated)}


@router.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str):
    await manager.connect(websocket, room_id)
    try:
        _mark_participant_joined(room_id, client_id)
    except Exception as exc:
        print(f"Could not mark participant joined for room {room_id}: {exc}")
    try:
        while True:
            data = await websocket.receive_text()
            # Relay signaling message to other peer in the same room
            await manager.broadcast(data, room_id, websocket)
    except WebSocketDisconnect:
        await manager.broadcast(
            json.dumps({
                "type": "peer-left",
                "from": client_id,
                "role": _participant_role(client_id),
            }),
            room_id,
            websocket,
        )
        manager.disconnect(websocket, room_id)
    except Exception as e:
        print(f"WebSocket error in room {room_id}: {e}")
        await manager.broadcast(
            json.dumps({
                "type": "peer-left",
                "from": client_id,
                "role": _participant_role(client_id),
            }),
            room_id,
            websocket,
        )
        manager.disconnect(websocket, room_id)

# ── Interview Detection AI WebSockets ──────────────────────────────────────
@router.websocket("/ai/ws/audio")
async def ai_audio_socket(websocket: WebSocket):
    await websocket.accept()
    loop = asyncio.get_running_loop()
    analyzer = AudioAnalyzer(loop)

    async def sender():
        try:
            while True:
                await websocket.send_json(await analyzer.get_payload())
        except asyncio.CancelledError:
            raise
        except Exception:
            pass

    sender_task = asyncio.create_task(sender())

    try:
        while True:
            data = await websocket.receive_bytes()
            if len(data) <= 8:
                continue
            chunk_id = int.from_bytes(data[0:4], "little")
            sample_rate = int.from_bytes(data[4:8], "little")
            pcm = np.frombuffer(data[8:], dtype=np.float32).copy()
            analyzer.submit_chunk(chunk_id, pcm, sample_rate)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"chunk_id": None, "status": "error", "error": f"WebSocket error: {exc}"})
        except Exception:
            pass
    finally:
        sender_task.cancel()
        try:
            await sender_task
        except (asyncio.CancelledError, Exception):
            pass
        analyzer.close()


@router.websocket("/ai/ws/analyze")
async def ai_face_socket(websocket: WebSocket):
    await websocket.accept()
    loop = asyncio.get_running_loop()

    try:
        analyzer = ConnectionAnalyzer(loop)
    except Exception as exc:
        await websocket.send_json(build_error_payload(None, str(exc)))
        await websocket.close(code=1011)
        return

    async def sender():
        try:
            while True:
                await websocket.send_json(await analyzer.get_payload())
        except asyncio.CancelledError:
            raise
        except Exception:
            pass

    sender_task = asyncio.create_task(sender())

    try:
        while True:
            message = await websocket.receive_json()
            frame_id = message.get("frame_id")
            try:
                timestamp_ms = int(message["timestamp_ms"])
                image_data = message["image"]
                analyzer.submit_frame(frame_id, timestamp_ms, decode_base64_frame(image_data))
            except Exception as exc:
                await websocket.send_json(build_error_payload(frame_id, f"Frame processing failed: {exc}"))
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json(build_error_payload(None, f"WebSocket error: {exc}"))
        except Exception:
            pass
    finally:
        sender_task.cancel()
        try:
            await sender_task
        except (asyncio.CancelledError, Exception):
            pass
        analyzer.close()

# ── POST Transcript Entry ──────────────────────────────────────────────────
@router.post("/{interview_id}/transcript")
async def add_transcript_entry(
    interview_id: str,
    entry: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(interview_id):
        raise HTTPException(status_code=400, detail="Invalid interview ID")
        
    db = get_db()
    db.hr_interviews.update_one(
        {"_id": ObjectId(interview_id)},
        {"$push": {
            "transcript": {
                "timestamp": datetime.utcnow(),
                "sender": entry.get("sender", "Unknown"),
                "text": entry.get("text", "")
            }
        }}
    )
    return {"status": "success"}
    
# ── POST Reset Interview Data ──────────────────────────────────────────────
@router.post("/{interview_id}/reset")
async def reset_interview_data(
    interview_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(interview_id):
        raise HTTPException(status_code=400, detail="Invalid interview ID")
        
    db = get_db()
    result = db.hr_interviews.update_one(
        {"_id": ObjectId(interview_id)},
        {"$set": {
            "emotion_history": [],
            "transcript": [],
            "ai_analysis": None
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Interview not found")
        
    return {"status": "success", "message": "Interview data cleared"}


def _analysis_unavailable(reason: str) -> Dict[str, Any]:
    return {
        "summary": f"Analyse automatique indisponible: {reason}",
        "strengths": ["Données de session conservées"],
        "weaknesses": [reason],
        "overall_score": 0,
    }


def _build_interview_emotion_history(interview: Dict[str, Any]) -> List[Dict[str, Any]]:
    emotion_history = interview.get("emotion_history", [])
    if emotion_history:
        return emotion_history

    return [
        {
            "timestamp": item.get("timestamp"),
            "emotions": [
                {"emotion": item.get("emotion", "neutral")},
                {"emotion": f"voice:{item.get('audio_emotion')}"}
                if item.get("audio_emotion")
                else {"emotion": "voice:unknown"},
            ],
        }
        for item in interview.get("candidate_analysis_log", [])
    ]


def _generate_and_store_interview_analysis(db, interview_id: str) -> Dict[str, Any]:
    interview = db.hr_interviews.find_one({"_id": ObjectId(interview_id)})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if interview.get("ai_analysis"):
        return interview["ai_analysis"]

    transcript = interview.get("transcript", [])
    if not transcript:
        analysis_result = _analysis_unavailable("aucune transcription n'a été capturée pendant l'entretien.")
    else:
        try:
            from utils.interview_analyzer import analyze_interview
            analysis_result = analyze_interview(transcript, _build_interview_emotion_history(interview))
        except Exception as e:
            print(f"Error during AI summarization: {e}")
            analysis_result = _analysis_unavailable("le moteur IA n'a pas pu terminer le bilan.")

    db.hr_interviews.update_one(
        {"_id": ObjectId(interview_id)},
        {"$set": {"ai_analysis": analysis_result}}
    )
    return analysis_result

# ── POST Summarize Interview (AI Analysis) ─────────────────────────────────
@router.post("/{interview_id}/summarize")
async def summarize_interview(
    interview_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(interview_id):
        raise HTTPException(status_code=400, detail="Invalid interview ID")
        
    db = get_db()
    analysis_result = _generate_and_store_interview_analysis(db, interview_id)
    db.hr_interviews.update_one(
        {"_id": ObjectId(interview_id)},
        {"$set": {"status": "completed"}}
    )
    return {"status": "success", "data": analysis_result}

# ── POST Save Candidate Analysis Log ──────────────────────────────────────
@router.post("/{interview_id}/analysis-log")
async def save_candidate_analysis_log(
    interview_id: str,
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Save the client-side analysis log (emotions + attention) sent by the candidate at end of call."""
    if not ObjectId.is_valid(interview_id):
        raise HTTPException(status_code=400, detail="Invalid interview ID")

    db = get_db()
    log = body.get("log", [])

    db.hr_interviews.update_one(
        {"_id": ObjectId(interview_id)},
        {"$set": {"candidate_analysis_log": log}}
    )

    return {"status": "success", "entries": len(log)}

# ── POST Start Interview ──────────────────────────────────────────────────
@router.post("/{interview_id}/start")
async def start_interview(
    interview_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(interview_id):
        raise HTTPException(status_code=400, detail="Invalid interview ID")
        
    db = get_db()
    interview = db.hr_interviews.find_one({"_id": ObjectId(interview_id)})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if interview.get("status") == "no_show":
        raise HTTPException(status_code=409, detail="Interview was marked as no-show and must be rescheduled")
        
    # Transition to in_progress
    db.hr_interviews.update_one(
        {"_id": ObjectId(interview_id)},
        {"$set": {"status": "in_progress", "started_at": datetime.utcnow()}}
    )
    
    # Also update application status
    if "application_id" in interview:
        db.job_applications.update_one(
            {"_id": ObjectId(interview["application_id"])},
            {"$set": {"interview_status": "in_progress"}}
        )
    
    return {"status": "success", "message": "Interview started"}

# ── POST End Interview ──────────────────────────────────────────────────
@router.post("/{interview_id}/end")
async def end_interview(
    interview_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(interview_id):
        raise HTTPException(status_code=400, detail="Invalid interview ID")
        
    db = get_db()
    # We allow both recruiter and candidate to end, or just recruiter?
    # User said "ferme par le recruteur", but technically anyone can leave.
    # Recruiter is the host, so they usually end it.
    
    interview = db.hr_interviews.find_one({"_id": ObjectId(interview_id)})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if interview.get("status") == "no_show":
        return {"status": "success", "message": "Interview already marked as no-show"}
        
    db.hr_interviews.update_one(
        {"_id": ObjectId(interview_id)},
        {"$set": {"status": "completed", "ended_at": datetime.utcnow()}}
    )
    
    # Also update application status
    if "application_id" in interview:
        db.job_applications.update_one(
            {"_id": ObjectId(interview["application_id"])},
            {"$set": {"interview_status": "completed"}}
        )

    analysis_result = _generate_and_store_interview_analysis(db, interview_id)
    
    return {
        "status": "success",
        "message": "Interview marked as completed",
        "ai_analysis": analysis_result,
    }
