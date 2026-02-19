import { cn } from "@/lib/utils";
import type {
    AssessmentInfo,
    CardiomediastinalFindings,
    CaseProfile,
    DevicesFindings,
    FindingsInfo,
    LungsFindings,
    OutcomeInfo,
    PatientInfo,
    PleuraFindings,
    PresentationInfo,
    ProvenanceInfo,
    StudyInfo,
    SummaryInfo,
    TagsInfo,
} from "@/lib/caseProfileTypes";
import {
    Activity,
    AlertTriangle,
    BookOpen,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    ExternalLink,
    FileImage,
    Heart,
    Layers,
    Microscope,
    Stethoscope,
    Tag,
    User,
    Wind,
    XCircle,
    Zap,
} from "lucide-react";

// ─── Helper atoms ─────────────────────────────────────────────────────────────

function SectionCard({
    icon,
    title,
    accent = "blue",
    children,
    className,
}: {
    icon: React.ReactNode;
    title: string;
    accent?: "blue" | "emerald" | "amber" | "rose" | "violet" | "slate" | "cyan";
    children: React.ReactNode;
    className?: string;
}) {
    const accentMap = {
        blue: "bg-blue-50   text-blue-600   border-blue-100",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        amber: "bg-amber-50  text-amber-600  border-amber-100",
        rose: "bg-rose-50   text-rose-600   border-rose-100",
        violet: "bg-violet-50 text-violet-600 border-violet-100",
        slate: "bg-slate-50  text-slate-500  border-slate-100",
        cyan: "bg-cyan-50   text-cyan-600   border-cyan-100",
    };

    return (
        <div className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-sm", className)}>
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
                <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg border", accentMap[accent])}>
                    {icon}
                </span>
                <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            </div>
            <div className="px-4 py-4 space-y-3">{children}</div>
        </div>
    );
}

function Field({
    label,
    value,
    wide,
}: {
    label: string;
    value: React.ReactNode;
    wide?: boolean;
}) {
    return (
        <div className={cn("space-y-0.5", wide && "col-span-2")}>
            <p className="text-[11px] uppercase tracking-wide font-medium text-slate-400">{label}</p>
            <div className="text-[14px] leading-5 text-slate-800">{value}</div>
        </div>
    );
}

function Chip({ label, variant = "neutral" }: { label: string; variant?: "neutral" | "primary" | "success" | "warning" | "danger" }) {
    const map = {
        neutral: "bg-slate-100 text-slate-600 border-slate-200",
        primary: "bg-blue-100  text-blue-700  border-blue-200",
        success: "bg-emerald-100 text-emerald-700 border-emerald-200",
        warning: "bg-amber-100 text-amber-700 border-amber-200",
        danger: "bg-rose-100  text-rose-700  border-rose-200",
    };
    return (
        <span className={cn("inline-flex items-center h-6 rounded-full border px-2.5 text-[11px] font-medium", map[variant])}>
            {label}
        </span>
    );
}

function YesNoBadge({ value }: { value: string | null }) {
    if (!value) return <span className="text-slate-400 text-sm">—</span>;
    const isYes = value.toLowerCase() === "yes";
    const isNo = value.toLowerCase() === "no";
    if (isYes) return <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-medium"><CheckCircle2 className="h-3.5 w-3.5" />{value}</span>;
    if (isNo) return <span className="inline-flex items-center gap-1 text-slate-500 text-sm font-medium"><XCircle className="h-3.5 w-3.5" />{value}</span>;
    return <span className="text-slate-700 text-sm">{value}</span>;
}

function isEmpty(val: any): boolean {
    if (val === null || val === undefined) return true;
    if (typeof val === "string" && val.trim() === "") return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function PatientSection({ patient }: { patient: PatientInfo }) {
    const hasAny = !isEmpty(patient.age_years) || !isEmpty(patient.sex) || !isEmpty(patient.weight_kg) ||
        !isEmpty(patient.immunocompromised) || !isEmpty(patient.comorbidities) ||
        !isEmpty(patient.medications) || !isEmpty(patient.allergies);

    if (!hasAny) return null;

    return (
        <SectionCard icon={<User className="h-4 w-4" />} title="Patient" accent="blue">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {!isEmpty(patient.age_years) && <Field label="Age" value={`${patient.age_years} yrs`} />}
                {!isEmpty(patient.sex) && <Field label="Sex" value={patient.sex} />}
                {!isEmpty(patient.weight_kg) && <Field label="Weight" value={`${patient.weight_kg} kg`} />}
                {!isEmpty(patient.immunocompromised) && <Field label="Immunocompromised" value={<YesNoBadge value={patient.immunocompromised} />} />}

                {!isEmpty(patient.comorbidities) && (
                    <Field wide label="Comorbidities" value={
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {patient.comorbidities.map((c) => <Chip key={c} label={c} variant="neutral" />)}
                        </div>
                    } />
                )}

                {!isEmpty(patient.medications) && (
                    <Field wide label="Medications" value={
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {patient.medications.map((m) => <Chip key={m} label={m} variant="primary" />)}
                        </div>
                    } />
                )}

                {!isEmpty(patient.allergies) && <Field label="Allergies" value={patient.allergies} />}
            </div>
        </SectionCard>
    );
}

function PresentationSection({ pres }: { pres: PresentationInfo }) {
    const hasAny = !isEmpty(pres.chief_complaint) || !isEmpty(pres.symptom_duration) ||
        !isEmpty(pres.hpi) || !isEmpty(pres.pmh);

    if (!hasAny) return null;

    return (
        <SectionCard icon={<Stethoscope className="h-4 w-4" />} title="Presentation" accent="violet">
            <div className="space-y-3">
                {!isEmpty(pres.chief_complaint) && <Field label="Chief Complaint" value={pres.chief_complaint} />}
                {!isEmpty(pres.symptom_duration) && <Field label="Symptom Duration" value={pres.symptom_duration} />}
                {!isEmpty(pres.hpi) && (
                    <Field label="HPI" value={
                        <p className="text-[13px] leading-5 text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-100">{pres.hpi}</p>
                    } />
                )}
                {!isEmpty(pres.pmh) && <Field label="PMH" value={pres.pmh} />}
            </div>
        </SectionCard>
    );
}

function StudySection({ study }: { study: StudyInfo }) {
    const hasAny = !isEmpty(study.image_url) || !isEmpty(study.modality) ||
        !isEmpty(study.view_position) || !isEmpty(study.body_region) ||
        !isEmpty(study.image_type) || !isEmpty(study.image_subtype);

    if (!hasAny) return null;

    return (
        <SectionCard icon={<FileImage className="h-4 w-4" />} title="Imaging Study" accent="cyan">
            <div className="space-y-3">
                {!isEmpty(study.image_url) && (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                        <img
                            src={study.image_url as string}
                            alt={study.caption ?? "Medical image"}
                            className="w-full max-h-64 object-contain bg-slate-900"
                        />
                        {!isEmpty(study.caption) && (
                            <p className="px-3 py-2 text-[12px] text-slate-500 bg-slate-50 border-t border-slate-100">{study.caption}</p>
                        )}
                    </div>
                )}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {!isEmpty(study.modality) && <Field label="Modality" value={<Chip label={study.modality as string} variant="primary" />} />}
                    {!isEmpty(study.view_position) && <Field label="View Position" value={study.view_position as string} />}
                    {!isEmpty(study.body_region) && <Field label="Body Region" value={study.body_region as string} />}
                    {!isEmpty(study.image_subtype ?? study.image_type) && <Field label="Image Type" value={(study.image_subtype ?? study.image_type) as string} />}
                </div>
            </div>
        </SectionCard>
    );
}

function AssessmentSection({ assessment }: { assessment: AssessmentInfo }) {
    const hasAny = !isEmpty(assessment.diagnosis_primary) || !isEmpty(assessment.suspected_primary) ||
        !isEmpty(assessment.differential) || !isEmpty(assessment.urgency) ||
        !isEmpty(assessment.infectious_concern) || !isEmpty(assessment.icu_candidate);

    if (!hasAny) return null;

    const urgencyVariant = (u: string | null) => {
        if (!u) return "neutral" as const;
        if (/emergent/i.test(u)) return "danger" as const;
        if (/semi/i.test(u)) return "warning" as const;
        return "neutral" as const;
    };

    return (
        <SectionCard icon={<Microscope className="h-4 w-4" />} title="Assessment" accent="emerald">
            <div className="space-y-3">
                {!isEmpty(assessment.diagnosis_primary) && (
                    <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide font-medium text-emerald-500 mb-0.5">Primary Diagnosis</p>
                        <p className="text-[15px] font-semibold text-emerald-800 capitalize">{assessment.diagnosis_primary}</p>
                    </div>
                )}

                {!isEmpty(assessment.suspected_primary) && (
                    <Field label="Suspected (Primary)" value={
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {assessment.suspected_primary.map((d) => <Chip key={d} label={d} variant="success" />)}
                        </div>
                    } />
                )}

                {!isEmpty(assessment.differential) && (
                    <Field label="Differential" value={
                        <ul className="space-y-0.5">
                            {assessment.differential.map((d) => (
                                <li key={d} className="flex items-center gap-1.5 text-[13px] text-slate-700">
                                    <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" /> {d}
                                </li>
                            ))}
                        </ul>
                    } />
                )}

                <div className="grid grid-cols-2 gap-3">
                    {!isEmpty(assessment.urgency) && (
                        <Field label="Urgency" value={<Chip label={assessment.urgency!} variant={urgencyVariant(assessment.urgency)} />} />
                    )}
                    {!isEmpty(assessment.infectious_concern) && (
                        <Field label="Infection" value={<YesNoBadge value={assessment.infectious_concern} />} />
                    )}
                    {!isEmpty(assessment.icu_candidate) && (
                        <Field label="ICU Candidate" value={<YesNoBadge value={assessment.icu_candidate} />} />
                    )}
                </div>
            </div>
        </SectionCard>
    );
}

function FindingRow({ label, value }: { label: string; value: string | null }) {
    if (isEmpty(value)) return null;
    return (
        <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
            <span className="text-[12px] text-slate-500">{label}</span>
            <span className="text-[13px] font-medium text-slate-700">{value}</span>
        </div>
    );
}

function FindingsSection({ findings }: { findings: FindingsInfo }) {
    const { lungs, pleura, cardiomediastinal, devices } = findings;

    const hasLungs = !isEmpty(lungs.consolidation_present) || !isEmpty(lungs.atelectasis_present) ||
        !isEmpty(lungs.edema_present) || (!isEmpty(lungs.edema_pattern) && lungs.edema_pattern !== "unknown");

    const hasPleura = !isEmpty(pleura.effusion_present) || !isEmpty(pleura.pneumothorax_present) ||
        (!isEmpty(pleura.effusion_side) && pleura.effusion_side !== "unknown");

    const hasCardio = !isEmpty(cardiomediastinal.cardiomegaly) || !isEmpty(cardiomediastinal.mediastinal_widening);

    const hasDevices = !isEmpty(devices.lines_tubes_present) || !isEmpty(devices.device_list);

    if (!hasLungs && !hasPleura && !hasCardio && !hasDevices) return null;

    return (
        <SectionCard icon={<Wind className="h-4 w-4" />} title="Findings" accent="slate">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {hasLungs && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-sm">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400 mb-2">Lungs</p>
                        <FindingRow label="Consolidation" value={lungs.consolidation_present} />
                        <FindingRow label="Atelectasis" value={lungs.atelectasis_present} />
                        <FindingRow label="Edema" value={lungs.edema_present} />
                        {lungs.edema_pattern && lungs.edema_pattern !== "unknown" && (
                            <FindingRow label="Edema pattern" value={lungs.edema_pattern} />
                        )}
                    </div>
                )}

                {hasPleura && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-sm">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400 mb-2">Pleura</p>
                        <FindingRow label="Effusion" value={pleura.effusion_present} />
                        {pleura.effusion_side && pleura.effusion_side !== "unknown" && (
                            <FindingRow label="Effusion side" value={pleura.effusion_side} />
                        )}
                        <FindingRow label="Pneumothorax" value={pleura.pneumothorax_present} />
                    </div>
                )}

                {hasCardio && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-sm">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400 mb-2">Cardiomediastinal</p>
                        <FindingRow label="Cardiomegaly" value={cardiomediastinal.cardiomegaly} />
                        <FindingRow label="Mediastinal widening" value={cardiomediastinal.mediastinal_widening} />
                    </div>
                )}

                {hasDevices && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-sm">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400 mb-2">Devices / Lines</p>
                        <FindingRow label="Present" value={devices.lines_tubes_present} />
                        {!isEmpty(devices.device_list) && (
                            <div className="pt-1.5 flex flex-wrap gap-1">
                                {devices.device_list.map((d) => (
                                    <span key={d} className="inline-flex items-center h-5 rounded-full bg-slate-200 text-slate-600 px-2 text-[11px] font-medium">{d}</span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </SectionCard>
    );
}

function SummarySection({ summary }: { summary: SummaryInfo }) {
    const hasAny = !isEmpty(summary.one_liner) || !isEmpty(summary.key_points) || !isEmpty(summary.red_flags);

    if (!hasAny) return null;

    return (
        <SectionCard icon={<ClipboardList className="h-4 w-4" />} title="Summary" accent="amber">
            <div className="space-y-3">
                {!isEmpty(summary.one_liner) && (
                    <p className="text-[14px] leading-5 text-slate-700 font-medium italic">"{summary.one_liner}"</p>
                )}

                {!isEmpty(summary.key_points) && (
                    <div>
                        <p className="text-[11px] uppercase tracking-wide font-medium text-slate-400 mb-1.5">Key Points</p>
                        <ul className="space-y-1.5">
                            {summary.key_points.map((kp) => (
                                <li key={kp} className="flex items-start gap-2 text-[13px] text-slate-700">
                                    <Activity className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                    {kp}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {!isEmpty(summary.red_flags) && (
                    <div>
                        <p className="text-[11px] uppercase tracking-wide font-medium text-rose-400 mb-1.5 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Red Flags
                        </p>
                        <ul className="space-y-1.5">
                            {summary.red_flags.map((rf) => (
                                <li key={rf} className="flex items-start gap-2 text-[13px] text-rose-700 bg-rose-50 rounded-lg px-3 py-1.5 border border-rose-100">
                                    <Zap className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                                    {rf}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}

function OutcomeSection({ outcome }: { outcome: OutcomeInfo }) {
    const hasAny = !isEmpty(outcome.success) || !isEmpty(outcome.detail);
    if (!hasAny) return null;

    return (
        <SectionCard icon={<Heart className="h-4 w-4" />} title="Outcome" accent="emerald">
            <div className="flex items-start gap-3">
                {!isEmpty(outcome.success) && (
                    <span className={cn(
                        "inline-flex items-center gap-1.5 h-7 rounded-full border px-3 text-sm font-semibold shrink-0",
                        outcome.success === "yes"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                    )}>
                        {outcome.success === "yes"
                            ? <CheckCircle2 className="h-3.5 w-3.5" />
                            : <XCircle className="h-3.5 w-3.5" />}
                        {outcome.success === "yes" ? "Successful" : "Unsuccessful"}
                    </span>
                )}
                {!isEmpty(outcome.detail) && (
                    <p className="text-[13px] leading-5 text-slate-700">{outcome.detail}</p>
                )}
            </div>
        </SectionCard>
    );
}

function ProvenanceSection({ prov }: { prov: ProvenanceInfo }) {
    const hasData = prov.article_title || prov.journal || prov.pmc_id;
    if (!hasData) return null;

    return (
        <SectionCard icon={<BookOpen className="h-4 w-4" />} title="Source / Provenance" accent="slate">
            <div className="space-y-2">
                {prov.article_title && (
                    <p className="text-[13px] font-medium text-slate-800 leading-5">{prov.article_title}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
                    {prov.journal && <span>{prov.journal}</span>}
                    {prov.year && <span>{prov.year}</span>}
                    {prov.pmid && <span>PMID: {prov.pmid}</span>}
                </div>
                {prov.authors.length > 0 && (
                    <p className="text-[12px] text-slate-500">{prov.authors.join(", ")}</p>
                )}
                {prov.doi && (
                    <a
                        href={`https://doi.org/${prov.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-700 transition-colors"
                    >
                        DOI: {prov.doi} <ExternalLink className="h-3 w-3" />
                    </a>
                )}
                {prov.source_url && !prov.doi && (
                    <a
                        href={prov.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-700 transition-colors"
                    >
                        View source <ExternalLink className="h-3 w-3" />
                    </a>
                )}
            </div>
        </SectionCard>
    );
}

function TagsSection({ tags }: { tags: TagsInfo }) {
    const allKeywords = [...new Set([...tags.keywords, ...tags.ml_labels, ...tags.gt_labels])];
    const hasData = allKeywords.length > 0 || tags.mesh_terms.length > 0;
    if (!hasData) return null;

    return (
        <SectionCard icon={<Tag className="h-4 w-4" />} title="Tags & Labels" accent="violet">
            <div className="space-y-2.5">
                {allKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {allKeywords.map((k) => <Chip key={k} label={k} variant="neutral" />)}
                    </div>
                )}
                {tags.mesh_terms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {tags.mesh_terms.map((m) => <Chip key={m} label={`MeSH: ${m}`} variant="primary" />)}
                    </div>
                )}
            </div>
        </SectionCard>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function CaseProfileView({ profile, className }: { profile: CaseProfile; className?: string }) {
    const sections = [
        <PatientSection key="patient" patient={profile.patient} />,
        <PresentationSection key="presentation" pres={profile.presentation} />,
        <StudySection key="study" study={profile.study} />,
        <AssessmentSection key="assessment" assessment={profile.assessment} />,
        <FindingsSection key="findings" findings={profile.findings} />,
        <SummarySection key="summary" summary={profile.summary} />,
        <OutcomeSection key="outcome" outcome={profile.outcome} />,
        <ProvenanceSection key="provenance" prov={profile.provenance} />,
        <TagsSection key="tags" tags={profile.tags} />,
    ];

    return (
        <div className={cn("space-y-4", className)}>
            {sections}
        </div>
    );
}

// Re-export for convenience
export type { CaseProfile };
