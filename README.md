# Project Setup

## structure
- `backend/`: FastAPI application
- `frontend/`: React application (Vite)

## Running the Project

### Backend
1. Open a terminal in the root directory.
2. Activate the virtual environment (optional but recommended, automated verification usually uses it directly):
   `.\backend\venv\Scripts\activate`
3. Run the server:
   `uvicorn backend.main:app --reload`
   Alternatively, `cd backend` and `uvicorn main:app --reload`.

### Frontend
1. Open a terminal in `frontend/`.
2. Run development server:
   `npm run dev`

## URLs
- Backend Docs: http://127.0.0.1:8000/docs
- Frontend: http://localhost:5173
