# CV Visualization System Walkthrough

I have successfully implemented the "See CV" feature and the integrated PDF visualization system. This allows HR managers to view candidate CVs directly within the recruitment dashboard without leaving the page.

## Key Changes

### 1. Backend Infrastructure
- **Shared File Utility**: Created `backend/utils/files.py` to centralize file resolution logic for both modern disk storage and legacy MongoDB binary storage.
- **HR CV Endpoint**: Added a secure endpoint `GET /api/applications/{application_id}/cv` that allows authorized HR users to stream the CV PDF snapshot associated with a specific application.

### 2. Frontend Components
- **CVViewerModal**: A new premium, monochrome modal component that fetches the PDF as a secure blob (to include authentication headers) and renders it using the browser's native PDF engine via an `<iframe>`.
- **UI Integration**: Added a "See CV" button with a visibility icon to the `ApplicationTrack` header actions.

## Verification

### Implementation Details
- **Security**: The backend verifies that the requesting user is either an HR/Admin or the owner of the application before serving the CV.
- **Performance**: The PDF is fetched once and stored as a local Object URL to ensure smooth rendering and proper cleanup.
- **Aesthetics**: The viewer follows the monochrome, typographically-driven design system of the dashboard.

### How to Test
1. Go to the **Applications** track page for any candidate.
2. Click the **"See CV"** button in the top right actions.
3. The CV should open in a blurred-background modal, allowing you to review the document while staying in the context of the application.
