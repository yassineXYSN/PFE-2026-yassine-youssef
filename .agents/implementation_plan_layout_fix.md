# Implementation Plan - Quiz Page Layout Fix

This plan outlines the changes to ensure the HR Quiz View has a fixed sidebar and a scrollable main content area.

## Proposed Changes

### Frontend

#### [MODIFY] [QuizView.css](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/frontend/src/apps/HR/applications/QuizView.css)
- Update `.qz-view-page` to have `height: 100vh` and `overflow: hidden`.
- Update `.qz-view-main` to have `overflow-y: auto` and `height: 100vh`.
- This ensures that the global page scrollbar is removed and replaced by an internal scrollbar for the quiz content, keeping the sidebar and header (if fixed) in place.

## Verification Plan

### Automated Tests
- None required for layout change.

### Manual Verification
1. Open the Quiz View page.
2. Scroll down through the questions.
3. Verify that the sidebar (HRSidebar) does not move and remains visible at all times.
4. Verify that the window scrollbar is absent and only the content area scrolls.
