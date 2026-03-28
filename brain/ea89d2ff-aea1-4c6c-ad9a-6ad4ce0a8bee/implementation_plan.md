# Implementation Plan - Candidate Quiz (Zen Purple Remake)

Remake the candidate quiz page from scratch to deliver a premium "Zen" experience with focused questioning and elegant purple accents.

## Proposed Changes

### [Component Name] Zen Purple UI

#### [MODIFY] [QuizTakingPage.jsx](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/frontend/src/apps/Candidat/Quiz/QuizTakingPage.jsx)
- **Focused Center Layout**: A large, elegant question card that is the primary focus of the page.
- **Vertical Journey Timeline**: A sleek sidebar showing the progression through the quiz with interactive "pips" that light up purple.
- **Enhanced Answer States**: Radio choices reimagined as large, clickable Tiles with purple-tinted active states and glows.
- **Micro-Animations**: Staggered entry for each question and its options using `framer-motion`.

#### [MODIFY] [QuizTakingPage.css](file:///c:/Users/ASUS/Documents/GitHub/PFE-2026-yassine-youssef/frontend/src/apps/Candidat/Quiz/QuizTakingPage.css)
- **Purple & Zinc Hybrid Palette**:
    - Primary Purple: `#8b5cf6` (Standard Tailwind Violet 500)
    - Dark Zinc background: `#09090b`
    - Purple-tinted surfaces: `#1e1b3a`
- **Glow System**: High-end purple glows (`box-shadow`) for active questions and selections.
- **Custom Timeline**: A custom-styled vertical line with motion-reactive points.
- **Zen Glassmorphism**: High blur and saturation on all overlays and cards.

## Verification Plan

### Manual Verification
- Verify the "Zen" feel and focus of the single-question navigation.
- Ensure the purple theme is consistent with the rest of the candidate application.
- Test the vertical timeline interactivity and progress tracking.
- Validate responsiveness across mobile and desktop.
