import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type MatchItem } from "@/lib/mockUploadApis";
import { Clock, FileText, User, Microscope, Activity, Link as LinkIcon, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TwinProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    match: MatchItem | null;
}

export function TwinProfileModal({ isOpen, onClose, match }: TwinProfileModalProps) {
    if (!match) return null;

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
                                    <Badge variant="secondary" className="bg-zinc-50">Match: {match.score}%</Badge>
                                    {match.pmc_id && (
                                        <span className="flex items-center gap-1">
                                            <LinkIcon className="h-3.5 w-3.5" />
                                            {match.pmc_id}
                                        </span>
                                    )}
                                    {match.facility && <span>• {match.facility}</span>}
                                </div>
                            </div>
                        </div>

                        <Badge className={
                            match.outcomeVariant === "success" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" :
                                match.outcomeVariant === "warning" ? "bg-amber-100 text-amber-800 hover:bg-amber-200" :
                                    "bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
                        }>
                            {match.outcome}
                        </Badge>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">

                        {/* Top Stats Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-zinc-200/60 shadow-sm">
                                <div className="flex items-center gap-2 text-zinc-500 mb-1">
                                    <User className="h-4 w-4" />
                                    <span className="text-xs font-semibold uppercase tracking-wider">Demographics</span>
                                </div>
                                <div className="text-base font-medium text-zinc-900">
                                    {match.age ? `${match.age}y ` : ""}
                                    {match.gender ? match.gender.charAt(0).toUpperCase() + match.gender.slice(1) : "Unknown"}
                                    {(!match.age && !match.gender) && "Unspecified"}
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

                            <div className="bg-white p-4 rounded-xl border border-zinc-200/60 shadow-sm sm:col-span-2">
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

                        {/* Summary Box */}
                        <section className="bg-white rounded-xl border border-zinc-200/60 shadow-sm p-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-zinc-800"></div>
                            <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 uppercase tracking-wide mb-3">
                                <Microscope className="h-4 w-4 text-zinc-700" />
                                Case Summary
                            </h3>
                            <p className="text-[15px] leading-relaxed text-zinc-700">
                                {match.summary || "No summary available."}
                            </p>
                        </section>

                        {/* Full text */}
                        <section className="space-y-4">
                            <h3 className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2">
                                Detailed Clinical Narrative
                            </h3>
                            <div className="prose prose-zinc max-w-none">
                                {match.case_text ? (
                                    <div className="text-[15px] leading-7 text-zinc-700 whitespace-pre-wrap bg-white p-6 rounded-xl border border-zinc-200/80 shadow-sm">
                                        {match.case_text}
                                    </div>
                                ) : (
                                    <p className="text-zinc-500 italic">No detailed clinical narrative provided for this case.</p>
                                )}
                            </div>
                        </section>

                        {/* Image (if any) */}
                        {match.image_url && (
                            <section className="space-y-4">
                                <h3 className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2">
                                    Available Imaging
                                </h3>
                                <div className="bg-white p-6 rounded-xl border border-zinc-200/80 shadow-sm flex items-center justify-center bg-zinc-100/50">
                                    <img src={match.image_url} alt="Historical Case Imaging" className="max-h-[400px] object-contain rounded border border-zinc-200 bg-white" />
                                </div>
                            </section>
                        )}

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
