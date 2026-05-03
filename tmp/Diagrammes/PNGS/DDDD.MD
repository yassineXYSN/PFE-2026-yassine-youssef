```mermaid
sequenceDiagram
    autonumber
    actor App as "FastAPI lifespan()"
    participant Loop as "start_job_deadline_scheduler()"
    participant Check as "_check_job_deadlines()"
    database Jobs as "hr_jobs"
    participant Funnel as "run_deadline_automation_for_job()"
    database Apps as "job_applications"
    database Cand as "candidates"
    participant AI as "AIMatchingService"
    participant Embed as "OLLAMA /embeddings or FAKE_ANALYSIS"
    participant QuizStage as "_create_and_publish_quiz()"
    database Docs as "quiz_documents"
    database Chunks as "quiz_chunks"
    database Quizzes as "quizzes"
    participant QuizGen as "generate_quiz()"
    participant LLM as "generate_chat_completion() [Polymorphic Dispatch]"
    database Audit as "quiz_audit"
    database Notif as "notifications"

    App->>Loop: asyncio.create_task(start_job_deadline_scheduler(interval_seconds=60))
    Note over App,Loop: Scheduler is launched during FastAPI startup.

    loop every 60s
        Loop->>Check: _check_job_deadlines()
        activate Check
        Check->>Jobs: find({"ai_automation.enabled": True}).to_list(500)
        Jobs-->>Check: jobs

        loop each job
            alt deadline phase eligible
                Check->>Jobs: find_one_and_update(... deadline_processing=True, ai_automation_run_id=run_id ...)
                Jobs-->>Check: claimed_job

                Check->>Funnel: run_deadline_automation_for_job(db, claimed_job, now)
                activate Funnel
                Funnel->>Apps: find({"job_id": job_id}).to_list(500)
                Apps-->>Funnel: applications

                alt applications exist
                    Funnel->>AI: _ensure_job_embedding(job)
                    AI->>Embed: generate_embedding(job.description)
                    Embed-->>AI: job_embedding

                    Note over Funnel,AI: For each application:<br/>_load_candidate_for_application() -> _merge_candidate_profile() -> _ensure_candidate_embedding()<br/>then _cosine_similarity() + _normalize_vector_score()

                    loop vector shortlist (top_x_candidates)
                        Funnel->>AI: evaluate_candidate_with_llm(job_description, merged_profile)
                        AI->>LLM: _generate_with_llm("profile_analysis", prompt, json_mode=True)
                        LLM-->>AI: {"score","justification"}
                        AI-->>Funnel: analysis
                        Funnel->>Apps: update_one(... status="in_review", vector_match_score, ai_score, ai_justification, automation_vector_rank ...)
                    end

                    alt quiz_stage.enabled && quiz_stage.quizzes
                        loop AI shortlist (top_y_candidates)
                            Funnel->>Apps: update_one(... status="technical_test", automation_ai_rank, automation_vector_score, automation_ai_score ...)
                            Funnel->>Notif: create_notification(... status change)

                            loop each quiz_config
                                Funnel->>QuizStage: _create_and_publish_quiz(db, job, application, quiz_config, run_id, quiz_key)
                                activate QuizStage
                                QuizStage->>Quizzes: find_one({application_id, automation_run_id, automation_quiz_key})

                                alt quiz already exists
                                    QuizStage->>Quizzes: update_one(... status="published" ...)
                                    QuizStage->>Apps: update_one(... quiz_status="sent" ...)
                                else new quiz
                                    QuizStage->>Docs: find_one({"_id": ObjectId(document_id)})
                                    QuizStage->>Chunks: retrieve_chunks_for_quiz(document_id, total_questions, section_filter, max_chunk_reuse)
                                    Chunks-->>QuizStage: selected_chunks
                                    QuizStage->>QuizGen: generate_quiz(chunks, question_types, difficulty_mix, quiz_title, options_count)
                                    QuizGen->>LLM: generate_question(...) -> generate_chat_completion(...) or _generate_mock_question()
                                    LLM-->>QuizGen: question JSON
                                    QuizGen-->>QuizStage: quiz_data

                                    Note over QuizStage: resolve_template_config() + _scale_question_types()<br/>compute_overlap_with_existing() + validate_quiz_output()

                                    QuizStage->>Quizzes: insert_one(quiz_data) -> update_one(status="published")
                                    QuizStage->>Chunks: update_chunk_usage(chunk_ids, question_types_used)
                                    QuizStage->>Audit: record_quiz_provenance(quiz_id, document_id, chunk_ids, template_id=None, user_id="system")
                                    QuizStage->>Apps: update_one(... quiz_status="sent", last_quiz_sent_at ...)
                                end

                                QuizStage->>Notif: create_notification(... title="Nouveau Quiz Disponible")
                                QuizStage-->>Funnel: quiz_id
                                deactivate QuizStage
                            end
                        end
                    else direct interview promotion
                        Funnel->>Apps: update_one(... status="interview", automation_interview_rank, automation_final_score ...)
                        Funnel->>Notif: create_notification(... status change)
                    end
                else no applications
                    Funnel-->>Check: summary counts = 0
                end

                Funnel->>AI: close()
                Funnel-->>Check: summary(run_id, shortlist counts, quizzes_published, promoted_to_interview)
                deactivate Funnel
                Check->>Jobs: update_one(... deadline_processed=True, deadline_processing=False, ai_automation_summary, allow_hr=True ...)
            end

            opt later pass after latest quiz deadline
                Check->>Funnel: finalize_quiz_stage_for_job(db, claimed_job, now)
                activate Funnel
                Note over Funnel: For each shortlisted app:<br/>load latest auto_generated quiz per automation_quiz_key<br/>calculate_weighted_quiz_score()<br/>update_one(status, quiz_score, automation_final_score, automation_interview_rank)
                Funnel->>Notif: create_notification(... promoted to interview)
                Funnel-->>Check: promoted_to_interview
                deactivate Funnel
                Check->>Jobs: update_one(... quiz_stage_processed=True, ai_automation_summary.promoted_to_interview ...)
            end
        end
        deactivate Check
    end
