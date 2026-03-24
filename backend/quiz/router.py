"""
Quiz Generation API Router.
Provides REST endpoints for document upload, quiz generation, retrieval, and management.

Endpoints:
    POST   /api/quiz/upload-document        Upload and ingest a document
    GET    /api/quiz/documents               List all documents
    GET    /api/quiz/documents/{id}/sections  Get document sections
    POST   /api/quiz/generate                Generate a quiz
    GET    /api/quiz/{id}                    Get a quiz by ID
    GET    /api/quiz/quizzes                 List all quizzes
    POST   /api/quiz/templates               Create a template
    GET    /api/quiz/templates               List templates
    GET    /test/quiz                        Test route (no auth) — demo quiz generation

How to run locally:
    1. Start backend: cd backend && uvicorn main:app --reload
    2. Test route: GET http://localhost:8000/test/quiz
    3. Upload: POST http://localhost:8000/api/quiz/upload-document (multipart/form-data)
"""

import json
import logging
from datetime import datetime
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional, Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Query
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from database.mongodb_async import get_async_db
from middleware.auth import get_current_user
from quiz.ingestion import ingest_document
from quiz.chunking import chunk_and_store
from quiz.embeddings import embed_and_store_chunks
from quiz.retrieval import retrieve_chunks_for_quiz
from quiz.generation import generate_quiz
from quiz.templates import (
    seed_builtin_templates, get_template, list_templates,
    create_template, resolve_template_config, validate_quiz_output
)
from quiz.metadata import (
    update_chunk_usage, record_quiz_provenance,
    compute_overlap_with_existing, check_chunk_availability, get_usage_stats
)

logger = logging.getLogger(__name__)

# ── Pydantic Models ──────────────────────────────────────────────────────────

class DocumentConfig(BaseModel):
    document_id: str
    total_questions: int = 5
    question_types: Dict[str, int] = Field(default_factory=lambda: {"mcq": 3, "tf": 2})
    difficulty_mix: Dict[str, float] = Field(default_factory=lambda: {"easy": 0.4, "medium": 0.4, "hard": 0.2})
    sections_filter: Optional[List[str]] = None

class MultiDocQuizRequest(BaseModel):
    title: str = "Multi-Document Quiz"
    documents: List[DocumentConfig]
    options_count: int = 4
    application_id: Optional[str] = None # Added application_id

from quiz.models import GenerateQuizRequest # Ensure we use the one from models.py or define it here if needed.

# ── API Router ───────────────────────────────────────────────────────────────

router = APIRouter(prefix="/quiz", tags=["Quiz Generation"])

# ── Test Router (no auth, mounted separately at /test) ───────────────────────

test_router = APIRouter(tags=["Quiz Test"])


def _serialize(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict."""
    if doc is None:
        return {}
    result = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            result[k] = str(v)
        elif isinstance(v, datetime):
            result[k] = v.isoformat()
        elif isinstance(v, list):
            result[k] = [_serialize(item) if isinstance(item, dict) else
                         str(item) if isinstance(item, ObjectId) else
                         item.isoformat() if isinstance(item, datetime) else item
                         for item in v]
        elif isinstance(v, dict):
            result[k] = _serialize(v)
        else:
            result[k] = v
    return result


# ── Document Endpoints ───────────────────────────────────────────────────────

@router.post("/upload-document")
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a document (PDF, DOCX, PPTX, image).
    The document will be:
    1. Stored in GridFS
    2. Text extracted
    3. Split into chunks
    4. Each chunk embedded with nomic-embed-text
    5. Stored in quiz_chunks collection

    Returns the document ID and processing status.
    """
    db = get_async_db()
    
    # Get company_id
    profile = await db.hr_profiles.find_one({"_id": current_user["id"]})
    company_id = profile.get("company_id") if profile else None

    # Validate file
    allowed_extensions = {".pdf", ".docx", ".doc", ".pptx", ".ppt", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"}
    filename = file.filename or "unknown"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(allowed_extensions)}"
        )

    # Read file bytes
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(file_bytes) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=400, detail="File too large. Max 50MB.")

    try:
        # 1. Ingest: store in GridFS + extract text
        doc = await ingest_document(db, file_bytes, filename, uploaded_by=current_user["id"])

        if doc.get("status") == "error":
            return _serialize({
                "document_id": str(doc["_id"]),
                "filename": filename,
                "status": "error",
                "message": "Text extraction failed. The document may be corrupted or password-protected."
            })

        # Set title and company_id
        update_fields = {}
        if title:
            update_fields["title"] = title
        if company_id:
            update_fields["company_id"] = company_id
        
        if update_fields:
            await db.quiz_documents.update_one(
                {"_id": doc["_id"]},
                {"$set": update_fields}
            )
            doc.update(update_fields) # Update the local doc object as well

        # 2. Chunk the extracted text
        extracted_text = doc.get("extracted_text", "")
        sections = doc.get("sections", [])
        chunks = await chunk_and_store(db, str(doc["_id"]), extracted_text, sections)

        # 3. Generate embeddings for all chunks
        embedded_count = await embed_and_store_chunks(db, str(doc["_id"]), chunks)

        # 4. Clean up: remove extracted_text from document (no longer needed)
        await db.quiz_documents.update_one(
            {"_id": doc["_id"]},
            {"$unset": {"extracted_text": ""}}
        )

        # 5. Seed built-in templates if not exists
        await seed_builtin_templates(db)

        # 6. Audit log
        await db.quiz_audit.insert_one({
            "action": "document_uploaded",
            "user_id": current_user["id"],
            "timestamp": datetime.utcnow(),
            "details": {
                "document_id": str(doc["_id"]),
                "metadata": {
                    "filename": filename,
                    "file_type": doc.get("file_type"),
                    "page_count": doc.get("metadata", {}).get("page_count", 0),
                    "total_chunks": len(chunks),
                    "embedded_chunks": embedded_count,
                }
            }
        })

        return _serialize({
            "document_id": str(doc["_id"]),
            "filename": filename,
            "title": doc.get("title", ""),
            "status": "ready",
            "total_chunks": len(chunks),
            "embedded_chunks": embedded_count,
            "sections": [s.get("title", "") for s in sections],
            "message": f"Document processed successfully: {len(chunks)} chunks, {embedded_count} embeddings."
        })

    except Exception as e:
        logger.error(f"Upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")


@router.get("/documents")
async def list_documents(current_user: dict = Depends(get_current_user)):
    """List all ingested documents for the current company."""
    db = get_async_db()
    
    # Get company_id
    profile = await db.hr_profiles.find_one({"_id": current_user["id"]})
    company_id = profile.get("company_id") if profile else "unknown"
    
    cursor = db.quiz_documents.find({"company_id": company_id}, {"extracted_text": 0}).sort("uploaded_at", -1)
    docs = await cursor.to_list(length=100)
    return [_serialize(doc) for doc in docs]


@router.get("/documents/{document_id}/sections")
async def get_document_sections(document_id: str):
    """Get sections for a specific document."""
    db = get_async_db()
    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID")

    doc = await db.quiz_documents.find_one(
        {"_id": ObjectId(document_id)},
        {"sections": 1, "title": 1, "total_chunks": 1, "total_tokens": 1, "status": 1}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Also get chunk availability stats
    availability = await check_chunk_availability(db, document_id)

    return _serialize({
        "document_id": str(doc["_id"]),
        "title": doc.get("title", ""),
        "status": doc.get("status", ""),
        "total_chunks": doc.get("total_chunks", 0),
        "total_tokens": doc.get("total_tokens", 0),
        "sections": doc.get("sections", []),
        "chunk_availability": availability,
    })


# ── Quiz Generation Endpoints ───────────────────────────────────────────────

@router.post("/generate-multi")
async def generate_multi_quiz_endpoint(
    request: MultiDocQuizRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a single quiz spanning multiple documents.
    Each document can have its own question count and difficulty mix.
    """
    db = get_async_db()
    
    # Get company_id
    profile = await db.hr_profiles.find_one({"_id": current_user["id"]})
    company_id = profile.get("company_id") if profile else None
    
    if not request.documents:
        raise HTTPException(status_code=400, detail="No documents provided in request")

    all_questions = []
    all_source_chunks = []
    agg_difficulty = {"easy": 0, "medium": 0, "hard": 0}
    
    try:
        for doc_config in request.documents:
            doc_id = doc_config.document_id
            # 1. Fetch document title for better prompt context
            doc = await db.quiz_documents.find_one({"_id": ObjectId(doc_id)}, {"title": 1, "filename": 1})
            doc_title = doc.get("title") or doc.get("filename") or "Unknown Document"

            # 2. Retrieve chunks for THIS document
            chunks = await retrieve_chunks_for_quiz(
                db,
                doc_id,
                total_questions=doc_config.total_questions,
                section_filter=doc_config.sections_filter
            )
            
            if not chunks:
                logger.warning(f"No chunks found for document {doc_id}")
                continue

            # 3. Adjust question_types to match total_questions if they don't match
            q_types = doc_config.question_types.copy()
            current_total = sum(q_types.values())
            if current_total != doc_config.total_questions:
                # Simple scaling: roughly maintain the ratio of MCQ vs TF
                ratio_mcq = q_types.get("mcq", 1) / max(1, current_total)
                new_mcq = round(doc_config.total_questions * ratio_mcq)
                new_tf = doc_config.total_questions - new_mcq
                q_types = {"mcq": new_mcq, "tf": new_tf}

            # 4. Generate questions for THIS document
            # Pass the title so it can be included in the prompt
            sub_quiz = await generate_quiz(
                chunks=chunks,
                question_types=q_types,
                difficulty_mix=doc_config.difficulty_mix,
                title=f"{request.title} - {doc_title}",
                options_count=request.options_count
            )
            
            # 3. Collect results
            all_questions.extend(sub_quiz.get("questions", []))
            all_source_chunks.extend(sub_quiz.get("source_chunk_ids", []))
            
            # Update aggregate difficulty
            dist = sub_quiz.get("difficulty_distribution", {})
            for d in ["easy", "medium", "hard"]:
                agg_difficulty[d] += dist.get(d, 0)

        if not all_questions:
            raise HTTPException(status_code=400, detail="Failed to generate any questions from the provided documents")

        # 4. Build final merged quiz
        merged_quiz = {
            "title": request.title,
            "generated_at": datetime.utcnow(),
            "difficulty_distribution": agg_difficulty,
            "questions": all_questions,
            "source_chunk_ids": list(set(all_source_chunks)),
            "document_ids": [ObjectId(dc.document_id) for dc in request.documents if ObjectId.is_valid(dc.document_id)],
            "multi_document": True,
            "status": "draft",
            "company_id": company_id,
            "application_id": request.application_id,
            "generated_by": current_user["id"]
        }

        # 5. Store merged quiz
        result = await db.quizzes.insert_one(merged_quiz)
        
        # 6. Update chunk usage
        q_types = list(set(q["type"] for q in all_questions))
        await update_chunk_usage(db, all_source_chunks, q_types)

        return _serialize({
            "quiz_id": str(result.inserted_id),
            "title": merged_quiz["title"],
            "total_questions": len(all_questions),
            "difficulty_distribution": agg_difficulty
        })

    except Exception as e:
        logger.error(f"Multi-doc quiz generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate")
async def generate_quiz_endpoint(
    request: GenerateQuizRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a quiz for a specific document.
    """
    db = get_async_db()
    
    # Get company_id
    profile = await db.hr_profiles.find_one({"_id": current_user["id"]})
    company_id = profile.get("company_id") if profile else None
    
    document_id = request.document_id
    template_id = request.template_id

    # Validate document exists and is ready
    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID")

    doc = await db.quiz_documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Ensure document belongs to the same company
    if doc.get("company_id") and doc.get("company_id") != company_id:
         raise HTTPException(status_code=403, detail="Access denied to this document")

    if doc.get("status") != "ready":
        raise HTTPException(
            status_code=400,
            detail=f"Document is not ready (status: {doc.get('status')}). Wait for processing to complete."
        )

    # Resolve template
    template = None
    if template_id and ObjectId.is_valid(template_id):
        template = await get_template(db, template_id)

    # Build overrides
    overrides = {"total_questions": request.total_questions}
    if request.sections_filter:
        overrides["sections_filter"] = request.sections_filter

    config = resolve_template_config(template, overrides)

    try:
        # 1. Retrieve diverse chunks
        chunks = await retrieve_chunks_for_quiz(
            db,
            document_id,
            total_questions=config["total_questions"],
            section_filter=config.get("sections_filter"),
            max_chunk_reuse=config.get("max_chunk_reuse", 3),
        )

        if not chunks:
            raise HTTPException(
                status_code=400,
                detail="No available chunks for quiz generation."
            )

        # 2. Generate quiz
        question_types = {
            qt: qtc["count"]
            for qt, qtc in config["question_types"].items()
        }
        difficulty_mix = request.difficulty_mix or config["difficulty_mix"]
        quiz_title = request.title or f"Quiz - {doc.get('title', 'Untitled')} ({datetime.utcnow().strftime('%Y-%m-%d')})"

        quiz_data = await generate_quiz(
            chunks=chunks,
            question_types=question_types,
            difficulty_mix=difficulty_mix,
            title=quiz_title,
            options_count=config["question_types"].get("mcq", {}).get("options_count", 4)
        )

        # 3. Add metadata
        quiz_data["document_id"] = ObjectId(document_id)
        quiz_data["template_id"] = ObjectId(template_id) if template_id and ObjectId.is_valid(template_id) else None
        quiz_data["generated_by"] = current_user["id"]
        quiz_data["company_id"] = company_id
        quiz_data["application_id"] = request.application_id

        # 3. Add document and template references
        quiz_data["document_id"] = ObjectId(document_id)
        quiz_data["template_id"] = ObjectId(template_id) if template_id and ObjectId.is_valid(template_id) else None
        quiz_data["generated_by"] = current_user["id"] # Changed from "system"
        quiz_data["company_id"] = company_id # Added company_id

        # 4. Compute overlap with existing quizzes
        chunk_ids = quiz_data.get("source_chunk_ids", [])
        overlap = await compute_overlap_with_existing(db, document_id, chunk_ids)
        quiz_data["overlap_score"] = overlap

        # 5. Validate output
        validation_errors = validate_quiz_output(quiz_data, config)
        if validation_errors:
            logger.warning(f"Quiz validation warnings: {validation_errors}")

        # 6. Store quiz
        result = await db.quizzes.insert_one(quiz_data)
        quiz_data["_id"] = result.inserted_id

        # 7. Update chunk usage metadata
        question_types_used = list(set(q["type"] for q in quiz_data.get("questions", [])))
        await update_chunk_usage(db, chunk_ids, question_types_used)

        # 8. Record provenance audit
        await record_quiz_provenance(
            db, str(result.inserted_id), document_id, chunk_ids,
            template_id=template_id, user_id=current_user["id"] # Changed from "system"
        )

        return _serialize({
            "quiz_id": str(result.inserted_id),
            "title": quiz_data["title"],
            "total_questions": len(quiz_data.get("questions", [])),
            "difficulty_distribution": quiz_data.get("difficulty_distribution", {}),
            "overlap_score": overlap,
            "validation_warnings": validation_errors,
            "quiz": quiz_data,
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Quiz generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")


@router.get("/check/{application_id}")
async def check_quiz_by_application(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if a quiz exists for a given application and return its ID."""
    db = get_async_db()
    
    quiz = await db.quizzes.find_one({
        "application_id": application_id,
        "generated_by": current_user["id"]
    }, {"_id": 1})
    
    if quiz:
        return {"exists": True, "quiz_id": str(quiz["_id"])}
    return {"exists": False}

@router.get("/quizzes")
async def list_quizzes(
    current_user: dict = Depends(get_current_user),
    document_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 20,
):
    """List generated quizzes with optional filters for the current company."""
    db = get_async_db()

    # Get company_id
    profile = await db.hr_profiles.find_one({"_id": current_user["id"]})
    company_id = profile.get("company_id") if profile else "unknown"

    query = {"company_id": company_id} # Filter by company_id
    if document_id and ObjectId.is_valid(document_id):
        query["document_id"] = ObjectId(document_id)
    if status:
        query["status"] = status

    quizzes = await db.quizzes.find(
        query,
        {"questions": 0}  # Exclude full questions for list view
    ).sort("generated_at", -1).to_list(length=limit)

    return [_serialize({
        "id": str(q["_id"]),
        "title": q.get("title", ""),
        "document_id": str(q.get("document_id", "")),
        "generated_at": q.get("generated_at", ""),
        "total_questions": len(q.get("questions", [])) if "questions" in q else q.get("total_questions", 0),
        "status": q.get("status", "draft"),
        "difficulty_distribution": q.get("difficulty_distribution", {}),
        "overlap_score": q.get("overlap_score"),
    }) for q in quizzes]


@router.get("/{quiz_id}")
async def get_quiz(quiz_id: str):
    """Get a quiz by ID with all questions."""
    db = get_async_db()
    if not ObjectId.is_valid(quiz_id):
        raise HTTPException(status_code=400, detail="Invalid quiz ID")

    quiz = await db.quizzes.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    return _serialize(quiz)


# ── Template Endpoints ───────────────────────────────────────────────────────

@router.get("/templates/list")
async def list_templates_endpoint():
    """List all quiz templates."""
    db = get_async_db()
    await seed_builtin_templates(db)
    templates = await list_templates(db)
    return [_serialize(t) for t in templates]


@router.post("/templates")
async def create_template_endpoint(
    name: str,
    description: str = "",
    total_questions: int = 10,
    mcq_count: int = 7,
    tf_count: int = 3,
    scenario_count: int = 0,
    fill_in_count: int = 0,
    easy_pct: float = 0.3,
    medium_pct: float = 0.5,
    hard_pct: float = 0.2,
):
    """Create a new quiz template."""
    db = get_async_db()

    template_data = {
        "name": name,
        "description": description,
        "created_by": "system",
        "config": {
            "total_questions": total_questions,
            "question_types": {},
            "difficulty_mix": {"easy": easy_pct, "medium": medium_pct, "hard": hard_pct},
            "distractor_rules": {"min_plausibility": "medium", "avoid_obvious_wrong": True},
            "sections_filter": [],
            "max_chunk_reuse": 3,
        }
    }

    # Build question types
    if mcq_count > 0:
        template_data["config"]["question_types"]["mcq"] = {"count": mcq_count, "options_count": 4}
    if tf_count > 0:
        template_data["config"]["question_types"]["tf"] = {"count": tf_count}
    if scenario_count > 0:
        template_data["config"]["question_types"]["scenario"] = {"count": scenario_count}
    if fill_in_count > 0:
        template_data["config"]["question_types"]["fill_in"] = {"count": fill_in_count}

    try:
        result = await create_template(db, template_data)
        return _serialize(result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Stats Endpoint ───────────────────────────────────────────────────────────

@router.get("/documents/{document_id}/stats")
async def get_document_stats(document_id: str):
    """Get usage statistics for a document."""
    db = get_async_db()
    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID")

    stats = await get_usage_stats(db, document_id)
    availability = await check_chunk_availability(db, document_id)

    return {
        "usage_stats": stats,
        "chunk_availability": availability,
    }


# ── Test Route (No Authentication) ──────────────────────────────────────────

@test_router.get("/quiz")
async def test_quiz_generation():
    """
    Test route for quick demo. No authentication required.
    Creates a mock document, chunks it, and generates a quiz.

    WARNING: This route bypasses authentication. Remove or protect before production.

    Usage: GET http://localhost:8000/test/quiz
    """
    db = get_async_db()

    # Sample HR training content
    sample_text = """
## Workplace Safety

Workplace safety is every employee's responsibility. The Occupational Safety and Health Administration (OSHA) requires all employers to provide a safe working environment. Key principles include hazard identification, risk assessment, and implementation of control measures.

All employees must report unsafe conditions to their supervisor immediately. Do not attempt to fix hazardous situations yourself unless you have been trained to do so. The safety hotline is available 24/7 at extension 5555.

## Personal Protective Equipment

Personal Protective Equipment (PPE) must be worn in all designated areas. Required PPE includes: hard hats in construction zones, safety goggles in laboratories, hearing protection near heavy machinery, and steel-toed boots in warehouses.

Failure to wear required PPE may result in disciplinary action up to and including termination. PPE must be inspected before each use and replaced if damaged.

## Emergency Procedures

In case of fire, activate the nearest fire alarm and evacuate the building using the designated exit routes. Do not use elevators during a fire. Assemble at the designated meeting point in the parking lot.

For medical emergencies, call 911 immediately and then notify your supervisor. First aid kits are located in every department on the main floor. AED defibrillators are located near the elevators on each floor.

## Incident Reporting

All workplace incidents, including near-misses, must be reported within 24 hours using the online incident reporting system. Supervisors must investigate all reported incidents and submit findings within 72 hours.

The safety committee reviews all incident reports monthly and implements corrective actions. Failure to report incidents may result in disciplinary action. Anonymous reporting is available through the safety hotline.

## Chemical Safety

All chemicals must be properly labeled and stored according to their Safety Data Sheets (SDS). SDS documents are available in the chemical storage room and on the company intranet.

Employees who handle chemicals must complete the annual Hazard Communication Training. Spills must be cleaned up immediately using the appropriate spill kit. Report all chemical exposures to the safety officer immediately.
    """

    try:
        # 1. Create a test document directly (skip GridFS for speed)
        doc = {
            "title": "Safety Training Manual (Test)",
            "filename": "test_safety_manual.pdf",
            "file_type": "pdf",
            "gridfs_file_id": None,
            "uploaded_by": "test_user",
            "uploaded_at": datetime.utcnow(),
            "status": "processing",
            "total_chunks": 0,
            "total_tokens": 0,
            "sections": [],
            "metadata": {"page_count": 5, "language": "en", "category": "safety"},
        }
        result = await db.quiz_documents.insert_one(doc)
        doc_id = str(result.inserted_id)

        # 2. Chunk the text
        from quiz.ingestion import detect_sections
        sections = detect_sections(sample_text)
        chunks = await chunk_and_store(db, doc_id, sample_text, sections)

        # 3. Embed chunks
        try:
            embedded_count = await embed_and_store_chunks(db, doc_id, chunks)
        except Exception as e:
            logger.warning(f"Embedding failed (Ollama may not be running): {e}")
            embedded_count = 0
            # Mark document as ready anyway for mock quiz generation
            await db.quiz_documents.update_one(
                {"_id": ObjectId(doc_id)},
                {"$set": {"status": "ready"}}
            )

        # 4. Seed templates
        await seed_builtin_templates(db)

        # 5. Retrieve chunks (will work even without embeddings using fallback)
        # Fetch chunks directly since we just created them
        quiz_chunks = await db.quiz_chunks.find(
            {"document_id": ObjectId(doc_id)},
            {"embedding": 0}
        ).to_list(length=None)

        if not quiz_chunks:
            return {"error": "Failed to create chunks from test document"}

        # 6. Generate quiz
        quiz_data = await generate_quiz(
            chunks=quiz_chunks,
            question_types={"mcq": 3, "tf": 2},
            difficulty_mix={"easy": 0.4, "medium": 0.4, "hard": 0.2},
            title="Test Safety Quiz",
            options_count=4
        )

        # 7. Store quiz
        quiz_data["document_id"] = ObjectId(doc_id)
        quiz_data["generated_by"] = "test_user"
        quiz_result = await db.quizzes.insert_one(quiz_data)
        quiz_data["_id"] = quiz_result.inserted_id

        # 8. Update metadata
        chunk_ids = [str(c["_id"]) for c in quiz_chunks[:5]]
        await update_chunk_usage(db, chunk_ids, ["mcq", "tf"])

        return _serialize({
            "status": "success",
            "message": "Test quiz generated successfully!",
            "document_id": doc_id,
            "total_chunks": len(quiz_chunks),
            "embedded_chunks": embedded_count,
            "quiz_id": str(quiz_result.inserted_id),
            "quiz": quiz_data
        })

    except Exception as e:
        logger.error(f"Test quiz generation failed: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
