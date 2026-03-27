# Walkthrough: Recruitment Pipeline

We have implemented a gated recruitment pipeline that ensures applications move through specific stages before critical actions (like creating a quiz or an interview) can be taken.

## Workflow Overview

1.  **New Stage**
    - Initial state for all new applications.
    - AI Analysis is required to proceed.
2.  **In Review Stage**
    - Automatically triggered when HR clicks **"Analyze"**.
    - Profile metrics and AI score are revealed.
    - HR can then click **"Approve to Next Stage"** to move to the Technical phase.
3.  **Technical Test Stage**
    - The **"Create Quiz"** button becomes enabled.
    - HR sends the quiz; the candidate completes it.
    - Once completed, HR can click **"Approve to Next Stage"** to move to Interviews.
4.  **Interview Stage**
    - The **"Organize Meeting"** button becomes enabled.
    - HR schedules final discussions.

## Key Changes

### Backend
- **Initial Status**: Applications now start with status `new` in `backend/routers/applications.py`.
- **Auto-Transition**: AI analysis now sets the status to `in_review` in `backend/routers/ai_matching.py`.

### Frontend
- **Gated Actions**: Buttons are locked/unlocked based on the current `status`.
- **App approve button**: A dynamic "Approve to Next Stage" button manages transitions between stages.
- **Multilingual Support**: All stages and tooltips are fully translated in English and French.

## Verification
- Applied as a candidate: Status set to `new`.
- Analyzed as HR: Status moved to `in_review`.
- Clicked "Approve": Status moved to `technical_test` and "Create Quiz" became active.
- Verified that "Organize Meeting" remained locked until the Interview stage.
