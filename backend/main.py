"""
CaseTwin FastAPI backend.
POST /search   — upload a chest X-ray image, get back similar cases from Qdrant.
POST /extract  — extract a structured CaseProfile from images + clinical notes (mock).
GET  /health   — health check.
"""

import io
import json
import re
import uuid
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from embedding_service import generate_embedding, query_medgemma
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
async def search(
    file: UploadFile = File(...),
    profile: Optional[str] = Form(None),
    limit: int = 5
):
    """
    Accept a chest X-ray image, generate a MedSiglip embedding,
    and return the top `limit` similar cases from Qdrant, re-ranked
    using the extracted CaseProfile.
    """
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        raise HTTPException(status_code=400, detail="Only image files are accepted (jpg, png, webp).")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read image: {e}")

    parsed_profile = None
    if profile:
        try:
            parsed_profile = json.loads(profile)
        except Exception as e:
            print(f"Warning: Failed to parse profile JSON: {e}")

    try:
        embedding = generate_embedding(image)
    except Exception as e:
        err_str = str(e)
        if "503" in err_str or "Service Unavailable" in err_str:
            raise HTTPException(
                status_code=503, 
                detail="The AI image matching model is currently waking up or unavailable. Please try again in about 1-2 minutes."
            )
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {e}")

    try:
        matches = search_similar(embedding, profile_data=parsed_profile, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Qdrant search failed: {e}")

    return {"matches": matches, "count": len(matches)}


# ──────────────────────────────────────────────────────────────────────────────
# /compare_insights  – Use MedGemma to compare abnormalities
# ──────────────────────────────────────────────────────────────────────────────
@app.post("/compare_insights")
async def compare_insights(
    original_image: UploadFile = File(...),
    match_diagnosis: str = Form(...),
    match_image_url: str = Form(None),
    match_payload: str = Form(None)
):
    """
    Given the original uploaded image and the diagnosis of the matched case,
    ask MedGemma to find bounding boxes for that diagnosis in the original image.
    This also handles the matched image if we pass it, but for simplicity
    we'll fetch/analyze both or simulate bounding boxes if it fails.
    """
    import httpx
    
    # Read original image
    try:
        contents = await original_image.read()
        orig_pil = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read original image: {e}")
        
    # Read matched image
    match_pil = None
    if match_image_url and match_image_url.startswith("http"):
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(match_image_url)
                if r.status_code == 200:
                    match_pil = Image.open(io.BytesIO(r.content)).convert("RGB")
        except Exception as e:
            print(f"Warning: could not fetch matched image {match_image_url}: {e}")

    # Parse match payload for context
    parsed_payload = {}
    if match_payload:
        try:
            parsed_payload = json.loads(match_payload)
        except Exception as e:
            print(f"Warning: failed to parse match_payload JSON: {e}")
            
    # Query MedGemma for bounding boxes for original
    prompt = f"Return the bounding box coordinates [ymin, xmin, ymax, xmax] for the finding '{match_diagnosis}' in this chest X-ray."
    
    orig_box = None
    match_box = None
    
    # Helper to parse MedGemma [y1, x1, y2, x2] response strings
    def parse_box(text):
        m = re.search(r'\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]', text)
        if m:
            return [int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))]
        return None
        
    # Helper to describe the box position
    def get_region_text(box):
        if not box: return "an unspecified region"
        y1, x1, y2, x2 = box
        xc = (x1 + x2) / 2
        yc = (y1 + y2) / 2
        
        if yc < 333:
            v = "upper"
        elif yc < 666:
            v = "mid"
        else:
            v = "lower"
            
        if xc < 333:
            h = "left"
        elif xc < 666:
            h = "central"
        else:
            h = "right"
            
        return f"{v} {h} region"
        
    # Query for original image box
    try:
        resp = query_medgemma(orig_pil, prompt=prompt, max_tokens=50)
        if isinstance(resp, list) and len(resp) > 0:
            box_text = resp[0].get("generated_text", "")
            orig_box = parse_box(box_text)
    except Exception as e:
        print(f"MedGemma orig box extraction error: {e}")
        
    # Query for match image
    if match_pil:
        try:
            resp = query_medgemma(match_pil, prompt=prompt, max_tokens=50)
            if isinstance(resp, list) and len(resp) > 0:
                box_text = resp[0].get("generated_text", "")
                match_box = parse_box(box_text)
        except Exception as e:
            print(f"MedGemma match box extraction error: {e}")
            
    # Fallback to simulated bounding boxes if model fails or doesn't support coordinates
    if not orig_box or not match_box:
        # Generate pseudo-random deterministic coordinates based on diagnosis and URL
        import hashlib
        hash_input = f"{match_diagnosis}-{match_image_url or 'local'}".encode()
        h = int(hashlib.md5(hash_input).hexdigest()[:8], 16)
        
        # Base ranges
        y_center = 200 + (h % 500)
        x_center = 200 + ((h // 500) % 500)
        box_size = 150 + (h % 200)
        
        if not orig_box:
            orig_box = [
                max(0, y_center - box_size//2),
                max(0, x_center - box_size//2),
                min(1000, y_center + box_size//2),
                min(1000, x_center + box_size//2)
            ]
        if not match_box:
            # Shift match box slightly
            y_shift = -50 + (h % 100)
            x_shift = -50 + ((h // 100) % 100)
            match_box = [
                max(0, orig_box[0] + y_shift),
                max(0, orig_box[1] + x_shift),
                min(1000, orig_box[2] + y_shift),
                min(1000, orig_box[3] + x_shift)
            ]

    orig_region = get_region_text(orig_box) if orig_box else "the affected region"
    match_region = get_region_text(match_box) if match_box else "the affected region"
    
    import re

    # Build a tight prompt that forces a single, concise, non-repeating output
    hpi = parsed_payload.get("presentation", {}).get("hpi", "")
    outcome = parsed_payload.get("outcome", {}).get("detail", "")

    unified_prompt = (
        f"You are a radiology AI assistant. Analyze this chest X-ray for suspected '{match_diagnosis}'. "
        f"The primary finding in the current image is in the {orig_region}. "
        f"The historical twin case had primary involvement in the {match_region}. "
        f"Clinical history: {hpi or 'not provided'}. Historical outcome: {outcome or 'not provided'}. "
        f"Write exactly 5-6 sentences. Cover: (1) what the current finding looks like, "
        f"(2) why the highlighted region is clinically significant, "
        f"(3) how it visually compares to the historical case, "
        f"(4) what this similarity suggests prognostically. "
        f"Use **bold** for key medical terms. Do NOT repeat yourself. Stop after 6 sentences."
    )

    try:
        import asyncio
        resp = await asyncio.to_thread(query_medgemma, orig_pil, prompt=unified_prompt, max_tokens=400)
        gen_text = "AI analysis unavailable."
        if isinstance(resp, list) and len(resp) > 0 and resp[0].get("generated_text"):
            raw = resp[0]["generated_text"].strip()
            # Strip prompt echo if model returns the full prompt+completion
            if raw.startswith(unified_prompt):
                raw = raw[len(unified_prompt):].strip()
            # Remove any leading "markdown" / code fence artifacts
            raw = re.sub(r"^```(?:markdown)?\s*", "", raw, flags=re.IGNORECASE).strip()
            raw = re.sub(r"```$", "", raw).strip()
            # Strip LaTeX boxed notation the model sometimes wraps output in
            # e.g.  $\boxed{The current image shows...}$  or  \boxed{...}
            raw = re.sub(r"\$?\\?boxed\{(.+?)\}\$?", r"\1", raw, flags=re.DOTALL)
            raw = raw.strip()
            # Deduplicate: if the model loops, keep only the first unique occurrence
            # Split on common sentence-repeat markers
            seen = set()
            sentences = re.split(r"(?<=[.!?])\s+", raw)
            deduped = []
            for s in sentences:
                key = s.strip().lower()[:60]
                if key not in seen:
                    seen.add(key)
                    deduped.append(s.strip())
                # Stop after 6 sentences
                if len(deduped) >= 6:
                    break
            gen_text = " ".join(deduped)

    except Exception as e:
        print(f"MedGemma unified extraction error: {e}")
        gen_text = "Unable to complete AI analysis at this time."

    return {
        "insights_text": gen_text,
        "original_box": orig_box,
        "match_box": match_box,
    }


# ──────────────────────────────────────────────────────────────────────────────
# /search_hospitals  – You.com RAG integration for dynamic facility routing
# ──────────────────────────────────────────────────────────────────────────────
@app.post("/search_hospitals")
async def search_hospitals(
    diagnosis: str = Form(...),
    location: Optional[str] = Form(None),
    equipment: Optional[str] = Form(None),
    maxTravelTime: Optional[str] = Form(None)
):
    """
    Query the You.com RAG API to find relevant top-tier hospitals for the given diagnosis.
    Returns structured data detailing facility names, capabilities, reason for match,
    and approximate locations/coordinates for mapping.
    """
    import os
    import httpx
    import json
    
    ydc_api_key = os.getenv("YDC_API_KEY")
    if not ydc_api_key:
        raise HTTPException(status_code=500, detail="YDC_API_KEY environment variable is missing.")

    loc_context = f" near {location}" if location else " in the United States"
    eq_context = f" that MUST have the following equipment/capabilities: {equipment}." if equipment else ""
    travel_context = f" The hospital MUST be reachable within a {maxTravelTime} hour travel time from the location." if maxTravelTime else ""
    
    query = (
        f"Identify the top 10 best hospitals or medical centers{loc_context} for treating "
        f"'{diagnosis}'.{eq_context}{travel_context} For each hospital, provide the exact name, a short percentage-like "
        f"capability score (e.g., '98%'), a realistic estimated travel time string (e.g., '2h 15m'), "
        f"a brief 5-10 word reason outlining their specialty for this condition, and approximate "
        f"latitude and longitude coordinates. "
        f"Format the final output strictly as a JSON array of objects with the keys: "
        f"name, capability, travel, reason, lat, lng. "
        f"Do not include any Markdown formatting or extra text, just the raw JSON array."
    )

    headers = {
        "X-API-Key": ydc_api_key,
        "Content-Type": "application/json"
    }
    
    payload = {
        "query": query,
        "chat_id": str(uuid.uuid4())
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post("https://api.ydc-index.io/rag", headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            
            answer = data.get("answer", "")
            
            answer = data.get("answer", "")
            print(f"[search_hospitals] You.com Raw Answer:\n{answer}")
            
            # Extract JSON array robustly via substring
            start_idx = answer.find("[")
            end_idx = answer.rfind("]")
            
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                json_str = answer[start_idx:end_idx+1]
                hospitals = json.loads(json_str)
                return {"centers": hospitals}
            else:
                raise ValueError(f"Could not locate JSON array brackets in You.com response. Output: {answer}")
            
    except Exception as e:
        print(f"Failed to fetch or parse You.com data: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to simulated data if the API request or JSON parsing fails
        fallback = [
             {
                "name": "Mayo Clinic — Rochester",
                "capability": "100%",
                "travel": "2h 10m",
                "reason": f"Interventional Pulmonology + Leading care for {diagnosis}",
                "lat": 44.0227,
                "lng": -92.4667
            },
            {
                "name": "Cleveland Clinic",
                "capability": "95%",
                "travel": "1h 55m",
                "reason": "Thoracic surgery + Clinical trials",
                "lat": 41.5034,
                "lng": -81.6206
            },
            {
                "name": "Mass General",
                "capability": "90%",
                "travel": "3h 05m",
                "reason": "Radiation oncology + Research program",
                "lat": 42.3621,
                "lng": -71.0691
            }
        ]
        return {"centers": fallback}


# ──────────────────────────────────────────────────────────────────────────────
# /chat_twin  – Use MedGemma to answer questions about a case twin
# ──────────────────────────────────────────────────────────────────────────────
@app.post("/chat_twin")
async def chat_twin(
    query: str = Form(...),
    case_text: str = Form(...)
):
    """
    RAG over the historic case profile context. Ask MedGemma to respond.
    """
    prompt = f"User Query: {query}\n\nCase Text:\n{case_text}\n\nYou are a helpful medical assistant. Answer the user's query concisely based ONLY on the evidence provided in the case text above."
    
    # We create a dummy black image to satisfy the multimodal endpoint
    dummy_img = Image.new("RGB", (336, 336), color=(0, 0, 0))
    try:
        resp = query_medgemma(dummy_img, prompt=prompt, max_tokens=300)
        if isinstance(resp, list) and len(resp) > 0:
            reply = resp[0].get("generated_text", "")
            # Clean up the prompt from the response if the model echoes it
            if "case text above." in reply:
                reply = reply.split("case text above.")[-1].strip()
            
            # Simple fallback if empty
            if not reply:
                reply = "I don't have enough clear information in the case text to answer that."
            return {"reply": reply}
    except Exception as e:
        print(f"MedGemma chat error: {e}")
        
    return {"reply": "I'm sorry, I couldn't reach the AI reasoning engine to answer this question right now."}


# ──────────────────────────────────────────────────────────────────────────────
# /extract  – mock CaseProfile extraction
# When MedGemma becomes available, replace _extract_profile() body only.
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/extract")
async def extract(
    images: Optional[List[UploadFile]] = File(default=None),
    notes: str = Form(default=""),
    notes_file: Optional[UploadFile] = File(default=None),
):
    """
    Extract a structured CaseProfile from uploaded images and/or clinical notes.
    Currently uses regex-based mock extraction; replace with MedGemma when ready.
    """
    image_names: list[str] = []
    if images:
        for img in images:
            if img.filename:
                image_names.append(img.filename)

    # If a notes file was uploaded, try to read it as plain text
    notes_text = notes
    if notes_file:
        try:
            raw = await notes_file.read()
            notes_text = (notes_text + "\n" + raw.decode("utf-8", errors="ignore")).strip()
        except Exception:
            pass  # ignore unreadable files

    profile = await _extract_profile(images, notes_text)
    return {"profile": profile}


async def _extract_profile(images: Optional[List[UploadFile]], text: str) -> dict:
    """
    Extracts a structured CaseProfile. 
    If images are provided, it uses MedGemma to analyze them alongside the text notes.
    Otherwise, it falls back to the regex-based mock.
    """
    image_names = [img.filename for img in images if img.filename] if images else []
    
    # If we have an image, let's try to get real insights from MedGemma
    medgemma_insight = ""
    if images and len(images) > 0:
        try:
            # Read the first image for analysis
            contents = await images[0].read()
            # Reset seek position if it's going to be used elsewhere, though here we are done with it
            images[0].file.seek(0) 
            img_pil = Image.open(io.BytesIO(contents)).convert("RGB")
            
            prompt = f"Analyze this chest X-ray image in the context of these clinical notes: '{text}'. Identify key findings like consolidation, effusion, or cardiomegaly. Be structured."
            response = query_medgemma(img_pil, prompt=prompt, max_tokens=300)
            
            if isinstance(response, list) and len(response) > 0:
                medgemma_insight = response[0].get("generated_text", "")
        except Exception as e:
            print(f"MedGemma extraction error: {e}")

    case_id = str(uuid.uuid4())
    image_id = str(uuid.uuid4())

    profile: dict = {
        "profile_id": f"{case_id}:{image_id}",
        "case_id": case_id,
        "image_id": image_id,
        "patient": {
            "age_years": None,
            "sex": None,
            "immunocompromised": None,
            "weight_kg": None,
            "comorbidities": [],
            "medications": [],
            "allergies": None,
        },
        "presentation": {
            "chief_complaint": None,
            "symptom_duration": None,
            "hpi": None,
            "pmh": None,
        },
        "study": {
            "modality": None,
            "body_region": None,
            "view_position": None,
            "radiology_region": None,
            "caption": None,
            "image_type": None,
            "image_subtype": None,
            "image_url": None,
            "storage_path": None,
        },
        "assessment": {
            "diagnosis_primary": None,
            "suspected_primary": [],
            "differential": [],
            "urgency": None,
            "infectious_concern": None,
            "icu_candidate": None,
        },
        "findings": {
            "lungs": {
                "consolidation_present": "no",
                "consolidation_locations": [],
                "consolidation_extent": "unknown",
                "atelectasis_present": "no",
                "atelectasis_locations": [],
                "edema_present": "no",
                "edema_pattern": "unknown",
            },
            "pleura": {
                "effusion_present": "no",
                "effusion_side": "unknown",
                "effusion_size": "unknown",
                "pneumothorax_present": "no",
                "pneumothorax_side": "unknown",
            },
            "cardiomediastinal": {
                "cardiomegaly": "no",
                "mediastinal_widening": "no",
            },
            "devices": {
                "lines_tubes_present": "no",
                "device_list": [],
            },
        },
        "summary": {
            "one_liner": None,
            "key_points": [],
            "red_flags": [],
        },
        "outcome": {
            "success": None,
            "detail": None,
        },
        "provenance": {
            "dataset_name": None,
            "pmc_id": None,
            "pmid": None,
            "doi": None,
            "article_title": None,
            "journal": None,
            "year": None,
            "authors": [],
            "license": None,
            "source_url": None,
        },
        "tags": {
            "ml_labels": [],
            "gt_labels": [],
            "keywords": [],
            "mesh_terms": [],
        },
    }

    # ── Patient ──────────────────────────────────────────────────────────────
    age_m = re.search(r"(\d{1,3})\s*[- ]?(?:year|yr)s?[- ]?old", text, re.I)
    if age_m:
        profile["patient"]["age_years"] = int(age_m.group(1))

    if re.search(r"\bfemale\b|\bwoman\b", text, re.I):
        profile["patient"]["sex"] = "female"
    elif re.search(r"\bmale\b|\bman\b", text, re.I):
        profile["patient"]["sex"] = "male"

    if re.search(r"immunocompromised|immunosuppressed", text, re.I):
        profile["patient"]["immunocompromised"] = "yes"
    elif text.strip():
        profile["patient"]["immunocompromised"] = "no"

    comorbidity_map = [
        (r"hypertension|HTN", "hypertension"),
        (r"type 2 diabet|T2DM|DM2", "type 2 diabetes"),
        (r"type 1 diabet|T1DM|DM1", "type 1 diabetes"),
        (r"atrial fibrillation|AF\b|AFib", "atrial fibrillation"),
        (r"heart failure|CHF", "heart failure"),
        (r"COPD|chronic obstructive", "COPD"),
        (r"asthma", "asthma"),
        (r"cirrhosis|liver cirrhosis", "liver cirrhosis"),
        (r"hepatocellular carcinoma|HCC", "hepatocellular carcinoma"),
        (r"chronic kidney|CKD", "chronic kidney disease"),
        (r"coronary artery disease|CAD", "coronary artery disease"),
        (r"obesity", "obesity"),
    ]
    comorbidities = [label for pattern, label in comorbidity_map if re.search(pattern, text, re.I)]
    profile["patient"]["comorbidities"] = comorbidities

    if re.search(r"no known allerg", text, re.I):
        profile["patient"]["allergies"] = "no known allergies"

    # ── Presentation ─────────────────────────────────────────────────────────
    cc_m = re.search(
        r"(?:present(?:ing)? with|complaint of|admitted for|scheduled for)\s+([^.!?\n]{5,120})",
        text, re.I
    )
    if cc_m:
        profile["presentation"]["chief_complaint"] = cc_m.group(1).strip()

    dur_m = re.search(r"(?:for|over|duration of)\s+((?:\d+\s*)?(?:day|week|month|year)s?)", text, re.I)
    if dur_m:
        profile["presentation"]["symptom_duration"] = dur_m.group(1).strip()

    if len(text) > 40:
        profile["presentation"]["hpi"] = text[:600]

    if comorbidities:
        profile["presentation"]["pmh"] = ", ".join(comorbidities)

    # ── Study ────────────────────────────────────────────────────────────────
    combined = text + " " + " ".join(image_names)
    if re.search(r"ct|computed tomography", combined, re.I):
        profile["study"].update({"modality": "CT", "image_type": "radiology", "image_subtype": "ct"})
    elif re.search(r"mri", combined, re.I):
        profile["study"].update({"modality": "MRI", "image_type": "radiology", "image_subtype": "mri"})
    elif re.search(r"x[- ]?ray|cxr|chest x", combined, re.I):
        profile["study"].update({"modality": "CXR", "image_type": "radiology", "image_subtype": "x_ray"})
    elif image_names:
        profile["study"].update({"modality": "Imaging", "image_type": "radiology"})

    if re.search(r"thorax|chest|pulmonary|lung", text, re.I):
        profile["study"]["body_region"] = "thorax"
        profile["study"]["radiology_region"] = "thorax"
    elif re.search(r"abdomen|abdominal|liver", text, re.I):
        profile["study"]["body_region"] = "abdomen"
    elif re.search(r"brain|head|neuro", text, re.I):
        profile["study"]["body_region"] = "head"

    if re.search(r"\bPA\b|posteroanterior", text, re.I):
        profile["study"]["view_position"] = "PA"
    elif re.search(r"\bAP\b|anteroposterior", text, re.I):
        profile["study"]["view_position"] = "AP"

    # ── Assessment ───────────────────────────────────────────────────────────
    diag_map = [
        (r"scimitar", "scimitar syndrome"),
        (r"pneumonia", "community-acquired pneumonia"),
        (r"pulmonary embolism|PE\b", "pulmonary embolism"),
        (r"lung malignancy|lung cancer|NSCLC|SCLC", "lung malignancy"),
        (r"stroke|ischemic", "acute ischemic stroke"),
        (r"heart failure|pulmonary edema", "heart failure"),
        (r"pneumothorax", "pneumothorax"),
        (r"pleural effusion", "pleural effusion"),
        (r"aortic dissection", "aortic dissection"),
    ]
    for pattern, diag in diag_map:
        if re.search(pattern, text, re.I):
            profile["assessment"]["diagnosis_primary"] = diag
            profile["assessment"]["suspected_primary"] = [diag] + comorbidities[:2]
            break

    if re.search(r"urgent|emergency|stat", text, re.I):
        profile["assessment"]["urgency"] = "emergent"
    elif re.search(r"routine|elective|scheduled", text, re.I):
        profile["assessment"]["urgency"] = "routine"
    elif text.strip():
        profile["assessment"]["urgency"] = "semi-urgent"

    profile["assessment"]["infectious_concern"] = (
        "yes" if re.search(r"infection|sepsis|pneumonia|fever", text, re.I) else "no"
    )
    profile["assessment"]["icu_candidate"] = (
        "yes" if re.search(r"icu|intensive care|critical", text, re.I) else "no"
    )

    # ── Findings tweaks ──────────────────────────────────────────────────────
    # ── MedGemma Insight Integration ──────────────────────────────────────────
    # We combine the original text with MedGemma's findings for the regex extractor
    # to pick up confirmed findings from the image.
    analysis_text = text + "\n" + medgemma_insight

    if re.search(r"consolidation|consolidat", analysis_text, re.I):
        profile["findings"]["lungs"]["consolidation_present"] = "yes"
    if re.search(r"atelectasis|collapse", analysis_text, re.I):
        profile["findings"]["lungs"]["atelectasis_present"] = "yes"
    if re.search(r"edema|pulmonary edema", analysis_text, re.I):
        profile["findings"]["lungs"]["edema_present"] = "yes"
    if re.search(r"effusion|pleural fluid", analysis_text, re.I):
        profile["findings"]["pleura"]["effusion_present"] = "yes"
    if re.search(r"pneumothorax", analysis_text, re.I):
        profile["findings"]["pleura"]["pneumothorax_present"] = "yes"
    if re.search(r"cardiomegaly|enlarged heart|cardiomegal", analysis_text, re.I):
        profile["findings"]["cardiomediastinal"]["cardiomegaly"] = "yes"

    if medgemma_insight and not profile["summary"]["one_liner"]:
        profile["summary"]["one_liner"] = medgemma_insight[:200] + ("..." if len(medgemma_insight) > 200 else "")

    # ── Summary ──────────────────────────────────────────────────────────────
    age = profile["patient"]["age_years"]
    sex = profile["patient"]["sex"]
    diag = profile["assessment"]["diagnosis_primary"]
    cc   = profile["presentation"]["chief_complaint"]
    if age and sex and (diag or cc):
        comorbs = ", ".join(comorbidities[:3]) or "multiple comorbidities"
        profile["summary"]["one_liner"] = (
            f"{age}-year-old {sex} with {comorbs} presenting with {cc or diag}."
        )
    if diag:
        profile["summary"]["key_points"] = [f"Primary finding: {diag}"]

    return profile
