# Database Implementation Tasks

This document outlines the step-by-step process for integrating the `candidat_*` Supabase schema with the React frontend application.

## 1. Setup & Configuration
- [ ] **Run SQL Script:** Execute `unified_candidate_schema.sql` in the Supabase SQL Editor.
- [ ] **Generate Types:** Run Supabase CLI command to update TypeScript definitions based on the new schema:
  - `npx supabase gen types typescript --project-id <your-project-id> > src/types/supabase.ts` (or equivalent path)
- [ ] **Create Storage Buckets:** Manually (or via SQL script) create the required Supabase Storage buckets:
  - `candidate-documents`
  - `avatars`
- [ ] **Storage Policies:** Configure RLS for the newly created buckets so candidates can only upload/read their own files.

## 2. API Layer (React Services/Hooks)
- [ ] **Create Profile Service:** Implement API functions (e.g., in `src/services/candidat/profile.js` or `hooks/useProfile.js`) for CRUD operations on `candidat_profiles` and `candidat_settings`.
- [ ] **Create Experience/Education Service:** Implement CRUD functions for `candidat_experiences`, `candidat_educations`, `candidat_skills`, and `candidat_languages`.
- [ ] **Create Application/Job Service:** Implement API functions for fetching `hr-jobs`, creating bookmarks (`candidat_job_bookmarks`), and submitting applications (`candidat_applications`).
- [ ] **Create Storage Service:** Implement functions to upload, fetch, and delete files in the `candidate-documents` bucket and insert metadata into `candidat_files`.

## 3. Account Setup (Onboarding Flow)
- [ ] **Trigger Profile Creation:** Ensure that upon user signup (or first login), a base record is created in `candidat_profiles` and `candidat_settings`. (You can use a Supabase Auth Trigger or do it in the frontend).
- [ ] **Step 1 (CV Upload):** Wire up the file upload to the Storage Service and save the file record in `candidat_files`.
- [ ] **Step 2 (Personal Details):** Connect form submission to `UPDATE candidat_profiles` (handling `first_name`, `last_name`, `title`, etc.) and `UPDATE candidat_settings`.
- [ ] **Step 3 (Skills & Languages):** Connect adding/removing skills and languages to `INSERT`/`DELETE` on `candidat_skills` and `candidat_languages`.
- [ ] **Step 4 (Education):** Wire up the education form to `candidat_educations`. Make sure any certificates uploaded are saved to storage first, then the `file_id` is linked.
- [ ] **Step 5 (Experience):** Wire up the experience form to `candidat_experiences` (similar to education).

## 4. Dashboard & Profile Management
- [ ] **Profile Page (`Dashboard/Profile`):** Fetch the candidate's full profile, skills, languages, educations, and experiences to populate the view.
- [ ] **Edit Forms:** Allow updating existing records directly from the profile page.
- [ ] **Settings Page (`Dashboard/Settings`):** Fetch and update `candidat_settings`.
- [ ] **Privacy Switch:** Ensure that changing the privacy toggle updates the `privacy_level` column in settings.

## 5. Job Search & Interaction
- [ ] **Find Jobs (`Dashboard/FindJobs`):** Replace existing static/mock job list with a query fetching active jobs from `hr-jobs`.
- [ ] **Search/Filter Logic:** Implement Supabase `.ilike()` or Full-Text Search filters for job queries based on the UI search bar and dropdowns.
- [ ] **Bookmarking:** Wire up the "save/bookmark" button to insert/delete from `candidat_job_bookmarks`.
- [ ] **Applying for Jobs:** Build the flow to insert a record into `candidat_applications` when applying (linking a resume from `candidat_files`).

## 6. My Submissions & Tracking
- [ ] **Submissions Page (`Dashboard/MySubmissions`):** Fetch the candidate's data from `candidat_applications` along with joined data from `hr-jobs` and `hr-companies`.
- [ ] **Analytics (Optional):** Calculate insights based on application status counts (e.g., "In Review", "Interview") for the dashboard cards.

## 7. Audit & Polish
- [ ] **Audit Logging:** Implement calls to insert records into `candidat_audit_logs` at critical actions (e.g., successful application submission).
- [ ] **Error Handling:** Add robust loading states and error toasts (handled gracefully if RLS blocks an action).
- [ ] **Testing:** Verify all RLS policies are working (e.g., try fetching another candidate's private data).
