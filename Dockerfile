# ==========================================
# Google Cloud Run Multi-Stage Dockerfile
# Stage 1: Build Frontend (Vite + React)
# Stage 2: Python 3.11 FastAPI Production App
# ==========================================

# --- Stage 1: Frontend Build ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci || npm install

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Production Python Backend ---
FROM python:3.11-slim AS production

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY backend/ ./

# Copy built frontend from Stage 1 into backend static distribution
COPY --from=frontend-builder /app/frontend/dist /app/static/dist

# Expose default Cloud Run port
EXPOSE 8080

# Run Uvicorn directly via Python entrypoint binding to dynamic Cloud Run $PORT
CMD ["python", "main.py"]
