FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend package — must live at /app/backend/ so relative imports resolve
COPY backend/ ./backend/

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
