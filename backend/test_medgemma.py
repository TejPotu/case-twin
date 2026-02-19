"""
MedGemma Endpoint Diagnostic Script
Run with: python test_medgemma.py

Tests the endpoint in several modes and prints a clear summary.
"""

import base64
import io
import json
import os
import sys

import httpx
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN", "").strip()
MEDGEMMA_ENDPOINT = os.getenv("MEDGEMMA_ENDPOINT", "").strip()

if not MEDGEMMA_ENDPOINT:
    print("❌  MEDGEMMA_ENDPOINT not set in .env")
    sys.exit(1)

AUTH_HEADERS = {
    "Authorization": f"Bearer {HF_TOKEN}",
    "Accept": "application/json",
}

client = httpx.Client(timeout=60.0)

PASS = "✅"
FAIL = "❌"
WARN = "⚠️ "

results: list[tuple[str, bool, str]] = []


def run(label: str, fn):
    try:
        msg = fn()
        results.append((label, True, msg))
        print(f"{PASS}  {label}: {msg}")
    except Exception as exc:
        results.append((label, False, str(exc)))
        print(f"{FAIL}  {label}: {exc}")


# ── 1. Health check (GET) ────────────────────────────────────────────────────
def test_health():
    r = client.get(MEDGEMMA_ENDPOINT, headers=AUTH_HEADERS)
    r.raise_for_status()
    return f"HTTP {r.status_code} — {r.text[:80]}"


run("GET health-check", test_health)


# ── 2. Text-only (feature-extraction / text-generation) ─────────────────────
def test_text_only():
    payload = {
        "inputs": "Describe the typical appearance of bilateral pulmonary infiltrates on a chest X-ray.",
        "parameters": {"max_new_tokens": 80},
    }
    r = client.post(
        MEDGEMMA_ENDPOINT,
        json=payload,
        headers={**AUTH_HEADERS, "Content-Type": "application/json"},
    )
    body = r.text
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {body[:200]}")
    data = r.json()
    # Handle text-generation list response
    if isinstance(data, list) and data:
        generated = data[0].get("generated_text", "")
        return f"generated_text ({len(generated)} chars): {generated[:100]}…"
    return f"Response: {str(data)[:150]}"


run("POST text-only (text-generation style)", test_text_only)


# ── 3. Multimodal: image + text via base64 (chat/messages style) ─────────────
def _load_sample_image_b64() -> str:
    sample = "../PMC10034413_gr5_undivided_1_1.webp"
    if not os.path.exists(sample):
        # Create a tiny blank PNG as fallback
        img = Image.new("RGB", (64, 64), color=(128, 128, 128))
    else:
        img = Image.open(sample).convert("RGB")
        img.thumbnail((336, 336))  # keep it small for the test

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def test_multimodal_messages():
    """Chat / messages format used by vision-capable models."""
    b64 = _load_sample_image_b64()
    payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                    {"type": "text", "text": "What do you see in this chest X-ray? Be concise."},
                ],
            }
        ],
        "max_tokens": 100,
    }
    r = client.post(
        MEDGEMMA_ENDPOINT,
        json=payload,
        headers={**AUTH_HEADERS, "Content-Type": "application/json"},
    )
    body = r.text
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {body[:300]}")
    data = r.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", str(data))
    return f"Model reply: {content[:150]}"


run("POST multimodal messages (base64 image + text)", test_multimodal_messages)


# ── 4. Multimodal: HF pipeline format ────────────────────────────────────────
def test_multimodal_hf_pipeline():
    """Hugging Face image-text-to-text pipeline format."""
    b64 = _load_sample_image_b64()
    payload = {
        "inputs": {
            "image": f"data:image/png;base64,{b64}",
            "text": "What do you see in this chest X-ray?",
        },
        "parameters": {"max_new_tokens": 80},
    }
    r = client.post(
        MEDGEMMA_ENDPOINT,
        json=payload,
        headers={**AUTH_HEADERS, "Content-Type": "application/json"},
    )
    body = r.text
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {body[:300]}")
    data = r.json()
    return f"Response: {str(data)[:150]}"


run("POST HF pipeline format (image+text inputs)", test_multimodal_hf_pipeline)


# ── Summary ──────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
passed = sum(1 for _, ok, _ in results if ok)
print(f"Results: {passed}/{len(results)} tests passed")
if passed == len(results):
    print("🎉  Endpoint is fully working!")
elif passed > 0:
    print(f"{WARN}  Endpoint is partially working — check failures above.")
else:
    print(f"{FAIL}  Endpoint is not responding correctly.")
print("=" * 60)
