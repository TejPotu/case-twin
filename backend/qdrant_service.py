"""
Qdrant search service.
Queries the chest_xrays collection and maps results to frontend MatchItem shape.
Payload fields match dataset_schema.json (new nested schema).
"""

import os
from qdrant_client import QdrantClient
from dotenv import load_dotenv

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "chest_xrays")

_client = None


def _get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
        print(f"[QdrantService] Connected to {QDRANT_URL}")
    return _client


def search_similar(embedding: list[float], limit: int = 5) -> list[dict]:
    """
    Search Qdrant for similar chest X-rays.
    Returns a list of dicts shaped for the frontend MatchItem.

    Payload stored per new dataset_schema.json:
      pmc_id            ← source.dataset_record_id
      article_title     ← source.title
      journal           ← source.journal
      year              ← source.year
      doi               ← source.doi
      age               ← patient_context.age_years
      gender            ← patient_context.sex
      caption           ← images[n].caption
      radiology_view    ← images[n].view_position
      radiology_region  ← images[n].radiology_region
      image_url         ← GCS public URL (set at upload time)
      image_filename    ← images[n].local_image_path (filename only)
      case_text         ← clinical_text.raw_note (first 500 chars)
      summary           ← text_outputs.case_card.summary_1_2_lines
      diagnosis         ← radiology_labels.primary_suspected[0]
      outcome_success   ← outcomes.success  ("yes"/"no")
      case_id           ← case_id (top-level UUID)
    """
    client = _get_client()

    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=embedding,
        limit=limit,
    ).points

    matches = []
    for r in results:
        p = r.payload or {}

        # ── Diagnosis ────────────────────────────────────────────────────────
        # primary_suspected is stored as a list; fall back to caption or title
        primary = p.get("diagnosis") or p.get("article_title", "Unknown")
        diagnosis = primary[:80] if primary else "Unknown"

        # ── Summary ──────────────────────────────────────────────────────────
        summary = p.get("summary", "")
        if not summary:
            case_text = p.get("case_text", "")
            summary = case_text[:120] + "…" if len(case_text) > 120 else case_text
        summary = summary or "No case summary available."

        # ── Outcome ──────────────────────────────────────────────────────────
        outcome_success = p.get("outcome_success", "")  # "yes" / "no"
        if outcome_success == "yes":
            outcome_label = "Favorable"
            outcome_variant = "success"
        elif outcome_success == "no":
            outcome_label = "Unfavorable"
            outcome_variant = "neutral"
        else:
            outcome_label = p.get("radiology_view", "Frontal").capitalize()
            outcome_variant = "warning" if r.score >= 0.6 else "neutral"

        # ── Score tier ───────────────────────────────────────────────────────
        if r.score >= 0.8:
            outcome_variant = "success"
        elif r.score >= 0.6:
            outcome_variant = "warning"

        matches.append({
            "score": round(r.score * 100),
            "diagnosis": diagnosis,
            "summary": summary,
            "facility": p.get("pmc_id", "Unknown"),
            "outcome": outcome_label,
            "outcomeVariant": outcome_variant,
            "image_url": p.get("image_url", ""),
            "age": p.get("age"),
            "gender": p.get("gender"),
            "pmc_id": p.get("pmc_id"),
            "article_title": p.get("article_title"),
            "journal": p.get("journal"),
            "year": p.get("year"),
            "radiology_view": p.get("radiology_view"),
            "case_text": p.get("case_text", ""),
        })

    return matches
