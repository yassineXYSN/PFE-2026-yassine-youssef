# Implementation Plan - HR Application Track UI Restructuring

Modify the HR application details page to enforce a sequential "Approve" flow within cards instead of a global "Next Stage" button.

## Proposed Changes

### Frontend Components

#### [MODIFY] [ApplicationTrack.jsx](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/frontend/src/apps/HR/applications/ApplicationTrack.jsx)
- **Top Right Actions**: Remove the primary "Next Stage" button (lines 307-318).
- **Quiz Card**:
    - If `status` is `new` or `in_review`, hide the "Create Quiz" button and show "Approve to Technical Test" (which sets status to `technical_test`).
    - If `status` is `technical_test` or later, show the normal quiz buttons (Create/View/Update).
- **Video Meet Card**:
    - If `status` is `new`, `in_review`, or `technical_test`, hide "Organize Meeting" and show "Approve to Interview" (which sets status to `interview`).
    - Only show the "Organize Meeting" action when status is at least `interview`.

## Verification Plan

### Manual Verification
1.  Open an application in `new` status.
2.  Verify the "Next Stage" button is gone from the top right.
3.  Observe "Approve to Technical Test" in the Quiz card. Click it.
4.  Verify status transitions to `technical_test` and Quiz buttons appear.
5.  Observe "Approve to Interview" in the Video Meet card. Click it.
6.  Verify status transitions to `interview` and Video Meet buttons appear.
