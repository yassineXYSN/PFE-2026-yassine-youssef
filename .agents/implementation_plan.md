# CV Visualization System Implementation Plan

This plan outlines the steps to add a "See CV" button to the HR application tracking page and implement a PDF visualization system to view the CV within the application.

## Proposed Changes

### [Component: Backend]

#### [NEW] [files.py](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/utils/files.py)
Create a shared utility for resolving file paths from database metadata (disk-based vs legacy binary).
- Move `_resolve_file` and path constants from `routes/candidat/profile.py` to this utility.

#### [MODIFY] [applications.py](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/routers/applications.py)
Add a new endpoint `GET /{application_id}/cv` to allow HR users to retrieve the candidate's CV from an application snapshot.
- Use the new file utility to handle file resolution.
- Return a `FileResponse` for disk files or a `Response` for binary data.

#### [MODIFY] [profile.py](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/backend/routes/candidat/profile.py)
Update to use the shared file utility instead of internal logic.

---

### [Component: Frontend]

#### [NEW] [CVViewerModal.jsx](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/frontend/src/apps/HR/components/CVViewerModal.jsx)
A new modal component to display PDF content.
- Takes `applicationId` and `isOpen`.
- Renders the PDF in an `<iframe>` or `<embed>` pointing to the backend CV endpoint.
- Includes a close button and matches the monochrome design theme.

#### [NEW] [CVViewerModal.css](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/frontend/src/apps/HR/components/CVViewerModal.css)
Styles for the PDF viewer modal to ensure a premium, integrated look.

#### [MODIFY] [ApplicationTrack.jsx](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/frontend/src/apps/HR/applications/ApplicationTrack.jsx)
- Add a "See CV" button to the header actions.
- Integrate `CVViewerModal`.

---

## Verification Plan

### Automated Tests
- No new automated tests are planned for this UI-heavy feature, but I will manually verify the backend endpoint returns the correct PDF content type.

### Manual Verification
1. **Upload CV**: As a candidate, upload a CV PDF to the profile.
2. **Apply to Job**: As the candidate, apply to an active job.
3. **View in HR**: Login as an HR user, navigate to the application tracking page for that job/candidate.
4. **Click "See CV"**: Verify the button appears in the top right.
5. **PDF Display**: Verify the modal opens and the PDF is correctly rendered within the app without navigating away.
6. **Dark Mode**: Check that the modal styling respects the dark mode theme.
