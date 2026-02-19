import type { CaseProfile } from "./caseProfileTypes";
import { emptyProfile } from "./caseProfileTypes";

const API_BASE = "http://localhost:8000";

// ─── Confidence scoring ────────────────────────────────────────────────────

interface ConfidenceField {
    label: string;
    filled: (p: CaseProfile) => boolean;
}

const CONFIDENCE_FIELDS: ConfidenceField[] = [
    { label: "Patient age", filled: (p) => p.patient.age_years != null },
    { label: "Patient sex", filled: (p) => Boolean(p.patient.sex) },
    { label: "Comorbidities", filled: (p) => p.patient.comorbidities.length > 0 },
    { label: "Chief complaint", filled: (p) => Boolean(p.presentation.chief_complaint) },
    { label: "HPI", filled: (p) => Boolean(p.presentation.hpi) },
    { label: "PMH", filled: (p) => Boolean(p.presentation.pmh) },
    { label: "Imaging modality", filled: (p) => Boolean(p.study.modality) },
    { label: "Body region", filled: (p) => Boolean(p.study.body_region) },
    { label: "Image available", filled: (p) => Boolean(p.study.image_url) },
    { label: "Primary diagnosis", filled: (p) => Boolean(p.assessment.diagnosis_primary) },
    { label: "Urgency", filled: (p) => Boolean(p.assessment.urgency) },
    { label: "Summary one-liner", filled: (p) => Boolean(p.summary.one_liner) },
    { label: "Key points", filled: (p) => p.summary.key_points.length > 0 },
];

export function computeProfileConfidence(profile: CaseProfile): {
    score: number;
    filled: number;
    total: number;
    missing: string[];
} {
    const total = CONFIDENCE_FIELDS.length;
    const filledFields = CONFIDENCE_FIELDS.filter((f) => f.filled(profile));
    const missingFields = CONFIDENCE_FIELDS.filter((f) => !f.filled(profile));

    return {
        score: Math.round((filledFields.length / total) * 100),
        filled: filledFields.length,
        total,
        missing: missingFields.map((f) => f.label),
    };
}

// ─── Extraction ────────────────────────────────────────────────────────────

export async function extractCaseProfile(
    images: File[],
    notes: string,
    notesFile: File | null
): Promise<CaseProfile> {
    // Try backend first
    try {
        const form = new FormData();
        images.forEach((img) => form.append("images", img));
        if (notesFile) form.append("notes_file", notesFile);
        form.append("notes", notes);

        const res = await fetch(`${API_BASE}/extract`, {
            method: "POST",
            body: form,
        });

        if (res.ok) {
            const data = await res.json() as { profile: CaseProfile };
            return data.profile;
        }
    } catch {
        // backend offline — fall through to client-side mock
    }

    // Client-side mock extraction
    await delay(1200);
    return clientSideExtract(images, notes);
}

// ─── Client-side mock extraction (regex-based) ─────────────────────────────

function clientSideExtract(images: File[], notes: string): CaseProfile {
    const p = emptyProfile();
    const id = crypto.randomUUID();
    p.profile_id = `${id}:${crypto.randomUUID()}`;
    p.case_id = id;
    p.image_id = crypto.randomUUID();

    const text = notes.trim();

    // --- patient ---
    const ageMatch = text.match(/(\d{1,3})\s*[- ]?(?:year|yr)s?[- ]?old/i);
    if (ageMatch?.[1]) p.patient.age_years = parseInt(ageMatch[1], 10);

    if (/\bfemale\b|\bwoman\b|\bF\b/i.test(text)) p.patient.sex = "female";
    else if (/\bmale\b|\bman\b|\bM\b/i.test(text)) p.patient.sex = "male";

    if (/immunocompromised|immunosuppressed/i.test(text))
        p.patient.immunocompromised = "yes";
    else if (text.length > 20) p.patient.immunocompromised = "no";

    const comorbidityPatterns: [RegExp, string][] = [
        [/hypertension|HTN/i, "hypertension"],
        [/type 2 diabet|T2DM|DM2/i, "type 2 diabetes"],
        [/type 1 diabet|T1DM|DM1/i, "type 1 diabetes"],
        [/atrial fibrillation|AF\b|AFib/i, "atrial fibrillation"],
        [/heart failure|CHF/i, "heart failure"],
        [/COPD|chronic obstructive/i, "COPD"],
        [/asthma/i, "asthma"],
        [/cirrhosis|liver cirrhosis/i, "liver cirrhosis"],
        [/hepatocellular carcinoma|HCC/i, "hepatocellular carcinoma"],
        [/chronic kidney|CKD/i, "chronic kidney disease"],
        [/coronary artery disease|CAD/i, "coronary artery disease"],
        [/obesity/i, "obesity"],
        [/malignancy|cancer/i, "malignancy"],
    ];
    p.patient.comorbidities = comorbidityPatterns
        .filter(([re]) => re.test(text))
        .map(([, label]) => label);

    if (/no known allerg/i.test(text)) p.patient.allergies = "no known allergies";

    // --- presentation ---
    const chiefComplaintMatch = text.match(
        /(?:present(?:ing)? with|complaint of|admitted for|scheduled for)\s+([^.!?\n]{5,100})/i
    );
    if (chiefComplaintMatch?.[1])
        p.presentation.chief_complaint = chiefComplaintMatch[1].trim();

    const durationMatch = text.match(
        /(?:for|over|duration of)\s+((?:\d+\s*)?(?:day|week|month|year)s?)/i
    );
    if (durationMatch?.[1]) p.presentation.symptom_duration = durationMatch[1].trim();

    if (text.length > 40) p.presentation.hpi = text.slice(0, 500);

    const pmhPatterns: string[] = [];
    comorbidityPatterns.forEach(([re, label]) => {
        if (re.test(text)) pmhPatterns.push(label);
    });
    if (pmhPatterns.length > 0) p.presentation.pmh = pmhPatterns.join(", ");

    // --- study ---
    if (images.length > 0) {
        const firstName = images[0].name.toLowerCase();
        if (/ct|computed tomography/i.test(text + firstName)) {
            p.study.modality = "CT";
            p.study.image_type = "radiology";
            p.study.image_subtype = "ct";
        } else if (/mri/i.test(text + firstName)) {
            p.study.modality = "MRI";
            p.study.image_type = "radiology";
            p.study.image_subtype = "mri";
        } else if (/x[- ]?ray|cxr|chest x/i.test(text + firstName)) {
            p.study.modality = "CXR";
            p.study.image_type = "radiology";
            p.study.image_subtype = "x_ray";
        } else {
            p.study.modality = "Imaging";
            p.study.image_type = "radiology";
        }

        if (/thorax|chest|pulmonary|lung/i.test(text)) {
            p.study.body_region = "thorax";
            p.study.radiology_region = "thorax";
        } else if (/abdomen|abdominal|liver/i.test(text)) {
            p.study.body_region = "abdomen";
        } else if (/brain|head|neuro/i.test(text)) {
            p.study.body_region = "head";
        }

        if (/PA|posteroanterior/i.test(text)) p.study.view_position = "PA";
        else if (/AP|anteroposterior/i.test(text)) p.study.view_position = "AP";
        else if (/lateral/i.test(text)) p.study.view_position = "lateral";

        // Attach local object URL for the first image thumbnail
        p.study.image_url = URL.createObjectURL(images[0]);
    }

    // --- assessment ---
    const diagMap: [RegExp, string][] = [
        [/scimitar/i, "scimitar syndrome"],
        [/pneumonia/i, "community-acquired pneumonia"],
        [/pulmonary embolism|PE\b/i, "pulmonary embolism"],
        [/lung malignancy|lung cancer|NSCLC|SCLC/i, "lung malignancy"],
        [/stroke|ischemic/i, "acute ischemic stroke"],
        [/heart failure|pulmonary edema/i, "heart failure"],
        [/pneumothorax/i, "pneumothorax"],
        [/pleural effusion/i, "pleural effusion"],
        [/aortic dissection/i, "aortic dissection"],
    ];

    for (const [re, diag] of diagMap) {
        if (re.test(text)) {
            p.assessment.diagnosis_primary = diag;
            p.assessment.suspected_primary = [diag, ...p.patient.comorbidities.slice(0, 2)];
            break;
        }
    }

    if (/urgent|emergency|stat/i.test(text)) p.assessment.urgency = "emergent";
    else if (/routine|elective|scheduled/i.test(text)) p.assessment.urgency = "routine";
    else if (text.length > 20) p.assessment.urgency = "semi-urgent";

    if (/infection|sepsis|pneumonia|fever/i.test(text))
        p.assessment.infectious_concern = "yes";
    else if (text.length > 20) p.assessment.infectious_concern = "no";

    if (/icu|intensive care|critical/i.test(text)) p.assessment.icu_candidate = "yes";

    // --- summary ---
    if (p.patient.age_years && p.patient.sex && p.assessment.diagnosis_primary) {
        const meds = p.patient.comorbidities.slice(0, 3).join(", ");
        p.summary.one_liner = `${p.patient.age_years}-year-old ${p.patient.sex} with ${meds || "multiple comorbidities"} presenting with ${p.presentation.chief_complaint ?? p.assessment.diagnosis_primary}.`;
    }

    if (p.assessment.diagnosis_primary)
        p.summary.key_points = [`Primary finding: ${p.assessment.diagnosis_primary}`];

    return p;
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
