import { CaseProfile } from "./caseProfileTypes";

export interface AgenticFollowup {
    thought: string;
    message: string;
    priority_fields: string[];
}

/**
 * High-priority fields that we want to nudge the user to provide
 */
const PRIORITY_CHECKLIST = [
    { key: "patient.age_years", label: "patient's age", category: "Patient" },
    { key: "patient.sex", label: "patient's sex", category: "Patient" },
    { key: "presentation.chief_complaint", label: "chief complaint", category: "Presentation" },
    { key: "presentation.hpi", label: "clinical history (HPI)", category: "Presentation" },
    { key: "assessment.diagnosis_primary", label: "primary diagnosis", category: "Assessment" },
    { key: "study.modality", label: "imaging modality", category: "Imaging" },
];

function getNestedValue(obj: any, path: string) {
    return path.split('.').reduce((prev, curr) => prev && prev[curr], obj);
}

export function generateAgenticFollowup(profile: CaseProfile, confidence: number): AgenticFollowup {
    const missingPriority = PRIORITY_CHECKLIST.filter(item => {
        const val = getNestedValue(profile, item.key);
        return val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0);
    });

    let thought = "";
    let message = "";

    if (confidence === 0) {
        thought = "Case is empty. Need initial data.";
        message = "Clinical assistant online. Share imaging impressions, symptom timeline, or referral details and I will structure the case profile.";
    } else if (confidence < 30) {
        const first = missingPriority[0];
        thought = `Very low confidence (${confidence}%). Nudging for ${first?.label || "more data"}.`;
        message = `I've started building the profile, but it's quite sparse. Could you provide the ${first?.label || "clinical narrative"} or upload any relevant imaging?`;
    } else if (confidence < 60) {
        const first = missingPriority[0];
        thought = `Moderate progress (${confidence}%). Focus on ${first?.category || "details"}.`;
        message = `I've captured the basics. To strengthen the assessment, could you tell me more about the ${first?.label || "patient's presentation"}?`;
    } else if (confidence < 85) {
        const first = missingPriority[0];
        thought = `High confidence (${confidence}%). Polishing phase.`;
        if (first) {
            message = `The profile is looking great! One minor detail: do we have information on the ${first.label}? That would really complete the record.`;
        } else {
            message = `This is a very comprehensive profile. Would you like to add any specific summary points or red flags?`;
        }
    } else {
        thought = "Comprehensive profile reached.";
        message = "Excellent. This case profile is now highly detailed and ready for routing or review.";
    }

    return {
        thought,
        message,
        priority_fields: missingPriority.map(m => m.key)
    };
}
