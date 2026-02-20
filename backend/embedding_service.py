"""
MedSiglip-448 embedding service.

Embedding / inference service via remote HF endpoints.

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
import requests
import os
import httpx
from typing import Any
from io import BytesIO
import threading
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# HuggingFace authentication
# ---------------------------------------------------------------------------

_hf_token = os.getenv("HF_TOKEN")
HF_TOKEN: str = (_hf_token or "").strip()

if _hf_token and _hf_token != "YOUR_HF_TOKEN_HERE":
    try:
        from huggingface_hub import login
        login(token=_hf_token, add_to_git_credential=False)
        print("[EmbeddingService] HuggingFace login successful.")
    except Exception as e:
        print(f"[EmbeddingService] HuggingFace login failed: {e}")

# ---------------------------------------------------------------------------
# Endpoint configuration
# ---------------------------------------------------------------------------

MEDGEMMA_ENDPOINT: str = os.getenv("MEDGEMMA_ENDPOINT", "").strip()
HF_INFERENCE_ENDPOINT = os.getenv("MEDSIGLIP_ENDPOINT")

if not HF_INFERENCE_ENDPOINT:
    print("[EmbeddingService] WARNING: MEDSIGLIP_ENDPOINT is not set in .env")

# Dimension returned when we fall back to zeros (matches MedSiglip-448 dims).
FALLBACK_DIM = 1152

# ---------------------------------------------------------------------------
# httpx client (for MedGemma remote endpoint)
# ---------------------------------------------------------------------------

_http_client: httpx.Client | None = None
_client_lock = threading.Lock()


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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Public API — MedGemma remote endpoint
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Public API — MedSiglip Inference Endpoint (remote, via requests)
# ---------------------------------------------------------------------------

def generate_embedding_remote(image: Image.Image) -> list[float]:
    """
    Generate a normalized 1152-dim MedSiglip embedding for a PIL image
    by calling the hosted Hugging Face Inference Endpoint.
    """
    if not HF_INFERENCE_ENDPOINT:
        raise ValueError("MEDSIGLIP_ENDPOINT is not configured.")

    # Convert image to base64
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")

    # Prepare payload
    payload = {
        "inputs": {
            "image": img_str
        }
    }

    # Headers with auth
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(HF_INFERENCE_ENDPOINT, json=payload, headers=headers)
        response.raise_for_status()

        # Parse response
        # The custom handler returns {"image_embedding": [...], "text_embeddings": ...}
        result = response.json()

        # Handle list response (standard HF format) vs dict response (our custom handler)
        if isinstance(result, list):
             if len(result) > 0 and isinstance(result[0], dict) and "image_embedding" in result[0]:
                 embedding = result[0]["image_embedding"]
             else:
                 print(f"[EmbeddingService] Unexpected response format: {result}")
                 raise ValueError(f"Unexpected API response format: {type(result)}")
        elif isinstance(result, dict):
            embedding = result.get("image_embedding")
        else:
            raise ValueError(f"Unexpected API response type: {type(result)}")

        if not embedding:
             raise ValueError("API response missing 'image_embedding' field.")

        return embedding

    except requests.exceptions.RequestException as e:
        print(f"[EmbeddingService] API Request Error: {e}")
        if e.response is not None:
             print(f"[EmbeddingService] API Response: {e.response.text}")
        raise e
    except Exception as e:
        print(f"[EmbeddingService] Error generating embedding: {e}")
        raise e


# ---------------------------------------------------------------------------
# Public API — Unified generate_embedding() with automatic fallback
# ---------------------------------------------------------------------------

def generate_embedding(image: Image.Image) -> list[float]:
    """
    Generate an L2-normalised embedding for `image`.

    Strategy (in priority order):
      1. If MEDSIGLIP_ENDPOINT is set, call the remote MedSiglip Inference Endpoint.
      2. If MEDGEMMA_ENDPOINT is set, POST to it and try to extract an embedding.
         Falls back to a zero-vector if MedGemma returns text instead.
      3. If neither endpoint is configured, raises RuntimeError.
    """
    # --- Priority 1: Remote MedSiglip endpoint ---
    if HF_INFERENCE_ENDPOINT:
        return generate_embedding_remote(image)

    # --- Priority 2: Remote MedGemma endpoint ---
    if MEDGEMMA_ENDPOINT:
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

    # --- No endpoint configured ---
    raise RuntimeError(
        "No embedding endpoint configured. Set MEDSIGLIP_ENDPOINT or MEDGEMMA_ENDPOINT in .env"
    )
