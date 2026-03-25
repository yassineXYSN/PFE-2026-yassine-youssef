# Walkthrough - Quiz Visualization & Candidate Delivery

I have refined the Quiz Visualization page to match the professional TalentFlow monochrome design system and implemented the "Send to Candidate" workflow.

## Key Enhancements

### 1. Premium Monochrome Theme
- **`QuizView.css`**: Completely overhauled the styling to use the official TalentFlow palette (Black, White, and Grays).
- **Typography**: Switched to Manrope (Headline) and Inter (Body) to match the dashboard.
- **Components**: Updated question cards, difficulty tags, and buttons to use sharp, professional borders and high-contrast indicators.

### 2. "Send to Candidate" Workflow
- **Sidebar Integration**: Added a primary "Envoyer au Candidat" button in the quiz sidebar.
- **Backend Endpoint**: Created `PATCH /api/quiz/{quiz_id}/status` to handle the publication of the quiz.
- **Interactive Feedback**:
    - Confirms action before sending.
    - Updates the button state to **"Envoyé au Candidat"** (locked) upon success.
    - Updates the application record in the database to track the delivery.

## How to Verify

### Visual Check
1. Open any quiz via the **"Voir Résultats"** button in an application.
2. Observe the new monochrome theme:
    - Questions are now presented in clear, white cards with black accents.
    - Correct answers are highlighted with a solid black background and white text.
    - The sidebar actions match the premium HR dashboard style.

### Functional Check
1. Click **"Envoyer au Candidat"** in the sidebar.
2. Confirm the prompt.
3. Observe the success message and notice the button becomes disabled and confirms the status change.

This update ensures that the recruitment pipeline feels integrated and professional from generation to delivery.
