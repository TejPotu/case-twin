"""
CaseTwin FastAPI backend.
POST /search  — upload a chest X-ray image, get back similar cases from Qdrant.
GET  /health  — health check.
"""

import io
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from embedding_service import generate_embedding
from qdrant_service import search_similar

app = FastAPI(title="CaseTwin API", version="1.0.0")

# Allow the Vite dev server (and any localhost port) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/search")
async def search(file: UploadFile = File(...), limit: int = 5):
    """
    Accept a chest X-ray image, generate a MedSiglip embedding,
    and return the top `limit` similar cases from Qdrant.
    """
    # Validate file type
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        raise HTTPException(status_code=400, detail="Only image files are accepted (jpg, png, webp).")

    # Read and open image
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read image: {e}")

    # Generate embedding
    try:
        embedding = generate_embedding(image)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {e}")

    # Search Qdrant
    try:
        matches = search_similar(embedding, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Qdrant search failed: {e}")

    return {"matches": matches, "count": len(matches)}
