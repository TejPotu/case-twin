import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type MatchItem } from "@/lib/mockUploadApis";
import { Clock, FileText, User, Microscope, Activity, Link as LinkIcon, Calendar, Image as ImageIcon, Pill, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TwinProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    match: MatchItem | null;
}

export function TwinProfileModal({ isOpen, onClose, match }: TwinProfileModalProps) {
    if (!match) return null;

    const p = match.raw_payload || {};
    const patient = p.patient || {};
    const presentation = p.presentation || {};
    const findings = p.findings || {};
    const relatedImgs: any[] = p.related_images || [];

    return (
        <Dialog open={isOpen}>
            <DialogContent onClose={onClose} className="max-w-4xl p-0 overflow-hidden bg-zinc-50 border-zinc-200 shadow-xl sm:rounded-2xl">
                <div className="flex flex-col h-[85vh] max-h-[800px]">
                    {/* Header */}
                    <div className="flex-shrink-0 px-6 py-5 border-b bg-white border-zinc-100 flex items-start justify-between gap-4">
                        <div className="flex gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm">
                                <FileText className="h-5 w-5 text-zinc-600" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-zinc-900 leading-tight mb-1">
                                    Historical Case Profile
                                </DialogTitle>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                                    <Badge variant="secondary" className="bg-zinc-50 border border-zinc-200 shadow-sm text-zinc-700">Similarity: {match.score}%</Badge>
                                    {match.pmc_id && (
                                        <a href={p.provenance?.source_url || `https://www.ncbi.nlm.nih.gov/pmc/articles/${match.pmc_id}/`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                                            <LinkIcon className="h-3.5 w-3.5" />
                                            {match.pmc_id}
                                        </a>
                                    )}
                                    {match.facility && match.facility !== "Unknown" && <span>• {match.facility}</span>}
                                </div>
                            </div>
                        </div>

                        <Badge className={
                            match.outcomeVariant === "success" ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200 px-3 py-1" :
                                match.outcomeVariant === "warning" ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 px-3 py-1" :
                                    "bg-zinc-100 text-zinc-800 border-zinc-200 hover:bg-zinc-200 px-3 py-1"
                        }>
                            {match.outcome}
                        </Badge>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">

                        {/* Top Stats Row */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-zinc-200/60 shadow-sm">
                                <div className="flex items-center gap-2 text-zinc-500 mb-1">
                                    <User className="h-4 w-4" />
                                    <span className="text-xs font-semibold uppercase tracking-wider">Demographics</span>
                                </div>
                                <div className="text-base font-medium text-zinc-900">
                                    {match.age ? `${match.age}y ` : ""}
                                    {match.gender ? match.gender.charAt(0).toUpperCase() + match.gender.slice(1) : "Unknown"}
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-zinc-200/60 shadow-sm">
                                <div className="flex items-center gap-2 text-zinc-500 mb-1">
                                    <Activity className="h-4 w-4" />
                                    <span className="text-xs font-semibold uppercase tracking-wider">Primary Dx</span>
                                </div>
                                <div className="text-base font-medium text-zinc-900 truncate" title={match.diagnosis}>
                                    {match.diagnosis || "Unknown"}
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-zinc-200/60 shadow-sm lg:col-span-2">
                                <div className="flex items-center gap-2 text-zinc-500 mb-1">
                                    <Calendar className="h-4 w-4" />
                                    <span className="text-xs font-semibold uppercase tracking-wider">Publication</span>
                                </div>
                                <div className="text-sm font-medium text-zinc-900 truncate" title={match.article_title}>
                                    {match.article_title || "Unknown Article"}
                                </div>
                                <div className="text-xs text-zinc-500 mt-0.5">
                                    {match.journal && <span className="font-medium mr-2">{match.journal}</span>}
                                    {match.year && <span>{match.year}</span>}
                                </div>
                            </div>
                        </div>

                        {/* Summary Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">

                            {/* Left Column: Presentation & HPI */}
                            <div className="space-y-6">
                                <section className="bg-white rounded-xl border border-zinc-200/60 shadow-sm p-6 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-zinc-800"></div>
                                    <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 uppercase tracking-wide mb-3">
                                        <Microscope className="h-4 w-4 text-zinc-700" />
                                        Case Highlights
                                    </h3>
                                    <p className="text-[15px] leading-relaxed text-zinc-800 font-medium mb-3">
                                        {p.summary?.one_liner || match.summary || "No summary available."}
                                    </p>

                                    {p.summary?.key_points && p.summary.key_points.length > 0 && (
                                        <ul className="list-disc pl-5 mt-3 space-y-1.5 text-sm text-zinc-600">
                                            {p.summary.key_points.map((pt: string, idx: number) => (
                                                <li key={idx} className="leading-snug">{pt}</li>
                                            ))}
                                        </ul>
                                    )}
                                </section>

                                <section className="space-y-4">
                                    <h3 className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2">
                                        Presentation & History
                                    </h3>
                                    {presentation.hpi ? (
                                        <div className="text-[15px] leading-7 text-zinc-700 bg-white p-5 rounded-xl border border-zinc-200/80 shadow-sm">
                                            {presentation.hpi}
                                        </div>
                                    ) : match.case_text ? (
                                        <div className="text-[15px] leading-7 text-zinc-700 bg-white p-5 rounded-xl border border-zinc-200/80 shadow-sm">
                                            {match.case_text}
                                        </div>
                                    ) : (
                                        <p className="text-zinc-500 italic">No detailed clinical narrative provided.</p>
                                    )}
                                </section>

                                {p.outcome?.detail && (
                                    <section className="space-y-3">
                                        <h3 className="text-[15px] font-semibold text-zinc-900 uppercase tracking-wide">
                                            Case Outcome Details
                                        </h3>
                                        <div className="text-[14px] leading-relaxed text-zinc-700 bg-zinc-100/50 p-4 rounded-xl border border-zinc-200/60 shadow-inner">
                                            {p.outcome.detail}
                                        </div>
                                    </section>
                                )}
                            </div>

                            {/* Right Column: Labs, Meds, Comorbidities */}
                            <div className="space-y-6">
                                <div className="bg-zinc-50 rounded-xl border border-zinc-200/60 p-5 space-y-5">
                                    {presentation.chief_complaint && (
                                        <div>
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                <AlertTriangle className="h-3.5 w-3.5" /> Chief Complaint
                                            </h4>
                                            <p className="text-sm font-medium text-zinc-900">{presentation.chief_complaint}</p>
                                        </div>
                                    )}

                                    {patient.comorbidities && patient.comorbidities.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Comorbidities</h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {patient.comorbidities.map((c: string, idx: number) => (
                                                    <Badge key={idx} variant="secondary" className="bg-white border border-zinc-200 text-zinc-700 font-medium hover:bg-zinc-50">{c}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {patient.medications && patient.medications.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <Pill className="h-3.5 w-3.5" /> Medications
                                            </h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {patient.medications.map((m: string, idx: number) => (
                                                    <span key={idx} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md">
                                                        {m}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {presentation.pmh && (
                                        <div>
                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Past Medical History</h4>
                                            <p className="text-xs text-zinc-700 leading-relaxed">{presentation.pmh}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-zinc-50 rounded-xl border border-zinc-200/60 p-5">
                                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        Structured Findings
                                    </h4>
                                    <div className="space-y-2 text-sm text-zinc-700">
                                        {findings?.lungs?.consolidation_present === "yes" && <div className="flex gap-2"><span className="shrink-0 text-amber-600">•</span> Lung Consolidation</div>}
                                        {findings?.lungs?.edema_present === "yes" && <div className="flex gap-2"><span className="shrink-0 text-amber-600">•</span> Pulmonary Edema</div>}
                                        {findings?.lungs?.atelectasis_present === "yes" && <div className="flex gap-2"><span className="shrink-0 text-amber-600">•</span> Atelectasis</div>}
                                        {findings?.pleura?.effusion_present === "yes" && <div className="flex gap-2"><span className="shrink-0 text-amber-600">•</span> Pleural Effusion</div>}
                                        {findings?.pleura?.pneumothorax_present === "yes" && <div className="flex gap-2"><span className="shrink-0 text-amber-600">•</span> Pneumothorax</div>}
                                        {findings?.cardiomediastinal?.cardiomegaly === "yes" && <div className="flex gap-2"><span className="shrink-0 text-amber-600">•</span> Cardiomegaly</div>}
                                        {(!findings || Object.keys(findings).length === 0) && <span className="text-zinc-500 italic">No structured findings extracted.</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Image Grid */}
                        <section className="space-y-4 pt-4 border-t border-zinc-200/60">
                            <h3 className="text-lg font-semibold text-zinc-900 pb-2 flex items-center gap-2">
                                <ImageIcon className="h-5 w-5 text-zinc-500" /> Case Imaging
                            </h3>
                            {relatedImgs.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(p.image_url ? [{ local_image_path: p.image_url, caption: p.study?.caption || "Primary View", image_subtype: "Dataset Image" } as any] : []).concat(relatedImgs).map((img, idx) => {
                                        const url = img.local_image_path?.startsWith("http") ? img.local_image_path : `https://storage.googleapis.com/casetwin-xrays/${img.local_image_path}`;
                                        return (
                                            <div key={idx} className="bg-white p-3 rounded-xl border border-zinc-200/80 shadow-sm flex flex-col gap-2 relative group hover:border-zinc-300 transition-colors">
                                                <div className="aspect-[4/3] w-full bg-zinc-100 flex items-center justify-center rounded-lg overflow-hidden relative">
                                                    <img src={url} alt={`Case image ${idx + 1}`} className="w-full h-full object-contain mix-blend-multiply" />
                                                </div>
                                                <p className="text-xs text-zinc-600 leading-snug line-clamp-3 px-1">{img.caption || img.image_subtype || "Clinical image"}</p>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : match.image_url ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white p-3 rounded-xl border border-zinc-200/80 shadow-sm flex flex-col gap-2">
                                        <div className="aspect-[4/3] w-full bg-zinc-100 flex items-center justify-center rounded-lg overflow-hidden">
                                            <img src={match.image_url} alt="Historical Case Imaging" className="w-full h-full object-contain mix-blend-multiply" />
                                        </div>
                                        <p className="text-xs text-zinc-600 leading-snug px-1">{p.study?.caption || "Primary View"}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-zinc-500 italic bg-zinc-50/50 p-6 rounded-xl border border-dashed border-zinc-200 text-center">No images available for this historical case.</p>
                            )}
                        </section>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
