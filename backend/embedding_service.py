"""
Embedding / inference service via the MedGemma remote HF endpoint.

The endpoint at MEDGEMMA_ENDPOINT is a Hugging Face Inference Endpoint running
a multimodal model (MedGemma or compatible).  It expects a JSON body with an
`inputs` key containing both an image (base64 data-URI) and a text prompt.

NOTE: This service does NOT perform pure embedding generation — MedGemma is a
generative VLM.  For similarity search you should either:
  (a) extract the last-hidden-state / pooled embedding via a separate
      feature-extraction endpoint, or
  (b) replace this service with a dedicated vision-embedding model endpoint
      (e.g. MedSiglip).

Current behaviour: returns a dummy zero-vector so the FastAPI server can still
start and the /health endpoint keeps working even when the endpoint GPU is down.
"""

import base64
import io
import math
import os
import threading
from typing import Any

import httpx
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

HF_TOKEN: str = os.getenv("HF_TOKEN", "").strip()
MEDGEMMA_ENDPOINT: str = os.getenv("MEDGEMMA_ENDPOINT", "").strip()

# Dimension returned when we fall back to zeros (matches MedSiglip-448 dims).
FALLBACK_DIM = 1152

_http_client: httpx.Client | None = None
_client_lock = threading.Lock()


# ── HTTP client ───────────────────────────────────────────────────────────────

def _get_client() -> httpx.Client:
    global _http_client
    if _http_client is not None:
        return _http_client
    with _client_lock:
        if _http_client is not None:
            return _http_client
        headers: dict[str, str] = {"Accept": "application/json"}
        if HF_TOKEN and HF_TOKEN != "YOUR_HF_TOKEN_HERE":
            headers["Authorization"] = f"Bearer {HF_TOKEN}"
        _http_client = httpx.Client(headers=headers, timeout=120.0)
        return _http_client


# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        return vector
    return [v / norm for v in vector]


def _image_to_b64_data_uri(image: Image.Image) -> str:
    """Resize + encode a PIL image as a PNG data-URI string."""
    image = image.convert("RGB")
    image.thumbnail((336, 336))  # keep payload small
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


def _extract_embedding(payload: Any) -> list[float]:
    """Try to pull a flat float list from various response shapes."""
    if isinstance(payload, list):
        # [[f, f, ...]] or [f, f, ...]
        if payload and isinstance(payload[0], list):
            return [float(v) for v in payload[0]]
        return [float(v) for v in payload]

    if isinstance(payload, dict):
        for key in ("embedding", "embeddings", "vector"):
            value = payload.get(key)
            if isinstance(value, list):
                if value and isinstance(value[0], list):
                    return [float(v) for v in value[0]]
                return [float(v) for v in value]

        # OpenAI-style {"data": [{"embedding": [...]}]}
        data = payload.get("data")
        if isinstance(data, list) and data:
            first = data[0]
            if isinstance(first, dict) and isinstance(first.get("embedding"), list):
                return [float(v) for v in first["embedding"]]

        # Feature-extraction: hidden states tensor
        hidden = payload.get("last_hidden_state") or payload.get("hidden_states")
        if isinstance(hidden, list) and hidden:
            # Mean-pool [seq_len, dim] → [dim]
            rows = hidden if isinstance(hidden[0], list) else [hidden]
            dim = len(rows[0])
            pooled = [sum(row[i] for row in rows) / len(rows) for i in range(dim)]
            return [float(v) for v in pooled]

    raise ValueError(f"Unexpected response format: {str(payload)[:200]}")


# ── Public API ────────────────────────────────────────────────────────────────

def query_medgemma(image: Image.Image, prompt: str = "Describe this chest X-ray.", max_tokens: int = 200) -> dict:
    """
    Send an image + text prompt to the MedGemma endpoint and return the raw
    JSON response.  Raises httpx.HTTPStatusError on non-2xx replies.
    """
    if not MEDGEMMA_ENDPOINT:
        raise RuntimeError("Set MEDGEMMA_ENDPOINT in .env")

    payload = {
        "inputs": {
            "image": _image_to_b64_data_uri(image),
            "text": prompt,
        },
        "parameters": {"max_new_tokens": max_tokens},
    }

    client = _get_client()
    response = client.post(
        MEDGEMMA_ENDPOINT,
        json=payload,
        headers={"Content-Type": "application/json"},
    )
    response.raise_for_status()
    return response.json()


def generate_embedding(image: Image.Image) -> list[float]:
    """
    Generate an L2-normalised embedding for `image`.

    Strategy:
      1. POST to MEDGEMMA_ENDPOINT using the multimodal HF pipeline format.
      2. If the response contains a numeric array, use it as the embedding.
      3. If the endpoint returns generated text (not an embedding), we fall back
         to a zero-vector so the server stays operational.  Replace the endpoint
         with a dedicated vision-embedding model (e.g. MedSiglip) for real
         similarity search.
    """
    if not MEDGEMMA_ENDPOINT:
        raise RuntimeError("Set MEDGEMMA_ENDPOINT in .env")

    payload = {
        "inputs": {
            "image": _image_to_b64_data_uri(image),
            "text": "Describe this chest X-ray.",
        },
        "parameters": {"max_new_tokens": 1},
    }

    client = _get_client()
    response = client.post(
        MEDGEMMA_ENDPOINT,
        json=payload,
        headers={"Content-Type": "application/json"},
    )
    response.raise_for_status()

    try:
        return _normalize(_extract_embedding(response.json()))
    except ValueError:
        # MedGemma is generative, not an embedding model.  Return zeros so the
        # pipeline doesn't crash — swap in a proper embedding endpoint for prod.
        print(
            "[embedding_service] WARNING: MedGemma returned text, not an embedding. "
            "Returning zero-vector. Use a dedicated embedding endpoint for similarity search."
        )
        return [0.0] * FALLBACK_DIM
