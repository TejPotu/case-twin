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


def _compute_context_score(payload: dict, profile: dict) -> float:
    if not profile:
        return 0.0
    
    score = 0.0
    # 1. Demographics
    p_patient = profile.get("patient", {})
    p_age = p_patient.get("age_years")
    p_sex = p_patient.get("sex")
    
    p_gender = str(payload.get("gender", "")).lower()
    if p_sex and p_gender:
        if p_sex.lower()[:1] == p_gender[:1]:
            score += 0.1
            
    p_age_val = payload.get("age")
    if p_age is not None and p_age_val is not None:
        try:
            diff = abs(float(p_age) - float(p_age_val))
            if diff <= 5:
                score += 0.1
            elif diff <= 10:
                score += 0.05
        except (ValueError, TypeError):
            pass
            
    # 2. Clinical matching (diagnoses, symptoms)
    case_desc = (
        str(payload.get("diagnosis", "")) + " " +
        str(payload.get("summary", "")) + " " +
        str(payload.get("case_text", ""))
    ).lower()
    
    p_assessment = profile.get("assessment", {})
    p_diag = p_assessment.get("diagnosis_primary", "")
    if p_diag and str(p_diag).lower() in case_desc:
        score += 0.3
        
    p_pres = profile.get("presentation", {})
    p_cc = p_pres.get("chief_complaint", "")
    if p_cc:
        cc_words = set(w for w in str(p_cc).lower().replace(",", "").split() if len(w) > 3)
        match_count = sum(1 for w in cc_words if w in case_desc)
        score += min(0.2, match_count * 0.05)
        
    # 3. Findings matching
    p_findings = profile.get("findings", {})
    lungs = p_findings.get("lungs", {})
    if str(lungs.get("consolidation_present")).lower() == "yes" and "consolidation" in case_desc:
        score += 0.1
    if str(lungs.get("edema_present")).lower() == "yes" and "edema" in case_desc:
        score += 0.1
    pleura = p_findings.get("pleura", {})
    if str(pleura.get("effusion_present")).lower() == "yes" and "effusion" in case_desc:
        score += 0.1
        
    return score


def search_similar(embedding: list[float], profile_data: dict = None, limit: int = 5) -> list[dict]:
    """
    Search Qdrant for similar chest X-rays.
    Returns a list of dicts shaped for the frontend MatchItem.
    
    Performs hybrid matching pulling visual candidates and re-ranking them 
    based on the profile_data context footprint.
    """
    client = _get_client()

    # Pull a wider set for re-ranking
    retrieve_limit = 30 if profile_data else limit
    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=embedding,
        limit=retrieve_limit,
    ).points

    scored_results = []
    max_visual_score = max((r.score for r in results), default=1.0) or 1.0

    for r in results:
        p = r.payload or {}
        
        # Base visual dimension
        visual_score = r.score / max_visual_score
        
        # Contextual dimension
        context_score = _compute_context_score(p, profile_data) if profile_data else 0.0
        
        # Hybrid Fusion: 70% visual, 30% context
        fused_score = (visual_score * 0.7) + (context_score * 0.3)
        
        scored_results.append({
            "fused_score": fused_score,
            "visual_score": r.score,
            "payload": p,
            "id": r.id
        })

    # Sort descending by fused score and take top limit
    scored_results.sort(key=lambda x: x["fused_score"], reverse=True)
    top_results = scored_results[:limit]

    matches = []
    for sr in top_results:
        p = sr["payload"]
        v_score = sr["visual_score"]

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
            outcome_variant = "warning" if v_score >= 0.6 else "neutral"

        # ── Score tier ───────────────────────────────────────────────────────
        if v_score >= 0.8:
            outcome_variant = "success"
        elif v_score >= 0.6:
            outcome_variant = "warning"

        matches.append({
            "score": round(v_score * 100),
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
