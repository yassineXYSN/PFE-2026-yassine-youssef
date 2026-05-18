# HumatiQ — UML Class Diagram Audit Report

> **Source**: Full static analysis of `backend/` Python source (models, routers, services, middleware, utils).
> **Date**: 2026-05-17  
> **Analyst**: Claude Code (Sonnet 4.6)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Relationship Matrix](#3-relationship-matrix)
4. [Class-by-Class Fixes](#4-class-by-class-fixes)
   - [Utilisateur](#41-utilisateur--abstract-base)
   - [SuperAdmin](#42-superadmin)
   - [UtilisateurRH ← Architectural Correction](#43-utilisateurRH--architectural-correction)
   - [Admin](#44-admin)
   - [ChefDepartement](#45-chefdepartement)
   - [Recruteur](#46-recruteur)
   - [Candidat](#47-candidat)
   - [Entreprise](#48-entreprise)
   - [Departement](#49-departement)
   - [OffreEmploi](#410-offreemploi)
   - [Candidature](#411-candidature)
   - [Entretien](#412-entretien)
   - [Quiz](#413-quiz)
   - [Notification](#414-notification)
5. [Missing Entities (Must Add)](#5-missing-entities-must-add)
   - [QuizDocument](#51-quizdocument)
   - [QuizChunk](#52-quizchunk)
   - [QuizQuestion](#53-quizquestion)
   - [InterviewProposal](#54-interviewproposal)
   - [AIAutomationConfig](#55-aiautomationconfig)
   - [AIMatchingService](#56-aimatchingservice-service)
6. [Architectural Recommendations](#6-architectural-recommendations)
7. [Casing Reference Table](#7-casing-reference-table)
8. [Bugs Found in Source Code](#8-bugs-found-in-source-code)
9. [Change Impact Summary](#9-change-impact-summary)

---

## 1. Executive Summary

The diagram captures the high-level domain correctly but has **critical structural inaccuracies** in the inheritance hierarchy, **wrong or missing multiplicities** on every association, **5 entirely missing entities** from the AI pipeline, and **pervasive casing inconsistencies**. All findings are derived directly from backend source files.

| Category | Count |
|---|---|
| Classes to **add** | 5 + 1 service |
| Classes to **restructure** (inheritance → role discriminator) | 4 |
| Associations with wrong direction or multiplicity | 8 |
| Fields to **rename** (casing / naming) | 20+ |
| Fields to **remove** (do not exist in code) | 5 |
| Fields to **add** (present in code, missing from diagram) | 40+ |
| **Typos** to fix | 2 |
| **Bugs** found in source code | 3 |

---

## 2. Architecture Overview

| Layer | Technology | Notes |
|---|---|---|
| **API Framework** | FastAPI (async) | Routers in `backend/routers/` and `backend/routes/` |
| **Primary DB** | MongoDB via Motor (async) | Collections: `hr_jobs`, `hr_companies`, `hr_profiles`, `hr_interviews`, `job_applications`, `candidates`, `quizzes`, `quiz_chunks`, `quiz_documents`, `notifications`, `superadmins` |
| **Auth** | Supabase (JWT) | Identity only — profile data is in MongoDB |
| **Vector Search** | MongoDB Atlas `$vectorSearch` | Embedding model: `nomic-embed-text` (768 dims) via Ollama |
| **LLM (matching)** | Ollama (local) | Model configurable via `PROFILE_ANALYSIS_MODEL` env var |
| **LLM (interview)** | HuggingFace Inference API | Default: `Qwen/Qwen2.5-72B-Instruct` |
| **Emotion CNN** | Custom ResNet (`weights/resnet_best.pth`) | 7 emotions: angry, disgust, fear, happy, neutral, sad, surprise |
| **Transcription** | OpenAI Whisper | `services/transcription.py` |

---

## 3. Relationship Matrix

| Source Class | UML Type | Label | Target Class | Source Mult. | Target Mult. |
|---|---|---|---|---|---|
| `SuperAdmin` | Association → | `creates` | `Entreprise` | `1` | `0..*` |
| `SuperAdmin` | Association → | `manages` | `UtilisateurRH` | `1` | `0..*` |
| `Entreprise` | **Composition ◆→** | `owns` | `Departement` | `1` | `0..*` |
| `Entreprise` | Association → | `employs` | `UtilisateurRH` | `1` | `0..*` |
| `Entreprise` | Association → | `owns` | `QuizDocument` | `1` | `0..*` |
| `Departement` | Association → | `managedBy` | `ChefDepartement` | `1` | `0..1` |
| `Departement` | Aggregation ◇→ | `contains` | `UtilisateurRH` | `0..1` | `0..*` |
| `Recruteur (hr)` | Association → | `publishes` | `OffreEmploi` | `1` | `0..*` |
| `OffreEmploi` | Association → | `belongsTo` | `Entreprise` | `0..*` | `1` |
| `OffreEmploi` | Association → | `assignedTo` | `Departement` | `0..*` | `0..1` |
| `OffreEmploi` | **Composition ◆→** | `configures` | `AIAutomationConfig` | `1` | `0..1` |
| `Candidat` | Association → | `submits` | `Candidature` | `1` | `0..*` |
| `Candidature` | Association → | `references` | `OffreEmploi` | `0..*` | `1` |
| `Candidature` | Association → | `hasInterview` | `Entretien` | `1` | `0..1` |
| `Candidature` | Association → | `hasQuizzes` | `Quiz` | `1` | `0..*` |
| `Entretien` | Association → | `conductedBy` | `Recruteur` | `0..*` | `0..1` |
| `Entretien` | Association → | `belongsTo` | `Entreprise` | `0..*` | `1` |
| `Quiz` | **Composition ◆→** | `contains` | `QuizQuestion` | `1` | `1..*` |
| `Quiz` | Association → | `generatedFrom` | `QuizDocument` | `0..*` | `1` |
| `QuizDocument` | **Composition ◆→** | `chunkedInto` | `QuizChunk` | `1` | `1..*` |
| `QuizChunk` | Association ↔ | `sourceOf` | `QuizQuestion` | `0..*` | `0..*` |
| `Utilisateur` | Association → | `receives` | `Notification` | `1` | `0..*` |

> ⚠️ **Critical correction**: The diagram links `Quiz` directly to `Candidat`. This is **wrong**.  
> Correct chain: `Candidat (1) → (0..*) Candidature (1) → (0..*) Quiz` via `Quiz.application_id`.

---

## 4. Class-by-Class Fixes

---

### 4.1 `Utilisateur` — Abstract Base

> **Source file**: `backend/middleware/auth.py`, `backend/models/profile.py`, `backend/models/superadmin.py`

**Architecture note**: There is no single base user model in the code. The actual storage is split across three collections. Authentication is entirely delegated to **Supabase** — no password is ever stored in the application database.

| Diagram Field | Action | Corrected Value |
|---|---|---|
| `UUID id` | Rename | `id: str` (Supabase UUID, stored as MongoDB `_id`) |
| `String email` | Keep | `email: Optional[str]` |
| `String motDePasse` | ❌ **Remove** | Passwords managed by Supabase — never in app DB |
| `String statut` | Rename | `status: str` — values: `"active"`, `"pending"` |
| — | ➕ Add | `first_name: Optional[str]` |
| — | ➕ Add | `last_name: Optional[str]` |
| — | ➕ Add | `phone: Optional[str]` |
| — | ➕ Add | `avatar_url: Optional[str]` |
| `+SeConnecter()` | ❌ **Remove** | Auth is client-side Supabase SDK |
| `+SeDeconnecter()` | ❌ **Remove** | Same reason |

---

### 4.2 `SuperAdmin`

> **Source file**: `backend/models/superadmin.py` — MongoDB collection: `superadmins`

```
SuperAdmin
──────────────────────────────
id: str                      ← Supabase UUID (_id in MongoDB)
first_name: Optional[str]
last_name: Optional[str]
email: Optional[str]
role: str = "superadmin"
status: str = "active"
phone: Optional[str]
avatar_url: Optional[str]
created_at: datetime
updated_at: datetime
```

| Action | Detail |
|---|---|
| ➕ Add all fields above | None were shown in diagram |
| ❌ Remove inherited `motDePasse` | Does not exist |
| Keep `+Cree` relation to Entreprise | Add multiplicity `1 → 0..*` |

---

### 4.3 `UtilisateurRH` — ⚠️ Architectural Correction

> **Source files**: `backend/models/profile.py`, `backend/middleware/auth.py`

**`UtilisateurRH` is NOT a real class.** It is a conceptual grouping only. `Admin`, `ChefDepartement`, and `Recruteur` are **not subclasses** — they are all instances of the same `ProfileBase` Pydantic model, stored in the single `hr_profiles` MongoDB collection, differentiated by the `role: str` field.

**Action**: Remove inheritance arrows from `Admin`, `ChefDepartement`, `Recruteur` to `UtilisateurRH`. Replace with a single concrete class `ProfilRH` with a `role` discriminator. Optionally use `<<role>>` stereotypes or a `<<uses>>` dependency for the three sub-roles.

**Actual `ProfileBase` fields** (shared by all HR roles):

```
ProfilRH  {stored in: hr_profiles}
──────────────────────────────────────────
id: str                          ← Supabase UUID
first_name: Optional[str]
last_name: Optional[str]
email: Optional[str]
role: str                        ← "admin" | "hr" | "chef_departement"
status: str                      ← "active" | "pending"
company_id: Optional[str]        ← FK → Entreprise
department_id: Optional[str]     ← FK → Departement
phone: Optional[str]
position: Optional[str]
avatar_url: Optional[str]
bio: Optional[str]
skills: List[Any]
experience: List[Dict]
education: List[Dict]
social_links: Dict[str, str]
preferences: Dict[str, Any]
profileStrength: Optional[int]
profileMissing: Optional[List[str]]
created_at: datetime
updated_at: datetime
```

---

### 4.4 `Admin`

> **Source**: `ProfileBase` with `role = "admin"` — no separate model

| Diagram Field / Method | Action | Note |
|---|---|---|
| Separate class hierarchy | ❌ Collapse | Use role tag on `ProfilRH` |
| `+GererUtilisateursRH()` | ✅ Keep | Valid business operation |
| `+CreerOffre()` | ✅ Keep | |
| `+SupprimerOffre()` | ✅ Keep | |
| `+GererDepartements()` | ✅ Keep | |
| `+ConsulterTableauBord()` | ✅ Keep | |

---

### 4.5 `ChefDepartement`

> **Source**: `ProfileBase` with `role = "chef_departement"` — access scoped to `department_id`

| Diagram Field / Method | Action | Note |
|---|---|---|
| `+Manger` relation label | ✅ Fix typo → `+manages` | Actual field: `manager_id` in `DepartmentBase` |
| `String departementId` | Rename → `department_id: Optional[str]` | |
| `+SuivreOffres()` | ✅ Keep | |
| `+ConsulterCandidatures()` | ✅ Keep | |
| `+ValiderCandidatures()` | ✅ Keep | |
| `+GererEquipe()` | ✅ Keep | |

---

### 4.6 `Recruteur`

> **Source**: `ProfileBase` with **`role = "hr"`** — ⚠️ actual role string is `"hr"`, NOT `"recruteur"`

| Diagram Field / Method | Action | Note |
|---|---|---|
| Role string mismatch | ⚠️ Add note | Actual DB role value = `"hr"` |
| `+PublierOffre()` | ✅ Keep | |
| `+GererCandidatures()` | ✅ Keep | |
| `+PlanifierEntretien()` | ✅ Keep | |
| — | ➕ Add note | `recruiter_id` is an optional FK on `InterviewProposal` |

---

### 4.7 `Candidat`

> **Source files**: `backend/database/model.py` (`AccountSetupData`), `backend/routes/candidat/`  
> **MongoDB collection**: `candidates`  
> **Casing**: camelCase (differs from HR profiles which use snake_case)

| Diagram Field | Action | Corrected Value |
|---|---|---|
| `Dict ProfileCandidat` | ❌ Replace | Expand into explicit fields below |
| `List embedding` | Rename | `embedding: Optional[List[float]]` — 768-dim Ollama vector |
| — | ➕ Add | `user_id: str` (Supabase auth UUID reference) |
| — | ➕ Add | `firstName: str`, `lastName: str` |
| — | ➕ Add | `title: str`, `birthDate: str`, `address: str`, `linkedinUrl: str` |
| — | ➕ Add | `profilePicture: Optional[str]`, `about: Optional[str]`, `email: Optional[str]` |
| — | ➕ Add | `skills: List[Skill]` |
| — | ➕ Add | `languages: List[Language]` |
| — | ➕ Add | `educations: List[Education]` |
| — | ➕ Add | `experiences: List[Experience]` |
| — | ➕ Add | `certificates: List[Certificate]` |
| — | ➕ Add | `hobbies: List[Hobby]` |
| — | ➕ Add | `jobPreferences: JobPreferences` (complex nested: `jobTypes`, `workLocation`, `salaryExpectation`, `availability`, `preferredIndustries`, `willRelocate`) |
| `+ParseCV()` | Rename | `+parseCV()` — `utils/cv_parser.py` |
| `+ConfigurerProfil()` | ✅ Keep | |
| `+ModifierProfil()` | ✅ Keep | |
| `+SoumettreCandidat()` | ✅ Keep | |
| `+SuivreCandidatures()` | ✅ Keep | |
| `+SauvegarderOffre()` | ✅ Keep | |
| — | ➕ Add | `+generateEmbedding()` — vectorizes profile via Ollama (`services/ai_matching.py`) |

---

### 4.8 `Entreprise`

> **Source file**: `backend/models/company.py` — MongoDB collection: `hr_companies`

| Diagram Field | Action | Corrected Value |
|---|---|---|
| `String nom` | Rename | `name: str` |
| `Dict ConfigIA` | ❌ **Remove** | AI config is per-job, not per-company. `AIAutomationConfig` lives on `OffreEmploi`. |
| `Dict ProfileEntreprise` | ❌ Replace | Expand into explicit fields below |
| — | ➕ Add | `siret: Optional[str]`, `domain: Optional[str]`, `size: Optional[str]` |
| — | ➕ Add | `description: Optional[str]`, `values: List[str]`, `benefits: List[str]` |
| — | ➕ Add | `email: Optional[str]`, `phone: Optional[str]`, `website: Optional[str]` |
| — | ➕ Add | `address: Optional[str]`, `city: Optional[str]`, `zip_code: Optional[str]`, `country: Optional[str]` |
| — | ➕ Add | `latitude: Optional[float]`, `longitude: Optional[float]` |
| — | ➕ Add | `logo_url: Optional[str]`, `primary_color: Optional[str]` |
| — | ➕ Add | `linkedin: Optional[str]`, `twitter: Optional[str]` |
| — | ➕ Add | `status: str`, `onboarding_done: bool` |
| — | ➕ Add | `created_at: datetime`, `updated_at: datetime` |
| `+ConfigurerProfil()` | ✅ Keep | |
| `+ModifierProfil()` | ✅ Keep | |
| `+CreerDepartement()` | ✅ Keep | |

---

### 4.9 `Departement`

> **Source file**: `backend/models/department.py` — MongoDB collection: `hr_departments`

| Diagram Field | Action | Corrected Value |
|---|---|---|
| `String nom` | Rename | `name: str` |
| `String statut` | Rename | `status: str` — value: `"active"` |
| — | ➕ Add | `company_id: str` (FK → Entreprise) |
| — | ➕ Add | `description: Optional[str]` |
| — | ➕ Add | `manager_id: Optional[str]` (FK → ProfilRH where role = chef_departement) |
| — | ➕ Add | `color: str`, `icon: str` (UI display fields) |
| — | ➕ Add | `created_at: datetime`, `updated_at: datetime` |
| `+AjouterMembre()` | ✅ Keep | |
| `+GererEquipe()` | ✅ Keep | |

---

### 4.10 `OffreEmploi`

> **Source file**: `backend/models/job.py` — MongoDB collection: `hr_jobs`

| Diagram Field | Action | Corrected Value |
|---|---|---|
| `String Titre` | Rename | `title: str` |
| `String Description` | Rename | `description: str` |
| `String Statut` | Rename | `status: str` — values: `"published"`, `"open"`, `"archived"` |
| `String TypeContrat` | Rename | `type: str` — values: `"full-time"`, `"part-time"`, `"contract"` |
| `String lieuTravail` | Rename | `location: Optional[str]` |
| `String niveauExperience` | Rename | `experience_level: str` |
| `String modeTravail` | Rename | `work_mode: str` — values: `"onsite"`, `"remote"`, `"hybrid"` |
| `List competencesRequises` | Rename | `requirements: List[str]` |
| `List embedding` | ❌ Remove | Jobs are not vectorized — only candidates have embeddings |
| — | ➕ Add | `company_id: str` (FK → Entreprise) |
| — | ➕ Add | `department_id: Optional[str]` (FK → Departement) |
| — | ➕ Add | `salary_range: Optional[str]` |
| — | ➕ Add | `missions: Optional[str]` |
| — | ➕ Add | `screening_questions: List[str]` |
| — | ➕ Add | `deadline: Optional[str]` |
| — | ➕ Add | `benefits: List[str]` |
| — | ➕ Add | `require_motivation_letter: bool` |
| — | ➕ Add | `allow_hr: bool` |
| — | ➕ Add | `notification_email: Optional[str]` |
| — | ➕ Add | `ai_automation: Optional[AIAutomationConfig]` ← **critical missing field** |
| — | ➕ Add | `created_at: datetime`, `updated_at: datetime` |
| — | ➕ Add (note) | AI automation runtime state: `deadline_processed`, `quiz_stage_processed`, `ai_automation_run_id` |
| `+Publier()` | Rename | `+publish()` |
| `+Archiver()` | Rename | `+archive()` |
| `+ModifierOffre()` | Rename | `+update()` |
| **Code Bug** | ⚠️ Flag | `benfits: Optional[List[str]]` on line 113 of `backend/models/job.py` is a typo duplicate of `benefits`. Remove from code. |

---

### 4.11 `Candidature`

> **Source file**: `backend/models/application.py` — MongoDB collection: `job_applications`

| Diagram Field | Action | Corrected Value |
|---|---|---|
| `UUID id` | Note | Auto-generated MongoDB `ObjectId` |
| `Date DateCandidature` | Rename | `applied_at: datetime` |
| `String Statut` | Rename | `status: str` — values: `"new"`, `"pending"`, `"reviewed"`, `"accepted"`, `"rejected"` |
| `Float scoreEmbedding` | ❌ **Remove** | Vector search runs at query time, score not persisted on document |
| `Float scoreLLM` | Rename | `ai_score: Optional[int]` (0–100) |
| `String justificationLLM` | Rename | `ai_justification: Optional[str]` |
| `Float scoreCNN` | ❌ **Remove** | CNN emotion score is in `Entretien.ai_analysis`, NOT in Candidature |
| `String justificationCNN` | ❌ **Remove** | Same reason |
| `Float scoreQuiz` | Rename | `quiz_score: Optional[float]` |
| — | ➕ Add | `candidate_id: str` (FK → Candidat) |
| — | ➕ Add | `job_id: str` (FK → OffreEmploi) |
| — | ➕ Add | `motivation_letter: Optional[str]` |
| — | ➕ Add | `profile_snapshot: Optional[Dict]` — ⚠️ denormalized copy of candidate profile at application time |
| — | ➕ Add | `quiz_status: Optional[str]` — values: `"pending"`, `"sent"`, `"completed"` |
| — | ➕ Add | `quiz_attempts: int` |
| — | ➕ Add | `quiz_completed_at: Optional[datetime]` |
| — | ➕ Add | `quiz_ai_analysis: Optional[str]` — LLM text analysis of quiz performance |
| — | ➕ Add | `ai_evaluated_at: Optional[datetime]` |
| `+Soumettre()` | ✅ Keep | |
| `+Retirer()` | ✅ Keep | |
| `+ConsulterStatut()` | ✅ Keep | |
| `+EvaluerParEmbedding()` | ⚠️ Move | Belongs to `AIMatchingService`, not to `Candidature` entity |
| `+EvaluerParLLM()` | ⚠️ Move | Same — move to `AIMatchingService <<service>>` |
| `+EvaluerParCNN()` | ❌ Remove | CNN is real-time per-frame emotion detection in `Entretien`, not a Candidature operation |

---

### 4.12 `Entretien`

> **Source file**: `backend/models/interview.py` — MongoDB collection: `hr_interviews`

| Diagram Field | Action | Corrected Value |
|---|---|---|
| `UUID id` | Note | Auto-generated MongoDB `ObjectId` |
| `Date DateEntretien` | ❌ Replace | Split into `start_time: datetime` and `end_time: datetime` |
| `String Lieu` | ❌ Replace | Not used — interviews are online. Use `meeting_link: Optional[str]` |
| `String Statut` | Rename | `status: str` — values: `"pending"`, `"confirmed"`, `"completed"`, `"cancelled"`, `"no_show"` |
| `String TypeEntretien` | Rename | `type: str` — values: `"Video call"`, `"Phone call"`, `"In-person"` |
| `String meetingLink` | Rename | `meeting_link: Optional[str]` |
| `Dict analyseIA` | Rename | `ai_analysis: Optional[Dict]` — keys: `summary`, `strengths`, `weaknesses`, `overall_score` |
| `List transcription` | Rename | `transcript: List[Dict]` — each entry: `{timestamp, sender, text}` |
| `List historiqueEmotions` | Rename | `emotion_history: List[Dict]` — each entry: `{timestamp, emotions: [{emotion, box}]}` |
| — | ➕ Add | `company_id: str` (FK → Entreprise) |
| — | ➕ Add | `application_id: Optional[str]` (FK → Candidature) |
| — | ➕ Add | `recruiter_id: Optional[str]` (FK → ProfilRH) |
| — | ➕ Add | `candidate_name: str`, `candidate_email: str` (denormalized for display) |
| — | ➕ Add | `created_at: datetime` |
| `+Planifier()` | ✅ Keep | |
| `+Annuler()` | ✅ Keep | |
| `+AnalyserEmotions()` | Rename | `+analyzeEmotions()` — `EmotionEngine.process_frame()` via WebSocket stream |
| `+TranscrireParole()` | Rename | `+transcribe()` — Whisper via `services/transcription.py` |
| `+GenererAnalyseIA()` | Rename | `+generateAIAnalysis()` — HuggingFace Qwen2.5-72B via `utils/interview_analyzer.py` |

---

### 4.13 `Quiz`

> **Source file**: `backend/models/quiz.py` — MongoDB collection: `quizzes`

| Diagram Field | Action | Corrected Value |
|---|---|---|
| `UUID id` | Note | Auto-generated MongoDB `ObjectId` |
| `String Titre` | Rename | `title: str` |
| `Integer DureeMinutes` | Rename | `duration_minutes: int` (range: 1–180) |
| `String statut` | Rename | `status: QuizStatus` — enum: `"draft"`, `"published"`, `"archived"`, `"completed"` |
| `Float score: Float` | ❌ **Remove** | Score is stored on `Candidature.quiz_score`, NOT on `Quiz` |
| `Dict repartitionDifficulte` | Rename | `difficulty_distribution: Dict[str, int]` — keys: `"easy"`, `"medium"`, `"hard"` |
| `List questions` | Rename | `questions: List[QuizQuestion]` — **Composition** |
| — | ➕ Add | `document_id: str` (FK → QuizDocument) |
| — | ➕ Add | `application_id: Optional[str]` (FK → Candidature) |
| — | ➕ Add | `company_id: Optional[str]` (FK → Entreprise) |
| — | ➕ Add | `generated_by: str`, `generated_at: datetime` |
| — | ➕ Add | `started_at: Optional[datetime]`, `deadline: Optional[str]` |
| — | ➕ Add | `source_chunk_ids: List[str]` (FK[] → QuizChunk) |
| — | ➕ Add | `template_id: Optional[str]` (FK → QuizTemplate) |
| **Link to Candidat** | ❌ **WRONG** | Link is to `Candidature` via `application_id`, NOT directly to `Candidat` |
| `+Generer()` | Rename | `+generate()` — `services/quiz/generation.py` |
| `+GenererQuestion()` | Rename | `+generateQuestion()` |
| `+Publier()` | Rename | `+publish()` |
| `+Demarrer()` | Rename | `+start()` |
| `+SoumettreReponses()` | Rename | `+submitAnswers()` |
| `+CalculerScoreIntelligent()` | Rename | `+calculateScore()` — also triggers `AIMatchingService.evaluateQuizPerformance()` |

---

### 4.14 `Notification`

> **Source file**: `backend/models/notification.py` — MongoDB collection: `notifications`

| Diagram Field | Action | Corrected Value |
|---|---|---|
| `UUID id` | Note | Auto-generated MongoDB `ObjectId` |
| `String type` | ✅ Keep | Values: `"info"`, `"success"`, `"warning"`, `"error"` |
| `String categorie` | Rename | `category: str` — values: `"quiz"`, `"application"`, `"system"` |
| `String titre` | Rename | `title: str` |
| `String message` | ✅ Keep | |
| `Boolean estLue` | Rename | `is_read: bool` |
| — | ➕ Add | `user_id: str` (FK → Utilisateur) |
| — | ➕ Add | `link: Optional[str]` |
| — | ➕ Add | `metadata: Dict[str, Any]` |
| — | ➕ Add | `created_at: datetime` |
| `+Envoyer()` | ⚠️ Move | Utility function `utils/notifications.py::create_notification()` — not a method on the entity |
| `+MarquerCommeLue()` | ✅ Keep | Valid entity operation |

---

## 5. Missing Entities (Must Add)

---

### 5.1 `QuizDocument`

> **Source**: `backend/models/quiz.py:68` — MongoDB collection: `quiz_documents`

```
QuizDocument  {stored in: quiz_documents}
──────────────────────────────────────────────
id: ObjectId
title: str
filename: str
file_type: FileType            ← enum: "pdf" | "docx" | "pptx" | "image"
gridfs_file_id: Optional[str]
uploaded_by: str               ← user ID of uploader
company_id: Optional[str]      ← FK → Entreprise
uploaded_at: datetime
status: DocumentStatus         ← enum: "processing" | "ready" | "error"
total_chunks: int
total_tokens: int
sections: List[SectionInfo]    ← [{title, start_chunk, end_chunk}]
metadata: DocumentMetadata     ← {page_count, language, category}
──────────────────────────────────────────────
+upload()
+process()                     ← chunking + embedding via services/quiz/ingestion.py
+getStatus(): DocumentStatus
```

**Relationships**:
- `Entreprise (1) → (0..*) QuizDocument` — Aggregation ◇
- `QuizDocument (1) ◆→ (1..*) QuizChunk` — Composition

---

### 5.2 `QuizChunk`

> **Source**: `backend/models/quiz.py:86` — MongoDB collection: `quiz_chunks`

```
QuizChunk  {stored in: quiz_chunks}
──────────────────────────────────────────────
id: ObjectId
document_id: str               ← FK → QuizDocument
chunk_index: int
text: str
token_count: int
section: str
embedding: Optional[List[float]]  ← 768-dim vector for $vectorSearch
usage_count: int
last_used_at: Optional[datetime]
question_types_generated: List[str]
created_at: datetime
──────────────────────────────────────────────
+generateEmbedding()           ← services/quiz/embeddings.py
+search(queryVector)           ← vector similarity retrieval
```

**Relationships**:
- `QuizDocument (1) ◆→ (1..*) QuizChunk` — Composition
- `QuizChunk (0..*) ↔ (0..*) QuizQuestion` — Association (via `QuizQuestion.source_chunks[]`)

---

### 5.3 `QuizQuestion`

> **Source**: `backend/models/quiz.py:102` — stored as **embedded documents** in `quizzes.questions[]`

```
QuizQuestion  {embedded in: Quiz.questions[]}
──────────────────────────────────────────────
id: str                        ← format: "q_<hex8>"
type: QuestionType             ← enum: "mcq" | "tf" | "scenario" | "fill_in"
difficulty: Difficulty         ← enum: "easy" | "medium" | "hard"
question: str
options: Optional[List[str]]   ← MCQ only (4 choices)
correct_index: Optional[int]   ← MCQ only
correct_answer: Optional[Any]  ← TF (bool) or fill_in (str)
explanation: str
source_chunks: List[str]       ← FK[] → QuizChunk._id
rubric: Optional[str]          ← scenario type only
```

**Relationship**: `Quiz (1) ◆→ (1..*) QuizQuestion` — Composition (embedded)

---

### 5.4 `InterviewProposal`

> **Source**: `backend/models/interview.py:32` — MongoDB collection: `hr_interview_proposals`

```
InterviewProposal  {stored in: hr_interview_proposals}
──────────────────────────────────────────────────────
id: ObjectId
application_id: str            ← FK → Candidature
company_id: Optional[str]      ← FK → Entreprise
candidate_name: str
candidate_email: str
slots: List[datetime]          ← candidate chooses one
duration_minutes: int          ← default: 45
interview_type: str            ← "Video call" | "Phone call" | "In-person"
message: Optional[str]
recruiter_id: Optional[str]    ← FK → ProfilRH
status: str                    ← "pending" | "confirmed" | "expired"
created_at: datetime
──────────────────────────────────────────────────────
+confirm(selected_slot: datetime): Entretien
+expire()
```

**Relationships**:
- `Candidature (1) → (0..*) InterviewProposal` — Association
- `InterviewProposal (1) → (0..1) Entretien` — Association (when confirmed)

---

### 5.5 `AIAutomationConfig`

> **Source**: `backend/models/job.py:59` — embedded in `OffreEmploi` document (Composition)

```
AIAutomationConfig  {embedded in: OffreEmploi}
──────────────────────────────────────────────
enabled: bool
trigger_mode: str              ← "deadline" | "manual" | "both"
execution_enabled: bool

vector_filter: AIAutomationFilter
  ├── enabled: bool
  └── top_x_candidates: Optional[int]   ← Phase 1: vector search selects top X

ai_score_filter: AIAutomationFilter
  ├── enabled: bool
  └── top_y_candidates: Optional[int]   ← Phase 2: LLM re-ranks to top Y

quiz_stage: AIAutomationQuizStage
  ├── enabled: bool
  ├── approve_top_z_to_interview: Optional[int]  ← Phase 3: quiz selects top Z
  └── quizzes: List[AIAutomationQuizConfig]
       ├── title: str
       ├── document_id: str             ← FK → QuizDocument
       ├── total_questions: int
       ├── duration_minutes: int
       ├── weight_percentage: int
       ├── difficulty_mix: Dict[str, float]
       ├── deadline_mode: str
       └── deadline_at: str
```

**Invariant**: `top_x > top_y > top_z` (enforced by Pydantic `@model_validator`).

**Relationship**: `OffreEmploi (1) ◆→ (0..1) AIAutomationConfig` — Composition

---

### 5.6 `AIMatchingService` `<<service>>`

> **Source**: `backend/services/ai_matching.py` — not a persistent entity, a stateless service class

```
<<service>>
AIMatchingService
──────────────────────────────────────────────────────
- db: AsyncIOMotorDatabase
- client: httpx.AsyncClient

+extractTextForEmbedding(profile: Dict): str
+generateEmbedding(text: str): List[float]      ← Ollama nomic-embed-text (768-dim)
+vectorizeAndSaveProfile(profile_id: str): bool ← writes embedding to candidates collection
+findTopCandidatesForJob(job_description: str, limit: int): List[Dict]
    └── uses MongoDB $vectorSearch (Atlas index: "default", path: "embedding")
+evaluateCandidateWithLLM(job_description: str, candidate: Dict): Dict
    └── returns {score: int (0-100), justification: str}
+evaluateQuizPerformance(quiz: Dict, application: Dict): str
    └── cross-checks answers against source QuizChunks + candidate profile_snapshot
```

**Notes**:
- Phase 1 (vector) selects top `X` candidates; threshold: cosine similarity > 0.60 (adjusted to 0–1 scale).
- Phase 2 (LLM) scores on 3 criteria: Skills (40pts) + Experience (40pts) + Education (20pts).
- Phase 3 (quiz) evaluates correctness + integrity detection (fraud signals).

---

## 6. Architectural Recommendations

### 6.1 Fix Inheritance → Role Discriminator — Priority: CRITICAL

**Problem**: `Admin`, `ChefDepartement`, `Recruteur` are shown as subclasses. Codebase uses a **flat single-collection pattern** with a `role` string field.

**Fix**: Delete the three inheritance arrows. Replace with a single concrete class `ProfilRH` stereotyped with its three possible roles shown via `<<role>>` notes or a table. The only real technical inheritance in the backend is Pydantic `MongoBaseModel → ProfileBase`, which is a framework-level detail not worth showing in the domain UML.

---

### 6.2 Remove Auth Methods from Entity Classes — Priority: HIGH

`+SeConnecter()` and `+SeDeconnecter()` do not exist anywhere in the backend Python code. Authentication is 100% client-side (Supabase JavaScript SDK). Remove both from `Utilisateur`.

---

### 6.3 Fix `Quiz → Candidat` Link — Priority: HIGH

The diagram draws a direct association from `Quiz` to `Candidat`. The actual foreign key is `Quiz.application_id → Candidature._id`. The correct chain is:

```
Candidat --submits--> Candidature --hasQuizzes--> Quiz
```

Remove the direct `Quiz → Candidat` link. Scores (`quiz_score`, `ai_score`) reside on `Candidature`, not on `Candidat` or `Quiz`.

---

### 6.4 Relocate Score Fields — Priority: HIGH

| Field | Current diagram location | Correct location |
|---|---|---|
| `quiz_score` | `Candidature` ✅ | `Candidature` (correct) |
| `ai_score` (LLM score) | `Candidature` as `scoreLLM` ✅ | `Candidature` (correct, rename) |
| `scoreCNN` | `Candidature` | ❌ **Does not exist on Candidature** — remove |
| `overall_score` (interview) | — | `Entretien.ai_analysis.overall_score` |
| `score` (quiz) | `Quiz` as `score: Float` | ❌ **Remove from Quiz** |

---

### 6.5 Remove `Entreprise.ConfigIA` — Priority: MEDIUM

No AI configuration field exists on the `Entreprise`/`CompanyBase` model. The AI pipeline is configured per-job via `OffreEmploi.ai_automation: AIAutomationConfig`.

---

### 6.6 Fix `Entretien` → `Candidature` Link — Priority: MEDIUM

The diagram shows `Entretien` linked to `Candidat` via `+Rejoidre`. The correct structural foreign key is `Entretien.application_id → Candidature._id`. The `candidate_name` and `candidate_email` fields on `Entretien` are denormalized snapshots, not relational links.

---

### 6.7 Enforce snake_case Throughout — Priority: MEDIUM

The backend uses `snake_case` for all MongoDB fields and Python attributes, with the sole exception of the `AccountSetupData` candidate model which retains `camelCase` due to the legacy CV parser format.

Replace all PascalCase field names in the diagram (e.g., `Titre`, `Description`, `Statut`, `DateCandidature`, `TypeEntretien`) with their `snake_case` equivalents. A general rule: if a field appears in a Python Pydantic model, its name is the correct canonical form.

---

## 7. Casing Reference Table

| Diagram (wrong) | Code (correct) | Class |
|---|---|---|
| `Titre` | `title` | OffreEmploi, Quiz |
| `Description` | `description` | OffreEmploi, Entreprise |
| `Statut` | `status` | All entities |
| `DateCandidature` | `applied_at` | Candidature |
| `DateEntretien` | `start_time` / `end_time` | Entretien |
| `TypeEntretien` | `type` | Entretien |
| `TypeContrat` | `type` | OffreEmploi |
| `meetingLink` | `meeting_link` | Entretien |
| `estLue` | `is_read` | Notification |
| `categorie` | `category` | Notification |
| `titre` | `title` | Notification |
| `scoreLLM` | `ai_score` | Candidature |
| `justificationLLM` | `ai_justification` | Candidature |
| `scoreQuiz` | `quiz_score` | Candidature |
| `analyseIA` | `ai_analysis` | Entretien |
| `historiqueEmotions` | `emotion_history` | Entretien |
| `repartitionDifficulte` | `difficulty_distribution` | Quiz |
| `DureeMinutes` | `duration_minutes` | Quiz |
| `niveauExperience` | `experience_level` | OffreEmploi |
| `modeTravail` | `work_mode` | OffreEmploi |
| `competencesRequises` | `requirements` | OffreEmploi |
| `ProfileCandidat` | (expand to explicit fields) | Candidat |
| `ProfileEntreprise` | (expand to explicit fields) | Entreprise |
| `ConfigIA` | ❌ remove | Entreprise |

---

## 8. Bugs Found in Source Code

| # | File | Line | Issue | Severity |
|---|---|---|---|---|
| 1 | `backend/models/job.py` | 113 | `benfits: Optional[List[str]]` — typo duplicate of `benefits`. Dead field, causes confusion. | Medium |
| 2 | `backend/middleware/auth.py` | 137 | `datetime.utcnow()` called without importing `datetime` at module level — only imported inside nested block. Fragile at refactor. | Low |
| 3 | `backend/routers/applications.py` | 434 | `quizzes_by_application` referenced outside the `if application_ids:` block — raises `UnboundLocalError` when `application_ids` is empty. | High |

---

## 9. Change Impact Summary

### Additions

| Entity | Type | Priority |
|---|---|---|
| `QuizDocument` | Full entity class | P1 — Critical for AI Quiz pipeline |
| `QuizChunk` | Full entity class | P1 — Critical for vector search |
| `QuizQuestion` | Embedded class | P1 — Currently invisible in diagram |
| `InterviewProposal` | Full entity class | P2 — Proposal→Confirm workflow missing |
| `AIAutomationConfig` | Composed class | P2 — Core automation pipeline |
| `AIMatchingService` | `<<service>>` class | P3 — Architecture clarity |

### Removals

| Element | From | Reason |
|---|---|---|
| `motDePasse` field | `Utilisateur` | Managed by Supabase |
| `+SeConnecter()` | `Utilisateur` | Client-side only |
| `+SeDeconnecter()` | `Utilisateur` | Client-side only |
| `ConfigIA` field | `Entreprise` | Does not exist in model |
| `scoreCNN / justificationCNN` | `Candidature` | Does not exist in model |
| `score: Float` | `Quiz` | Score is on `Candidature`, not Quiz |
| Direct `Quiz → Candidat` link | Diagram | Wrong — goes through `Candidature` |

### Corrections

| Element | From | To |
|---|---|---|
| `Admin/ChefDept/Recruteur` inheritance | Subclasses of `UtilisateurRH` | Single `ProfilRH` with `role` discriminator |
| `+Manger` relation | ChefDept → Departement | `+manages` (fix typo) |
| Recruteur role string | `"recruteur"` | `"hr"` (actual DB value) |
| All PascalCase field names | 20+ fields | `snake_case` (see §7) |
| `Quiz → Candidat` link | Direct | Via `Candidature` |
| `Entretien → Candidat` link | Via `+Rejoidre` | Via `application_id → Candidature` |

---

*End of audit. All findings verified against backend source as of 2026-05-17.*
