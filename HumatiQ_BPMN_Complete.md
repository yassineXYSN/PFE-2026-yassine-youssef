# HumatiQ — Complete End-to-End Process BPMN Diagrams

> Render with [Markdown Viewer](https://docu.md) (Chrome/Edge/Firefox/VS Code) or any PlantUML renderer.  
> Each diagram covers one major phase of the HumatiQ AI-powered recruitment platform.

---

## Diagram 1 — Authentication & Onboarding

Covers: Candidate sign-up (Email / OAuth), email verification, optional 2FA setup (TOTP or Email),
CV upload → LLM parsing → profile enrichment → account setup completion.

```plantuml
@startuml Auth_Onboarding
left to right direction
title HumatiQ — Phase 1: Authentication & Onboarding

' ── CANDIDATE ────────────────────────────────────────
package "Candidate / End-User" {
  mxgraph.bpmn.event.start "Arrive at\nPlatform" as c_start
  rectangle "Select\nAuth Method" as c_select_auth
  mxgraph.bpmn.gateway2.exclusive "Auth\nMethod?" as c_auth_gw
  rectangle "OAuth Login\n(Google / LinkedIn\n/ GitHub)" as c_oauth
  rectangle "Enter Email\n& Password" as c_email_pw
  rectangle "Verify\nEmail Address" as c_verify_email
  mxgraph.bpmn.gateway2.exclusive "Email\nVerified?" as c_email_gw
  mxgraph.bpmn.gateway2.exclusive "2FA\nEnabled?" as c_2fa_gw
  rectangle "Choose 2FA Method\n(TOTP or Email)" as c_2fa_choose
  rectangle "Scan QR Code /\nEnter Setup Token" as c_2fa_setup
  rectangle "Enter\n2FA Code" as c_2fa_enter
  mxgraph.bpmn.gateway2.exclusive "2FA Code\nValid?" as c_2fa_valid_gw
  rectangle "Upload CV\n(PDF / DOCX / DOC)" as c_upload_cv
  rectangle "Review Auto-Parsed\nProfile Data" as c_review_parsed
  rectangle "Fill Additional Info\n(Bio, Languages,\nHobbies, Certificates)" as c_fill_info
  rectangle "Set Target\nJob Profile" as c_set_target
  rectangle "Submit\nAccount Setup" as c_submit_setup
  mxgraph.bpmn.gateway2.exclusive "Profile\nComplete?" as c_profile_gw
  mxgraph.bpmn.event.end "Onboarding\nComplete" as c_end_ok
  mxgraph.bpmn.event.errorEnd "Auth\nFailed" as c_end_fail
}

' ── BACKEND API ──────────────────────────────────────
package "Backend API" {
  rectangle "Verify JWT Token\nvia Supabase" as api_verify_jwt
  mxgraph.bpmn.gateway2.exclusive "Auth Provider\nMatch?" as api_provider_gw
  rectangle "Unlink Foreign\nIdentity" as api_unlink
  rectangle "Return 403\nForbidden" as api_403
  rectangle "Enrich User with\nMongoDB Role & Profile" as api_enrich
  rectangle "Extract Raw Text\n(PyMuPDF / python-docx\n/ pytesseract)" as api_extract_text
  rectangle "Build LLM Prompt\nfor CV Parsing" as api_build_prompt
  rectangle "Send Structured\nJSON to Frontend" as api_return_parsed
  mxgraph.bpmn.gateway2.exclusive "Parse\nSuccessful?" as api_parse_gw
  rectangle "Structure Profile:\nSkills, Experience,\nEducation, Languages" as api_structure_profile
  rectangle "Store Candidate\nin MongoDB" as api_store_candidate
  rectangle "Compute Profile\nStrength Score (0–100)" as api_profile_strength
  rectangle "Store Final\nAccount Setup Data" as api_store_setup
}

' ── AI SERVICES ──────────────────────────────────────
package "AI / External Services" {
  rectangle "Supabase Auth\n(OAuth / Email)" as ai_supabase
  rectangle "Ollama LLM\nqwen3:8b\n(CV Parsing)" as ai_llm_cv
}

' ── DATABASE ─────────────────────────────────────────
package "Database / Storage" {
  mxgraph.bpmn.data2.dataObject "Supabase Auth\nStore" as db_supabase
  mxgraph.bpmn.data2.dataObject "candidates\ncollection" as db_candidates
  mxgraph.bpmn.data2.dataObject "Local File\nStorage\nstatic/uploads/" as db_files
}

' ── SEQUENCE FLOWS ───────────────────────────────────
c_start --> c_select_auth
c_select_auth --> c_auth_gw
c_auth_gw --> c_oauth : "Social"
c_auth_gw --> c_email_pw : "Email"
c_oauth ..> ai_supabase
c_email_pw ..> ai_supabase
ai_supabase ..> db_supabase
ai_supabase ..> api_verify_jwt
api_verify_jwt --> api_provider_gw
api_provider_gw --> api_unlink : "Mismatch"
api_unlink --> api_403
api_provider_gw --> api_enrich : "OK"

c_oauth --> c_verify_email
c_email_pw --> c_verify_email
c_verify_email --> c_email_gw
c_email_gw --> c_2fa_gw : "Verified"
c_email_gw --> c_end_fail : "Failed"

c_2fa_gw --> c_2fa_choose : "Enable 2FA"
c_2fa_gw --> c_upload_cv : "Skip"
c_2fa_choose --> c_2fa_setup
c_2fa_setup --> c_2fa_enter
c_2fa_enter --> c_2fa_valid_gw
c_2fa_valid_gw --> c_upload_cv : "Valid"
c_2fa_valid_gw --> c_2fa_enter : "Retry"

c_upload_cv ..> api_extract_text
c_upload_cv ..> db_files
api_extract_text --> api_build_prompt
api_build_prompt ..> ai_llm_cv
ai_llm_cv ..> api_build_prompt
api_build_prompt --> api_parse_gw
api_parse_gw --> api_structure_profile : "Success"
api_parse_gw --> api_build_prompt : "Retry"
api_structure_profile --> api_return_parsed
api_return_parsed ..> c_review_parsed

c_review_parsed --> c_fill_info
c_fill_info --> c_set_target
c_set_target --> c_submit_setup
c_submit_setup ..> api_store_candidate
api_store_candidate ..> db_candidates
api_store_candidate --> api_store_setup
api_store_setup --> api_profile_strength
api_profile_strength ..> c_submit_setup
c_submit_setup --> c_profile_gw
c_profile_gw --> c_end_ok : "Complete"
c_profile_gw --> c_fill_info : "Incomplete"

@enduml
```

---

## Diagram 2 — Job Posting & AI Automation Configuration

Covers: HR creates a job, optionally enables AI automation (vector filter → LLM score filter → quiz stage),
uploads quiz source documents, sets deadline, and publishes the job.

```plantuml
@startuml Job_Posting
left to right direction
title HumatiQ — Phase 2: Job Posting & AI Automation Configuration

' ── RECRUITER / HR ADMIN ─────────────────────────────
package "Recruiter / HR Admin" {
  mxgraph.bpmn.event.start "Start: Create\nJob Posting" as hr_start
  rectangle "Fill Job Details\n(Title, Description,\nLocation, Type)" as hr_fill_job
  rectangle "Set Requirements,\nBenefits, Missions,\nSalary Range" as hr_set_req
  rectangle "Configure AI\nAutomation Settings" as hr_ai_config
  mxgraph.bpmn.gateway2.exclusive "Enable AI\nAutomation?" as hr_ai_gw
  rectangle "Set Vector Filter\n(Top X Candidates\nby Embedding Similarity)" as hr_vector_filter
  rectangle "Set AI Score Filter\n(Top Y Candidates\nby LLM Score)" as hr_ai_score_filter
  mxgraph.bpmn.gateway2.exclusive "Enable\nQuiz Stage?" as hr_quiz_stage_gw
  rectangle "Configure Quiz Stage\n(Top Z → Interview)" as hr_quiz_config
  rectangle "Define Quiz Parameters\n(Questions, Duration,\nDifficulty Mix, Deadline)" as hr_quiz_params
  rectangle "Upload Quiz\nSource Documents\n(PDF / DOCX)" as hr_upload_docs
  rectangle "Set Job\nDeadline" as hr_set_deadline
  rectangle "Set Notification\nEmail" as hr_set_email
  rectangle "Publish\nJob Posting" as hr_publish
  mxgraph.bpmn.event.end "Job\nPublished" as hr_end
}

' ── BACKEND API ──────────────────────────────────────
package "Backend API" {
  rectangle "Validate Job\nPayload" as api_validate_job
  rectangle "Create Job\nRecord in MongoDB" as api_create_job
  rectangle "Attach AI Automation\nConfig to Job" as api_attach_ai
  rectangle "Receive Document\nUpload (Multipart)" as api_recv_doc
  rectangle "Chunk Document\ninto Sections" as api_chunk_doc
  rectangle "Send Chunks to\nEmbedding Model\n(12 concurrent)" as api_embed_chunks
  rectangle "Store Chunks +\nVectors in MongoDB" as api_store_chunks
  rectangle "Mark Document\nReady for RAG" as api_doc_ready
  rectangle "Broadcast Job to\nCandidate Job Feed" as api_broadcast_job
}

' ── AI SERVICES ──────────────────────────────────────
package "AI / External Services" {
  rectangle "nomic-embed-text\n(Ollama Embeddings\n12 concurrent)" as ai_embed_model
}

' ── DATABASE ─────────────────────────────────────────
package "Database / Storage" {
  mxgraph.bpmn.data2.dataObject "hr_jobs\ncollection" as db_jobs
  mxgraph.bpmn.data2.dataObject "quiz_documents\n+ quiz_chunks\n(vectors)" as db_quiz_chunks
  mxgraph.bpmn.data2.dataObject "Local File\nStorage" as db_files
}

' ── SEQUENCE FLOWS ───────────────────────────────────
hr_start --> hr_fill_job
hr_fill_job --> hr_set_req
hr_set_req --> hr_ai_config
hr_ai_config --> hr_ai_gw
hr_ai_gw --> hr_vector_filter : "Yes"
hr_ai_gw --> hr_set_deadline : "No"
hr_vector_filter --> hr_ai_score_filter
hr_ai_score_filter --> hr_quiz_stage_gw
hr_quiz_stage_gw --> hr_quiz_config : "Yes"
hr_quiz_stage_gw --> hr_set_deadline : "No"
hr_quiz_config --> hr_quiz_params
hr_quiz_params --> hr_upload_docs

hr_upload_docs ..> api_recv_doc
hr_upload_docs ..> db_files
api_recv_doc --> api_chunk_doc
api_chunk_doc --> api_embed_chunks
api_embed_chunks ..> ai_embed_model
ai_embed_model ..> api_embed_chunks
api_embed_chunks --> api_store_chunks
api_store_chunks ..> db_quiz_chunks
api_store_chunks --> api_doc_ready
api_doc_ready ..> hr_upload_docs

hr_upload_docs --> hr_set_deadline
hr_set_deadline --> hr_set_email
hr_set_email --> hr_publish
hr_publish ..> api_validate_job
api_validate_job --> api_create_job
api_create_job --> api_attach_ai
api_attach_ai ..> db_jobs
api_attach_ai --> api_broadcast_job
api_broadcast_job --> hr_end

@enduml
```

---

## Diagram 3 — Candidate Application & AI Screening Pipeline

Covers: Candidate browses jobs (with CNN AI match scores), submits application, and the
deadline-triggered AI automation pipeline (Vector Search → LLM Scoring → Quiz Deployment).

```plantuml
@startuml Application_Pipeline
left to right direction
title HumatiQ — Phase 3: Candidate Application & AI Automation Pipeline

' ── CANDIDATE ────────────────────────────────────────
package "Candidate / End-User" {
  mxgraph.bpmn.event.start "Browse\nJob Listings" as c_start
  rectangle "Apply Filters\n(Type, Location,\nSalary, Remote)" as c_filter
  rectangle "View Job Detail\n+ AI Match Score" as c_view_job
  mxgraph.bpmn.gateway2.exclusive "Already\nApplied?" as c_already_gw
  rectangle "Save Job\nfor Later" as c_save_job
  mxgraph.bpmn.gateway2.exclusive "Apply or\nSave?" as c_apply_save_gw
  rectangle "Write Motivation\nLetter (Optional)" as c_motivation
  rectangle "Submit\nApplication" as c_apply
  mxgraph.bpmn.event.messageEnd "Application\nSubmitted" as c_end_apply
}

' ── RECRUITER / HR ADMIN ─────────────────────────────
package "Recruiter / HR Admin" {
  rectangle "View Application\nPipeline Board" as hr_pipeline
  rectangle "Monitor Candidate\nAI Scores" as hr_monitor_scores
  mxgraph.bpmn.gateway2.exclusive "Manual Review\nNeeded?" as hr_manual_gw
  rectangle "View Candidate\nProfile + CV" as hr_view_profile
  rectangle "Update Application\nStatus (Shortlist /\nReject / Interview)" as hr_update_status
  mxgraph.bpmn.event.end "Pipeline\nUpdated" as hr_end
}

' ── BACKEND API ──────────────────────────────────────
package "Backend API" {
  rectangle "Compute AI Match\nScore via CNN Model" as api_ai_match
  rectangle "Check Existing\nApplication" as api_check_app
  rectangle "Create Application\nRecord + Profile Snapshot" as api_create_app
  rectangle "Send Application\nReceived Email" as api_app_email

  mxgraph.bpmn.event.timerStart "Deadline Scheduler\n(polls every 60s)" as api_scheduler
  mxgraph.bpmn.gateway2.exclusive "Job Deadline\nReached?" as api_deadline_gw
  mxgraph.bpmn.gateway2.exclusive "AI Automation\nEnabled?" as api_ai_enabled_gw
  rectangle "Lock Job for\nAutomation Processing" as api_lock_job

  rectangle "Stage 1 — Vector Search:\nFind Top X Candidates\nby Embedding Similarity" as api_stage1_vector
  rectangle "Retrieve Candidate\nEmbedding Vectors" as api_get_vectors

  rectangle "Stage 2 — LLM Scoring:\nAnalyze & Score Top X\nApplicants (3 concurrent)" as api_stage2_llm
  rectangle "Update Application\nai_score Fields" as api_update_scores

  mxgraph.bpmn.gateway2.exclusive "Quiz Stage\nConfigured?" as api_quiz_stage_gw
  rectangle "Stage 3 — Quiz:\nDeploy Quizzes to\nTop Y Candidates" as api_stage3_quiz
  rectangle "Send Quiz Assignment\nNotifications" as api_quiz_notif
  rectangle "Mark Job Deadline\nProcessed" as api_mark_done

  rectangle "Send Weekly\nReport to HR" as api_weekly_report
  mxgraph.bpmn.event.timerStart "Weekly Report\nScheduler (1h)" as api_weekly_scheduler
}

' ── AI SERVICES ──────────────────────────────────────
package "AI / External Services" {
  rectangle "Modele-CNN\n(Local PyTorch)\nSkill-Profile Match" as ai_cnn
  rectangle "MongoDB Atlas\nVector Search Index" as ai_vector_search
  rectangle "Ollama LLM\nqwen3:8b\n(3 concurrent)" as ai_llm_score
  rectangle "Gmail SMTP\nEmail Service" as ai_smtp
}

' ── DATABASE ─────────────────────────────────────────
package "Database / Storage" {
  mxgraph.bpmn.data2.dataObject "hr_jobs\ncollection" as db_jobs
  mxgraph.bpmn.data2.dataObject "job_applications\ncollection" as db_applications
  mxgraph.bpmn.data2.dataObject "candidates\n(embedding_vector)" as db_candidates
  mxgraph.bpmn.data2.dataObject "notifications\ncollection" as db_notifs
}

' ── SEQUENCE FLOWS ───────────────────────────────────

' Candidate job browsing
c_start --> c_filter
c_filter --> c_view_job
c_view_job ..> api_ai_match
api_ai_match ..> ai_cnn
ai_cnn ..> api_ai_match
api_ai_match ..> c_view_job
c_view_job --> c_already_gw
c_already_gw --> c_apply_save_gw : "No"
c_already_gw --> c_view_job : "Yes (View)"
c_apply_save_gw --> c_save_job : "Save"
c_apply_save_gw --> c_motivation : "Apply"
c_motivation --> c_apply
c_apply ..> api_check_app
api_check_app --> api_create_app
api_create_app ..> db_applications
api_create_app --> api_app_email
api_app_email ..> ai_smtp
c_apply --> c_end_apply

' Deadline automation scheduler
api_scheduler --> api_deadline_gw
api_deadline_gw --> api_ai_enabled_gw : "Deadline Hit"
api_deadline_gw --> api_scheduler : "Not Yet"
api_ai_enabled_gw --> api_lock_job : "Yes"
api_ai_enabled_gw --> api_mark_done : "No"

' Stage 1: Vector Search
api_lock_job --> api_stage1_vector
api_stage1_vector --> api_get_vectors
api_get_vectors ..> db_candidates
api_get_vectors ..> ai_vector_search
ai_vector_search ..> api_stage1_vector

' Stage 2: LLM Scoring
api_stage1_vector --> api_stage2_llm
api_stage2_llm ..> ai_llm_score
ai_llm_score ..> api_stage2_llm
api_stage2_llm --> api_update_scores
api_update_scores ..> db_applications
api_update_scores ..> hr_monitor_scores

' Stage 3: Quiz or Done
api_update_scores --> api_quiz_stage_gw
api_quiz_stage_gw --> api_stage3_quiz : "Yes"
api_quiz_stage_gw --> api_mark_done : "No"
api_stage3_quiz ..> db_applications
api_stage3_quiz --> api_quiz_notif
api_quiz_notif ..> db_notifs
api_quiz_notif --> api_mark_done
api_mark_done ..> db_jobs

' Weekly report
api_weekly_scheduler --> api_weekly_report
api_weekly_report ..> ai_smtp

' HR pipeline monitoring
hr_monitor_scores --> hr_pipeline
hr_pipeline --> hr_manual_gw
hr_manual_gw --> hr_view_profile : "Yes"
hr_manual_gw --> hr_monitor_scores : "Wait AI"
hr_view_profile --> hr_update_status
hr_update_status ..> db_applications
hr_update_status --> hr_end

@enduml
```

---

## Diagram 4 — Quiz Generation & Assessment (RAG Pipeline)

Covers: RAG-based quiz generation (vector chunk retrieval → LLM question generation),
candidate takes timed quiz, LLM evaluates answers, HR reviews results and makes screening decision.

```plantuml
@startuml Quiz_Assessment
left to right direction
title HumatiQ — Phase 4: Quiz Generation & Assessment (RAG Pipeline)

' ── CANDIDATE ────────────────────────────────────────
package "Candidate / End-User" {
  mxgraph.bpmn.event.messageStart "Receive Quiz\nAssignment\nNotification" as c_quiz_notify
  rectangle "Open Quiz\nSession" as c_open_quiz
  mxgraph.bpmn.event.timerCatching "Quiz Timer\nRunning" as c_quiz_timer
  rectangle "Read Question\n& Options" as c_read_question
  rectangle "Select Answer" as c_select_answer
  mxgraph.bpmn.gateway2.exclusive "More\nQuestions?" as c_more_gw
  mxgraph.bpmn.gateway2.exclusive "Timer\nExpired?" as c_timer_gw
  rectangle "Submit\nQuiz Answers" as c_submit_quiz
  mxgraph.bpmn.event.end "Quiz\nSubmitted" as c_end_submitted
}

' ── RECRUITER / HR ADMIN ─────────────────────────────
package "Recruiter / HR Admin" {
  rectangle "View Quiz\nResults Dashboard" as hr_view_results
  rectangle "Review LLM\nEvaluation Analysis" as hr_view_analysis
  rectangle "Review Per-Question\nBreakdown" as hr_question_breakdown
  mxgraph.bpmn.gateway2.exclusive "Advance to\nInterview?" as hr_advance_gw
  rectangle "Shortlist\nCandidate" as hr_shortlist
  rectangle "Reject\nCandidate" as hr_reject
  mxgraph.bpmn.event.end "Screening\nDecision Made" as hr_end
}

' ── BACKEND API ──────────────────────────────────────
package "Backend API" {
  rectangle "Receive Quiz\nAssignment Trigger\n(from AI Automation)" as api_assign_trigger
  rectangle "Load Quiz Template\n& Config (duration,\ndifficulty mix)" as api_load_template

  rectangle "Vector Search:\nFind Top-K Relevant\nDocument Chunks" as api_vector_chunks
  rectangle "Assemble Context\nWindow from Chunks" as api_assemble_ctx
  rectangle "Build LLM Prompt:\nContext + Difficulty\n+ Question Count" as api_build_quiz_prompt
  rectangle "Generate Questions\nvia LLM (qwen3:8b)" as api_gen_questions
  mxgraph.bpmn.gateway2.exclusive "Questions\nValid?" as api_questions_valid_gw
  rectangle "Store Generated\nQuiz in MongoDB" as api_store_quiz
  rectangle "Send Quiz Link\nto Candidate (Email)" as api_send_quiz_link

  rectangle "Receive Quiz\nSubmission Payload" as api_recv_submission
  rectangle "Load Correct Answers\n& Quiz Rubric" as api_load_rubric
  rectangle "Build Evaluation\nPrompt (Answers +\nRubric + Context)" as api_build_eval_prompt
  rectangle "Send to LLM\nfor Grading &\nAnalysis" as api_llm_grade
  rectangle "Parse Score (0–100)\n& AI Analysis Text" as api_parse_result
  rectangle "Store quiz_score\n+ quiz_ai_analysis\nin Application" as api_store_score
  mxgraph.bpmn.gateway2.exclusive "Score ≥\nPass Threshold?" as api_threshold_gw
  rectangle "Set quiz_status\n= completed\n→ Flag Interview" as api_flag_interview
  rectangle "Set quiz_status\n= failed" as api_flag_fail
  rectangle "Notify HR of\nQuiz Results" as api_notify_hr_quiz
}

' ── AI SERVICES ──────────────────────────────────────
package "AI / External Services" {
  rectangle "MongoDB Atlas\nVector Search\n(quiz_chunks_vector_index)" as ai_vector
  rectangle "Ollama LLM\nqwen3:8b\n(3 concurrent)\nGeneration" as ai_llm_gen
  rectangle "Ollama LLM\nqwen3:8b\n(3 concurrent)\nEvaluation" as ai_llm_eval
  rectangle "Gmail SMTP\nEmail Service" as ai_smtp
}

' ── DATABASE ─────────────────────────────────────────
package "Database / Storage" {
  mxgraph.bpmn.data2.dataObject "quiz_chunks\n(text + embedding)" as db_chunks
  mxgraph.bpmn.data2.dataObject "quizzes\ncollection" as db_quizzes
  mxgraph.bpmn.data2.dataObject "job_applications\n(quiz_score,\nquiz_status,\nquiz_ai_analysis)" as db_applications
}

' ── SEQUENCE FLOWS ───────────────────────────────────

' Quiz Generation (RAG)
api_assign_trigger --> api_load_template
api_load_template --> api_vector_chunks
api_vector_chunks ..> ai_vector
ai_vector ..> db_chunks
ai_vector ..> api_vector_chunks
api_vector_chunks --> api_assemble_ctx
api_assemble_ctx --> api_build_quiz_prompt
api_build_quiz_prompt --> api_gen_questions
api_gen_questions ..> ai_llm_gen
ai_llm_gen ..> api_gen_questions
api_gen_questions --> api_questions_valid_gw
api_questions_valid_gw --> api_store_quiz : "Valid"
api_questions_valid_gw --> api_gen_questions : "Regenerate"
api_store_quiz ..> db_quizzes
api_store_quiz --> api_send_quiz_link
api_send_quiz_link ..> ai_smtp
api_send_quiz_link ..> c_quiz_notify

' Candidate takes quiz
c_quiz_notify --> c_open_quiz
c_open_quiz --> c_quiz_timer
c_quiz_timer --> c_read_question
c_read_question --> c_select_answer
c_select_answer --> c_more_gw
c_more_gw --> c_read_question : "Next"
c_more_gw --> c_timer_gw : "All Done"
c_timer_gw --> c_submit_quiz : "Done / Expired"
c_submit_quiz ..> api_recv_submission
c_submit_quiz --> c_end_submitted

' LLM Grading
api_recv_submission --> api_load_rubric
api_load_rubric --> api_build_eval_prompt
api_build_eval_prompt --> api_llm_grade
api_llm_grade ..> ai_llm_eval
ai_llm_eval ..> api_llm_grade
api_llm_grade --> api_parse_result
api_parse_result --> api_store_score
api_store_score ..> db_applications
api_store_score --> api_threshold_gw
api_threshold_gw --> api_flag_interview : "Pass"
api_threshold_gw --> api_flag_fail : "Fail"
api_flag_interview --> api_notify_hr_quiz
api_flag_fail --> api_notify_hr_quiz
api_notify_hr_quiz ..> hr_view_results

' HR Screening Decision
hr_view_results --> hr_view_analysis
hr_view_analysis --> hr_question_breakdown
hr_question_breakdown --> hr_advance_gw
hr_advance_gw --> hr_shortlist : "Yes"
hr_advance_gw --> hr_reject : "No"
hr_shortlist --> hr_end
hr_reject --> hr_end

@enduml
```

---

## Diagram 5 — Interview Lifecycle

Covers: Interview proposal creation (Google Calendar sync), slot selection and confirmation,
WebSocket live interview (faster-whisper transcription + MediaPipe face/emotion analysis),
AI summary generation, and final hiring decision.

```plantuml
@startuml Interview_Lifecycle
left to right direction
title HumatiQ — Phase 5: Interview Lifecycle (Proposal → Live → AI Analysis → Hiring)

' ── CANDIDATE ────────────────────────────────────────
package "Candidate / End-User" {
  mxgraph.bpmn.event.messageStart "Receive Interview\nProposal Email" as c_recv_proposal
  rectangle "View Available\nTime Slots" as c_view_slots
  rectangle "Select Preferred\nInterview Slot" as c_select_slot
  rectangle "Confirm\nSlot Selection" as c_confirm_slot
  mxgraph.bpmn.event.timerCatching "Wait for\nInterview Time" as c_wait_interview
  rectangle "Join Video\nInterview Room\n(WebSocket)" as c_join_room
  rectangle "Participate in\nLive Interview\n(Camera + Mic)" as c_participate
  mxgraph.bpmn.gateway2.exclusive "Interview\nEnded?" as c_end_gw
  mxgraph.bpmn.event.end "Interview\nCompleted" as c_end_ok
  mxgraph.bpmn.event.errorEnd "No-Show\nRecorded" as c_end_noshow
}

' ── RECRUITER / HR ADMIN ─────────────────────────────
package "Recruiter / HR Admin" {
  rectangle "Check Google Calendar\nAvailability (OAuth)" as hr_check_calendar
  rectangle "Create Interview\nProposal with\nAvailable Slots" as hr_create_proposal
  mxgraph.bpmn.gateway2.exclusive "Candidate\nConfirmed Slot?" as hr_confirmed_gw
  rectangle "Send Reminder\nNotification" as hr_send_reminder
  rectangle "Join Interview\nRoom as Recruiter" as hr_join_room
  rectangle "Conduct Live\nInterview" as hr_conduct_interview
  mxgraph.bpmn.gateway2.exclusive "Candidate\nShowed Up?" as hr_noshow_gw
  rectangle "Mark Interview\nas No-Show" as hr_mark_noshow
  rectangle "End Interview\nSession" as hr_end_session
  rectangle "Review AI\nInterview Summary\n(LLM-Generated)" as hr_review_summary
  rectangle "Review Emotion\nAnalysis Timeline\n(joy/anger/fear/neutral)" as hr_review_emotions
  rectangle "Review Full\nInterview Transcript" as hr_review_transcript
  mxgraph.bpmn.gateway2.exclusive "Final Hiring\nDecision?" as hr_hire_gw
  rectangle "Send Offer\nNotification" as hr_send_offer
  rectangle "Mark Application\nas Hired" as hr_mark_hired
  rectangle "Send Rejection\nNotification" as hr_send_rejection
  mxgraph.bpmn.event.end "Candidate\nHired" as hr_end_hired
  mxgraph.bpmn.event.end "Process\nClosed" as hr_end_closed
}

' ── BACKEND API ──────────────────────────────────────
package "Backend API" {
  rectangle "Create Interview\nProposal Record" as api_create_proposal
  rectangle "Send Proposal\nEmail to Candidate" as api_send_proposal_email
  rectangle "Confirm Slot &\nCreate Interview Record" as api_confirm_slot

  mxgraph.bpmn.event.timerStart "Reminder Scheduler\n(polls every 60s)" as api_reminder_scheduler
  rectangle "Send 24h\nReminder Email" as api_reminder_24h
  rectangle "Send 1h\nReminder Email" as api_reminder_1h

  rectangle "Open WebSocket\nRoom" as api_ws_open
  mxgraph.bpmn.gateway2.exclusive "Both Parties\nConnected?" as api_connected_gw
  rectangle "Synchronize\nVideo & Audio Streams" as api_sync_streams

  rectangle "Route Audio Chunks\nto faster-whisper" as api_route_audio
  rectangle "Receive Transcript\nSegment" as api_recv_transcript
  rectangle "Append to\ntranscript[]" as api_append_transcript

  rectangle "Route Video Frames\nto MediaPipe" as api_route_video
  rectangle "Receive Emotion\nAnalysis Result" as api_recv_emotion
  rectangle "Append to\nemotion_history[]" as api_append_emotion

  rectangle "Persist Interview\nState to MongoDB" as api_persist_interview

  rectangle "Close WebSocket\nRoom" as api_ws_close
  rectangle "Generate Interview\nSummary Prompt" as api_build_summary_prompt
  rectangle "Send to LLM\nfor Summary & Scoring" as api_llm_summary
  rectangle "Parse: overall_score,\ncommunication_score,\ntechnical_score,\nstrengths, weaknesses" as api_parse_summary
  rectangle "Store ai_analysis\nin hr_interviews" as api_store_analysis
  rectangle "Update Application\nStatus" as api_update_app_status
}

' ── AI SERVICES ──────────────────────────────────────
package "AI / External Services" {
  rectangle "Google Calendar\nAPI (OAuth2)" as ai_google_cal
  rectangle "faster-whisper\n(CPU / CUDA)\nSpeech-to-Text" as ai_whisper
  rectangle "MediaPipe\nFaceLandmarker.task\nEmotion Detection" as ai_mediapipe
  rectangle "Ollama LLM\nqwen3:8b\nInterview Analysis" as ai_llm_analysis
  rectangle "Gmail SMTP\nEmail Service" as ai_smtp
}

' ── DATABASE ─────────────────────────────────────────
package "Database / Storage" {
  mxgraph.bpmn.data2.dataObject "interview_proposals\ncollection" as db_proposals
  mxgraph.bpmn.data2.dataObject "hr_interviews\n(transcript[],\nemotion_history[],\nai_analysis{})" as db_interviews
  mxgraph.bpmn.data2.dataObject "job_applications\n(status, ai_analysis)" as db_applications
}

' ── SEQUENCE FLOWS ───────────────────────────────────

' Proposal creation
hr_check_calendar ..> ai_google_cal
ai_google_cal ..> hr_check_calendar
hr_check_calendar --> hr_create_proposal
hr_create_proposal ..> api_create_proposal
api_create_proposal ..> db_proposals
api_create_proposal --> api_send_proposal_email
api_send_proposal_email ..> ai_smtp
api_send_proposal_email ..> c_recv_proposal

' Slot confirmation
c_recv_proposal --> c_view_slots
c_view_slots --> c_select_slot
c_select_slot --> c_confirm_slot
c_confirm_slot ..> api_confirm_slot
api_confirm_slot ..> db_interviews
api_confirm_slot ..> hr_confirmed_gw
hr_confirmed_gw --> api_reminder_24h : "Confirmed"
hr_confirmed_gw --> hr_send_reminder : "No Response"
hr_send_reminder ..> ai_smtp

' Reminder flow
api_reminder_scheduler --> api_reminder_24h
api_reminder_24h ..> ai_smtp
api_reminder_24h --> api_reminder_1h
api_reminder_1h ..> ai_smtp
api_reminder_1h ..> c_wait_interview

' Live interview
c_wait_interview --> c_join_room
hr_join_room ..> api_ws_open
c_join_room ..> api_ws_open
api_ws_open --> api_connected_gw
api_connected_gw --> api_sync_streams : "Both Connected"
api_connected_gw --> api_ws_open : "Waiting"
api_sync_streams --> api_route_audio
api_sync_streams --> api_route_video

' Audio → Whisper → Transcript
api_route_audio ..> ai_whisper
ai_whisper ..> api_route_audio
api_route_audio --> api_recv_transcript
api_recv_transcript --> api_append_transcript
api_append_transcript --> api_persist_interview

' Video → MediaPipe → Emotion
api_route_video ..> ai_mediapipe
ai_mediapipe ..> api_route_video
api_route_video --> api_recv_emotion
api_recv_emotion --> api_append_emotion
api_append_emotion --> api_persist_interview
api_persist_interview ..> db_interviews

' Interview in progress
c_join_room --> c_participate
hr_join_room --> hr_conduct_interview
c_participate --> c_end_gw
c_end_gw --> c_end_ok : "Completed"
c_end_gw --> c_end_noshow : "No-Show"

hr_conduct_interview --> hr_noshow_gw
hr_noshow_gw --> hr_end_session : "Completed"
hr_noshow_gw --> hr_mark_noshow : "No-Show"
hr_mark_noshow ..> db_interviews
hr_mark_noshow --> hr_end_closed

' Post-interview AI analysis
hr_end_session ..> api_ws_close
api_ws_close --> api_build_summary_prompt
api_build_summary_prompt --> api_llm_summary
api_llm_summary ..> ai_llm_analysis
ai_llm_analysis ..> api_llm_summary
api_llm_summary --> api_parse_summary
api_parse_summary --> api_store_analysis
api_store_analysis ..> db_interviews
api_store_analysis --> api_update_app_status
api_update_app_status ..> db_applications
api_store_analysis ..> hr_review_summary

' Hiring decision
hr_review_summary --> hr_review_emotions
hr_review_emotions --> hr_review_transcript
hr_review_transcript --> hr_hire_gw
hr_hire_gw --> hr_send_offer : "Hire"
hr_hire_gw --> hr_send_rejection : "Reject"
hr_send_offer --> hr_mark_hired
hr_mark_hired ..> db_applications
hr_mark_hired ..> ai_smtp
hr_mark_hired --> hr_end_hired
hr_send_rejection ..> ai_smtp
hr_send_rejection --> hr_end_closed

@enduml
```

---

## Process Map Summary

| Diagram | Phase | Key Actors | AI Components |
|---------|-------|------------|---------------|
| 1 | Auth & Onboarding | Candidate, Backend, Supabase | qwen3:8b (CV parsing) |
| 2 | Job Posting & Config | HR Admin, Backend | nomic-embed-text (RAG prep) |
| 3 | Application & AI Pipeline | Candidate, HR, Backend | CNN Model, Atlas Vector Search, qwen3:8b (scoring) |
| 4 | Quiz Generation & Assessment | Candidate, HR, Backend | nomic-embed-text + qwen3:8b (RAG gen + grading) |
| 5 | Interview Lifecycle | Candidate, HR, Backend | faster-whisper, MediaPipe, qwen3:8b (analysis) |

### Key BPMN Notation Used

| Symbol | Meaning |
|--------|---------|
| `mxgraph.bpmn.event.start` | Green circle — process entry point |
| `mxgraph.bpmn.event.end` | Red/thick circle — normal process end |
| `mxgraph.bpmn.event.errorEnd` | Error circle — failure / rejection path |
| `mxgraph.bpmn.event.messageStart` | Envelope start — triggered by external message |
| `mxgraph.bpmn.event.timerStart` | Clock start — time-triggered (scheduler) |
| `mxgraph.bpmn.event.timerCatching` | Clock intermediate — wait/timer during process |
| `mxgraph.bpmn.gateway2.exclusive` | Diamond X — XOR branch (exactly one path) |
| `mxgraph.bpmn.data2.dataObject` | Document — persistent data store |
| `-->` | Sequence flow (within same pool) |
| `..>` | Message flow (cross-pool / async trigger) |
